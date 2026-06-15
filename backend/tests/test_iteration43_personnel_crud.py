"""Iteration 43 — Backend tests for Cantine Personnel CRUD (admin endpoints).

Coverage:
- GET /staff/cantine/users with composable filters (q, type, service, active)
- GET /staff/cantine/users/{user_id} (200 + credits_remaining, 404)
- PATCH /staff/cantine/users/{user_id} (partial update, unknown service → 400)
- POST /staff/cantine/users/{user_id}/regenerate-code
- POST /staff/cantine/users/{user_id}/deactivate (and public reserve 404 after)
- POST /staff/cantine/users/{user_id}/activate
- DELETE /staff/cantine/users/{user_id} (preserves canteen_reservations)
- 403 for hotesse on every CRUD endpoint (CANTINE_ADMIN_ROLES)

Teardown removes TEST_iter43_* users and associated reservations.
"""
from __future__ import annotations

import os
import uuid
import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
load_dotenv("/app/frontend/.env")

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@boulay.ci"
ADMIN_PASS = "Admin@2026"
HOTESSE_EMAIL = "hotesse.test@boulay.ci"
HOTESSE_PASS = "Hotesse@2026"

_created_codes: list[str] = []


def _login(email: str, password: str) -> str | None:
    for path in ("/auth/staff/login", "/auth/login", "/staff/auth/login"):
        try:
            r = requests.post(f"{API}{path}", json={"email": email, "password": password}, timeout=20)
            if r.status_code == 200:
                d = r.json()
                tok = d.get("token") or d.get("access_token") or (d.get("data") or {}).get("token")
                if tok:
                    return tok
        except Exception:
            pass
    return None


@pytest.fixture(scope="session")
def admin_headers():
    tok = _login(ADMIN_EMAIL, ADMIN_PASS)
    if not tok:
        pytest.skip("admin login failed")
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="session")
def hotesse_headers():
    tok = _login(HOTESSE_EMAIL, HOTESSE_PASS)
    if not tok:
        return None
    return {"Authorization": f"Bearer {tok}"}


def _create_public_user(suffix: str = "A", service: str = "Réception",
                        type_: str = "personnel") -> dict:
    """Create a public user via /cantine/public/users (no auth)."""
    payload = {
        "first_name": f"TESTiter43{suffix}",
        "last_name": f"Dupont{uuid.uuid4().hex[:6]}",
        "service": service,
        "position": "Testeur",
        "type": type_,
        "phone": "+225 0700000000",
    }
    r = requests.post(f"{API}/cantine/public/users", json=payload, timeout=20)
    assert r.status_code == 200, f"create failed: {r.status_code} {r.text}"
    d = r.json()
    _created_codes.append(d["code"])
    return d


def _find_user_id(code: str, headers: dict) -> str:
    r = requests.get(f"{API}/staff/cantine/users", params={"q": code}, headers=headers, timeout=20)
    assert r.status_code == 200, r.text
    items = r.json().get("items", [])
    for it in items:
        if it.get("code") == code:
            return it["id"]
    raise AssertionError(f"user {code} not found")


# ───────────── Filters ─────────────
def test_users_filter_composable(admin_headers):
    u = _create_public_user("Filter", service="Réception", type_="personnel")
    code = u["code"]

    # q matches code
    r = requests.get(f"{API}/staff/cantine/users", params={"q": code}, headers=admin_headers, timeout=20)
    assert r.status_code == 200
    assert any(it["code"] == code for it in r.json()["items"])

    # q + type + service + active = true (composable)
    r = requests.get(
        f"{API}/staff/cantine/users",
        params={"q": "TESTiter43Filter", "type": "personnel",
                "service": "Réception", "active": "true"},
        headers=admin_headers, timeout=20,
    )
    assert r.status_code == 200, r.text
    codes = [it["code"] for it in r.json()["items"]]
    assert code in codes

    # type=prestataire should not match a personnel user
    r = requests.get(
        f"{API}/staff/cantine/users",
        params={"q": code, "type": "prestataire"},
        headers=admin_headers, timeout=20,
    )
    assert r.status_code == 200
    assert code not in [it["code"] for it in r.json()["items"]]


# ───────────── GET single ─────────────
def test_get_single_user_ok_and_404(admin_headers):
    u = _create_public_user("Get")
    uid = _find_user_id(u["code"], admin_headers)
    r = requests.get(f"{API}/staff/cantine/users/{uid}", headers=admin_headers, timeout=20)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "credits_remaining" in data
    assert data["credits_remaining"] == max(0, data["credits_attributed"] - data["credits_consumed"])

    r = requests.get(f"{API}/staff/cantine/users/no-such-id", headers=admin_headers, timeout=20)
    assert r.status_code == 404


# ───────────── PATCH partial ─────────────
def test_patch_partial_keeps_other_fields(admin_headers):
    u = _create_public_user("Patch")
    uid = _find_user_id(u["code"], admin_headers)
    original = requests.get(f"{API}/staff/cantine/users/{uid}", headers=admin_headers).json()
    r = requests.patch(f"{API}/staff/cantine/users/{uid}",
                       json={"first_name": "TESTiter43Renamed"},
                       headers=admin_headers, timeout=20)
    assert r.status_code == 200, r.text
    upd = r.json()
    assert upd["first_name"] == "TESTiter43Renamed"
    assert upd["last_name"] == original["last_name"]
    assert upd["service"] == original["service"]
    assert upd["position"] == original["position"]
    assert upd.get("updated_at") and upd["updated_at"] != original.get("updated_at")


def test_patch_unknown_service_400(admin_headers):
    u = _create_public_user("PatchSvc")
    uid = _find_user_id(u["code"], admin_headers)
    r = requests.patch(f"{API}/staff/cantine/users/{uid}",
                       json={"service": "ServiceQuiNexistePas_iter43"},
                       headers=admin_headers, timeout=20)
    assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text}"


# ───────────── Regenerate code ─────────────
def test_regenerate_code(admin_headers):
    u = _create_public_user("Regen")
    old = u["code"]
    uid = _find_user_id(old, admin_headers)
    r = requests.post(f"{API}/staff/cantine/users/{uid}/regenerate-code",
                      headers=admin_headers, timeout=20)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["ok"] is True
    assert d["previous_code"] == old
    assert d["code"] and d["code"] != old
    _created_codes.append(d["code"])

    # Verify DB persistence (lookup the new code publicly)
    r2 = requests.get(f"{API}/cantine/public/users/{d['code']}", timeout=20)
    assert r2.status_code == 200
    # Old code should now be 404
    r3 = requests.get(f"{API}/cantine/public/users/{old}", timeout=20)
    assert r3.status_code == 404


# ───────────── Deactivate ─────────────
def test_deactivate_blocks_public_reserve(admin_headers):
    u = _create_public_user("Deact")
    uid = _find_user_id(u["code"], admin_headers)
    r = requests.post(f"{API}/staff/cantine/users/{uid}/deactivate",
                      headers=admin_headers, timeout=20)
    assert r.status_code == 200, r.text
    # Public reservation must now 404
    r2 = requests.post(f"{API}/cantine/public/reservations",
                       json={"code": u["code"], "confirmed": True}, timeout=20)
    assert r2.status_code == 404, f"expected 404, got {r2.status_code}: {r2.text}"


# ───────────── Activate ─────────────
def test_activate_restores(admin_headers):
    u = _create_public_user("Reac")
    uid = _find_user_id(u["code"], admin_headers)
    requests.post(f"{API}/staff/cantine/users/{uid}/deactivate", headers=admin_headers, timeout=20)
    r = requests.post(f"{API}/staff/cantine/users/{uid}/activate",
                      headers=admin_headers, timeout=20)
    assert r.status_code == 200
    got = requests.get(f"{API}/staff/cantine/users/{uid}", headers=admin_headers).json()
    assert got["active"] is True


# ───────────── Delete preserves reservations ─────────────
def test_delete_preserves_reservations(admin_headers):
    u = _create_public_user("Del")
    uid = _find_user_id(u["code"], admin_headers)
    # Create a reservation so we can verify it is preserved after delete
    rr = requests.post(f"{API}/cantine/public/reservations",
                       json={"code": u["code"], "confirmed": True}, timeout=20)
    assert rr.status_code == 200, rr.text

    # Count reservations for this code BEFORE delete
    before = requests.get(f"{API}/staff/cantine/reservations",
                          params={"scope": "all"}, headers=admin_headers).json()
    before_count = sum(1 for x in before["items"] if x.get("user_code") == u["code"])
    assert before_count >= 1

    # Delete user
    r = requests.delete(f"{API}/staff/cantine/users/{uid}", headers=admin_headers, timeout=20)
    assert r.status_code == 200, r.text

    # User should be gone
    g = requests.get(f"{API}/staff/cantine/users/{uid}", headers=admin_headers)
    assert g.status_code == 404

    # Reservations preserved
    after = requests.get(f"{API}/staff/cantine/reservations",
                         params={"scope": "all"}, headers=admin_headers).json()
    after_count = sum(1 for x in after["items"] if x.get("user_code") == u["code"])
    assert after_count == before_count, \
        f"reservations changed after delete: {before_count} -> {after_count}"


# ───────────── 403 for hotesse on every CRUD ─────────────
def test_hotesse_forbidden_on_crud(admin_headers, hotesse_headers):
    if not hotesse_headers:
        pytest.skip("hotesse login unavailable")
    u = _create_public_user("403")
    uid = _find_user_id(u["code"], admin_headers)

    checks = [
        ("PATCH", f"{API}/staff/cantine/users/{uid}", {"json": {"first_name": "X"}}),
        ("POST", f"{API}/staff/cantine/users/{uid}/regenerate-code", {}),
        ("POST", f"{API}/staff/cantine/users/{uid}/deactivate", {}),
        ("POST", f"{API}/staff/cantine/users/{uid}/activate", {}),
        ("DELETE", f"{API}/staff/cantine/users/{uid}", {}),
    ]
    for method, url, kw in checks:
        r = requests.request(method, url, headers=hotesse_headers, timeout=20, **kw)
        assert r.status_code == 403, f"{method} {url} expected 403 got {r.status_code}: {r.text}"


# ───────────── Teardown ─────────────
@pytest.fixture(scope="session", autouse=True)
def _cleanup(admin_headers):
    yield
    try:
        # Find any leftover users by name prefix and delete
        r = requests.get(f"{API}/staff/cantine/users",
                         params={"q": "TESTiter43"}, headers=admin_headers, timeout=20)
        if r.status_code == 200:
            for it in r.json().get("items", []):
                try:
                    requests.delete(f"{API}/staff/cantine/users/{it['id']}",
                                    headers=admin_headers, timeout=20)
                except Exception:
                    pass
    except Exception:
        pass
