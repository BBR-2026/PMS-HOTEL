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
    "Réception", "Restaurant", "Cuisine", "Housekeeping", "Maintenance",
    "Administration", "Comptabilité", "Informatique", "Sécurité", "Prestataires",
]


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
        }
        await db.canteen_settings.update_one(
            {"_id": "global"}, {"$set": s}, upsert=True,
        )
    return s


async def _ensure_default_services(db) -> None:
    """Seed the default 10 services if the collection is empty."""
    n = await db.canteen_services.count_documents({})
    if n == 0:
        docs = [
            {"id": str(uuid.uuid4()), "name": name, "sort_order": i,
             "active": True, "created_at": _now_iso()}
            for i, name in enumerate(DEFAULT_SERVICES)
        ]
        await db.canteen_services.insert_many(docs)


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

    # ── Public: reserve tomorrow's lunch ──────────────────────────────────
    @r.post("/cantine/public/reservations")
    async def reserve_tomorrow(payload: CanteenReserveRequest):
        if not payload.confirmed:
            raise HTTPException(status_code=400, detail="Veuillez confirmer votre présence.")
        code = payload.code.strip().upper()

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

        meal_date = _tomorrow_iso()
        # Idempotency: refuse a duplicate same-user / same-date reservation
        existing = await db.canteen_reservations.find_one(
            {"user_code": code, "meal_date": meal_date}, {"_id": 0, "id": 1},
        )
        if existing:
            raise HTTPException(
                status_code=409,
                detail=f"Vous êtes déjà inscrit(e) au repas du {meal_date}.",
            )

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
            "status": "reserved",   # reserved | consumed | absent
            "reserved_at": _now_iso(),
            "consumed_at": None,
            "consumed_by_staff_id": None,
            "supervisor_override": False,
            "exception_reason": None,
        }
        await db.canteen_reservations.insert_one(reservation)

        # Consume 1 credit (atomic increment)
        await db.canteen_users.update_one(
            {"id": user["id"]},
            {"$inc": {"credits_consumed": 1},
             "$set": {"updated_at": _now_iso()}},
        )

        new_remaining = remaining - 1
        return {
            "ok": True,
            "meal_date": meal_date,
            "reservation_id": reservation["id"],
            "credits_remaining": new_remaining,
            "guest_name": f"{user['first_name']} {user['last_name']}",
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
