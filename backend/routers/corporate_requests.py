"""
Corporate Requests — Group registration links with capacity countdown.

Flow:
  1. Staff creates a CorporateRequest (company_name, reservation_type, max_participants,
     payment_mode='free'|'paid'|'configurable'). System mints a shareable_token.
  2. Manager shares /corporate-form/{token} with the company.
  3. Participants fill the public form, choosing their `kind`:
       - client     → can pay & pick an offer if mode != 'free'
       - personnel  → no offer, no payment (BBR staff)
       - prestataire→ no offer, no payment (vendor/contractor)
       - invite     → no offer, no payment (guest of guest)
  4. Each registration decrements `remaining_seats`. When it reaches 0, the
     form is locked and returns 403.
  5. Staff dashboard shows per-group analytics + CSV/PDF exports.
"""
from typing import Optional, Literal, List
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, EmailStr, Field
import uuid
import csv
import io
from datetime import datetime, timezone


VISITOR_KIND = Literal["client", "personnel", "prestataire", "invite"]


class CorporateRequestCreate(BaseModel):
    company_name: str = Field(min_length=2, max_length=120)
    contact_name: Optional[str] = None
    contact_email: Optional[EmailStr] = None
    contact_phone: Optional[str] = None
    reservation_type: str = Field(min_length=2, max_length=80)  # free-text or offer label
    offer_type: Optional[str] = None  # optional bound offer id
    event_date: Optional[str] = None  # YYYY-MM-DD when known
    max_participants: int = Field(ge=1, le=2000)
    payment_mode: Literal["free", "paid", "configurable"] = "configurable"
    notes: Optional[str] = None


class CorporateRequestUpdate(BaseModel):
    company_name: Optional[str] = None
    contact_name: Optional[str] = None
    contact_email: Optional[EmailStr] = None
    contact_phone: Optional[str] = None
    reservation_type: Optional[str] = None
    offer_type: Optional[str] = None
    event_date: Optional[str] = None
    max_participants: Optional[int] = Field(default=None, ge=1, le=2000)
    payment_mode: Optional[Literal["free", "paid", "configurable"]] = None
    status: Optional[Literal["open", "closed"]] = None
    notes: Optional[str] = None


class CorporateParticipantPublic(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    surname: str = Field(min_length=1, max_length=80)
    email: EmailStr
    phone: str = Field(min_length=4, max_length=40)
    whatsapp: Optional[str] = None
    nationality: str = Field(min_length=2, max_length=60)
    kind: VISITOR_KIND = "client"
    payment_method: Optional[Literal["card", "mobile_money", "cash", "free"]] = None
    notes: Optional[str] = None


def _now():
    return datetime.now(timezone.utc).isoformat()


def build_router(db, get_current_staff, require_role) -> APIRouter:
    r = APIRouter()

    async def _request_or_404(rid: str) -> dict:
        d = await db.corporate_requests.find_one({"id": rid}, {"_id": 0})
        if not d:
            raise HTTPException(status_code=404, detail="Demande corporate introuvable")
        return d

    async def _request_by_token(token: str) -> dict:
        d = await db.corporate_requests.find_one({"shareable_token": token}, {"_id": 0})
        if not d:
            raise HTTPException(status_code=404, detail="Lien invalide")
        return d

    async def _count_participants(rid: str) -> int:
        return await db.corporate_participants.count_documents({"request_id": rid})

    async def _enrich(d: dict) -> dict:
        registered = await _count_participants(d["id"])
        d["registered_count"] = registered
        d["remaining_seats"] = max(d["max_participants"] - registered, 0)
        d["is_full"] = registered >= d["max_participants"]
        return d

    # ---------- Staff CRUD ----------
    @r.get("/staff/corporate-requests")
    async def list_requests(staff=Depends(get_current_staff)):
        items = await db.corporate_requests.find({}, {"_id": 0}).sort("created_at", -1).to_list(length=200)
        for d in items:
            await _enrich(d)
        return {"items": items}

    @r.post("/staff/corporate-requests")
    async def create_request(body: CorporateRequestCreate, staff=Depends(get_current_staff)):
        await require_role(staff, ["manager", "admin"])
        doc = body.model_dump()
        doc["id"] = str(uuid.uuid4())
        doc["shareable_token"] = uuid.uuid4().hex
        doc["status"] = "open"
        doc["created_at"] = _now()
        doc["created_by"] = staff.get("email")
        await db.corporate_requests.insert_one(doc)
        return await _enrich({k: v for k, v in doc.items() if k != "_id"})

    @r.get("/staff/corporate-requests/{rid}")
    async def get_request(rid: str, staff=Depends(get_current_staff)):
        d = await _request_or_404(rid)
        d = await _enrich(d)
        d["participants"] = await db.corporate_participants.find(
            {"request_id": rid}, {"_id": 0},
        ).sort("registered_at", -1).to_list(length=2000)
        return d

    @r.patch("/staff/corporate-requests/{rid}")
    async def update_request(rid: str, body: CorporateRequestUpdate, staff=Depends(get_current_staff)):
        await require_role(staff, ["manager", "admin"])
        update = {k: v for k, v in body.model_dump().items() if v is not None}
        if not update:
            raise HTTPException(status_code=400, detail="Aucun champ à modifier")
        update["updated_at"] = _now()
        res = await db.corporate_requests.update_one({"id": rid}, {"$set": update})
        if res.matched_count == 0:
            raise HTTPException(status_code=404, detail="Demande introuvable")
        return {"ok": True}

    @r.delete("/staff/corporate-requests/{rid}")
    async def delete_request(rid: str, staff=Depends(get_current_staff)):
        await require_role(staff, ["admin"])
        await db.corporate_participants.delete_many({"request_id": rid})
        res = await db.corporate_requests.delete_one({"id": rid})
        if res.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Demande introuvable")
        return {"ok": True}

    # ---------- Stats / Analytics ----------
    @r.get("/staff/corporate-requests/{rid}/stats")
    async def request_stats(rid: str, staff=Depends(get_current_staff)):
        d = await _request_or_404(rid)
        participants = await db.corporate_participants.find(
            {"request_id": rid}, {"_id": 0},
        ).to_list(length=5000)
        by_kind: dict = {"client": 0, "personnel": 0, "prestataire": 0, "invite": 0}
        by_nationality: dict = {}
        with_whatsapp = 0
        paid_count = 0
        for p in participants:
            k = p.get("kind") or "client"
            by_kind[k] = by_kind.get(k, 0) + 1
            nat = p.get("nationality") or "Inconnu"
            by_nationality[nat] = by_nationality.get(nat, 0) + 1
            if (p.get("whatsapp") or "").strip():
                with_whatsapp += 1
            if p.get("payment_method") and p.get("payment_method") != "free":
                paid_count += 1
        top_nationalities = sorted(by_nationality.items(), key=lambda x: -x[1])[:6]
        return {
            "request": await _enrich(d),
            "by_kind": by_kind,
            "top_nationalities": [{"name": n, "count": c} for n, c in top_nationalities],
            "with_whatsapp": with_whatsapp,
            "paid_count": paid_count,
            "free_count": len(participants) - paid_count,
            "total": len(participants),
        }

    # ---------- Exports ----------
    @r.get("/staff/corporate-requests/{rid}/participants.csv")
    async def export_csv(rid: str, staff=Depends(get_current_staff)):
        d = await _request_or_404(rid)
        participants = await db.corporate_participants.find(
            {"request_id": rid}, {"_id": 0},
        ).sort("registered_at", 1).to_list(length=5000)
        buf = io.StringIO()
        w = csv.writer(buf, delimiter=";")
        w.writerow(["N°", "Nom", "Prénom", "Type", "Email", "Téléphone", "WhatsApp", "Nationalité", "Paiement", "Inscrit le"])
        for i, p in enumerate(participants, 1):
            w.writerow([
                i, p.get("surname", ""), p.get("name", ""),
                p.get("kind", ""),
                p.get("email", ""), p.get("phone", ""), p.get("whatsapp", ""),
                p.get("nationality", ""),
                p.get("payment_method", ""),
                p.get("registered_at", ""),
            ])
        filename = f"corporate-{d['company_name'].replace(' ', '_')}-participants.csv"
        return Response(
            content=buf.getvalue().encode("utf-8-sig"),
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    @r.get("/staff/corporate-requests/{rid}/participants.pdf")
    async def export_pdf(rid: str, staff=Depends(get_current_staff)):
        d = await _request_or_404(rid)
        participants = await db.corporate_participants.find(
            {"request_id": rid}, {"_id": 0},
        ).sort("registered_at", 1).to_list(length=5000)
        try:
            from reportlab.lib.pagesizes import A4, landscape
            from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
            from reportlab.lib.units import mm
            from reportlab.lib import colors
            from reportlab.platypus import (
                SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer,
            )
        except ImportError:
            raise HTTPException(status_code=500, detail="reportlab non installé")

        buf = io.BytesIO()
        doc = SimpleDocTemplate(buf, pagesize=landscape(A4),
                                leftMargin=15 * mm, rightMargin=15 * mm,
                                topMargin=15 * mm, bottomMargin=15 * mm)
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle("title", parent=styles["Heading1"],
                                     textColor=colors.HexColor("#0A0A0A"),
                                     fontSize=18, spaceAfter=4)
        subtitle = ParagraphStyle("sub", parent=styles["Normal"],
                                  textColor=colors.HexColor("#B8922A"),
                                  fontSize=8, spaceAfter=10, leading=10)
        story = [
            Paragraph(f"Demande corporate · {d['company_name']}", title_style),
            Paragraph(
                f"{d.get('reservation_type','')} · {len(participants)}/{d['max_participants']} inscrits"
                f"{(' · ' + d['event_date']) if d.get('event_date') else ''}",
                subtitle,
            ),
            Spacer(1, 4 * mm),
        ]
        data = [["N°", "Nom", "Prénom", "Type", "Email", "Téléphone", "WhatsApp", "Nationalité", "Inscrit le"]]
        for i, p in enumerate(participants, 1):
            data.append([
                str(i),
                p.get("surname", ""), p.get("name", ""),
                p.get("kind", ""),
                p.get("email", ""), p.get("phone", ""),
                p.get("whatsapp", ""),
                p.get("nationality", ""),
                (p.get("registered_at", "") or "")[:19].replace("T", " "),
            ])
        t = Table(data, repeatRows=1)
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0A0A0A")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTSIZE", (0, 0), (-1, 0), 8),
            ("FONTSIZE", (0, 1), (-1, -1), 7.5),
            ("BOTTOMPADDING", (0, 0), (-1, 0), 6),
            ("BOTTOMPADDING", (0, 1), (-1, -1), 4),
            ("TOPPADDING", (0, 1), (-1, -1), 4),
            ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#D5CFC4")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#FAFAF7")]),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ]))
        story.append(t)
        doc.build(story)
        filename = f"corporate-{d['company_name'].replace(' ', '_')}-participants.pdf"
        return Response(
            content=buf.getvalue(),
            media_type="application/pdf",
            headers={"Content-Disposition": f'inline; filename="{filename}"'},
        )

    # ---------- Public form ----------
    @r.get("/corporate-form/{token}")
    async def get_public_form(token: str):
        d = await _request_by_token(token)
        if d.get("status") == "closed":
            raise HTTPException(status_code=403, detail="Cette demande a été clôturée")
        d = await _enrich(d)
        if d["is_full"]:
            raise HTTPException(status_code=403, detail="Toutes les places ont été pourvues")
        # Strip private fields
        return {
            "id": d["id"],
            "company_name": d["company_name"],
            "reservation_type": d["reservation_type"],
            "offer_type": d.get("offer_type"),
            "event_date": d.get("event_date"),
            "payment_mode": d["payment_mode"],
            "max_participants": d["max_participants"],
            "registered_count": d["registered_count"],
            "remaining_seats": d["remaining_seats"],
        }

    @r.post("/corporate-form/{token}/register")
    async def register_public(token: str, body: CorporateParticipantPublic):
        d = await _request_by_token(token)
        if d.get("status") == "closed":
            raise HTTPException(status_code=403, detail="Cette demande a été clôturée")
        registered = await _count_participants(d["id"])
        if registered >= d["max_participants"]:
            raise HTTPException(status_code=403, detail="Toutes les places ont été pourvues")
        # Personnel/Prestataire/Invité never see offers in the form — force payment=free
        payment = body.payment_method or "free"
        if body.kind != "client":
            payment = "free"
        # Generate a free boat-transport QR token so the participant has a scannable
        # ticket on arrival. The actual scanning is handled by the existing scanner
        # logic via the visitor_registrations or corporate_participants collection.
        qr_token = uuid.uuid4().hex
        doc = {
            "id": str(uuid.uuid4()),
            "request_id": d["id"],
            "company_name": d["company_name"],
            "name": body.name.strip(),
            "surname": body.surname.strip(),
            "email": body.email.lower().strip(),
            "phone": body.phone.strip(),
            "whatsapp": (body.whatsapp or "").strip() or None,
            "nationality": body.nationality.strip(),
            "kind": body.kind,
            "payment_method": payment,
            "qr_token": qr_token,
            "notes": (body.notes or "").strip() or None,
            "registered_at": _now(),
        }
        await db.corporate_participants.insert_one(doc)
        new_count = registered + 1
        return {
            "ok": True,
            "qr_token": qr_token,
            "registered_count": new_count,
            "remaining_seats": max(d["max_participants"] - new_count, 0),
            "is_full": new_count >= d["max_participants"],
        }

    return r
