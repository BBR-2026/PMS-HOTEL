"""Marketing & analytics event sink.

Receives all front-end events (page_view, view_offer, start_booking,
submit_lead, purchase, …) and persists them into MongoDB collection
``marketing_events`` along with the captured UTM attribution.

The collection is the seed for the Marketing & Analytics dashboards
of the upcoming back-office modules.

All routes are mounted under ``/api/marketing``.
"""
from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, Header, Request
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field

log = logging.getLogger(__name__)

# ── Mongo client ───────────────────────────────────────────────────
_client: AsyncIOMotorClient | None = None
_db = None


def get_db():
    global _client, _db
    if _db is not None:
        return _db
    mongo_url = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME")
    _client = AsyncIOMotorClient(mongo_url)
    _db = _client[db_name]
    return _db


# ── Models ─────────────────────────────────────────────────────────
class AttributionPayload(BaseModel):
    utm_source: str | None = None
    utm_medium: str | None = None
    utm_campaign: str | None = None
    utm_term: str | None = None
    utm_content: str | None = None
    gclid: str | None = None
    fbclid: str | None = None
    captured_at: str | None = None
    landing: str | None = None


class MarketingEventIn(BaseModel):
    visitor_id: str
    session_id: str | None = None
    event_type: str = Field(min_length=1, max_length=64)
    page: str | None = None
    referrer: str | None = None
    attribution: AttributionPayload | None = None
    props: dict[str, Any] = Field(default_factory=dict)
    value: float | None = None
    currency: str | None = None
    user_agent: str | None = None
    occurred_at: str | None = None


# ── Router ─────────────────────────────────────────────────────────
router = APIRouter(prefix="/api/marketing", tags=["marketing"])


@router.post("/events")
async def ingest_event(
    payload: MarketingEventIn,
    request: Request,
    x_forwarded_for: str | None = Header(default=None, alias="X-Forwarded-For"),
):
    """Append-only ingestion of marketing/analytics events.

    Returns immediately (fire-and-forget on the client side). Bad payloads
    are silently dropped to avoid penalising the front-end.
    """
    db = get_db()
    ip = (x_forwarded_for or "").split(",")[0].strip() or request.client.host
    doc = {
        "_id": str(uuid4()),
        "visitor_id": payload.visitor_id,
        "session_id": payload.session_id,
        "event_type": payload.event_type,
        "page": payload.page,
        "referrer": payload.referrer,
        "attribution": (payload.attribution.model_dump()
                        if payload.attribution else None),
        "props": payload.props or {},
        "value": payload.value,
        "currency": payload.currency,
        "user_agent": payload.user_agent,
        "ip": ip,
        "occurred_at": payload.occurred_at or datetime.now(timezone.utc).isoformat(),
        "received_at": datetime.now(timezone.utc).isoformat(),
    }
    try:
        await db["marketing_events"].insert_one(doc)
    except Exception as exc:  # noqa: BLE001
        log.warning("marketing_events insert failed: %s", exc)
    return {"ok": True}


@router.get("/stats/today")
async def stats_today():
    """Lightweight KPI for the back-office (will be extended in Phase B)."""
    db = get_db()
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    cursor = db["marketing_events"].aggregate([
        {"$match": {"occurred_at": {"$regex": f"^{today}"}}},
        {"$group": {
            "_id": "$event_type",
            "count": {"$sum": 1},
        }},
    ])
    by_event = {row["_id"]: row["count"] async for row in cursor}
    visitors = await db["marketing_events"].distinct(
        "visitor_id", {"occurred_at": {"$regex": f"^{today}"}}
    )
    return {
        "date": today,
        "unique_visitors": len(visitors),
        "by_event": by_event,
    }
