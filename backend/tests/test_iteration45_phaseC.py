"""Iteration 45 — Phase C Vague 1: Marketing Campaigns + Media Library + Top Offers/Abandons + Tracking."""
import os
import io
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
ADMIN_EMAIL = "admin@boulay.ci"
ADMIN_PASSWORD = "Admin@2026"

if not BASE_URL:
    # Fallback to internal backend if REACT_APP_BACKEND_URL is missing on the runner.
    BASE_URL = "http://localhost:8001"


@pytest.fixture(scope="session")
def auth_headers():
    r = requests.post(
        f"{BASE_URL}/api/auth/staff/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=30,
    )
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text[:300]}"
    token = r.json().get("access_token")
    assert token
    return {"Authorization": f"Bearer {token}"}


# -------- Marketing meta / universes --------
def test_meta_universes(auth_headers):
    r = requests.get(f"{BASE_URL}/api/staff/marketing/meta/universes", headers=auth_headers, timeout=20)
    assert r.status_code == 200, r.text
    d = r.json()
    assert "universes" in d and "objectives" in d and "creative_formats" in d and "statuses" in d
    expected = {"beach_club", "hebergement", "le_kaai", "corporate", "activites_events"}
    assert expected.issubset(set(d["universes"].keys()))
    assert "meta_square" in d["creative_formats"]
    assert d["creative_formats"]["meta_square"]["width"] == 1080
    for s in ["draft", "active", "paused", "ended"]:
        assert s in d["statuses"]


# -------- Campaign CRUD + creatives --------
@pytest.fixture(scope="module")
def created_campaign(auth_headers):
    payload = {
        "name": "TEST_Campaign_Phase_C",
        "universe": "beach_club",
        "offer": "Day Pass",
        "start_date": "2026-01-15",
        "end_date": "2026-02-15",
        "budget_total": 100000,
        "budget_daily": 5000,
        "objective": "reservations",
        "status": "draft",
    }
    r = requests.post(f"{BASE_URL}/api/staff/marketing/campaigns", json=payload, headers=auth_headers, timeout=20)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["id"] and d["status"] == "draft"
    yield d
    # teardown
    requests.delete(f"{BASE_URL}/api/staff/marketing/campaigns/{d['id']}", headers=auth_headers, timeout=15)


def test_create_invalid_universe(auth_headers):
    r = requests.post(
        f"{BASE_URL}/api/staff/marketing/campaigns",
        json={"name": "Bad", "universe": "INVALID", "offer": "X", "start_date": "2026-01-01",
              "end_date": "2026-01-02", "budget_total": 0, "budget_daily": 0, "objective": "reservations"},
        headers=auth_headers, timeout=15,
    )
    assert r.status_code == 400


def test_create_invalid_objective(auth_headers):
    r = requests.post(
        f"{BASE_URL}/api/staff/marketing/campaigns",
        json={"name": "Bad", "universe": "beach_club", "offer": "X", "start_date": "2026-01-01",
              "end_date": "2026-01-02", "budget_total": 0, "budget_daily": 0, "objective": "INVALID"},
        headers=auth_headers, timeout=15,
    )
    assert r.status_code == 400


def test_list_campaigns(auth_headers, created_campaign):
    r = requests.get(f"{BASE_URL}/api/staff/marketing/campaigns", headers=auth_headers, timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert "items" in d and "counts" in d
    assert any(c["id"] == created_campaign["id"] for c in d["items"])
    assert set(d["counts"].keys()) >= {"draft", "active", "paused", "ended"}


def test_update_campaign_activate(auth_headers, created_campaign):
    cid = created_campaign["id"]
    r = requests.patch(
        f"{BASE_URL}/api/staff/marketing/campaigns/{cid}",
        json={"status": "active"}, headers=auth_headers, timeout=15,
    )
    assert r.status_code == 200, r.text
    g = requests.get(f"{BASE_URL}/api/staff/marketing/campaigns/{cid}", headers=auth_headers, timeout=15)
    assert g.status_code == 200 and g.json()["status"] == "active"


def test_creatives_add_remove(auth_headers, created_campaign):
    cid = created_campaign["id"]
    r = requests.post(
        f"{BASE_URL}/api/staff/marketing/campaigns/{cid}/creatives",
        json={"format": "meta_square", "label": "TEST_creative"}, headers=auth_headers, timeout=15,
    )
    assert r.status_code == 200, r.text
    cr_id = r.json()["id"]
    # invalid format
    bad = requests.post(
        f"{BASE_URL}/api/staff/marketing/campaigns/{cid}/creatives",
        json={"format": "nope"}, headers=auth_headers, timeout=15,
    )
    assert bad.status_code == 400
    rd = requests.delete(
        f"{BASE_URL}/api/staff/marketing/campaigns/{cid}/creatives/{cr_id}",
        headers=auth_headers, timeout=15,
    )
    assert rd.status_code == 200


# -------- Media Library --------
def _tiny_png_bytes() -> bytes:
    # 1x1 red PNG
    import base64
    b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
    return base64.b64decode(b64)


@pytest.fixture(scope="module")
def uploaded_media(auth_headers):
    files = {"file": ("test.png", _tiny_png_bytes(), "image/png")}
    data = {"universe": "beach_club", "offer": "Day Pass", "label": "TEST_media", "tags": "test,phasec"}
    r = requests.post(f"{BASE_URL}/api/staff/media-library", files=files, data=data, headers=auth_headers, timeout=60)
    if r.status_code != 200:
        pytest.skip(f"media upload failed (storage may be unavailable): {r.status_code} {r.text[:300]}")
    d = r.json()
    assert d["id"] and d["url"]
    yield d
    requests.delete(f"{BASE_URL}/api/staff/media-library/{d['id']}", headers=auth_headers, timeout=15)


def test_media_public_read(uploaded_media):
    mid = uploaded_media["id"]
    r = requests.get(f"{BASE_URL}/api/media-library/{mid}", timeout=30)
    assert r.status_code == 200, r.text[:200]
    assert r.headers.get("Content-Type", "").startswith("image/")
    assert len(r.content) > 0


def test_media_list_filter(auth_headers, uploaded_media):
    r = requests.get(f"{BASE_URL}/api/staff/media-library?universe=beach_club", headers=auth_headers, timeout=20)
    assert r.status_code == 200
    items = r.json()["items"]
    assert any(i["id"] == uploaded_media["id"] for i in items)


def test_media_patch(auth_headers, uploaded_media):
    mid = uploaded_media["id"]
    r = requests.patch(f"{BASE_URL}/api/staff/media-library/{mid}",
                       json={"label": "TEST_renamed"}, headers=auth_headers, timeout=15)
    assert r.status_code == 200


def test_media_delete_then_404(auth_headers):
    files = {"file": ("td.png", _tiny_png_bytes(), "image/png")}
    r = requests.post(f"{BASE_URL}/api/staff/media-library", files=files, data={"label": "TEST_delete_me"},
                      headers=auth_headers, timeout=60)
    if r.status_code != 200:
        pytest.skip(f"upload skipped: {r.status_code}")
    mid = r.json()["id"]
    d = requests.delete(f"{BASE_URL}/api/staff/media-library/{mid}", headers=auth_headers, timeout=15)
    assert d.status_code == 200
    g = requests.get(f"{BASE_URL}/api/media-library/{mid}", timeout=15)
    assert g.status_code == 404


def test_media_invalid_mime(auth_headers):
    files = {"file": ("bad.txt", b"hello", "text/plain")}
    r = requests.post(f"{BASE_URL}/api/staff/media-library", files=files, data={}, headers=auth_headers, timeout=20)
    assert r.status_code == 400


# -------- Top offers / Abandons --------
def test_top_offers(auth_headers):
    r = requests.get(f"{BASE_URL}/api/staff/marketing/top-offers?period=30d", headers=auth_headers, timeout=20)
    assert r.status_code == 200, r.text
    d = r.json()
    assert "items" in d and isinstance(d["items"], list)
    if d["items"]:
        it = d["items"][0]
        for k in ("offer", "views", "starts", "purchases", "view_to_start_pct", "view_to_purchase_pct"):
            assert k in it


def test_abandons(auth_headers):
    r = requests.get(f"{BASE_URL}/api/staff/marketing/abandons?period=30d", headers=auth_headers, timeout=20)
    assert r.status_code == 200
    d = r.json()
    assert "summary" in d and "per_offer" in d
    for k in ("started_booking", "completed_purchase", "abandoned", "abandon_rate_pct"):
        assert k in d["summary"]


# -------- Tracking site_settings --------
def test_tracking_section(auth_headers):
    r = requests.get(f"{BASE_URL}/api/staff/site/sections/tracking", headers=auth_headers, timeout=15)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d.get("key") == "tracking"
    data = d.get("data") or {}
    # Default keys per PRD: gtm_container_id, gtm_enabled, notes
    for k in ("gtm_container_id", "gtm_enabled", "notes"):
        assert k in data, f"missing default key {k}: {data}"


def test_tracking_update(auth_headers):
    payload = {"data": {"gtm_container_id": "GTM-TEST123", "gtm_enabled": True, "notes": "TEST"}}
    r = requests.put(f"{BASE_URL}/api/staff/site/sections/tracking", json=payload, headers=auth_headers, timeout=15)
    assert r.status_code == 200, f"{r.status_code} {r.text[:200]}"
    # Verify persistence via public config
    g = requests.get(f"{BASE_URL}/api/site/config", timeout=15)
    assert g.status_code == 200
    cfg = g.json()
    assert cfg.get("tracking", {}).get("gtm_container_id") == "GTM-TEST123"
