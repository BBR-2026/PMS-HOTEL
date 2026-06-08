"""Iteration 20 — Fleet management (fuel litres on boats), Skipper CRUD,
PATCH/DELETE on scheduled traversées, fleet block in /stats/advanced."""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@boulay.ci"
ADMIN_PASSWORD = "Admin@2026"

TEST_PREFIX = "TEST_iter20_"


# ---------- Fixtures ----------
@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/auth/staff/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    if r.status_code != 200:
        pytest.skip(f"Cannot login as admin: {r.status_code} {r.text}")
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def created_state():
    """Track created entities for cleanup."""
    return {"skippers": [], "boats": [], "traversees": []}


@pytest.fixture(scope="session", autouse=True)
def cleanup(created_state, auth_headers):
    yield
    for tid in created_state["traversees"]:
        try:
            requests.delete(f"{API}/staff/traversees/{tid}", headers=auth_headers, timeout=10)
        except Exception:
            pass
    for sid in created_state["skippers"]:
        try:
            requests.delete(f"{API}/staff/skippers/{sid}", headers=auth_headers, timeout=10)
        except Exception:
            pass
    for bid in created_state["boats"]:
        try:
            requests.delete(f"{API}/staff/bateaux/{bid}", headers=auth_headers, timeout=10)
        except Exception:
            pass


# ---------- 1) Boat fuel_litres_per_trip ----------
class TestBoatFuel:
    def test_create_boat_with_fuel(self, auth_headers, created_state):
        name = f"{TEST_PREFIX}Boat_{uuid.uuid4().hex[:6]}"
        r = requests.post(
            f"{API}/staff/bateaux",
            headers=auth_headers,
            json={"name": name, "capacity": 30, "status": "actif", "fuel_litres_per_trip": 75},
            timeout=10,
        )
        assert r.status_code in (200, 201), r.text
        data = r.json()
        assert data.get("name") == name
        assert data.get("fuel_litres_per_trip") == 75
        created_state["boats"].append(data["id"])

    def test_patch_boat_fuel(self, auth_headers, created_state):
        # Use the most recently created TEST_ boat
        assert created_state["boats"], "No boat created yet"
        bid = created_state["boats"][-1]
        r = requests.patch(
            f"{API}/staff/bateaux/{bid}",
            headers=auth_headers,
            json={"fuel_litres_per_trip": 42},
            timeout=10,
        )
        assert r.status_code == 200, r.text
        # GET list and verify persisted
        gr = requests.get(f"{API}/staff/bateaux", headers=auth_headers, timeout=10)
        assert gr.status_code == 200
        items = gr.json().get("items") if isinstance(gr.json(), dict) else gr.json()
        if isinstance(items, dict):
            items = items.get("items", [])
        target = next((b for b in items if b["id"] == bid), None)
        assert target is not None
        assert target["fuel_litres_per_trip"] == 42

    def test_legacy_boats_default_zero(self, auth_headers):
        r = requests.get(f"{API}/staff/bateaux", headers=auth_headers, timeout=10)
        assert r.status_code == 200
        items = r.json()
        if isinstance(items, dict):
            items = items.get("items", [])
        # Each boat must expose the field
        for b in items:
            assert "fuel_litres_per_trip" in b, f"Boat {b.get('name')} missing fuel field"
            assert isinstance(b["fuel_litres_per_trip"], int)


# ---------- 2) Skipper CRUD ----------
class TestSkipperCRUD:
    def test_create_skipper(self, auth_headers, created_state):
        name = f"{TEST_PREFIX}Skip_{uuid.uuid4().hex[:6]}"
        r = requests.post(
            f"{API}/staff/skippers",
            headers=auth_headers,
            json={"name": name, "phone": "+225 07 11 22 33", "license_no": "LIC-X"},
            timeout=10,
        )
        assert r.status_code in (200, 201), r.text
        data = r.json()
        assert data["name"] == name
        assert data["status"] == "actif"
        assert "id" in data
        created_state["skippers"].append(data["id"])

    def test_list_returns_items_shape(self, auth_headers, created_state):
        r = requests.get(f"{API}/staff/skippers", headers=auth_headers, timeout=10)
        assert r.status_code == 200
        body = r.json()
        assert isinstance(body, dict) and "items" in body, f"Expected {{items:[...]}}, got {body}"
        assert isinstance(body["items"], list)
        # The created skipper must appear with a `name`
        ids = {s["id"] for s in body["items"] if "id" in s}
        assert created_state["skippers"][-1] in ids
        for s in body["items"]:
            assert "name" in s, "scanner relies on s.name"

    def test_patch_skipper(self, auth_headers, created_state):
        sid = created_state["skippers"][-1]
        r = requests.patch(
            f"{API}/staff/skippers/{sid}",
            headers=auth_headers,
            json={"phone": "+225 07 99 99 99"},
            timeout=10,
        )
        assert r.status_code == 200, r.text
        # Verify by re-listing
        lr = requests.get(f"{API}/staff/skippers", headers=auth_headers, timeout=10).json()
        target = next(s for s in lr["items"] if s["id"] == sid)
        assert target["phone"] == "+225 07 99 99 99"

    def test_duplicate_name_409(self, auth_headers, created_state):
        sid = created_state["skippers"][-1]
        # fetch its name
        lr = requests.get(f"{API}/staff/skippers", headers=auth_headers, timeout=10).json()
        name = next(s["name"] for s in lr["items"] if s["id"] == sid)
        # Same name, different case
        r = requests.post(
            f"{API}/staff/skippers",
            headers=auth_headers,
            json={"name": name.upper()},
            timeout=10,
        )
        assert r.status_code == 409, f"Expected 409 for duplicate, got {r.status_code}: {r.text}"

    def test_recent_endpoint_separate(self, auth_headers):
        r = requests.get(f"{API}/staff/skippers/recent", headers=auth_headers, timeout=10)
        assert r.status_code == 200
        body = r.json()
        # Recent endpoint returns free-text aggregated names
        assert isinstance(body, dict)


# ---------- 3) Traversée with skipper_id + PATCH/DELETE ----------
class TestTraverseeSkipperAndEdit:
    @pytest.fixture(scope="class")
    def boat_id(self, auth_headers, created_state):
        # Use first TEST_ boat if any, else fetch the first existing one
        r = requests.get(f"{API}/staff/bateaux", headers=auth_headers, timeout=10)
        items = r.json()
        if isinstance(items, dict):
            items = items.get("items", [])
        actif = [b for b in items if b.get("status") == "actif"]
        assert actif, "No active boat available"
        return actif[0]["id"]

    @pytest.fixture(scope="class")
    def skipper_id(self, auth_headers, created_state):
        # Create a dedicated skipper for these tests
        name = f"{TEST_PREFIX}Trav_{uuid.uuid4().hex[:6]}"
        r = requests.post(
            f"{API}/staff/skippers",
            headers=auth_headers,
            json={"name": name},
            timeout=10,
        )
        assert r.status_code in (200, 201), r.text
        sid = r.json()["id"]
        created_state["skippers"].append(sid)
        return sid

    def test_create_traversee_with_skipper(self, auth_headers, created_state, boat_id, skipper_id):
        r = requests.post(
            f"{API}/staff/traversees",
            headers=auth_headers,
            json={
                "bateau_id": boat_id,
                "date": "2026-01-15",
                "depart_time": "09H00",
                "direction": "aller",
                "skipper_id": skipper_id,
                "return_time": "17H00",
            },
            timeout=10,
        )
        assert r.status_code in (200, 201), r.text
        body = r.json()
        # body may be {ok:True, traversee:{...}, retour:{...}} or similar
        # Look up via list to verify persistence
        lr = requests.get(
            f"{API}/staff/traversees?date=2026-01-15", headers=auth_headers, timeout=10
        )
        assert lr.status_code == 200
        items = lr.json()
        if isinstance(items, dict):
            items = items.get("items", [])
        # Persist for cleanup + later tests
        ours = [t for t in items if t.get("bateau_id") == boat_id and t.get("date") == "2026-01-15"]
        assert len(ours) >= 2, f"Expected aller+retour, got {len(ours)}"
        aller = next(t for t in ours if t["direction"] == "aller")
        retour = next(t for t in ours if t["direction"] == "retour")
        assert aller["skipper_id"] == skipper_id
        assert aller.get("skipper_name")
        # Skipper should flow to auto-created return leg
        assert retour["skipper_id"] == skipper_id, "return leg should inherit skipper"
        # Track for cleanup (delete aller — should cascade)
        created_state["traversees"].append(aller["id"])
        # Save IDs on the class for next tests
        TestTraverseeSkipperAndEdit._aller_id = aller["id"]
        TestTraverseeSkipperAndEdit._retour_id = retour["id"]

    def test_skipper_not_found_404(self, auth_headers, boat_id):
        r = requests.post(
            f"{API}/staff/traversees",
            headers=auth_headers,
            json={
                "bateau_id": boat_id,
                "date": "2026-01-16",
                "depart_time": "10H00",
                "direction": "aller",
                "skipper_id": "nonexistent-uuid-xxx",
            },
            timeout=10,
        )
        assert r.status_code == 404, f"Expected 404, got {r.status_code}: {r.text}"

    def test_patch_traversee_depart_and_skipper(self, auth_headers, created_state, skipper_id):
        tid = TestTraverseeSkipperAndEdit._aller_id
        # Change depart_time and clear skipper
        r = requests.patch(
            f"{API}/staff/traversees/{tid}",
            headers=auth_headers,
            json={"depart_time": "10H30", "skipper_clear": True},
            timeout=10,
        )
        assert r.status_code == 200, r.text
        # Verify
        lr = requests.get(
            f"{API}/staff/traversees?date=2026-01-15", headers=auth_headers, timeout=10
        ).json()
        items = lr if isinstance(lr, list) else lr.get("items", [])
        target = next(t for t in items if t["id"] == tid)
        assert target["depart_time"].upper().replace(":", "H") == "10H30"
        assert target.get("skipper_id") in (None, "")

        # Re-assign skipper
        r2 = requests.patch(
            f"{API}/staff/traversees/{tid}",
            headers=auth_headers,
            json={"skipper_id": skipper_id},
            timeout=10,
        )
        assert r2.status_code == 200

    def test_delete_traversee_cascade(self, auth_headers, created_state):
        tid = TestTraverseeSkipperAndEdit._aller_id
        retour_id = TestTraverseeSkipperAndEdit._retour_id
        r = requests.delete(f"{API}/staff/traversees/{tid}", headers=auth_headers, timeout=10)
        assert r.status_code == 200, r.text
        body = r.json()
        # Verify retour leg also gone
        lr = requests.get(
            f"{API}/staff/traversees?date=2026-01-15", headers=auth_headers, timeout=10
        ).json()
        items = lr if isinstance(lr, list) else lr.get("items", [])
        ids_remaining = {t["id"] for t in items}
        assert tid not in ids_remaining
        assert retour_id not in ids_remaining, "return leg should be cascade-deleted"
        # Remove from cleanup tracker since already deleted
        if tid in created_state["traversees"]:
            created_state["traversees"].remove(tid)


# ---------- 4) Stats advanced fleet block ----------
class TestStatsAdvancedFleet:
    def test_fleet_block_present(self, auth_headers):
        r = requests.get(f"{API}/staff/stats/advanced", headers=auth_headers, timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "fleet" in body
        fleet = body["fleet"]
        assert "boats" in fleet
        assert "total_trips" in fleet
        assert "total_litres" in fleet
        assert isinstance(fleet["boats"], list)
        for b in fleet["boats"]:
            assert {"id", "name", "fuel_litres_per_trip", "trips_completed", "trips_aller", "trips_retour", "fuel_litres_total"}.issubset(b.keys())
            # math check
            assert b["fuel_litres_total"] == b["fuel_litres_per_trip"] * b["trips_completed"]


# ---------- 5) Delete skipper (admin only) ----------
class TestSkipperDelete:
    def test_delete_skipper(self, auth_headers, created_state):
        # Create + delete a fresh one
        name = f"{TEST_PREFIX}Del_{uuid.uuid4().hex[:6]}"
        r = requests.post(
            f"{API}/staff/skippers",
            headers=auth_headers,
            json={"name": name},
            timeout=10,
        )
        assert r.status_code in (200, 201)
        sid = r.json()["id"]
        dr = requests.delete(f"{API}/staff/skippers/{sid}", headers=auth_headers, timeout=10)
        assert dr.status_code == 200, dr.text
        # Confirm gone
        lr = requests.get(f"{API}/staff/skippers", headers=auth_headers, timeout=10).json()
        ids = {s["id"] for s in lr["items"]}
        assert sid not in ids
