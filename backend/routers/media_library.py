"""Media Library — central asset store for marketing creatives.

Backed by **Emergent Object Storage**. Each item carries metadata (universe,
offer, type, tags, dimensions) so the back-office can quickly find a media
to push into a campaign creative slot.

Public endpoints
----------------
* ``GET  /api/media/{media_id}`` — public proxy (returns the binary).
  Files are intentionally PUBLIC since they'll also be served to ad networks
  via this URL; no auth needed for read.

Staff endpoints (manager+)
--------------------------
* ``POST   /api/staff/media-library``           — upload + create record.
* ``GET    /api/staff/media-library``           — list with filters.
* ``PATCH  /api/staff/media-library/{id}``      — edit metadata.
* ``DELETE /api/staff/media-library/{id}``      — soft-delete.
"""
from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

import requests
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import Response

log = logging.getLogger(__name__)

STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
APP_NAME = os.environ.get("APP_NAME", "boulay-beach-resort")
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")

# Allowed mime-types (image + video).
ALLOWED_MIME_PREFIXES = ("image/", "video/")
MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024  # 50 MB

_storage_key: str | None = None


def _init_storage() -> str:
    """Initialize a session-scoped storage key. Cached at module level."""
    global _storage_key
    if _storage_key:
        return _storage_key
    if not EMERGENT_KEY:
        raise HTTPException(status_code=500, detail="storage_not_configured")
    try:
        r = requests.post(
            f"{STORAGE_URL}/init",
            json={"emergent_key": EMERGENT_KEY},
            timeout=30,
        )
        r.raise_for_status()
        _storage_key = r.json()["storage_key"]
        return _storage_key
    except Exception as exc:
        log.error("storage init failed: %s", exc)
        raise HTTPException(status_code=503, detail="storage_init_failed") from exc


def _put_object(path: str, data: bytes, content_type: str) -> dict:
    key = _init_storage()
    r = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data,
        timeout=120,
    )
    if r.status_code == 403:
        # Refresh and retry once
        global _storage_key
        _storage_key = None
        key = _init_storage()
        r = requests.put(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key, "Content-Type": content_type},
            data=data,
            timeout=120,
        )
    r.raise_for_status()
    return r.json()


def _get_object(path: str) -> tuple[bytes, str]:
    key = _init_storage()
    r = requests.get(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key},
        timeout=60,
    )
    if r.status_code == 403:
        global _storage_key
        _storage_key = None
        key = _init_storage()
        r = requests.get(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key},
            timeout=60,
        )
    r.raise_for_status()
    return r.content, r.headers.get("Content-Type", "application/octet-stream")


def build_router(*, db, get_current_staff, require_role) -> APIRouter:
    router = APIRouter(tags=["media-library"])

    # ── Public read (no auth) ────────────────────────────────────────
    @router.get("/api/media-library/{media_id}")
    async def public_get_media(media_id: str):
        d = await db["media_library"].find_one({"_id": media_id, "is_deleted": {"$ne": True}})
        if not d:
            raise HTTPException(status_code=404, detail="not_found")
        try:
            data, content_type = _get_object(d["storage_path"])
        except Exception as exc:  # noqa: BLE001
            log.error("get_object failed for %s: %s", d["storage_path"], exc)
            raise HTTPException(status_code=502, detail="storage_read_failed") from exc
        return Response(
            content=data,
            media_type=d.get("content_type") or content_type,
            headers={"Cache-Control": "public, max-age=31536000, immutable"},
        )

    # ── Staff list ───────────────────────────────────────────────────
    @router.get("/api/staff/media-library")
    async def list_media(
        universe: str | None = Query(default=None),
        offer: str | None = Query(default=None),
        kind: str | None = Query(default=None, pattern="^(image|video)$"),
        tag: str | None = Query(default=None),
        q: str | None = Query(default=None),
        limit: int = Query(default=100, ge=1, le=500),
        user=Depends(get_current_staff),
    ):
        await require_role(user, ["admin", "manager", "manager_pole", "management_general"])
        filt: dict[str, Any] = {"is_deleted": {"$ne": True}}
        if universe:
            filt["universe"] = universe
        if offer:
            filt["offer"] = offer
        if kind:
            filt["kind"] = kind
        if tag:
            filt["tags"] = tag
        if q:
            import re
            rx = {"$regex": re.escape(q), "$options": "i"}
            filt["$or"] = [{"original_filename": rx}, {"label": rx}]
        items = []
        async for d in db["media_library"].find(filt).sort("created_at", -1).limit(limit):
            d["id"] = d.pop("_id")
            d["url"] = f"/api/media-library/{d['id']}"
            items.append(d)
        return {"items": items}

    # ── Staff upload ─────────────────────────────────────────────────
    @router.post("/api/staff/media-library")
    async def upload_media(
        file: UploadFile = File(...),
        universe: str = Form(default=""),
        offer: str = Form(default=""),
        label: str = Form(default=""),
        tags: str = Form(default=""),  # comma-separated
        user=Depends(get_current_staff),
    ):
        await require_role(user, ["admin", "manager", "manager_pole"])

        ct = file.content_type or "application/octet-stream"
        if not any(ct.startswith(p) for p in ALLOWED_MIME_PREFIXES):
            raise HTTPException(status_code=400, detail="invalid_content_type")

        data = await file.read()
        if len(data) > MAX_FILE_SIZE_BYTES:
            raise HTTPException(status_code=413, detail="file_too_large")

        ext = (file.filename or "").rsplit(".", 1)[-1].lower() if "." in (file.filename or "") else "bin"
        media_id = str(uuid4())
        path = f"{APP_NAME}/media/{media_id}.{ext}"
        try:
            result = _put_object(path, data, ct)
        except HTTPException:
            raise
        except Exception as exc:  # noqa: BLE001
            log.error("upload failed: %s", exc)
            raise HTTPException(status_code=502, detail="storage_write_failed") from exc

        kind = "image" if ct.startswith("image/") else "video"
        tag_list = [t.strip() for t in (tags or "").split(",") if t.strip()]
        now = datetime.now(timezone.utc).isoformat()
        doc = {
            "_id": media_id,
            "storage_path": result["path"],
            "original_filename": file.filename,
            "content_type": ct,
            "size": result.get("size") or len(data),
            "kind": kind,
            "universe": (universe or "").strip() or None,
            "offer": (offer or "").strip() or None,
            "label": (label or "").strip() or None,
            "tags": tag_list,
            "is_deleted": False,
            "created_at": now,
            "uploaded_by": user.get("email"),
        }
        await db["media_library"].insert_one(doc)
        doc["id"] = doc.pop("_id")
        doc["url"] = f"/api/media-library/{doc['id']}"
        return doc

    @router.patch("/api/staff/media-library/{media_id}")
    async def update_media(media_id: str, body: dict, user=Depends(get_current_staff)):
        await require_role(user, ["admin", "manager", "manager_pole"])
        allowed = {"universe", "offer", "label", "tags"}
        updates = {k: v for k, v in body.items() if k in allowed}
        if not updates:
            raise HTTPException(status_code=400, detail="nothing_to_update")
        updates["updated_at"] = datetime.now(timezone.utc).isoformat()
        r = await db["media_library"].update_one({"_id": media_id}, {"$set": updates})
        if r.matched_count == 0:
            raise HTTPException(status_code=404, detail="not_found")
        return {"ok": True}

    @router.delete("/api/staff/media-library/{media_id}")
    async def delete_media(media_id: str, user=Depends(get_current_staff)):
        await require_role(user, ["admin", "manager"])
        r = await db["media_library"].update_one(
            {"_id": media_id},
            {"$set": {"is_deleted": True,
                      "deleted_at": datetime.now(timezone.utc).isoformat()}},
        )
        if r.matched_count == 0:
            raise HTTPException(status_code=404, detail="not_found")
        return {"ok": True}

    return router
