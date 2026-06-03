"""Iteration 14 — Beach Club VIP Spaces (numbered transats + balinés).

Validates:
  - Public GET /api/vip-spaces/available for pass_day + hebergement.
  - POST /api/bookings with vip_space_ids: pricing, persistence, embedded
    `vip_spaces`, `vip_spaces_amount`, `vip_space_ids` fields.
  - Conflict (409 Espace(s) déjà réservé(s)) on double-booking same date.
  - 400 when vip_space_ids are sent for a non-beach-club offer.
  - 400 when vip_space_ids contain unknown ids.
  - Staff CRUD: GET/POST/PATCH/DELETE /api/staff/vip-spaces — admin OK,
    management_general 403 on writes.
"""
from __future__ import annotations

import os
import uuid
from datetime import date, timedelta

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://reserve-bbr.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@boulay.ci"
ADMIN_PASSWORD = "Admin@2026"
DIRECTION_EMAIL = "direction.test@boulay.ci"
DIRECTION_PASSWORD = "Direction@2026"


# ---------- Helpers ----------

def _next_weekday(target_weekday: int) -> str:
    """Return next future date (>=2 days from today) whose weekday == target_weekday."""
    d = date.today() + timedelta(days=2)
    while d.weekday() != target_weekday:
        d += timedelta(days=1)
    return d.isoformat()


def _unique_future_pass_day_date() -> str:
    """Return a far-future weekday (Mon-Fri) unique enough to avoid collisions with other tests."""
    # Pick ~120 days out + a random offset, then find next Mon-Fri
    d = date.today() + timedelta(days=120 + (uuid.uuid4().int % 60))
    while d.weekday() >= 5:  # 5=Sat,6=Sun
        d += timedelta(days=1)
    return d.isoformat()


def _login(email: str, password: str) -> str:
    r = requests.post(f"{API}/auth/staff/login", json={"email": email, "password": password}, timeout=15)
    if r.status_code != 200:
        pytest.skip(f"Login failed for {email}: {r.status_code} {r.text[:200]}")
    return r.json()["access_token"]


def _participants(adults: int = 2, children: int = 0) -> list:
    out = []
    for i in range(adults):
        out.append({
            "name": "Doe",
            "surname": f"TestAdult{i}",
            "email": f"test_vip_a{i}_{uuid.uuid4().hex[:6]}@example.ci",
            "phone": "+22500000000",
            "nationality": "CI",
            "kind": "adult",
        })
    for i in range(children):
        out.append({
            "name": "Doe",
            "surname": f"TestChild{i}",
            "email": "",
            "phone": "",
            "nationality": "CI",
            "kind": "child",
        })
    return out


# ---------- Fixtures ----------

@pytest.fixture(scope="module")
def admin_token() -> str:
    return _login(ADMIN_EMAIL, ADMIN_PASSWORD)


@pytest.fixture(scope="module")
def direction_token() -> str:
    return _login(DIRECTION_EMAIL, DIRECTION_PASSWORD)


# ---------- Tests: Public availability ----------

class TestVipSpacesAvailability:

    def test_available_for_pass_day_returns_16(self):
        d = _unique_future_pass_day_date()
        r = requests.get(f"{API}/vip-spaces/available", params={"date": d, "offer_type": "pass_day"}, timeout=15)
        assert r.status_code == 200, r.text
        items = r.json()["items"]
        assert len(items) == 16, f"expected 16, got {len(items)}"
        transats = [it for it in items if it["kind"] == "transat"]
        balines = [it for it in items if it["kind"] == "baline"]
        assert len(transats) == 12 and len(balines) == 4
        # Field presence + values
        for it in items:
            for f in ("id", "kind", "number", "label_fr", "price", "active", "is_available"):
                assert f in it, f"missing field {f} in {it}"
            assert it["active"] is True
            assert it["is_available"] is True  # empty bookings for this far-future date
        # Pricing
        assert all(t["price"] == 10000 for t in transats)
        assert all(b["price"] == 50000 for b in balines)
        # Numbering T01..T12 / B01..B04
        assert {t["number"] for t in transats} == {f"T{i:02d}" for i in range(1, 13)}
        assert {b["number"] for b in balines} == {f"B{i:02d}" for i in range(1, 5)}

    def test_available_for_hebergement_returns_empty(self):
        d = _unique_future_pass_day_date()
        r = requests.get(f"{API}/vip-spaces/available", params={"date": d, "offer_type": "hebergement"}, timeout=15)
        assert r.status_code == 200, r.text
        assert r.json()["items"] == []

    def test_available_for_sunset_returns_16(self):
        # Sunset = Saturday
        d = _next_weekday(5)
        r = requests.get(f"{API}/vip-spaces/available", params={"date": d, "offer_type": "sunset"}, timeout=15)
        assert r.status_code == 200
        assert len(r.json()["items"]) == 16


# ---------- Tests: Booking integration ----------

class TestBookingWithVipSpaces:

    def test_create_booking_pass_day_with_vip_spaces(self):
        d = _unique_future_pass_day_date()
        payload = {
            "offer_type": "pass_day",
            "date": d,
            "adults": 2,
            "children": 0,
            "rooms": 1,
            "participants": _participants(2, 0),
            "boat_time": "10H",
            "vip_space_ids": ["vip_transat_01", "vip_baline_01"],
        }
        r = requests.post(f"{API}/bookings", json=payload, timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        # Day Pass = 50000 / adult * 2 = 100000 ; transat 10000 ; baline 50000 ; total 160000
        assert data["total_amount"] == 160000, data
        assert data.get("vip_spaces_amount") == 60000
        assert set(data.get("vip_space_ids") or []) == {"vip_transat_01", "vip_baline_01"}
        vs = data.get("vip_spaces") or []
        assert len(vs) == 2
        numbers = {v["number"] for v in vs}
        assert numbers == {"T01", "B01"}
        for v in vs:
            assert "id" in v and "number" in v and "price" in v

        # Now availability should mark T01 + B01 as taken
        r2 = requests.get(f"{API}/vip-spaces/available", params={"date": d, "offer_type": "pass_day"}, timeout=15)
        assert r2.status_code == 200
        items = {it["id"]: it for it in r2.json()["items"]}
        assert items["vip_transat_01"]["is_available"] is False
        assert items["vip_baline_01"]["is_available"] is False
        # Other transats stay available
        assert items["vip_transat_02"]["is_available"] is True
        assert items["vip_baline_02"]["is_available"] is True

        # Store for next test
        TestBookingWithVipSpaces._booked_date = d

    def test_double_book_returns_409(self):
        d = getattr(TestBookingWithVipSpaces, "_booked_date", None)
        if not d:
            pytest.skip("Previous booking test didn't run")
        payload = {
            "offer_type": "pass_day",
            "date": d,
            "adults": 2,
            "children": 0,
            "rooms": 1,
            "participants": _participants(2, 0),
            "boat_time": "12H",
            "vip_space_ids": ["vip_transat_01"],
        }
        r = requests.post(f"{API}/bookings", json=payload, timeout=20)
        assert r.status_code == 409, f"expected 409, got {r.status_code}: {r.text}"
        body = r.json()
        detail = body.get("detail") or ""
        assert "déjà réservé" in detail.lower() or "deja reserve" in detail.lower(), detail

    def test_vip_spaces_rejected_for_hebergement(self):
        """spa_wellness is non-beach-club (pole=hebergement); validate that VIP
        space ids are rejected with 400 'Beach Club'."""
        # spa_wellness allowed boat_times 10H-18H every day per iter13 notes.
        # Pick a far-future date.
        d = (date.today() + timedelta(days=150)).isoformat()
        payload = {
            "offer_type": "spa_wellness",
            "date": d,
            "adults": 1,
            "children": 0,
            "rooms": 1,
            "participants": _participants(1, 0),
            "boat_time": "14H",
            "vip_space_ids": ["vip_transat_05"],
        }
        r = requests.post(f"{API}/bookings", json=payload, timeout=20)
        assert r.status_code == 400, r.text
        detail = (r.json().get("detail") or "")
        assert "beach club" in detail.lower(), detail

    def test_vip_spaces_rejected_for_le_kaai(self):
        d = _next_weekday(3)
        payload = {
            "offer_type": "le_kaai",
            "date": d,
            "adults": 2,
            "children": 0,
            "rooms": 1,
            "participants": _participants(2, 0),
            "boat_time": "12H",
            "vip_space_ids": ["vip_transat_05"],
        }
        r = requests.post(f"{API}/bookings", json=payload, timeout=20)
        assert r.status_code == 400, r.text
        assert "beach club" in (r.json().get("detail") or "").lower()

    def test_invalid_vip_space_id_returns_400(self):
        d = _unique_future_pass_day_date()
        payload = {
            "offer_type": "pass_day",
            "date": d,
            "adults": 2,
            "children": 0,
            "rooms": 1,
            "participants": _participants(2, 0),
            "boat_time": "10H",
            "vip_space_ids": ["vip_transat_99_nope"],
        }
        r = requests.post(f"{API}/bookings", json=payload, timeout=20)
        assert r.status_code == 400, r.text
        assert "introuvable" in (r.json().get("detail") or "").lower()


# ---------- Tests: Staff CRUD ----------

class TestStaffVipSpacesCrud:

    def test_admin_list(self, admin_token):
        r = requests.get(f"{API}/staff/vip-spaces", headers={"Authorization": f"Bearer {admin_token}"}, timeout=15)
        assert r.status_code == 200, r.text
        items = r.json()["items"]
        assert len(items) >= 16
        ids = {it["id"] for it in items}
        assert "vip_transat_01" in ids and "vip_baline_01" in ids

    def test_admin_create_patch_delete(self, admin_token):
        h = {"Authorization": f"Bearer {admin_token}"}
        number = f"T{uuid.uuid4().hex[:4].upper()}"  # unique
        # CREATE
        r = requests.post(
            f"{API}/staff/vip-spaces",
            json={
                "kind": "transat",
                "number": number,
                "label_fr": f"TEST Transat {number}",
                "price": 12000,
                "active": True,
                "sort_order": 999,
            },
            headers=h, timeout=15,
        )
        assert r.status_code == 200, r.text
        created = r.json()
        sid = created["id"]
        assert created["number"] == number
        assert created["price"] == 12000

        # Duplicate number → 400
        r2 = requests.post(
            f"{API}/staff/vip-spaces",
            json={
                "kind": "transat",
                "number": number,
                "label_fr": "dup",
                "price": 1,
            },
            headers=h, timeout=15,
        )
        assert r2.status_code == 400, r2.text
        assert "déjà utilisé" in (r2.json().get("detail") or "").lower() or "deja" in (r2.json().get("detail") or "").lower()

        # PATCH
        r3 = requests.patch(
            f"{API}/staff/vip-spaces/{sid}",
            json={"price": 15000, "active": False},
            headers=h, timeout=15,
        )
        assert r3.status_code == 200, r3.text

        # Verify via list
        r4 = requests.get(f"{API}/staff/vip-spaces", headers=h, timeout=15)
        items = {it["id"]: it for it in r4.json()["items"]}
        assert items[sid]["price"] == 15000
        assert items[sid]["active"] is False

        # DELETE
        r5 = requests.delete(f"{API}/staff/vip-spaces/{sid}", headers=h, timeout=15)
        assert r5.status_code == 200, r5.text
        # Confirm removed
        r6 = requests.get(f"{API}/staff/vip-spaces", headers=h, timeout=15)
        assert sid not in {it["id"] for it in r6.json()["items"]}

    def test_management_general_readonly(self, direction_token):
        """direction.test@boulay.ci is documented to be `management_general` in
        /app/memory/test_credentials.md and MUST receive 403 on writes via the
        readonly_role_middleware. Decode the JWT first to surface seed-data drift.
        """
        import base64, json
        parts = direction_token.split(".")
        payload = json.loads(base64.urlsafe_b64decode(parts[1] + "=" * (-len(parts[1]) % 4)))
        assert payload.get("role") == "management_general", (
            f"SEED DATA BUG — direction.test account has role={payload.get('role')} "
            f"instead of 'management_general'. /app/memory/test_credentials.md is out of sync."
        )
        h = {"Authorization": f"Bearer {direction_token}"}
        # GET allowed
        r = requests.get(f"{API}/staff/vip-spaces", headers=h, timeout=15)
        assert r.status_code == 200, r.text
        # POST forbidden
        r2 = requests.post(
            f"{API}/staff/vip-spaces",
            json={"kind": "transat", "number": "TZZZ", "label_fr": "x", "price": 1000},
            headers=h, timeout=15,
        )
        assert r2.status_code == 403, r2.text
        # PATCH forbidden
        r3 = requests.patch(
            f"{API}/staff/vip-spaces/vip_transat_01",
            json={"price": 99999}, headers=h, timeout=15,
        )
        assert r3.status_code == 403, r3.text
        # DELETE forbidden
        r4 = requests.delete(f"{API}/staff/vip-spaces/vip_transat_01", headers=h, timeout=15)
        assert r4.status_code == 403, r4.text
