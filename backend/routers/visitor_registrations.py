"""
Visitor Registrations — on-site enregistrement of arrivals on the BBR island.

The staff "Enregistrement" page captures every person who steps onto the
island via 4 categories:
  - client       → full booking flow (offers, payment, ticket)
  - personnel    → BBR staff member (free transport, no offer)
  - prestataire  → external vendor / contractor (free transport, no offer)
  - invite       → guest of guest (free transport, no offer)

For non-client kinds the system mints a free QR token tied to a programmed
traversée. The QR scans aller + retour like any other ticket.

Stats: counts per kind/day/period; lists filterable + exportable.
"""
from typing import Optional, Literal, List
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, EmailStr, Field
import uuid
import csv
import io
from datetime import datetime, timezone


VISITOR_KIND = Literal["client", "personnel", "prestataire", "invite"]


class VisitorRegistrationCreate(BaseModel):
    kind: VISITOR_KIND
    name: str = Field(min_length=1, max_length=80)
    surname: str = Field(min_length=1, max_length=80)
    email: Optional[EmailStr] = None
    phone: str = Field(min_length=4, max_length=40)
    whatsapp: Optional[str] = None
    nationality: str = Field(min_length=2, max_length=60)
    company: Optional[str] = None  # filled when prestataire or invite-of-corp
    date: str  # YYYY-MM-DD arrival date
    traversee_id: Optional[str] = None  # which programmed boat
    boat_time: Optional[str] = None  # snapshot for legacy display
    notes: Optional[str] = None


class VisitorRegistrationUpdate(BaseModel):
    name: Optional[str] = None
    surname: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    whatsapp: Optional[str] = None
    nationality: Optional[str] = None
    company: Optional[str] = None
    traversee_id: Optional[str] = None
    boat_time: Optional[str] = None
    notes: Optional[str] = None


def _now():
    return datetime.now(timezone.utc).isoformat()


def build_router(db, get_current_staff, require_role) -> APIRouter:
    r = APIRouter()

    @r.get("/staff/visitor-registrations")
    async def list_registrations(
        kind: Optional[VISITOR_KIND] = None,
        date: Optional[str] = None,
        q: Optional[str] = None,
        staff=Depends(get_current_staff),
    ):
        """List registrations with optional filters. Sorted DESC by created_at."""
        match: dict = {}
        if kind:
            match["kind"] = kind
        if date:
            match["date"] = date
        if q:
            match["$or"] = [
                {"name": {"$regex": q, "$options": "i"}},
                {"surname": {"$regex": q, "$options": "i"}},
                {"email": {"$regex": q, "$options": "i"}},
                {"phone": {"$regex": q, "$options": "i"}},
                {"company": {"$regex": q, "$options": "i"}},
            ]
        items = await db.visitor_registrations.find(match, {"_id": 0}).sort(
            "created_at", -1,
        ).to_list(length=2000)
        # Counts per kind for the header tabs
        agg = [r async for r in db.visitor_registrations.aggregate([
            {"$match": ({"date": date} if date else {})},
            {"$group": {"_id": "$kind", "count": {"$sum": 1}}},
        ])]
        counts = {k: 0 for k in ("client", "personnel", "prestataire", "invite")}
        for row in agg:
            counts[row["_id"]] = row["count"]
        return {"items": items, "counts": counts}

    @r.post("/staff/visitor-registrations")
    async def create_registration(body: VisitorRegistrationCreate, staff=Depends(get_current_staff)):
        if body.kind == "client":
            raise HTTPException(
                status_code=400,
                detail="Pour les clients, utilisez /staff/bookings (offres + paiement)",
            )
        # Validate traversée — must be 'programmé' (not en_cours / terminé)
        traversee_doc = None
        if body.traversee_id:
            traversee_doc = await db.traversees.find_one(
                {"id": body.traversee_id}, {"_id": 0},
            )
            if not traversee_doc:
                raise HTTPException(status_code=404, detail="Traversée introuvable")
            if traversee_doc.get("status") not in (None, "programmé"):
                raise HTTPException(
                    status_code=400,
                    detail="Cette traversée n'est plus disponible (en cours / terminée)",
                )

        qr_token = uuid.uuid4().hex
        doc = body.model_dump()
        doc.update({
            "id": str(uuid.uuid4()),
            "qr_token": qr_token,
            "scans": [],
            "registered_by": staff.get("email"),
            "created_at": _now(),
        })
        if traversee_doc:
            doc["boat_time"] = traversee_doc.get("depart_time")
        await db.visitor_registrations.insert_one(doc)
        return {k: v for k, v in doc.items() if k != "_id"}

    # NOTE: literal path "export.csv" must be declared BEFORE the parameterised
    # "{vid}" route, otherwise FastAPI matches "export.csv" as a vid.
    @r.get("/staff/visitor-registrations/export.csv")
    async def export_csv(
        kind: Optional[VISITOR_KIND] = None,
        date: Optional[str] = None,
        staff=Depends(get_current_staff),
    ):
        match: dict = {}
        if kind:
            match["kind"] = kind
        if date:
            match["date"] = date
        items = await db.visitor_registrations.find(match, {"_id": 0}).sort(
            "created_at", -1,
        ).to_list(length=5000)
        buf = io.StringIO()
        w = csv.writer(buf, delimiter=";")
        w.writerow(["Type", "Nom", "Prénom", "Email", "Téléphone", "WhatsApp", "Nationalité", "Entreprise", "Date", "Bateau", "Inscrit le"])
        for p in items:
            w.writerow([
                p.get("kind", ""), p.get("surname", ""), p.get("name", ""),
                p.get("email", ""), p.get("phone", ""), p.get("whatsapp", ""),
                p.get("nationality", ""), p.get("company", ""),
                p.get("date", ""), p.get("boat_time", ""),
                (p.get("created_at", "") or "")[:19].replace("T", " "),
            ])
        filename = f"enregistrements-{date or 'tous'}.csv"
        return Response(
            content=buf.getvalue().encode("utf-8-sig"),
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    @r.get("/staff/visitor-registrations/{vid}")
    async def get_registration(vid: str, staff=Depends(get_current_staff)):
        d = await db.visitor_registrations.find_one({"id": vid}, {"_id": 0})
        if not d:
            raise HTTPException(status_code=404, detail="Enregistrement introuvable")
        return d

    @r.patch("/staff/visitor-registrations/{vid}")
    async def update_registration(vid: str, body: VisitorRegistrationUpdate, staff=Depends(get_current_staff)):
        await require_role(staff, ["manager", "admin"])
        update = {k: v for k, v in body.model_dump().items() if v is not None}
        if not update:
            raise HTTPException(status_code=400, detail="Aucun champ à modifier")
        update["updated_at"] = _now()
        res = await db.visitor_registrations.update_one({"id": vid}, {"$set": update})
        if res.matched_count == 0:
            raise HTTPException(status_code=404, detail="Enregistrement introuvable")
        return {"ok": True}

    @r.delete("/staff/visitor-registrations/{vid}")
    async def delete_registration(vid: str, staff=Depends(get_current_staff)):
        await require_role(staff, ["manager", "admin"])
        res = await db.visitor_registrations.delete_one({"id": vid})
        if res.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Enregistrement introuvable")
        return {"ok": True}

    return r
