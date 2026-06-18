"""Marketing campaigns CRUD — Phase C (Vague 1) of the Revenue Engine.

A campaign represents a marketing push for ONE offer of ONE universe with
budget, dates, objective and a status (draft / active / paused / ended).
Each campaign can hold many creatives in dedicated formats (Meta 1080×1080,
Google 1200×628, YouTube thumbnails, etc.) that reference items already
stored in the Media Library.

Mounted under ``/api/staff/marketing/campaigns``. Manager+ access.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

log = logging.getLogger(__name__)


# Universe → list of well-known offers (used by the frontend dropdown).
# This is intentionally NOT hard-enforced by the API so staff can type
# free-text offer names if needed.
UNIVERSES: dict[str, list[str]] = {
    "beach_club": ["Day Pass", "Sunset Experience", "Brunch"],
    "hebergement": ["Chambre Exclusive", "Suite Jardin", "Suite Lagune"],
    "le_kaai": ["Déjeuner", "Dîner", "Événement gastronomique"],
    "corporate": ["Séminaire", "Team Building", "Privatisation"],
    "activites_events": ["Événement spécial", "Activité nautique", "Activité sportive"],
}

OBJECTIVES = [
    "reservations",
    "leads",
    "traffic",
    "booking_restaurant",
    "booking_hebergement",
    "awareness",
]

# Recognized creative format slugs → {channel, width, height}.
CREATIVE_FORMATS: dict[str, dict[str, Any]] = {
    # Meta Ads
    "meta_square":     {"channel": "meta",   "width": 1080, "height": 1080, "label": "Meta · Carré"},
    "meta_portrait":   {"channel": "meta",   "width": 1080, "height": 1350, "label": "Meta · Portrait"},
    "meta_story":      {"channel": "meta",   "width": 1080, "height": 1920, "label": "Meta · Story"},
    # Google Display
    "google_billboard":{"channel": "google", "width": 1200, "height":  628, "label": "Google · Billboard"},
    "google_mrec":     {"channel": "google", "width":  300, "height":  250, "label": "Google · MREC"},
    "google_lrec":     {"channel": "google", "width":  336, "height":  280, "label": "Google · Large Rect."},
    "google_leader":   {"channel": "google", "width":  728, "height":   90, "label": "Google · Leaderboard"},
    "google_billbig":  {"channel": "google", "width":  970, "height":  250, "label": "Google · Billboard XL"},
    # YouTube
    "yt_thumbnail":    {"channel": "youtube","width": 1280, "height":  720, "label": "YouTube · Miniature"},
    "yt_vertical":     {"channel": "youtube","width": 1080, "height": 1920, "label": "YouTube · Verticale"},
    "yt_horizontal":   {"channel": "youtube","width": 1920, "height": 1080, "label": "YouTube · Horizontale"},
}

STATUSES = ["draft", "active", "paused", "ended"]


class CampaignIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    universe: str
    offer: str = Field(min_length=1, max_length=200)
    start_date: str   # ISO date YYYY-MM-DD
    end_date: str
    budget_total: float = Field(ge=0)
    budget_daily: float = Field(ge=0)
    objective: str
    status: str = "draft"
    notes: str | None = Field(default=None, max_length=2000)
    audience_targets: list[str] | None = Field(default=None, max_length=20)
    audience_notes: str | None = Field(default=None, max_length=2000)


class CreativeIn(BaseModel):
    format: str  # key in CREATIVE_FORMATS
    media_id: str | None = None     # reference to media_library item
    media_url: str | None = None    # convenience copy
    label: str | None = Field(default=None, max_length=200)


def build_router(*, db, get_current_staff, require_role) -> APIRouter:
    router = APIRouter(prefix="/api/staff/marketing", tags=["marketing-campaigns"])

    # ── Meta endpoints (used by frontend to render selects) ─────────
    @router.get("/meta/universes")
    async def list_universes(user=Depends(get_current_staff)):
        await require_role(user, ["admin", "manager", "manager_pole", "management_general"])
        return {
            "universes": UNIVERSES,
            "objectives": OBJECTIVES,
            "creative_formats": CREATIVE_FORMATS,
            "statuses": STATUSES,
        }

    # ── Campaigns CRUD ─────────────────────────────────────────────
    @router.get("/campaigns")
    async def list_campaigns(
        status: str | None = Query(default=None),
        universe: str | None = Query(default=None),
        user=Depends(get_current_staff),
    ):
        await require_role(user, ["admin", "manager", "manager_pole", "management_general"])
        filt: dict[str, Any] = {}
        if status:
            filt["status"] = status
        if universe:
            filt["universe"] = universe
        items = []
        async for d in db["marketing_campaigns"].find(filt).sort("created_at", -1):
            d["id"] = d.pop("_id")
            items.append(d)
        # Aggregate counters
        counts: dict[str, int] = {s: 0 for s in STATUSES}
        async for r in db["marketing_campaigns"].aggregate([
            {"$group": {"_id": "$status", "n": {"$sum": 1}}},
        ]):
            if r["_id"] in counts:
                counts[r["_id"]] = r["n"]
        return {"items": items, "counts": counts}

    @router.post("/campaigns")
    async def create_campaign(payload: CampaignIn, user=Depends(get_current_staff)):
        await require_role(user, ["admin", "manager", "manager_pole"])
        if payload.universe not in UNIVERSES:
            raise HTTPException(status_code=400, detail="invalid_universe")
        if payload.objective not in OBJECTIVES:
            raise HTTPException(status_code=400, detail="invalid_objective")
        if payload.status not in STATUSES:
            raise HTTPException(status_code=400, detail="invalid_status")
        now = datetime.now(timezone.utc).isoformat()
        doc = {
            "_id": str(uuid4()),
            **payload.model_dump(),
            "creatives": [],
            "created_at": now,
            "updated_at": now,
            "created_by": user.get("email"),
        }
        await db["marketing_campaigns"].insert_one(doc)
        doc["id"] = doc.pop("_id")
        return doc

    @router.get("/campaigns/{cid}")
    async def get_campaign(cid: str, user=Depends(get_current_staff)):
        await require_role(user, ["admin", "manager", "manager_pole", "management_general"])
        d = await db["marketing_campaigns"].find_one({"_id": cid})
        if not d:
            raise HTTPException(status_code=404, detail="not_found")
        d["id"] = d.pop("_id")
        return d

    @router.patch("/campaigns/{cid}")
    async def update_campaign(cid: str, body: dict, user=Depends(get_current_staff)):
        await require_role(user, ["admin", "manager", "manager_pole"])
        allowed = {"name", "universe", "offer", "start_date", "end_date",
                   "budget_total", "budget_daily", "objective", "status", "notes",
                   "audience_targets", "audience_notes"}
        updates = {k: v for k, v in body.items() if k in allowed}
        if "universe" in updates and updates["universe"] not in UNIVERSES:
            raise HTTPException(status_code=400, detail="invalid_universe")
        if "objective" in updates and updates["objective"] not in OBJECTIVES:
            raise HTTPException(status_code=400, detail="invalid_objective")
        if "status" in updates and updates["status"] not in STATUSES:
            raise HTTPException(status_code=400, detail="invalid_status")
        if not updates:
            raise HTTPException(status_code=400, detail="nothing_to_update")
        updates["updated_at"] = datetime.now(timezone.utc).isoformat()
        updates["updated_by"] = user.get("email")
        r = await db["marketing_campaigns"].update_one({"_id": cid}, {"$set": updates})
        if r.matched_count == 0:
            raise HTTPException(status_code=404, detail="not_found")
        return {"ok": True}

    @router.delete("/campaigns/{cid}")
    async def delete_campaign(cid: str, user=Depends(get_current_staff)):
        await require_role(user, ["admin", "manager"])
        r = await db["marketing_campaigns"].delete_one({"_id": cid})
        if r.deleted_count == 0:
            raise HTTPException(status_code=404, detail="not_found")
        return {"ok": True}

    # ── Creatives sub-resource ─────────────────────────────────────
    @router.post("/campaigns/{cid}/creatives")
    async def add_creative(cid: str, payload: CreativeIn, user=Depends(get_current_staff)):
        await require_role(user, ["admin", "manager", "manager_pole"])
        if payload.format not in CREATIVE_FORMATS:
            raise HTTPException(status_code=400, detail="invalid_format")
        creative = {
            "id": str(uuid4()),
            "format": payload.format,
            "media_id": payload.media_id,
            "media_url": payload.media_url,
            "label": payload.label,
            "added_at": datetime.now(timezone.utc).isoformat(),
            "added_by": user.get("email"),
        }
        r = await db["marketing_campaigns"].update_one(
            {"_id": cid},
            {"$push": {"creatives": creative},
             "$set": {"updated_at": creative["added_at"]}},
        )
        if r.matched_count == 0:
            raise HTTPException(status_code=404, detail="not_found")
        return creative

    @router.delete("/campaigns/{cid}/creatives/{creative_id}")
    async def remove_creative(cid: str, creative_id: str, user=Depends(get_current_staff)):
        await require_role(user, ["admin", "manager", "manager_pole"])
        r = await db["marketing_campaigns"].update_one(
            {"_id": cid},
            {"$pull": {"creatives": {"id": creative_id}},
             "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}},
        )
        if r.matched_count == 0:
            raise HTTPException(status_code=404, detail="not_found")
        return {"ok": True}

    # ── Acquisition Engine: offers ←→ campaigns grouping ──────────
    @router.get("/acquisition")
    async def acquisition_overview(user=Depends(get_current_staff)):
        """Aggregate all campaigns grouped by offer key (universe + offer).
        Returns one entry per offer with its active/paused/draft counts and
        total committed budgets. Useful for the 'one offer = one permanent
        campaign' dashboard view.
        """
        await require_role(user, ["admin", "manager", "manager_pole", "management_general"])
        groups: dict[str, dict[str, Any]] = {}
        async for c in db["marketing_campaigns"].find({}):
            key = f"{c.get('universe')}::{c.get('offer')}"
            g = groups.setdefault(key, {
                "universe": c.get("universe"),
                "offer": c.get("offer"),
                "campaigns": [],
                "active": 0, "paused": 0, "draft": 0, "ended": 0,
                "budget_total": 0.0, "budget_daily": 0.0,
                "creatives_count": 0,
            })
            g["campaigns"].append({
                "id": c["_id"],
                "name": c.get("name"),
                "status": c.get("status"),
                "start_date": c.get("start_date"),
                "end_date": c.get("end_date"),
                "budget_total": c.get("budget_total", 0),
                "budget_daily": c.get("budget_daily", 0),
                "objective": c.get("objective"),
                "creatives": len(c.get("creatives") or []),
            })
            st = c.get("status", "draft")
            if st in g:
                g[st] += 1
            g["budget_total"] += float(c.get("budget_total") or 0)
            g["budget_daily"] += float(c.get("budget_daily") or 0)
            g["creatives_count"] += len(c.get("creatives") or [])
        # Inject offers that have NO campaign yet (so staff sees the universe-offer matrix)
        for uni, offers in UNIVERSES.items():
            for off in offers:
                key = f"{uni}::{off}"
                if key not in groups:
                    groups[key] = {
                        "universe": uni, "offer": off, "campaigns": [],
                        "active": 0, "paused": 0, "draft": 0, "ended": 0,
                        "budget_total": 0.0, "budget_daily": 0.0,
                        "creatives_count": 0,
                    }
        items = list(groups.values())
        items.sort(key=lambda i: (i["universe"], -i["active"], i["offer"]))
        return {"items": items}

    return router
