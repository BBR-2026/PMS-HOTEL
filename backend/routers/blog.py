"""Blog / Journal — Editorial content for the public Vitrine.

Capabilities :
  * Public  : list published articles, read single article by slug.
  * Staff   : full CRUD with publish workflow (draft / scheduled / published).

A blog article supports:
  - slug (unique, auto-generated from title), title, excerpt, body (markdown
    or HTML — we store as-is and the front-end renders as plain HTML with
    react-markdown OR a simple <article dangerouslySetInnerHTML>).
  - cover_image_url, author_name, category, tags[], read_minutes.
  - status (draft|published), published_at, created_at, updated_at.

Collection : ``blog_articles``.
"""
from __future__ import annotations

import logging
import re
import unicodedata
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

log = logging.getLogger(__name__)


def _slugify(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode("ascii")
    s = re.sub(r"[^a-zA-Z0-9]+", "-", s).strip("-").lower()
    return s or "article"


class ArticleIn(BaseModel):
    title: str = Field(min_length=3, max_length=180)
    excerpt: str | None = Field(default=None, max_length=600)
    body: str = Field(min_length=10, max_length=80_000)
    cover_image_url: str | None = Field(default=None, max_length=600)
    author_name: str | None = Field(default="L'équipe BBR", max_length=120)
    category: str | None = Field(default=None, max_length=60)
    tags: list[str] | None = None
    read_minutes: int | None = Field(default=None, ge=1, le=120)
    status: str = Field(default="draft")  # draft | published


def build_router(*, db, get_current_staff, require_role) -> APIRouter:
    router = APIRouter(tags=["blog"])

    # ── Public ────────────────────────────────────────────────────────
    @router.get("/api/blog/articles")
    async def list_published(
        category: str | None = Query(default=None),
        tag: str | None = Query(default=None),
        limit: int = Query(default=20, ge=1, le=100),
    ):
        filt: dict[str, Any] = {"status": "published"}
        if category:
            filt["category"] = category
        if tag:
            filt["tags"] = tag
        items = []
        async for d in db["blog_articles"].find(
            filt, {"body": 0}  # body excluded for listing
        ).sort("published_at", -1).limit(limit):
            d["id"] = d.pop("_id")
            items.append(d)
        return {"items": items, "count": len(items)}

    @router.get("/api/blog/articles/{slug}")
    async def get_published(slug: str):
        d = await db["blog_articles"].find_one({"slug": slug, "status": "published"})
        if not d:
            raise HTTPException(status_code=404, detail="article_not_found")
        d["id"] = d.pop("_id")
        # Compose a list of related articles (same category, latest 3)
        related = []
        if d.get("category"):
            async for r in db["blog_articles"].find(
                {"category": d["category"], "status": "published",
                 "slug": {"$ne": slug}},
                {"body": 0},
            ).sort("published_at", -1).limit(3):
                r["id"] = r.pop("_id")
                related.append(r)
        return {"article": d, "related": related}

    # ── Staff ─────────────────────────────────────────────────────────
    @router.get("/api/staff/blog/articles")
    async def staff_list(
        status: str | None = Query(default=None),
        q: str | None = Query(default=None),
        limit: int = Query(default=100, ge=1, le=500),
        user=Depends(get_current_staff),
    ):
        await require_role(user, ["admin", "manager", "manager_pole", "management_general"])
        filt: dict[str, Any] = {}
        if status:
            filt["status"] = status
        if q:
            rx = {"$regex": re.escape(q), "$options": "i"}
            filt["$or"] = [{"title": rx}, {"slug": rx}, {"category": rx}]
        items = []
        async for d in db["blog_articles"].find(filt, {"body": 0}).sort("created_at", -1).limit(limit):
            d["id"] = d.pop("_id")
            items.append(d)
        total_published = await db["blog_articles"].count_documents({"status": "published"})
        total_draft = await db["blog_articles"].count_documents({"status": "draft"})
        return {"items": items, "total_published": total_published, "total_draft": total_draft}

    @router.get("/api/staff/blog/articles/{a_id}")
    async def staff_get(a_id: str, user=Depends(get_current_staff)):
        await require_role(user, ["admin", "manager", "manager_pole", "management_general"])
        d = await db["blog_articles"].find_one({"_id": a_id})
        if not d:
            raise HTTPException(status_code=404, detail="not_found")
        d["id"] = d.pop("_id")
        return d

    @router.post("/api/staff/blog/articles")
    async def create(payload: ArticleIn, user=Depends(get_current_staff)):
        await require_role(user, ["admin", "manager"])
        now = datetime.now(timezone.utc).isoformat()
        slug = _slugify(payload.title)
        # ensure unique slug
        base = slug
        i = 2
        while await db["blog_articles"].find_one({"slug": slug}):
            slug = f"{base}-{i}"; i += 1
        doc = {
            "_id": str(uuid4()),
            "slug": slug,
            **payload.model_dump(),
            "published_at": now if payload.status == "published" else None,
            "created_at": now,
            "updated_at": now,
            "created_by": user.get("email"),
        }
        await db["blog_articles"].insert_one(doc)
        doc["id"] = doc.pop("_id")
        return {"ok": True, "article": doc}

    @router.patch("/api/staff/blog/articles/{a_id}")
    async def update(a_id: str, body: dict, user=Depends(get_current_staff)):
        await require_role(user, ["admin", "manager"])
        allowed = {"title", "excerpt", "body", "cover_image_url", "author_name",
                   "category", "tags", "read_minutes", "status"}
        updates = {k: v for k, v in body.items() if k in allowed}
        if not updates:
            raise HTTPException(status_code=400, detail="nothing_to_update")
        if "status" in updates and updates["status"] not in ("draft", "published"):
            raise HTTPException(status_code=400, detail="invalid_status")
        if "title" in updates:
            current = await db["blog_articles"].find_one({"_id": a_id}, {"slug": 1, "title": 1})
            if current and current.get("title") != updates["title"]:
                new_slug = _slugify(updates["title"])
                base = new_slug
                i = 2
                while await db["blog_articles"].find_one({"slug": new_slug, "_id": {"$ne": a_id}}):
                    new_slug = f"{base}-{i}"; i += 1
                updates["slug"] = new_slug
        now = datetime.now(timezone.utc).isoformat()
        updates["updated_at"] = now
        updates["updated_by"] = user.get("email")
        # If transitioning to published for the first time, stamp published_at
        if updates.get("status") == "published":
            existing = await db["blog_articles"].find_one({"_id": a_id}, {"published_at": 1})
            if existing and not existing.get("published_at"):
                updates["published_at"] = now
        r = await db["blog_articles"].update_one({"_id": a_id}, {"$set": updates})
        if r.matched_count == 0:
            raise HTTPException(status_code=404, detail="not_found")
        return {"ok": True}

    @router.delete("/api/staff/blog/articles/{a_id}")
    async def delete(a_id: str, user=Depends(get_current_staff)):
        await require_role(user, ["admin"])
        r = await db["blog_articles"].delete_one({"_id": a_id})
        if r.deleted_count == 0:
            raise HTTPException(status_code=404, detail="not_found")
        return {"ok": True}

    return router
