"""
Loisirs Activities — CRUD for sub-offers within the "Activités & Événements" pôle.

Each activity (e.g. Jet Ski 30 min, Paddle, Bouée tractée) is a standalone
priceable item with capacity + duration + active flag. The public catalog
endpoint feeds the booking tunnel; the staff CRUD lets managers create / edit
/ delete / re-sort the activities without redeploying.
"""
from typing import Optional, Literal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
import uuid
from datetime import datetime, timezone


class LoisirActivity(BaseModel):
    name_fr: str = Field(min_length=2, max_length=120)
    name_en: Optional[str] = None
    description_fr: Optional[str] = None
    image_url: Optional[str] = None  # public URL or /api/media/{id} of the activity photo
    price_adult: int = Field(ge=0)
    price_child: int = Field(default=0, ge=0)
    duration_min: int = Field(default=30, ge=5, le=480)
    capacity: int = Field(default=10, ge=1, le=200)
    category: Optional[str] = "Loisir"  # free-form group label
    is_active: bool = True
    sort_order: int = 0


class LoisirActivityUpdate(BaseModel):
    name_fr: Optional[str] = None
    name_en: Optional[str] = None
    description_fr: Optional[str] = None
    image_url: Optional[str] = None
    price_adult: Optional[int] = Field(default=None, ge=0)
    price_child: Optional[int] = Field(default=None, ge=0)
    duration_min: Optional[int] = Field(default=None, ge=5, le=480)
    capacity: Optional[int] = Field(default=None, ge=1, le=200)
    category: Optional[str] = None
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None


def build_router(db, get_current_staff, require_role) -> APIRouter:
    r = APIRouter()

    def _now():
        return datetime.now(timezone.utc).isoformat()

    @r.get("/loisirs-activities")
    async def list_public():
        """Public catalog of active activities, used by the booking tunnel."""
        items = await db.loisirs_activities.find(
            {"is_active": True}, {"_id": 0},
        ).sort([("sort_order", 1), ("name_fr", 1)]).to_list(length=500)
        return items

    @r.get("/staff/loisirs-activities")
    async def list_staff(staff=Depends(get_current_staff)):
        items = await db.loisirs_activities.find({}, {"_id": 0}).sort(
            [("sort_order", 1), ("name_fr", 1)],
        ).to_list(length=500)
        return {"items": items}

    @r.post("/staff/loisirs-activities")
    async def create(body: LoisirActivity, staff=Depends(get_current_staff)):
        await require_role(staff, ["manager", "admin"])
        doc = body.model_dump()
        doc["id"] = str(uuid.uuid4())
        doc["created_at"] = _now()
        await db.loisirs_activities.insert_one(doc)
        return {k: v for k, v in doc.items() if k != "_id"}

    @r.patch("/staff/loisirs-activities/{activity_id}")
    async def update(activity_id: str, body: LoisirActivityUpdate, staff=Depends(get_current_staff)):
        await require_role(staff, ["manager", "admin"])
        update = {k: v for k, v in body.model_dump().items() if v is not None}
        if not update:
            raise HTTPException(status_code=400, detail="Aucun champ à modifier")
        update["updated_at"] = _now()
        res = await db.loisirs_activities.update_one({"id": activity_id}, {"$set": update})
        if res.matched_count == 0:
            raise HTTPException(status_code=404, detail="Activité introuvable")
        return {"ok": True}

    @r.delete("/staff/loisirs-activities/{activity_id}")
    async def delete(activity_id: str, staff=Depends(get_current_staff)):
        await require_role(staff, ["admin"])
        res = await db.loisirs_activities.delete_one({"id": activity_id})
        if res.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Activité introuvable")
        return {"ok": True}

    return r
