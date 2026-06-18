"""Site configuration portal — Vitrine CMS.

Provides a flexible, section-based JSON configuration store that lets the
marketing team override the public Vitrine content WITHOUT touching code :
hero title/subtitle/video, universe descriptions and images, offer prices
and texts (including the Le Kaai crossing fee), contact info, footer
content, and Instagram feed.

Schema philosophy
-----------------
Single document per ``section`` key in collection ``site_settings``.
Each document stores arbitrary JSON in the ``data`` field — the back-office
editor only writes whole sections at once, and the public ``GET /api/site/config``
returns the merged map for the frontend to consume.

A small history log (``site_settings_history``) is kept so we can audit who
changed what.

Endpoints
---------
* ``GET  /api/site/config``                  — public, returns all sections.
* ``GET  /api/staff/site/sections``          — staff list (manager+).
* ``GET  /api/staff/site/sections/{key}``    — single section.
* ``PUT  /api/staff/site/sections/{key}``    — overwrite section data.
* ``GET  /api/staff/site/history/{key}``     — last 20 changes for a section.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

log = logging.getLogger(__name__)


# ── Default sections (used to bootstrap an empty CMS) ──────────────────
DEFAULT_SECTIONS: dict[str, dict[str, Any]] = {
    "hero": {
        "kicker": "Île Boulay · Abidjan",
        "title": "LIFE IS HERE",
        "subtitle": (
            "Une île privée, à quelques minutes d'Abidjan. "
            "Un autre rythme. Une autre énergie. "
            "Des expériences premium inoubliables."
        ),
        "video_url": "https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/4d9005uu_IMG_4425.MOV",
        "poster_url": "https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/0frg347a_BBR%20_SHOOT%202_139.jpg.jpeg",
    },
    "univers": {
        "section_title": "Cinq expériences,\nune seule destination d'exception.",
        "items": [
            {
                "id": "beach-club",
                "to": "/univers/beach-club",
                "name": "Beach Club",
                "description": "Day Pass, The Sunset, B Brunch — trois rituels signature pour vivre l'île à votre rythme. Une parenthèse exclusive entre lagune et océan, ouverte sept jours sur sept.",
                "image": "https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/trz2j0jd_BEACH%20CLUB.png",
            },
            {
                "id": "hebergement",
                "to": "/univers/hebergement",
                "name": "Hébergement",
                "description": "Une nuit en suspens entre lagune et océan, dans nos suites signature. Chambres Supérieures et Suites côté jardin ou côté lagune, soins Spa & Wellness signature au bord de l'eau.",
                "image": "https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/7bcipz8w_HEBERGEMENT.png",
            },
            {
                "id": "le-kaai",
                "to": "/le-kaai",
                "name": "Restaurant Le Kaai",
                "description": "Le KAAÏ est le nouveau restaurant du BBr. Une table à l'ambition gastronomique affirmée, portée par des saveurs d'inspiration africaine contemporaine, dans une atmosphère élégante et chaleureuse.",
                "image": "https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/v2f73qqm_KAAI.png",
            },
            {
                "id": "corporate",
                "to": "/univers/corporate",
                "name": "Corporate",
                "description": "Séminaires résidentiels, journées d'étude, team building, déjeuners et dîners d'entreprise — salles équipées, vue océan, hébergement et pauses gastronomiques pour vos événements professionnels.",
                "image": "https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/oy7zzngs_SEMINAIRE.png",
            },
            {
                "id": "activites",
                "to": "/univers/activites",
                "name": "Activités & Events",
                "description": "Jet ski, paddle, kayak et plus — une journée d'activités lagunaires. Privatisations, soirées privées et expériences sur-mesure pour fédérer vos équipes ou célébrer vos grands moments.",
                "image": "https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/ocqva33h_ACTIVITE.png",
            },
        ],
    },
    "offers": {
        "hebergement": {
            "chambre_exclusive": {"name": "Chambre Exclusive", "price_xof": 75000, "description": "32 m² ouverts sur le jardin tropical. La porte d'entrée vers l'univers BBr."},
            "suite_jardin":     {"name": "Suite Jardin", "price_xof": 135000, "description": "55 m² avec coin salon, baignoire balnéo, et jardin privatif tropical."},
            "suite_lagune":     {"name": "Suite Lagune", "price_xof": 245000, "description": "80 m² face à l'eau. Piscine privée, terrasse panoramique."},
        },
        "le_kaai": {
            "dejeuner":   {"name": "Déjeuner Le Kaai", "price_xof": 18000, "description": "Menu signature 3 services, 12h–14h30."},
            "diner":      {"name": "Dîner Le Kaai", "price_xof": 35000, "description": "Menu dégustation 5 services, à partir de 19h."},
            "crossing_fee_xof": 10000,
            "crossing_fee_label": "Traversée aller-retour vers l'île Boulay (par personne)",
        },
        "beach_club": {
            "pass_day": {"name": "Day Pass", "price_xof": 35000, "description": "Journée complète au Beach Club."},
            "sunset":   {"name": "The Sunset", "price_xof": 25000, "description": "Soirée Sunset Saturday."},
            "brunch":   {"name": "B Brunch", "price_xof": 45000, "description": "Brunch dominical signature."},
        },
        "activites": {
            "jet_ski": {"name": "Jet Ski", "price_xof": 60000, "description": "30 min de jet ski sur la lagune."},
            "paddle":  {"name": "Paddle", "price_xof": 15000, "description": "1h de paddle, équipement inclus."},
            "kayak":   {"name": "Kayak", "price_xof": 12000, "description": "1h de kayak en lagune."},
        },
    },
    "contact": {
        "phone": "+225 07 04 60 06 00",
        "whatsapp": "+225 07 04 60 06 00",
        "email": "reservations@boulaybeachresort.com",
        "address_line_1": "Île Boulay",
        "address_line_2": "Abidjan, Côte d'Ivoire",
        "opening_hours": "7j/7 · 8h–22h",
    },
    "footer": {
        "show_tagline": False,
        "tagline": "",
        "newsletter_pitch": "Une fois par mois, des nouveautés et invitations privées.",
        "social_instagram": "https://www.instagram.com/boulaybeachresort",
        "social_facebook": "",
        "social_youtube": "",
    },
    "instagram": {
        "handle": "@boulaybeachresort",
        "posts": [
            {"src": "https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/4kr4z5g1_DAY%20PASS.jpeg", "caption": "Day Pass"},
            {"src": "https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/3g3onmkg_THE%20SUNSET.jpeg", "caption": "The Sunset"},
            {"src": "https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/1txrnqdp_B%20BRUNCH.jpeg", "caption": "B Brunch"},
            {"src": "https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/kgqk46mw_LE%20KAAI.jpeg", "caption": "Le Kaai"},
            {"src": "https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/ivhtbefz_BBR%20_SHOOT%202_15.jpg", "caption": "Île Boulay"},
            {"src": "https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/2hilix5p_BBR%20_SHOOT%202_29.jpg", "caption": "BBR Life"},
        ],
    },
}


class SectionUpdate(BaseModel):
    data: dict[str, Any] = Field(default_factory=dict)


def build_router(*, db, get_current_staff, require_role) -> APIRouter:
    router = APIRouter(tags=["site-settings"])

    async def _ensure_seeded():
        if await db["site_settings"].count_documents({}) > 0:
            return
        now = datetime.now(timezone.utc).isoformat()
        for key, data in DEFAULT_SECTIONS.items():
            await db["site_settings"].insert_one({
                "_id": key, "key": key, "data": data,
                "created_at": now, "updated_at": now, "updated_by": "system",
            })

    async def _load_section(key: str) -> dict[str, Any]:
        d = await db["site_settings"].find_one({"_id": key})
        if not d:
            return DEFAULT_SECTIONS.get(key, {})
        return d.get("data") or {}

    # ── Public ────────────────────────────────────────────────────────
    @router.get("/api/site/config")
    async def public_config():
        await _ensure_seeded()
        out: dict[str, Any] = {}
        async for d in db["site_settings"].find({}):
            out[d["key"]] = d.get("data") or {}
        # Fill any missing default sections (so the frontend always has them)
        for k, v in DEFAULT_SECTIONS.items():
            out.setdefault(k, v)
        return out

    # ── Staff ─────────────────────────────────────────────────────────
    @router.get("/api/staff/site/sections")
    async def staff_list(user=Depends(get_current_staff)):
        await require_role(user, ["admin", "manager", "manager_pole", "management_general"])
        await _ensure_seeded()
        items = []
        async for d in db["site_settings"].find({}):
            items.append({
                "key": d["key"],
                "updated_at": d.get("updated_at"),
                "updated_by": d.get("updated_by"),
                "data": d.get("data") or {},
            })
        items.sort(key=lambda i: i["key"])
        # Ensure every default section is represented (even if not yet in db)
        existing_keys = {i["key"] for i in items}
        for k, v in DEFAULT_SECTIONS.items():
            if k not in existing_keys:
                items.append({"key": k, "updated_at": None, "updated_by": None, "data": v})
        return {"items": items, "default_keys": list(DEFAULT_SECTIONS.keys())}

    @router.get("/api/staff/site/sections/{key}")
    async def staff_get(key: str, user=Depends(get_current_staff)):
        await require_role(user, ["admin", "manager", "manager_pole", "management_general"])
        data = await _load_section(key)
        return {"key": key, "data": data}

    @router.put("/api/staff/site/sections/{key}")
    async def staff_update(key: str, payload: SectionUpdate, user=Depends(get_current_staff)):
        await require_role(user, ["admin", "manager", "manager_pole"])
        if key not in DEFAULT_SECTIONS and not key.replace("_", "").replace("-", "").isalnum():
            raise HTTPException(status_code=400, detail="invalid_section_key")
        now = datetime.now(timezone.utc).isoformat()
        # Snapshot the previous version into history.
        previous = await db["site_settings"].find_one({"_id": key})
        if previous:
            await db["site_settings_history"].insert_one({
                "_id": str(uuid4()),
                "key": key,
                "data": previous.get("data"),
                "saved_at": previous.get("updated_at") or now,
                "saved_by": previous.get("updated_by"),
                "replaced_at": now,
                "replaced_by": user.get("email"),
            })
        await db["site_settings"].update_one(
            {"_id": key},
            {"$set": {
                "key": key,
                "data": payload.data,
                "updated_at": now,
                "updated_by": user.get("email"),
            },
             "$setOnInsert": {"created_at": now}},
            upsert=True,
        )
        return {"ok": True, "key": key, "data": payload.data}

    @router.post("/api/staff/site/sections/{key}/reset")
    async def staff_reset(key: str, user=Depends(get_current_staff)):
        """Reset a section to its hardcoded default."""
        await require_role(user, ["admin", "manager"])
        default = DEFAULT_SECTIONS.get(key)
        if default is None:
            raise HTTPException(status_code=404, detail="no_default_for_key")
        await staff_update(key, SectionUpdate(data=default), user=user)
        return {"ok": True, "key": key, "data": default}

    @router.get("/api/staff/site/history/{key}")
    async def staff_history(key: str, user=Depends(get_current_staff)):
        await require_role(user, ["admin", "manager", "manager_pole", "management_general"])
        items = []
        async for d in db["site_settings_history"].find({"key": key}).sort("replaced_at", -1).limit(20):
            d["id"] = d.pop("_id")
            items.append(d)
        return {"items": items}

    return router
