"""Backend tests for Iteration 42 — Cantine Module Phase A.

Tests cover:
- Public APIs: /cantine/public/services, /users, /reservations
- Staff APIs: dashboard, reservations, pointage, exports, settings, services, users
- Auth checks for CANTINE_STAFF_ROLES vs CANTINE_POINTAGE_ROLES
- Scheduler jobs: _job_monthly_renew, _job_close_yesterday

Teardown removes any docs created during the run.
"""
from __future__ import annotations

import os
import re
import sys
import asyncio
import uuid
from datetime import datetime, timezone, timedelta

import pytest
import requests
from dotenv import load_dotenv

# Load backend .env so MONGO_URL / DB_NAME are available for the scheduler test
load_dotenv("/app/backend/.env")
load_dotenv("/app/frontend/.env")

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://reserve-bbr.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@boulay.ci"
ADMIN_PASS = "Admin@2026"
HOTESSE_EMAIL = "hotesse.test@boulay.ci"
HOTESSE_PASS = "Hotesse@2026"

# Track resources created so we can clean up at end
_created_user_codes: list[str] = []
_created_service_ids: list[str] = []
_created_service_names: list[str] = []


# ───────────────────────── Helpers ─────────────────────────
def _login(email: str, password: str) -> str | None:
    for path in ("/auth/staff/login", "/auth/login", "/staff/auth/login"):
        try:
            r = requests.post(f"{API}{path}", json={"email": email, "password": password}, timeout=20)
            if r.status_code == 200:
                data = r.json()
                token = data.get("token") or data.get("access_token") or (data.get("data") or {}).get("token")
                if token:
                    return token
        except Exception:
            pass
    return None


@pytest.fixture(scope="session")
def admin_token():
    tok = _login(ADMIN_EMAIL, ADMIN_PASS)
    if not tok:
        pytest.skip("Admin login failed")
    return tok


@pytest.fixture(scope="session")
def hotesse_token():
    tok = _login(HOTESSE_EMAIL, HOTESSE_PASS)
    if not tok:
        return None
    return tok


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# ───────────────────────── Public: services ─────────────────────────
def test_public_services_returns_10_seeded():
    r = requests.get(f"{API}/cantine/public/services", timeout=15)
    assert r.status_code == 200, r.text
    items = r.json().get("items", [])
    names = {it["name"] for it in items}
    expected = {"Réception", "Restaurant", "Cuisine", "Housekeeping", "Maintenance",
                "Administration", "Comptabilité", "Informatique", "Sécurité", "Prestataires"}
    missing = expected - names
    assert not missing, f"Missing seeded services: {missing}"
    assert len(items) >= 10


# ───────────────────────── Public: user creation ─────────────────────────
def _unique_suffix() -> str:
    return uuid.uuid4().hex[:8]


def test_public_create_personnel_user_returns_code_and_22_credits():
    suffix = _unique_suffix()
    payload = {
        "first_name": f"TEST_iter42_{suffix}",
        "last_name": f"Perso_{suffix}",
        "service": "Restaurant",
        "position": "Serveur",
        "type": "personnel",
    }
    r = requests.post(f"{API}/cantine/public/users", json=payload, timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    assert re.match(r"^[A-Z]{3}\d{3}$", data["code"]), f"Bad code format: {data['code']}"
    assert data["credits_attributed"] == 22
    assert data["credits_consumed"] == 0
    assert data["credits_remaining"] == 22
    _created_user_codes.append(data["code"])


def test_public_create_prestataire_user_has_0_credits():
    suffix = _unique_suffix()
    payload = {
        "first_name": f"TEST_iter42_{suffix}",
        "last_name": f"Presta_{suffix}",
        "service": "Prestataires",
        "position": "Externe",
        "type": "prestataire",
    }
    r = requests.post(f"{API}/cantine/public/users", json=payload, timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["credits_attributed"] == 0
    assert data["credits_remaining"] == 0
    _created_user_codes.append(data["code"])


def test_public_create_user_duplicate_returns_409():
    suffix = _unique_suffix()
    payload = {
        "first_name": f"TEST_iter42_dup_{suffix}",
        "last_name": f"DupLast_{suffix}",
        "service": "Cuisine",
        "position": "Cuisinier",
        "type": "personnel",
    }
    r1 = requests.post(f"{API}/cantine/public/users", json=payload, timeout=15)
    assert r1.status_code == 200
    _created_user_codes.append(r1.json()["code"])
    r2 = requests.post(f"{API}/cantine/public/users", json=payload, timeout=15)
    assert r2.status_code == 409, r2.text


def test_public_create_user_unknown_service_returns_400():
    payload = {
        "first_name": f"TEST_iter42_{_unique_suffix()}",
        "last_name": "Bad",
        "service": "ServiceQuiNExistePas123",
        "position": "X",
        "type": "personnel",
    }
    r = requests.post(f"{API}/cantine/public/users", json=payload, timeout=15)
    assert r.status_code == 400, r.text


# ───────────────────────── Public: lookup ─────────────────────────
def test_public_lookup_user_case_insensitive():
    # create user
    suffix = _unique_suffix()
    payload = {
        "first_name": f"TEST_iter42_look_{suffix}",
        "last_name": f"Look_{suffix}",
        "service": "Administration",
        "position": "Agent",
        "type": "personnel",
    }
    r = requests.post(f"{API}/cantine/public/users", json=payload, timeout=15)
    assert r.status_code == 200
    code = r.json()["code"]
    _created_user_codes.append(code)

    # lookup with lowercase
    r2 = requests.get(f"{API}/cantine/public/users/{code.lower()}", timeout=15)
    assert r2.status_code == 200, r2.text
    assert r2.json()["code"] == code


def test_public_lookup_unknown_returns_404():
    r = requests.get(f"{API}/cantine/public/users/ZZZ999", timeout=15)
    assert r.status_code == 404


# ───────────────────────── Public: reservation ─────────────────────────
def test_public_reservation_creates_for_tomorrow_and_decrements_credit():
    suffix = _unique_suffix()
    payload = {
        "first_name": f"TEST_iter42_res_{suffix}",
        "last_name": f"Res_{suffix}",
        "service": "Maintenance",
        "position": "Tech",
        "type": "personnel",
    }
    r = requests.post(f"{API}/cantine/public/users", json=payload, timeout=15)
    assert r.status_code == 200
    code = r.json()["code"]
    _created_user_codes.append(code)

    # reserve
    rr = requests.post(f"{API}/cantine/public/reservations",
                       json={"code": code, "confirmed": True}, timeout=15)
    assert rr.status_code == 200, rr.text
    data = rr.json()
    assert data["credits_remaining"] == 21
    tomorrow = (datetime.now(timezone.utc).date() + timedelta(days=1)).isoformat()
    assert data["meal_date"] == tomorrow


def test_public_reservation_not_confirmed_returns_400():
    suffix = _unique_suffix()
    r = requests.post(f"{API}/cantine/public/users", json={
        "first_name": f"TEST_iter42_nc_{suffix}", "last_name": f"Nc_{suffix}",
        "service": "Housekeeping", "position": "Agt", "type": "personnel",
    }, timeout=15)
    code = r.json()["code"]
    _created_user_codes.append(code)
    rr = requests.post(f"{API}/cantine/public/reservations",
                       json={"code": code, "confirmed": False}, timeout=15)
    assert rr.status_code == 400


def test_public_reservation_idempotence_409():
    suffix = _unique_suffix()
    r = requests.post(f"{API}/cantine/public/users", json={
        "first_name": f"TEST_iter42_idem_{suffix}", "last_name": f"Id_{suffix}",
        "service": "Sécurité", "position": "Garde", "type": "personnel",
    }, timeout=15)
    code = r.json()["code"]
    _created_user_codes.append(code)
    r1 = requests.post(f"{API}/cantine/public/reservations",
                       json={"code": code, "confirmed": True}, timeout=15)
    assert r1.status_code == 200
    r2 = requests.post(f"{API}/cantine/public/reservations",
                       json={"code": code, "confirmed": True}, timeout=15)
    assert r2.status_code == 409


def test_public_reservation_prestataire_no_credits_400():
    suffix = _unique_suffix()
    r = requests.post(f"{API}/cantine/public/users", json={
        "first_name": f"TEST_iter42_nocred_{suffix}", "last_name": f"NoCr_{suffix}",
        "service": "Prestataires", "position": "X", "type": "prestataire",
    }, timeout=15)
    code = r.json()["code"]
    _created_user_codes.append(code)
    rr = requests.post(f"{API}/cantine/public/reservations",
                       json={"code": code, "confirmed": True}, timeout=15)
    assert rr.status_code == 400


# ───────────────────────── Staff: dashboard / reservations ─────────────────────────
def test_staff_dashboard_admin(admin_headers):
    r = requests.get(f"{API}/staff/cantine/dashboard", headers=admin_headers, timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    for key in ("tomorrow_total", "today_consumed", "tomorrow_personnel",
                "tomorrow_prestataire", "by_service_tomorrow",
                "attendance_rate", "active_users"):
        assert key in data, f"Missing key in dashboard: {key}"


def test_staff_reservations_tomorrow(admin_headers):
    r = requests.get(f"{API}/staff/cantine/reservations?scope=tomorrow",
                     headers=admin_headers, timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "items" in data
    assert isinstance(data["items"], list)


# ───────────────────────── Staff: pointage ─────────────────────────
def _create_user_helper() -> str:
    suffix = _unique_suffix()
    r = requests.post(f"{API}/cantine/public/users", json={
        "first_name": f"TEST_iter42_pt_{suffix}", "last_name": f"Pt_{suffix}",
        "service": "Informatique", "position": "Dev", "type": "personnel",
    }, timeout=15)
    assert r.status_code == 200, r.text
    code = r.json()["code"]
    _created_user_codes.append(code)
    return code


def test_pointage_not_reserved_returns_422(admin_headers):
    code = _create_user_helper()
    r = requests.post(f"{API}/staff/cantine/pointage",
                      headers=admin_headers,
                      json={"code": code, "supervisor_override": False}, timeout=15)
    assert r.status_code == 422, r.text
    detail = r.json().get("detail", {})
    assert isinstance(detail, dict) and detail.get("code") == "not_reserved"
    assert "user" in detail


def test_pointage_supervisor_override_creates_consumed(admin_headers):
    code = _create_user_helper()
    r = requests.post(f"{API}/staff/cantine/pointage",
                      headers=admin_headers,
                      json={"code": code, "supervisor_override": True,
                            "exception_reason": "TEST_iter42_exception"}, timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("ok") is True
    assert "Bon appétit" in data.get("message", "")
    # second pointage same day → 409
    r2 = requests.post(f"{API}/staff/cantine/pointage",
                       headers=admin_headers,
                       json={"code": code, "supervisor_override": True}, timeout=15)
    assert r2.status_code == 409, r2.text


# ───────────────────────── Staff: exports ─────────────────────────
def test_export_xlsx(admin_headers):
    r = requests.get(f"{API}/staff/cantine/exports/xlsx?scope=tomorrow",
                     headers=admin_headers, timeout=20)
    assert r.status_code == 200, r.text[:200]
    ct = r.headers.get("content-type", "")
    assert "openxmlformats" in ct or "spreadsheet" in ct, f"CT: {ct}"
    assert len(r.content) > 2000, f"XLSX too small: {len(r.content)} bytes"


def test_export_pdf(admin_headers):
    r = requests.get(f"{API}/staff/cantine/exports/pdf?scope=tomorrow",
                     headers=admin_headers, timeout=20)
    assert r.status_code == 200, r.text[:200]
    assert r.headers.get("content-type", "").startswith("application/pdf")
    assert len(r.content) > 1000
    assert r.content.startswith(b"%PDF")


# ───────────────────────── Staff: settings ─────────────────────────
def test_settings_get_and_put(admin_headers):
    r = requests.get(f"{API}/staff/cantine/settings", headers=admin_headers, timeout=15)
    assert r.status_code == 200, r.text
    s = r.json()
    original = s.get("default_credits_personnel", 22)
    assert s.get("auto_renew_enabled") in (True, False)

    # update to 25
    r2 = requests.put(f"{API}/staff/cantine/settings", headers=admin_headers,
                      json={"default_credits_personnel": 25}, timeout=15)
    assert r2.status_code == 200
    assert r2.json()["default_credits_personnel"] == 25

    # restore
    r3 = requests.put(f"{API}/staff/cantine/settings", headers=admin_headers,
                      json={"default_credits_personnel": int(original)}, timeout=15)
    assert r3.status_code == 200


# ───────────────────────── Staff: services CRUD ─────────────────────────
def test_services_create_and_dup(admin_headers):
    r = requests.get(f"{API}/staff/cantine/services", headers=admin_headers, timeout=15)
    assert r.status_code == 200
    n0 = len(r.json().get("items", []))
    assert n0 >= 10

    sname = f"TEST_iter42_svc_{_unique_suffix()}"
    r2 = requests.post(f"{API}/staff/cantine/services", headers=admin_headers,
                       json={"name": sname, "sort_order": 99, "active": True}, timeout=15)
    assert r2.status_code == 200, r2.text
    _created_service_ids.append(r2.json()["id"])
    _created_service_names.append(sname)

    # duplicate
    r3 = requests.post(f"{API}/staff/cantine/services", headers=admin_headers,
                       json={"name": sname, "sort_order": 99, "active": True}, timeout=15)
    assert r3.status_code == 409


def test_staff_users_list(admin_headers):
    r = requests.get(f"{API}/staff/cantine/users", headers=admin_headers, timeout=15)
    assert r.status_code == 200
    items = r.json().get("items", [])
    if items:
        assert "credits_remaining" in items[0]


# ───────────────────────── Auth checks ─────────────────────────
def test_hotesse_forbidden_on_dashboard(hotesse_token):
    if not hotesse_token:
        pytest.skip("Hotesse account not available")
    r = requests.get(f"{API}/staff/cantine/dashboard",
                     headers={"Authorization": f"Bearer {hotesse_token}"}, timeout=15)
    assert r.status_code == 403, f"Expected 403, got {r.status_code}: {r.text[:200]}"


def test_hotesse_can_pointage(hotesse_token):
    if not hotesse_token:
        pytest.skip("Hotesse account not available")
    code = _create_user_helper()
    r = requests.post(f"{API}/staff/cantine/pointage",
                      headers={"Authorization": f"Bearer {hotesse_token}"},
                      json={"code": code, "supervisor_override": True,
                            "exception_reason": "TEST_iter42_hotesse"}, timeout=15)
    assert r.status_code == 200, r.text[:200]


# ───────────────────────── Scheduler jobs ─────────────────────────
def test_scheduler_jobs_direct():
    """Import the cantine module and run the two scheduler jobs directly."""
    sys.path.insert(0, "/app/backend")
    from routers import cantine  # noqa: E402
    from motor.motor_asyncio import AsyncIOMotorClient

    mongo_url = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME")
    assert mongo_url and db_name, "MONGO_URL / DB_NAME must be set"

    async def _run():
        client = AsyncIOMotorClient(mongo_url)
        db = client[db_name]

        # ── Renew job ──
        # First, force settings.current_period to a previous month to allow renewal
        await db.canteen_settings.update_one(
            {"_id": "global"},
            {"$set": {"current_period": "1970-01", "auto_renew_enabled": True}},
            upsert=True,
        )
        res1 = await cantine._job_monthly_renew(db)
        assert res1.get("ok") is True, f"Renew should run: {res1}"

        # Second invocation should skip (already-renewed-this-month)
        res2 = await cantine._job_monthly_renew(db)
        assert res2.get("skipped") is True
        assert res2.get("reason") == "already-renewed-this-month"

        # Verify a known TEST user has credits_consumed=0
        if _created_user_codes:
            sample = await db.canteen_users.find_one(
                {"code": _created_user_codes[0]}, {"_id": 0, "credits_consumed": 1},
            )
            if sample:
                assert sample.get("credits_consumed", 0) == 0

        # ── Close-yesterday job ──
        # Insert a synthetic 'reserved' reservation with meal_date = yesterday
        yday = (datetime.now(timezone.utc).date() - timedelta(days=1)).isoformat()
        fake_id = f"TEST_iter42_yres_{uuid.uuid4().hex[:8]}"
        await db.canteen_reservations.insert_one({
            "id": fake_id,
            "user_id": "TEST_iter42_user",
            "user_code": "TST000",
            "first_name": "TEST_iter42",
            "last_name": "Yesterday",
            "service": "Restaurant",
            "position": "X",
            "type": "personnel",
            "meal_date": yday,
            "status": "reserved",
            "reserved_at": datetime.now(timezone.utc).isoformat(),
        })
        res3 = await cantine._job_close_yesterday(db)
        assert res3.get("marked_absent", 0) >= 1, res3

        # Verify
        doc = await db.canteen_reservations.find_one({"id": fake_id}, {"_id": 0, "status": 1})
        assert doc and doc.get("status") == "absent"

        # Cleanup synthetic doc
        await db.canteen_reservations.delete_one({"id": fake_id})
        client.close()

    asyncio.get_event_loop().run_until_complete(_run()) if False else asyncio.run(_run())


# ───────────────────────── Teardown ─────────────────────────
@pytest.fixture(scope="session", autouse=True)
def _final_cleanup(request):
    """Cleanup TEST_iter42_* docs after the test session."""
    yield

    async def _clean():
        from motor.motor_asyncio import AsyncIOMotorClient
        client = AsyncIOMotorClient(os.environ.get("MONGO_URL"))
        db = client[os.environ.get("DB_NAME")]
        if _created_user_codes:
            await db.canteen_reservations.delete_many(
                {"user_code": {"$in": _created_user_codes}}
            )
            await db.canteen_users.delete_many(
                {"code": {"$in": _created_user_codes}}
            )
        if _created_service_ids:
            await db.canteen_services.delete_many(
                {"id": {"$in": _created_service_ids}}
            )
        # Any stray TEST_iter42_* reservations
        await db.canteen_reservations.delete_many(
            {"first_name": {"$regex": "^TEST_iter42_"}}
        )
        await db.canteen_users.delete_many(
            {"first_name": {"$regex": "^TEST_iter42_"}}
        )
        await db.canteen_services.delete_many(
            {"name": {"$regex": "^TEST_iter42_"}}
        )
        client.close()

    try:
        asyncio.run(_clean())
    except RuntimeError:
        # If a loop is already running
        loop = asyncio.new_event_loop()
        loop.run_until_complete(_clean())
        loop.close()
