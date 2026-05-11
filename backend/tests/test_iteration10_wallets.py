"""Iteration 10 — Wallet (on-site activity QR) tests.

Covers:
- Public GET /api/activities catalogue
- Wallet creation on POST /api/bookings/{id}/pay (all payment methods)
- Staff CRUD on /api/staff/activities (admin gating)
- Staff wallet lookup, charge (catalog / custom), void, close
- Role gating (reception cannot close; reception/manager cannot CRUD activities)
"""
import os
import uuid
from datetime import datetime, timedelta

import pytest
import requests

def _load_backend_url() -> str:
    val = os.environ.get("REACT_APP_BACKEND_URL")
    if val:
        return val.rstrip("/")
    # Fallback: parse frontend/.env (CI runs pytest without exporting it)
    env_path = os.path.join(os.path.dirname(__file__), "..", "..", "frontend", ".env")
    try:
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line.startswith("REACT_APP_BACKEND_URL="):
                    return line.split("=", 1)[1].strip().rstrip("/")
    except FileNotFoundError:
        pass
    raise RuntimeError("REACT_APP_BACKEND_URL not set and frontend/.env not found")


BASE_URL = _load_backend_url()
API = f"{BASE_URL}/api"


# ---------- helpers ----------

def _login(email: str, password: str) -> str:
    r = requests.post(f"{API}/auth/staff/login", json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def admin_token():
    return _login("admin@boulay.ci", "Admin@2026")


@pytest.fixture(scope="session")
def manager_token():
    return _login("manager@boulay.ci", "Manager@2026")


@pytest.fixture(scope="session")
def reception_token():
    return _login("reception@boulay.ci", "Reception@2026")


def _hdr(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _next_weekday_iso() -> str:
    d = datetime.utcnow().date() + timedelta(days=7)
    while d.weekday() >= 5:  # 0=Mon..4=Fri
        d = d + timedelta(days=1)
    return d.isoformat()


def _create_pass_day_booking(payment_method: str = "card") -> dict:
    """Create + pay a pass_day booking. Returns the paid booking dict."""
    date_iso = _next_weekday_iso()
    payload = {
        "offer_type": "pass_day",
        "date": date_iso,
        "boat_time": "10H",
        "return_boat_time": "16H",
        "adults": 1,
        "children": 0,
        "phone": "+225 07 00 00 00 00",
        "email": "TEST_wallet@example.ci",
        "participants": [
            {"kind": "adult", "name": "TEST", "surname": "Wallet", "nationality": "Côte d'Ivoire",
             "id_document": "CI123", "email": "TEST_wallet@example.ci", "phone": "+225 07 00 00 00 00"}
        ],
    }
    r = requests.post(f"{API}/bookings", json=payload, timeout=30)
    assert r.status_code in (200, 201), f"create booking: {r.status_code} {r.text}"
    created = r.json()
    booking_id = created["id"]
    ref = created.get("reference_token")
    pay = requests.post(
        f"{API}/bookings/{booking_id}/pay",
        json={"payment_method": payment_method, "reference_token": ref},
        timeout=60,
    )
    assert pay.status_code == 200, f"pay booking: {pay.status_code} {pay.text}"
    return pay.json()


# =================================================================
# Public — Activities catalogue
# =================================================================

def test_public_activities_lists_minimum_9_items():
    r = requests.get(f"{API}/activities", timeout=20)
    assert r.status_code == 200
    data = r.json()
    assert "items" in data
    items = data["items"]
    assert len(items) >= 9, f"expected >=9 activities, got {len(items)}"
    ids = {it["id"] for it in items}
    for expected in ("jetski", "quad", "paddle", "massage", "spa_day", "boat_tour"):
        assert expected in ids, f"missing {expected} in public catalogue"
    for it in items:
        for k in ("id", "name_fr", "price", "category"):
            assert k in it, f"missing field {k} in {it}"
        assert it.get("active") is True
        assert isinstance(it["price"], int) and it["price"] > 0


# =================================================================
# Wallet creation on payment
# =================================================================

@pytest.mark.parametrize("method", ["card", "fineo", "mobile_money", "cash"])
def test_pay_booking_creates_wallet_all_methods(method):
    booking = _create_pass_day_booking(payment_method=method)
    assert "wallet_token" in booking
    token = booking["wallet_token"]
    # UUID v4
    parsed = uuid.UUID(token)
    assert parsed.version == 4
    assert "wallet_qr" in booking
    wq = booking["wallet_qr"]
    assert wq["wallet_token"] == token
    assert wq["qr_code"].startswith("data:image/png;base64,")
    assert wq["ticket_image"].startswith("data:image/png;base64,")


# =================================================================
# Staff wallet lookup
# =================================================================

def test_staff_wallet_lookup_full_and_prefix(reception_token):
    booking = _create_pass_day_booking("card")
    token = booking["wallet_token"]

    # full token
    r = requests.get(f"{API}/staff/wallets/{token}", headers=_hdr(reception_token), timeout=20)
    assert r.status_code == 200, r.text
    w = r.json()
    assert w["token"] == token
    assert w["status"] == "open"
    assert w["total_charged"] == 0
    assert w["transactions"] == []
    assert "booking_ref" in w
    assert "owner_name" in w
    assert isinstance(w.get("booking"), dict)
    assert w["booking"]["id"] == booking["id"]

    # prefix lookup (first 12 chars)
    short = token[:12]
    r2 = requests.get(f"{API}/staff/wallets/{short}", headers=_hdr(reception_token), timeout=20)
    assert r2.status_code == 200
    assert r2.json()["token"] == token


def test_staff_wallet_lookup_404(reception_token):
    r = requests.get(f"{API}/staff/wallets/inexistant-xxx", headers=_hdr(reception_token), timeout=20)
    assert r.status_code == 404


# =================================================================
# Charges (catalogue + custom + invalid)
# =================================================================

def test_charge_jetski_quantity_2(reception_token):
    booking = _create_pass_day_booking("card")
    token = booking["wallet_token"]
    r = requests.post(
        f"{API}/staff/wallets/{token}/charge",
        headers=_hdr(reception_token),
        json={"activity_id": "jetski", "quantity": 2},
        timeout=20,
    )
    assert r.status_code == 200, r.text
    w = r.json()
    assert w["total_charged"] == 90000  # 45000 * 2
    assert len(w["transactions"]) == 1
    tx = w["transactions"][0]
    assert tx["activity_id"] == "jetski"
    assert tx["unit_price"] == 45000
    assert tx["quantity"] == 2
    assert tx["amount"] == 90000
    assert tx["status"] == "active"

    # then a custom charge
    r2 = requests.post(
        f"{API}/staff/wallets/{token}/charge",
        headers=_hdr(reception_token),
        json={"label": "Cocktail", "amount": 8000, "quantity": 3},
        timeout=20,
    )
    assert r2.status_code == 200, r2.text
    w2 = r2.json()
    assert w2["total_charged"] == 90000 + 24000
    assert len(w2["transactions"]) == 2


def test_charge_invalid_activity_returns_404(reception_token):
    booking = _create_pass_day_booking("card")
    token = booking["wallet_token"]
    r = requests.post(
        f"{API}/staff/wallets/{token}/charge",
        headers=_hdr(reception_token),
        json={"activity_id": "does-not-exist", "quantity": 1},
        timeout=20,
    )
    assert r.status_code == 404


def test_charge_empty_payload_returns_400(reception_token):
    booking = _create_pass_day_booking("card")
    token = booking["wallet_token"]
    r = requests.post(
        f"{API}/staff/wallets/{token}/charge",
        headers=_hdr(reception_token),
        json={"label": "Vide"},
        timeout=20,
    )
    assert r.status_code == 400


# =================================================================
# Void / close — role gating
# =================================================================

def test_void_charge_adjusts_total_and_idempotent(manager_token):
    booking = _create_pass_day_booking("card")
    token = booking["wallet_token"]
    r = requests.post(
        f"{API}/staff/wallets/{token}/charge",
        headers=_hdr(manager_token),
        json={"activity_id": "quad", "quantity": 1},
        timeout=20,
    )
    assert r.status_code == 200
    tx_id = r.json()["transactions"][0]["id"]
    assert r.json()["total_charged"] == 35000

    # void
    rv = requests.delete(
        f"{API}/staff/wallets/{token}/charge/{tx_id}",
        headers=_hdr(manager_token),
        timeout=20,
    )
    assert rv.status_code == 200, rv.text
    w = rv.json()
    assert w["total_charged"] == 0
    voided = next(t for t in w["transactions"] if t["id"] == tx_id)
    assert voided["status"] == "voided"

    # second void → 400
    rv2 = requests.delete(
        f"{API}/staff/wallets/{token}/charge/{tx_id}",
        headers=_hdr(manager_token),
        timeout=20,
    )
    assert rv2.status_code == 400


def test_reception_cannot_close_wallet(reception_token, manager_token):
    booking = _create_pass_day_booking("card")
    token = booking["wallet_token"]

    # reception forbidden
    rb = requests.post(
        f"{API}/staff/wallets/{token}/close",
        headers=_hdr(reception_token),
        timeout=20,
    )
    assert rb.status_code == 403

    # manager OK
    rok = requests.post(
        f"{API}/staff/wallets/{token}/close",
        headers=_hdr(manager_token),
        timeout=20,
    )
    assert rok.status_code == 200, rok.text
    w = rok.json()
    assert w["status"] == "closed"
    assert w.get("closed_at")
    assert w.get("closed_by")

    # subsequent charge → 400
    rc = requests.post(
        f"{API}/staff/wallets/{token}/charge",
        headers=_hdr(manager_token),
        json={"activity_id": "jetski", "quantity": 1},
        timeout=20,
    )
    assert rc.status_code == 400
    assert "closed" in rc.text.lower()


# =================================================================
# Admin-only — Activities CRUD
# =================================================================

def test_activities_crud_admin_only(admin_token, manager_token, reception_token):
    activity_id = f"test_act_{uuid.uuid4().hex[:8]}"
    payload = {
        "id": activity_id,
        "name_fr": "TEST_Activity",
        "name_en": "TEST_Activity_EN",
        "category": "Test",
        "price": 1234,
        "active": True,
    }
    # reception → 403
    r1 = requests.post(f"{API}/staff/activities", json=payload, headers=_hdr(reception_token), timeout=20)
    assert r1.status_code == 403
    # manager → 403
    r2 = requests.post(f"{API}/staff/activities", json=payload, headers=_hdr(manager_token), timeout=20)
    assert r2.status_code == 403
    # admin OK
    r3 = requests.post(f"{API}/staff/activities", json=payload, headers=_hdr(admin_token), timeout=20)
    assert r3.status_code == 200, r3.text
    assert r3.json()["id"] == activity_id

    # verify via GET staff
    rls = requests.get(f"{API}/staff/activities", headers=_hdr(admin_token), timeout=20)
    assert rls.status_code == 200
    assert any(it["id"] == activity_id for it in rls.json()["items"])

    # patch — admin
    patched = dict(payload)
    patched["price"] = 5678
    rp = requests.patch(f"{API}/staff/activities/{activity_id}", json=patched, headers=_hdr(admin_token), timeout=20)
    assert rp.status_code == 200

    # patch — manager forbidden
    rpm = requests.patch(f"{API}/staff/activities/{activity_id}", json=patched, headers=_hdr(manager_token), timeout=20)
    assert rpm.status_code == 403

    # delete — manager forbidden
    rdm = requests.delete(f"{API}/staff/activities/{activity_id}", headers=_hdr(manager_token), timeout=20)
    assert rdm.status_code == 403

    # delete — admin
    rd = requests.delete(f"{API}/staff/activities/{activity_id}", headers=_hdr(admin_token), timeout=20)
    assert rd.status_code == 200

    # ensure gone
    rd2 = requests.delete(f"{API}/staff/activities/{activity_id}", headers=_hdr(admin_token), timeout=20)
    assert rd2.status_code == 404
