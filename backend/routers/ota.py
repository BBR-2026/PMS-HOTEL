"""OTA & Channel Manager router — Phase C · Vague 3.

Mounts under multiple prefixes:

* ``/api/staff/ota/config``          — GET/PUT SiteMinder credentials (admin).
* ``/api/staff/ota/mappings``        — CRUD internal room ↔ SM mapping.
* ``/api/staff/ota/sync/availability`` — POST trigger an inventory push.
* ``/api/staff/ota/sync/room-rates``    — POST refresh room/rate codes from SM.
* ``/api/staff/ota/status``          — GET dashboard summary.
* ``/api/staff/ota/sync-logs``       — GET paged sync history.
* ``/api/staff/ota/reservations``    — GET inbound reservations from OTAs.
* ``/api/webhooks/siteminder/reservations`` — public SOAP webhook (no auth header — WSSE only).
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, Body, Depends, HTTPException, Query, Request, Response
from pydantic import BaseModel, Field

from . import channel_manager_siteminder as sm_mod

log = logging.getLogger(__name__)

OTA_CHANNELS = ["booking_com", "airbnb", "expedia", "hotels_com", "agoda"]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _cfg_to_public(d: dict) -> dict:
    """Strip the password before returning to clients."""
    pub = {k: v for k, v in d.items() if k != "_id"}
    pub["id"] = d.get("_id")
    pub["pms_password_set"] = bool(pub.pop("pms_password", None))
    pub["webhook_password_set"] = bool(pub.pop("webhook_password", None))
    return pub


async def _load_cfg(db) -> sm_mod.SMConfig:
    doc = await db["ota_config"].find_one({"_id": "siteminder"}) or {}
    return sm_mod.SMConfig(
        base_url_rest=doc.get("base_url_rest", "https://tpi-pmsx.preprod.siteminderlabs.com"),
        base_url_soap=doc.get("base_url_soap", "https://tpi-pmsx.preprod.siteminderlabs.com"),
        pms_username=doc.get("pms_username", "PMSXTEST"),
        pms_password=doc.get("pms_password", "PMSXTEST"),
        pms_code=doc.get("pms_code", "PMSXTEST"),
        hotel_code=doc.get("hotel_code", "PMSXTEST1"),
        webhook_username=doc.get("webhook_username", ""),
        webhook_password=doc.get("webhook_password", ""),
        mode=doc.get("mode", "sandbox"),
    )


class ConfigPayload(BaseModel):
    base_url_rest: str | None = None
    base_url_soap: str | None = None
    pms_username:  str | None = None
    pms_password:  str | None = None
    pms_code:      str | None = None
    hotel_code:    str | None = None
    webhook_username: str | None = None
    webhook_password: str | None = None
    mode:          str | None = Field(default=None, pattern="^(sandbox|production)$")
    auto_sync_enabled: bool | None = None      # periodic 15min push
    auto_sync_on_booking: bool | None = None   # immediate push after direct booking/cancel
    auto_sync_default_limit: int | None = Field(default=None, ge=0, le=999)


class MappingPayload(BaseModel):
    internal_offer_id: str = Field(min_length=1, max_length=200)
    label: str | None = Field(default=None, max_length=200)
    sm_room_type_code: str = Field(min_length=1, max_length=80)
    sm_rate_plan_code: str | None = Field(default=None, max_length=80)
    enabled: bool = True
    channels: list[str] | None = None


class AvailabilityPushPayload(BaseModel):
    """Manual push trigger. Items reference internal mapping ids."""
    updates: list[dict] = Field(default_factory=list)
    # Each item: {mapping_id, start_date, end_date, booking_limit}


def build_router(*, db, get_current_staff, require_role) -> APIRouter:
    router = APIRouter(tags=["ota-channel-manager"])

    # ── Configuration ────────────────────────────────────────────
    @router.get("/api/staff/ota/config")
    async def get_config(user=Depends(get_current_staff)):
        await require_role(user, ["admin", "manager"])
        doc = await db["ota_config"].find_one({"_id": "siteminder"})
        if not doc:
            # Seed with sandbox defaults so the UI never breaks
            doc = {
                "_id": "siteminder",
                "base_url_rest": "https://tpi-pmsx.preprod.siteminderlabs.com",
                "base_url_soap": "https://tpi-pmsx.preprod.siteminderlabs.com",
                "pms_username": "PMSXTEST",
                "pms_password": "PMSXTEST",
                "pms_code": "PMSXTEST",
                "hotel_code": "PMSXTEST1",
                "webhook_username": "",
                "webhook_password": "",
                "mode": "sandbox",
                "auto_sync_enabled": False,
                "auto_sync_on_booking": False,
                "auto_sync_default_limit": 5,
                "created_at": _now(),
            }
            await db["ota_config"].insert_one(doc)
        return _cfg_to_public(doc) | {"ota_channels": OTA_CHANNELS}

    @router.put("/api/staff/ota/config")
    async def update_config(payload: ConfigPayload, user=Depends(get_current_staff)):
        await require_role(user, ["admin", "manager"])
        updates: dict[str, Any] = {k: v for k, v in payload.model_dump().items() if v is not None}
        if not updates:
            raise HTTPException(status_code=400, detail="nothing_to_update")
        updates["updated_at"] = _now()
        updates["updated_by"] = user.get("email")
        await db["ota_config"].update_one({"_id": "siteminder"}, {"$set": updates}, upsert=True)
        doc = await db["ota_config"].find_one({"_id": "siteminder"})
        return _cfg_to_public(doc)

    @router.post("/api/staff/ota/test-connection")
    async def test_connection(user=Depends(get_current_staff)):
        """Lightweight health check : calls the room-rates REST endpoint."""
        await require_role(user, ["admin", "manager"])
        cfg = await _load_cfg(db)
        client = sm_mod.SiteMinderClient(cfg)
        try:
            data = await client.fetch_room_rates(trace_token=f"healthcheck-{uuid4()}")
            return {
                "ok": True,
                "endpoint": "room-rates",
                "mode": cfg.mode,
                "hotel_code": cfg.hotel_code,
                "items_count": len(data.get("rooms", [])) if isinstance(data, dict) else 0,
            }
        except Exception as exc:  # noqa: BLE001
            return {"ok": False, "error": str(exc)[:500]}

    # ── Room/Rate mappings ───────────────────────────────────────
    @router.get("/api/staff/ota/mappings")
    async def list_mappings(user=Depends(get_current_staff)):
        await require_role(user, ["admin", "manager", "manager_pole", "management_general"])
        items = []
        async for d in db["ota_room_mappings"].find({}).sort("internal_offer_id", 1):
            d["id"] = d.pop("_id")
            items.append(d)
        return {"items": items, "ota_channels": OTA_CHANNELS}

    @router.post("/api/staff/ota/mappings")
    async def create_mapping(payload: MappingPayload, user=Depends(get_current_staff)):
        await require_role(user, ["admin", "manager"])
        existing = await db["ota_room_mappings"].find_one({"internal_offer_id": payload.internal_offer_id})
        if existing:
            raise HTTPException(status_code=409, detail="mapping_exists")
        doc = {
            "_id": str(uuid4()),
            **payload.model_dump(),
            "created_at": _now(),
            "created_by": user.get("email"),
        }
        await db["ota_room_mappings"].insert_one(doc)
        doc["id"] = doc.pop("_id")
        return doc

    @router.patch("/api/staff/ota/mappings/{mid}")
    async def update_mapping(mid: str, body: dict = Body(...), user=Depends(get_current_staff)):
        await require_role(user, ["admin", "manager"])
        allowed = {"label", "sm_room_type_code", "sm_rate_plan_code", "enabled", "channels"}
        updates = {k: v for k, v in body.items() if k in allowed}
        if not updates:
            raise HTTPException(status_code=400, detail="nothing_to_update")
        updates["updated_at"] = _now()
        r = await db["ota_room_mappings"].update_one({"_id": mid}, {"$set": updates})
        if r.matched_count == 0:
            raise HTTPException(status_code=404, detail="not_found")
        return {"ok": True}

    @router.delete("/api/staff/ota/mappings/{mid}")
    async def delete_mapping(mid: str, user=Depends(get_current_staff)):
        await require_role(user, ["admin", "manager"])
        r = await db["ota_room_mappings"].delete_one({"_id": mid})
        if r.deleted_count == 0:
            raise HTTPException(status_code=404, detail="not_found")
        return {"ok": True}

    # ── Sync triggers ────────────────────────────────────────────
    @router.post("/api/staff/ota/sync/room-rates")
    async def sync_room_rates(user=Depends(get_current_staff)):
        """Fetch the canonical room / rate codes from SiteMinder."""
        await require_role(user, ["admin", "manager"])
        cfg = await _load_cfg(db)
        client = sm_mod.SiteMinderClient(cfg)
        log_doc = {
            "_id": str(uuid4()),
            "kind": "room_rates_fetch",
            "started_at": _now(),
            "hotel_code": cfg.hotel_code,
            "mode": cfg.mode,
            "user": user.get("email"),
        }
        try:
            data = await client.fetch_room_rates()
            log_doc.update({
                "ok": True,
                "finished_at": _now(),
                "items_count": len(data.get("rooms", [])) if isinstance(data, dict) else 0,
                "payload_excerpt": str(data)[:4000],
            })
            await db["ota_sync_logs"].insert_one(log_doc)
            return {"ok": True, "data": data, "log_id": log_doc["_id"]}
        except Exception as exc:  # noqa: BLE001
            log_doc.update({"ok": False, "finished_at": _now(), "error": str(exc)[:1000]})
            await db["ota_sync_logs"].insert_one(log_doc)
            return {"ok": False, "error": str(exc)[:500], "log_id": log_doc["_id"]}

    @router.post("/api/staff/ota/sync/availability")
    async def sync_availability(payload: AvailabilityPushPayload, user=Depends(get_current_staff)):
        await require_role(user, ["admin", "manager"])
        if not payload.updates:
            raise HTTPException(status_code=400, detail="empty_updates")
        # Translate {mapping_id} → SM room type code.
        cfg = await _load_cfg(db)
        client = sm_mod.SiteMinderClient(cfg)
        sm_updates: list[sm_mod.AvailabilityUpdate] = []
        for u in payload.updates:
            mapping = await db["ota_room_mappings"].find_one({"_id": u.get("mapping_id")})
            if not mapping or not mapping.get("enabled"):
                continue
            sm_updates.append(sm_mod.AvailabilityUpdate(
                start_date=u["start_date"],
                end_date=u["end_date"],
                room_type_code=mapping["sm_room_type_code"],
                booking_limit=int(u["booking_limit"]),
            ))
        if not sm_updates:
            raise HTTPException(status_code=400, detail="no_valid_updates")
        log_doc = {
            "_id": str(uuid4()),
            "kind": "availability_push",
            "started_at": _now(),
            "hotel_code": cfg.hotel_code,
            "mode": cfg.mode,
            "user": user.get("email"),
            "updates_count": len(sm_updates),
        }
        try:
            res = await client.push_availability(sm_updates)
            log_doc.update({
                "ok": res.get("ok", False),
                "finished_at": _now(),
                "http_status": res.get("http_status"),
                "echo_token": res.get("echo_token"),
                "errors": res.get("errors"),
                "response_excerpt": (res.get("response") or "")[:4000],
            })
            await db["ota_sync_logs"].insert_one(log_doc)
            return {
                "ok": res.get("ok"),
                "echo_token": res.get("echo_token"),
                "errors": res.get("errors"),
                "log_id": log_doc["_id"],
            }
        except Exception as exc:  # noqa: BLE001
            log_doc.update({"ok": False, "finished_at": _now(), "error": str(exc)[:1000]})
            await db["ota_sync_logs"].insert_one(log_doc)
            return {"ok": False, "error": str(exc)[:500], "log_id": log_doc["_id"]}

    # ── Status dashboard ─────────────────────────────────────────
    @router.get("/api/staff/ota/status")
    async def status_summary(user=Depends(get_current_staff)):
        await require_role(user, ["admin", "manager", "manager_pole", "management_general"])
        cfg = await _load_cfg(db)
        mappings_total = await db["ota_room_mappings"].count_documents({})
        mappings_enabled = await db["ota_room_mappings"].count_documents({"enabled": True})
        reservations_total = await db["ota_reservations"].count_documents({})
        reservations_30d = await db["ota_reservations"].count_documents({
            "received_at": {"$gte": (datetime.now(timezone.utc).replace(microsecond=0)).isoformat()[:10]},
        })
        last_avail = await db["ota_sync_logs"].find_one({"kind": "availability_push"}, sort=[("started_at", -1)])
        last_fetch = await db["ota_sync_logs"].find_one({"kind": "room_rates_fetch"}, sort=[("started_at", -1)])
        last_err   = await db["ota_sync_logs"].find_one({"ok": False}, sort=[("started_at", -1)])
        # Per-channel summary based on incoming reservations
        by_channel: dict[str, int] = {c: 0 for c in OTA_CHANNELS}
        async for r in db["ota_reservations"].aggregate([
            {"$group": {"_id": "$channel", "n": {"$sum": 1}}},
        ]):
            key = (r["_id"] or "unknown").lower()
            by_channel[key] = by_channel.get(key, 0) + r["n"]
        return {
            "mode": cfg.mode,
            "hotel_code": cfg.hotel_code,
            "mappings_total": mappings_total,
            "mappings_enabled": mappings_enabled,
            "reservations_total": reservations_total,
            "reservations_today": reservations_30d,
            "last_availability_push": last_avail and {
                "at": last_avail.get("started_at"),
                "ok": last_avail.get("ok"),
                "updates": last_avail.get("updates_count"),
                "echo_token": last_avail.get("echo_token"),
            },
            "last_room_rates_fetch": last_fetch and {
                "at": last_fetch.get("started_at"),
                "ok": last_fetch.get("ok"),
                "items": last_fetch.get("items_count"),
            },
            "last_error": last_err and {
                "at": last_err.get("started_at"),
                "kind": last_err.get("kind"),
                "message": last_err.get("error") or (last_err.get("errors") and str(last_err["errors"])),
            },
            "by_channel": by_channel,
            "ota_channels": OTA_CHANNELS,
        }

    @router.get("/api/staff/ota/sync-logs")
    async def sync_logs(
        kind: str | None = Query(default=None),
        limit: int = Query(default=50, ge=1, le=200),
        user=Depends(get_current_staff),
    ):
        await require_role(user, ["admin", "manager", "manager_pole", "management_general"])
        filt: dict[str, Any] = {}
        if kind:
            filt["kind"] = kind
        items = []
        async for d in db["ota_sync_logs"].find(filt).sort("started_at", -1).limit(limit):
            d["id"] = d.pop("_id")
            # Trim heavy fields for list view
            for f in ("payload_excerpt", "response_excerpt"):
                if d.get(f):
                    d[f] = d[f][:300]
            items.append(d)
        return {"items": items}

    @router.get("/api/staff/ota/reservations")
    async def list_reservations(
        channel: str | None = Query(default=None),
        limit: int = Query(default=100, ge=1, le=500),
        user=Depends(get_current_staff),
    ):
        await require_role(user, ["admin", "manager", "manager_pole", "management_general"])
        filt: dict[str, Any] = {}
        if channel:
            filt["channel"] = channel
        items = []
        async for d in db["ota_reservations"].find(filt).sort("received_at", -1).limit(limit):
            d["id"] = d.pop("_id")
            d.pop("raw_xml", None)  # strip the heavy XML for the list view
            items.append(d)
        return {"items": items}

    @router.get("/api/staff/ota/reservations/{rid}")
    async def get_reservation(rid: str, user=Depends(get_current_staff)):
        await require_role(user, ["admin", "manager", "manager_pole", "management_general"])
        d = await db["ota_reservations"].find_one({"_id": rid})
        if not d:
            raise HTTPException(status_code=404, detail="not_found")
        d["id"] = d.pop("_id")
        return d

    # ── Public SOAP webhook (inbound reservations) ───────────────
    @router.post("/api/webhooks/siteminder/reservations")
    async def reservations_webhook(request: Request):
        body = await request.body()
        cfg = await _load_cfg(db)
        client = sm_mod.SiteMinderClient(cfg)
        try:
            parsed = client.parse_reservation_push(body)
        except PermissionError as exc:
            log.warning("siteminder webhook unauthorized: %s", exc)
            return Response(
                content=client.build_reservation_ack(
                    echo_token=None, internal_id="", errors=[str(exc)]
                ),
                media_type="text/xml; charset=utf-8",
                status_code=401,
            )
        except Exception as exc:  # noqa: BLE001
            log.error("siteminder webhook parse error: %s", exc)
            return Response(
                content=client.build_reservation_ack(
                    echo_token=None, internal_id="", errors=[f"parse_error:{exc}"[:120]]
                ),
                media_type="text/xml; charset=utf-8",
                status_code=400,
            )

        internal_id = str(uuid4())
        doc = {
            "_id": internal_id,
            "sm_reservation_id": parsed.sm_reservation_id,
            "hotel_code": parsed.hotel_code,
            "channel": (parsed.channel or "unknown").lower(),
            "guest_name": parsed.guest_name,
            "guest_email": parsed.guest_email,
            "guest_phone": parsed.guest_phone,
            "checkin": parsed.checkin,
            "checkout": parsed.checkout,
            "room_type_code": parsed.room_type_code,
            "rate_plan_code": parsed.rate_plan_code,
            "total_amount": parsed.total_amount,
            "currency": parsed.currency,
            "status": parsed.status,
            "echo_token": parsed.echo_token,
            "raw_xml": parsed.raw_xml,
            "received_at": _now(),
            "mode": cfg.mode,
        }
        await db["ota_reservations"].insert_one(doc)
        await db["ota_sync_logs"].insert_one({
            "_id": str(uuid4()),
            "kind": "reservation_received",
            "started_at": _now(),
            "finished_at": _now(),
            "ok": True,
            "channel": doc["channel"],
            "sm_reservation_id": parsed.sm_reservation_id,
            "internal_id": internal_id,
        })
        ack = client.build_reservation_ack(echo_token=parsed.echo_token, internal_id=internal_id)
        return Response(content=ack, media_type="text/xml; charset=utf-8")

    return router


async def auto_push_all_mappings(db, *, source: str = "scheduler", force: bool = False) -> dict:
    """Push the next 30-day availability window for every enabled mapping.

    Booking limit defaults to 5 — the real value should ideally come from a
    PMS inventory query, but for sandbox / Phase 4 we just keep a flat
    limit and let staff override per push from the UI.

    When ``force=True`` the caller bypasses the ``auto_sync_enabled`` flag —
    used by the on-booking trigger which is gated by its own flag.
    """
    from datetime import date as _date, timedelta as _td

    cfg_doc = await db["ota_config"].find_one({"_id": "siteminder"}) or {}
    if not force and not cfg_doc.get("auto_sync_enabled"):
        return {"skipped": "disabled"}

    cfg = sm_mod.SMConfig(
        base_url_rest=cfg_doc.get("base_url_rest", "https://tpi-pmsx.preprod.siteminderlabs.com"),
        base_url_soap=cfg_doc.get("base_url_soap", "https://tpi-pmsx.preprod.siteminderlabs.com"),
        pms_username=cfg_doc.get("pms_username", "PMSXTEST"),
        pms_password=cfg_doc.get("pms_password", "PMSXTEST"),
        pms_code=cfg_doc.get("pms_code", "PMSXTEST"),
        hotel_code=cfg_doc.get("hotel_code", "PMSXTEST1"),
        mode=cfg_doc.get("mode", "sandbox"),
    )
    client = sm_mod.SiteMinderClient(cfg)
    today = _date.today()
    end   = today + _td(days=30)
    default_limit = int(cfg_doc.get("auto_sync_default_limit", 5))

    updates: list[sm_mod.AvailabilityUpdate] = []
    async for m in db["ota_room_mappings"].find({"enabled": True}):
        updates.append(sm_mod.AvailabilityUpdate(
            start_date=today.isoformat(),
            end_date=end.isoformat(),
            room_type_code=m["sm_room_type_code"],
            booking_limit=default_limit,
        ))

    log_doc: dict[str, Any] = {
        "_id": str(uuid4()),
        "kind": "availability_push",
        "started_at": _now(),
        "hotel_code": cfg.hotel_code,
        "mode": cfg.mode,
        "user": f"auto:{source}",
        "updates_count": len(updates),
    }
    if not updates:
        log_doc.update({"ok": True, "finished_at": _now(), "skipped": "no_mappings"})
        await db["ota_sync_logs"].insert_one(log_doc)
        return {"ok": True, "skipped": "no_mappings"}

    try:
        res = await client.push_availability(updates)
        log_doc.update({
            "ok": res.get("ok", False),
            "finished_at": _now(),
            "http_status": res.get("http_status"),
            "echo_token": res.get("echo_token"),
            "errors": res.get("errors"),
            "response_excerpt": (res.get("response") or "")[:2000],
        })
    except Exception as exc:  # noqa: BLE001
        log_doc.update({"ok": False, "finished_at": _now(), "error": str(exc)[:500]})

    await db["ota_sync_logs"].insert_one(log_doc)
    return {"ok": log_doc.get("ok"), "updates": len(updates), "log_id": log_doc["_id"]}


async def trigger_sync_on_booking_change(db, *, reason: str = "direct_booking") -> None:
    """Fire-and-forget availability push triggered by a direct booking or
    cancellation. Decoupled in its own helper so the booking endpoint can
    call it without depending on the OTA router internals.
    """
    import asyncio
    cfg_doc = await db["ota_config"].find_one({"_id": "siteminder"}) or {}
    if not cfg_doc.get("auto_sync_on_booking"):
        return
    try:
        await asyncio.shield(auto_push_all_mappings(db, source=reason, force=True))
    except Exception as exc:  # noqa: BLE001
        log.warning("trigger_sync_on_booking_change failed: %s", exc)
