"""Backend tests for Boulay Beach Resort — Module 2 (Reservations back-office)."""
import os
import uuid
from datetime import date, timedelta

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://reserve-bbr.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = ("admin@boulay.ci", "Admin@2026")
MANAGER = ("manager@boulay.ci", "Manager@2026")
RECEPTION = ("reception@boulay.ci", "Reception@2026")


def _next_weekday(target: int) -> str:
    d = date.today() + timedelta(days=1)
    while d.weekday() != target:
        d += timedelta(days=1)
    return d.isoformat()


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _login(session, creds):
    r = session.post(f"{API}/auth/staff/login", json={"email": creds[0], "password": creds[1]})
    assert r.status_code == 200, f"Login failed: {r.text}"
    return r.json()["access_token"]


def H(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def admin_token(session):
    return _login(session, ADMIN)


@pytest.fixture(scope="module")
def manager_token(session):
    return _login(session, MANAGER)


@pytest.fixture(scope="module")
def reception_token(session):
    return _login(session, RECEPTION)


@pytest.fixture(scope="module")
def seeded_pass_day_booking(session):
    """Create a fresh pass_day pending+unpaid booking (not paid)."""
    when = _next_weekday(2)  # Wednesday
    payload = {
        "offer_type": "pass_day",
        "date": when,
        "adults": 2, "children": 0, "boat_time": "10H",
        "participants": [
            {"name": "TEST_M2_A", "surname": "Module2", "nationality": "FR", "kind": "adult",
             "email": f"m2a_{uuid.uuid4().hex[:6]}@example.com", "phone": "+22501020304"},
            {"name": "TEST_M2_B", "surname": "Module2", "nationality": "FR", "kind": "adult",
             "email": f"m2b_{uuid.uuid4().hex[:6]}@example.com", "phone": "+22501020304"},
        ],
    }
    r = session.post(f"{API}/bookings", json=payload)
    assert r.status_code == 200, r.text
    return r.json()


# ---------------- Role gating ----------------
class TestRoleGating:
    def test_receptionist_forbidden_list(self, session, reception_token):
        r = session.get(f"{API}/staff/bookings", headers=H(reception_token))
        assert r.status_code == 403

    def test_receptionist_forbidden_calendar(self, session, reception_token):
        r = session.get(f"{API}/staff/bookings/calendar", params={"month": "2026-05"}, headers=H(reception_token))
        assert r.status_code == 403

    def test_receptionist_forbidden_payments(self, session, reception_token):
        r = session.get(f"{API}/staff/payments/summary", headers=H(reception_token))
        assert r.status_code == 403

    def test_unauth_list(self, session):
        r = session.get(f"{API}/staff/bookings")
        assert r.status_code in (401, 403)


# ---------------- List + filters ----------------
class TestListBookings:
    def test_list_default(self, session, admin_token, seeded_pass_day_booking):
        r = session.get(f"{API}/staff/bookings", headers=H(admin_token))
        assert r.status_code == 200, r.text
        items = r.json()
        assert isinstance(items, list)
        assert len(items) >= 1
        for it in items:
            assert "_id" not in it
            assert "id" in it and "offer_type" in it and "date" in it
            # heavy QR payloads must be excluded
            for qc in (it.get("qr_codes") or []):
                assert "qr_code" not in qc
                assert "ticket_image" not in qc

    def test_filter_offer_type_pass_day(self, session, admin_token):
        r = session.get(f"{API}/staff/bookings", params={"offer_type": "pass_day"}, headers=H(admin_token))
        assert r.status_code == 200
        items = r.json()
        assert all(it["offer_type"] == "pass_day" for it in items)
        assert len(items) >= 1  # we seeded one

    def test_filter_status_pending(self, session, admin_token):
        r = session.get(f"{API}/staff/bookings", params={"status": "pending"}, headers=H(admin_token))
        assert r.status_code == 200
        for it in r.json():
            assert it["status"] == "pending"

    def test_filter_payment_unpaid(self, session, admin_token):
        r = session.get(f"{API}/staff/bookings", params={"payment_status": "unpaid"}, headers=H(admin_token))
        assert r.status_code == 200
        for it in r.json():
            assert not it.get("paid_at")

    def test_filter_payment_paid(self, session, admin_token):
        r = session.get(f"{API}/staff/bookings", params={"payment_status": "paid"}, headers=H(admin_token))
        assert r.status_code == 200
        for it in r.json():
            assert it.get("paid_at")

    def test_filter_search_by_surname(self, session, admin_token, seeded_pass_day_booking):
        r = session.get(f"{API}/staff/bookings", params={"search": "Module2"}, headers=H(admin_token))
        assert r.status_code == 200, r.text
        items = r.json()
        assert len(items) >= 1
        ids = [it["id"] for it in items]
        assert seeded_pass_day_booking["id"] in ids


# ---------------- Calendar ----------------
class TestCalendar:
    def test_calendar_for_seeded_month(self, session, admin_token, seeded_pass_day_booking):
        month = seeded_pass_day_booking["date"][:7]
        r = session.get(f"{API}/staff/bookings/calendar", params={"month": month}, headers=H(admin_token))
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["month"] == month
        assert "by_date" in body and isinstance(body["by_date"], dict)
        assert "total" in body and isinstance(body["total"], int)
        # Our seeded booking should appear under its date
        the_date = seeded_pass_day_booking["date"]
        assert the_date in body["by_date"]
        assert any(b["id"] == seeded_pass_day_booking["id"] for b in body["by_date"][the_date])

    def test_calendar_invalid_month_400(self, session, admin_token):
        r = session.get(f"{API}/staff/bookings/calendar", params={"month": "2026-5"}, headers=H(admin_token))
        assert r.status_code == 400


# ---------------- Detail ----------------
class TestDetail:
    def test_detail_ok(self, session, admin_token, seeded_pass_day_booking):
        bid = seeded_pass_day_booking["id"]
        r = session.get(f"{API}/staff/bookings/{bid}", headers=H(admin_token))
        assert r.status_code == 200, r.text
        b = r.json()
        assert b["id"] == bid
        assert "_id" not in b
        assert "participants" in b and len(b["participants"]) == 2
        # no QR base64 payloads
        for qc in (b.get("qr_codes") or []):
            assert "qr_code" not in qc
            assert "ticket_image" not in qc

    def test_detail_404(self, session, admin_token):
        r = session.get(f"{API}/staff/bookings/does-not-exist", headers=H(admin_token))
        assert r.status_code == 404


# ---------------- Status PATCH ----------------
class TestStatusPatch:
    def test_invalid_status_400(self, session, admin_token, seeded_pass_day_booking):
        r = session.patch(f"{API}/staff/bookings/{seeded_pass_day_booking['id']}/status",
                          json={"status": "foo"}, headers=H(admin_token))
        assert r.status_code == 400

    def test_confirm_pending_booking(self, session, admin_token, seeded_pass_day_booking):
        bid = seeded_pass_day_booking["id"]
        r = session.patch(f"{API}/staff/bookings/{bid}/status",
                          json={"status": "confirmed"}, headers=H(admin_token))
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "confirmed"
        # verify persistence
        d = session.get(f"{API}/staff/bookings/{bid}", headers=H(admin_token)).json()
        assert d["status"] == "confirmed"

    def test_status_404(self, session, admin_token):
        r = session.patch(f"{API}/staff/bookings/no-such-id/status",
                          json={"status": "confirmed"}, headers=H(admin_token))
        assert r.status_code == 404


# ---------------- Payment PATCH ----------------
class TestPaymentPatch:
    @pytest.fixture(scope="class")
    def unpaid_booking(self, session):
        when = _next_weekday(2)
        payload = {
            "offer_type": "pass_day", "date": when, "adults": 1, "children": 0, "boat_time": "10H",
            "participants": [
                {"name": "TEST_PAY", "surname": "Module2", "nationality": "FR", "kind": "adult",
                 "email": f"pay_{uuid.uuid4().hex[:6]}@example.com", "phone": "+22501020304"},
            ],
        }
        r = session.post(f"{API}/bookings", json=payload)
        assert r.status_code == 200, r.text
        return r.json()

    def test_mark_cash_paid_auto_confirms(self, session, admin_token, unpaid_booking):
        bid = unpaid_booking["id"]
        r = session.patch(f"{API}/staff/bookings/{bid}/payment",
                          json={"payment_method": "cash", "paid": True}, headers=H(admin_token))
        assert r.status_code == 200, r.text
        # Verify persistence
        d = session.get(f"{API}/staff/bookings/{bid}", headers=H(admin_token)).json()
        assert d.get("paid_at"), "paid_at should be set"
        assert d.get("payment_method") == "cash"
        assert d.get("status") == "confirmed"

    def test_payment_404(self, session, admin_token):
        r = session.patch(f"{API}/staff/bookings/nope/payment",
                          json={"payment_method": "cash", "paid": True}, headers=H(admin_token))
        assert r.status_code == 404


# ---------------- Payments summary ----------------
class TestPaymentsSummary:
    def test_summary_shape(self, session, admin_token):
        r = session.get(f"{API}/staff/payments/summary", headers=H(admin_token))
        assert r.status_code == 200, r.text
        s = r.json()
        for key in ("unpaid", "unpaid_count", "unpaid_total", "by_method"):
            assert key in s
        assert isinstance(s["unpaid"], list)
        assert isinstance(s["by_method"], dict)
        # by_method contains some buckets after we marked cash above
        if "cash" in s["by_method"]:
            assert s["by_method"]["cash"]["count"] >= 1
        # unpaid entries should not have paid_at
        for it in s["unpaid"]:
            assert not it.get("paid_at")
