"""Iteration 19 — multi-date passport tickets, notifications bell, email cleanup.

Tests:
  1. GET /api/staff/notifications/new-bookings — returns recent bookings with
     required fields + `?since=` cursor filtering.
  2. Multi-day passport ticket — book 2 adults across 3 event dates → ONE QR
     per adult (NOT 6), each has is_passport=True and valid_dates=[d1,d2,d3].
  3. POST /api/staff/scan/{token}/checkin — passport allows 2 scans/date,
     rejects 3rd, rejects when today not in valid_dates.
  4. Email service no longer contains "Embarquement dès 11H".
  5. Default site_config footer free of "Embarquement dès 11H".
  6. /api/offers and /api/poles still apply DB overrides (regression).
  7. POST /api/staff/bookings with offer_type='special_event' + event_id works.
"""
import os
import re
import uuid
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import pytest
import requests


def _load_backend_url():
    url = os.environ.get("REACT_APP_BACKEND_URL")
    if not url:
        env = Path("/app/frontend/.env").read_text()
        for line in env.splitlines():
            if line.startswith("REACT_APP_BACKEND_URL="):
                url = line.split("=", 1)[1].strip()
                break
    assert url, "REACT_APP_BACKEND_URL not configured"
    return url.rstrip("/")


BASE_URL = _load_backend_url()
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@boulay.ci"
ADMIN_PASSWORD = "Admin@2026"


# ---------- helpers ----------

def _login(email: str, password: str) -> str:
    r = requests.post(
        f"{API}/auth/staff/login",
        json={"email": email, "password": password},
        timeout=15,
    )
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    return r.json()["access_token"]


def _auth(t: str) -> dict:
    return {"Authorization": f"Bearer {t}"}


def _booker(suffix: str = ""):
    return {
        "name": "Iter19",
        "surname": "Booker",
        "email": f"t.iter19{suffix}@bbr.ci",
        "phone": "+225 0707070707",
        "nationality": "France",
        "kind": "adult",
    }


def _future_dates(n: int, start_offset_days: int = 21) -> list:
    """Return N consecutive future dates as YYYY-MM-DD strings."""
    d = date.today() + timedelta(days=start_offset_days)
    return [(d + timedelta(days=i)).isoformat() for i in range(n)]


# ---------- fixtures ----------

@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN_EMAIL, ADMIN_PASSWORD)


@pytest.fixture(scope="module")
def special_event_3day(admin_token):
    """Create a published 3-day single_day-mode special event (3 event_dates).
    Returns the event dict."""
    dates = _future_dates(3, start_offset_days=21)
    payload = {
        "title": f"TEST Iter19 Multi-Day {uuid.uuid4().hex[:6]}",
        "subtitle": "Passeport multi-dates",
        "description": "3-day pass for testing",
        "image_url": "",
        "event_dates": dates,
        "boat_times": ["08H45"],
        "return_boat_times": ["18H00"],
        "price_adult": 30000,
        "price_child": 15000,
        "capacity": 100,
        "cta_label": "Réserver",
        "status": "published",
        "event_kind": "single_day",
    }
    r = requests.post(
        f"{API}/staff/special-events",
        headers={**_auth(admin_token), "Content-Type": "application/json"},
        json=payload,
        timeout=15,
    )
    assert r.status_code in (200, 201), f"create event failed: {r.status_code} {r.text}"
    ev = r.json()
    ev["_dates"] = dates
    yield ev


# ============================================================
# 1) Notifications endpoint
# ============================================================

class TestNotifications:
    def test_endpoint_requires_auth(self):
        r = requests.get(f"{API}/staff/notifications/new-bookings", timeout=10)
        assert r.status_code in (401, 403), f"expected 401/403, got {r.status_code}"

    def test_endpoint_returns_required_fields(self, admin_token):
        r = requests.get(
            f"{API}/staff/notifications/new-bookings?limit=10",
            headers=_auth(admin_token),
            timeout=15,
        )
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        body = r.json()
        assert "items" in body and "count" in body and "latest_created_at" in body
        assert isinstance(body["items"], list)
        if body["items"]:
            it = body["items"][0]
            for key in ("id", "label", "booker", "total_amount", "created_at"):
                assert key in it, f"missing key {key} in notification item"

    def test_since_cursor_filters(self, admin_token):
        from urllib.parse import quote
        # First call -> get latest_created_at
        r1 = requests.get(
            f"{API}/staff/notifications/new-bookings?limit=5",
            headers=_auth(admin_token), timeout=15,
        )
        assert r1.status_code == 200
        latest = r1.json().get("latest_created_at")
        if not latest:
            pytest.skip("No bookings exist yet to test cursor")
        # Re-query with since=latest (URL-encoded, mirroring the frontend
        # `encodeURIComponent` call) -> should be empty (strict $gt).
        r2 = requests.get(
            f"{API}/staff/notifications/new-bookings",
            params={"since": latest},
            headers=_auth(admin_token), timeout=15,
        )
        assert r2.status_code == 200
        assert r2.json()["count"] == 0, (
            f"Cursor should exclude items with created_at == since, got {r2.json()}"
        )


# ============================================================
# 2) Multi-day passport ticket creation
# ============================================================

class TestPassportTicket:
    def test_passport_single_qr_per_adult_with_valid_dates(self, special_event_3day):
        dates = special_event_3day["_dates"]
        booker = _booker(".pp1")
        # Booker pattern: one participant for two adults
        payload = {
            "offer_type": "special_event",
            "special_event_id": special_event_3day["id"],
            "date": dates[0],
            "boat_time": "08H45",
            "adults": 2,
            "children": 0,
            "participants": [booker],
            "multi_day_dates": dates,
        }
        r = requests.post(f"{API}/bookings", json=payload, timeout=20)
        assert r.status_code == 200, f"create booking failed: {r.status_code} {r.text}"
        booking = r.json()
        bid = booking["id"]
        ref = booking["reference_token"]

        # Total = 2 adults * 30000 * 3 dates = 180000
        assert booking["total_amount"] == 180000, (
            f"expected 180000, got {booking['total_amount']}"
        )

        # Pay (cash) so QRs are generated
        pay = requests.post(
            f"{API}/bookings/{bid}/pay",
            json={"reference_token": ref, "payment_method": "cash"},
            timeout=20,
        )
        assert pay.status_code == 200, f"pay failed: {pay.status_code} {pay.text}"
        paid = pay.json()

        qrs = paid.get("qr_codes") or []
        # MUST be exactly 2 (one per adult), not 6
        assert len(qrs) == 2, (
            f"expected 2 passport QRs (one per adult), got {len(qrs)}: dates={dates}"
        )
        for q in qrs:
            assert q.get("is_passport") is True, "QR should be marked is_passport=True"
            assert q.get("valid_dates") == dates, (
                f"valid_dates mismatch: {q.get('valid_dates')} vs {dates}"
            )
            assert q.get("qr_token"), "qr_token missing"
            assert q.get("qr_code"), "qr_code (PNG) missing"
        # store on class for next tests
        TestPassportTicket._booking_id = bid
        TestPassportTicket._dates = dates
        TestPassportTicket._qrs = qrs


# ============================================================
# 3) Scanner — passport: 2 scans/date, reject 3rd, reject if today not in dates
# ============================================================

class TestPassportScanner:
    def test_scan_rejects_when_today_not_in_valid_dates(self, admin_token):
        """The fixture's event dates are all in the future, so today is not
        valid → scanner must reject with explicit message."""
        if not getattr(TestPassportTicket, "_qrs", None):
            pytest.skip("Passport booking fixture missing")
        token = TestPassportTicket._qrs[0]["qr_token"]
        r = requests.post(
            f"{API}/staff/scan/{token}/checkin",
            headers=_auth(admin_token),
            json={},
            timeout=15,
        )
        assert r.status_code == 400, f"expected 400, got {r.status_code} {r.text}"
        detail = (r.json().get("detail") or "")
        assert "passeport" in detail.lower() or "valide" in detail.lower(), (
            f"error message should mention passport validity, got: {detail}"
        )

    def test_scan_two_then_reject_third_on_valid_date(self, admin_token):
        """Create a passport booking where TODAY is one of the valid dates,
        then exercise scan limit (2 scans/day, 3rd rejected)."""
        today = date.today().isoformat()
        future1 = (date.today() + timedelta(days=1)).isoformat()
        future2 = (date.today() + timedelta(days=2)).isoformat()
        dates = [today, future1, future2]
        # Create a fresh event including today
        ev_payload = {
            "title": f"TEST Iter19 Today {uuid.uuid4().hex[:6]}",
            "event_dates": dates,
            "boat_times": ["08H45"],
            "return_boat_times": ["18H00"],
            "price_adult": 20000,
            "price_child": 0,
            "capacity": 100,
            "status": "published",
            "event_kind": "single_day",
        }
        ev = requests.post(
            f"{API}/staff/special-events",
            headers={**_auth(admin_token), "Content-Type": "application/json"},
            json=ev_payload,
            timeout=15,
        )
        assert ev.status_code in (200, 201), f"event create: {ev.status_code} {ev.text}"
        evd = ev.json()

        booker = _booker(".pp2")
        b = requests.post(
            f"{API}/bookings",
            json={
                "offer_type": "special_event",
                "special_event_id": evd["id"],
                "date": today,
                "boat_time": "08H45",
                "adults": 1,
                "children": 0,
                "participants": [booker],
                "multi_day_dates": dates,
            },
            timeout=20,
        )
        assert b.status_code == 200, f"booking create: {b.status_code} {b.text}"
        bd = b.json()
        pay = requests.post(
            f"{API}/bookings/{bd['id']}/pay",
            json={"reference_token": bd["reference_token"], "payment_method": "cash"},
            timeout=20,
        )
        assert pay.status_code == 200, pay.text
        qrs = pay.json().get("qr_codes") or []
        assert len(qrs) == 1, f"expected 1 passport QR (1 adult), got {len(qrs)}"
        token = qrs[0]["qr_token"]
        assert qrs[0]["valid_dates"] == dates

        # Scan 1 (aller)
        s1 = requests.post(
            f"{API}/staff/scan/{token}/checkin",
            headers=_auth(admin_token), json={}, timeout=15,
        )
        assert s1.status_code == 200, f"scan #1 failed: {s1.status_code} {s1.text}"
        # Scan 2 (retour)
        s2 = requests.post(
            f"{API}/staff/scan/{token}/checkin",
            headers=_auth(admin_token), json={}, timeout=15,
        )
        assert s2.status_code == 200, f"scan #2 failed: {s2.status_code} {s2.text}"
        # Scan 3 must be rejected (today already saturated)
        s3 = requests.post(
            f"{API}/staff/scan/{token}/checkin",
            headers=_auth(admin_token), json={}, timeout=15,
        )
        assert s3.status_code == 400, (
            f"expected 400 on third scan today, got {s3.status_code} {s3.text}"
        )
        det = (s3.json().get("detail") or "").lower()
        assert "scanné" in det or "scanne" in det or today in det, (
            f"expected error to mention saturation/today, got: {det}"
        )


# ============================================================
# 4) Email service — no "Embarquement dès 11H"
# ============================================================

class TestEmailContent:
    def test_email_service_module_does_not_contain_embarquement_11h(self):
        path = Path("/app/backend/services/email_service.py")
        assert path.exists(), "email_service.py not found"
        src = path.read_text(encoding="utf-8")
        # The brief specifically removes "Embarquement dès 11H"
        # (preserves the per-booking "Embarquement : <boat_time>" line)
        assert "dès 11H" not in src, "'dès 11H' still present in email_service.py"
        assert "Embarquement dès 11" not in src, "'Embarquement dès 11' still in module"

    def test_site_config_default_footer_clean(self, admin_token):
        # No public /site-config endpoint exists — use /staff/site-config and
        # also assert that the default footer module is free of the forbidden
        # string.
        r = requests.get(
            f"{API}/staff/site-config",
            headers=_auth(admin_token), timeout=10,
        )
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        body = r.json()
        as_text = str(body)
        assert "dès 11H" not in as_text, (
            "Stored site config still contains 'dès 11H' — DB doc not migrated?"
        )
        # Inspect the source default constant too
        src = Path("/app/backend/routers/site_config.py").read_text(encoding="utf-8")
        assert "dès 11H" not in src, (
            "DEFAULT_FOOTER_HTML in routers/site_config.py still contains 'dès 11H'"
        )


# ============================================================
# 5) Regression — /api/offers and /api/poles
# ============================================================

class TestPublicCatalogRegression:
    def test_offers_endpoint_ok(self):
        r = requests.get(f"{API}/offers", timeout=15)
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        body = r.json()
        # Endpoint may return a list OR a dict — both are tolerated
        items = body if isinstance(body, list) else (body.get("offers") or body)
        assert items, "offers endpoint returned empty payload"

    def test_poles_endpoint_ok(self):
        r = requests.get(f"{API}/poles", timeout=15)
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        body = r.json()
        items = body if isinstance(body, list) else (body.get("poles") or body.get("items") or body)
        assert items, "poles endpoint returned empty payload"


# ============================================================
# 6) POST /api/staff/bookings with offer_type='special_event'
# ============================================================

class TestStaffSpecialEventBooking:
    def test_staff_create_special_event_booking(self, admin_token, special_event_3day):
        dates = special_event_3day["_dates"]
        booker = _booker(".staff")
        payload = {
            "offer_type": "special_event",
            "event_id": special_event_3day["id"],
            "date": dates[0],
            "boat_time": "08H45",
            "adults": 1,
            "children": 0,
            "participants": [booker],
            "payment_method": "cash",
        }
        r = requests.post(
            f"{API}/staff/bookings",
            headers={**_auth(admin_token), "Content-Type": "application/json"},
            json=payload,
            timeout=20,
        )
        assert r.status_code in (200, 201), (
            f"staff special-event booking failed: {r.status_code} {r.text}"
        )
        body = r.json()
        assert body.get("offer_type") == "special_event"
        assert body.get("special_event_id") == special_event_3day["id"]
        assert body.get("created_by_staff") is True
        # Ticket generated
        assert (body.get("qr_codes") or []), "Staff booking should produce QR codes"
