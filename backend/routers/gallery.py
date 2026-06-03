"""Public photo gallery — organised by event (Beach Club, B Brunch, etc.).

Albums are *virtual* (derived from the OFFERS catalog + published
special_events) so we don't have to manage a separate "album" collection.
Each upload is persisted as a row in ``gallery_images`` linked to an
``album_id`` (e.g. ``pass_day`` or ``event:<uuid>``). Bytes are stored via
the existing :mod:`media` router so the gallery inherits dedup + GridFS-like
fetch via ``GET /api/media/{id}``.
"""
from __future__ import annotations

import base64
import hashlib
import io
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile

logger = logging.getLogger(__name__)

# Generous cap — gallery photos can legitimately reach a dozen MB. Anything
# heavier should be resized client-side before upload.
MAX_GALLERY_BYTES = 20 * 1024 * 1024  # 20 MB
ALLOWED_GALLERY_MIMES = {"image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"}


def _generate_thumbnail(content: bytes, mime: str) -> Optional[bytes]:
    """Build a square-ish 600px-wide JPEG thumbnail. Returns None on failure
    (thumbnail is optional — full-size image is always available).
    """
    try:
        from PIL import Image
        img = Image.open(io.BytesIO(content))
        img = img.convert("RGB")  # drop alpha / palette for clean JPEG output
        # Auto-rotate based on EXIF so thumbnails respect device orientation
        try:
            from PIL import ImageOps
            img = ImageOps.exif_transpose(img)
        except Exception:
            pass
        img.thumbnail((1200, 1200), Image.LANCZOS)
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=82, optimize=True)
        return buf.getvalue()
    except Exception as exc:
        logger.warning("Thumbnail generation failed: %s", exc)
        return None


def build_gallery_router(db, OFFERS: dict, get_current_staff, require_role) -> APIRouter:
    """Factory mirroring the pattern used by `corporate.py` / `registrations.py`."""
    router = APIRouter(tags=["gallery"])

    # ---------- helpers ----------
    async def _resolve_album_label(album_id: str) -> Optional[dict]:
        """Return ``{"id", "label", "kind", "image_url"}`` for the given album,
        or ``None`` if it doesn't match any existing custom album.

        Albums are 100% manual now: only entries in ``gallery_albums`` are
        served. The legacy ``offer:*`` / ``event:*`` virtual albums are no
        longer exposed (their photos remain in the DB but are hidden).
        """
        # Custom albums use either ``custom:{id}`` (new) or just ``{id}`` (older
        # uploads created before the prefix was introduced).
        cid = album_id.split(":", 1)[1] if album_id.startswith("custom:") else album_id
        doc = await db.gallery_albums.find_one(
            {"id": cid}, {"_id": 0, "id": 1, "label": 1, "cover_url": 1},
        )
        if not doc:
            return None
        return {
            "id": f"custom:{cid}",
            "label": doc["label"],
            "kind": "custom",
            "image_url": doc.get("cover_url") or "",
        }

    async def _list_known_albums() -> list:
        """Return only custom albums created by staff."""
        albums = []
        custom_cursor = db.gallery_albums.find(
            {}, {"_id": 0, "id": 1, "label": 1, "cover_url": 1, "created_at": 1},
        ).sort("created_at", -1)
        async for doc in custom_cursor:
            albums.append({
                "id": f"custom:{doc['id']}",
                "label": doc["label"],
                "kind": "custom",
                "image_url": doc.get("cover_url") or "",
            })
        return albums

    # ============== PUBLIC ENDPOINTS ==============
    @router.get("/gallery/albums")
    async def list_albums():
        """List every album with photo count + most recent photo as cover."""
        albums = await _list_known_albums()
        # Per-album stats — single aggregate to keep it fast
        agg_cursor = db.gallery_images.aggregate([
            {"$group": {
                "_id": "$album_id",
                "count": {"$sum": 1},
                "latest_url": {"$first": "$url"},
                "latest_at": {"$max": "$uploaded_at"},
            }},
        ])
        stats: dict = {}
        async for row in agg_cursor:
            stats[row["_id"]] = row
        for a in albums:
            s = stats.get(a["id"]) or {}
            a["photo_count"] = int(s.get("count", 0))
            # Cover priority: most recent uploaded photo → fall back to the
            # offer hero image so empty albums still look polished on the grid.
            a["cover_url"] = s.get("latest_url") or a["image_url"] or ""
            a["latest_at"] = s.get("latest_at")
        # Sort: non-empty albums first, then alpha
        albums.sort(key=lambda x: (x["photo_count"] == 0, x["label"].lower()))
        return {"albums": albums}

    @router.get("/gallery/albums/{album_id:path}")
    async def list_album_images(
        album_id: str,
        page: int = Query(1, ge=1),
        limit: int = Query(40, ge=1, le=200),
    ):
        """Paginated list of images for one album. Public — no auth required."""
        meta = await _resolve_album_label(album_id)
        if not meta:
            raise HTTPException(status_code=404, detail="Album introuvable")
        filt = {"album_id": album_id}
        total = await db.gallery_images.count_documents(filt)
        cursor = (
            db.gallery_images.find(filt, {"_id": 0})
            .sort("uploaded_at", -1)
            .skip((page - 1) * limit)
            .limit(limit)
        )
        items = await cursor.to_list(length=limit)
        return {
            "album": meta,
            "total": total,
            "page": page,
            "limit": limit,
            "items": items,
        }

    # ============== STAFF ENDPOINTS ==============
    @router.post("/staff/gallery/upload")
    async def staff_upload_photo(
        album_id: str = Form(...),
        file: UploadFile = File(...),
        staff=Depends(get_current_staff),
    ):
        """Upload a single photo into an album. Album must already exist in the
        catalog (offer key or ``event:<uuid>`` of a published special event).
        Files are deduped by SHA-256 across the whole gallery.
        """
        await require_role(staff, [
            "admin", "manager", "manager_pole", "management_general",
        ])
        meta = await _resolve_album_label(album_id)
        if not meta:
            raise HTTPException(status_code=400, detail="Album inconnu")
        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="Fichier vide")
        if len(content) > MAX_GALLERY_BYTES:
            raise HTTPException(
                status_code=413,
                detail=f"Fichier trop volumineux ({len(content) // 1024} ko). Max {MAX_GALLERY_BYTES // (1024*1024)} Mo.",
            )
        mime = (file.content_type or "").lower()
        if mime not in ALLOWED_GALLERY_MIMES:
            raise HTTPException(status_code=400, detail=f"Format non supporté : {mime or 'inconnu'}")

        # Dedup: full-size by SHA-256
        sha = hashlib.sha256(content).hexdigest()
        existing_media = await db.gallery_media.find_one({"sha256": sha}, {"_id": 0, "id": 1})
        if existing_media:
            media_id = existing_media["id"]
            full_url = f"/api/gallery/file/{media_id}"
        else:
            media_id = str(uuid.uuid4())
            await db.gallery_media.insert_one({
                "id": media_id,
                "mime": mime,
                "size_bytes": len(content),
                "sha256": sha,
                "content_b64": base64.b64encode(content).decode(),
                "uploaded_by": staff.get("email") if isinstance(staff, dict) else None,
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
            full_url = f"/api/gallery/file/{media_id}"

        # Generate thumbnail (optional, best-effort)
        thumb_id = None
        thumb_url = None
        thumb_bytes = _generate_thumbnail(content, mime)
        if thumb_bytes:
            thumb_sha = hashlib.sha256(thumb_bytes).hexdigest()
            existing_thumb = await db.gallery_media.find_one({"sha256": thumb_sha}, {"_id": 0, "id": 1})
            if existing_thumb:
                thumb_id = existing_thumb["id"]
            else:
                thumb_id = str(uuid.uuid4())
                await db.gallery_media.insert_one({
                    "id": thumb_id,
                    "mime": "image/jpeg",
                    "size_bytes": len(thumb_bytes),
                    "sha256": thumb_sha,
                    "content_b64": base64.b64encode(thumb_bytes).decode(),
                    "uploaded_by": staff.get("email") if isinstance(staff, dict) else None,
                    "is_thumbnail": True,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                })
            thumb_url = f"/api/gallery/file/{thumb_id}"

        image_id = str(uuid.uuid4())
        doc = {
            "id": image_id,
            "album_id": album_id,
            "media_id": media_id,
            "thumb_media_id": thumb_id,
            "url": full_url,
            "thumb_url": thumb_url or full_url,
            "filename": file.filename or "photo.jpg",
            "mime": mime,
            "size_bytes": len(content),
            "uploaded_at": datetime.now(timezone.utc).isoformat(),
            "uploaded_by": staff.get("email") if isinstance(staff, dict) else None,
        }
        await db.gallery_images.insert_one({**doc})
        doc.pop("_id", None)
        return doc

    @router.delete("/staff/gallery/{image_id}")
    async def staff_delete_photo(image_id: str, staff=Depends(get_current_staff)):
        """Hard-delete a single image. The underlying bytes in ``gallery_media``
        are kept (cheap; could be GC'd later if no other image references them).
        """
        await require_role(staff, ["admin", "manager"])
        res = await db.gallery_images.delete_one({"id": image_id})
        if res.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Image introuvable")
        return {"ok": True}

    # ============== CUSTOM ALBUMS (staff CRUD) ==============
    @router.post("/staff/gallery/albums")
    async def staff_create_album(payload: dict, staff=Depends(get_current_staff)):
        """Create a free-form album not tied to any offer/event.
        Body: ``{"label": "...", "cover_url": "..."}``
        """
        await require_role(staff, ["admin", "manager", "manager_pole"])
        label = (payload.get("label") or "").strip()
        if not label:
            raise HTTPException(status_code=400, detail="Le nom de l'album est requis.")
        cid = str(uuid.uuid4())
        doc = {
            "id": cid,
            "label": label,
            "cover_url": (payload.get("cover_url") or "").strip(),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "created_by": staff.get("email") if isinstance(staff, dict) else None,
        }
        await db.gallery_albums.insert_one({**doc})
        doc.pop("_id", None)
        return {"id": f"custom:{cid}", "label": label, "kind": "custom",
                "cover_url": doc["cover_url"]}

    @router.patch("/staff/gallery/albums/{album_id}")
    async def staff_update_album(album_id: str, payload: dict,
                                 staff=Depends(get_current_staff)):
        """Update a custom album label / cover. Only the custom albums (prefix
        ``custom:``) are editable — offer/event albums are auto-derived.
        """
        await require_role(staff, ["admin", "manager", "manager_pole"])
        if not album_id.startswith("custom:"):
            raise HTTPException(status_code=400, detail="Seuls les albums personnalisés sont modifiables.")
        cid = album_id.split(":", 1)[1]
        update = {}
        if "label" in payload:
            new_label = (payload["label"] or "").strip()
            if not new_label:
                raise HTTPException(status_code=400, detail="Le nom de l'album ne peut pas être vide.")
            update["label"] = new_label
        if "cover_url" in payload:
            update["cover_url"] = (payload["cover_url"] or "").strip()
        if not update:
            return {"ok": True}
        update["updated_at"] = datetime.now(timezone.utc).isoformat()
        res = await db.gallery_albums.update_one({"id": cid}, {"$set": update})
        if res.matched_count == 0:
            raise HTTPException(status_code=404, detail="Album introuvable")
        return {"ok": True}

    @router.delete("/staff/gallery/albums/{album_id}")
    async def staff_delete_album(album_id: str, staff=Depends(get_current_staff)):
        """Delete a custom album AND all photos that were uploaded in it. The
        underlying media bytes are kept (deduped by SHA-256, may be referenced
        by other images)."""
        await require_role(staff, ["admin", "manager"])
        if not album_id.startswith("custom:"):
            raise HTTPException(status_code=400, detail="Seuls les albums personnalisés sont supprimables.")
        cid = album_id.split(":", 1)[1]
        res = await db.gallery_albums.delete_one({"id": cid})
        if res.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Album introuvable")
        # Hard-delete the images attached to this album
        await db.gallery_images.delete_many({"album_id": album_id})
        return {"ok": True}

    # ============== FILE SERVING ==============
    @router.get("/gallery/file/{media_id}")
    async def serve_gallery_file(media_id: str):
        """Stream the binary content of a stored gallery file. Used both for
        thumbnails (in-page rendering) and for the "Télécharger" CTA.
        """
        doc = await db.gallery_media.find_one(
            {"id": media_id}, {"_id": 0, "content_b64": 1, "mime": 1},
        )
        if not doc:
            raise HTTPException(status_code=404, detail="Fichier introuvable")
        try:
            raw = base64.b64decode(doc["content_b64"])
        except Exception:
            raise HTTPException(status_code=500, detail="Fichier corrompu")
        # Strong caching since media_ids are content-addressed (SHA-256 dedup)
        return _binary_response(raw, doc.get("mime", "image/jpeg"))

    return router


def _binary_response(content: bytes, mime: str):
    """Standard response with immutable caching headers."""
    from fastapi.responses import Response
    return Response(
        content=content,
        media_type=mime,
        headers={"Cache-Control": "public, max-age=31536000, immutable"},
    )
