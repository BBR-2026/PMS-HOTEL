"""Single-document site configuration (footer email, livret BBR PDF).

Only `admin` and `manager` can read/write. The document is auto-seeded with
sensible defaults on first read so the UI never has to handle the "empty"
state. The livret file itself is stored in the existing `media` collection
(re-using upload helpers from routers.media) and referenced here by id.
"""
from __future__ import annotations

import base64
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile
from pydantic import BaseModel, Field

log = logging.getLogger(__name__)

DOC_ID = "default"

DEFAULT_FOOTER_HTML = (
    '<div style="text-align:center;line-height:1.85;font-size:14px;">'
    '<div style="font-weight:700;letter-spacing:0.18em;font-size:13px;text-transform:uppercase;margin-bottom:14px;">Life Is Here</div>'
    '<a href="tel:+22507174000400" style="color:inherit;text-decoration:none;">+225 07 17 400 400</a><br/>'
    '<a href="tel:+22507046000600" style="color:inherit;text-decoration:none;">+225 07 04 600 600</a><br/>'
    '<a href="https://instagram.com/boulaybeachresort" style="color:inherit;text-decoration:none;">@BoulayBeachResort</a><br/>'
    '<a href="https://workflow-boulaybeachresort.com" style="color:inherit;text-decoration:none;">boulaybeachresort.com</a>'
    '</div>'
    '<div style="text-align:center;font-size:12px;line-height:1.6;letter-spacing:0.04em;opacity:0.85;margin:20px 0 0;">'
    'Embarquement dès 11H · Départ toutes les heures'
    '</div>'
)


class SiteConfigUpdate(BaseModel):
    email_footer_html: Optional[str] = Field(default=None, max_length=20_000)
    livret_enabled: Optional[bool] = None  # toggle "attach livret to confirmation emails"


async def get_or_create_site_config(db) -> dict:
    """Return the singleton config doc, creating it on first call."""
    doc = await db.site_config.find_one({"_id": DOC_ID}, {"_id": 0})
    if doc:
        return doc
    seed = {
        "_id": DOC_ID,
        "email_footer_html": DEFAULT_FOOTER_HTML,
        "livret_media_id": None,
        "livret_filename": None,
        "livret_size": 0,
        "livret_enabled": True,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": None,
    }
    await db.site_config.insert_one(seed)
    seed.pop("_id", None)
    return seed


def build_site_config_router(*, db, require_role, get_current_staff) -> APIRouter:
    router = APIRouter()

    @router.get("/staff/site-config")
    async def staff_get(staff=Depends(get_current_staff)):
        await require_role(staff, ["admin", "manager", "manager_pole", "management_general"])
        return await get_or_create_site_config(db)

    @router.patch("/staff/site-config")
    async def staff_patch(body: SiteConfigUpdate, staff=Depends(get_current_staff)):
        await require_role(staff, ["admin", "manager"])
        update = {k: v for k, v in body.model_dump(exclude_none=True).items()}
        if not update:
            raise HTTPException(status_code=400, detail="Aucun champ à mettre à jour")
        update["updated_at"] = datetime.now(timezone.utc).isoformat()
        update["updated_by"] = staff.get("email")
        await db.site_config.update_one(
            {"_id": DOC_ID}, {"$set": update}, upsert=True,
        )
        return await get_or_create_site_config(db)

    @router.post("/staff/site-config/livret")
    async def staff_upload_livret(
        file: UploadFile = File(...), staff=Depends(get_current_staff)
    ):
        await require_role(staff, ["admin", "manager"])
        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="Fichier vide")
        if len(content) > 15 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="Le livret dépasse 15 Mo")
        if not (file.filename or "").lower().endswith(".pdf"):
            raise HTTPException(status_code=400, detail="Seul le format PDF est accepté")
        media_id = f"livret_{uuid.uuid4().hex[:10]}"
        media_doc = {
            "id": media_id,
            "kind": "livret",
            "filename": file.filename,
            "mime": "application/pdf",
            "size": len(content),
            "data_b64": base64.b64encode(content).decode("ascii"),
            "uploaded_by": staff.get("email"),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.media.insert_one(media_doc)
        await db.site_config.update_one(
            {"_id": DOC_ID},
            {"$set": {
                "livret_media_id": media_id,
                "livret_filename": file.filename,
                "livret_size": len(content),
                "livret_enabled": True,
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "updated_by": staff.get("email"),
            }},
            upsert=True,
        )
        return await get_or_create_site_config(db)

    @router.delete("/staff/site-config/livret")
    async def staff_remove_livret(staff=Depends(get_current_staff)):
        await require_role(staff, ["admin", "manager"])
        cfg = await get_or_create_site_config(db)
        old = cfg.get("livret_media_id")
        if old:
            await db.media.delete_one({"id": old})
        await db.site_config.update_one(
            {"_id": DOC_ID},
            {"$set": {
                "livret_media_id": None,
                "livret_filename": None,
                "livret_size": 0,
                "livret_enabled": False,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }},
        )
        return await get_or_create_site_config(db)

    @router.get("/site-config/livret")
    async def public_get_livret():
        """Public endpoint — streams the configured livret PDF for download links
        embedded in emails. Returns 404 when no livret is configured."""
        cfg = await get_or_create_site_config(db)
        media_id = cfg.get("livret_media_id")
        if not media_id:
            raise HTTPException(status_code=404, detail="Aucun livret configuré")
        media = await db.media.find_one({"id": media_id}, {"_id": 0})
        if not media:
            raise HTTPException(status_code=404, detail="Livret introuvable")
        try:
            content = base64.b64decode(media["data_b64"])
        except Exception:
            raise HTTPException(status_code=500, detail="Livret corrompu")
        filename = media.get("filename") or "livret-bbr.pdf"
        return Response(
            content=content,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'inline; filename="{filename}"',
                "Cache-Control": "public, max-age=300",
            },
        )

    return router


async def fetch_livret_attachment(db) -> Optional[dict]:
    """Helper used by the email sender: returns a SendGrid-style attachment
    dict (bytes + filename + mime) or None when no livret is configured /
    enabled."""
    cfg = await get_or_create_site_config(db)
    if not cfg.get("livret_enabled"):
        return None
    media_id = cfg.get("livret_media_id")
    if not media_id:
        return None
    media = await db.media.find_one({"id": media_id}, {"_id": 0})
    if not media:
        return None
    try:
        content = base64.b64decode(media["data_b64"])
    except Exception:
        return None
    return {
        "content": content,
        "filename": media.get("filename") or "livret-bbr.pdf",
        "mime": "application/pdf",
        "disposition": "attachment",
    }


async def fetch_email_footer_html(db) -> str:
    cfg = await get_or_create_site_config(db)
    html = (cfg.get("email_footer_html") or "").strip()
    return html or DEFAULT_FOOTER_HTML
