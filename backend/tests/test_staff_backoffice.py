"""Backend tests for Boulay Beach Resort Staff Back-office (Modules 1, 3, 4)."""
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


def _next_weekday(target_weekday: int) -> str:
    d = date.today() + timedelta(days=1)
    while d.weekday() != target_weekday:
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
    return r.json()


@pytest.fixture(scope="module")
def admin_token(session):
    return _login(session, ADMIN)["access_token"]


@pytest.fixture(scope="module")
def manager_token(session):
    return _login(session, MANAGER)["access_token"]


@pytest.fixture(scope="module")
def reception_token(session):
    return _login(session, RECEPTION)["access_token"]


def H(token):
    return {"Authorization": f"Bearer {token}"}


# ---------------- Auth ----------------
class TestStaffAuth:
    def test_admin_login_ok(self, session):
        data = _login(session, ADMIN)
        assert "access_token" in data and data.get("user", {}).get("role") == "admin"

    def test_manager_login_ok(self, session):
        data = _login(session, MANAGER)
        assert data["user"]["role"] == "manager"

    def test_reception_login_ok(self, session):
        data = _login(session, RECEPTION)
        assert data["user"]["role"] == "receptionist"

    def test_bad_password_401(self, session):
        r = session.post(f"{API}/auth/staff/login", json={"email": ADMIN[0], "password": "wrong"})
        assert r.status_code == 401

    def test_dashboard_requires_auth(self, session):
        r = session.get(f"{API}/staff/dashboard")
        assert r.status_code in (401, 403)


# ---------------- Dashboard (Module 1) ----------------
class TestDashboard:
    def test_dashboard_with_admin(self, session, admin_token):
        r = session.get(f"{API}/staff/dashboard", headers=H(admin_token))
        assert r.status_code == 200, r.text
        d = r.json()
        assert "kpis" in d
        for k in ("bookings_today", "revenue_today", "guests_today", "crossings_today"):
            assert k in d["kpis"]
        assert "bookings_today" in d and isinstance(d["bookings_today"], list)
        assert "pipeline" in d
        assert "alerts" in d
        assert "imminent_arrivals" in d["alerts"]
        assert "unpaid_bookings" in d["alerts"]


# ---------------- Bateaux CRUD (Module 3) ----------------
class TestBateaux:
    def test_list_seeded(self, session, admin_token):
        r = session.get(f"{API}/staff/bateaux", headers=H(admin_token))
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list) and len(items) >= 3
        # excluded _id
        for b in items:
            assert "_id" not in b
            assert "id" in b and "name" in b and "capacity" in b

    def test_manager_can_create(self, session, manager_token):
        r = session.post(f"{API}/staff/bateaux", json={"name": f"TEST_Boat_{uuid.uuid4().hex[:6]}", "capacity": 20, "status": "actif"}, headers=H(manager_token))
        assert r.status_code == 200, r.text
        b = r.json()
        assert b["capacity"] == 20
        assert "id" in b
        # cleanup later via admin
        TestBateaux._created_id = b["id"]

    def test_manager_can_patch(self, session, manager_token):
        bid = getattr(TestBateaux, "_created_id", None)
        assert bid
        r = session.patch(f"{API}/staff/bateaux/{bid}", json={"status": "maintenance"}, headers=H(manager_token))
        assert r.status_code == 200

    def test_manager_cannot_delete(self, session, manager_token):
        bid = getattr(TestBateaux, "_created_id", None)
        assert bid
        r = session.delete(f"{API}/staff/bateaux/{bid}", headers=H(manager_token))
        assert r.status_code == 403

    def test_admin_can_delete(self, session, admin_token):
        bid = getattr(TestBateaux, "_created_id", None)
        assert bid
        r = session.delete(f"{API}/staff/bateaux/{bid}", headers=H(admin_token))
        assert r.status_code == 200


# ---------------- Traversées + Embarquement (Module 3) ----------------
class TestTraversees:
    @pytest.fixture(scope="class")
    def setup_crossing(self, session, manager_token, admin_token):
        # Pick the first available bateau
        bateaux = session.get(f"{API}/staff/bateaux", headers=H(admin_token)).json()
        bateau = bateaux[0]
        when = _next_weekday(2)  # Wednesday
        r = session.post(
            f"{API}/staff/traversees",
            json={"bateau_id": bateau["id"], "date": when, "depart_time": "10H", "direction": "aller"},
            headers=H(manager_token),
        )
        assert r.status_code == 200, r.text
        aller = r.json()
        return {"bateau": bateau, "date": when, "aller": aller}

    def test_create_crossing_creates_return(self, session, admin_token, setup_crossing):
        # The fixture already created the aller; check both exist for that date
        when = setup_crossing["date"]
        r = session.get(f"{API}/staff/traversees", params={"date": when}, headers=H(admin_token))
        assert r.status_code == 200
        items = r.json()
        bateau_id = setup_crossing["bateau"]["id"]
        my_items = [c for c in items if c["bateau_id"] == bateau_id]
        directions = {c["direction"] for c in my_items}
        assert "aller" in directions and "retour" in directions, my_items
        # Hydration check
        for c in my_items:
            assert "bateau" in c
            assert "passengers" in c
            assert "passenger_count" in c

    def test_status_update(self, session, admin_token, setup_crossing):
        when = setup_crossing["date"]
        items = session.get(f"{API}/staff/traversees", params={"date": when}, headers=H(admin_token)).json()
        target = [c for c in items if c["bateau_id"] == setup_crossing["bateau"]["id"] and c["direction"] == "aller"][0]
        r = session.patch(f"{API}/staff/traversees/{target['id']}/status", json={"status": "en_cours"}, headers=H(admin_token))
        assert r.status_code == 200

    def test_board_and_unboard(self, session, admin_token, reception_token, setup_crossing):
        # Need a booking on same date
        when = setup_crossing["date"]
        payload = {
            "offer_type": "pass_day",
            "date": when,
            "adults": 2, "children": 0, "boat_time": "10H",
            "participants": [
                {"name": "TEST_E", "surname": "Bark", "nationality": "FR", "kind": "adult", "email": f"e_{uuid.uuid4().hex[:6]}@example.com", "phone": "+22501020304"},
                {"name": "TEST_F", "surname": "Bark", "nationality": "FR", "kind": "adult", "email": f"f_{uuid.uuid4().hex[:6]}@example.com", "phone": "+22501020304"},
            ],
        }
        b = session.post(f"{API}/bookings", json=payload).json()
        # pay
        session.post(f"{API}/bookings/{b['id']}/pay", json={"reference_token": b["reference_token"], "payment_method": "cash"})

        items = session.get(f"{API}/staff/traversees", params={"date": when}, headers=H(admin_token)).json()
        target = [c for c in items if c["bateau_id"] == setup_crossing["bateau"]["id"] and c["direction"] == "aller"][0]

        # Board with receptionist
        r = session.post(f"{API}/staff/traversees/{target['id']}/board", json={"booking_id": b["id"]}, headers=H(reception_token))
        assert r.status_code == 200, r.text
        assert r.json().get("guests_boarded") == 2

        # Booking now marked as arrived
        # (verify via dashboard or refetch via traversees endpoint)
        items2 = session.get(f"{API}/staff/traversees", params={"date": when}, headers=H(admin_token)).json()
        my = [c for c in items2 if c["id"] == target["id"]][0]
        assert my["passenger_count"] >= 2
        assert any(p["booking_id"] == b["id"] for p in my["passengers"])

        # Unboard
        r2 = session.delete(f"{API}/staff/traversees/{target['id']}/board/{b['id']}", headers=H(reception_token))
        assert r2.status_code == 200

    def test_capacity_exceeded(self, session, admin_token, manager_token, reception_token):
        # Create a tiny boat (capacity 1) and try to board 2 guests
        r = session.post(f"{API}/staff/bateaux", json={"name": f"TEST_Tiny_{uuid.uuid4().hex[:4]}", "capacity": 1, "status": "actif"}, headers=H(manager_token))
        tiny = r.json()
        when = _next_weekday(3)
        cross = session.post(f"{API}/staff/traversees", json={"bateau_id": tiny["id"], "date": when, "depart_time": "10H", "direction": "aller"}, headers=H(manager_token)).json()

        # Build a 2-pax booking
        payload = {
            "offer_type": "pass_day", "date": when, "adults": 2, "children": 0, "boat_time": "10H",
            "participants": [
                {"name": "TEST_C1", "surname": "X", "nationality": "FR", "kind": "adult", "email": f"c1_{uuid.uuid4().hex[:6]}@example.com", "phone": "+22501020304"},
                {"name": "TEST_C2", "surname": "X", "nationality": "FR", "kind": "adult", "email": f"c2_{uuid.uuid4().hex[:6]}@example.com", "phone": "+22501020304"},
            ],
        }
        b = session.post(f"{API}/bookings", json=payload).json()
        r = session.post(f"{API}/staff/traversees/{cross['id']}/board", json={"booking_id": b["id"]}, headers=H(reception_token))
        assert r.status_code == 400
        # Cleanup
        session.delete(f"{API}/staff/bateaux/{tiny['id']}", headers=H(admin_token))


# ---------------- Scanner (Module 4) ----------------
class TestScanner:
    @pytest.fixture(scope="class")
    def paid_booking(self, session):
        when = _next_weekday(2)
        payload = {
            "offer_type": "pass_day", "date": when, "adults": 1, "children": 0, "boat_time": "10H",
            "participants": [{"name": "TEST_Scan", "surname": "QR", "nationality": "FR", "kind": "adult", "email": f"sc_{uuid.uuid4().hex[:6]}@example.com", "phone": "+22501020304"}],
        }
        b = session.post(f"{API}/bookings", json=payload).json()
        paid = session.post(f"{API}/bookings/{b['id']}/pay", json={"reference_token": b["reference_token"], "payment_method": "cash"}).json()
        return paid

    def test_scan_valid_token(self, session, reception_token, paid_booking):
        qr_token = paid_booking["qr_codes"][0]["qr_token"]
        r = session.get(f"{API}/staff/scan/{qr_token}", headers=H(reception_token))
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["booking_id"] == paid_booking["id"]
        assert d["guest_name"] == "TEST_Scan"
        assert "offer_name" in d and "date" in d

    def test_scan_invalid_token(self, session, reception_token):
        r = session.get(f"{API}/staff/scan/invalid_token_xxx", headers=H(reception_token))
        assert r.status_code == 404

    def test_mark_arrived(self, session, reception_token, paid_booking):
        r = session.post(f"{API}/staff/bookings/{paid_booking['id']}/arrived", headers=H(reception_token))
        assert r.status_code == 200

    def test_scan_requires_auth(self, session, paid_booking):
        qr_token = paid_booking["qr_codes"][0]["qr_token"]
        r = session.get(f"{API}/staff/scan/{qr_token}")
        assert r.status_code in (401, 403)


# ---------------- Public portal regression ----------------
class TestPublicRegression:
    def test_offers_still_work(self, session):
        r = session.get(f"{API}/offers")
        assert r.status_code == 200
        offers = r.json()
        ids = {o["id"] for o in offers}
        # Phase 2 may add hebergement; ensure the 4 originals are still present
        assert {"pass_day", "sunset", "brunch", "le_kaai"}.issubset(ids)

    def test_pass_day_full_flow(self, session):
        when = _next_weekday(2)
        payload = {
            "offer_type": "pass_day", "date": when, "adults": 1, "children": 0, "boat_time": "12H",
            "participants": [{"name": "TEST_R", "surname": "G", "nationality": "FR", "kind": "adult", "email": f"r_{uuid.uuid4().hex[:6]}@example.com", "phone": "+22501020304"}],
        }
        b = session.post(f"{API}/bookings", json=payload).json()
        assert b["total_amount"] == 50000
        p = session.post(f"{API}/bookings/{b['id']}/pay", json={"reference_token": b["reference_token"], "payment_method": "cash"})
        assert p.status_code == 200
        assert p.json()["status"] == "confirmed"

    def test_le_kaai_free_flow(self, session):
        when = _next_weekday(5)  # Saturday
        payload = {
            "offer_type": "le_kaai", "date": when, "adults": 2, "children": 0, "boat_time": "11H",
            "participants": [
                {"name": "TEST_K1", "surname": "X", "nationality": "FR", "kind": "adult", "email": f"k1_{uuid.uuid4().hex[:6]}@example.com", "phone": "+22501020304"},
                {"name": "TEST_K2", "surname": "X", "nationality": "FR", "kind": "adult", "email": f"k2_{uuid.uuid4().hex[:6]}@example.com", "phone": "+22501020304"},
            ],
        }
        b = session.post(f"{API}/bookings", json=payload).json()
        assert b["total_amount"] == 0
        p = session.post(f"{API}/bookings/{b['id']}/pay", json={"reference_token": b["reference_token"], "payment_method": "cash"})
        assert p.status_code == 200
