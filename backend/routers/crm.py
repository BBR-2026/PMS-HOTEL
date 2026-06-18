"""CRM 360° — Revenue Engine Phase B (continuation).

Unified customer view that joins all touchpoints :
  * ``bookings`` — historical revenue per offer + total_spent + last_visit.
  * ``marketing_events`` — first/last UTM attribution + behavioural events.
  * ``contact_messages`` — inbound support tickets.
  * ``newsletter_subscribers`` — opt-in status.
  * ``event_requests`` — privatization / corporate leads.
  * ``memberships`` (when shipped) — card status.

The CRM endpoints expose :
  * ``GET /api/staff/crm/customers`` — list + segments + filters.
  * ``GET /api/staff/crm/customers/{email}`` — 360° view (timeline, KPIs, attribution).
  * ``GET /api/staff/crm/segments`` — pre-computed counts for sidebar chips.
"""
from __future__ import annotations

import logging
import re
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query

log = logging.getLogger(__name__)

# Customer segment thresholds (FCFA, days)
SEG_VIP_MIN_SPENT = 500_000
SEG_VIP_MIN_BOOKINGS = 3
SEG_RECENT_DAYS = 30
SEG_DORMANT_DAYS = 180


def _today_iso() -> str:
    return datetime.now(timezone.utc).date().isoformat()


def _days_ago_iso(days: int) -> str:
    return (datetime.now(timezone.utc).date() - timedelta(days=days)).isoformat()


def _classify_segments(c: dict[str, Any]) -> list[str]:
    """Compute segment tags from a customer aggregation row."""
    segs: list[str] = []
    spent = c.get("total_spent", 0) or 0
    bookings_count = c.get("bookings_count", 0) or 0
    last_visit = c.get("last_visit")
    is_newsletter = bool(c.get("newsletter_subscribed"))
    has_lead = bool(c.get("has_open_lead"))

    if spent >= SEG_VIP_MIN_SPENT or bookings_count >= SEG_VIP_MIN_BOOKINGS:
        segs.append("vip")

    if last_visit and last_visit >= _days_ago_iso(SEG_RECENT_DAYS):
        segs.append("recent_visitor")
    elif last_visit and last_visit < _days_ago_iso(SEG_DORMANT_DAYS):
        segs.append("dormant")

    if bookings_count == 0 and (is_newsletter or has_lead):
        segs.append("lead")

    if bookings_count >= 1 and not segs:
        segs.append("customer")

    return segs or ["prospect"]


async def _build_customer_row(
    db, *, email: str, bookings: list[dict], primary_attr: dict | None,
    newsletter: dict | None, has_lead: bool
) -> dict[str, Any]:
    paid = [b for b in bookings if b.get("paid_at")]
    total_spent = sum(b.get("total_amount", 0) for b in paid)
    last_visit = None
    if bookings:
        dates = sorted([b.get("date") for b in bookings if b.get("date")], reverse=True)
        last_visit = dates[0] if dates else None
    primary = next((p for b in bookings for p in b.get("participants") or []
                    if p.get("kind") == "adult"), None) or {}
    row = {
        "email": email,
        "name": primary.get("name", ""),
        "surname": primary.get("surname", ""),
        "phone": (bookings[0].get("phone") if bookings else None)
                 or (newsletter.get("phone") if newsletter else None),
        "nationality": primary.get("nationality", ""),
        "bookings_count": len(bookings),
        "paid_bookings_count": len(paid),
        "total_spent": total_spent,
        "last_visit": last_visit,
        "first_seen_at": (primary_attr or {}).get("first_seen_at"),
        "first_utm_source": (primary_attr or {}).get("first_utm_source"),
        "first_utm_campaign": (primary_attr or {}).get("first_utm_campaign"),
        "last_utm_source": (primary_attr or {}).get("last_utm_source"),
        "last_utm_campaign": (primary_attr or {}).get("last_utm_campaign"),
        "newsletter_subscribed": bool(newsletter),
        "newsletter_status": (newsletter or {}).get("status"),
        "has_open_lead": has_lead,
    }
    row["segments"] = _classify_segments(row)
    return row


async def _attribution_for_email(db, email: str) -> dict | None:
    """Build first/last UTM attribution for an email by joining via
    contact_messages.visitor_id (if any) + newsletter_subscribers.visitor_id."""
    visitor_ids: set[str] = set()

    cm = db["contact_messages"].find({"email": email}, {"visitor_id": 1, "attribution": 1})
    newsletter = db["newsletter_subscribers"].find(
        {"email": email}, {"visitor_id": 1, "attribution": 1, "last_attribution": 1}
    )
    for src in (cm, newsletter):
        async for d in src:
            if d.get("visitor_id"):
                visitor_ids.add(d["visitor_id"])

    if not visitor_ids:
        # fall back to newsletter / contact attribution snapshot
        any_doc = await db["newsletter_subscribers"].find_one({"email": email}) or {}
        attr = any_doc.get("attribution") or any_doc.get("last_attribution") or {}
        last = any_doc.get("last_attribution") or attr
        if not attr:
            cm_doc = await db["contact_messages"].find_one({"email": email}) or {}
            attr = cm_doc.get("attribution") or {}
            last = attr
        if not attr:
            return None
        return {
            "visitor_ids": [],
            "first_seen_at": any_doc.get("created_at"),
            "first_utm_source": (attr or {}).get("utm_source"),
            "first_utm_campaign": (attr or {}).get("utm_campaign"),
            "first_utm_medium": (attr or {}).get("utm_medium"),
            "last_utm_source": (last or {}).get("utm_source"),
            "last_utm_campaign": (last or {}).get("utm_campaign"),
            "last_utm_medium": (last or {}).get("utm_medium"),
        }

    # Real attribution via marketing_events
    first = await db["marketing_events"].find_one(
        {"visitor_id": {"$in": list(visitor_ids)}},
        sort=[("occurred_at", 1)],
    )
    last = await db["marketing_events"].find_one(
        {"visitor_id": {"$in": list(visitor_ids)}, "attribution.utm_source": {"$exists": True}},
        sort=[("occurred_at", -1)],
    ) or first
    fa = (first or {}).get("attribution") or {}
    la = (last or {}).get("attribution") or {}
    return {
        "visitor_ids": list(visitor_ids),
        "first_seen_at": (first or {}).get("occurred_at"),
        "first_utm_source": fa.get("utm_source"),
        "first_utm_campaign": fa.get("utm_campaign"),
        "first_utm_medium": fa.get("utm_medium"),
        "last_utm_source": la.get("utm_source"),
        "last_utm_campaign": la.get("utm_campaign"),
        "last_utm_medium": la.get("utm_medium"),
    }


def build_router(*, db, get_current_staff, require_role) -> APIRouter:
    router = APIRouter(prefix="/api/staff/crm", tags=["crm"])

    @router.get("/segments")
    async def segments(user=Depends(get_current_staff)):
        await require_role(user, ["admin", "manager", "manager_pole", "management_general"])
        # Aggregate counts in a single sweep over distinct emails in bookings.
        emails = await db["bookings"].distinct("email")
        emails = [e for e in emails if e]
        counts = {"all": 0, "vip": 0, "recent_visitor": 0, "dormant": 0, "lead": 0, "customer": 0, "prospect": 0}
        for email in emails:
            bookings = await db["bookings"].find(
                {"email": email}, {"date": 1, "total_amount": 1, "paid_at": 1, "participants": 1, "phone": 1}
            ).to_list(length=200)
            newsletter = await db["newsletter_subscribers"].find_one({"email": email})
            row = await _build_customer_row(
                db, email=email, bookings=bookings, primary_attr=None,
                newsletter=newsletter, has_lead=False,
            )
            counts["all"] += 1
            for seg in row["segments"]:
                counts[seg] = counts.get(seg, 0) + 1
        # Also count newsletter-only leads (no booking yet)
        async for d in db["newsletter_subscribers"].find({}, {"email": 1}):
            if d.get("email") and d["email"] not in emails:
                counts["all"] += 1
                counts["lead"] = counts.get("lead", 0) + 1
        return {"counts": counts}

    @router.get("/customers")
    async def list_customers(
        segment: str | None = Query(default=None),
        q: str | None = Query(default=None),
        limit: int = Query(default=100, ge=1, le=500),
        user=Depends(get_current_staff),
    ):
        await require_role(user, ["admin", "manager", "manager_pole", "management_general"])
        # Step 1 : gather candidate emails (bookings + newsletter)
        booking_emails = await db["bookings"].distinct("email")
        booking_emails = {e.lower(): e for e in booking_emails if e}
        all_emails: dict[str, str] = dict(booking_emails)
        async for d in db["newsletter_subscribers"].find({}, {"email": 1}):
            e = (d.get("email") or "").lower()
            if e and e not in all_emails:
                all_emails[e] = d["email"]

        rows: list[dict] = []
        rx = re.compile(re.escape(q), re.I) if q else None
        for lower_email, email in all_emails.items():
            bookings = await db["bookings"].find(
                {"email": {"$regex": f"^{re.escape(email)}$", "$options": "i"}},
                {"_id": 0, "date": 1, "total_amount": 1, "paid_at": 1,
                 "participants": 1, "phone": 1, "offer_type": 1, "offer_name": 1},
            ).to_list(length=200)
            newsletter = await db["newsletter_subscribers"].find_one({"email": email})
            has_lead = await db["contact_messages"].count_documents(
                {"email": email, "status": {"$in": ["new", "in_progress"]}}
            ) > 0
            attr = await _attribution_for_email(db, email)
            row = await _build_customer_row(
                db, email=email, bookings=bookings, primary_attr=attr,
                newsletter=newsletter, has_lead=has_lead,
            )
            if segment and segment != "all" and segment not in row["segments"]:
                continue
            if rx and not (
                rx.search(email) or rx.search(row.get("name") or "")
                or rx.search(row.get("surname") or "") or rx.search(row.get("phone") or "")
            ):
                continue
            rows.append(row)
            if len(rows) >= limit:
                break
        rows.sort(key=lambda r: (r.get("total_spent", 0), r.get("last_visit") or ""), reverse=True)
        return {"items": rows, "count": len(rows)}

    @router.get("/customers/{email}")
    async def customer_detail(email: str, user=Depends(get_current_staff)):
        await require_role(user, ["admin", "manager", "manager_pole", "management_general"])
        # Bookings
        bookings = await db["bookings"].find(
            {"email": {"$regex": f"^{re.escape(email)}$", "$options": "i"}},
            {"_id": 0, "reference_token": 0, "qr_codes.qr_code": 0,
             "qr_codes.qr_payload": 0, "qr_codes.ticket_image": 0},
        ).sort("date", -1).to_list(length=500)

        newsletter = await db["newsletter_subscribers"].find_one({"email": email}, {"_id": 0})
        messages = await db["contact_messages"].find(
            {"email": email}, {"_id": 0}
        ).sort("created_at", -1).to_list(length=50)
        event_requests = await db["event_requests"].find(
            {"email": email}, {"_id": 0}
        ).sort("created_at", -1).to_list(length=50)

        attr = await _attribution_for_email(db, email)
        visitor_ids = (attr or {}).get("visitor_ids") or []
        marketing_events = []
        if visitor_ids:
            marketing_events = await db["marketing_events"].find(
                {"visitor_id": {"$in": visitor_ids}}, {"_id": 0}
            ).sort("occurred_at", -1).to_list(length=200)

        if not bookings and not newsletter and not messages and not event_requests:
            raise HTTPException(status_code=404, detail="Client introuvable")

        # KPIs
        paid = [b for b in bookings if b.get("paid_at")]
        total_spent = sum(b.get("total_amount", 0) for b in paid)
        ltv = total_spent  # alias
        avg_basket = round(total_spent / len(paid), 0) if paid else 0
        last_visit = bookings[0].get("date") if bookings else None
        primary = next(
            (p for b in bookings for p in b.get("participants") or []
             if p.get("kind") == "adult"),
            None,
        ) or {}

        # Build unified timeline
        timeline: list[dict] = []
        for b in bookings:
            timeline.append({
                "ts": b.get("paid_at") or b.get("created_at") or b.get("date"),
                "type": "booking",
                "label": b.get("offer_name") or b.get("offer_type"),
                "amount": b.get("total_amount"),
                "status": "paid" if b.get("paid_at") else "pending",
                "ref": b.get("id"),
                "extra": {"date": b.get("date"), "guests": len(b.get("participants") or [])},
            })
        for m in messages:
            timeline.append({
                "ts": m.get("created_at"),
                "type": "contact_message",
                "label": m.get("subject") or "Message contact",
                "status": m.get("status"),
                "ref": m.get("id"),
                "extra": {"message": (m.get("message") or "")[:160]},
            })
        if newsletter:
            timeline.append({
                "ts": newsletter.get("created_at"),
                "type": "newsletter",
                "label": f"Inscription newsletter · {newsletter.get('source')}",
                "status": newsletter.get("status"),
                "ref": None,
                "extra": {},
            })
        for ev in event_requests:
            timeline.append({
                "ts": ev.get("created_at"),
                "type": "event_request",
                "label": f"Demande {ev.get('event_type') or 'événement'}",
                "status": ev.get("status"),
                "ref": ev.get("id"),
                "extra": {"date": ev.get("event_date"), "guests": ev.get("guest_count")},
            })
        for me in marketing_events:
            timeline.append({
                "ts": me.get("occurred_at"),
                "type": "marketing_event",
                "label": me.get("event_type"),
                "ref": None,
                "extra": {"page": me.get("page"), "props": me.get("props")},
            })
        timeline.sort(key=lambda t: t.get("ts") or "", reverse=True)

        has_lead = any(m.get("status") in ("new", "in_progress") for m in messages)
        row_seg = await _build_customer_row(
            db, email=email, bookings=bookings, primary_attr=attr,
            newsletter=newsletter, has_lead=has_lead,
        )

        return {
            "email": email,
            "profile": {
                "name": primary.get("name", ""),
                "surname": primary.get("surname", ""),
                "phone": (bookings[0].get("phone") if bookings else None)
                         or (newsletter or {}).get("phone"),
                "nationality": primary.get("nationality", ""),
            },
            "kpis": {
                "bookings_count": len(bookings),
                "paid_bookings_count": len(paid),
                "total_spent": total_spent,
                "ltv": ltv,
                "avg_basket": avg_basket,
                "last_visit": last_visit,
                "first_seen_at": (attr or {}).get("first_seen_at"),
                "messages_count": len(messages),
                "event_requests_count": len(event_requests),
                "marketing_events_count": len(marketing_events),
            },
            "attribution": attr,
            "segments": row_seg["segments"],
            "bookings": bookings,
            "messages": messages,
            "event_requests": event_requests,
            "newsletter": newsletter,
            "marketing_events": marketing_events[:50],
            "timeline": timeline,
        }

    return router
