"""
Iteration 12 — Special Events module (CRUD + booking integration) + non-regression.

Coverage:
  * Public GET /api/special-events/featured (no auth, seats_per_date).
  * Public GET /api/special-events/{event_id} (404/400).
  * Staff CRUD: create/update/feature/unfeature/duplicate/delete with role guards
    (manager+ for write, admin-only for delete, receptionist=403).
  * Booking integration: offer_type='special_event' + special_event_id valid/missing,
    date hors event_dates, boat_time hors boat_times, capacity per date,
    QR + ticket generation on /pay, deposit refused for special_event.
  * Non-regression: classic /api/bookings (pass_day, sunset, brunch, le_kaai,
    hebergement), GET /api/offers returns 5 static offers (no special_event),
    /api/staff/checkin still accepts skipper_name.
"""
import os
import uuid
from datetime import date, datetime, timedelta, timezone

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://reserve-bbr.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"email": "admin@boulay.ci", "password": "Admin@2026"}
MANAGER = {"email": "manager@boulay.ci", "password": "Manager@2026"}
RECEPTION = {"email": "reception@boulay.ci", "password": "Reception@2026"}

# Seeded event documented in agent_to_agent_context_note.
SEEDED_EVENT_ID = "a4ad1d2b-eaed-476f-8fa5-7d508b165dc4"


# ------------------------------------------------------------------ helpers
def _login(creds: dict) -> str:
    r = requests.post(f"{API}/auth/staff/login", json=creds, timeout=15)
    assert r.status_code == 200, f"login failed for {creds['email']}: {r.status_code} {r.text}"
    return r.json()["access_token"]


def _headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _next_weekday(target_weekday: int) -> str:
    """Return the ISO date of the next occurrence of target_weekday (0=Mon..6=Sun), strictly in the future."""
    today = datetime.now(timezone.utc).date()
    days_ahead = (target_weekday - today.weekday()) % 7
    if days_ahead == 0:
        days_ahead = 7
    return (today + timedelta(days=days_ahead)).isoformat()


def _participant(kind: str = "adult", i: int = 1) -> dict:
    return {
        "name": f"TEST{i}",
        "surname": "Doe",
        "email": f"test{i}.{uuid.uuid4().hex[:6]}@example.ci",
        "phone": "+225 07 00 00 00 00",
        "nationality": "Ivoirien",
        "kind": kind,
    }


# ------------------------------------------------------------------ fixtures
@pytest.fixture(scope="session")
def admin_token() -> str:
    return _login(ADMIN)


@pytest.fixture(scope="session")
def manager_token() -> str:
    return _login(MANAGER)


@pytest.fixture(scope="session")
def reception_token() -> str:
    return _login(RECEPTION)


@pytest.fixture
def fresh_event(manager_token):
    """Create a draft event tailored for the test, cleanup at teardown."""
    future_date = (datetime.now(timezone.utc).date() + timedelta(days=20)).isoformat()
    payload = {
        "title": f"TEST_evt_{uuid.uuid4().hex[:6]}",
        "subtitle": "Test subtitle",
        "description": "Test description",
        "image_url": "https://example.com/img.jpg",
        "event_dates": [future_date],
        "boat_times": ["18H", "19H"],
        "return_boat_times": ["22H"],
        "price_adult": 50000,
        "price_child": 25000,
        "capacity": 10,
        "active_from": None,
        "active_to": None,
        "cta_label": "Réserver",
        "status": "draft",
    }
    r = requests.post(f"{API}/staff/special-events", headers=_headers(manager_token), json=payload, timeout=15)
    assert r.status_code == 200, f"create event: {r.status_code} {r.text}"
    ev = r.json()
    yield ev
    # cleanup as admin (delete only works when no active bookings).
    admin_t = _login(ADMIN)
    requests.delete(f"{API}/staff/special-events/{ev['id']}", headers=_headers(admin_t), timeout=15)


# ============================================================================
# Public endpoints — Special Events
# ============================================================================
class TestPublicSpecialEvents:
    def test_get_seeded_event_public(self):
        r = requests.get(f"{API}/special-events/{SEEDED_EVENT_ID}", timeout=15)
        # The seeded event must be published & in-window for the frontend to work.
        assert r.status_code == 200, f"seeded event not reachable: {r.status_code} {r.text}"
        body = r.json()
        ev = body["event"]
        assert ev["id"] == SEEDED_EVENT_ID
        assert ev["title"] == "Saint-Valentin à Boulay"
        assert "_id" not in ev
        # seats_per_date present for upcoming dates
        assert isinstance(ev.get("seats_per_date"), dict)
        assert "boat_times" in ev and "17H" in ev["boat_times"]
        assert ev["capacity"] == 40

    def test_get_event_not_found(self):
        r = requests.get(f"{API}/special-events/00000000-0000-0000-0000-000000000000", timeout=15)
        assert r.status_code == 404

    def test_get_event_unpublished_returns_400(self, fresh_event):
        # fresh_event is draft → public GET must reject.
        r = requests.get(f"{API}/special-events/{fresh_event['id']}", timeout=15)
        assert r.status_code == 400

    def test_featured_endpoint_no_auth_required(self):
        r = requests.get(f"{API}/special-events/featured", timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert "event" in body
        # If something is featured it should contain seats_per_date dict; null is also acceptable.
        if body["event"]:
            assert "seats_per_date" in body["event"]
            assert "_id" not in body["event"]


# ============================================================================
# Staff CRUD — Role enforcement
# ============================================================================
class TestStaffSpecialEventsRBAC:
    def test_receptionist_cannot_create(self, reception_token):
        payload = {"title": "TEST_recep", "event_dates": [], "boat_times": [], "status": "draft"}
        r = requests.post(f"{API}/staff/special-events", headers=_headers(reception_token), json=payload, timeout=15)
        assert r.status_code == 403, f"expected 403, got {r.status_code} {r.text}"

    def test_unauth_cannot_create(self):
        r = requests.post(f"{API}/staff/special-events", json={"title": "x"}, timeout=15)
        assert r.status_code in (401, 403)

    def test_manager_can_list(self, manager_token):
        r = requests.get(f"{API}/staff/special-events", headers=_headers(manager_token), timeout=15)
        assert r.status_code == 200
        items = r.json()["items"]
        assert isinstance(items, list)
        # seeded event is in the list
        assert any(it.get("id") == SEEDED_EVENT_ID for it in items)
        # hydrated fields present
        for it in items:
            assert "booked_guests" in it
            assert "is_active" in it
            assert "_id" not in it

    def test_receptionist_cannot_delete(self, reception_token, fresh_event):
        r = requests.delete(
            f"{API}/staff/special-events/{fresh_event['id']}",
            headers=_headers(reception_token),
            timeout=15,
        )
        assert r.status_code == 403

    def test_manager_cannot_delete(self, manager_token, fresh_event):
        r = requests.delete(
            f"{API}/staff/special-events/{fresh_event['id']}",
            headers=_headers(manager_token),
            timeout=15,
        )
        assert r.status_code == 403


# ============================================================================
# Staff CRUD — Functional behaviour
# ============================================================================
class TestStaffSpecialEventsCRUD:
    def test_create_defaults(self, fresh_event):
        assert fresh_event["status"] == "draft"
        assert fresh_event["is_featured"] is False
        assert "created_at" in fresh_event and "updated_at" in fresh_event
        # get back via staff endpoint
        m = _login(MANAGER)
        r = requests.get(
            f"{API}/staff/special-events/{fresh_event['id']}",
            headers=_headers(m),
            timeout=15,
        )
        assert r.status_code == 200
        assert r.json()["id"] == fresh_event["id"]

    def test_patch_updates_fields_and_updated_at(self, manager_token, fresh_event):
        before = fresh_event["updated_at"]
        r = requests.patch(
            f"{API}/staff/special-events/{fresh_event['id']}",
            headers=_headers(manager_token),
            json={"title": "TEST_patched_title", "price_adult": 99000},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        ev = r.json()
        assert ev["title"] == "TEST_patched_title"
        assert ev["price_adult"] == 99000
        assert ev["updated_at"] != before

    def test_feature_unsets_others(self, manager_token, fresh_event):
        # First feature the seeded event (manager can)
        r1 = requests.post(
            f"{API}/staff/special-events/{SEEDED_EVENT_ID}/feature",
            headers=_headers(manager_token),
            timeout=15,
        )
        assert r1.status_code == 200
        # Then feature our fresh_event → seeded must drop is_featured=False
        r2 = requests.post(
            f"{API}/staff/special-events/{fresh_event['id']}/feature",
            headers=_headers(manager_token),
            timeout=15,
        )
        assert r2.status_code == 200
        # Verify
        seeded = requests.get(
            f"{API}/staff/special-events/{SEEDED_EVENT_ID}",
            headers=_headers(manager_token),
            timeout=15,
        ).json()
        fresh = requests.get(
            f"{API}/staff/special-events/{fresh_event['id']}",
            headers=_headers(manager_token),
            timeout=15,
        ).json()
        assert fresh["is_featured"] is True
        assert seeded["is_featured"] is False
        # Restore seeded as the featured one (so the frontend keeps working).
        requests.post(
            f"{API}/staff/special-events/{fresh_event['id']}/unfeature",
            headers=_headers(manager_token),
            timeout=15,
        )
        requests.post(
            f"{API}/staff/special-events/{SEEDED_EVENT_ID}/feature",
            headers=_headers(manager_token),
            timeout=15,
        )

    def test_duplicate_creates_clone(self, manager_token, fresh_event):
        r = requests.post(
            f"{API}/staff/special-events/{fresh_event['id']}/duplicate",
            headers=_headers(manager_token),
            timeout=15,
        )
        assert r.status_code == 200, r.text
        clone = r.json()
        assert clone["id"] != fresh_event["id"]
        assert clone["status"] == "draft"
        assert clone["is_featured"] is False
        assert clone["title"].endswith("(copie)")
        # cleanup the clone
        admin_t = _login(ADMIN)
        requests.delete(
            f"{API}/staff/special-events/{clone['id']}",
            headers=_headers(admin_t),
            timeout=15,
        )

    def test_delete_blocked_with_active_booking(self, admin_token):
        # Seeded event has 2 active bookings → delete must 400.
        r = requests.delete(
            f"{API}/staff/special-events/{SEEDED_EVENT_ID}",
            headers=_headers(admin_token),
            timeout=15,
        )
        assert r.status_code == 400, r.text
        assert "réservation" in r.json()["detail"].lower() or "booking" in r.json()["detail"].lower()

    def test_admin_can_delete_empty_event(self, admin_token, manager_token):
        # Create a brand new draft event (no bookings) and delete it as admin.
        future = (datetime.now(timezone.utc).date() + timedelta(days=40)).isoformat()
        r = requests.post(
            f"{API}/staff/special-events",
            headers=_headers(manager_token),
            json={
                "title": f"TEST_del_{uuid.uuid4().hex[:6]}",
                "event_dates": [future],
                "boat_times": ["18H"],
                "price_adult": 1000,
                "price_child": 500,
                "capacity": 10,
                "status": "draft",
            },
            timeout=15,
        )
        assert r.status_code == 200
        eid = r.json()["id"]
        d = requests.delete(
            f"{API}/staff/special-events/{eid}",
            headers=_headers(admin_token),
            timeout=15,
        )
        assert d.status_code == 200


# ============================================================================
# Booking integration — Special Events
# ============================================================================
class TestSpecialEventBooking:
    def _make_event(self, manager_token, **overrides):
        future = (datetime.now(timezone.utc).date() + timedelta(days=25)).isoformat()
        payload = {
            "title": f"TEST_book_{uuid.uuid4().hex[:6]}",
            "subtitle": "",
            "description": "",
            "image_url": "https://example.com/img.jpg",
            "event_dates": [future],
            "boat_times": ["18H"],
            "return_boat_times": ["22H"],
            "price_adult": 40000,
            "price_child": 20000,
            "capacity": 5,
            "cta_label": "Réserver",
            "status": "published",  # publish so it can be booked
        }
        payload.update(overrides)
        r = requests.post(f"{API}/staff/special-events", headers=_headers(manager_token), json=payload, timeout=15)
        assert r.status_code == 200, r.text
        return r.json()

    def test_missing_special_event_id_returns_400(self):
        r = requests.post(
            f"{API}/bookings",
            json={
                "offer_type": "special_event",
                "date": "2026-12-12",
                "adults": 1,
                "children": 0,
                "boat_time": "18H",
                "participants": [_participant()],
            },
            timeout=15,
        )
        assert r.status_code == 400
        assert "special_event_id" in r.json()["detail"].lower()

    def test_date_outside_event_dates(self, manager_token):
        ev = self._make_event(manager_token)
        bad_date = (datetime.now(timezone.utc).date() + timedelta(days=400)).isoformat()
        r = requests.post(
            f"{API}/bookings",
            json={
                "offer_type": "special_event",
                "special_event_id": ev["id"],
                "date": bad_date,
                "adults": 1,
                "children": 0,
                "boat_time": "18H",
                "participants": [_participant()],
            },
            timeout=15,
        )
        assert r.status_code == 400
        assert "date" in r.json()["detail"].lower()
        # cleanup
        admin_t = _login(ADMIN)
        requests.delete(f"{API}/staff/special-events/{ev['id']}", headers=_headers(admin_t), timeout=15)

    def test_boat_time_outside_boat_times(self, manager_token):
        ev = self._make_event(manager_token)
        r = requests.post(
            f"{API}/bookings",
            json={
                "offer_type": "special_event",
                "special_event_id": ev["id"],
                "date": ev["event_dates"][0],
                "adults": 1,
                "children": 0,
                "boat_time": "09H",  # not in ['18H']
                "participants": [_participant()],
            },
            timeout=15,
        )
        assert r.status_code == 400
        assert "boat" in r.json()["detail"].lower()
        admin_t = _login(ADMIN)
        requests.delete(f"{API}/staff/special-events/{ev['id']}", headers=_headers(admin_t), timeout=15)

    def test_unpublished_event_cannot_be_booked(self, manager_token):
        ev = self._make_event(manager_token, status="draft")
        r = requests.post(
            f"{API}/bookings",
            json={
                "offer_type": "special_event",
                "special_event_id": ev["id"],
                "date": ev["event_dates"][0],
                "adults": 1,
                "children": 0,
                "boat_time": "18H",
                "participants": [_participant()],
            },
            timeout=15,
        )
        assert r.status_code == 400
        admin_t = _login(ADMIN)
        requests.delete(f"{API}/staff/special-events/{ev['id']}", headers=_headers(admin_t), timeout=15)

    def test_create_book_pay_special_event(self, manager_token):
        """End-to-end: create event → book 2 adults → pay → expect QR codes."""
        ev = self._make_event(manager_token)
        evt_date = ev["event_dates"][0]
        r = requests.post(
            f"{API}/bookings",
            json={
                "offer_type": "special_event",
                "special_event_id": ev["id"],
                "date": evt_date,
                "adults": 2,
                "children": 0,
                "boat_time": "18H",
                "participants": [_participant("adult", 1), _participant("adult", 2)],
                "special_requests": "TEST_special_event_booking",
            },
            timeout=20,
        )
        assert r.status_code == 200, r.text
        booking = r.json()
        # Total amount = 2 adults × 40000
        assert booking["total_amount"] == 80000
        assert booking.get("special_event_id") == ev["id"]
        ref = booking["reference_token"]
        bid = booking["id"]

        # Deposit must be refused for special_event (not overnight).
        rdep = requests.post(
            f"{API}/bookings/{bid}/pay",
            json={"reference_token": ref, "payment_method": "deposit", "deposit_pct": 30},
            timeout=20,
        )
        assert rdep.status_code == 400

        # Card payment → expect QR codes generated (one per guest).
        rp = requests.post(
            f"{API}/bookings/{bid}/pay",
            json={"reference_token": ref, "payment_method": "card"},
            timeout=30,
        )
        assert rp.status_code == 200, rp.text
        paid = rp.json()
        assert paid["status"] == "confirmed"
        qrs = paid.get("qr_codes") or []
        assert len(qrs) >= 2, f"expected >=2 QR (one per guest), got {len(qrs)}"
        # Verify the QR PNG and ticket_image PNG are present + ticket_image hero respects event.image_url
        # (handler passes hero_url=offer.get('image_url') which equals our event's image_url).
        first = qrs[0]
        assert first.get("qr_code", "").startswith("data:image/png;base64,"), f"qr_code missing png prefix: {str(first.get('qr_code',''))[:60]}"
        assert first.get("ticket_image", "").startswith("data:image/png;base64,"), "ticket_image PNG missing"
        assert first.get("qr_token"), "qr_token missing"

        # cleanup — must cancel booking before delete; we just leave event delete blocked,
        # so we archive via status update instead.
        admin_t = _login(ADMIN)
        requests.patch(
            f"{API}/staff/special-events/{ev['id']}",
            headers=_headers(admin_t),
            json={"status": "archived"},
            timeout=15,
        )

    def test_capacity_enforced_per_date(self, manager_token):
        """capacity=5 → 4 already booked → 2 new must be refused."""
        ev = self._make_event(manager_token, capacity=5)
        evt_date = ev["event_dates"][0]
        # Book 4 adults
        r1 = requests.post(
            f"{API}/bookings",
            json={
                "offer_type": "special_event",
                "special_event_id": ev["id"],
                "date": evt_date,
                "adults": 4,
                "children": 0,
                "boat_time": "18H",
                "participants": [_participant("adult", i) for i in range(1, 5)],
            },
            timeout=20,
        )
        assert r1.status_code == 200, r1.text
        # Try to add 2 more → exceeds capacity (4 + 2 > 5).
        r2 = requests.post(
            f"{API}/bookings",
            json={
                "offer_type": "special_event",
                "special_event_id": ev["id"],
                "date": evt_date,
                "adults": 2,
                "children": 0,
                "boat_time": "18H",
                "participants": [_participant("adult", 10), _participant("adult", 11)],
            },
            timeout=20,
        )
        assert r2.status_code == 400
        assert "availability" in r2.json()["detail"].lower() or "capacity" in r2.json()["detail"].lower()
        # cleanup (archive — delete blocked due to bookings).
        admin_t = _login(ADMIN)
        requests.patch(
            f"{API}/staff/special-events/{ev['id']}",
            headers=_headers(admin_t),
            json={"status": "archived"},
            timeout=15,
        )


# ============================================================================
# Non-regression — classic flows untouched
# ============================================================================
class TestRegression:
    def test_offers_endpoint_returns_5_static_offers(self):
        r = requests.get(f"{API}/offers", timeout=15)
        assert r.status_code == 200
        offers = r.json()
        ids = sorted([o["id"] for o in offers])
        # 5 static offers
        assert ids == sorted(["pass_day", "sunset", "brunch", "le_kaai", "hebergement"]), ids
        # no 'special_event' bleeding in
        assert "special_event" not in ids

    def test_classic_pass_day_booking_still_works(self):
        # next Monday
        date_str = _next_weekday(0)
        r = requests.post(
            f"{API}/bookings",
            json={
                "offer_type": "pass_day",
                "date": date_str,
                "adults": 1,
                "children": 0,
                "boat_time": "10H",
                "participants": [_participant()],
            },
            timeout=20,
        )
        assert r.status_code == 200, r.text
        b = r.json()
        assert b["offer_type"] == "pass_day"
        assert b["status"] == "pending"
        assert "reference_token" in b
        # And the booking can be paid → QR generated.
        rp = requests.post(
            f"{API}/bookings/{b['id']}/pay",
            json={"reference_token": b["reference_token"], "payment_method": "card"},
            timeout=30,
        )
        assert rp.status_code == 200, rp.text
        assert rp.json()["status"] == "confirmed"

    def test_classic_sunset_saturday_booking(self):
        date_str = _next_weekday(5)
        r = requests.post(
            f"{API}/bookings",
            json={
                "offer_type": "sunset",
                "date": date_str,
                "adults": 1,
                "children": 0,
                "boat_time": "18H",
                "participants": [_participant()],
            },
            timeout=20,
        )
        assert r.status_code == 200, r.text

    def test_classic_brunch_sunday_booking(self):
        date_str = _next_weekday(6)
        r = requests.post(
            f"{API}/bookings",
            json={
                "offer_type": "brunch",
                "date": date_str,
                "adults": 1,
                "children": 0,
                "boat_time": "12H",
                "participants": [_participant()],
            },
            timeout=20,
        )
        assert r.status_code == 200, r.text

    def test_classic_le_kaai_booking(self):
        date_str = (datetime.now(timezone.utc).date() + timedelta(days=7)).isoformat()
        r = requests.post(
            f"{API}/bookings",
            json={
                "offer_type": "le_kaai",
                "date": date_str,
                "adults": 2,
                "children": 0,
                "boat_time": "20H" if datetime.strptime(date_str, "%Y-%m-%d").weekday() in (5, 6) else "20H",
                "participants": [_participant("adult", 1), _participant("adult", 2)],
            },
            timeout=20,
        )
        # Le Kaai allowed every day, weekday boat_times include 20H.
        assert r.status_code == 200, r.text

    def test_classic_hebergement_overnight_booking_with_deposit(self):
        # Need to pick a date that has return_boat_times available on checkout weekday.
        arrival = (datetime.now(timezone.utc).date() + timedelta(days=10)).isoformat()
        checkout = (datetime.now(timezone.utc).date() + timedelta(days=12)).isoformat()
        r = requests.post(
            f"{API}/bookings",
            json={
                "offer_type": "hebergement",
                "date": arrival,
                "checkout_date": checkout,
                "room_tier": "superieure",
                "rooms": 1,
                "adults": 2,
                "children": 0,
                "boat_time": "10H",
                "return_boat_time": "10H",
                "participants": [_participant("adult", 1), _participant("adult", 2)],
            },
            timeout=20,
        )
        assert r.status_code == 200, r.text
        b = r.json()
        # Pay deposit 30%
        rp = requests.post(
            f"{API}/bookings/{b['id']}/pay",
            json={"reference_token": b["reference_token"], "payment_method": "deposit", "deposit_pct": 30},
            timeout=30,
        )
        assert rp.status_code == 200, rp.text
        paid = rp.json()
        assert paid["status"] == "confirmed"
        # Paid amount = 30% of total
        assert int(paid["paid_amount"]) == int(round(int(paid["total_amount"]) * 0.30))

    def test_scanner_checkin_supports_skipper_name(self, manager_token):
        """Regression: previous feature — staff/checkin still accepts skipper_name kwarg."""
        # Book + pay a quick pass_day → get a QR token → checkin with skipper_name.
        date_str = _next_weekday(1)
        r = requests.post(
            f"{API}/bookings",
            json={
                "offer_type": "pass_day",
                "date": date_str,
                "adults": 1,
                "children": 0,
                "boat_time": "12H",
                "participants": [_participant()],
            },
            timeout=20,
        )
        assert r.status_code == 200, r.text
        b = r.json()
        rp = requests.post(
            f"{API}/bookings/{b['id']}/pay",
            json={"reference_token": b["reference_token"], "payment_method": "card"},
            timeout=30,
        )
        assert rp.status_code == 200, rp.text
        paid = rp.json()
        qr = (paid.get("qr_codes") or [])[0]
        token = qr.get("qr_token")
        assert token, f"No qr_token on QR: {list(qr.keys())}"
        # Call checkin endpoint with skipper_name (path /api/staff/scan/{token}/checkin).
        rc = requests.post(
            f"{API}/staff/scan/{token}/checkin",
            headers=_headers(manager_token),
            json={"skipper_name": "TEST_Skipper"},
            timeout=15,
        )
        assert rc.status_code == 200, f"unexpected status {rc.status_code}: {rc.text}"
        body = rc.json()
        # skipper_name persisted in the scan entry
        scans = (body.get("qr_codes") or [{}])[0].get("scans") or body.get("scans") or []
        text = str(body).lower()
        assert "skipper" in text or any((s or {}).get("skipper_name") == "TEST_Skipper" for s in scans), \
            f"skipper_name not reflected in response: {body}"
