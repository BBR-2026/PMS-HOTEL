"""Beach Club VIP Spaces — numbered transats & balinés.

Customers booking a Beach Club offer (`pass_day`, `sunset`, `brunch`) can
optionally reserve a specific numbered sun-lounger (transat) or a private
baliné for the day, on top of the regular adult/child tickets. Each VIP
space is UNIQUE — once it appears in a non-cancelled booking for a given
date, it can no longer be picked by anyone else on that day.

This router exposes:
  - Public:  GET  /api/vip-spaces/available?date=...&offer_type=...
  - Staff:   GET  /api/staff/vip-spaces
             POST /api/staff/vip-spaces
             PATCH /api/staff/vip-spaces/{id}
             DELETE /api/staff/vip-spaces/{id}

The validation + total-charge logic at booking time lives in `server.py`
inside `create_booking()` (see helper `validate_and_resolve_vip_spaces`).
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

# Offers that can carry VIP spaces (Beach Club only).
BEACH_CLUB_OFFERS = {"pass_day", "sunset", "brunch"}

# Seed data — 12 numbered transats + 4 balinés. Idempotent.
DEFAULT_VIP_SPACES: List[dict] = (
    [
        {
            "id": f"vip_transat_{i:02d}",
            "kind": "transat",
            "number": f"T{i:02d}",
            "label_fr": f"Transat n°T{i:02d}",
            "label_en": f"Sun lounger T{i:02d}",
            "description_fr": "Transat premium en bord de plage, serviette incluse.",
            "description_en": "Premium beachfront sun lounger, towel included.",
            "price": 10000,
            "active": True,
            "sort_order": i,
        }
        for i in range(1, 13)
    ]
    + [
        {
            "id": f"vip_baline_{i:02d}",
            "kind": "baline",
            "number": f"B{i:02d}",
            "label_fr": f"Baliné n°B{i:02d}",
            "label_en": f"Balinese day-bed B{i:02d}",
            "description_fr": "Baliné privatif (2 pers.) avec service dédié et serviettes.",
            "description_en": "Private Balinese day-bed (2 pers.) with dedicated service.",
            "price": 50000,
            "active": True,
            "sort_order": 100 + i,
        }
        for i in range(1, 5)
    ]
)


async def seed_default_vip_spaces(db) -> None:
    """Insert default VIP spaces if none exist. Idempotent — safe to call at startup."""
    if await db.vip_spaces.count_documents({}) == 0:
        await db.vip_spaces.insert_many([{**s} for s in DEFAULT_VIP_SPACES])
        logger.info("Seeded %d default VIP spaces", len(DEFAULT_VIP_SPACES))


async def _taken_space_ids_for_date(db, date_iso: str) -> set:
    """Return the set of vip_space_ids already booked for a given date."""
    taken: set = set()
    cursor = db.bookings.find(
        {
            "date": date_iso,
            "status": {"$ne": "cancelled"},
            "vip_space_ids": {"$exists": True, "$ne": None, "$not": {"$size": 0}},
        },
        {"_id": 0, "vip_space_ids": 1},
    )
    async for b in cursor:
        for sid in (b.get("vip_space_ids") or []):
            taken.add(sid)
    return taken


async def validate_and_resolve_vip_spaces(
    db, *, offer_type: str, date_iso: str, vip_space_ids: List[str]
) -> tuple[List[dict], int]:
    """Validate that every requested vip_space is bookable for this offer+date.

    Returns (resolved_docs, total_amount). Raises HTTPException on conflict.
    """
    ids = [s for s in (vip_space_ids or []) if s]
    if not ids:
        return [], 0
    if offer_type not in BEACH_CLUB_OFFERS:
        raise HTTPException(
            status_code=400,
            detail="Les espaces VIP ne sont disponibles que pour le Beach Club.",
        )
    # De-dup while preserving order
    seen = set()
    unique_ids: List[str] = []
    for sid in ids:
        if sid not in seen:
            seen.add(sid)
            unique_ids.append(sid)
    docs = await db.vip_spaces.find(
        {"id": {"$in": unique_ids}}, {"_id": 0}
    ).to_list(length=len(unique_ids))
    by_id = {d["id"]: d for d in docs}
    missing = [sid for sid in unique_ids if sid not in by_id]
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"Espace(s) VIP introuvable(s) : {', '.join(missing)}",
        )
    inactive = [d for d in docs if not d.get("active", True)]
    if inactive:
        names = ", ".join(d.get("number") or d["id"] for d in inactive)
        raise HTTPException(
            status_code=400,
            detail=f"Espace(s) VIP indisponible(s) : {names}",
        )
    taken = await _taken_space_ids_for_date(db, date_iso)
    conflicts = [d for d in docs if d["id"] in taken]
    if conflicts:
        names = ", ".join(d.get("number") or d["id"] for d in conflicts)
        raise HTTPException(
            status_code=409,
            detail=f"Espace(s) déjà réservé(s) pour cette date : {names}",
        )
    total = sum(int(d.get("price", 0)) for d in docs)
    # Resolved minimal docs (for embedding in the booking)
    resolved = [
        {
            "id": d["id"],
            "kind": d.get("kind"),
            "number": d.get("number"),
            "label": d.get("label_fr"),
            "price": int(d.get("price", 0)),
        }
        for d in docs
    ]
    return resolved, total


class VipSpaceCreate(BaseModel):
    kind: Literal["transat", "baline"]
    number: str = Field(min_length=1, max_length=10)
    label_fr: str = Field(min_length=1, max_length=120)
    label_en: Optional[str] = Field(default=None, max_length=120)
    description_fr: Optional[str] = Field(default="", max_length=600)
    description_en: Optional[str] = Field(default="", max_length=600)
    price: int = Field(ge=0, le=10_000_000)
    active: bool = True
    sort_order: int = 0


class VipSpaceUpdate(BaseModel):
    kind: Optional[Literal["transat", "baline"]] = None
    number: Optional[str] = Field(default=None, max_length=10)
    label_fr: Optional[str] = Field(default=None, max_length=120)
    label_en: Optional[str] = Field(default=None, max_length=120)
    description_fr: Optional[str] = Field(default=None, max_length=600)
    description_en: Optional[str] = Field(default=None, max_length=600)
    price: Optional[int] = Field(default=None, ge=0, le=10_000_000)
    active: Optional[bool] = None
    sort_order: Optional[int] = None


def build_vip_spaces_router(*, db, require_role, get_current_staff) -> APIRouter:
    router = APIRouter()

    @router.get("/vip-spaces/available")
    async def list_available_vip_spaces(
        date: str = Query(..., min_length=8, max_length=10),
        offer_type: str = Query(..., min_length=2, max_length=40),
    ):
        """Public — list active VIP spaces with their availability flag for a given date.

        The frontend uses `is_available=false` to greyed-out / disable selection on
        spaces already booked. Returns an empty list for non-beach-club offers.
        """
        if offer_type not in BEACH_CLUB_OFFERS:
            return {"items": []}
        await seed_default_vip_spaces(db)
        spaces = await db.vip_spaces.find(
            {"active": True}, {"_id": 0}
        ).sort([("sort_order", 1), ("number", 1)]).to_list(length=200)
        taken = await _taken_space_ids_for_date(db, date)
        items = []
        for s in spaces:
            items.append({**s, "is_available": s["id"] not in taken})
        return {"items": items}

    @router.get("/staff/vip-spaces")
    async def staff_list_vip_spaces(staff=Depends(get_current_staff)):
        await require_role(staff, ["admin", "manager", "manager_pole", "management_general"])
        await seed_default_vip_spaces(db)
        items = await db.vip_spaces.find({}, {"_id": 0}).sort(
            [("sort_order", 1), ("number", 1)]
        ).to_list(length=500)
        return {"items": items}

    @router.post("/staff/vip-spaces")
    async def staff_create_vip_space(body: VipSpaceCreate, staff=Depends(get_current_staff)):
        await require_role(staff, ["admin", "manager"])
        # Enforce unique number across active set (helps users avoid mistakes)
        existing = await db.vip_spaces.find_one(
            {"number": body.number.strip()}, {"_id": 0, "id": 1}
        )
        if existing:
            raise HTTPException(status_code=400, detail=f"Numéro {body.number} déjà utilisé")
        doc = body.model_dump()
        doc["id"] = f"vip_{body.kind}_{uuid.uuid4().hex[:8]}"
        doc["number"] = body.number.strip()
        doc["label_fr"] = body.label_fr.strip()
        doc["label_en"] = (body.label_en or body.label_fr).strip()
        doc["created_at"] = datetime.now(timezone.utc).isoformat()
        await db.vip_spaces.insert_one({**doc})
        doc.pop("_id", None)
        return doc

    @router.patch("/staff/vip-spaces/{space_id}")
    async def staff_update_vip_space(
        space_id: str, body: VipSpaceUpdate, staff=Depends(get_current_staff)
    ):
        await require_role(staff, ["admin", "manager"])
        update = {k: v for k, v in body.model_dump(exclude_none=True).items()}
        if not update:
            raise HTTPException(status_code=400, detail="Aucun champ à mettre à jour")
        if "number" in update and update["number"]:
            update["number"] = update["number"].strip()
            clash = await db.vip_spaces.find_one(
                {"number": update["number"], "id": {"$ne": space_id}}, {"_id": 0, "id": 1}
            )
            if clash:
                raise HTTPException(status_code=400, detail=f"Numéro {update['number']} déjà utilisé")
        update["updated_at"] = datetime.now(timezone.utc).isoformat()
        res = await db.vip_spaces.update_one({"id": space_id}, {"$set": update})
        if res.matched_count == 0:
            raise HTTPException(status_code=404, detail="Espace VIP introuvable")
        return {"ok": True}

    @router.delete("/staff/vip-spaces/{space_id}")
    async def staff_delete_vip_space(space_id: str, staff=Depends(get_current_staff)):
        await require_role(staff, ["admin"])
        res = await db.vip_spaces.delete_one({"id": space_id})
        if res.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Espace VIP introuvable")
        return {"ok": True}

    return router
