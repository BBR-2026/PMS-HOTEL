"""
Cantine Module — Staff & Prestataire canteen management.

Phase A scope (this iteration):
    - Public account creation with auto-generated 6-char code (AAA999)
    - Tomorrow's lunch reservation (1 reservation = 1 credit consumed)
    - Tablet-grade check-in (pointage) interface
    - Basic RH dashboard + service breakdown
    - Excel + PDF exports
    - Configurable services + global default-credits setting
    - Auto-renew credits on 1st of month (cron)
    - Auto-mark missed reservations as "absent" at end of day (cron)

Phase B (future):
    - Advanced admin (CRUD users, reset codes, exception meals)
    - Dedicated kitchen dashboard
    - Operation history / audit log
    - QR / badge / mobile app
"""
from __future__ import annotations

import io
import random
import string
import uuid
from datetime import datetime, timezone, timedelta, date
from typing import Optional, Literal, List

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from openpyxl import Workbook
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet
from fastapi.responses import StreamingResponse


# Roles allowed on the staff dashboard
CANTINE_STAFF_ROLES = ["admin", "management_general", "directeur", "rh", "cuisine"]
CANTINE_POINTAGE_ROLES = ["admin", "management_general", "directeur", "rh", "cuisine",
                          "hotesse", "verification"]
CANTINE_ADMIN_ROLES = ["admin", "management_general", "directeur", "rh"]


DEFAULT_SERVICES = [
    # iter-45: liste officielle des services BBr fournie par le user.
    "Ressources Humaines",
    "Logistique et Moyens Généraux",
    "Achats",
    "Technique",
    "Hébergement",
    "Food & Beverage",
    "Beach Club",
    "Cuisine",
    "Finance",
    "Informatique",
    "Guest Relationship",
    "Commercial",
    "Marketing",
    "Sécurité",
    "Prestataires",
    "Extras",
]

# iter-45: ancienne liste auto-seedée jusqu'en iter-42 — détectée pour migrer
# automatiquement les bases existantes vers la nouvelle nomenclature.
_LEGACY_SERVICES = {
    "Réception", "Restaurant", "Cuisine", "Housekeeping", "Maintenance",
    "Administration", "Comptabilité", "Informatique", "Sécurité", "Prestataires",
}


# ────────────────────────────────────────────────────────────────────────────
# Pydantic models
# ────────────────────────────────────────────────────────────────────────────
class CanteenUserCreate(BaseModel):
    first_name: str = Field(min_length=1, max_length=60)
    last_name: str = Field(min_length=1, max_length=60)
    service: str = Field(min_length=1, max_length=80)
    position: str = Field(min_length=1, max_length=120)
    type: Literal["personnel", "prestataire"] = "personnel"
    phone: Optional[str] = Field(default=None, max_length=30)


class CanteenReserveRequest(BaseModel):
    code: str = Field(min_length=6, max_length=6)
    confirmed: bool = True


class CanteenPointageRequest(BaseModel):
    code: str = Field(min_length=6, max_length=6)
    supervisor_override: bool = False
    exception_reason: Optional[str] = None


class CanteenSettingsUpdate(BaseModel):
    default_credits_personnel: Optional[int] = Field(default=None, ge=0, le=62)
    default_credits_prestataire: Optional[int] = Field(default=None, ge=0, le=62)
    auto_renew_enabled: Optional[bool] = None
    # iter-45: reservation-window controls
    meal_offset_days: Optional[int] = Field(default=None, ge=0, le=7,
        description="0 = today's lunch, 1 = tomorrow, 2 = day after…")
    reservation_open_hhmm: Optional[str] = Field(default=None,
        pattern=r"^([0-1]\d|2[0-3]):[0-5]\d$",
        description="Heure d'ouverture des inscriptions (HH:MM, fuseau Abidjan)")
    reservation_close_hhmm: Optional[str] = Field(default=None,
        pattern=r"^([0-1]\d|2[0-3]):[0-5]\d$",
        description="Heure de clôture des inscriptions")
    # Prompt 3 — capacity + waitlist
    max_capacity_per_day: Optional[int] = Field(default=None, ge=0, le=10000,
        description="Capacité maximale de repas par jour (0 = illimité)")
    waitlist_enabled: Optional[bool] = Field(default=None,
        description="Si capacité atteinte, basculer en liste d'attente")


class CanteenServiceUpsert(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    sort_order: int = 0
    active: bool = True


class CanteenUserUpdate(BaseModel):
    """Partial admin-only update for a canteen user. All fields optional."""
    first_name: Optional[str] = Field(default=None, min_length=1, max_length=60)
    last_name: Optional[str] = Field(default=None, min_length=1, max_length=60)
    service: Optional[str] = Field(default=None, min_length=1, max_length=80)
    position: Optional[str] = Field(default=None, min_length=1, max_length=120)
    type: Optional[Literal["personnel", "prestataire"]] = None
    phone: Optional[str] = Field(default=None, max_length=30)
    active: Optional[bool] = None
    credits_attributed: Optional[int] = Field(default=None, ge=0, le=62)


# ────────────────────────────────────────────────────────────────────────────
# Helpers
# ────────────────────────────────────────────────────────────────────────────
def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _today_abidjan() -> date:
    # Côte d'Ivoire = UTC+0, so utcnow date == local date.
    return datetime.now(timezone.utc).date()


def _tomorrow_iso() -> str:
    return (_today_abidjan() + timedelta(days=1)).isoformat()


def _gen_code() -> str:
    letters = "".join(random.choices(string.ascii_uppercase, k=3))
    digits = "".join(random.choices(string.digits, k=3))
    return f"{letters}{digits}"


async def _ensure_unique_code(db) -> str:
    """Generate a unique AAA999 code (max 20 attempts to avoid infinite loop)."""
    for _ in range(20):
        code = _gen_code()
        existing = await db.canteen_users.find_one({"code": code}, {"_id": 0, "code": 1})
        if not existing:
            return code
    raise HTTPException(status_code=500, detail="Could not generate a unique code, please retry.")


async def _get_settings(db) -> dict:
    """Return the singleton settings doc, creating it if missing."""
    s = await db.canteen_settings.find_one({"_id": "global"}, {"_id": 0})
    if not s:
        s = {
            "default_credits_personnel": 22,
            "default_credits_prestataire": 0,
            "auto_renew_enabled": True,
            "current_period": _today_abidjan().strftime("%Y-%m"),
            # iter-45: configurable reservation window (admin override)
            "meal_offset_days": 1,            # 0=today, 1=tomorrow
            "reservation_open_hhmm": "00:00", # opens at this HH:MM (Abidjan UTC+0)
            "reservation_close_hhmm": "23:59",
            # Prompt 3 — Cantine fermeture auto & gestion capacité
            "max_capacity_per_day": 100,       # 0 = illimité
            "waitlist_enabled": True,
            "manual_closures": [],             # list of YYYY-MM-DD dates manually closed
            "manual_openings": [],             # list of YYYY-MM-DD dates manually re-opened
        }
        await db.canteen_settings.update_one(
            {"_id": "global"}, {"$set": s}, upsert=True,
        )
    else:
        # iter-45: ensure new fields exist on already-created singletons
        upd = {}
        if "meal_offset_days" not in s:
            upd["meal_offset_days"] = 1
        if "reservation_open_hhmm" not in s:
            upd["reservation_open_hhmm"] = "00:00"
        if "reservation_close_hhmm" not in s:
            upd["reservation_close_hhmm"] = "23:59"
        # Prompt 3 — backfill capacity/closure fields
        if "max_capacity_per_day" not in s:
            upd["max_capacity_per_day"] = 100
        if "waitlist_enabled" not in s:
            upd["waitlist_enabled"] = True
        if "manual_closures" not in s:
            upd["manual_closures"] = []
        if "manual_openings" not in s:
            upd["manual_openings"] = []
        if upd:
            await db.canteen_settings.update_one(
                {"_id": "global"}, {"$set": upd},
            )
            s.update(upd)
    return s


def _parse_hhmm(s: str, fallback: tuple = (0, 0)) -> tuple:
    """Parse "HH:MM" into (h, m). Returns fallback on garbage input."""
    try:
        h, m = s.split(":")
        return (int(h), int(m))
    except Exception:
        return fallback


def _within_window(open_hhmm: str, close_hhmm: str) -> bool:
    """True if current Abidjan-local time is within the inclusive window.

    Supports same-day windows (open<=close) AND overnight windows
    (open>close, e.g. open=18:00 close=09:00 wraps midnight).
    """
    now = datetime.now(timezone.utc)
    cur = now.hour * 60 + now.minute
    oh, om = _parse_hhmm(open_hhmm, (0, 0))
    ch, cm = _parse_hhmm(close_hhmm, (23, 59))
    o = oh * 60 + om
    c = ch * 60 + cm
    if o <= c:
        return o <= cur <= c
    # overnight wrap
    return cur >= o or cur <= c


async def _ensure_default_services(db) -> None:
    """Seed the default services if missing OR migrate legacy list (iter-45)."""
    existing = await db.canteen_services.find({}, {"_id": 0, "name": 1}).to_list(length=500)
    names = {s["name"] for s in existing}
    if not names:
        docs = [
            {"id": str(uuid.uuid4()), "name": name, "sort_order": i,
             "active": True, "created_at": _now_iso()}
            for i, name in enumerate(DEFAULT_SERVICES)
        ]
        await db.canteen_services.insert_many(docs)
        return
    # iter-45: auto-migrate the legacy seed (iter-42) to the official BBr
    # nomenclature. Only triggers when the DB still has the EXACT legacy set
    # and nothing else — protects manually-added services.
    if names == _LEGACY_SERVICES:
        # Wipe & reseed with the new list. Existing canteen_users that
        # referenced an old service name will be remapped below.
        remap = {
            "Réception": "Guest Relationship",
            "Restaurant": "Food & Beverage",
            "Housekeeping": "Hébergement",
            "Maintenance": "Technique",
            "Administration": "Ressources Humaines",
            "Comptabilité": "Finance",
            # identical names just need to be kept as-is
        }
        await db.canteen_services.delete_many({})
        docs = [
            {"id": str(uuid.uuid4()), "name": name, "sort_order": i,
             "active": True, "created_at": _now_iso()}
            for i, name in enumerate(DEFAULT_SERVICES)
        ]
        await db.canteen_services.insert_many(docs)
        # Remap users
        for old, new in remap.items():
            await db.canteen_users.update_many(
                {"service": old}, {"$set": {"service": new}},
            )
        # Remap reservations too so historical lookups stay consistent
        for old, new in remap.items():
            await db.canteen_reservations.update_many(
                {"service": old}, {"$set": {"service": new}},
            )


async def _public_user_view(user: dict) -> dict:
    """Sanitize a canteen user for public lookup (hides phone, internal IDs)."""
    return {
        "code": user["code"],
        "first_name": user["first_name"],
        "last_name": user["last_name"],
        "service": user["service"],
        "position": user["position"],
        "type": user["type"],
        "credits_attributed": user.get("credits_attributed", 0),
        "credits_consumed": user.get("credits_consumed", 0),
        "credits_remaining": max(0, user.get("credits_attributed", 0)
                                 - user.get("credits_consumed", 0)),
        "active": user.get("active", True),
    }


# ────────────────────────────────────────────────────────────────────────────
# Router
# ────────────────────────────────────────────────────────────────────────────
def build_router(db, get_current_staff, require_role) -> APIRouter:
    r = APIRouter()

    # ── Public: services list (used by the inscription form) ──────────────
    @r.get("/cantine/public/services")
    async def public_services():
        await _ensure_default_services(db)
        items = await db.canteen_services.find(
            {"active": True}, {"_id": 0, "id": 1, "name": 1, "sort_order": 1},
        ).sort("sort_order", 1).to_list(length=200)
        return {"items": items}

    # ── Public: create canteen account ────────────────────────────────────
    @r.post("/cantine/public/users")
    async def create_user(payload: CanteenUserCreate):
        await _ensure_default_services(db)
        settings = await _get_settings(db)

        # Validate service exists & is active (case-insensitive lookup)
        svc = await db.canteen_services.find_one(
            {"name": {"$regex": f"^{payload.service.strip()}$", "$options": "i"},
             "active": True},
            {"_id": 0, "name": 1},
        )
        if not svc:
            raise HTTPException(status_code=400, detail=f"Service '{payload.service}' inconnu.")

        # Refuse duplicates (same first+last+service)
        dup = await db.canteen_users.find_one({
            "first_name": {"$regex": f"^{payload.first_name.strip()}$", "$options": "i"},
            "last_name": {"$regex": f"^{payload.last_name.strip()}$", "$options": "i"},
            "service": svc["name"],
        }, {"_id": 0, "code": 1})
        if dup:
            raise HTTPException(
                status_code=409,
                detail=f"Un compte existe déjà avec ce nom dans ce service (code: {dup['code']}). "
                       f"Contactez les RH pour récupérer votre code.",
            )

        code = await _ensure_unique_code(db)
        default_credits = (settings["default_credits_personnel"]
                           if payload.type == "personnel"
                           else settings["default_credits_prestataire"])

        doc = {
            "id": str(uuid.uuid4()),
            "code": code,
            "first_name": payload.first_name.strip(),
            "last_name": payload.last_name.strip(),
            "service": svc["name"],
            "position": payload.position.strip(),
            "type": payload.type,
            "phone": (payload.phone or "").strip() or None,
            "active": True,
            "credits_attributed": default_credits,
            "credits_consumed": 0,
            "credits_period": settings.get("current_period",
                                            _today_abidjan().strftime("%Y-%m")),
            "created_at": _now_iso(),
            "updated_at": _now_iso(),
        }
        await db.canteen_users.insert_one(doc)
        return await _public_user_view(doc)

    # ── Public: lookup user by code (for the "Cantine de demain" form) ───
    @r.get("/cantine/public/users/{code}")
    async def lookup_user(code: str):
        code = code.strip().upper()
        user = await db.canteen_users.find_one(
            {"code": code, "active": True}, {"_id": 0},
        )
        if not user:
            raise HTTPException(status_code=404, detail="Code Cantine introuvable ou désactivé.")
        return await _public_user_view(user)

    # ── Public: reserve the next meal (window-controlled) ────────────────
    @r.post("/cantine/public/reservations")
    async def reserve_tomorrow(payload: CanteenReserveRequest):
        if not payload.confirmed:
            raise HTTPException(status_code=400, detail="Veuillez confirmer votre présence.")
        code = payload.code.strip().upper()

        # iter-45: respect admin-configured window + meal offset
        settings = await _get_settings(db)
        open_hhmm = settings.get("reservation_open_hhmm", "00:00")
        close_hhmm = settings.get("reservation_close_hhmm", "23:59")
        if not _within_window(open_hhmm, close_hhmm):
            raise HTTPException(
                status_code=400,
                detail=f"Inscriptions fermées. Ouvert chaque jour de "
                       f"{open_hhmm} à {close_hhmm} (heure Abidjan).",
            )

        offset = int(settings.get("meal_offset_days", 1) or 0)
        meal_date = (_today_abidjan() + timedelta(days=max(0, offset))).isoformat()

        # Prompt 3 — manual closure override (closes that specific date even
        # if the daily window would otherwise be open).
        if meal_date in (settings.get("manual_closures") or []):
            raise HTTPException(
                status_code=400,
                detail=f"Les inscriptions du {meal_date} ont été clôturées manuellement par l'administration.",
            )

        user = await db.canteen_users.find_one(
            {"code": code, "active": True}, {"_id": 0},
        )
        if not user:
            raise HTTPException(status_code=404, detail="Code Cantine introuvable ou désactivé.")

        remaining = (user.get("credits_attributed", 0)
                     - user.get("credits_consumed", 0))
        if remaining <= 0:
            raise HTTPException(
                status_code=400,
                detail="Vous n'avez plus de crédits repas disponibles pour ce mois.",
            )

        # Idempotency: refuse a duplicate same-user / same-date reservation
        existing = await db.canteen_reservations.find_one(
            {"user_code": code, "meal_date": meal_date}, {"_id": 0, "id": 1},
        )
        if existing:
            raise HTTPException(
                status_code=409,
                detail=f"Vous êtes déjà inscrit(e) au repas du {meal_date}.",
            )

        # Prompt 3 — capacity & waitlist
        capacity = int(settings.get("max_capacity_per_day") or 0)
        reservation_status = "reserved"
        position_in_waitlist = None
        if capacity > 0:
            current_count = await db.canteen_reservations.count_documents({
                "meal_date": meal_date,
                "status": {"$in": ["reserved"]},
            })
            if current_count >= capacity:
                if not settings.get("waitlist_enabled", True):
                    raise HTTPException(
                        status_code=409,
                        detail=f"La capacité maximum ({capacity} repas) est atteinte pour le {meal_date}.",
                    )
                # Add to waitlist
                wl_count = await db.canteen_reservations.count_documents({
                    "meal_date": meal_date,
                    "status": "waitlisted",
                })
                reservation_status = "waitlisted"
                position_in_waitlist = wl_count + 1

        reservation = {
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "user_code": code,
            "first_name": user["first_name"],
            "last_name": user["last_name"],
            "service": user["service"],
            "position": user["position"],
            "type": user["type"],
            "meal_date": meal_date,
            "status": reservation_status,
            "waitlist_position": position_in_waitlist,
            "reserved_at": _now_iso(),
            "consumed_at": None,
            "consumed_by_staff_id": None,
            "supervisor_override": False,
            "exception_reason": None,
        }
        await db.canteen_reservations.insert_one(reservation)

        # Prompt 3 — only consume a credit when actually reserved (waitlist
        # entries don't consume until they get promoted).
        if reservation_status == "reserved":
            await db.canteen_users.update_one(
                {"id": user["id"]},
                {"$inc": {"credits_consumed": 1},
                 "$set": {"updated_at": _now_iso()}},
            )
            new_remaining = remaining - 1
        else:
            new_remaining = remaining

        return {
            "ok": True,
            "meal_date": meal_date,
            "reservation_id": reservation["id"],
            "status": reservation_status,
            "waitlist_position": position_in_waitlist,
            "credits_remaining": new_remaining,
            "guest_name": f"{user['first_name']} {user['last_name']}",
        }

    # ── Public: window status (used by ReservePanel to display open/close) ──
    @r.get("/cantine/public/window")
    async def public_window():
        settings = await _get_settings(db)
        offset = int(settings.get("meal_offset_days", 1) or 0)
        meal_date = (_today_abidjan() + timedelta(days=max(0, offset))).isoformat()
        manual_closures = settings.get("manual_closures") or []
        manually_closed = meal_date in manual_closures
        is_open_window = _within_window(
            settings.get("reservation_open_hhmm", "00:00"),
            settings.get("reservation_close_hhmm", "23:59"),
        )
        capacity = int(settings.get("max_capacity_per_day") or 0)
        reserved_count = await db.canteen_reservations.count_documents({
            "meal_date": meal_date, "status": "reserved",
        })
        waitlist_count = await db.canteen_reservations.count_documents({
            "meal_date": meal_date, "status": "waitlisted",
        })
        capacity_reached = capacity > 0 and reserved_count >= capacity
        return {
            "open_hhmm": settings.get("reservation_open_hhmm", "00:00"),
            "close_hhmm": settings.get("reservation_close_hhmm", "23:59"),
            "is_open": is_open_window and not manually_closed,
            "manually_closed": manually_closed,
            "capacity_reached": capacity_reached,
            "waitlist_enabled": settings.get("waitlist_enabled", True),
            "reserved_count": reserved_count,
            "waitlist_count": waitlist_count,
            "max_capacity": capacity,
            "meal_date": meal_date,
            "meal_offset_days": offset,
        }

    # ── Staff: dashboard summary ──────────────────────────────────────────
    @r.get("/staff/cantine/dashboard")
    async def staff_dashboard(staff=Depends(get_current_staff)):
        await require_role(staff, CANTINE_STAFF_ROLES)
        await _ensure_default_services(db)

        today = _today_abidjan().isoformat()
        tomorrow = _tomorrow_iso()

        tomorrow_count = await db.canteen_reservations.count_documents(
            {"meal_date": tomorrow},
        )
        today_consumed = await db.canteen_reservations.count_documents(
            {"meal_date": today, "status": "consumed"},
        )
        today_reserved = await db.canteen_reservations.count_documents(
            {"meal_date": today},
        )
        today_absent = await db.canteen_reservations.count_documents(
            {"meal_date": today, "status": "absent"},
        )
        attendance_rate = (
            (today_consumed / today_reserved * 100.0) if today_reserved else 0.0
        )
        active_users = await db.canteen_users.count_documents({"active": True})

        # Tomorrow breakdown by type
        tomorrow_personnel = await db.canteen_reservations.count_documents(
            {"meal_date": tomorrow, "type": "personnel"},
        )
        tomorrow_prestataire = await db.canteen_reservations.count_documents(
            {"meal_date": tomorrow, "type": "prestataire"},
        )

        # Tomorrow breakdown by service
        pipeline = [
            {"$match": {"meal_date": tomorrow}},
            {"$group": {"_id": "$service", "n": {"$sum": 1}}},
            {"$sort": {"n": -1}},
        ]
        service_rows = await db.canteen_reservations.aggregate(pipeline).to_list(length=50)
        by_service = [{"service": r["_id"], "count": r["n"]} for r in service_rows]

        return {
            "today": today,
            "tomorrow": tomorrow,
            "tomorrow_total": tomorrow_count,
            "tomorrow_personnel": tomorrow_personnel,
            "tomorrow_prestataire": tomorrow_prestataire,
            "today_reserved": today_reserved,
            "today_consumed": today_consumed,
            "today_absent": today_absent,
            "attendance_rate": round(attendance_rate, 1),
            "active_users": active_users,
            "by_service_tomorrow": by_service,
        }

    # ── Staff: reservations list (with date filter) ──────────────────────
    @r.get("/staff/cantine/reservations")
    async def staff_reservations(
        meal_date: Optional[str] = Query(default=None, description="YYYY-MM-DD"),
        scope: Literal["today", "tomorrow", "date", "all"] = "tomorrow",
        status: Optional[Literal["reserved", "consumed", "absent"]] = None,
        staff=Depends(get_current_staff),
    ):
        await require_role(staff, CANTINE_STAFF_ROLES)
        flt: dict = {}
        if scope == "today":
            flt["meal_date"] = _today_abidjan().isoformat()
        elif scope == "tomorrow":
            flt["meal_date"] = _tomorrow_iso()
        elif scope == "date":
            if not meal_date:
                raise HTTPException(status_code=400, detail="meal_date requis")
            flt["meal_date"] = meal_date
        if status:
            flt["status"] = status
        items = await db.canteen_reservations.find(
            flt, {"_id": 0},
        ).sort("reserved_at", -1).to_list(length=2000)
        return {"items": items, "total": len(items)}

    # ── Staff: pointage (tablet check-in) ────────────────────────────────
    @r.post("/staff/cantine/pointage")
    async def pointage(payload: CanteenPointageRequest,
                       staff=Depends(get_current_staff)):
        await require_role(staff, CANTINE_POINTAGE_ROLES)
        code = payload.code.strip().upper()

        user = await db.canteen_users.find_one(
            {"code": code, "active": True}, {"_id": 0},
        )
        if not user:
            raise HTTPException(status_code=404,
                                detail="Code Cantine introuvable ou compte désactivé.")

        today = _today_abidjan().isoformat()

        # Already consumed today?
        already = await db.canteen_reservations.find_one(
            {"user_code": code, "meal_date": today, "status": "consumed"},
            {"_id": 0, "id": 1},
        )
        if already:
            raise HTTPException(
                status_code=409,
                detail=f"{user['first_name']} {user['last_name']} a déjà pointé aujourd'hui.",
            )

        # Find the reserved entry for today
        res = await db.canteen_reservations.find_one(
            {"user_code": code, "meal_date": today, "status": "reserved"},
            {"_id": 0},
        )

        if not res:
            # Not reserved → require supervisor override
            if not payload.supervisor_override:
                # Surface a 422 with a sentinel detail the UI can detect
                raise HTTPException(
                    status_code=422,
                    detail={
                        "code": "not_reserved",
                        "message": f"{user['first_name']} {user['last_name']} "
                                   f"n'était pas inscrit(e) pour aujourd'hui.",
                        "user": await _public_user_view(user),
                    },
                )
            # Supervisor authorized exception → create a consumed reservation on the fly.
            # This does NOT deduct from monthly credits (exception meal).
            res_doc = {
                "id": str(uuid.uuid4()),
                "user_id": user["id"],
                "user_code": code,
                "first_name": user["first_name"],
                "last_name": user["last_name"],
                "service": user["service"],
                "position": user["position"],
                "type": user["type"],
                "meal_date": today,
                "status": "consumed",
                "reserved_at": None,
                "consumed_at": _now_iso(),
                "consumed_by_staff_id": staff.get("id"),
                "supervisor_override": True,
                "exception_reason": (payload.exception_reason or "Autorisation superviseur"),
            }
            await db.canteen_reservations.insert_one(res_doc)
            return {
                "ok": True, "exception": True,
                "user": await _public_user_view(user),
                "message": f"Bon appétit {user['first_name']} {user['last_name']} ! "
                           f"(Repas exceptionnel autorisé)",
            }

        # Normal case: flip the existing reservation to "consumed"
        await db.canteen_reservations.update_one(
            {"id": res["id"]},
            {"$set": {
                "status": "consumed",
                "consumed_at": _now_iso(),
                "consumed_by_staff_id": staff.get("id"),
            }},
        )
        return {
            "ok": True, "exception": False,
            "user": await _public_user_view(user),
            "message": f"Bon appétit {user['first_name']} {user['last_name']} !",
        }

    # ── Staff: user list with credit tracking + search filters ───────────
    @r.get("/staff/cantine/users")
    async def staff_users(
        type: Optional[Literal["personnel", "prestataire"]] = None,
        service: Optional[str] = None,
        q: Optional[str] = Query(default=None, description="search by name/code"),
        active: Optional[bool] = None,
        staff=Depends(get_current_staff),
    ):
        await require_role(staff, CANTINE_STAFF_ROLES)
        flt: dict = {}
        if type:
            flt["type"] = type
        if service:
            flt["service"] = service
        if active is not None:
            flt["active"] = active
        if q:
            qre = {"$regex": q.strip(), "$options": "i"}
            flt["$or"] = [
                {"first_name": qre}, {"last_name": qre},
                {"code": qre}, {"position": qre}, {"phone": qre},
            ]
        items = await db.canteen_users.find(flt, {"_id": 0}).sort(
            [("active", -1), ("created_at", -1)],
        ).to_list(length=5000)
        for it in items:
            it["credits_remaining"] = max(
                0, it.get("credits_attributed", 0) - it.get("credits_consumed", 0),
            )
        return {"items": items, "total": len(items)}

    # ── Staff: get single user ────────────────────────────────────────────
    @r.get("/staff/cantine/users/{user_id}")
    async def staff_user_get(user_id: str, staff=Depends(get_current_staff)):
        await require_role(staff, CANTINE_STAFF_ROLES)
        u = await db.canteen_users.find_one({"id": user_id}, {"_id": 0})
        if not u:
            raise HTTPException(status_code=404, detail="Utilisateur introuvable.")
        u["credits_remaining"] = max(0, u.get("credits_attributed", 0)
                                     - u.get("credits_consumed", 0))
        return u

    # ── Staff: update user (admin) ────────────────────────────────────────
    @r.patch("/staff/cantine/users/{user_id}")
    async def staff_user_update(user_id: str, payload: CanteenUserUpdate,
                                staff=Depends(get_current_staff)):
        await require_role(staff, CANTINE_ADMIN_ROLES)
        existing = await db.canteen_users.find_one({"id": user_id}, {"_id": 0})
        if not existing:
            raise HTTPException(status_code=404, detail="Utilisateur introuvable.")
        upd = {k: v for k, v in payload.dict().items() if v is not None}
        # If service is changed, normalise to canonical name & validate
        if "service" in upd:
            svc = await db.canteen_services.find_one(
                {"name": {"$regex": f"^{upd['service'].strip()}$", "$options": "i"},
                 "active": True},
                {"_id": 0, "name": 1},
            )
            if not svc:
                raise HTTPException(status_code=400, detail="Service inconnu.")
            upd["service"] = svc["name"]
        upd["updated_at"] = _now_iso()
        await db.canteen_users.update_one({"id": user_id}, {"$set": upd})
        updated = await db.canteen_users.find_one({"id": user_id}, {"_id": 0})
        updated["credits_remaining"] = max(
            0, updated.get("credits_attributed", 0)
            - updated.get("credits_consumed", 0),
        )
        return updated

    # ── Staff: regenerate a user's Code Cantine ──────────────────────────
    @r.post("/staff/cantine/users/{user_id}/regenerate-code")
    async def staff_user_regen_code(user_id: str,
                                    staff=Depends(get_current_staff)):
        await require_role(staff, CANTINE_ADMIN_ROLES)
        existing = await db.canteen_users.find_one({"id": user_id},
                                                   {"_id": 0, "code": 1})
        if not existing:
            raise HTTPException(status_code=404, detail="Utilisateur introuvable.")
        new_code = await _ensure_unique_code(db)
        await db.canteen_users.update_one(
            {"id": user_id},
            {"$set": {"code": new_code,
                      "previous_code": existing.get("code"),
                      "code_rotated_at": _now_iso(),
                      "updated_at": _now_iso()}},
        )
        return {"ok": True, "code": new_code,
                "previous_code": existing.get("code")}

    # ── Staff: deactivate (soft) ─────────────────────────────────────────
    @r.post("/staff/cantine/users/{user_id}/deactivate")
    async def staff_user_deactivate(user_id: str,
                                    staff=Depends(get_current_staff)):
        await require_role(staff, CANTINE_ADMIN_ROLES)
        res = await db.canteen_users.update_one(
            {"id": user_id},
            {"$set": {"active": False, "deactivated_at": _now_iso(),
                      "updated_at": _now_iso()}},
        )
        if res.matched_count == 0:
            raise HTTPException(status_code=404, detail="Utilisateur introuvable.")
        return {"ok": True}

    # ── Staff: reactivate ────────────────────────────────────────────────
    @r.post("/staff/cantine/users/{user_id}/activate")
    async def staff_user_activate(user_id: str,
                                  staff=Depends(get_current_staff)):
        await require_role(staff, CANTINE_ADMIN_ROLES)
        res = await db.canteen_users.update_one(
            {"id": user_id},
            {"$set": {"active": True, "deactivated_at": None,
                      "updated_at": _now_iso()}},
        )
        if res.matched_count == 0:
            raise HTTPException(status_code=404, detail="Utilisateur introuvable.")
        return {"ok": True}

    # ── Staff: hard delete (with cascading reservation cleanup) ──────────
    @r.delete("/staff/cantine/users/{user_id}")
    async def staff_user_delete(user_id: str,
                                staff=Depends(get_current_staff)):
        await require_role(staff, CANTINE_ADMIN_ROLES)
        u = await db.canteen_users.find_one({"id": user_id}, {"_id": 0, "code": 1})
        if not u:
            raise HTTPException(status_code=404, detail="Utilisateur introuvable.")
        # Keep historical reservations (do NOT delete) — they reference user_code
        # which is enough for audit. Only nuke the user record.
        await db.canteen_users.delete_one({"id": user_id})
        return {"ok": True, "deleted_code": u["code"]}

    # ── Staff: services CRUD ──────────────────────────────────────────────
    @r.get("/staff/cantine/services")
    async def staff_services_list(staff=Depends(get_current_staff)):
        await require_role(staff, CANTINE_STAFF_ROLES)
        await _ensure_default_services(db)
        items = await db.canteen_services.find({}, {"_id": 0}).sort("sort_order", 1).to_list(length=200)
        return {"items": items}

    @r.post("/staff/cantine/services")
    async def staff_services_create(payload: CanteenServiceUpsert,
                                    staff=Depends(get_current_staff)):
        await require_role(staff, CANTINE_ADMIN_ROLES)
        # uniqueness
        dup = await db.canteen_services.find_one(
            {"name": {"$regex": f"^{payload.name.strip()}$", "$options": "i"}},
            {"_id": 0, "id": 1},
        )
        if dup:
            raise HTTPException(status_code=409, detail="Service déjà existant.")
        doc = {"id": str(uuid.uuid4()), "name": payload.name.strip(),
               "sort_order": payload.sort_order, "active": payload.active,
               "created_at": _now_iso()}
        await db.canteen_services.insert_one(doc)
        return {"id": doc["id"], "name": doc["name"]}

    @r.put("/staff/cantine/services/{svc_id}")
    async def staff_services_update(svc_id: str, payload: CanteenServiceUpsert,
                                    staff=Depends(get_current_staff)):
        await require_role(staff, CANTINE_ADMIN_ROLES)
        await db.canteen_services.update_one(
            {"id": svc_id},
            {"$set": {"name": payload.name.strip(),
                      "sort_order": payload.sort_order,
                      "active": payload.active,
                      "updated_at": _now_iso()}},
        )
        return {"ok": True}

    # ── Staff: settings ───────────────────────────────────────────────────
    @r.get("/staff/cantine/settings")
    async def staff_settings_get(staff=Depends(get_current_staff)):
        await require_role(staff, CANTINE_STAFF_ROLES)
        return await _get_settings(db)

    @r.put("/staff/cantine/settings")
    async def staff_settings_update(payload: CanteenSettingsUpdate,
                                    staff=Depends(get_current_staff)):
        await require_role(staff, CANTINE_ADMIN_ROLES)
        upd = {k: v for k, v in payload.dict().items() if v is not None}
        if upd:
            upd["updated_at"] = _now_iso()
            await db.canteen_settings.update_one(
                {"_id": "global"}, {"$set": upd}, upsert=True,
            )
        return await _get_settings(db)

    # ── Staff: exports (xlsx + pdf) ──────────────────────────────────────
    @r.get("/staff/cantine/exports/xlsx")
    async def export_xlsx(
        scope: Literal["today", "tomorrow", "date", "all"] = "tomorrow",
        meal_date: Optional[str] = None,
        staff=Depends(get_current_staff),
    ):
        await require_role(staff, CANTINE_STAFF_ROLES)
        flt: dict = {}
        if scope == "today":
            flt["meal_date"] = _today_abidjan().isoformat()
        elif scope == "tomorrow":
            flt["meal_date"] = _tomorrow_iso()
        elif scope == "date" and meal_date:
            flt["meal_date"] = meal_date

        rows = await db.canteen_reservations.find(
            flt, {"_id": 0},
        ).sort([("service", 1), ("last_name", 1)]).to_list(length=5000)

        wb = Workbook()
        ws = wb.active
        ws.title = "Cantine"
        ws.append(["Date repas", "Code", "Nom", "Prénom", "Service",
                   "Fonction", "Type", "Statut", "Inscrit le",
                   "Consommé le", "Exception"])
        for r_ in rows:
            ws.append([
                r_.get("meal_date", ""),
                r_.get("user_code", ""),
                r_.get("last_name", ""),
                r_.get("first_name", ""),
                r_.get("service", ""),
                r_.get("position", ""),
                "Personnel" if r_.get("type") == "personnel" else "Prestataire",
                {"reserved": "Réservé", "consumed": "Consommé",
                 "absent": "Absent"}.get(r_.get("status"), r_.get("status", "")),
                r_.get("reserved_at", "") or "",
                r_.get("consumed_at", "") or "",
                r_.get("exception_reason", "") or "",
            ])
        buf = io.BytesIO()
        wb.save(buf)
        buf.seek(0)
        fname = f"cantine_{flt.get('meal_date', 'all')}.xlsx"
        return StreamingResponse(
            buf,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="{fname}"'},
        )

    @r.get("/staff/cantine/exports/pdf")
    async def export_pdf(
        scope: Literal["today", "tomorrow", "date"] = "tomorrow",
        meal_date: Optional[str] = None,
        staff=Depends(get_current_staff),
    ):
        await require_role(staff, CANTINE_STAFF_ROLES)
        flt: dict = {}
        if scope == "today":
            flt["meal_date"] = _today_abidjan().isoformat()
        elif scope == "tomorrow":
            flt["meal_date"] = _tomorrow_iso()
        elif scope == "date" and meal_date:
            flt["meal_date"] = meal_date

        rows = await db.canteen_reservations.find(
            flt, {"_id": 0},
        ).sort([("service", 1), ("last_name", 1)]).to_list(length=5000)

        buf = io.BytesIO()
        doc = SimpleDocTemplate(buf, pagesize=landscape(A4), title="Cantine BBR",
                                leftMargin=20, rightMargin=20,
                                topMargin=20, bottomMargin=20)
        styles = getSampleStyleSheet()
        elems: list = []
        elems.append(Paragraph(
            f"<b>Boulay Beach Resort — Liste cantine du {flt.get('meal_date', 'N/A')}</b>",
            styles["Title"],
        ))
        elems.append(Spacer(1, 12))
        elems.append(Paragraph(f"Total inscrits : <b>{len(rows)}</b>",
                               styles["Normal"]))
        elems.append(Spacer(1, 8))
        data = [["Code", "Nom", "Prénom", "Service", "Fonction",
                 "Type", "Statut"]]
        for r_ in rows:
            data.append([
                r_.get("user_code", ""),
                r_.get("last_name", ""),
                r_.get("first_name", ""),
                r_.get("service", ""),
                r_.get("position", ""),
                "Personnel" if r_.get("type") == "personnel" else "Prestataire",
                {"reserved": "Réservé", "consumed": "Consommé",
                 "absent": "Absent"}.get(r_.get("status"), r_.get("status", "")),
            ])
        t = Table(data, repeatRows=1, colWidths=[60, 90, 90, 100, 130, 70, 70])
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0c0e12")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#d4b256")),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("ALIGN", (0, 0), (-1, -1), "LEFT"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("BOTTOMPADDING", (0, 0), (-1, 0), 8),
            ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#dcdee2")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1),
             [colors.whitesmoke, colors.white]),
        ]))
        elems.append(t)
        doc.build(elems)
        buf.seek(0)
        fname = f"cantine_{flt.get('meal_date', 'all')}.pdf"
        return StreamingResponse(
            buf,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{fname}"'},
        )

    # ── Prompt 3 — Manual closure / opening + waitlist promotion ─────────
    @r.post("/staff/cantine/manual-close/{date_iso}")
    async def manual_close(date_iso: str, staff=Depends(get_current_staff)):
        """Clôture manuelle d'une journée précise (override la fenêtre auto)."""
        await require_role(staff, CANTINE_ADMIN_ROLES)
        if not date_iso or len(date_iso) != 10:
            raise HTTPException(status_code=400, detail="invalid_date")
        await db.canteen_settings.update_one(
            {"_id": "global"},
            {"$addToSet": {"manual_closures": date_iso},
             "$pull":    {"manual_openings": date_iso},
             "$set":     {"updated_at": _now_iso()}},
            upsert=True,
        )
        return {"ok": True, "date": date_iso, "action": "closed"}

    @r.post("/staff/cantine/manual-reopen/{date_iso}")
    async def manual_reopen(date_iso: str, staff=Depends(get_current_staff)):
        """Réouverture exceptionnelle d'une journée (lève la fermeture manuelle)."""
        await require_role(staff, CANTINE_ADMIN_ROLES)
        if not date_iso or len(date_iso) != 10:
            raise HTTPException(status_code=400, detail="invalid_date")
        await db.canteen_settings.update_one(
            {"_id": "global"},
            {"$pull":    {"manual_closures": date_iso},
             "$addToSet": {"manual_openings": date_iso},
             "$set":     {"updated_at": _now_iso()}},
            upsert=True,
        )
        return {"ok": True, "date": date_iso, "action": "reopened"}

    @r.get("/staff/cantine/waitlist/{date_iso}")
    async def list_waitlist(date_iso: str, staff=Depends(get_current_staff)):
        """Liste des inscrits en liste d'attente pour une date donnée."""
        await require_role(staff, CANTINE_STAFF_ROLES)
        items = []
        cursor = db.canteen_reservations.find(
            {"meal_date": date_iso, "status": "waitlisted"},
        ).sort("waitlist_position", 1)
        async for d in cursor:
            d.pop("_id", None)
            items.append(d)
        return {"items": items, "date": date_iso, "count": len(items)}

    @r.post("/staff/cantine/waitlist/{reservation_id}/promote")
    async def promote_from_waitlist(reservation_id: str, staff=Depends(get_current_staff)):
        """Fait passer une réservation en liste d'attente au statut 'reserved'.
        Décrémente le crédit de l'utilisateur correspondant."""
        await require_role(staff, CANTINE_ADMIN_ROLES)
        res = await db.canteen_reservations.find_one({"id": reservation_id})
        if not res:
            raise HTTPException(status_code=404, detail="reservation_not_found")
        if res.get("status") != "waitlisted":
            raise HTTPException(status_code=400, detail="not_waitlisted")
        await db.canteen_reservations.update_one(
            {"id": reservation_id},
            {"$set": {"status": "reserved", "promoted_at": _now_iso()},
             "$unset": {"waitlist_position": ""}},
        )
        await db.canteen_users.update_one(
            {"id": res["user_id"]},
            {"$inc": {"credits_consumed": 1},
             "$set": {"updated_at": _now_iso()}},
        )
        return {"ok": True, "reservation_id": reservation_id, "new_status": "reserved"}

    return r


# ────────────────────────────────────────────────────────────────────────────
# Scheduler jobs (called from server.py on_startup)
# ────────────────────────────────────────────────────────────────────────────
async def _job_monthly_renew(db) -> dict:
    """Auto-renew monthly credits on the 1st of every month.

    Logic:
      - If settings.auto_renew_enabled is False → skip.
      - For each active user, reset credits_consumed to 0 and ensure
        credits_attributed is at least the configured default for their type.
      - Stamp the current_period (YYYY-MM) on the settings doc so we never
        double-renew within the same month, even if the scheduler fires twice.
    """
    settings = await _get_settings(db)
    if not settings.get("auto_renew_enabled", True):
        return {"skipped": True, "reason": "disabled"}

    current = _today_abidjan().strftime("%Y-%m")
    if settings.get("current_period") == current:
        return {"skipped": True, "reason": "already-renewed-this-month",
                "period": current}

    p = int(settings.get("default_credits_personnel", 22))
    pr = int(settings.get("default_credits_prestataire", 0))

    n_personnel = await db.canteen_users.update_many(
        {"active": True, "type": "personnel"},
        {"$set": {"credits_attributed": p, "credits_consumed": 0,
                  "credits_period": current, "updated_at": _now_iso()}},
    )
    n_prestataire = await db.canteen_users.update_many(
        {"active": True, "type": "prestataire"},
        {"$set": {"credits_attributed": pr, "credits_consumed": 0,
                  "credits_period": current, "updated_at": _now_iso()}},
    )
    await db.canteen_settings.update_one(
        {"_id": "global"},
        {"$set": {"current_period": current, "updated_at": _now_iso()}},
    )
    return {
        "ok": True, "period": current,
        "personnel_updated": n_personnel.modified_count,
        "prestataire_updated": n_prestataire.modified_count,
    }


async def _job_close_yesterday(db) -> dict:
    """At midnight, flag yesterday's still-"reserved" entries as "absent"."""
    yday = (_today_abidjan() - timedelta(days=1)).isoformat()
    res = await db.canteen_reservations.update_many(
        {"meal_date": yday, "status": "reserved"},
        {"$set": {"status": "absent", "closed_at": _now_iso()}},
    )
    return {"date": yday, "marked_absent": res.modified_count}
