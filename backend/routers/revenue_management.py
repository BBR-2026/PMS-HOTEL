"""Revenue Management — rate plans, dynamic pricing & promotions.

Each Rate Plan applies a price adjustment to a specific offer when the
booking matches its conditions (seasonal date window, weekend, special
event date, or a promo code typed by the customer).

Storage : `rate_plans` collection.
Resolution helper : ``resolve_offer_price(offer_key, base_price, when, promo)``
returns the adjusted price after applying the first matching rate plan
(priority order: promo > event > seasonal > weekend).

Endpoints
---------
* GET    /api/staff/revenue/rate-plans
* POST   /api/staff/revenue/rate-plans
* PATCH  /api/staff/revenue/rate-plans/{id}
* DELETE /api/staff/revenue/rate-plans/{id}
* GET    /api/revenue/quote   — public quote endpoint for the booking tunnel.
"""
from __future__ import annotations

import logging
from datetime import date, datetime, timezone
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel, Field

log = logging.getLogger(__name__)


PLAN_TYPES = ["seasonal", "weekend", "event", "promo"]
# Priority order — higher wins when multiple plans match.
TYPE_PRIORITY = {"promo": 4, "event": 3, "seasonal": 2, "weekend": 1}

ADJ_KINDS = ["percent", "absolute"]


class RatePlanIn(BaseModel):
    offer_key: str = Field(min_length=1, max_length=200)  # e.g. "beach_club.pass_day"
    name: str = Field(min_length=1, max_length=200)
    type: str  # seasonal | weekend | event | promo
    adjustment_kind: str = "percent"     # percent | absolute
    adjustment_value: float = 0.0        # negative = discount, positive = surcharge
    # Conditions (all optional, evaluated by type)
    start_date: str | None = None         # YYYY-MM-DD
    end_date: str | None = None
    days_of_week: list[int] | None = None  # 0=Mon ... 6=Sun
    promo_code: str | None = Field(default=None, max_length=80)
    auto_apply: bool = True              # for promo: auto-apply if URL ?promo=
    active: bool = True
    notes: str | None = Field(default=None, max_length=1000)


def _doc_to_public(d: dict) -> dict:
    d["id"] = d.pop("_id")
    return d


def _matches(plan: dict, when_iso: str, promo: str | None) -> bool:
    """Return True if the plan applies for the given check-in date / promo code."""
    if not plan.get("active"):
        return False
    t = plan.get("type")
    try:
        d = datetime.fromisoformat(when_iso).date() if "T" in when_iso else date.fromisoformat(when_iso)
    except Exception:
        return False
    if t == "promo":
        if not promo:
            return False
        return (plan.get("promo_code") or "").upper() == promo.upper()
    # All non-promo types check date window.
    sd = plan.get("start_date")
    ed = plan.get("end_date")
    if sd and d < date.fromisoformat(sd):
        return False
    if ed and d > date.fromisoformat(ed):
        return False
    if t == "weekend":
        # 5=Sat, 6=Sun by default if no days_of_week.
        dows = plan.get("days_of_week") or [5, 6]
        return d.weekday() in dows
    if t == "event":
        # Event = strict date window (already checked above).
        return True
    if t == "seasonal":
        # Seasonal = date window only; days_of_week optional.
        dows = plan.get("days_of_week")
        if dows and d.weekday() not in dows:
            return False
        return True
    return False


def _apply(adj_kind: str, adj_value: float, base: float) -> float:
    if adj_kind == "absolute":
        return max(0.0, base + adj_value)
    # percent: -10 means -10% discount
    return max(0.0, base * (1 + adj_value / 100.0))


def build_router(*, db, get_current_staff, require_role) -> APIRouter:
    router = APIRouter(tags=["revenue-management"])

    async def _resolve(offer_key: str, base_price: float, when_iso: str, promo: str | None):
        """Return (final_price, applied_plan_or_None)."""
        cursor = db["rate_plans"].find({"offer_key": offer_key, "active": True})
        plans = []
        async for p in cursor:
            if _matches(p, when_iso, promo):
                plans.append(p)
        if not plans:
            return base_price, None
        plans.sort(key=lambda p: TYPE_PRIORITY.get(p.get("type"), 0), reverse=True)
        chosen = plans[0]
        adjusted = _apply(chosen.get("adjustment_kind", "percent"), float(chosen.get("adjustment_value", 0)), base_price)
        return adjusted, chosen

    # Expose internal helper for booking engine consumption
    router.resolve_offer_price = _resolve  # type: ignore[attr-defined]

    # ── Staff CRUD ─────────────────────────────────────────────────
    @router.get("/api/staff/revenue/rate-plans")
    async def list_plans(
        offer_key: str | None = Query(default=None),
        type: str | None = Query(default=None),
        user=Depends(get_current_staff),
    ):
        await require_role(user, ["admin", "manager", "manager_pole", "management_general"])
        filt: dict[str, Any] = {}
        if offer_key:
            filt["offer_key"] = offer_key
        if type:
            filt["type"] = type
        items = []
        async for d in db["rate_plans"].find(filt).sort("created_at", -1):
            items.append(_doc_to_public(d))
        return {"items": items, "plan_types": PLAN_TYPES, "adjustment_kinds": ADJ_KINDS}

    @router.post("/api/staff/revenue/rate-plans")
    async def create_plan(payload: RatePlanIn, user=Depends(get_current_staff)):
        await require_role(user, ["admin", "manager", "manager_pole"])
        if payload.type not in PLAN_TYPES:
            raise HTTPException(status_code=400, detail="invalid_type")
        if payload.adjustment_kind not in ADJ_KINDS:
            raise HTTPException(status_code=400, detail="invalid_adjustment_kind")
        if payload.type == "promo" and not (payload.promo_code or "").strip():
            raise HTTPException(status_code=400, detail="promo_code_required")
        now = datetime.now(timezone.utc).isoformat()
        doc = {
            "_id": str(uuid4()),
            **payload.model_dump(),
            "created_at": now,
            "updated_at": now,
            "created_by": user.get("email"),
        }
        if doc.get("promo_code"):
            doc["promo_code"] = doc["promo_code"].strip().upper()
        await db["rate_plans"].insert_one(doc)
        return _doc_to_public(doc)

    @router.patch("/api/staff/revenue/rate-plans/{plan_id}")
    async def update_plan(plan_id: str, body: dict = Body(...), user=Depends(get_current_staff)):
        await require_role(user, ["admin", "manager", "manager_pole"])
        allowed = {"name", "offer_key", "type", "adjustment_kind", "adjustment_value",
                   "start_date", "end_date", "days_of_week", "promo_code",
                   "auto_apply", "active", "notes"}
        updates = {k: v for k, v in body.items() if k in allowed}
        if "type" in updates and updates["type"] not in PLAN_TYPES:
            raise HTTPException(status_code=400, detail="invalid_type")
        if "adjustment_kind" in updates and updates["adjustment_kind"] not in ADJ_KINDS:
            raise HTTPException(status_code=400, detail="invalid_adjustment_kind")
        if "promo_code" in updates and updates["promo_code"]:
            updates["promo_code"] = updates["promo_code"].strip().upper()
        if not updates:
            raise HTTPException(status_code=400, detail="nothing_to_update")
        updates["updated_at"] = datetime.now(timezone.utc).isoformat()
        updates["updated_by"] = user.get("email")
        r = await db["rate_plans"].update_one({"_id": plan_id}, {"$set": updates})
        if r.matched_count == 0:
            raise HTTPException(status_code=404, detail="not_found")
        return {"ok": True}

    @router.delete("/api/staff/revenue/rate-plans/{plan_id}")
    async def delete_plan(plan_id: str, user=Depends(get_current_staff)):
        await require_role(user, ["admin", "manager"])
        r = await db["rate_plans"].delete_one({"_id": plan_id})
        if r.deleted_count == 0:
            raise HTTPException(status_code=404, detail="not_found")
        return {"ok": True}

    # ── Public quote endpoint (used by booking tunnel & previews) ──
    @router.get("/api/revenue/quote")
    async def public_quote(
        offer_key: str = Query(...),
        base_price: float = Query(..., ge=0),
        when: str = Query(..., description="ISO date YYYY-MM-DD"),
        promo: str | None = Query(default=None),
    ):
        adjusted, plan = await _resolve(offer_key, base_price, when, promo)
        return {
            "offer_key": offer_key,
            "when": when,
            "base_price": base_price,
            "final_price": round(adjusted, 2),
            "discount": round(base_price - adjusted, 2),
            "applied_plan": {
                "id": plan["_id"],
                "name": plan.get("name"),
                "type": plan.get("type"),
                "adjustment_kind": plan.get("adjustment_kind"),
                "adjustment_value": plan.get("adjustment_value"),
            } if plan else None,
        }

    return router
