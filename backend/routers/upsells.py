"""Upsell & Cross-sell catalog — Revenue Engine Phase B.

Define a catalog of add-ons that any customer can attach to an existing
booking (transat numéroté VIP, bouteille de Champagne, soin spa, table
Le Kaai, charter privé extra, etc.). Each upsell has a category, price,
limited stock, and visibility flags.

Persisted in collection ``upsell_offers``. Booking-level selections are
stored in ``upsell_selections`` (visible from the customer Extras page +
back-office reports).

A seed runs on first call so the team has 6 starter offers to demo.

Public endpoints
----------------
* ``GET  /api/upsells/catalog``       — active offers grouped by category
* ``GET  /api/upsells/bookings/{ref}``  — current selections for a booking
* ``POST /api/upsells/bookings/{ref}``  — add a selection

Staff endpoints (manager+)
---------------------------
* ``GET    /api/staff/upsells``           — list (filters)
* ``POST   /api/staff/upsells``           — create
* ``PATCH  /api/staff/upsells/{id}``      — update (price / stock / active)
* ``DELETE /api/staff/upsells/{id}``      — remove
* ``GET    /api/staff/upsells/stats``     — KPIs for revenue dashboard
"""
from __future__ import annotations

import logging
import re
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field

log = logging.getLogger(__name__)

CATEGORIES = ["beach_club", "wellness", "gastronomy", "experience", "transport"]


SEED_OFFERS = [
    {
        "id": "transat_vip",
        "name": "Transat numéroté VIP",
        "category": "beach_club",
        "description": "Transat premium réservé, vue mer, service dédié.",
        "price_xof": 25_000,
        "image_url": "https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=800&q=80",
        "stock_per_day": 20,
        "max_per_booking": 4,
        "active": True,
    },
    {
        "id": "baline_couple",
        "name": "Baliné couple",
        "category": "beach_club",
        "description": "Lit baliné privatif pour 2, baldaquin et service.",
        "price_xof": 80_000,
        "image_url": "https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=800&q=80",
        "stock_per_day": 8,
        "max_per_booking": 2,
        "active": True,
    },
    {
        "id": "champagne_signature",
        "name": "Bouteille Champagne signature",
        "category": "gastronomy",
        "description": "Sélection de notre chef sommelier, servie à votre transat.",
        "price_xof": 95_000,
        "image_url": "https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=800&q=80",
        "stock_per_day": 30,
        "max_per_booking": 5,
        "active": True,
    },
    {
        "id": "kaai_table",
        "name": "Table Le Kaai — Menu dégustation",
        "category": "gastronomy",
        "description": "Réservez votre table pour le dîner signature 7 services.",
        "price_xof": 65_000,
        "image_url": "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=800&q=80",
        "stock_per_day": 12,
        "max_per_booking": 8,
        "active": True,
    },
    {
        "id": "spa_signature",
        "name": "Soin signature BBR (60 min)",
        "category": "wellness",
        "description": "Massage relaxant aux huiles essentielles, vue mer.",
        "price_xof": 45_000,
        "image_url": "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=800&q=80",
        "stock_per_day": 10,
        "max_per_booking": 4,
        "active": True,
    },
    {
        "id": "charter_private",
        "name": "Charter privé aller-retour",
        "category": "transport",
        "description": "Bateau privatisé pour votre groupe, départ Yacht Club.",
        "price_xof": 180_000,
        "image_url": "https://images.unsplash.com/photo-1502489597346-dfb22e371d3a?auto=format&fit=crop&w=800&q=80",
        "stock_per_day": 4,
        "max_per_booking": 1,
        "active": True,
    },
]


class UpsellIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    category: str = Field(min_length=2, max_length=40)
    description: str | None = Field(default=None, max_length=600)
    price_xof: int = Field(ge=0, le=10_000_000)
    image_url: str | None = Field(default=None, max_length=600)
    stock_per_day: int | None = Field(default=None, ge=0, le=10_000)
    max_per_booking: int = Field(default=10, ge=1, le=100)
    active: bool = True


class SelectionIn(BaseModel):
    upsell_id: str
    quantity: int = Field(default=1, ge=1, le=50)
    requested_date: str | None = Field(default=None, max_length=20)
    notes: str | None = Field(default=None, max_length=500)


def build_router(*, db, get_current_staff, require_role) -> APIRouter:
    router = APIRouter(tags=["upsells"])

    async def _ensure_seeded():
        if await db["upsell_offers"].count_documents({}) > 0:
            return
        now = datetime.now(timezone.utc).isoformat()
        for o in SEED_OFFERS:
            await db["upsell_offers"].insert_one({**o, "_id": o["id"], "created_at": now})

    # ── Public ────────────────────────────────────────────────────────
    @router.get("/api/upsells/catalog")
    async def catalog(category: str | None = Query(default=None)):
        await _ensure_seeded()
        filt: dict[str, Any] = {"active": True}
        if category:
            filt["category"] = category
        items = []
        async for d in db["upsell_offers"].find(filt).sort("price_xof", 1):
            d["id"] = d.pop("_id")
            items.append(d)
        # Group by category
        by_cat: dict[str, list] = {}
        for i in items:
            by_cat.setdefault(i["category"], []).append(i)
        return {"items": items, "by_category": by_cat}

    @router.get("/api/upsells/bookings/{ref}")
    async def get_selections(ref: str):
        sels = []
        async for s in db["upsell_selections"].find({"booking_ref": ref}, {"_id": 0}).sort("created_at", -1):
            sels.append(s)
        total = sum(s.get("price_xof", 0) * s.get("quantity", 1) for s in sels)
        return {"items": sels, "total_xof": total, "count": len(sels)}

    @router.post("/api/upsells/bookings/{ref}")
    async def add_selection(ref: str, payload: SelectionIn, request: Request):
        await _ensure_seeded()
        offer = await db["upsell_offers"].find_one({"_id": payload.upsell_id, "active": True})
        if not offer:
            raise HTTPException(status_code=404, detail="offer_not_found")
        if payload.quantity > (offer.get("max_per_booking") or 100):
            raise HTTPException(status_code=400, detail="quantity_exceeds_max")
        # Anti-fraud check: at least confirm the booking ref exists. Not strict
        # — booking ref may be in payments/receipts collections too.
        b = await db["bookings"].find_one({"id": ref}) \
            or await db["bookings"].find_one({"reference_token": ref})
        if not b:
            raise HTTPException(status_code=404, detail="booking_not_found")
        now = datetime.now(timezone.utc).isoformat()
        doc = {
            "_id": str(uuid4()),
            "booking_ref": ref,
            "customer_email": b.get("email"),
            "upsell_id": payload.upsell_id,
            "upsell_name": offer["name"],
            "category": offer["category"],
            "price_xof": offer["price_xof"],
            "quantity": payload.quantity,
            "amount_xof": offer["price_xof"] * payload.quantity,
            "requested_date": payload.requested_date or b.get("date"),
            "notes": payload.notes,
            "status": "requested",  # requested → confirmed → fulfilled | cancelled
            "created_at": now,
            "ip": request.client.host,
        }
        await db["upsell_selections"].insert_one(doc)
        # Tracking
        try:
            await db["marketing_events"].insert_one({
                "_id": str(uuid4()),
                "visitor_id": b.get("visitor_id") or "anon",
                "event_type": "upsell_added",
                "props": {"upsell_id": payload.upsell_id,
                          "category": offer["category"],
                          "amount_xof": doc["amount_xof"]},
                "occurred_at": now,
                "received_at": now,
            })
        except Exception as exc:  # noqa: BLE001
            log.warning("marketing mirror failed (upsell): %s", exc)
        doc["id"] = doc.pop("_id")
        return {"ok": True, "selection": doc}

    # ── Staff ─────────────────────────────────────────────────────────
    @router.get("/api/staff/upsells")
    async def list_upsells(
        category: str | None = Query(default=None),
        active: bool | None = Query(default=None),
        user=Depends(get_current_staff),
    ):
        await require_role(user, ["admin", "manager", "manager_pole", "management_general"])
        await _ensure_seeded()
        filt: dict[str, Any] = {}
        if category:
            filt["category"] = category
        if active is not None:
            filt["active"] = active
        items = []
        async for d in db["upsell_offers"].find(filt).sort("created_at", -1):
            d["id"] = d.pop("_id")
            items.append(d)
        return {"items": items, "count": len(items)}

    @router.post("/api/staff/upsells")
    async def create_upsell(payload: UpsellIn, user=Depends(get_current_staff)):
        await require_role(user, ["admin", "manager"])
        if payload.category not in CATEGORIES:
            raise HTTPException(status_code=400, detail="invalid_category")
        doc = {
            "_id": str(uuid4()),
            **payload.model_dump(),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "created_by": user.get("email"),
        }
        await db["upsell_offers"].insert_one(doc)
        doc["id"] = doc.pop("_id")
        return {"ok": True, "upsell": doc}

    @router.patch("/api/staff/upsells/{u_id}")
    async def update_upsell(u_id: str, body: dict, user=Depends(get_current_staff)):
        await require_role(user, ["admin", "manager"])
        allowed = {"name", "category", "description", "price_xof", "image_url",
                   "stock_per_day", "max_per_booking", "active"}
        updates = {k: v for k, v in body.items() if k in allowed}
        if "category" in updates and updates["category"] not in CATEGORIES:
            raise HTTPException(status_code=400, detail="invalid_category")
        if not updates:
            raise HTTPException(status_code=400, detail="nothing_to_update")
        updates["updated_at"] = datetime.now(timezone.utc).isoformat()
        r = await db["upsell_offers"].update_one({"_id": u_id}, {"$set": updates})
        if r.matched_count == 0:
            raise HTTPException(status_code=404, detail="not_found")
        return {"ok": True}

    @router.delete("/api/staff/upsells/{u_id}")
    async def delete_upsell(u_id: str, user=Depends(get_current_staff)):
        await require_role(user, ["admin"])
        r = await db["upsell_offers"].delete_one({"_id": u_id})
        if r.deleted_count == 0:
            raise HTTPException(status_code=404, detail="not_found")
        return {"ok": True}

    @router.get("/api/staff/upsells/stats")
    async def upsell_stats(user=Depends(get_current_staff)):
        await require_role(user, ["admin", "manager", "manager_pole", "management_general"])
        total_sel = await db["upsell_selections"].count_documents({})
        revenue = 0
        cursor = db["upsell_selections"].aggregate([
            {"$match": {"status": {"$in": ["requested", "confirmed", "fulfilled"]}}},
            {"$group": {"_id": None, "total": {"$sum": "$amount_xof"}}},
        ])
        async for r in cursor:
            revenue = r["total"]
        by_cat_cursor = db["upsell_selections"].aggregate([
            {"$group": {"_id": "$category", "count": {"$sum": 1},
                        "revenue": {"$sum": "$amount_xof"}}},
        ])
        by_cat = []
        async for r in by_cat_cursor:
            by_cat.append({"category": r["_id"], "count": r["count"], "revenue": r["revenue"]})
        top_cursor = db["upsell_selections"].aggregate([
            {"$group": {"_id": {"id": "$upsell_id", "name": "$upsell_name"},
                        "count": {"$sum": "$quantity"},
                        "revenue": {"$sum": "$amount_xof"}}},
            {"$sort": {"revenue": -1}},
            {"$limit": 10},
        ])
        top = []
        async for r in top_cursor:
            top.append({"upsell_id": r["_id"]["id"], "name": r["_id"]["name"],
                        "count": r["count"], "revenue": r["revenue"]})
        return {
            "total_selections": total_sel,
            "revenue_xof": revenue,
            "by_category": by_cat,
            "top_offers": top,
        }

    return router
