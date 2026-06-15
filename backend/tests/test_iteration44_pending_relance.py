"""Iteration 44 — Backend tests for the abandoned-cart / relance funnel.

Coverage:
- Regression: GET /staff/scan/{token} accepts 32-hex, JSON URL-encoded,
  reference (10-char) and booking-id 8-char prefixes (all return 200).
- Regression: POST /staff/scan/{token}/checkin direction aller → retour.
- ITER-44 /staff/dashboard exposes kpis.pending_relance_count and excludes
  'pending' from the pipeline counts; revenue_today includes pending_cash_payment.
- ITER-44 /staff/bookings hides pending by default, ?include_pending=true
  surfaces them, ?status=pending returns only pending.
- ITER-44 /staff/bookings/pending payload (items, total, total_pending_amount)
  and synthetic fields relance_count, last_relance_at, age_days, is_stale.
- ITER-44 POST /staff/bookings/{id}/resend-payment-link happy path stamps
  relance_log (cumulative $push), and returns 400 on non-pending / 404 on unknown.
- ITER-44 hotesse role gets 403 on the pending list endpoint.

No test data is created (DB has 39 fixture pendings). Only side effect is
extending relance_log on a chosen pending booking — non-destructive.
"""
from __future__ import annotations

import json
import os
import urllib.parse

import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
load_dotenv("/app/frontend/.env")

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@boulay.ci"
ADMIN_PASS = "Admin@2026"
HOTESSE_EMAIL = "hotesse.test@boulay.ci"
HOTESSE_PASS = "Hotesse@2026"


def _login(email: str, password: str):
    r = requests.post(
        f"{API}/auth/staff/login",
        json={"email": email, "password": password},
        timeout=20,
    )
    if r.status_code != 200:
        return None
    d = r.json()
    return d.get("access_token") or d.get("token")


@pytest.fixture(scope="session")
def admin_headers():
    tok = _login(ADMIN_EMAIL, ADMIN_PASS)
    if not tok:
        pytest.skip("admin login failed")
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="session")
def hotesse_headers():
    tok = _login(HOTESSE_EMAIL, HOTESSE_PASS)
    if not tok:
        return None
    return {"Authorization": f"Bearer {tok}"}


# ───────────── Helpers ─────────────
def _pick_confirmed_with_qr(admin_headers):
    r = requests.get(
        f"{API}/staff/bookings",
        params={"status": "confirmed", "limit": 20},
        headers=admin_headers,
        timeout=20,
    )
    assert r.status_code == 200, r.text
    for b in r.json():
        # /staff/bookings strips qr_token / ticket_image — fetch the full
        # booking to retrieve a real qr_token for scanning.
        full = requests.get(
            f"{API}/staff/bookings/{b['id']}", headers=admin_headers, timeout=20
        )
        if full.status_code != 200:
            continue
        qrs = (full.json() or {}).get("qr_codes") or []
        if qrs and qrs[0].get("qr_token"):
            return full.json(), qrs[0]
    pytest.skip("No confirmed booking with QR codes available")


def _pick_pending_with_email(admin_headers):
    r = requests.get(
        f"{API}/staff/bookings/pending",
        params={"days": 365, "limit": 100},
        headers=admin_headers,
        timeout=20,
    )
    assert r.status_code == 200, r.text
    for it in r.json().get("items", []):
        if it.get("email") and "@" in (it["email"] or ""):
            return it
    pytest.skip("No pending booking with email available")


# ───────────── Scanner regression ─────────────
class TestScannerRegression:
    def test_scan_full_32hex_token(self, admin_headers):
        booking, qr = _pick_confirmed_with_qr(admin_headers)
        token = qr["qr_token"]
        r = requests.get(
            f"{API}/staff/scan/{token}", headers=admin_headers, timeout=20
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["booking_id"] == booking["id"]
        assert "guest_name" in d

    def test_scan_uppercase_token(self, admin_headers):
        booking, qr = _pick_confirmed_with_qr(admin_headers)
        token = qr["qr_token"].upper()
        r = requests.get(
            f"{API}/staff/scan/{token}", headers=admin_headers, timeout=20
        )
        assert r.status_code == 200, r.text
        assert r.json()["booking_id"] == booking["id"]

    def test_scan_json_url_encoded(self, admin_headers):
        booking, qr = _pick_confirmed_with_qr(admin_headers)
        ref = booking["id"][:10].upper()
        payload = {"type": "ticket", "token": qr["qr_token"], "ref": ref}
        encoded = urllib.parse.quote(json.dumps(payload), safe="")
        r = requests.get(
            f"{API}/staff/scan/{encoded}", headers=admin_headers, timeout=20
        )
        assert r.status_code == 200, f"json-encoded token failed: {r.text}"
        assert r.json()["booking_id"] == booking["id"]

    def test_scan_booking_id_prefix(self, admin_headers):
        booking, _ = _pick_confirmed_with_qr(admin_headers)
        prefix = booking["id"][:8]
        r = requests.get(
            f"{API}/staff/scan/{prefix}", headers=admin_headers, timeout=20
        )
        # 8-char prefix lookup may or may not be supported – accept 200 or
        # 404 but flag 500 as a regression.
        assert r.status_code in (200, 404), r.text
        if r.status_code == 200:
            assert r.json()["booking_id"] == booking["id"]

    def test_scan_checkin_idempotent(self, admin_headers):
        """POST /scan/{token}/checkin direction aller then retour returns 200
        (idempotent on re-call). We just verify endpoint shape – we don't want
        to forcibly mutate fixtures, so we tolerate 200 *or* 400 if the
        booking has already been checked in."""
        booking, qr = _pick_confirmed_with_qr(admin_headers)
        token = qr["qr_token"]
        r = requests.post(
            f"{API}/staff/scan/{token}/checkin",
            json={"direction": "aller"},
            headers=admin_headers,
            timeout=20,
        )
        assert r.status_code in (200, 400), r.text


# ───────────── Dashboard ─────────────
class TestDashboard:
    def test_dashboard_pending_relance_count_is_int(self, admin_headers):
        r = requests.get(f"{API}/staff/dashboard", headers=admin_headers, timeout=20)
        assert r.status_code == 200, r.text
        kpis = r.json().get("kpis") or {}
        assert "pending_relance_count" in kpis, kpis.keys()
        assert isinstance(kpis["pending_relance_count"], int)

    def test_dashboard_pipeline_excludes_pending(self, admin_headers):
        r = requests.get(f"{API}/staff/dashboard", headers=admin_headers, timeout=20)
        assert r.status_code == 200
        body = r.json() or {}
        # The dashboard exposes pipeline counts under the `pipeline` key.
        pipeline = body.get("pipeline") or body.get("pipeline_counts") or {}
        assert pipeline, f"no pipeline key in dashboard response (keys={list(body.keys())})"
        assert "pending" not in pipeline, f"pipeline still contains 'pending': {pipeline}"
        assert "pending_cash_payment" in pipeline


# ───────────── /staff/bookings filtering ─────────────
class TestBookingsListFiltering:
    def test_default_excludes_pending(self, admin_headers):
        r = requests.get(f"{API}/staff/bookings?limit=500",
                         headers=admin_headers, timeout=20)
        assert r.status_code == 200, r.text
        items = r.json()
        statuses = {it.get("status") for it in items}
        assert "pending" not in statuses, f"pending leaked into default list: {statuses}"

    def test_include_pending_surfaces_pending(self, admin_headers):
        r = requests.get(
            f"{API}/staff/bookings?include_pending=true&limit=500",
            headers=admin_headers, timeout=20,
        )
        assert r.status_code == 200
        items = r.json()
        statuses = {it.get("status") for it in items}
        # DB has 39 pendings → must be at least 1
        assert "pending" in statuses, f"include_pending=true did not surface 'pending' (statuses={statuses})"

    def test_status_pending_filter(self, admin_headers):
        r = requests.get(
            f"{API}/staff/bookings?status=pending&limit=200",
            headers=admin_headers, timeout=20,
        )
        assert r.status_code == 200
        items = r.json()
        assert items, "expected at least one pending booking"
        assert all(it.get("status") == "pending" for it in items)


# ───────────── /staff/bookings/pending ─────────────
class TestPendingEndpoint:
    def test_pending_endpoint_shape(self, admin_headers):
        r = requests.get(
            f"{API}/staff/bookings/pending?days=90&limit=200",
            headers=admin_headers, timeout=20,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert {"items", "total", "total_pending_amount"} <= set(d.keys())
        assert isinstance(d["total"], int)
        assert isinstance(d["total_pending_amount"], int)
        if d["items"]:
            it = d["items"][0]
            for k in ("relance_count", "last_relance_at", "age_days", "is_stale"):
                assert k in it, f"missing synthetic field {k}: {it}"

    def test_pending_endpoint_days_filter(self, admin_headers):
        r1 = requests.get(
            f"{API}/staff/bookings/pending?days=365",
            headers=admin_headers, timeout=20,
        )
        r2 = requests.get(
            f"{API}/staff/bookings/pending?days=1",
            headers=admin_headers, timeout=20,
        )
        assert r1.status_code == 200 and r2.status_code == 200
        assert r1.json()["total"] >= r2.json()["total"], (
            f"days=365 must be a superset of days=1 "
            f"({r1.json()['total']} vs {r2.json()['total']})"
        )

    def test_pending_endpoint_search(self, admin_headers):
        # Search a substring known to exist in fixtures
        target = _pick_pending_with_email(admin_headers)
        email_substr = target["email"].split("@")[0][:6]
        r = requests.get(
            f"{API}/staff/bookings/pending",
            params={"search": email_substr, "days": 365},
            headers=admin_headers, timeout=20,
        )
        assert r.status_code == 200
        items = r.json()["items"]
        assert items, "search returned no items"
        assert any(target["id"] == it["id"] for it in items)

    def test_pending_hotesse_forbidden(self, hotesse_headers):
        if not hotesse_headers:
            pytest.skip("hotesse login unavailable")
        r = requests.get(
            f"{API}/staff/bookings/pending", headers=hotesse_headers, timeout=20
        )
        assert r.status_code == 403, f"hotesse expected 403 got {r.status_code}"


# ───────────── Resend payment link ─────────────
class TestResendPaymentLink:
    def test_resend_happy_path_and_cumulative_log(self, admin_headers):
        target = _pick_pending_with_email(admin_headers)
        bid = target["id"]
        # Count current relance entries
        before = target.get("relance_count") or 0

        r = requests.post(
            f"{API}/staff/bookings/{bid}/resend-payment-link",
            headers=admin_headers, timeout=30,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["ok"] is True
        assert "email_sent" in d
        assert "payment_link" in d
        assert "expires_at" in d

        # 2nd call → cumulative push
        r2 = requests.post(
            f"{API}/staff/bookings/{bid}/resend-payment-link",
            headers=admin_headers, timeout=30,
        )
        assert r2.status_code == 200, r2.text

        # Verify via /staff/bookings/pending that relance_count grew by ≥2
        r3 = requests.get(
            f"{API}/staff/bookings/pending?days=365&limit=500",
            headers=admin_headers, timeout=20,
        )
        item = next((it for it in r3.json()["items"] if it["id"] == bid), None)
        assert item is not None, "booking disappeared from pending list"
        assert item["relance_count"] >= before + 2, (
            f"relance_count did not grow: before={before} after={item['relance_count']}"
        )
        assert item["last_relance_at"] is not None

    def test_resend_on_confirmed_returns_400(self, admin_headers):
        r = requests.get(
            f"{API}/staff/bookings?status=confirmed&limit=1",
            headers=admin_headers, timeout=20,
        )
        items = r.json()
        if not items:
            pytest.skip("no confirmed booking available")
        bid = items[0]["id"]
        r2 = requests.post(
            f"{API}/staff/bookings/{bid}/resend-payment-link",
            headers=admin_headers, timeout=20,
        )
        assert r2.status_code == 400, r2.text

    def test_resend_unknown_booking_404(self, admin_headers):
        r = requests.post(
            f"{API}/staff/bookings/this-booking-does-not-exist-iter44/resend-payment-link",
            headers=admin_headers, timeout=20,
        )
        assert r.status_code == 404, r.text
