"""Backend tests for Boulay Beach Resort Phase 1 (guest checkout, no auth)."""
import os
import uuid
from datetime import date, timedelta

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://reserve-bbr.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


def _next_weekday(target_weekday: int) -> str:
    """Return the next date (YYYY-MM-DD, > today) whose Python weekday matches target_weekday."""
    d = date.today() + timedelta(days=1)
    while d.weekday() != target_weekday:
        d += timedelta(days=1)
    return d.isoformat()


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---------------- Offers ----------------
class TestOffers:
    def test_list_offers_has_four(self, session):
        r = session.get(f"{API}/offers")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list) and len(data) == 4
        ids = sorted(o["id"] for o in data)
        assert ids == ["brunch", "le_kaai", "pass_day", "sunset"]

    def test_le_kaai_is_free(self, session):
        r = session.get(f"{API}/offers/le_kaai")
        assert r.status_code == 200
        d = r.json()
        assert d["price_adult"] == 0 and d["price_child"] == 0
        assert d["allowed_weekdays"] == [0, 1, 2, 3, 4, 5, 6]
        assert d["boat_times_weekday"] == ["10H", "12H", "14H", "16H", "18H", "20H"]
        assert d["boat_times_weekend"] == [f"{h}H" for h in range(10, 21)]

    def test_pass_day_weekdays_only(self, session):
        d = session.get(f"{API}/offers/pass_day").json()
        assert d["allowed_weekdays"] == [0, 1, 2, 3, 4]
        assert d["boat_times"] == ["10H", "12H", "14H", "16H", "18H", "20H"]
        assert d["price_adult"] == 50000 and d["price_child"] == 25000
        assert d["max_capacity"] == 250

    def test_sunset_saturday_only(self, session):
        d = session.get(f"{API}/offers/sunset").json()
        assert d["allowed_weekdays"] == [5]
        assert d["boat_times"] == [f"{h}H" for h in range(10, 21)]

    def test_brunch_sunday_only(self, session):
        d = session.get(f"{API}/offers/brunch").json()
        assert d["allowed_weekdays"] == [6]

    def test_unknown_offer(self, session):
        assert session.get(f"{API}/offers/nope").status_code == 404


# ---------------- Availability ----------------
class TestAvailability:
    def test_availability_shape(self, session):
        when = _next_weekday(0)  # Monday
        r = session.get(f"{API}/availability/pass_day/{when}")
        assert r.status_code == 200
        d = r.json()
        assert d["max_capacity"] == 250
        assert "remaining" in d and "booked" in d


# ---------------- Bookings: pass_day ----------------
class TestPassDayBooking:
    def test_create_pay_pass_day(self, session):
        when = _next_weekday(2)  # Wednesday
        payload = {
            "offer_type": "pass_day",
            "date": when,
            "adults": 2,
            "children": 1,
            "boat_time": "10H",
            "participants": [
                {"name": "TEST_Jean", "surname": "Dupont", "nationality": "FR", "kind": "adult"},
                {"name": "TEST_Marie", "surname": "Curie", "nationality": "FR", "kind": "adult"},
                {"name": "TEST_Leo", "surname": "Junior", "nationality": "CI", "kind": "child"},
            ],
            "phone": "+22507000000",
            "email": f"test_{uuid.uuid4().hex[:6]}@example.com",
            "special_requests": "TEST window seat",
        }
        r = session.post(f"{API}/bookings", json=payload)
        assert r.status_code == 200, r.text
        b = r.json()
        assert b["status"] == "pending"
        assert b["total_amount"] == 2 * 50000 + 1 * 25000
        assert "_id" not in b
        assert len(b["participants"]) == 3
        assert b["participants"][0]["nationality"] == "FR"

        # Pay (cash)
        r2 = session.post(
            f"{API}/bookings/{b['id']}/pay",
            json={"reference_token": b["reference_token"], "payment_method": "cash"},
        )
        assert r2.status_code == 200, r2.text
        paid = r2.json()
        assert paid["status"] == "confirmed"
        assert len(paid["qr_codes"]) == 3
        for qr in paid["qr_codes"]:
            assert qr["qr_code"].startswith("data:image/png;base64,")
            assert "guest_name" in qr and "guest_nationality" in qr
            assert qr["qr_payload"]  # JSON string

        # GET re-read with reference token
        r3 = session.get(f"{API}/bookings/{b['id']}", params={"ref": b["reference_token"]})
        assert r3.status_code == 200
        assert r3.json()["status"] == "confirmed"

        # invalid ref -> 403
        assert session.get(f"{API}/bookings/{b['id']}", params={"ref": "bad"}).status_code == 403


# ---------------- Le Kaai (free) ----------------
class TestLeKaaiBooking:
    def test_le_kaai_free_total_zero(self, session):
        when = _next_weekday(5)  # Saturday -> weekend boat times (hourly)
        payload = {
            "offer_type": "le_kaai",
            "date": when,
            "adults": 2,
            "children": 0,
            "boat_time": "13H",  # only valid on weekend for Le Kaai
            "participants": [
                {"name": "TEST_Ana", "surname": "Smith", "nationality": "US", "kind": "adult"},
                {"name": "TEST_Bob", "surname": "Smith", "nationality": "US", "kind": "adult"},
            ],
            "phone": "+22501020304",
            "email": f"kaai_{uuid.uuid4().hex[:6]}@example.com",
        }
        r = session.post(f"{API}/bookings", json=payload)
        assert r.status_code == 200, r.text
        b = r.json()
        assert b["total_amount"] == 0
        # confirm
        r2 = session.post(
            f"{API}/bookings/{b['id']}/pay",
            json={"reference_token": b["reference_token"], "payment_method": "cash"},
        )
        assert r2.status_code == 200
        paid = r2.json()
        assert paid["status"] == "confirmed"
        assert len(paid["qr_codes"]) == 2

    def test_le_kaai_weekday_uses_2h_grid(self, session):
        """On a weekday, Le Kaai must reject hourly times like '13H'."""
        when = _next_weekday(1)  # Tuesday
        payload = {
            "offer_type": "le_kaai",
            "date": when,
            "adults": 1,
            "children": 0,
            "boat_time": "13H",  # not in WEEKDAY set
            "participants": [
                {"name": "TEST_X", "surname": "Y", "nationality": "FR", "kind": "adult"},
            ],
            "phone": "+22501020304",
            "email": f"kaai_wd_{uuid.uuid4().hex[:6]}@example.com",
        }
        r = session.post(f"{API}/bookings", json=payload)
        assert r.status_code == 400
        assert "boat time" in r.text.lower() or "Allowed" in r.text


# ---------------- Day-of-week restrictions ----------------
class TestDayRestrictions:
    def test_pass_day_rejects_weekend(self, session):
        when = _next_weekday(5)  # Saturday
        payload = {
            "offer_type": "pass_day",
            "date": when,
            "adults": 1, "children": 0,
            "boat_time": "10H",
            "participants": [{"name": "TEST_a", "surname": "b", "nationality": "FR", "kind": "adult"}],
            "phone": "+22501020304",
            "email": f"pd_{uuid.uuid4().hex[:6]}@example.com",
        }
        r = session.post(f"{API}/bookings", json=payload)
        assert r.status_code == 400

    def test_sunset_only_saturday(self, session):
        when = _next_weekday(6)  # Sunday
        payload = {
            "offer_type": "sunset",
            "date": when, "adults": 1, "children": 0, "boat_time": "12H",
            "participants": [{"name": "TEST_a", "surname": "b", "nationality": "FR", "kind": "adult"}],
            "phone": "+22501020304",
            "email": f"ss_{uuid.uuid4().hex[:6]}@example.com",
        }
        r = session.post(f"{API}/bookings", json=payload)
        assert r.status_code == 400

    def test_brunch_only_sunday(self, session):
        when = _next_weekday(5)  # Saturday
        payload = {
            "offer_type": "brunch",
            "date": when, "adults": 1, "children": 0, "boat_time": "12H",
            "participants": [{"name": "TEST_a", "surname": "b", "nationality": "FR", "kind": "adult"}],
            "phone": "+22501020304",
            "email": f"br_{uuid.uuid4().hex[:6]}@example.com",
        }
        r = session.post(f"{API}/bookings", json=payload)
        assert r.status_code == 400


# ---------------- Validation ----------------
class TestValidation:
    def test_participants_count_mismatch(self, session):
        when = _next_weekday(2)
        payload = {
            "offer_type": "pass_day",
            "date": when, "adults": 2, "children": 0, "boat_time": "10H",
            "participants": [
                {"name": "TEST_a", "surname": "b", "nationality": "FR", "kind": "adult"},
            ],
            "phone": "+22501020304",
            "email": f"v_{uuid.uuid4().hex[:6]}@example.com",
        }
        r = session.post(f"{API}/bookings", json=payload)
        assert r.status_code == 400

    def test_past_date_rejected(self, session):
        past = (date.today() - timedelta(days=2)).isoformat()
        payload = {
            "offer_type": "pass_day",
            "date": past, "adults": 1, "children": 0, "boat_time": "10H",
            "participants": [{"name": "TEST_a", "surname": "b", "nationality": "FR", "kind": "adult"}],
            "phone": "+22501020304",
            "email": f"past_{uuid.uuid4().hex[:6]}@example.com",
        }
        r = session.post(f"{API}/bookings", json=payload)
        assert r.status_code == 400

    def test_bad_date_format(self, session):
        payload = {
            "offer_type": "pass_day",
            "date": "2026/01/01", "adults": 1, "children": 0, "boat_time": "10H",
            "participants": [{"name": "TEST_a", "surname": "b", "nationality": "FR", "kind": "adult"}],
            "phone": "+22501020304",
            "email": f"fmt_{uuid.uuid4().hex[:6]}@example.com",
        }
        r = session.post(f"{API}/bookings", json=payload)
        assert r.status_code in (400, 422)

    def test_invalid_email(self, session):
        when = _next_weekday(2)
        payload = {
            "offer_type": "pass_day",
            "date": when, "adults": 1, "children": 0, "boat_time": "10H",
            "participants": [{"name": "TEST_a", "surname": "b", "nationality": "FR", "kind": "adult"}],
            "phone": "+22501020304",
            "email": "not-an-email",
        }
        r = session.post(f"{API}/bookings", json=payload)
        assert r.status_code == 422


# ---------------- Event privatization ----------------
class TestEventPrivatization:
    def test_create_event_request(self, session):
        future = (date.today() + timedelta(days=60)).isoformat()
        payload = {
            "name": "TEST_Event", "surname": "Host",
            "phone": "+22500000000",
            "email": f"ev_{uuid.uuid4().hex[:6]}@example.com",
            "event_type": "wedding",
            "event_date": future,
            "guest_count": 100,
            "message": "TEST request",
        }
        r = session.post(f"{API}/events/privatization", json=payload)
        assert r.status_code == 200
        d = r.json()
        assert d["status"] == "new" and "id" in d
        assert "_id" not in d
