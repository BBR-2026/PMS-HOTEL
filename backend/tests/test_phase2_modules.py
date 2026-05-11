"""Backend tests for BBR Phase 2 — Modules 5 (Clients/CRM), 6 (Le Kaai),
7 (Revenue), Hébergement staff, Loisirs, and Config admin."""
import os
import uuid
from datetime import date, datetime, timedelta, timezone

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://reserve-bbr.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = ("admin@boulay.ci", "Admin@2026")
MANAGER = ("manager@boulay.ci", "Manager@2026")
RECEPTION = ("reception@boulay.ci", "Reception@2026")


def _login(session, creds):
    r = session.post(f"{API}/auth/staff/login", json={"email": creds[0], "password": creds[1]})
    assert r.status_code == 200, f"Login failed: {r.text}"
    return r.json()


def _next_date(days_ahead=7):
    return (date.today() + timedelta(days=days_ahead)).isoformat()


def H(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def admin_token(session):
    return _login(session, ADMIN)["access_token"]


@pytest.fixture(scope="module")
def manager_token(session):
    return _login(session, MANAGER)["access_token"]


@pytest.fixture(scope="module")
def reception_token(session):
    return _login(session, RECEPTION)["access_token"]


# Create one paid booking we can reuse for clients/revenue tests
@pytest.fixture(scope="module")
def seed_booking(session):
    when = _next_date(8)
    email = f"phase2_{uuid.uuid4().hex[:8]}@example.com"
    payload = {
        "offer_type": "pass_day", "date": when, "adults": 2, "children": 0, "boat_time": "10H",
        "email": email, "phone": "+22501020304",
        "participants": [
            {"name": "TESTP2", "surname": "Client", "nationality": "FR", "kind": "adult",
             "email": email, "phone": "+22501020304"},
            {"name": "TESTP2", "surname": "Friend", "nationality": "FR", "kind": "adult",
             "email": email, "phone": "+22501020304"},
        ],
    }
    b = session.post(f"{API}/bookings", json=payload).json()
    assert "id" in b, b
    session.post(f"{API}/bookings/{b['id']}/pay",
                 json={"reference_token": b["reference_token"], "payment_method": "cash"})
    return {"id": b["id"], "email": email, "date": when}


# ------------------- MODULE 5: CLIENTS -------------------
class TestClients:
    def test_list_clients_manager(self, session, manager_token, seed_booking):
        r = session.get(f"{API}/staff/clients", headers=H(manager_token))
        assert r.status_code == 200
        data = r.json()
        assert "items" in data and "count" in data
        assert isinstance(data["items"], list)
        # the freshly seeded client should be present
        emails = {(it.get("email") or "").lower() for it in data["items"]}
        assert seed_booking["email"].lower() in emails

    def test_list_clients_reception_forbidden(self, session, reception_token):
        r = session.get(f"{API}/staff/clients", headers=H(reception_token))
        assert r.status_code == 403

    def test_client_detail(self, session, manager_token, seed_booking):
        r = session.get(f"{API}/staff/clients/{seed_booking['email']}", headers=H(manager_token))
        assert r.status_code == 200, r.text
        c = r.json()
        assert c["email"].lower() == seed_booking["email"].lower()
        assert c["bookings_count"] >= 1
        assert c["total_spent"] >= 50000  # 2 adults x 25000
        assert isinstance(c["bookings"], list) and len(c["bookings"]) >= 1

    def test_client_detail_404(self, session, manager_token):
        r = session.get(f"{API}/staff/clients/doesnotexist_xxxx@nowhere.com",
                        headers=H(manager_token))
        assert r.status_code == 404

    def test_clients_csv_export(self, session, manager_token):
        r = session.get(f"{API}/staff/clients/export.csv", headers=H(manager_token))
        assert r.status_code == 200
        assert "text/csv" in r.headers.get("content-type", "")
        assert "attachment" in r.headers.get("content-disposition", "").lower()
        assert "Nom,Pr" in r.text  # header line "Nom,Prénom,..."


# ------------------- MODULE 7: REVENUE -------------------
class TestRevenue:
    @pytest.mark.parametrize("period", ["day", "week", "month", "year", "all"])
    def test_revenue_periods(self, session, manager_token, period):
        r = session.get(f"{API}/staff/revenue", params={"period": period},
                        headers=H(manager_token))
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("total_revenue", "total_bookings", "avg_basket",
                  "by_offer", "by_method", "daily_trend", "top_clients"):
            assert k in d, f"missing key {k} in period={period}"
        assert isinstance(d["by_offer"], list)
        assert isinstance(d["by_method"], list)
        assert isinstance(d["daily_trend"], list)
        assert isinstance(d["top_clients"], list)

    def test_revenue_reception_forbidden(self, session, reception_token):
        r = session.get(f"{API}/staff/revenue", headers=H(reception_token))
        assert r.status_code == 403


# ------------------- MODULE 6: LE KAAI TABLES -------------------
class TestKaaiTables:
    def test_list_tables_seeds_36(self, session, manager_token):
        r = session.get(f"{API}/staff/kaai/tables", headers=H(manager_token))
        assert r.status_code == 200
        items = r.json()["items"]
        assert isinstance(items, list)
        assert len(items) >= 36  # 36 seeded by default (might have extra from prev runs)
        for t in items:
            assert "_id" not in t
            assert "id" in t and "number" in t and "capacity" in t

    def test_manager_create_table(self, session, manager_token):
        body = {"number": f"TEST_T_{uuid.uuid4().hex[:4]}", "capacity": 4,
                "zone": "Salle", "status": "active"}
        r = session.post(f"{API}/staff/kaai/tables", json=body, headers=H(manager_token))
        assert r.status_code == 200, r.text
        t = r.json()
        assert t["capacity"] == 4
        TestKaaiTables._tid = t["id"]

    def test_manager_patch_table(self, session, manager_token):
        tid = getattr(TestKaaiTables, "_tid")
        r = session.patch(f"{API}/staff/kaai/tables/{tid}",
                          json={"status": "indisponible"}, headers=H(manager_token))
        assert r.status_code == 200

    def test_manager_cannot_delete_table(self, session, manager_token):
        tid = getattr(TestKaaiTables, "_tid")
        r = session.delete(f"{API}/staff/kaai/tables/{tid}", headers=H(manager_token))
        assert r.status_code == 403

    def test_admin_can_delete_table(self, session, admin_token):
        tid = getattr(TestKaaiTables, "_tid")
        r = session.delete(f"{API}/staff/kaai/tables/{tid}", headers=H(admin_token))
        assert r.status_code == 200

    def test_kaai_day_and_assign_table(self, session, manager_token):
        # Find next Saturday for le_kaai (open 5 = Sat)
        d = date.today()
        while d.weekday() != 5:
            d += timedelta(days=1)
        if d <= date.today():
            d += timedelta(days=7)
        when = d.isoformat()
        # Create a le_kaai booking
        email = f"kaai_{uuid.uuid4().hex[:6]}@example.com"
        payload = {
            "offer_type": "le_kaai", "date": when, "adults": 2, "children": 0, "boat_time": "11H",
            "email": email, "phone": "+22501020304",
            "participants": [
                {"name": "TESTK", "surname": "A", "nationality": "FR", "kind": "adult",
                 "email": email, "phone": "+22501020304"},
                {"name": "TESTK", "surname": "B", "nationality": "FR", "kind": "adult",
                 "email": email, "phone": "+22501020304"},
            ],
        }
        b = session.post(f"{API}/bookings", json=payload).json()
        assert "id" in b, b
        # Get day
        r = session.get(f"{API}/staff/kaai/day", params={"date": when},
                        headers=H(manager_token))
        assert r.status_code == 200
        data = r.json()
        assert any(bk["id"] == b["id"] for bk in data["bookings"])
        assert len(data["tables"]) >= 1
        target_table = data["tables"][0]
        # Assign
        r = session.patch(f"{API}/staff/kaai/bookings/{b['id']}/table",
                          json={"table_id": target_table["id"]},
                          headers=H(manager_token))
        assert r.status_code == 200, r.text
        # Verify via /kaai/day
        r2 = session.get(f"{API}/staff/kaai/day", params={"date": when},
                         headers=H(manager_token))
        assigned = [bk for bk in r2.json()["bookings"] if bk["id"] == b["id"]][0]
        assert assigned.get("table_id") == target_table["id"]
        # Unassign
        r3 = session.patch(f"{API}/staff/kaai/bookings/{b['id']}/table",
                           json={"table_id": None}, headers=H(manager_token))
        assert r3.status_code == 200
        r4 = session.get(f"{API}/staff/kaai/day", params={"date": when},
                         headers=H(manager_token))
        assigned2 = [bk for bk in r4.json()["bookings"] if bk["id"] == b["id"]][0]
        assert not assigned2.get("table_id")

    def test_assign_table_404_booking(self, session, manager_token):
        r = session.patch(f"{API}/staff/kaai/bookings/nope_xxx/table",
                          json={"table_id": None}, headers=H(manager_token))
        assert r.status_code == 404


# ------------------- HEBERGEMENT -------------------
class TestHebergement:
    @pytest.fixture(scope="class")
    def heb_booking(self, session):
        arr = _next_date(10)
        chk = _next_date(13)  # 3 nights
        email = f"heb_{uuid.uuid4().hex[:6]}@example.com"
        payload = {
            "offer_type": "hebergement",
            "date": arr,
            "checkout_date": chk,
            "adults": 2, "children": 0, "boat_time": "14H",
            "return_boat_time": "11H",
            "rooms": 1,
            "room_tier": "superieure",
            "email": email, "phone": "+22501020304",
            "participants": [
                {"name": "TESTH", "surname": "Suite", "nationality": "FR", "kind": "adult",
                 "email": email, "phone": "+22501020304"},
                {"name": "TESTH", "surname": "Pair", "nationality": "FR", "kind": "adult",
                 "email": email, "phone": "+22501020304"},
            ],
        }
        r = session.post(f"{API}/bookings", json=payload)
        assert r.status_code == 200, r.text
        b = r.json()
        return {"id": b["id"], "arr": arr, "chk": chk}

    def test_today_arrivals(self, session, manager_token, heb_booking):
        r = session.get(f"{API}/staff/hebergement/today",
                        params={"date": heb_booking["arr"]}, headers=H(manager_token))
        assert r.status_code == 200, r.text
        d = r.json()
        ids_arr = {a["id"] for a in d["arrivals"]}
        assert heb_booking["id"] in ids_arr
        assert d["date"] == heb_booking["arr"]

    def test_today_departures(self, session, manager_token, heb_booking):
        r = session.get(f"{API}/staff/hebergement/today",
                        params={"date": heb_booking["chk"]}, headers=H(manager_token))
        assert r.status_code == 200
        d = r.json()
        ids_dep = {a["id"] for a in d["departures"]}
        assert heb_booking["id"] in ids_dep

    def test_today_reception_allowed(self, session, reception_token, heb_booking):
        r = session.get(f"{API}/staff/hebergement/today",
                        params={"date": heb_booking["arr"]}, headers=H(reception_token))
        assert r.status_code == 200

    def test_calendar(self, session, manager_token, heb_booking):
        month = heb_booking["arr"][:7]
        r = session.get(f"{API}/staff/hebergement/calendar",
                        params={"month": month}, headers=H(manager_token))
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["month"] == month
        assert isinstance(d["days"], list) and 28 <= len(d["days"]) <= 31
        # Each day must have schema fields
        for day in d["days"]:
            assert "date" in day and "total_rooms" in day and "by_tier" in day
        # The arrival day should have at least 1 occupied room
        arrival_day = [day for day in d["days"] if day["date"] == heb_booking["arr"]][0]
        assert arrival_day["total_rooms"] >= 1

    def test_calendar_bad_month(self, session, manager_token):
        r = session.get(f"{API}/staff/hebergement/calendar",
                        params={"month": "2025"}, headers=H(manager_token))
        assert r.status_code == 400

    def test_calendar_reception_forbidden(self, session, reception_token):
        r = session.get(f"{API}/staff/hebergement/calendar",
                        params={"month": "2026-01"}, headers=H(reception_token))
        assert r.status_code == 403


# ------------------- LOISIRS -------------------
class TestLoisirs:
    def test_list_events(self, session, manager_token):
        r = session.get(f"{API}/staff/loisirs/events", headers=H(manager_token))
        assert r.status_code == 200
        d = r.json()
        assert "items" in d and "count" in d
        assert isinstance(d["items"], list)

    def test_list_events_reception_forbidden(self, session, reception_token):
        r = session.get(f"{API}/staff/loisirs/events", headers=H(reception_token))
        assert r.status_code == 403

    def test_patch_event_404(self, session, manager_token):
        r = session.patch(f"{API}/staff/loisirs/events/nonexistent_id",
                          json={"status": "contacted"}, headers=H(manager_token))
        assert r.status_code == 404

    def test_patch_event_invalid_status(self, session, manager_token):
        r = session.patch(f"{API}/staff/loisirs/events/anything",
                          json={"status": "bogus"}, headers=H(manager_token))
        assert r.status_code == 400

    def test_patch_event_flow(self, session, manager_token):
        # Create one via public endpoint if available, otherwise skip update flow
        # Try POST /api/events or similar — fall back to direct DB skip
        r0 = session.get(f"{API}/staff/loisirs/events", headers=H(manager_token))
        items = r0.json().get("items", [])
        if not items:
            pytest.skip("No event_requests in DB to update")
        eid = items[0]["id"]
        r = session.patch(f"{API}/staff/loisirs/events/{eid}",
                          json={"status": "contacted", "notes": "TEST note"},
                          headers=H(manager_token))
        assert r.status_code == 200


# ------------------- CONFIG: USERS -------------------
class TestConfigUsers:
    def test_list_admin_only(self, session, admin_token, manager_token, reception_token):
        r = session.get(f"{API}/staff/config/users", headers=H(admin_token))
        assert r.status_code == 200
        for it in r.json()["items"]:
            assert "password_hash" not in it
        # Forbidden for manager and reception
        r2 = session.get(f"{API}/staff/config/users", headers=H(manager_token))
        assert r2.status_code == 403
        r3 = session.get(f"{API}/staff/config/users", headers=H(reception_token))
        assert r3.status_code == 403

    def test_create_login_update_delete_user(self, session, admin_token):
        email = f"test_user_{uuid.uuid4().hex[:6]}@boulay.ci"
        pwd = "TestPass@2026"
        r = session.post(f"{API}/staff/config/users",
                         json={"name": "TEST User", "email": email, "password": pwd,
                               "role": "receptionist"},
                         headers=H(admin_token))
        assert r.status_code == 200, r.text
        created = r.json()
        uid = created["id"]
        assert created["email"] == email
        assert "password_hash" not in created

        # Created user can log in
        s2 = requests.Session()
        s2.headers.update({"Content-Type": "application/json"})
        login = s2.post(f"{API}/auth/staff/login",
                        json={"email": email, "password": pwd})
        assert login.status_code == 200, login.text
        assert login.json()["user"]["role"] == "receptionist"

        # Duplicate email rejected
        r_dup = session.post(f"{API}/staff/config/users",
                             json={"name": "Dup", "email": email, "password": pwd,
                                   "role": "receptionist"}, headers=H(admin_token))
        assert r_dup.status_code == 400

        # Password too short
        r_short = session.post(f"{API}/staff/config/users",
                               json={"name": "X", "email": f"x{uuid.uuid4().hex[:4]}@b.ci",
                                     "password": "123", "role": "receptionist"},
                               headers=H(admin_token))
        assert r_short.status_code in (400, 422)

        # PATCH role -> manager
        r_u = session.patch(f"{API}/staff/config/users/{uid}",
                            json={"role": "manager"}, headers=H(admin_token))
        assert r_u.status_code == 200

        # Verify by listing
        r_l = session.get(f"{API}/staff/config/users", headers=H(admin_token))
        target = [u for u in r_l.json()["items"] if u["id"] == uid][0]
        assert target["role"] == "manager"

        # PATCH password and re-login
        new_pwd = "NewPass@2027"
        r_p = session.patch(f"{API}/staff/config/users/{uid}",
                            json={"password": new_pwd}, headers=H(admin_token))
        assert r_p.status_code == 200
        l2 = s2.post(f"{API}/auth/staff/login",
                     json={"email": email, "password": new_pwd})
        assert l2.status_code == 200

        # DELETE
        r_d = session.delete(f"{API}/staff/config/users/{uid}", headers=H(admin_token))
        assert r_d.status_code == 200
        # Re-login should now fail
        l3 = s2.post(f"{API}/auth/staff/login",
                     json={"email": email, "password": new_pwd})
        assert l3.status_code == 401

    def test_admin_cannot_delete_self(self, session, admin_token):
        r = session.get(f"{API}/staff/config/users", headers=H(admin_token))
        admin = [u for u in r.json()["items"] if u["email"] == ADMIN[0]][0]
        r2 = session.delete(f"{API}/staff/config/users/{admin['id']}",
                            headers=H(admin_token))
        assert r2.status_code == 400


# ------------------- CONFIG: OFFER OVERRIDES -------------------
class TestConfigOffers:
    def test_list_offers_admin(self, session, admin_token, manager_token):
        r = session.get(f"{API}/staff/config/offers", headers=H(admin_token))
        assert r.status_code == 200
        items = r.json()["items"]
        ids = {o["id"] for o in items}
        assert {"pass_day", "sunset", "brunch", "le_kaai", "hebergement"}.issubset(ids)
        # Forbidden for manager
        r2 = session.get(f"{API}/staff/config/offers", headers=H(manager_token))
        assert r2.status_code == 403

    def test_offer_override_and_public_reflects(self, session, admin_token):
        # Capture current pass_day price (public)
        r_pub = session.get(f"{API}/offers/pass_day")
        assert r_pub.status_code == 200
        original_price = r_pub.json()["price_adult"]
        new_price = original_price + 1234
        try:
            # Apply override
            r_up = session.patch(f"{API}/staff/config/offers/pass_day",
                                 json={"price_adult": new_price},
                                 headers=H(admin_token))
            assert r_up.status_code == 200, r_up.text
            # Public endpoint must reflect new price
            r_pub2 = session.get(f"{API}/offers/pass_day")
            assert r_pub2.status_code == 200
            assert r_pub2.json()["price_adult"] == new_price
        finally:
            # Restore original price
            session.patch(f"{API}/staff/config/offers/pass_day",
                          json={"price_adult": original_price}, headers=H(admin_token))
            r_final = session.get(f"{API}/offers/pass_day")
            assert r_final.json()["price_adult"] == original_price

    def test_offer_override_404(self, session, admin_token):
        r = session.patch(f"{API}/staff/config/offers/nonexistent_offer",
                          json={"price_adult": 1000}, headers=H(admin_token))
        assert r.status_code == 404
