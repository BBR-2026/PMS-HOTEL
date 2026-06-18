"""Marketing analytics dashboard — Phase B of the Revenue Engine.

Builds rich aggregations on top of the ``marketing_events`` collection.
Designed to power the back-office Marketing dashboard (KPIs, time series,
top campaigns, conversion funnel, attribution breakdown).

Mounted under ``/api/staff/marketing``. Requires manager+ access.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, Query

# Funnel definition (display order matters).
FUNNEL_STEPS = [
    ("page_view", "Visites"),
    ("view_offer", "Découverte d'une offre"),
    ("start_booking", "Tunnel ouvert"),
    ("submit_lead", "Lead capturé"),
    ("purchase", "Réservation payée"),
]


def _period_bounds(period: str) -> tuple[str, str]:
    """Return ISO-8601 [start, end[ for the requested rolling window."""
    end = datetime.now(timezone.utc)
    days = {"7d": 7, "30d": 30, "90d": 90, "365d": 365}.get(period, 30)
    start = end - timedelta(days=days)
    return start.isoformat(), end.isoformat()


def build_router(*, db, get_current_staff, require_role) -> APIRouter:
    router = APIRouter(prefix="/api/staff/marketing", tags=["marketing-analytics"])

    @router.get("/dashboard")
    async def dashboard(
        period: str = Query(default="30d", pattern="^(7d|30d|90d|365d)$"),
        user=Depends(get_current_staff),
    ):
        await require_role(user, ["admin", "manager", "manager_pole", "management_general"])
        start_iso, end_iso = _period_bounds(period)
        base = {"occurred_at": {"$gte": start_iso, "$lt": end_iso}}

        # ── KPIs ────────────────────────────────────────────────
        unique_visitors_list = await db["marketing_events"].distinct("visitor_id", base)
        unique_visitors = len(unique_visitors_list)

        # Counts by event_type
        by_evt_cursor = db["marketing_events"].aggregate([
            {"$match": base},
            {"$group": {"_id": "$event_type", "count": {"$sum": 1}}},
        ])
        by_event = {r["_id"]: r["count"] async for r in by_evt_cursor}
        total_events = sum(by_event.values())

        # Leads = submit_lead + start_booking + purchase
        leads = by_event.get("submit_lead", 0)
        purchases = by_event.get("purchase", 0)
        booking_intents = by_event.get("start_booking", 0)
        page_views = by_event.get("page_view", 0)

        # Conversion rate (purchases / unique_visitors)
        conv_rate = round(purchases / unique_visitors * 100, 2) if unique_visitors else 0.0
        lead_rate = round(leads / unique_visitors * 100, 2) if unique_visitors else 0.0

        # ── Daily time series ──────────────────────────────────
        daily_cursor = db["marketing_events"].aggregate([
            {"$match": base},
            {"$group": {
                "_id": {"day": {"$substr": ["$occurred_at", 0, 10]},
                        "evt": "$event_type"},
                "count": {"$sum": 1},
            }},
            {"$sort": {"_id.day": 1}},
        ])
        days: dict[str, dict[str, int]] = {}
        async for r in daily_cursor:
            day = r["_id"]["day"]
            evt = r["_id"]["evt"]
            days.setdefault(day, {})[evt] = r["count"]
        trend = [
            {
                "date": d,
                "page_view": v.get("page_view", 0),
                "view_offer": v.get("view_offer", 0),
                "start_booking": v.get("start_booking", 0),
                "submit_lead": v.get("submit_lead", 0),
                "purchase": v.get("purchase", 0),
            }
            for d, v in sorted(days.items())
        ]

        # ── Top UTM campaigns ──────────────────────────────────
        campaign_cursor = db["marketing_events"].aggregate([
            {"$match": {**base, "attribution.utm_campaign": {"$ne": None, "$exists": True}}},
            {"$group": {
                "_id": {
                    "campaign": "$attribution.utm_campaign",
                    "source": "$attribution.utm_source",
                    "medium": "$attribution.utm_medium",
                },
                "events": {"$sum": 1},
                "visitors": {"$addToSet": "$visitor_id"},
            }},
            {"$project": {
                "campaign": "$_id.campaign",
                "source": "$_id.source",
                "medium": "$_id.medium",
                "events": 1,
                "unique_visitors": {"$size": "$visitors"},
            }},
            {"$sort": {"unique_visitors": -1}},
            {"$limit": 20},
        ])
        campaigns = [
            {"campaign": r["campaign"], "source": r.get("source"),
             "medium": r.get("medium"), "events": r["events"],
             "unique_visitors": r["unique_visitors"]}
            async for r in campaign_cursor
        ]

        # ── Source / medium breakdown ──────────────────────────
        src_cursor = db["marketing_events"].aggregate([
            {"$match": base},
            {"$group": {
                "_id": {"$ifNull": ["$attribution.utm_source", "direct"]},
                "events": {"$sum": 1},
                "visitors": {"$addToSet": "$visitor_id"},
            }},
            {"$project": {
                "source": "$_id",
                "events": 1,
                "unique_visitors": {"$size": "$visitors"},
            }},
            {"$sort": {"unique_visitors": -1}},
            {"$limit": 10},
        ])
        by_source = [
            {"source": r["source"] or "direct", "events": r["events"],
             "unique_visitors": r["unique_visitors"]}
            async for r in src_cursor
        ]

        # ── Top pages (page_view only) ─────────────────────────
        pages_cursor = db["marketing_events"].aggregate([
            {"$match": {**base, "event_type": "page_view"}},
            {"$group": {"_id": "$page", "views": {"$sum": 1},
                        "visitors": {"$addToSet": "$visitor_id"}}},
            {"$project": {"page": "$_id", "views": 1,
                          "unique_visitors": {"$size": "$visitors"}}},
            {"$sort": {"views": -1}},
            {"$limit": 15},
        ])
        top_pages = [
            {"page": r["page"] or "/", "views": r["views"],
             "unique_visitors": r["unique_visitors"]}
            async for r in pages_cursor
        ]

        # ── Conversion funnel ─────────────────────────────────
        funnel: list[dict[str, Any]] = []
        prev_count = None
        for evt, label in FUNNEL_STEPS:
            visitors_for_step = await db["marketing_events"].distinct(
                "visitor_id", {**base, "event_type": evt}
            )
            c = len(visitors_for_step)
            drop_off = None
            if prev_count is not None and prev_count > 0:
                drop_off = round((1 - c / prev_count) * 100, 2)
            funnel.append({
                "event": evt,
                "label": label,
                "unique_visitors": c,
                "drop_off_pct": drop_off,
            })
            prev_count = c if c > 0 else prev_count

        # ── Leads pipeline (contact + newsletter) ────────────
        contact_total = await db["contact_messages"].count_documents(
            {"created_at": {"$gte": start_iso, "$lt": end_iso}}
        )
        contact_new = await db["contact_messages"].count_documents(
            {"created_at": {"$gte": start_iso, "$lt": end_iso}, "status": "new"}
        )
        newsletter_total = await db["newsletter_subscribers"].count_documents(
            {"created_at": {"$gte": start_iso, "$lt": end_iso}}
        )
        newsletter_active = await db["newsletter_subscribers"].count_documents(
            {"created_at": {"$gte": start_iso, "$lt": end_iso}, "status": "active"}
        )

        return {
            "period": period,
            "start": start_iso,
            "end": end_iso,
            "kpis": {
                "unique_visitors": unique_visitors,
                "page_views": page_views,
                "booking_intents": booking_intents,
                "leads": leads,
                "purchases": purchases,
                "conversion_rate_pct": conv_rate,
                "lead_rate_pct": lead_rate,
                "total_events": total_events,
            },
            "by_event": by_event,
            "trend": trend,
            "campaigns": campaigns,
            "by_source": by_source,
            "top_pages": top_pages,
            "funnel": funnel,
            "leads_pipeline": {
                "contact_messages_total": contact_total,
                "contact_messages_new": contact_new,
                "newsletter_total": newsletter_total,
                "newsletter_active": newsletter_active,
            },
        }

    # ── Top offers (most viewed / most converted) ─────────────────
    @router.get("/top-offers")
    async def top_offers(
        period: str = Query(default="30d", pattern="^(7d|30d|90d|365d)$"),
        user=Depends(get_current_staff),
    ):
        await require_role(user, ["admin", "manager", "manager_pole", "management_general"])
        start_iso, end_iso = _period_bounds(period)
        base = {"occurred_at": {"$gte": start_iso, "$lt": end_iso}}

        # Aggregate offers across the funnel.
        # We look for an offer slug/id in props.offer or props.offer_id or page (vitrine paths).
        cursor = db["marketing_events"].aggregate([
            {"$match": {**base, "event_type": {"$in": [
                "view_offer", "start_booking", "purchase",
            ]}}},
            {"$addFields": {
                "offer_key": {
                    "$ifNull": [
                        "$props.offer",
                        {"$ifNull": ["$props.offer_id", "$page"]},
                    ]
                }
            }},
            {"$match": {"offer_key": {"$ne": None}}},
            {"$group": {
                "_id": {"offer": "$offer_key", "evt": "$event_type"},
                "n": {"$sum": 1},
                "visitors": {"$addToSet": "$visitor_id"},
            }},
        ])
        agg: dict[str, dict[str, Any]] = {}
        async for r in cursor:
            offer = r["_id"]["offer"]
            evt = r["_id"]["evt"]
            agg.setdefault(offer, {"offer": offer, "view": 0, "start": 0, "purchase": 0, "visitors": set()})
            if evt == "view_offer":
                agg[offer]["view"] += r["n"]
            elif evt == "start_booking":
                agg[offer]["start"] += r["n"]
            elif evt == "purchase":
                agg[offer]["purchase"] += r["n"]
            agg[offer]["visitors"].update(r["visitors"])

        items = []
        for v in agg.values():
            view = v["view"]
            purchase = v["purchase"]
            start = v["start"]
            unique = len(v["visitors"])
            items.append({
                "offer": v["offer"],
                "views": view,
                "starts": start,
                "purchases": purchase,
                "unique_visitors": unique,
                "view_to_start_pct": round(start / view * 100, 1) if view else 0.0,
                "start_to_purchase_pct": round(purchase / start * 100, 1) if start else 0.0,
                "view_to_purchase_pct": round(purchase / view * 100, 1) if view else 0.0,
            })
        items.sort(key=lambda i: i["views"], reverse=True)
        return {"period": period, "items": items[:30]}

    # ── Abandon insights ─────────────────────────────────────────
    @router.get("/abandons")
    async def abandons(
        period: str = Query(default="30d", pattern="^(7d|30d|90d|365d)$"),
        user=Depends(get_current_staff),
    ):
        """Visitors who started booking but never purchased, with drop-off
        by step. Returns step-level abandon rates plus a per-offer breakdown.
        """
        await require_role(user, ["admin", "manager", "manager_pole", "management_general"])
        start_iso, end_iso = _period_bounds(period)
        base = {"occurred_at": {"$gte": start_iso, "$lt": end_iso}}

        # Visitor sets per step
        started_visitors = set(
            await db["marketing_events"].distinct(
                "visitor_id", {**base, "event_type": "start_booking"}
            )
        )
        lead_visitors = set(
            await db["marketing_events"].distinct(
                "visitor_id", {**base, "event_type": "submit_lead"}
            )
        )
        purchased_visitors = set(
            await db["marketing_events"].distinct(
                "visitor_id", {**base, "event_type": "purchase"}
            )
        )

        abandoned = started_visitors - purchased_visitors
        abandoned_after_lead = (started_visitors & lead_visitors) - purchased_visitors

        # Per-offer abandons (visitors who started_booking on offer X but never purchased)
        per_offer_cursor = db["marketing_events"].aggregate([
            {"$match": {**base, "event_type": "start_booking"}},
            {"$addFields": {
                "offer_key": {
                    "$ifNull": [
                        "$props.offer",
                        {"$ifNull": ["$props.offer_id", "$page"]},
                    ]
                }
            }},
            {"$match": {"offer_key": {"$ne": None}}},
            {"$group": {
                "_id": "$offer_key",
                "visitors": {"$addToSet": "$visitor_id"},
            }},
        ])
        per_offer = []
        async for r in per_offer_cursor:
            vset = set(r["visitors"])
            ab = vset - purchased_visitors
            per_offer.append({
                "offer": r["_id"],
                "started": len(vset),
                "abandoned": len(ab),
                "abandon_rate_pct": round(len(ab) / len(vset) * 100, 1) if vset else 0.0,
            })
        per_offer.sort(key=lambda i: i["abandoned"], reverse=True)

        return {
            "period": period,
            "summary": {
                "started_booking": len(started_visitors),
                "completed_purchase": len(purchased_visitors),
                "abandoned": len(abandoned),
                "abandon_rate_pct": (
                    round(len(abandoned) / len(started_visitors) * 100, 1)
                    if started_visitors else 0.0
                ),
                "abandoned_with_lead": len(abandoned_after_lead),
            },
            "per_offer": per_offer[:20],
        }

    return router
