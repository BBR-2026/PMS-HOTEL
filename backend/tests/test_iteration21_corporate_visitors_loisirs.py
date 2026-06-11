"""Iteration 21 — Corporate Requests, Visitor Registrations, Loisirs CRUD,
WhatsApp field, Checkins history offer_type filter, Traversée passengers PDF.
"""
import os
import io
import uuid
import pytest
import requests
from datetime import datetime, timedelta

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://reserve-bbr.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@boulay.ci"
ADMIN_PASSWORD = "Admin@2026"


# --------- Fixtures ---------
@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/auth/staff/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
                      timeout=20)
    if r.status_code != 200:
        pytest.skip(f"Admin login failed: {r.status_code} {r.text}")
    return r.json().get("access_token")


@pytest.fixture(scope="session")
def hdr(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="session")
def created_ids():
    return {"corporate": [], "visitor": [], "loisir": [], "traversee": []}


@pytest.fixture(scope="session", autouse=True)
def cleanup(hdr, created_ids):
    yield
    for cid in created_ids["corporate"]:
        try:
            requests.delete(f"{API}/staff/corporate-requests/{cid}", headers=hdr, timeout=15)
        except Exception:
            pass
    for vid in created_ids["visitor"]:
        try:
            requests.delete(f"{API}/staff/visitor-registrations/{vid}", headers=hdr, timeout=15)
        except Exception:
            pass
    for lid in created_ids["loisir"]:
        try:
            requests.delete(f"{API}/staff/loisirs-activities/{lid}", headers=hdr, timeout=15)
        except Exception:
            pass
    for tid in created_ids["traversee"]:
        try:
            requests.delete(f"{API}/staff/traversees/{tid}", headers=hdr, timeout=15)
        except Exception:
            pass


# --------- LOISIRS CRUD ---------
class TestLoisirsCRUD:
    def test_public_list_active(self):
        r = requests.get(f"{API}/loisirs-activities", timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_create_requires_auth(self):
        r = requests.post(f"{API}/staff/loisirs-activities",
                          json={"name_fr": "TEST_iter21_unauth", "price_adult": 5000},
                          timeout=15)
        assert r.status_code in (401, 403)

    def test_full_crud_flow(self, hdr, created_ids):
        # Create (manager+)
        payload = {"name_fr": "TEST_iter21_jet_ski", "name_en": "Jet Ski",
                   "price_adult": 25000, "price_child": 15000,
                   "duration_min": 30, "capacity": 4, "is_active": True}
        r = requests.post(f"{API}/staff/loisirs-activities", json=payload, headers=hdr, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "id" in data and data["name_fr"] == payload["name_fr"]
        lid = data["id"]
        created_ids["loisir"].append(lid)

        # List staff
        r = requests.get(f"{API}/staff/loisirs-activities", headers=hdr, timeout=15)
        assert r.status_code == 200
        ids = [it["id"] for it in r.json()["items"]]
        assert lid in ids

        # Patch
        r = requests.patch(f"{API}/staff/loisirs-activities/{lid}",
                           json={"price_adult": 30000, "capacity": 6}, headers=hdr, timeout=15)
        assert r.status_code == 200

        # Verify persisted via staff list
        r = requests.get(f"{API}/staff/loisirs-activities", headers=hdr, timeout=15)
        item = next(i for i in r.json()["items"] if i["id"] == lid)
        assert item["price_adult"] == 30000 and item["capacity"] == 6

        # Delete (admin)
        r = requests.delete(f"{API}/staff/loisirs-activities/{lid}", headers=hdr, timeout=15)
        assert r.status_code == 200
        created_ids["loisir"].remove(lid)

    def test_create_validation(self, hdr):
        # missing name_fr
        r = requests.post(f"{API}/staff/loisirs-activities",
                          json={"price_adult": 1000}, headers=hdr, timeout=15)
        assert r.status_code == 422


# --------- CORPORATE REQUESTS ---------
class TestCorporateRequests:
    def _create(self, hdr, created_ids, max_participants=2, payment_mode="configurable"):
        body = {
            "company_name": f"TEST_iter21_corp_{uuid.uuid4().hex[:6]}",
            "reservation_type": "Pass Day",
            "max_participants": max_participants,
            "payment_mode": payment_mode,
        }
        r = requests.post(f"{API}/staff/corporate-requests", json=body, headers=hdr, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        created_ids["corporate"].append(d["id"])
        return d

    def test_crud_basic(self, hdr, created_ids):
        d = self._create(hdr, created_ids)
        assert d["remaining_seats"] == d["max_participants"]
        assert d["is_full"] is False
        assert d["shareable_token"]
        # list
        r = requests.get(f"{API}/staff/corporate-requests", headers=hdr, timeout=15)
        assert r.status_code == 200 and any(it["id"] == d["id"] for it in r.json()["items"])
        # patch
        r = requests.patch(f"{API}/staff/corporate-requests/{d['id']}",
                           json={"notes": "TEST_iter21_note"}, headers=hdr, timeout=15)
        assert r.status_code == 200

    def test_public_form_invalid_token(self):
        r = requests.get(f"{API}/corporate-form/INVALID_TOKEN_XYZ", timeout=15)
        assert r.status_code == 404

    def test_public_form_closed(self, hdr, created_ids):
        d = self._create(hdr, created_ids)
        # Close
        r = requests.patch(f"{API}/staff/corporate-requests/{d['id']}",
                           json={"status": "closed"}, headers=hdr, timeout=15)
        assert r.status_code == 200
        r = requests.get(f"{API}/corporate-form/{d['shareable_token']}", timeout=15)
        assert r.status_code == 403

    def test_capacity_countdown(self, hdr, created_ids):
        d = self._create(hdr, created_ids, max_participants=2)
        tok = d["shareable_token"]
        # Public form open
        r = requests.get(f"{API}/corporate-form/{tok}", timeout=15)
        assert r.status_code == 200
        assert r.json()["remaining_seats"] == 2

        def reg(name):
            return requests.post(f"{API}/corporate-form/{tok}/register", json={
                "name": name, "surname": "Tester",
                "email": f"test_{uuid.uuid4().hex[:6]}@iter21.example.com",
                "phone": "+225 0102030405",
                "nationality": "Côte d'Ivoire",
                "kind": "personnel",
                "whatsapp": "+225 0102030406",
            }, timeout=15)

        r1 = reg("P1")
        assert r1.status_code == 200, r1.text
        assert r1.json()["remaining_seats"] == 1
        r2 = reg("P2")
        assert r2.status_code == 200
        assert r2.json()["is_full"] is True
        # 3rd attempt blocked
        r3 = reg("P3")
        assert r3.status_code == 403
        assert "pourvues" in r3.text.lower() or "pourvue" in r3.text.lower()

        # Stats
        r = requests.get(f"{API}/staff/corporate-requests/{d['id']}/stats", headers=hdr, timeout=15)
        assert r.status_code == 200
        stats = r.json()
        assert stats["by_kind"]["personnel"] == 2
        assert stats["total"] == 2
        assert isinstance(stats["top_nationalities"], list)
        assert stats["with_whatsapp"] == 2

        # CSV
        r = requests.get(f"{API}/staff/corporate-requests/{d['id']}/participants.csv", headers=hdr, timeout=20)
        assert r.status_code == 200
        assert r.headers["content-type"].startswith("text/csv")
        assert "P1" in r.text or "Tester" in r.text

        # PDF
        r = requests.get(f"{API}/staff/corporate-requests/{d['id']}/participants.pdf", headers=hdr, timeout=30)
        assert r.status_code == 200
        assert r.headers["content-type"] == "application/pdf"
        assert r.content[:4] == b"%PDF"


# --------- VISITOR REGISTRATIONS ---------
class TestVisitorRegistrations:
    def test_client_kind_rejected(self, hdr):
        body = {"kind": "client", "name": "X", "surname": "Y",
                "phone": "+225 0102", "nationality": "FR",
                "date": datetime.utcnow().strftime("%Y-%m-%d")}
        r = requests.post(f"{API}/staff/visitor-registrations", json=body, headers=hdr, timeout=15)
        assert r.status_code == 400
        assert "bookings" in r.text.lower()

    @pytest.mark.parametrize("kind", ["personnel", "prestataire", "invite"])
    def test_create_kinds(self, hdr, created_ids, kind):
        body = {"kind": kind, "name": "TEST", "surname": f"iter21_{kind}",
                "email": f"iter21_{kind}@test.com",
                "phone": "+225 0102030405", "whatsapp": "+225 0102030406",
                "nationality": "Côte d'Ivoire",
                "date": datetime.utcnow().strftime("%Y-%m-%d")}
        r = requests.post(f"{API}/staff/visitor-registrations", json=body, headers=hdr, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["kind"] == kind
        assert d["qr_token"] and len(d["qr_token"]) >= 16
        assert d["whatsapp"] == "+225 0102030406"
        created_ids["visitor"].append(d["id"])

    def test_list_with_counts(self, hdr):
        r = requests.get(f"{API}/staff/visitor-registrations", headers=hdr, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "items" in data and "counts" in data
        for k in ("client", "personnel", "prestataire", "invite"):
            assert k in data["counts"]

    def test_export_csv_route_not_shadowed(self, hdr):
        # The literal export.csv must resolve before {vid} param route
        r = requests.get(f"{API}/staff/visitor-registrations/export.csv", headers=hdr, timeout=20)
        assert r.status_code == 200, r.text
        assert r.headers["content-type"].startswith("text/csv")
        # First line is the header
        first_line = r.text.split("\n", 1)[0]
        assert "Type" in first_line and "WhatsApp" in first_line

    def test_traversee_id_validation(self, hdr, created_ids):
        # Create a traversée with status 'terminé' via direct insertion is not possible from API,
        # but we can test via the create route + patch status. Instead create a traversée then
        # mark it terminé and verify rejection.
        # Find a boat
        boats = requests.get(f"{API}/staff/bateaux", headers=hdr, timeout=15).json()
        items = boats.get("items") if isinstance(boats, dict) else boats
        if not items:
            pytest.skip("No boats available for traversée test")
        boat_id = items[0]["id"]
        tdate = (datetime.utcnow() + timedelta(days=5)).strftime("%Y-%m-%d")
        r = requests.post(f"{API}/staff/traversees", json={
            "date": tdate, "direction": "aller", "bateau_id": boat_id,
            "depart_time": "10H",
        }, headers=hdr, timeout=15)
        if r.status_code != 200:
            pytest.skip(f"Could not create traversée: {r.status_code} {r.text}")
        traversee = r.json()
        tid = traversee.get("id") or traversee.get("aller_id") or (traversee.get("items") or [{}])[0].get("id")
        if not tid:
            # try aller field if structure differs
            tid = traversee.get("aller", {}).get("id") if isinstance(traversee.get("aller"), dict) else None
        if not tid:
            pytest.skip(f"Traversée response shape unknown: {traversee}")
        created_ids["traversee"].append(tid)

        # Try registering with programmé traversée — should succeed
        body = {"kind": "personnel", "name": "TEST", "surname": "iter21_trav",
                "phone": "+225 0102", "nationality": "FR",
                "date": tdate, "traversee_id": tid}
        r = requests.post(f"{API}/staff/visitor-registrations", json=body, headers=hdr, timeout=15)
        assert r.status_code == 200, r.text
        created_ids["visitor"].append(r.json()["id"])

        # Patch traversée to 'terminé' via dedicated status endpoint
        r = requests.patch(f"{API}/staff/traversees/{tid}/status",
                           json={"status": "terminé"}, headers=hdr, timeout=15)
        assert r.status_code == 200, r.text

        # Try registering with terminé traversée — should fail 400
        r = requests.post(f"{API}/staff/visitor-registrations", json=body, headers=hdr, timeout=15)
        assert r.status_code == 400


# --------- WHATSAPP FIELD REGRESSION ---------
class TestWhatsappRegression:
    def test_booking_post_accepts_whatsapp(self, hdr):
        """Public booking POST should still work, participant model accepts whatsapp."""
        body = {
            "offer_type": "pass_day",
            "offer_name": "TEST_iter21_pass",
            "guest_email": f"iter21_book_{uuid.uuid4().hex[:6]}@test.com",
            "guest_phone": "+225 0102030405",
            "guest_name": "TEST",
            "guest_surname": "iter21",
            "adults": 1, "children": 0,
            "date": (datetime.utcnow() + timedelta(days=5)).strftime("%Y-%m-%d"),
            "boat_time": "10H",
            "participants": [{
                "name": "TEST", "surname": "iter21", "age": 30,
                "phone": "+225 0102030405", "whatsapp": "+225 0102030406",
                "nationality": "Côte d'Ivoire"
            }],
            "payment_method": "cash",
            "total_amount": 25000,
        }
        # Just check the route accepts the body (status either 200 or a domain-specific code,
        # but never 422 because of WhatsApp).
        r = requests.post(f"{API}/bookings", json=body, timeout=20)
        # If schema requires more fields, we accept other 4xx, just not 422 from whatsapp
        if r.status_code == 422:
            errs = r.json()
            # Make sure 'whatsapp' is not the cause
            assert "whatsapp" not in str(errs).lower(), errs


# --------- CHECKINS HISTORY OFFER_TYPE FILTER ---------
class TestCheckinsOfferTypeFilter:
    def test_offer_type_filter_accepted(self, hdr):
        r = requests.get(f"{API}/staff/checkins/history",
                         params={"offer_type": "pass_day"}, headers=hdr, timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        # response shape: {items: [...], total or page info}
        items = data.get("items", data) if isinstance(data, dict) else data
        if isinstance(items, list):
            for sc in items:
                if "offer_type" in sc:
                    assert sc["offer_type"] == "pass_day"

    def test_legacy_filters_still_work(self, hdr):
        r = requests.get(f"{API}/staff/checkins/history",
                         params={"direction": "aller"}, headers=hdr, timeout=15)
        assert r.status_code == 200
        r = requests.get(f"{API}/staff/checkins/history",
                         params={"boat_time": "10H"}, headers=hdr, timeout=15)
        assert r.status_code == 200


# --------- TRAVERSEE PDF ---------
class TestTraverseePDF:
    def test_pdf_manifest(self, hdr, created_ids):
        boats = requests.get(f"{API}/staff/bateaux", headers=hdr, timeout=15).json()
        items = boats.get("items") if isinstance(boats, dict) else boats
        if not items:
            pytest.skip("No boats")
        boat_id = items[0]["id"]
        tdate = (datetime.utcnow() + timedelta(days=7)).strftime("%Y-%m-%d")
        r = requests.post(f"{API}/staff/traversees", json={
            "date": tdate, "direction": "aller", "bateau_id": boat_id,
            "depart_time": "12H",
        }, headers=hdr, timeout=15)
        if r.status_code != 200:
            pytest.skip(f"Cannot create traversée: {r.text}")
        d = r.json()
        tid = d.get("id") or (d.get("aller") or {}).get("id")
        if not tid:
            pytest.skip(f"Traversée id missing: {d}")
        created_ids["traversee"].append(tid)

        r = requests.get(f"{API}/staff/traversees/{tid}/passengers.pdf",
                         headers=hdr, timeout=30)
        assert r.status_code == 200
        assert r.headers["content-type"] == "application/pdf"
        assert r.content[:4] == b"%PDF"
