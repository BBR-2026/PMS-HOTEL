"""Iteration 6 — Overbooking guard, calendar overbooking flags, advanced stats, inventory PATCH."""
import os
import time
import pytest
import requests
from datetime import datetime, timedelta

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://reserve-bbr.preview.emergentagent.com").rstrip("/")
ADMIN = {"email": "admin@boulay.ci", "password": "Admin@2026"}
MANAGER = {"email": "manager@boulay.ci", "password": "Manager@2026"}
RECEPTION = {"email": "reception@boulay.ci", "password": "Reception@2026"}

# Unique date offset per test session (modulo a few thousand days)
RUN_OFFSET = (int(time.time()) % 1500) + 500


def _login(creds):
    r = requests.post(f"{BASE_URL}/api/auth/staff/login", json=creds, timeout=15)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN)


@pytest.fixture(scope="module")
def manager_token():
    return _login(MANAGER)


@pytest.fixture(scope="module")
def reception_token():
    return _login(RECEPTION)


@pytest.fixture(scope="module")
def heb_offer():
    return requests.get(f"{BASE_URL}/api/offers/hebergement", timeout=10).json()


def _bt(offer):
    bts = offer.get("boat_times") or []
    return bts[0] if bts else "10H"


def _make_booking_payload(arrival, checkout, tier_id, rooms, bt_value, prefix="OB"):
    return {
        "offer_type": "hebergement",
        "date": arrival.isoformat(),
        "checkout_date": checkout.isoformat(),
        "room_tier": tier_id,
        "rooms": rooms,
        "adults": 1,
        "children": 0,
        "boat_time": bt_value,
        "return_boat_time": bt_value,
        "participants": [
            {
                "name": f"TEST_{prefix}",
                "surname": "User",
                "email": f"test_{prefix.lower()}_{arrival.isoformat()}@example.com",
                "phone": "+225 07 00 00 00 00",
                "nationality": "CI",
                "kind": "adult",
            }
        ],
        "special_requests": "TEST_overbooking",
    }


# ---------- Inventory & overbooking guard ----------

class TestOverbookingGuard:
    def test_offer_has_correct_inventory_defaults(self, heb_offer):
        tiers = {t["id"]: t for t in heb_offer.get("room_tiers", [])}
        assert "superieure" in tiers and "suite_jardin" in tiers and "suite_mer" in tiers
        assert int(tiers["superieure"].get("inventory", 0)) == 18
        assert int(tiers["suite_jardin"].get("inventory", 0)) == 6
        assert int(tiers["suite_mer"].get("inventory", 0)) == 6

    def test_overbooking_simple_blocks(self, heb_offer):
        arrival = datetime.utcnow().date() + timedelta(days=RUN_OFFSET + 0)
        checkout = arrival + timedelta(days=2)
        bt = _bt(heb_offer)
        payload = _make_booking_payload(arrival, checkout, "suite_mer", 6, bt, prefix="OB1A")
        r1 = requests.post(f"{BASE_URL}/api/bookings", json=payload, timeout=15)
        assert r1.status_code == 200, f"first booking should succeed: {r1.status_code} {r1.text}"

        # Try another booking of 1 room overlapping → must fail
        payload2 = _make_booking_payload(arrival, checkout, "suite_mer", 1, bt, prefix="OB1B")
        r2 = requests.post(f"{BASE_URL}/api/bookings", json=payload2, timeout=15)
        assert r2.status_code == 400, f"expected 400, got {r2.status_code}: {r2.text}"
        assert "Plus de chambres" in r2.text
        assert arrival.isoformat() in r2.text

    def test_overlapping_nights_sum(self, heb_offer):
        # Booking A 6 rooms nights N..N+5 (suite_jardin inv=6)
        # Booking B 1 room nights N+2..N+7 → must fail on N+2..N+5 overlap
        arrival_a = datetime.utcnow().date() + timedelta(days=RUN_OFFSET + 100)
        checkout_a = arrival_a + timedelta(days=5)
        arrival_b = arrival_a + timedelta(days=2)
        checkout_b = arrival_b + timedelta(days=5)
        bt = _bt(heb_offer)
        a = _make_booking_payload(arrival_a, checkout_a, "suite_jardin", 6, bt, prefix="OB2A")
        r = requests.post(f"{BASE_URL}/api/bookings", json=a, timeout=15)
        assert r.status_code == 200, r.text

        bpayload = _make_booking_payload(arrival_b, checkout_b, "suite_jardin", 1, bt, prefix="OB2B")
        r2 = requests.post(f"{BASE_URL}/api/bookings", json=bpayload, timeout=15)
        assert r2.status_code == 400, f"expected overlap 400, got {r2.status_code}: {r2.text}"
        msg = r2.json().get("detail", "")
        assert "Plus de chambres" in msg
        # The first overbooked night should be arrival_b (N+2)
        assert arrival_b.isoformat() in msg

    def test_cancelled_bookings_ignored(self, admin_token, heb_offer):
        arrival = datetime.utcnow().date() + timedelta(days=RUN_OFFSET + 200)
        checkout = arrival + timedelta(days=2)
        bt = _bt(heb_offer)
        p = _make_booking_payload(arrival, checkout, "suite_mer", 6, bt, prefix="OB3A")
        r = requests.post(f"{BASE_URL}/api/bookings", json=p, timeout=15)
        assert r.status_code == 200, r.text
        bid = r.json()["id"]
        headers = {"Authorization": f"Bearer {admin_token}"}
        # Try common cancellation endpoints
        cancel = requests.patch(
            f"{BASE_URL}/api/staff/bookings/{bid}/status",
            json={"status": "cancelled"},
            headers=headers,
            timeout=15,
        )
        if cancel.status_code not in (200, 204):
            # try DELETE
            cancel = requests.delete(
                f"{BASE_URL}/api/staff/bookings/{bid}",
                headers=headers,
                timeout=15,
            )
        if cancel.status_code not in (200, 204):
            pytest.skip(f"no cancel endpoint usable; tried PATCH/status & DELETE, last={cancel.status_code}")
        # Now book 1 room overlapping → should succeed (cancellation ignored)
        p2 = _make_booking_payload(arrival, checkout, "suite_mer", 1, bt, prefix="OB3B")
        r2 = requests.post(f"{BASE_URL}/api/bookings", json=p2, timeout=15)
        assert r2.status_code == 200, f"after cancellation booking should succeed: {r2.status_code} {r2.text}"


# ---------- Calendar endpoint ----------

class TestCalendarOverbookingFlags:
    def test_calendar_returns_inventory_fields(self, admin_token):
        arrival = datetime.utcnow().date() + timedelta(days=RUN_OFFSET + 0)
        month = arrival.strftime("%Y-%m")
        r = requests.get(
            f"{BASE_URL}/api/staff/hebergement/calendar",
            params={"month": month},
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert "tier_inventory" in body and "total_inventory" in body
        assert body["total_inventory"] == 30  # 18+6+6
        assert body["tier_inventory"].get("suite_mer") == 6
        for d in body["days"]:
            assert "is_overbooked" in d
            assert "total_inventory" in d and d["total_inventory"] == 30
            for t in d["by_tier"]:
                assert "inventory" in t and "is_overbooked" in t


# ---------- Advanced stats ----------

class TestAdvancedStats:
    def test_reception_forbidden(self, reception_token):
        r = requests.get(
            f"{BASE_URL}/api/staff/stats/advanced",
            headers={"Authorization": f"Bearer {reception_token}"},
            timeout=15,
        )
        assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text}"

    def test_manager_can_read(self, manager_token):
        r = requests.get(
            f"{BASE_URL}/api/staff/stats/advanced",
            headers={"Authorization": f"Bearer {manager_token}"},
            timeout=20,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        for k in (
            "year", "previous_year", "yoy", "funnel",
            "avg_lead_time_days", "top_nationalities", "party_size",
            "weekday_distribution", "hebergement",
        ):
            assert k in body, f"missing key {k}"
        assert isinstance(body["yoy"], list) and len(body["yoy"]) == 12
        assert set(body["funnel"].keys()) >= {"pending", "confirmed", "arrived", "completed", "cancelled"}
        assert len(body["top_nationalities"]) <= 10
        assert len(body["weekday_distribution"]) == 7
        heb = body["hebergement"]
        for k in ("total_inventory", "nights_sold", "available_nights", "occupancy_rate_pct", "days_elapsed"):
            assert k in heb, f"missing heb.{k}"
        assert heb["total_inventory"] == 30


def _fetch_config_offers(admin_token):
    r = requests.get(
        f"{BASE_URL}/api/staff/config/offers",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=15,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    # Endpoint returns {"items": [...]}
    return body.get("items", body)


# ---------- Inventory PATCH persistence ----------

class TestInventoryPatchPersistence:
    def test_patch_offers_inventory_persists(self, admin_token, heb_offer):
        offers = _fetch_config_offers(admin_token)
        heb = next((o for o in offers if o["id"] == "hebergement"), None)
        assert heb is not None
        tiers = heb["room_tiers"]
        # tweak suite_mer inventory: 6 → 7
        new_tiers = []
        for t in tiers:
            t2 = dict(t)
            if t["id"] == "suite_mer":
                t2["inventory"] = 7
            new_tiers.append(t2)
        patch = requests.patch(
            f"{BASE_URL}/api/staff/config/offers/hebergement",
            json={"room_tiers": new_tiers},
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=15,
        )
        assert patch.status_code == 200, patch.text

        offers2 = _fetch_config_offers(admin_token)
        heb2 = next(o for o in offers2 if o["id"] == "hebergement")
        tm = next(t for t in heb2["room_tiers"] if t["id"] == "suite_mer")
        assert int(tm["inventory"]) == 7, f"inventory not persisted, got {tm}"

        # verify reflected in calendar
        month = (datetime.utcnow().date() + timedelta(days=RUN_OFFSET + 400)).strftime("%Y-%m")
        cal = requests.get(
            f"{BASE_URL}/api/staff/hebergement/calendar",
            params={"month": month},
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=15,
        )
        assert cal.status_code == 200
        body = cal.json()
        assert body["tier_inventory"]["suite_mer"] == 7
        assert body["total_inventory"] == 31

        # verify guard uses new inventory: booking 7 suite_mer must succeed (would fail with 6)
        arrival = datetime.utcnow().date() + timedelta(days=RUN_OFFSET + 400)
        checkout = arrival + timedelta(days=1)
        bt = _bt(heb_offer)
        p = _make_booking_payload(arrival, checkout, "suite_mer", 7, bt, prefix="OB_INV7")
        r3 = requests.post(f"{BASE_URL}/api/bookings", json=p, timeout=15)
        assert r3.status_code == 200, f"booking 7 should succeed with inv=7, got {r3.status_code}: {r3.text}"

        # restore to 6
        rest = requests.patch(
            f"{BASE_URL}/api/staff/config/offers/hebergement",
            json={"room_tiers": tiers},
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=15,
        )
        assert rest.status_code == 200, rest.text
        offers3 = _fetch_config_offers(admin_token)
        heb3 = next(o for o in offers3 if o["id"] == "hebergement")
        tm3 = next(t for t in heb3["room_tiers"] if t["id"] == "suite_mer")
        assert int(tm3["inventory"]) == 6
