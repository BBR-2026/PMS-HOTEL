"""Public lead-capture endpoints + staff back-office for inbound contacts.

Two collections are persisted:
  * ``contact_messages`` — messages sent from the public Contact form.
  * ``newsletter_subscribers`` — emails captured on the Boutique / Vitrine
    (waiting list, "Be the first to know").

UTM attribution is captured automatically from the request payload so the
Revenue Engine can attribute leads to specific marketing campaigns.

All public routes are mounted under ``/api`` while staff routes live under
``/api/staff`` and require manager+ access (injected by the factory).
"""
from __future__ import annotations

import csv
import io
import logging
import re
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, EmailStr, Field

log = logging.getLogger(__name__)

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


# ── Public payloads ────────────────────────────────────────────────
class ContactMessageIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    phone: str | None = Field(default=None, max_length=40)
    subject: str | None = Field(default=None, max_length=160)
    message: str = Field(min_length=1, max_length=4000)
    company: str | None = Field(default=None, max_length=120)
    attribution: dict[str, Any] | None = None  # forwarded from front-end UTM
    visitor_id: str | None = None
    page: str | None = None


class NewsletterSignupIn(BaseModel):
    email: EmailStr
    first_name: str | None = Field(default=None, max_length=80)
    source: str | None = Field(default=None, max_length=80)  # e.g. "boutique_waitlist"
    interests: list[str] | None = None
    attribution: dict[str, Any] | None = None
    visitor_id: str | None = None


def build_router(*, db, get_current_staff, require_role) -> APIRouter:
    router = APIRouter(tags=["leads"])

    # ===================================================================
    # Public — write
    # ===================================================================
    @router.post("/api/contact-messages")
    async def submit_contact_message(
        payload: ContactMessageIn,
        request: Request,
        x_forwarded_for: str | None = Header(default=None, alias="X-Forwarded-For"),
    ):
        ip = (x_forwarded_for or "").split(",")[0].strip() or request.client.host
        now = datetime.now(timezone.utc).isoformat()
        doc = {
            "_id": str(uuid4()),
            "name": payload.name.strip(),
            "email": payload.email.lower(),
            "phone": (payload.phone or "").strip() or None,
            "subject": (payload.subject or "").strip() or None,
            "message": payload.message.strip(),
            "company": (payload.company or "").strip() or None,
            "attribution": payload.attribution or None,
            "visitor_id": payload.visitor_id,
            "page": payload.page,
            "ip": ip,
            "user_agent": request.headers.get("user-agent"),
            "status": "new",  # new | in_progress | replied | archived
            "created_at": now,
            "updated_at": now,
        }
        await db["contact_messages"].insert_one(doc)

        # Mirror as a marketing "submit_lead" event for funnel analytics.
        try:
            await db["marketing_events"].insert_one({
                "_id": str(uuid4()),
                "visitor_id": payload.visitor_id or "anon",
                "event_type": "submit_lead",
                "page": payload.page,
                "attribution": payload.attribution or None,
                "props": {"channel": "contact_form", "subject": doc["subject"]},
                "occurred_at": now,
                "received_at": now,
                "ip": ip,
            })
        except Exception as exc:  # noqa: BLE001
            log.warning("marketing mirror failed (contact): %s", exc)

        return {"ok": True, "id": doc["_id"]}

    @router.post("/api/newsletter-subscribers")
    async def subscribe_newsletter(
        payload: NewsletterSignupIn,
        request: Request,
        x_forwarded_for: str | None = Header(default=None, alias="X-Forwarded-For"),
    ):
        email = payload.email.lower().strip()
        if not EMAIL_RE.match(email):
            raise HTTPException(status_code=400, detail="invalid_email")

        ip = (x_forwarded_for or "").split(",")[0].strip() or request.client.host
        now = datetime.now(timezone.utc).isoformat()

        existing = await db["newsletter_subscribers"].find_one({"email": email})
        if existing:
            # Idempotent — refresh source / attribution if newer touchpoint.
            await db["newsletter_subscribers"].update_one(
                {"_id": existing["_id"]},
                {"$set": {
                    "last_seen_at": now,
                    "last_source": payload.source or existing.get("last_source"),
                    "last_attribution": payload.attribution or existing.get("last_attribution"),
                }, "$inc": {"signup_count": 1}},
            )
            return {"ok": True, "already_subscribed": True, "id": existing["_id"]}

        doc = {
            "_id": str(uuid4()),
            "email": email,
            "first_name": (payload.first_name or "").strip() or None,
            "source": payload.source or "vitrine",
            "last_source": payload.source or "vitrine",
            "interests": payload.interests or [],
            "attribution": payload.attribution or None,
            "last_attribution": payload.attribution or None,
            "visitor_id": payload.visitor_id,
            "ip": ip,
            "user_agent": request.headers.get("user-agent"),
            "status": "active",  # active | unsubscribed | bounced
            "signup_count": 1,
            "created_at": now,
            "last_seen_at": now,
        }
        await db["newsletter_subscribers"].insert_one(doc)

        try:
            await db["marketing_events"].insert_one({
                "_id": str(uuid4()),
                "visitor_id": payload.visitor_id or "anon",
                "event_type": "submit_lead",
                "page": None,
                "attribution": payload.attribution or None,
                "props": {"channel": "newsletter", "source": doc["source"]},
                "occurred_at": now,
                "received_at": now,
                "ip": ip,
            })
        except Exception as exc:  # noqa: BLE001
            log.warning("marketing mirror failed (newsletter): %s", exc)

        return {"ok": True, "already_subscribed": False, "id": doc["_id"]}

    # ===================================================================
    # Staff — read (manager+)
    # ===================================================================
    @router.get("/api/staff/contact-messages")
    async def list_contact_messages(
        status: str | None = Query(default=None),
        q: str | None = Query(default=None),
        limit: int = Query(default=100, ge=1, le=500),
        user=Depends(get_current_staff),
    ):
        require_role(user, ["admin", "manager", "manager_pole", "management_general"])
        filt: dict[str, Any] = {}
        if status:
            filt["status"] = status
        if q:
            rx = {"$regex": re.escape(q), "$options": "i"}
            filt["$or"] = [{"name": rx}, {"email": rx}, {"subject": rx}, {"message": rx}]
        cursor = db["contact_messages"].find(filt).sort("created_at", -1).limit(limit)
        items = []
        async for d in cursor:
            d["id"] = d.pop("_id")
            items.append(d)
        total_new = await db["contact_messages"].count_documents({"status": "new"})
        return {"items": items, "total_new": total_new}

    @router.patch("/api/staff/contact-messages/{msg_id}")
    async def update_contact_message(
        msg_id: str,
        body: dict,
        user=Depends(get_current_staff),
    ):
        require_role(user, ["admin", "manager", "manager_pole"])
        allowed = {"status", "internal_notes"}
        updates = {k: v for k, v in body.items() if k in allowed}
        if not updates:
            raise HTTPException(status_code=400, detail="nothing_to_update")
        updates["updated_at"] = datetime.now(timezone.utc).isoformat()
        updates["updated_by"] = user.get("email")
        r = await db["contact_messages"].update_one({"_id": msg_id}, {"$set": updates})
        if r.matched_count == 0:
            raise HTTPException(status_code=404, detail="not_found")
        return {"ok": True}

    @router.get("/api/staff/newsletter-subscribers")
    async def list_newsletter_subscribers(
        status: str | None = Query(default=None),
        source: str | None = Query(default=None),
        q: str | None = Query(default=None),
        limit: int = Query(default=200, ge=1, le=1000),
        user=Depends(get_current_staff),
    ):
        require_role(user, ["admin", "manager", "manager_pole", "management_general"])
        filt: dict[str, Any] = {}
        if status:
            filt["status"] = status
        if source:
            filt["source"] = source
        if q:
            rx = {"$regex": re.escape(q), "$options": "i"}
            filt["$or"] = [{"email": rx}, {"first_name": rx}]
        cursor = db["newsletter_subscribers"].find(filt).sort("created_at", -1).limit(limit)
        items = []
        async for d in cursor:
            d["id"] = d.pop("_id")
            items.append(d)
        total_active = await db["newsletter_subscribers"].count_documents({"status": "active"})
        # Source breakdown for charts
        breakdown_cursor = db["newsletter_subscribers"].aggregate([
            {"$group": {"_id": "$source", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
        ])
        by_source = [{"source": r["_id"] or "unknown", "count": r["count"]}
                     async for r in breakdown_cursor]
        return {"items": items, "total_active": total_active, "by_source": by_source}

    @router.get("/api/staff/newsletter-subscribers/export.csv")
    async def export_newsletter_csv(user=Depends(get_current_staff)):
        require_role(user, ["admin", "manager", "manager_pole", "management_general"])
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(["email", "first_name", "source", "status",
                         "signup_count", "created_at", "last_seen_at",
                         "utm_source", "utm_campaign"])
        cursor = db["newsletter_subscribers"].find({}).sort("created_at", -1)
        async for d in cursor:
            attr = d.get("attribution") or {}
            writer.writerow([
                d.get("email", ""),
                d.get("first_name", "") or "",
                d.get("source", ""),
                d.get("status", ""),
                d.get("signup_count", 1),
                d.get("created_at", ""),
                d.get("last_seen_at", ""),
                attr.get("utm_source", "") if isinstance(attr, dict) else "",
                attr.get("utm_campaign", "") if isinstance(attr, dict) else "",
            ])
        buf.seek(0)
        return StreamingResponse(
            iter([buf.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": 'attachment; filename="bbr_newsletter.csv"'},
        )

    return router
