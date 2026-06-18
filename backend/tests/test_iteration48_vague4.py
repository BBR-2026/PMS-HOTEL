"""
Iteration 48 — Phase C · Vague 4 (Activation Bout-en-Bout)
Tests Bloc A (BookingTunnel ↔ Revenue Management), Bloc B (Auto-sync OTA),
Bloc C (Le Kaai pinasse pass).
"""
import os
import datetime as dt
import time
import pytest
import requests

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL")
            or "https://reserve-bbr.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@boulay.ci"
ADMIN_PASSWORD = "Admin@2026"


# ───────────── Fixtures ─────────────
@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/staff/login",
               json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    tok = r.json().get("token") or r.json().get("access_token")
    if tok:
        s.headers.update({"Authorization": f"Bearer {tok}"})
    return s


def _next_weekday():
    """Return next Monday or Tuesday (weekday) date string YYYY-MM-DD."""
    today = dt.date.today()
    for i in range(1, 14):
        d = today + dt.timedelta(days=i)
        if d.weekday() in (0, 1, 2, 3):  # Mon-Thu (pass_day allowed Mon-Fri but skip Fri to keep margin)
            return d.isoformat()
    return (today + dt.timedelta(days=2)).isoformat()


def _next_saturday():
    today = dt.date.today()
    for i in range(1, 14):
        d = today + dt.timedelta(days=i)
        if d.weekday() == 5:  # Saturday
            return d.isoformat()
    return (today + dt.timedelta(days=7)).isoformat()


def _next_lekaai_day():
    """Le Kaai is open every day, but skip today."""
    return (dt.date.today() + dt.timedelta(days=2)).isoformat()


PARTICIPANT = {
    "name": "Test",
    "surname": "Vague4",
    "phone": "+22507000000",
    "email": "test_vague4@example.com",
    "nationality": "CI",
}


# ───────────── Bloc A : Revenue Management × Booking ─────────────
class TestBlocARevenuePromo:

    def test_promo_sunny10_weekday(self):
        s = requests.Session()
        payload = {
            "offer_type": "pass_day",
            "date": _next_weekday(),
            "adults": 2,
            "children": 0,
            "participants": [PARTICIPANT],
            "boat_time": "10H",
            "promo_code": "SUNNY10",
        }
        r = s.post(f"{BASE_URL}/api/bookings", json=payload)
        assert r.status_code in (200, 201), f"{r.status_code} {r.text}"
        b = r.json()
        assert b.get("promo_code_used") == "SUNNY10"
        rp = b.get("rate_plan_applied")
        assert rp is not None, "rate_plan_applied should be set when promo applies"
        assert rp.get("name") == "Promo SUNNY10"
        assert rp.get("type") == "promo"
        assert rp.get("discount", 0) > 0
        # 10% off
        base = rp["base_total"]
        assert b["total_amount"] == int(round(base * 0.9))

    def test_weekend_surcharge_via_quote(self, admin_session):
        """pass_day is Mon–Fri only, so the 'Surcharge week-end' rate plan can
        never apply via a real booking (booking on Sat/Sun is refused 400).
        We instead verify the engine via /api/revenue/quote which is what the
        BookingTunnel UI calls.
        """
        saturday = _next_saturday()
        r = admin_session.get(
            f"{BASE_URL}/api/revenue/quote",
            params={"offer_key": "beach_club.pass_day", "base_price": 10000,
                    "when": saturday},
        )
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        j = r.json()
        plan = j.get("applied_plan")
        assert plan is not None, f"weekend plan should apply on Saturday: {j}"
        assert plan.get("type") == "weekend"
        assert j.get("final_price") == 12000.0  # +20%

    def test_invalid_promo_does_not_break(self):
        s = requests.Session()
        payload = {
            "offer_type": "pass_day",
            "date": _next_weekday(),
            "adults": 2,
            "children": 0,
            "participants": [PARTICIPANT],
            "boat_time": "10H",
            "promo_code": "FAKE123",
        }
        r = s.post(f"{BASE_URL}/api/bookings", json=payload)
        assert r.status_code in (200, 201), f"{r.status_code} {r.text}"
        b = r.json()
        # Either rate_plan_applied is None OR a non-promo plan (weekend if weekend),
        # but invalid promo code must NOT be reflected as a promo
        rp = b.get("rate_plan_applied")
        if rp:
            assert rp.get("type") != "promo", "invalid promo code should not match a promo plan"
        assert b.get("promo_code_used") == "FAKE123"  # echoed back as the user submitted

    def test_revenue_quote_regression(self, admin_session):
        # Quote endpoint must still discount SUNNY10 -10%
        weekday = _next_weekday()
        r = admin_session.get(
            f"{BASE_URL}/api/revenue/quote",
            params={"offer_key": "beach_club.pass_day", "base_price": 10000,
                    "when": weekday, "promo": "SUNNY10"},
        )
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        j = r.json()
        assert j.get("final_price") == 9000.0, j
        assert (j.get("applied_plan") or {}).get("type") == "promo"


# ───────────── Bloc B : Auto-sync OTA config & cron ─────────────
class TestBlocBAutoSync:

    def test_config_persists_auto_sync_fields(self, admin_session):
        payload = {
            "auto_sync_enabled": True,
            "auto_sync_on_booking": True,
            "auto_sync_default_limit": 7,
        }
        r = admin_session.put(f"{BASE_URL}/api/staff/ota/config", json=payload)
        assert r.status_code == 200, r.text
        # GET
        g = admin_session.get(f"{BASE_URL}/api/staff/ota/config")
        assert g.status_code == 200
        cfg = g.json()
        assert cfg.get("auto_sync_enabled") is True
        assert cfg.get("auto_sync_on_booking") is True
        assert cfg.get("auto_sync_default_limit") == 7

    def test_config_can_toggle_off(self, admin_session):
        # Verify False persists (i.e. not always True)
        r = admin_session.put(
            f"{BASE_URL}/api/staff/ota/config",
            json={"auto_sync_enabled": False, "auto_sync_on_booking": False, "auto_sync_default_limit": 5},
        )
        assert r.status_code == 200
        g = admin_session.get(f"{BASE_URL}/api/staff/ota/config").json()
        assert g.get("auto_sync_enabled") is False
        assert g.get("auto_sync_on_booking") is False
        assert g.get("auto_sync_default_limit") == 5

    def test_booking_trigger_logs_when_enabled(self, admin_session):
        # Enable BOTH flags — auto_push_all_mappings short-circuits when
        # auto_sync_enabled is False even if reason=direct_booking (see
        # routers/ota.py:446 — arguably a UX bug, see code review).
        admin_session.put(f"{BASE_URL}/api/staff/ota/config",
                          json={"auto_sync_enabled": True,
                                "auto_sync_on_booking": True})
        # Snapshot existing logs
        before = admin_session.get(
            f"{BASE_URL}/api/staff/ota/sync-logs?kind=availability_push"
        )
        before_items = before.json() if isinstance(before.json(), list) else before.json().get("items", [])
        before_count = len(before_items)
        # Create a public booking → must fire trigger_sync_on_booking_change
        public_session = requests.Session()
        r = public_session.post(f"{BASE_URL}/api/bookings", json={
            "offer_type": "pass_day",
            "date": _next_weekday(),
            "adults": 1, "children": 0,
            "participants": [PARTICIPANT],
            "boat_time": "10H",
        })
        assert r.status_code in (200, 201)
        # asyncio.create_task — wait up to 10s
        new_log_found = False
        for _ in range(20):
            time.sleep(0.5)
            after = admin_session.get(
                f"{BASE_URL}/api/staff/ota/sync-logs?kind=availability_push"
            )
            items = after.json() if isinstance(after.json(), list) else after.json().get("items", [])
            if len(items) > before_count:
                new_log_found = True
                users = {it.get("user", "") for it in items[:5]}
                assert any("auto:" in u for u in users), f"expected auto:* user tag, got {users}"
                break
        assert new_log_found, "no new availability_push log after direct booking"

        # Cleanup: disable both flags
        admin_session.put(f"{BASE_URL}/api/staff/ota/config",
                          json={"auto_sync_enabled": False,
                                "auto_sync_on_booking": False})

    def test_manual_availability_push_with_fake_mapping_is_graceful(self, admin_session):
        r = admin_session.post(
            f"{BASE_URL}/api/staff/ota/sync/availability",
            json={"updates": [{
                "mapping_id": "fake-mapping-id-does-not-exist",
                "start_date": dt.date.today().isoformat(),
                "end_date": (dt.date.today() + dt.timedelta(days=2)).isoformat(),
                "booking_limit": 5,
            }]},
        )
        # Must not crash → 2xx or graceful 4xx
        assert r.status_code < 500, f"server crashed: {r.status_code} {r.text}"


# ───────────── Bloc C : Le Kaai pinasse QR ─────────────
class TestBlocCPinasseQR:

    def test_le_kaai_generates_pinasse_qr(self, admin_session):
        # Create a Le Kaai booking
        s = requests.Session()
        payload = {
            "offer_type": "le_kaai",
            "date": _next_lekaai_day(),
            "adults": 2,
            "children": 1,
            "participants": [PARTICIPANT],
            "boat_time": "12H",
        }
        r = s.post(f"{BASE_URL}/api/bookings", json=payload)
        assert r.status_code in (200, 201), f"{r.status_code} {r.text}"
        b = r.json()
        booking_id = b["id"]
        reference_token = b["reference_token"]
        crossing_fee = int(b.get("crossing_fee_amount") or 0)
        if crossing_fee <= 0:
            pytest.skip("crossing_fee disabled in CMS → no pinasse QR expected")
        # Pay via mobile_money so styled_qr=True and pinasse ticket_image is generated
        pay = admin_session.post(
            f"{BASE_URL}/api/bookings/{booking_id}/pay",
            json={"reference_token": reference_token, "payment_method": "mobile_money"},
        )
        assert pay.status_code in (200, 201), f"pay failed: {pay.status_code} {pay.text}"
        # Pay response returns full booking with qr_codes (incl. qr_payload).
        # Staff GET endpoints strip qr_codes.qr_payload by projection.
        booking = pay.json()
        qrs = booking.get("qr_codes") or []
        kinds = [q.get("kind") for q in qrs]
        adult_qrs = [q for q in qrs if q.get("kind") == "adult"]
        pinasse_qrs = [q for q in qrs if q.get("kind") == "pinasse"]
        assert len(adult_qrs) >= 1, f"no adult QR found; kinds={kinds}"
        assert len(pinasse_qrs) == 1, f"expected exactly 1 pinasse QR; kinds={kinds}"
        pin = pinasse_qrs[0]
        assert pin.get("pax") == 3  # 2 adults + 1 child
        assert "pinasse" in (pin.get("qr_payload") or "")
        assert pin.get("qr_code"), "pinasse QR code missing"
        # ticket_image generated through make_ticket_image
        assert pin.get("ticket_image"), "pinasse ticket_image missing"
