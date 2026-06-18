"""SiteMinder pmsXchange adapter.

This module provides an async client for the 3 core operations needed by a
PMS integrating with SiteMinder Channel Manager:

* ``fetch_room_rates`` — REST GET that returns the room-type + rate-plan
  mapping for a given hotel (used as the canonical source-of-truth for
  internal-↔-SM code mappings).
* ``push_availability`` — SOAP ``OTA_HotelAvailNotifRQ`` sent to update
  inventory across every connected OTA in one shot (Booking.com, Airbnb,
  Expedia, Hotels.com, Agoda, …).
* ``parse_reservation_push`` — server-side parsing of an incoming SOAP
  ``OTA_HotelResNotifRQ`` webhook and construction of the matching
  ``OTA_HotelResNotifRS`` acknowledgement.

The adapter is intentionally **provider-agnostic at the call-site**: the
public methods accept simple dataclasses / dicts and return Python objects.
This keeps the rest of the codebase decoupled from SiteMinder XML schemas
should we later swap to Cloudbeds / Hostaway / etc.

Authentication
--------------
* REST  → HTTP Basic Auth (PMS_USERNAME:PMS_PASSWORD).
* SOAP  → WS-Security ``UsernameToken`` (plaintext over TLS 1.2+).

Sandbox defaults
----------------
* PMS_USERNAME = ``PMSXTEST``  PMS_PASSWORD = ``PMSXTEST``
* PMS_CODE     = ``PMSXTEST``  HOTEL_CODE   = ``PMSXTEST1``
* BASE_URL_REST = ``https://tpi-pmsx.preprod.siteminderlabs.com``
* BASE_URL_SOAP = ``https://tpi-pmsx.preprod.siteminderlabs.com``
"""
from __future__ import annotations

import base64
import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

import httpx

try:
    from lxml import etree
except ImportError:  # pragma: no cover - safety net at boot
    etree = None  # type: ignore

log = logging.getLogger(__name__)

OTA_NS  = "http://www.opentravel.org/OTA/2003/05"
SOAP_NS = "http://schemas.xmlsoap.org/soap/envelope/"
WSSE_NS = "http://schemas.xmlsoap.org/ws/2002/07/secext"

NSMAP = {"soap": SOAP_NS, "wsse": WSSE_NS, "ota": OTA_NS}


@dataclass
class SMConfig:
    base_url_rest: str = "https://tpi-pmsx.preprod.siteminderlabs.com"
    base_url_soap: str = "https://tpi-pmsx.preprod.siteminderlabs.com"
    pms_username:  str = "PMSXTEST"
    pms_password:  str = "PMSXTEST"
    pms_code:      str = "PMSXTEST"
    hotel_code:    str = "PMSXTEST1"
    webhook_username: str = ""    # used to validate inbound reservations
    webhook_password: str = ""
    mode: str = "sandbox"         # sandbox | production

    def basic_auth_header(self) -> str:
        raw = f"{self.pms_username}:{self.pms_password}".encode("utf-8")
        return "Basic " + base64.b64encode(raw).decode("ascii")


@dataclass
class AvailabilityUpdate:
    start_date: str  # YYYY-MM-DD
    end_date:   str
    room_type_code: str
    booking_limit: int


@dataclass
class ParsedReservation:
    sm_reservation_id: str | None
    hotel_code: str | None
    channel: str | None
    guest_name: str | None
    guest_email: str | None
    guest_phone: str | None
    checkin: str | None
    checkout: str | None
    room_type_code: str | None
    rate_plan_code: str | None
    total_amount: float | None
    currency: str | None
    status: str | None       # NEW | MOD | CXL
    echo_token: str | None
    raw_xml: str


class SiteMinderClient:
    def __init__(self, cfg: SMConfig):
        self.cfg = cfg

    # ── REST: Room & Rate mapping ─────────────────────────────────
    async def fetch_room_rates(self, *, trace_token: str | None = None) -> dict[str, Any]:
        if not self.cfg.pms_code or not self.cfg.hotel_code:
            raise ValueError("pms_code + hotel_code required")
        url = (
            f"{self.cfg.base_url_rest.rstrip('/')}/"
            f"core-api/pmses/{self.cfg.pms_code}/hotels/{self.cfg.hotel_code}/room-rates"
        )
        headers = {
            "Authorization": self.cfg.basic_auth_header(),
            "Accept": "application/json",
            "X-SM-TRACE-TOKEN": trace_token or f"bbr-{uuid4()}",
        }
        async with httpx.AsyncClient(timeout=30) as cli:
            r = await cli.get(url, headers=headers)
            r.raise_for_status()
            try:
                return r.json()
            except Exception:
                # Sandbox sometimes returns text/plain; try lenient parse.
                import json as _json
                return _json.loads(r.text)

    # ── SOAP: Availability push (OTA_HotelAvailNotifRQ) ───────────
    def build_availability_envelope(self, updates: list[AvailabilityUpdate], echo_token: str) -> str:
        rows = []
        for u in updates:
            rows.append(
                f'<AvailStatusMessage BookingLimit="{int(u.booking_limit)}">'
                f'<StatusApplicationControl Start="{u.start_date}" End="{u.end_date}" InvTypeCode="{u.room_type_code}"/>'
                f'</AvailStatusMessage>'
            )
        rows_xml = "".join(rows)
        ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        body = (
            f'<OTA_HotelAvailNotifRQ xmlns="{OTA_NS}" '
            f'EchoToken="{echo_token}" TimeStamp="{ts}" Version="1.0">'
            f'<POS><Source><RequestorID Type="16" ID="{self.cfg.pms_code}"/></Source></POS>'
            f'<AvailStatusMessages HotelCode="{self.cfg.hotel_code}">{rows_xml}</AvailStatusMessages>'
            f'</OTA_HotelAvailNotifRQ>'
        )
        env = (
            f'<SOAP-ENV:Envelope xmlns:SOAP-ENV="{SOAP_NS}" xmlns:wsse="{WSSE_NS}">'
            f'<SOAP-ENV:Header><wsse:Security><wsse:UsernameToken>'
            f'<wsse:Username>{self.cfg.pms_username}</wsse:Username>'
            f'<wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordText">'
            f'{self.cfg.pms_password}</wsse:Password>'
            f'</wsse:UsernameToken></wsse:Security></SOAP-ENV:Header>'
            f'<SOAP-ENV:Body>{body}</SOAP-ENV:Body>'
            f'</SOAP-ENV:Envelope>'
        )
        return env

    async def push_availability(self, updates: list[AvailabilityUpdate]) -> dict[str, Any]:
        """Send an OTA_HotelAvailNotifRQ. Returns parsed status dict."""
        if not updates:
            return {"ok": True, "skipped": True, "reason": "no_updates"}
        echo_token = str(uuid4())
        envelope = self.build_availability_envelope(updates, echo_token)
        url = f"{self.cfg.base_url_soap.rstrip('/')}/pmsxchange/service"
        headers = {
            "Content-Type": "text/xml; charset=utf-8",
            "SOAPAction": "",
        }
        async with httpx.AsyncClient(timeout=60) as cli:
            r = await cli.post(url, content=envelope.encode("utf-8"), headers=headers)
        ok = 200 <= r.status_code < 300
        parsed: dict[str, Any] = {
            "ok": ok,
            "http_status": r.status_code,
            "echo_token": echo_token,
            "envelope": envelope,
            "response": r.text[:8000],
        }
        if etree is not None and r.text:
            try:
                tree = etree.fromstring(r.content)
                success = tree.find(".//ota:Success", namespaces=NSMAP)
                errors  = tree.findall(".//ota:Errors/ota:Error", namespaces=NSMAP)
                parsed["success_element"] = success is not None
                parsed["errors"] = [(e.get("Code"), e.get("ShortText") or e.text) for e in errors]
                if errors:
                    parsed["ok"] = False
            except Exception as exc:  # noqa: BLE001
                parsed["parse_error"] = str(exc)
        return parsed

    # ── Parse inbound reservation pushes (OTA_HotelResNotifRQ) ────
    def parse_reservation_push(self, raw_xml: bytes) -> ParsedReservation:
        if etree is None:
            raise RuntimeError("lxml not available")
        tree = etree.fromstring(raw_xml)

        # Validate WS-Security
        if self.cfg.webhook_username or self.cfg.webhook_password:
            u = tree.find(".//wsse:UsernameToken/wsse:Username", namespaces=NSMAP)
            p = tree.find(".//wsse:UsernameToken/wsse:Password", namespaces=NSMAP)
            if u is None or p is None:
                raise PermissionError("missing_wsse_credentials")
            if (u.text or "").strip() != self.cfg.webhook_username or (p.text or "").strip() != self.cfg.webhook_password:
                raise PermissionError("invalid_wsse_credentials")

        rq = tree.find(".//ota:OTA_HotelResNotifRQ", namespaces=NSMAP)
        if rq is None:
            raise ValueError("missing_OTA_HotelResNotifRQ")

        def first_text(xpath: str) -> str | None:
            el = rq.find(xpath, namespaces=NSMAP)
            return (el.text or "").strip() if el is not None and el.text else None

        def first_attr(xpath: str, attr: str) -> str | None:
            el = rq.find(xpath, namespaces=NSMAP)
            return el.get(attr) if el is not None else None

        echo_token = rq.get("EchoToken")
        status = first_attr(".//ota:HotelReservation", "ResStatus") or "NEW"

        hotel_code = first_attr(".//ota:BasicPropertyInfo", "HotelCode")
        channel    = first_attr(".//ota:Source", "BookingChannelCode") \
                     or first_attr(".//ota:Source/ota:BookingChannel", "Type")
        room_type  = first_attr(".//ota:RoomType", "RoomTypeCode")
        rate_plan  = first_attr(".//ota:RatePlan", "RatePlanCode")
        checkin    = first_attr(".//ota:TimeSpan", "Start")
        checkout   = first_attr(".//ota:TimeSpan", "End")

        guest_name = " ".join(filter(None, [
            first_text(".//ota:PersonName/ota:GivenName"),
            first_text(".//ota:PersonName/ota:Surname"),
        ])) or None
        guest_email = first_text(".//ota:Email")
        guest_phone = first_attr(".//ota:Telephone", "PhoneNumber")

        total_attr = first_attr(".//ota:Total", "AmountAfterTax") or first_attr(".//ota:Total", "AmountBeforeTax")
        currency   = first_attr(".//ota:Total", "CurrencyCode")
        try:
            total_amount = float(total_attr) if total_attr else None
        except ValueError:
            total_amount = None

        sm_res_id = first_attr(".//ota:HotelReservationID", "ResID_Value") \
                    or first_attr(".//ota:UniqueID", "ID")

        return ParsedReservation(
            sm_reservation_id=sm_res_id,
            hotel_code=hotel_code,
            channel=channel,
            guest_name=guest_name,
            guest_email=guest_email,
            guest_phone=guest_phone,
            checkin=checkin,
            checkout=checkout,
            room_type_code=room_type,
            rate_plan_code=rate_plan,
            total_amount=total_amount,
            currency=currency,
            status=status,
            echo_token=echo_token,
            raw_xml=raw_xml.decode("utf-8", errors="replace"),
        )

    def build_reservation_ack(self, *, echo_token: str | None, internal_id: str, errors: list[str] | None = None) -> bytes:
        ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        echo = echo_token or str(uuid4())
        if errors:
            err_xml = "".join(f'<Error Code="100" ShortText="{e}"/>' for e in errors)
            inner = f'<Errors>{err_xml}</Errors>'
        else:
            inner = (
                f'<Success/>'
                f'<HotelReservations><HotelReservation>'
                f'<UniqueID Type="14" ID="{internal_id}"/>'
                f'</HotelReservation></HotelReservations>'
            )
        rs = (
            f'<SOAP-ENV:Envelope xmlns:SOAP-ENV="{SOAP_NS}">'
            f'<SOAP-ENV:Header/>'
            f'<SOAP-ENV:Body>'
            f'<OTA_HotelResNotifRS xmlns="{OTA_NS}" '
            f'EchoToken="{echo}" TimeStamp="{ts}" Version="1.0">{inner}</OTA_HotelResNotifRS>'
            f'</SOAP-ENV:Body>'
            f'</SOAP-ENV:Envelope>'
        )
        return rs.encode("utf-8")
