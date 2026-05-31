"""Corporate inquiry requests — replaces the booking tunnel for the Corporate pole.

A prospect fills in a short form (company, sector, requested date, head-count,
contact name & phone) and the request lands in MongoDB plus an email is sent
to the resort's commercial team for follow-up. No QR ticket, no payment —
it's a sales lead.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, EmailStr, Field

logger = logging.getLogger(__name__)


class CorporateInquiryCreate(BaseModel):
    offer_id: str = Field(min_length=1, max_length=60)
    company_name: str = Field(min_length=1, max_length=120)
    sector: str = Field(min_length=1, max_length=120)
    description: str = Field(min_length=1, max_length=4000)
    requested_date: str = Field(min_length=8, max_length=20)  # ISO YYYY-MM-DD
    head_count: int = Field(ge=1, le=2000)
    contact_name: str = Field(min_length=1, max_length=120)
    contact_phone: str = Field(min_length=4, max_length=40)
    contact_email: Optional[EmailStr] = None


def _offer_label(offer_id: str, offers_catalog: dict) -> str:
    o = offers_catalog.get(offer_id)
    if o:
        return o.get("name_fr") or o.get("name") or offer_id
    return offer_id.replace("_", " ").title()


async def _send_lead_email(email_service, lead: dict, public_base_url: str) -> None:
    """Notify the commercial inbox. Best-effort, never blocks the response."""
    if not email_service:
        return
    notify_to = "contact@boulaybeachresort.com"
    subject = f"Nouvelle demande Corporate — {lead['offer_label']} — {lead['company_name']}"
    rows = [
        ("Offre", lead["offer_label"]),
        ("Entreprise", lead["company_name"]),
        ("Secteur d'activité", lead["sector"]),
        ("Date souhaitée", lead["requested_date"]),
        ("Nombre de personnes", str(lead["head_count"])),
        ("Correspondant", lead["contact_name"]),
        ("Téléphone", lead["contact_phone"]),
        ("Email", lead.get("contact_email") or "—"),
    ]
    rows_html = "".join(
        f"<tr><td style='padding:6px 12px;color:#666;'>{k}</td>"
        f"<td style='padding:6px 12px;font-weight:600;'>{v}</td></tr>"
        for k, v in rows
    )
    html = f"""
    <div style="font-family:Helvetica,Arial,sans-serif;max-width:600px;margin:auto;color:#0A0A0A;">
      <h2 style="margin:0 0 6px;">Nouvelle demande Corporate</h2>
      <div style="color:#B8922A;text-transform:uppercase;letter-spacing:3px;font-size:11px;margin-bottom:18px;">
        Boulay Beach Resort
      </div>
      <table style="border-collapse:collapse;width:100%;">{rows_html}</table>
      <h3 style="margin-top:24px;color:#0A0A0A;">Description</h3>
      <p style="white-space:pre-wrap;line-height:1.55;color:#222;">{lead['description']}</p>
    </div>
    """
    plain = "\n".join(f"{k}: {v}" for k, v in rows) + f"\n\nDescription:\n{lead['description']}"
    try:
        await email_service.send_email(
            to=notify_to, subject=subject, html=html, plain=plain,
            tag="corporate_inquiry",
            reply_to=lead.get("contact_email") or None,
        )
    except Exception as ex:
        logger.warning("Could not send corporate lead email: %s", ex)


def build_router(*, db, offers_catalog: dict, require_role, get_current_staff,
                 email_service, public_base_url: str = "") -> APIRouter:
    router = APIRouter()

    @router.post("/corporate-inquiries")
    async def create_inquiry(body: CorporateInquiryCreate):
        """Public — anyone can submit a corporate inquiry through the form."""
        offer_label = _offer_label(body.offer_id, offers_catalog)
        lead = {
            "id": str(uuid.uuid4()),
            "offer_id": body.offer_id,
            "offer_label": offer_label,
            "company_name": body.company_name.strip(),
            "sector": body.sector.strip(),
            "description": body.description.strip(),
            "requested_date": body.requested_date.strip(),
            "head_count": int(body.head_count),
            "contact_name": body.contact_name.strip(),
            "contact_phone": body.contact_phone.strip(),
            "contact_email": (body.contact_email or "").strip() or None,
            "status": "new",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.corporate_inquiries.insert_one({**lead})
        try:
            await _send_lead_email(email_service, lead, public_base_url)
        except Exception as ex:
            logger.warning("Lead email failed: %s", ex)
        return {"ok": True, "id": lead["id"]}

    @router.get("/staff/corporate-inquiries")
    async def staff_list_inquiries(
        page: int = Query(1, ge=1),
        limit: int = Query(50, ge=1, le=500),
        q: Optional[str] = None,
        status: Optional[str] = None,
        period: Optional[str] = Query(None, regex="^(day|week|month|all)$"),
        offer_id: Optional[str] = None,
        staff=Depends(get_current_staff),
    ):
        await require_role(staff, ["admin", "manager", "manager_pole", "management_general"])
        filt: dict = {}
        if q:
            rx = {"$regex": q, "$options": "i"}
            filt["$or"] = [
                {"company_name": rx}, {"sector": rx}, {"contact_name": rx},
                {"contact_phone": rx}, {"contact_email": rx}, {"offer_label": rx},
            ]
        if status:
            filt["status"] = status
        if offer_id:
            filt["offer_id"] = offer_id
        if period and period != "all":
            now = datetime.now(timezone.utc)
            if period == "day":
                since = now.replace(hour=0, minute=0, second=0, microsecond=0)
            elif period == "week":
                since = (now - timedelta(days=now.weekday())).replace(
                    hour=0, minute=0, second=0, microsecond=0,
                )
            else:
                since = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            filt["created_at"] = {"$gte": since.isoformat()}
        total = await db.corporate_inquiries.count_documents(filt)
        cursor = (
            db.corporate_inquiries.find(filt, {"_id": 0})
            .sort("created_at", -1)
            .skip((page - 1) * limit)
            .limit(limit)
        )
        items = await cursor.to_list(length=limit)
        return {"total": total, "page": page, "limit": limit, "items": items}

    @router.patch("/staff/corporate-inquiries/{inquiry_id}")
    async def staff_update_inquiry(
        inquiry_id: str,
        body: dict,
        staff=Depends(get_current_staff),
    ):
        await require_role(staff, ["admin", "manager", "manager_pole"])
        allowed = {"status", "notes"}
        update = {k: v for k, v in body.items() if k in allowed}
        if not update:
            raise HTTPException(status_code=400, detail="Aucun champ valide à mettre à jour")
        update["updated_at"] = datetime.now(timezone.utc).isoformat()
        res = await db.corporate_inquiries.update_one({"id": inquiry_id}, {"$set": update})
        if res.matched_count == 0:
            raise HTTPException(status_code=404, detail="Demande introuvable")
        return {"ok": True}

    @router.delete("/staff/corporate-inquiries/{inquiry_id}")
    async def staff_delete_inquiry(inquiry_id: str, staff=Depends(get_current_staff)):
        await require_role(staff, ["admin"])
        res = await db.corporate_inquiries.delete_one({"id": inquiry_id})
        if res.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Demande introuvable")
        return {"ok": True}

    return router
