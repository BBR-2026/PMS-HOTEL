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
        require_role(user, ["admin", "manager", "manager_pole", "management_general"])
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

    return router
