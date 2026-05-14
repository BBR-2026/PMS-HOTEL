"""
Iteration 13 — Restructuration en 5 pôles + 4 nouveaux offer_types (spa_wellness,
seminaire, team_building, offres_loisirs) + filtres ?pole= + migration rétroactive.

Run:
  pytest /app/backend/tests/test_iteration13_poles.py -v --tb=short \
    --junitxml=/app/test_reports/pytest/iter13_poles.xml
"""

import os
from datetime import date, datetime, timedelta, timezone

import pytest
import requests

_FRONT_ENV = "/app/frontend/.env"
_BACKEND_URL = os.environ.get("REACT_APP_BACKEND_URL")
if not _BACKEND_URL and os.path.exists(_FRONT_ENV):
    with open(_FRONT_ENV) as _f:
        for _line in _f:
            if _line.startswith("REACT_APP_BACKEND_URL="):
                _BACKEND_URL = _line.split("=", 1)[1].strip()
                break
assert _BACKEND_URL, "REACT_APP_BACKEND_URL is required"
BASE = _BACKEND_URL.rstrip("/") + "/api"

ADMIN = ("admin@boulay.ci", "Admin@2026")
MANAGER = ("manager@boulay.ci", "Manager@2026")
RECEPTION = ("reception@boulay.ci", "Reception@2026")

EXPECTED_POLES = ["beach_club", "hebergement", "corporate", "activites_events", "le_kaai"]
NEW_OFFERS = {
    "spa_wellness": ("hebergement", 80000),
    "seminaire": ("corporate", 150000),
    "team_building": ("corporate", 100000),
    "offres_loisirs": ("activites_events", 30000),
}


# ---------- helpers ----------
def _login(email: str, password: str) -> str:
    r = requests.post(f"{BASE}/auth/staff/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    return r.json()["access_token"]


def _next_weekday(target_wd: int) -> str:
    """Return a future YYYY-MM-DD landing on weekday target_wd (Mon=0..Sun=6),
    at least 2 days ahead to avoid TZ boundary issues."""
    d = datetime.now(timezone.utc).date() + timedelta(days=2)
    while d.weekday() != target_wd:
        d += timedelta(days=1)
    return d.isoformat()


def _participant(kind="adult", suffix=""):
    return {
        "name": f"Test{suffix}",
        "surname": "Pole",
        "email": f"test.pole{suffix or '1'}@example.ci",
        "phone": "+2250700000000",
        "nationality": "FR",
        "kind": kind,
    }


# ---------- fixtures ----------
@pytest.fixture(scope="session")
def admin_token():
    return _login(*ADMIN)


@pytest.fixture(scope="session")
def manager_token():
    return _login(*MANAGER)


@pytest.fixture(scope="session")
def reception_token():
    return _login(*RECEPTION)


@pytest.fixture
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture
def manager_headers(manager_token):
    return {"Authorization": f"Bearer {manager_token}"}


# =====================================================================
# 1. GET /api/poles
# =====================================================================
class TestPolesPublic:
    def test_list_poles(self):
        r = requests.get(f"{BASE}/poles", timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data, list)
        ids = [p["id"] for p in data]
        assert ids == EXPECTED_POLES, f"Order/ids mismatch: {ids}"
        for p in data:
            assert "name_fr" in p and "tagline_fr" in p
            assert "sub_offers" in p and isinstance(p["sub_offers"], list)
            assert "_id" not in p

    def test_pole_beach_club_sub_offers(self):
        r = requests.get(f"{BASE}/poles/beach_club", timeout=30)
        assert r.status_code == 200, r.text
        ids = [s["id"] for s in r.json()["sub_offers"]]
        assert set(ids) == {"pass_day", "sunset", "brunch"}

    def test_pole_hebergement_sub_offers(self):
        r = requests.get(f"{BASE}/poles/hebergement", timeout=30)
        assert r.status_code == 200, r.text
        subs = r.json()["sub_offers"]
        ids = [s["id"] for s in subs]
        assert set(ids) == {"hebergement", "spa_wellness"}
        heb = next(s for s in subs if s["id"] == "hebergement")
        assert isinstance(heb.get("room_tiers"), list) and len(heb["room_tiers"]) > 0

    def test_pole_corporate_sub_offers(self):
        r = requests.get(f"{BASE}/poles/corporate", timeout=30)
        assert r.status_code == 200, r.text
        ids = [s["id"] for s in r.json()["sub_offers"]]
        assert set(ids) == {"seminaire", "team_building"}

    def test_pole_activites_events_sub_offers(self):
        r = requests.get(f"{BASE}/poles/activites_events", timeout=30)
        assert r.status_code == 200, r.text
        subs = r.json()["sub_offers"]
        ids = [s["id"] for s in subs]
        assert "offres_loisirs" in ids
        assert "events_maison" in ids
        em = next(s for s in subs if s["id"] == "events_maison")
        assert em.get("is_synthetic") is True
        assert em.get("kind") == "events_list"
        assert isinstance(em.get("events"), list)
        # Au moins l'event Saint-Valentin publié doit apparaître
        evt_ids = [e.get("id") for e in em["events"]]
        assert "a4ad1d2b-eaed-476f-8fa5-7d508b165dc4" in evt_ids, f"Seeded event missing: {evt_ids}"

    def test_pole_le_kaai_sub_offers(self):
        r = requests.get(f"{BASE}/poles/le_kaai", timeout=30)
        assert r.status_code == 200, r.text
        ids = [s["id"] for s in r.json()["sub_offers"]]
        assert ids == ["le_kaai"]

    def test_pole_unknown(self):
        r = requests.get(f"{BASE}/poles/nope", timeout=30)
        assert r.status_code == 404


# =====================================================================
# 2. GET /api/offers/{new_offer} retourne pole
# =====================================================================
class TestOfferPoleField:
    @pytest.mark.parametrize("offer_id,expected_pole", [
        ("spa_wellness", "hebergement"),
        ("seminaire", "corporate"),
        ("team_building", "corporate"),
        ("offres_loisirs", "activites_events"),
    ])
    def test_offer_has_pole(self, offer_id, expected_pole):
        r = requests.get(f"{BASE}/offers/{offer_id}", timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["id"] == offer_id
        assert data["pole"] == expected_pole
        assert "price_adult" in data
        assert isinstance(data.get("boat_times"), list)


# =====================================================================
# 3. POST /api/bookings sur les 4 nouveaux offer_types
# =====================================================================
class TestNewOfferBookings:
    def _create(self, offer_type, the_date, boat_time, adults=1, children=0):
        body = {
            "offer_type": offer_type,
            "date": the_date,
            "adults": adults,
            "children": children,
            "boat_time": boat_time,
            "participants": [_participant("adult", str(i)) for i in range(adults)]
                            + [_participant("child", f"c{i}") for i in range(children)],
            "special_requests": "TEST_iter13",
        }
        return requests.post(f"{BASE}/bookings", json=body, timeout=30)

    def test_spa_wellness_creates_with_pole_hebergement(self):
        d = _next_weekday(2)  # any weekday
        r = self._create("spa_wellness", d, "14H", adults=2)
        assert r.status_code == 200, r.text
        b = r.json()
        assert b["offer_type"] == "spa_wellness"
        assert b["pole"] == "hebergement"
        assert b["total_amount"] == 80000 * 2
        assert b["status"] == "pending"
        assert "_id" not in b

    def test_seminaire_weekday_pole_corporate(self):
        d = _next_weekday(1)  # Tuesday
        r = self._create("seminaire", d, "8H", adults=1)
        assert r.status_code == 200, r.text
        b = r.json()
        assert b["pole"] == "corporate"
        assert b["total_amount"] == 150000

    def test_team_building_weekday_pole_corporate(self):
        d = _next_weekday(3)  # Thursday
        r = self._create("team_building", d, "10H", adults=1)
        assert r.status_code == 200, r.text
        b = r.json()
        assert b["pole"] == "corporate"
        assert b["total_amount"] == 100000

    def test_offres_loisirs_pole_activites_events(self):
        d = _next_weekday(0)
        r = self._create("offres_loisirs", d, "10H", adults=2, children=1)
        assert r.status_code == 200, r.text
        b = r.json()
        assert b["pole"] == "activites_events"
        assert b["total_amount"] == 30000 * 2 + 15000 * 1

    def test_seminaire_weekend_refused_400(self):
        d = _next_weekday(5)  # Saturday
        r = self._create("seminaire", d, "8H", adults=1)
        assert r.status_code == 400
        assert "Allowed days" in r.text or "available" in r.text.lower()

    def test_team_building_sunday_refused_400(self):
        d = _next_weekday(6)
        r = self._create("team_building", d, "8H", adults=1)
        assert r.status_code == 400

    def test_spa_wellness_invalid_boat_time_400(self):
        d = _next_weekday(2)
        r = self._create("spa_wellness", d, "6H", adults=1)
        assert r.status_code == 400
        assert "boat time" in r.text.lower() or "allowed" in r.text.lower()


# =====================================================================
# 4. GET /api/staff/bookings?pole=...
# =====================================================================
class TestStaffBookingsByPole:
    def test_pole_beach_club(self, manager_headers):
        r = requests.get(f"{BASE}/staff/bookings?pole=beach_club&limit=500", headers=manager_headers, timeout=30)
        assert r.status_code == 200, r.text
        items = r.json()
        for b in items:
            otype = b.get("offer_type")
            pole = b.get("pole")
            assert otype in {"pass_day", "sunset", "brunch"} or pole == "beach_club", \
                f"Booking {b.get('id')} otype={otype} pole={pole} not in beach_club"

    def test_pole_corporate(self, manager_headers):
        r = requests.get(f"{BASE}/staff/bookings?pole=corporate&limit=500", headers=manager_headers, timeout=30)
        assert r.status_code == 200, r.text
        items = r.json()
        # Need at least the ones we created
        otypes = {b.get("offer_type") for b in items}
        assert "seminaire" in otypes or "team_building" in otypes, f"No corporate bookings? {otypes}"
        for b in items:
            otype = b.get("offer_type")
            pole = b.get("pole")
            assert otype in {"seminaire", "team_building"} or pole == "corporate"

    def test_pole_activites_events_includes_special_events(self, manager_headers):
        r = requests.get(f"{BASE}/staff/bookings?pole=activites_events&limit=500", headers=manager_headers, timeout=30)
        assert r.status_code == 200, r.text
        items = r.json()
        for b in items:
            otype = b.get("offer_type")
            pole = b.get("pole")
            assert otype in {"offres_loisirs", "special_event", "events_maison"} or pole == "activites_events"

    def test_pole_hebergement(self, manager_headers):
        r = requests.get(f"{BASE}/staff/bookings?pole=hebergement&limit=500", headers=manager_headers, timeout=30)
        assert r.status_code == 200, r.text
        for b in r.json():
            otype = b.get("offer_type")
            pole = b.get("pole")
            assert otype in {"hebergement", "spa_wellness"} or pole == "hebergement"

    def test_pole_le_kaai(self, manager_headers):
        r = requests.get(f"{BASE}/staff/bookings?pole=le_kaai&limit=500", headers=manager_headers, timeout=30)
        assert r.status_code == 200, r.text
        for b in r.json():
            otype = b.get("offer_type")
            pole = b.get("pole")
            assert otype == "le_kaai" or pole == "le_kaai"


# =====================================================================
# 5. GET /api/staff/dashboard.pole_breakdown
# =====================================================================
class TestDashboardPoleBreakdown:
    def test_dashboard_has_pole_breakdown(self, manager_headers):
        r = requests.get(f"{BASE}/staff/dashboard", headers=manager_headers, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "pole_breakdown" in data
        pb = data["pole_breakdown"]
        assert isinstance(pb, list) and len(pb) == 5
        ids = [p["id"] for p in pb]
        assert ids == EXPECTED_POLES
        for p in pb:
            assert "name_fr" in p
            assert "today" in p and "count" in p["today"] and "revenue" in p["today"]
            assert "last_30d" in p and "count" in p["last_30d"] and "revenue" in p["last_30d"]


# =====================================================================
# 6. GET /api/staff/revenue.by_pole
# =====================================================================
class TestRevenueByPole:
    def test_revenue_30d_by_pole(self, manager_headers):
        r = requests.get(f"{BASE}/staff/revenue?period=30d", headers=manager_headers, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "by_pole" in data
        bp = data["by_pole"]
        assert isinstance(bp, list) and len(bp) == 5
        ids = [p["id"] for p in bp]
        assert set(ids) == set(EXPECTED_POLES)
        for p in bp:
            assert "name_fr" in p and "count" in p and "total" in p


# =====================================================================
# 7. Migration rétroactive — TOUTES les bookings non-cancelled ont un pole
# =====================================================================
class TestBackfillPoles:
    def test_all_bookings_have_pole_field(self, manager_headers):
        """On scanne l'ensemble des 5 pôles via le filtre et on vérifie qu'aucune
        booking legacy n'est en l'air (pole vide + offer_type connu)."""
        # Get a broad list (no pole filter) and count
        r = requests.get(f"{BASE}/staff/bookings?limit=1000", headers=manager_headers, timeout=30)
        assert r.status_code == 200
        items = r.json()
        assert len(items) > 0, "Expected legacy bookings to be present"
        known_offer_types = {
            "pass_day", "sunset", "brunch", "le_kaai", "hebergement",
            "spa_wellness", "seminaire", "team_building", "offres_loisirs",
            "special_event",
        }
        unfilled = []
        for b in items:
            otype = b.get("offer_type")
            pole = b.get("pole")
            if otype in known_offer_types and not pole:
                unfilled.append({"id": b.get("id"), "offer_type": otype})
        assert not unfilled, f"{len(unfilled)} bookings still missing pole: {unfilled[:5]}"

    def test_legacy_pass_day_have_pole_beach_club(self, manager_headers):
        r = requests.get(f"{BASE}/staff/bookings?offer_type=pass_day&limit=200", headers=manager_headers, timeout=30)
        assert r.status_code == 200
        items = r.json()
        if items:
            for b in items:
                assert b.get("pole") == "beach_club", f"pass_day booking {b.get('id')} pole={b.get('pole')}"

    def test_legacy_hebergement_have_pole_hebergement(self, manager_headers):
        r = requests.get(f"{BASE}/staff/bookings?offer_type=hebergement&limit=200", headers=manager_headers, timeout=30)
        assert r.status_code == 200
        for b in r.json():
            assert b.get("pole") == "hebergement"

    def test_legacy_le_kaai_have_pole_le_kaai(self, manager_headers):
        r = requests.get(f"{BASE}/staff/bookings?offer_type=le_kaai&limit=200", headers=manager_headers, timeout=30)
        assert r.status_code == 200
        for b in r.json():
            assert b.get("pole") == "le_kaai"


# =====================================================================
# 8. Régression — endpoints précédents fonctionnent toujours
# =====================================================================
class TestRegressionPrevPhase:
    def test_special_events_featured_still_works(self):
        r = requests.get(f"{BASE}/special-events/featured", timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        # Shape: {"event": {...}} or list or single object — accept all
        evt = None
        if isinstance(data, list):
            evt = data[0] if data else None
        elif isinstance(data, dict):
            evt = data.get("event") or data
        assert evt is not None
        assert evt.get("id") == "a4ad1d2b-eaed-476f-8fa5-7d508b165dc4", f"Featured event: {evt.get('id')}"

    def test_offers_list_includes_new_offers(self):
        r = requests.get(f"{BASE}/offers", timeout=30)
        assert r.status_code == 200
        ids = {o["id"] for o in r.json()}
        # Old + 4 new = 9 offer entries
        assert {"pass_day", "sunset", "brunch", "le_kaai", "hebergement",
                "spa_wellness", "seminaire", "team_building", "offres_loisirs"} <= ids

    def test_manager_can_create_special_event(self, manager_headers):
        """Vérifie que la régression POST /api/special-events fonctionne (auth manager+)."""
        future = (date.today() + timedelta(days=60)).isoformat()
        body = {
            "title": "TEST_iter13_event",
            "description": "Iter13 regression",
            "event_dates": [future],
            "boat_times": ["10H"],
            "return_boat_times": ["18H"],
            "price_adult": 50000,
            "price_child": 25000,
            "capacity": 20,
            "active_from": date.today().isoformat(),
            "active_to": future,
        }
        r = requests.post(f"{BASE}/staff/special-events", json=body, headers=manager_headers, timeout=30)
        assert r.status_code in (200, 201), r.text
        evt = r.json()
        evt_id = evt.get("id")
        assert evt_id, evt
        # cleanup — try DELETE (admin to be safe)
        admin_h = {"Authorization": f"Bearer {_login(*ADMIN)}"}
        requests.delete(f"{BASE}/staff/special-events/{evt_id}", headers=admin_h, timeout=30)
