"""
Boulay Beach Resort - Backend API tests
Covers: offers, auth (client + staff), availability, bookings flow, event privatization
"""
import os
import uuid
import pytest
import requests
from datetime import date, timedelta

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # fallback to frontend/.env if not exported
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
    except Exception:
        pass

API = f"{BASE_URL}/api"

# Unique test client
UNIQ = uuid.uuid4().hex[:8]
CLIENT_EMAIL = f"jean.test.{UNIQ}@example.ci"
CLIENT_PASSWORD = "Test@2026"

FUTURE_DATE = (date.today() + timedelta(days=14)).isoformat()
PAST_DATE = (date.today() - timedelta(days=2)).isoformat()


@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def client_token(session):
    # Register fresh account
    r = session.post(f"{API}/auth/client/register", json={
        "name": "Jean",
        "surname": "Test",
        "phone": "+225 07 00 00 00 00",
        "email": CLIENT_EMAIL,
        "password": CLIENT_PASSWORD,
    })
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    data = r.json()
    assert "access_token" in data and data["user"]["email"] == CLIENT_EMAIL
    return data["access_token"]


@pytest.fixture
def auth_headers(client_token):
    return {"Authorization": f"Bearer {client_token}", "Content-Type": "application/json"}


# ----- Offers -----
class TestOffers:
    def test_list_offers(self, session):
        r = session.get(f"{API}/offers")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list) and len(data) == 3
        ids = {o["id"] for o in data}
        assert ids == {"pass_day", "sunset", "brunch"}
        for o in data:
            assert "price_adult" in o and "price_child" in o and "max_capacity" in o
            assert "_id" not in o

    def test_get_offer_by_id(self, session):
        r = session.get(f"{API}/offers/pass_day")
        assert r.status_code == 200
        d = r.json()
        assert d["id"] == "pass_day"
        assert d["price_adult"] == 50000
        assert d["price_child"] == 25000
        assert d["max_capacity"] == 80

    def test_get_offer_not_found(self, session):
        r = session.get(f"{API}/offers/unknown")
        assert r.status_code == 404


# ----- Auth -----
class TestAuth:
    def test_client_register_duplicate(self, session, client_token):
        r = session.post(f"{API}/auth/client/register", json={
            "name": "Jean", "surname": "Test", "phone": "+225",
            "email": CLIENT_EMAIL, "password": CLIENT_PASSWORD,
        })
        assert r.status_code == 400

    def test_client_login_success(self, session, client_token):
        r = session.post(f"{API}/auth/client/login", json={
            "email": CLIENT_EMAIL, "password": CLIENT_PASSWORD
        })
        assert r.status_code == 200
        assert "access_token" in r.json()

    def test_client_login_invalid(self, session):
        r = session.post(f"{API}/auth/client/login", json={
            "email": CLIENT_EMAIL, "password": "wrongpass"
        })
        assert r.status_code == 401

    def test_auth_me(self, session, auth_headers):
        r = session.get(f"{API}/auth/me", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert data["email"] == CLIENT_EMAIL
        assert "password_hash" not in data
        assert "_id" not in data

    def test_auth_me_without_token(self, session):
        r = session.get(f"{API}/auth/me")
        assert r.status_code == 401

    @pytest.mark.parametrize("email,password,role", [
        ("admin@boulay.ci", "Admin@2026", "admin"),
        ("manager@boulay.ci", "Manager@2026", "manager"),
        ("reception@boulay.ci", "Reception@2026", "receptionist"),
    ])
    def test_staff_login(self, session, email, password, role):
        r = session.post(f"{API}/auth/staff/login", json={"email": email, "password": password})
        assert r.status_code == 200, f"{email}: {r.text}"
        data = r.json()
        assert data["user"]["role"] == role
        assert "access_token" in data

    def test_staff_login_wrong_password(self, session):
        r = session.post(f"{API}/auth/staff/login", json={
            "email": "admin@boulay.ci", "password": "wrong"
        })
        assert r.status_code == 401


# ----- Availability -----
class TestAvailability:
    def test_availability_returns_fields(self, session):
        r = session.get(f"{API}/availability/pass_day/{FUTURE_DATE}")
        assert r.status_code == 200
        d = r.json()
        assert d["offer_id"] == "pass_day"
        assert d["date"] == FUTURE_DATE
        assert d["max_capacity"] == 80
        assert "booked" in d and "remaining" in d
        assert d["remaining"] == d["max_capacity"] - d["booked"]

    def test_availability_unknown_offer(self, session):
        r = session.get(f"{API}/availability/unknown/{FUTURE_DATE}")
        assert r.status_code == 404


# ----- Bookings -----
class TestBookings:
    def test_create_booking_requires_auth(self, session):
        r = session.post(f"{API}/bookings", json={
            "offer_type": "pass_day", "date": FUTURE_DATE, "adults": 1, "children": 0
        })
        assert r.status_code == 401

    def test_create_booking_past_date(self, session, auth_headers):
        r = session.post(f"{API}/bookings", headers=auth_headers, json={
            "offer_type": "pass_day", "date": PAST_DATE, "adults": 1, "children": 0
        })
        assert r.status_code == 400
        assert "future" in r.json()["detail"].lower()

    def test_create_booking_bad_date_format(self, session, auth_headers):
        r = session.post(f"{API}/bookings", headers=auth_headers, json={
            "offer_type": "pass_day", "date": "not-a-date", "adults": 1, "children": 0
        })
        assert r.status_code == 400

    def test_booking_lifecycle(self, session, auth_headers):
        # Create
        r = session.post(f"{API}/bookings", headers=auth_headers, json={
            "offer_type": "pass_day", "date": FUTURE_DATE,
            "adults": 2, "children": 1, "special_requests": "window seat"
        })
        assert r.status_code == 200, r.text
        b = r.json()
        assert b["status"] == "pending"
        assert b["total_amount"] == 2 * 50000 + 1 * 25000 == 125000
        assert b["qr_code"] is None
        assert "qr_token" in b
        assert "_id" not in b
        bid = b["id"]

        # Availability reflects the booking
        av = session.get(f"{API}/availability/pass_day/{FUTURE_DATE}").json()
        assert av["booked"] >= 3

        # Pay -> confirmed + QR
        r = session.post(f"{API}/bookings/{bid}/pay", headers=auth_headers)
        assert r.status_code == 200
        paid = r.json()
        assert paid["status"] == "confirmed"
        assert paid["qr_code"] and paid["qr_code"].startswith("data:image/png;base64,")
        assert paid["paid_at"]

        # GET bookings/me
        r = session.get(f"{API}/bookings/me", headers=auth_headers)
        assert r.status_code == 200
        ids = [x["id"] for x in r.json()]
        assert bid in ids

        # GET single
        r = session.get(f"{API}/bookings/{bid}", headers=auth_headers)
        assert r.status_code == 200 and r.json()["id"] == bid

        # Cancel
        r = session.delete(f"{API}/bookings/{bid}", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["status"] == "cancelled"

        # Cancel again -> 400
        r = session.delete(f"{API}/bookings/{bid}", headers=auth_headers)
        assert r.status_code == 400

    def test_booking_capacity_check(self, session, auth_headers):
        # Request more than offer capacity (sunset max 60)
        r = session.post(f"{API}/bookings", headers=auth_headers, json={
            "offer_type": "sunset", "date": FUTURE_DATE,
            "adults": 20, "children": 20
        })
        # 40 guests is fine; try again beyond capacity
        assert r.status_code in (200, 400)
        if r.status_code == 200:
            bid = r.json()["id"]
            # second booking pushing over
            r2 = session.post(f"{API}/bookings", headers=auth_headers, json={
                "offer_type": "sunset", "date": FUTURE_DATE,
                "adults": 20, "children": 20
            })
            # 40+40 = 80 > 60 => must reject
            assert r2.status_code == 400
            # cleanup
            session.delete(f"{API}/bookings/{bid}", headers=auth_headers)


# ----- Events -----
class TestEvents:
    def test_event_privatization(self, session):
        r = session.post(f"{API}/events/privatization", json={
            "name": "Aya", "surname": "Koffi", "phone": "+225 07",
            "email": f"aya.{UNIQ}@example.ci",
            "event_type": "wedding",
            "event_date": (date.today() + timedelta(days=90)).isoformat(),
            "guest_count": 80,
            "message": "Beach ceremony"
        })
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "new"
        assert "id" in d
        assert "_id" not in d
