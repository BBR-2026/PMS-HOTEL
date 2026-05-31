"""Lightweight media storage backed by MongoDB.

We deliberately keep images inside MongoDB (no external S3 / CDN) so:
* persistence survives container restarts;
* zero external dependency / credentials to manage;
* deletion is a single ``deleteOne``.

Files are exposed via the public ``GET /api/media/{id}`` endpoint so email
clients (Gmail, Outlook, Yahoo) — which all block ``data:`` URLs inside
HTML emails — can fetch them over plain HTTPS.
"""
from __future__ import annotations

import base64
import hashlib
import logging
import re
import uuid
from datetime import datetime, timezone
from typing import Optional, Tuple

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response

logger = logging.getLogger(__name__)

# Hard cap to avoid DB bloat. Anything larger should be hosted on a real CDN.
MAX_UPLOAD_BYTES = 5 * 1024 * 1024  # 5 MB
ALLOWED_MIMES = {"image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"}


def _parse_data_url(data_url: str) -> Optional[Tuple[str, bytes]]:
    """Parse a ``data:image/...;base64,XXX`` URL into ``(mime, bytes)``."""
    m = re.match(r"^data:([a-zA-Z0-9/+\-\.]+);base64,(.+)$", data_url, re.DOTALL)
    if not m:
        return None
    mime = m.group(1).lower()
    try:
        raw = base64.b64decode(m.group(2))
    except Exception:
        return None
    return mime, raw


async def store_bytes(db, *, content: bytes, mime: str,
                      uploaded_by: Optional[str] = None) -> str:
    """Persist a binary blob and return its public URL (``/api/media/{id}``).

    Dedupes by SHA-256: if the same bytes were already uploaded, the existing
    media id is returned without writing a new document.
    """
    if mime not in ALLOWED_MIMES:
        raise HTTPException(status_code=400, detail=f"Type MIME non supporté : {mime}")
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Fichier trop volumineux ({len(content) // 1024} ko). Max {MAX_UPLOAD_BYTES // (1024*1024)} Mo.",
        )
    sha = hashlib.sha256(content).hexdigest()
    existing = await db.media_files.find_one({"sha256": sha}, {"_id": 0, "id": 1})
    if existing:
        return f"/api/media/{existing['id']}"
    media_id = str(uuid.uuid4())
    await db.media_files.insert_one({
        "id": media_id,
        "mime": mime,
        "size_bytes": len(content),
        "sha256": sha,
        "content_b64": base64.b64encode(content).decode(),
        "uploaded_by": uploaded_by,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return f"/api/media/{media_id}"


async def ensure_public_url(db, value: Optional[str], *,
                            uploaded_by: Optional[str] = None) -> Optional[str]:
    """Return a publicly fetchable URL for an arbitrary image-like value.

    * ``None`` / empty → ``None``
    * Already an ``http(s)://`` URL → returned untouched
    * ``data:image/...;base64,...`` → stored in ``media_files``, returned as
      ``/api/media/{id}``
    """
    if not value:
        return None
    v = value.strip()
    if not v:
        return None
    if v.startswith("http://") or v.startswith("https://") or v.startswith("/api/media/"):
        return v
    if v.startswith("data:"):
        parsed = _parse_data_url(v)
        if not parsed:
            return None
        mime, raw = parsed
        try:
            return await store_bytes(db, content=raw, mime=mime, uploaded_by=uploaded_by)
        except HTTPException:
            return None  # silently ignore — caller falls back to default hero
        except Exception as ex:
            logger.warning("Auto-migration of data: URL failed: %s", ex)
            return None
    return v


def build_router(*, db, require_role, get_current_staff,
                 public_base_url: str = "") -> APIRouter:
    router = APIRouter()

    @router.post("/staff/uploads/image")
    async def upload_image(file: UploadFile = File(...),
                           staff=Depends(get_current_staff)):
        """Upload an image and return its public URL (``/api/media/{id}``).

        The returned URL is what should be stored in the parent document
        (event ``image_url``, offer ``image_url``, etc.) so that email
        clients can fetch it without being blocked.
        """
        await require_role(staff, ["admin", "manager", "manager_pole"])
        content = await file.read()
        mime = (file.content_type or "").lower()
        rel = await store_bytes(db, content=content, mime=mime,
                                uploaded_by=staff.get("email"))
        # Return both relative and absolute so the frontend can pick whatever
        # works best for its rendering context.
        absolute = f"{public_base_url.rstrip('/')}{rel}" if public_base_url else rel
        return {"url": absolute, "relative_url": rel, "size": len(content), "mime": mime}

    @router.get("/media/{media_id}")
    async def get_media(media_id: str):
        """Public read — fetch an uploaded image."""
        doc = await db.media_files.find_one({"id": media_id}, {"_id": 0})
        if not doc:
            raise HTTPException(status_code=404, detail="Media not found")
        try:
            raw = base64.b64decode(doc.get("content_b64", ""))
        except Exception:
            raise HTTPException(status_code=500, detail="Corrupted media payload")
        # Long-lived cache: media URLs are immutable (sha-keyed).
        return Response(
            content=raw,
            media_type=doc.get("mime", "application/octet-stream"),
            headers={"Cache-Control": "public, max-age=31536000, immutable"},
        )

    return router
