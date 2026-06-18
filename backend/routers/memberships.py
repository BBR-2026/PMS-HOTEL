"""Memberships — Revenue Engine Phase B.

Three tiers (configurable but seeded with luxury defaults) :

  * **Sunset Card**     · 350 000 XOF / an
      - 4 Day-pass adultes inclus, -15% sur Le Kaai, +1 cocktail offert/visite.
  * **Beach Card**      · 750 000 XOF / an
      - 12 Day-pass adultes, -20% sur Le Kaai, accès prioritaire week-ends,
        accès gratuit Brunch & Sunset hors saison haute.
  * **Royal Card**      · 1 800 000 XOF / an
      - Day-pass illimités, -30% sur Le Kaai, 2 nuits offertes hébergement,
        privatisation cabine privée gratuite (1×/an).

Endpoints :
  * ``GET  /api/memberships/plans``                 (public)
  * ``POST /api/memberships/subscribe``             (public — capture lead)
  * ``GET  /api/staff/memberships``                 (staff list + filters)
  * ``GET  /api/staff/memberships/{id}``            (staff detail)
  * ``PATCH/api/staff/memberships/{id}``            (status workflow)
  * ``POST /api/staff/memberships/{id}/issue``      (activate card + card #)
  * ``GET  /api/staff/memberships/stats``           (KPIs for dashboard)
"""
from __future__ import annotations

import logging
import random
import re
import string
from datetime import datetime, timezone, timedelta
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Header
from pydantic import BaseModel, EmailStr, Field

log = logging.getLogger(__name__)

# ---- Plan catalog (seeded into Mongo on first call) -------------------
PLAN_CATALOG: list[dict] = [
    {
        "id": "sunset_card",
        "name": "Sunset Card",
        "tier": "silver",
        "price_xof": 350_000,
        "duration_days": 365,
        "tagline": "L'évasion sur mesure, dès le 1ᵉʳ jour.",
        "benefits": [
            "4 Day-pass adultes inclus",
            "−15 % sur Le Kaai",
            "1 cocktail signature offert par visite",
            "Accès prioritaire aux Sunset & Brunch",
        ],
        "highlight": False,
        "color": "#B8922A",
    },
    {
        "id": "beach_card",
        "name": "Beach Card",
        "tier": "gold",
        "price_xof": 750_000,
        "duration_days": 365,
        "tagline": "L'île à votre rythme, toute l'année.",
        "benefits": [
            "12 Day-pass adultes inclus",
            "−20 % sur Le Kaai",
            "Accès prioritaire week-ends",
            "Brunch & Sunset offerts hors saison haute",
            "Invitations aux soirées privées",
        ],
        "highlight": True,
        "color": "#0A0A0A",
    },
    {
        "id": "royal_card",
        "name": "Royal Card",
        "tier": "platinum",
        "price_xof": 1_800_000,
        "duration_days": 365,
        "tagline": "Le privilège absolu, l'île à vous.",
        "benefits": [
            "Day-pass illimités",
            "−30 % sur Le Kaai",
            "2 nuits Hébergement offertes",
            "1 privatisation cabine privée offerte par an",
            "Accueil dédié & service de conciergerie",
        ],
        "highlight": False,
        "color": "#D4B256",
    },
]


def _card_number() -> str:
    """16-character BBR-style card # — easy to read, unique enough."""
    body = "".join(random.choices(string.digits, k=12))
    return f"BBR-{body[:4]}-{body[4:8]}-{body[8:12]}"


# ---- Payloads ---------------------------------------------------------
class MembershipSubscribeIn(BaseModel):
    plan_id: str = Field(min_length=2, max_length=40)
    full_name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    phone: str | None = Field(default=None, max_length=40)
    company: str | None = Field(default=None, max_length=160)
    message: str | None = Field(default=None, max_length=2000)
    attribution: dict[str, Any] | None = None
    visitor_id: str | None = None


def build_router(*, db, get_current_staff, require_role) -> APIRouter:
    router = APIRouter(tags=["memberships"])

    async def _ensure_plans_seeded():
        existing = await db["membership_plans"].count_documents({})
        if existing == 0:
            now = datetime.now(timezone.utc).isoformat()
            for p in PLAN_CATALOG:
                await db["membership_plans"].insert_one({
                    **p, "_id": p["id"], "created_at": now, "active": True,
                })

    @router.get("/api/memberships/plans")
    async def list_plans():
        await _ensure_plans_seeded()
        plans = []
        async for p in db["membership_plans"].find({"active": True}).sort("price_xof", 1):
            p["id"] = p.pop("_id")
            plans.append(p)
        return {"plans": plans}

    @router.post("/api/memberships/subscribe")
    async def subscribe(
        payload: MembershipSubscribeIn,
        request: Request,
        x_forwarded_for: str | None = Header(default=None, alias="X-Forwarded-For"),
    ):
        await _ensure_plans_seeded()
        plan = await db["membership_plans"].find_one({"_id": payload.plan_id, "active": True})
        if not plan:
            raise HTTPException(status_code=404, detail="plan_not_found")
        ip = (x_forwarded_for or "").split(",")[0].strip() or request.client.host
        now = datetime.now(timezone.utc).isoformat()
        doc = {
            "_id": str(uuid4()),
            "plan_id": payload.plan_id,
            "plan_name": plan["name"],
            "plan_price_xof": plan["price_xof"],
            "full_name": payload.full_name.strip(),
            "email": payload.email.lower(),
            "phone": (payload.phone or "").strip() or None,
            "company": (payload.company or "").strip() or None,
            "message": (payload.message or "").strip() or None,
            "attribution": payload.attribution or None,
            "visitor_id": payload.visitor_id,
            "ip": ip,
            "status": "requested",  # requested → confirmed → active → expired
            "card_number": None,
            "issued_at": None,
            "expires_at": None,
            "created_at": now,
            "updated_at": now,
        }
        await db["memberships"].insert_one(doc)
        # Mirror as a marketing lead event.
        try:
            await db["marketing_events"].insert_one({
                "_id": str(uuid4()),
                "visitor_id": payload.visitor_id or "anon",
                "event_type": "submit_lead",
                "page": "/memberships",
                "attribution": payload.attribution or None,
                "props": {"channel": "membership", "plan_id": payload.plan_id,
                          "amount_xof": plan["price_xof"]},
                "occurred_at": now,
                "received_at": now,
                "ip": ip,
            })
        except Exception as exc:  # noqa: BLE001
            log.warning("marketing mirror failed (membership): %s", exc)
        return {"ok": True, "id": doc["_id"], "status": doc["status"]}

    # ── Staff ─────────────────────────────────────────────────────────
    @router.get("/api/staff/memberships")
    async def list_memberships(
        status: str | None = Query(default=None),
        plan_id: str | None = Query(default=None),
        q: str | None = Query(default=None),
        limit: int = Query(default=200, ge=1, le=1000),
        user=Depends(get_current_staff),
    ):
        await require_role(user, ["admin", "manager", "manager_pole", "management_general"])
        filt: dict[str, Any] = {}
        if status:
            filt["status"] = status
        if plan_id:
            filt["plan_id"] = plan_id
        if q:
            rx = {"$regex": re.escape(q), "$options": "i"}
            filt["$or"] = [{"full_name": rx}, {"email": rx}, {"card_number": rx}, {"company": rx}]
        items = []
        async for d in db["memberships"].find(filt).sort("created_at", -1).limit(limit):
            d["id"] = d.pop("_id")
            items.append(d)
        return {"items": items, "count": len(items)}

    @router.get("/api/staff/memberships/stats")
    async def stats(user=Depends(get_current_staff)):
        await require_role(user, ["admin", "manager", "manager_pole", "management_general"])
        total = await db["memberships"].count_documents({})
        active = await db["memberships"].count_documents({"status": "active"})
        requested = await db["memberships"].count_documents({"status": "requested"})
        confirmed = await db["memberships"].count_documents({"status": "confirmed"})
        revenue_cursor = db["memberships"].aggregate([
            {"$match": {"status": {"$in": ["confirmed", "active"]}}},
            {"$group": {"_id": None, "total": {"$sum": "$plan_price_xof"}}},
        ])
        revenue = 0
        async for r in revenue_cursor:
            revenue = r["total"]
        by_plan_cursor = db["memberships"].aggregate([
            {"$group": {"_id": "$plan_id", "count": {"$sum": 1},
                        "revenue": {"$sum": "$plan_price_xof"}}}
        ])
        by_plan = []
        async for r in by_plan_cursor:
            by_plan.append({"plan_id": r["_id"], "count": r["count"], "revenue": r["revenue"]})
        return {
            "total": total, "active": active, "requested": requested,
            "confirmed": confirmed, "revenue_pipeline_xof": revenue,
            "by_plan": by_plan,
        }

    @router.get("/api/staff/memberships/{m_id}")
    async def membership_detail(m_id: str, user=Depends(get_current_staff)):
        await require_role(user, ["admin", "manager", "manager_pole", "management_general"])
        d = await db["memberships"].find_one({"_id": m_id})
        if not d:
            raise HTTPException(status_code=404, detail="not_found")
        d["id"] = d.pop("_id")
        return d

    @router.patch("/api/staff/memberships/{m_id}")
    async def update_membership(m_id: str, body: dict, user=Depends(get_current_staff)):
        await require_role(user, ["admin", "manager", "manager_pole"])
        allowed = {"status", "internal_notes"}
        updates = {k: v for k, v in body.items() if k in allowed}
        if "status" in updates and updates["status"] not in (
            "requested", "confirmed", "active", "expired", "cancelled"
        ):
            raise HTTPException(status_code=400, detail="invalid_status")
        if not updates:
            raise HTTPException(status_code=400, detail="nothing_to_update")
        updates["updated_at"] = datetime.now(timezone.utc).isoformat()
        updates["updated_by"] = user.get("email")
        r = await db["memberships"].update_one({"_id": m_id}, {"$set": updates})
        if r.matched_count == 0:
            raise HTTPException(status_code=404, detail="not_found")
        return {"ok": True}

    @router.post("/api/staff/memberships/{m_id}/issue")
    async def issue_card(m_id: str, user=Depends(get_current_staff)):
        """Activate the membership: assigns a card number + 365-day validity."""
        await require_role(user, ["admin", "manager", "manager_pole"])
        d = await db["memberships"].find_one({"_id": m_id})
        if not d:
            raise HTTPException(status_code=404, detail="not_found")
        if d.get("card_number"):
            return {"ok": True, "card_number": d["card_number"], "already_issued": True}
        # find unique card #
        for _ in range(10):
            card_no = _card_number()
            exists = await db["memberships"].find_one({"card_number": card_no})
            if not exists:
                break
        else:
            raise HTTPException(status_code=500, detail="unable_to_generate_card_number")
        plan = await db["membership_plans"].find_one({"_id": d["plan_id"]})
        duration = (plan or {}).get("duration_days", 365)
        now = datetime.now(timezone.utc)
        await db["memberships"].update_one(
            {"_id": m_id},
            {"$set": {
                "card_number": card_no,
                "status": "active",
                "issued_at": now.isoformat(),
                "expires_at": (now + timedelta(days=duration)).isoformat(),
                "issued_by": user.get("email"),
                "updated_at": now.isoformat(),
            }},
        )
        return {"ok": True, "card_number": card_no, "expires_at": (now + timedelta(days=duration)).isoformat()}

    return router
