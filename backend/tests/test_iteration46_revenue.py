"""Iteration 46 — Phase C Vague 2 — Acquisition Engine + Revenue Management.

Covers:
- GET /api/staff/marketing/acquisition (>=15 items, 5 universes x 3 offers)
- POST/PATCH /api/staff/marketing/campaigns audience_targets + audience_notes
- /api/staff/revenue/rate-plans CRUD + validation
- /api/revenue/quote weekend/promo/priority logic
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://reserve-bbr.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@boulay.ci"
ADMIN_PASSWORD = "Admin@2026"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(
        f"{BASE_URL}/api/auth/staff/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=30,
    )
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    data = r.json()
    token = data.get("token") or data.get("access_token")
    assert token, f"No token in response: {data}"
    return token


@pytest.fixture(scope="module")
def headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def created_ids():
    # Track created resources for cleanup
    return {"campaigns": [], "rate_plans": []}


@pytest.fixture(scope="module", autouse=True)
def _cleanup(created_ids, headers):
    yield
    # Best-effort teardown
    for cid in created_ids["campaigns"]:
        try:
            requests.delete(f"{BASE_URL}/api/staff/marketing/campaigns/{cid}", headers=headers, timeout=10)
        except Exception:
            pass
    for pid in created_ids["rate_plans"]:
        try:
            requests.delete(f"{BASE_URL}/api/staff/revenue/rate-plans/{pid}", headers=headers, timeout=10)
        except Exception:
            pass


# ── Acquisition Engine ──────────────────────────────────────────────
class TestAcquisitionEngine:
    def test_acquisition_returns_min_15(self, headers):
        r = requests.get(f"{BASE_URL}/api/staff/marketing/acquisition", headers=headers, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "items" in data
        assert len(data["items"]) >= 15, f"expected >=15 got {len(data['items'])}"
        # Verify 5 universes present
        unis = {i["universe"] for i in data["items"]}
        assert {"beach_club", "hebergement", "le_kaai", "corporate", "activites_events"}.issubset(unis)
        # Every item has required fields
        for it in data["items"]:
            for k in ("universe", "offer", "campaigns", "active", "paused", "draft"):
                assert k in it, f"missing key {k} in {it}"


# ── Campaign audience fields ────────────────────────────────────────
class TestCampaignAudience:
    def test_create_with_audience_then_patch(self, headers, created_ids):
        payload = {
            "name": "TEST_audience_camp",
            "universe": "beach_club",
            "offer": "Day Pass",
            "start_date": "2026-06-01",
            "end_date": "2026-06-30",
            "budget_total": 100000,
            "budget_daily": 5000,
            "objective": "reservations",
            "status": "draft",
            "audience_targets": ["Cadres 25-45", "Familles Abidjan"],
            "audience_notes": "Cibler CSP+ Cocody/Riviera",
        }
        r = requests.post(f"{BASE_URL}/api/staff/marketing/campaigns", json=payload, headers=headers, timeout=30)
        assert r.status_code == 200, r.text
        c = r.json()
        cid = c["id"]
        created_ids["campaigns"].append(cid)
        assert c["audience_targets"] == ["Cadres 25-45", "Familles Abidjan"]
        assert c["audience_notes"] == "Cibler CSP+ Cocody/Riviera"

        # PATCH update
        r2 = requests.patch(
            f"{BASE_URL}/api/staff/marketing/campaigns/{cid}",
            json={"audience_targets": ["Touristes"], "audience_notes": "test patched"},
            headers=headers,
            timeout=30,
        )
        assert r2.status_code == 200, r2.text

        # GET back
        r3 = requests.get(f"{BASE_URL}/api/staff/marketing/campaigns/{cid}", headers=headers, timeout=10)
        assert r3.status_code == 200
        c3 = r3.json()
        assert c3["audience_targets"] == ["Touristes"]
        assert c3["audience_notes"] == "test patched"


# ── Rate Plans CRUD + validation ────────────────────────────────────
class TestRatePlansCRUD:
    def test_create_promo_requires_code(self, headers):
        bad = {
            "offer_key": "beach_club.pass_day",
            "name": "TEST_bad_promo",
            "type": "promo",
            "adjustment_kind": "percent",
            "adjustment_value": -10,
        }
        r = requests.post(f"{BASE_URL}/api/staff/revenue/rate-plans", json=bad, headers=headers, timeout=15)
        assert r.status_code == 400, r.text
        assert "promo_code_required" in r.text

    def test_invalid_type(self, headers):
        r = requests.post(
            f"{BASE_URL}/api/staff/revenue/rate-plans",
            json={"offer_key": "x", "name": "TEST_bad", "type": "bogus", "adjustment_value": 0},
            headers=headers,
            timeout=15,
        )
        assert r.status_code == 400
        assert "invalid_type" in r.text

    def test_invalid_adjustment_kind(self, headers):
        r = requests.post(
            f"{BASE_URL}/api/staff/revenue/rate-plans",
            json={"offer_key": "x", "name": "TEST_bad", "type": "seasonal",
                  "adjustment_kind": "bogus", "adjustment_value": 0},
            headers=headers,
            timeout=15,
        )
        assert r.status_code == 400
        assert "invalid_adjustment_kind" in r.text

    def test_create_seasonal_then_filter(self, headers, created_ids):
        r = requests.post(
            f"{BASE_URL}/api/staff/revenue/rate-plans",
            json={
                "offer_key": "beach_club.pass_day",
                "name": "TEST_seasonal_summer",
                "type": "seasonal",
                "adjustment_kind": "percent",
                "adjustment_value": -15,
                "start_date": "2026-07-01",
                "end_date": "2026-08-31",
                "active": True,
            },
            headers=headers, timeout=15,
        )
        assert r.status_code == 200, r.text
        pid = r.json()["id"]
        created_ids["rate_plans"].append(pid)

        # Filter by offer_key + type
        r2 = requests.get(
            f"{BASE_URL}/api/staff/revenue/rate-plans",
            params={"offer_key": "beach_club.pass_day", "type": "seasonal"},
            headers=headers, timeout=15,
        )
        assert r2.status_code == 200
        items = r2.json()["items"]
        assert any(p["id"] == pid for p in items)
        # All returned must match filter
        for p in items:
            assert p["offer_key"] == "beach_club.pass_day"
            assert p["type"] == "seasonal"

    def test_patch_then_delete(self, headers, created_ids):
        # Create
        r = requests.post(
            f"{BASE_URL}/api/staff/revenue/rate-plans",
            json={
                "offer_key": "beach_club.pass_day",
                "name": "TEST_to_delete",
                "type": "weekend",
                "adjustment_kind": "percent",
                "adjustment_value": 20,
                "active": True,
            },
            headers=headers, timeout=15,
        )
        assert r.status_code == 200
        pid = r.json()["id"]

        # PATCH toggle active off
        r2 = requests.patch(
            f"{BASE_URL}/api/staff/revenue/rate-plans/{pid}",
            json={"active": False},
            headers=headers, timeout=15,
        )
        assert r2.status_code == 200

        # Verify via list
        r3 = requests.get(f"{BASE_URL}/api/staff/revenue/rate-plans", headers=headers, timeout=15)
        plan = next((p for p in r3.json()["items"] if p["id"] == pid), None)
        assert plan and plan["active"] is False

        # DELETE
        r4 = requests.delete(f"{BASE_URL}/api/staff/revenue/rate-plans/{pid}", headers=headers, timeout=15)
        assert r4.status_code == 200

        # Verify deleted
        r5 = requests.get(f"{BASE_URL}/api/staff/revenue/rate-plans", headers=headers, timeout=15)
        assert not any(p["id"] == pid for p in r5.json()["items"])


# ── Public Quote logic ──────────────────────────────────────────────
class TestPublicQuote:
    @pytest.fixture(scope="class")
    def quote_plans(self, headers, created_ids):
        """Create dedicated offer_key plans so other tests don't interfere."""
        offer_key = "test_quote.offer"
        # Cleanup existing first
        existing = requests.get(
            f"{BASE_URL}/api/staff/revenue/rate-plans",
            params={"offer_key": offer_key}, headers=headers, timeout=15,
        ).json().get("items", [])
        for p in existing:
            requests.delete(f"{BASE_URL}/api/staff/revenue/rate-plans/{p['id']}", headers=headers, timeout=10)

        # Weekend +20%
        r1 = requests.post(
            f"{BASE_URL}/api/staff/revenue/rate-plans",
            json={"offer_key": offer_key, "name": "TEST_wk", "type": "weekend",
                  "adjustment_kind": "percent", "adjustment_value": 20, "active": True},
            headers=headers, timeout=15,
        )
        assert r1.status_code == 200, r1.text
        wk_id = r1.json()["id"]
        created_ids["rate_plans"].append(wk_id)

        # Promo SUNNY10 -10%
        r2 = requests.post(
            f"{BASE_URL}/api/staff/revenue/rate-plans",
            json={"offer_key": offer_key, "name": "TEST_promo", "type": "promo",
                  "adjustment_kind": "percent", "adjustment_value": -10,
                  "promo_code": "SUNNY10", "active": True},
            headers=headers, timeout=15,
        )
        assert r2.status_code == 200, r2.text
        pr_id = r2.json()["id"]
        created_ids["rate_plans"].append(pr_id)
        return {"offer_key": offer_key, "weekend": wk_id, "promo": pr_id}

    def test_weekend_surcharge(self, quote_plans):
        # 2026-06-20 is a Saturday -> weekday()=5
        r = requests.get(
            f"{BASE_URL}/api/revenue/quote",
            params={"offer_key": quote_plans["offer_key"], "base_price": 35000, "when": "2026-06-20"},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["final_price"] == 42000.0, data
        assert data["applied_plan"]["type"] == "weekend"

    def test_weekday_no_plan(self, quote_plans):
        # 2026-06-17 is Wednesday
        r = requests.get(
            f"{BASE_URL}/api/revenue/quote",
            params={"offer_key": quote_plans["offer_key"], "base_price": 35000, "when": "2026-06-17"},
            timeout=15,
        )
        assert r.status_code == 200
        data = r.json()
        assert data["final_price"] == 35000.0
        assert data["applied_plan"] is None

    def test_promo_on_weekday(self, quote_plans):
        r = requests.get(
            f"{BASE_URL}/api/revenue/quote",
            params={"offer_key": quote_plans["offer_key"], "base_price": 35000,
                    "when": "2026-06-17", "promo": "SUNNY10"},
            timeout=15,
        )
        assert r.status_code == 200
        data = r.json()
        assert data["final_price"] == 31500.0, data
        assert data["applied_plan"]["type"] == "promo"

    def test_promo_beats_weekend(self, quote_plans):
        # Saturday with promo -> promo (priority 4) wins over weekend (priority 1)
        r = requests.get(
            f"{BASE_URL}/api/revenue/quote",
            params={"offer_key": quote_plans["offer_key"], "base_price": 35000,
                    "when": "2026-06-20", "promo": "SUNNY10"},
            timeout=15,
        )
        assert r.status_code == 200
        data = r.json()
        assert data["applied_plan"]["type"] == "promo", data
        assert data["final_price"] == 31500.0
