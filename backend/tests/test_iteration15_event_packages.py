"""
Iteration 15 — Special Event Packages (forfait flat) backend tests.

Covers:
  - POST /api/bookings with offer_type='special_event' + package_selections
    bills each package at its FLAT price (no per-head multiplication, no
    base adults×price_adult + children×price_child carry-over from the
    classical pricing path).
  - max_persons enforcement per package → 400.
  - Unknown package_id for the date → 400.
  - Non-regression: a special event booking WITHOUT package_selections
    still falls back to the classical headcount-based pricing.
  - Participants validation accepts mixed (adults + children) participant
    rows when the legacy len(participants)==total_guests path is taken.
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://reserve-bbr.preview.emergentagent.com").rstrip("/")

EVENT_ID = "a9119968-09d6-4688-85c8-2915784b3a44"
EVENT_DATE = "2026-12-15"
BOAT_TIME = "17H"
RETURN_BOAT_TIME = "23H"
CLEANUP_EMAIL_PREFIX = "t-pkg-"


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _booker(extra: dict | None = None):
    """Build a 'booker' info block. NOTE: BookingCreate does not have top-level
    email/phone — booker info comes from participants[0]. We still keep a
    unique id helper for participants.
    """
    return {}


def _participant(kind: str, idx: int, with_contact: bool = False) -> dict:
    p = {
        "name": f"{kind.title()}{idx}",
        "surname": "Test",
        "nationality": "CI",
        "first_name": f"{kind.title()}{idx}",
        "last_name": "Test",
        "kind": kind,
    }
    if with_contact:
        p["email"] = f"{CLEANUP_EMAIL_PREFIX}p{idx}-{uuid.uuid4().hex[:6]}@test-pkg.com"
        p["phone"] = "+22501010101"
    return p


# ---------- 1. Happy path: two packages, flat sum ----------
def test_two_packages_flat_total(api):
    booker = _booker()
    participants = [
        _participant("adult", 1, with_contact=True),  # booker
        _participant("adult", 2),
        _participant("adult", 3),
        _participant("adult", 4),
        _participant("child", 1),
        _participant("child", 2),
    ]
    payload = {
        "offer_type": "special_event",
        "special_event_id": EVENT_ID,
        "date": EVENT_DATE,
        "multi_day_dates": [EVENT_DATE],
        "boat_time": BOAT_TIME,
        "return_boat_time": RETURN_BOAT_TIME,
        "adults": 4,
        "children": 2,
        "participants": participants,
        "package_selections": [
            {"date": EVENT_DATE, "package_id": "pkg_std", "adults": 2, "children": 1},
            {"date": EVENT_DATE, "package_id": "pkg_bal", "adults": 2, "children": 1},
        ],
        **booker,
    }
    r = api.post(f"{BASE_URL}/api/bookings", json=payload)
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
    data = r.json()
    # Flat sum 50000 + 120000 = 170000, NOT augmented by adults*25000 + children*10000.
    assert data.get("total_amount") == 170000, f"total_amount={data.get('total_amount')} != 170000. body={data}"
    plines = data.get("package_lines") or []
    assert len(plines) == 2, f"Expected 2 package_lines, got {plines}"
    by_id = {p["package_id"]: p for p in plines}
    assert by_id["pkg_std"]["amount"] == 50000
    assert by_id["pkg_bal"]["amount"] == 120000
    # Sanity — base headcount NOT folded into amounts.
    for line in plines:
        assert line["amount"] in (50000, 120000)


# ---------- 2. max_persons exceeded ----------
def test_package_max_persons_exceeded(api):
    booker = _booker()
    participants = [_participant("adult", i, with_contact=(i == 1)) for i in range(1, 6)]
    payload = {
        "offer_type": "special_event",
        "special_event_id": EVENT_ID,
        "date": EVENT_DATE,
        "multi_day_dates": [EVENT_DATE],
        "boat_time": BOAT_TIME,
        "return_boat_time": RETURN_BOAT_TIME,
        "adults": 5,
        "children": 0,
        "participants": participants,
        # pkg_bal has max_persons=4 → 5 must fail.
        "package_selections": [
            {"date": EVENT_DATE, "package_id": "pkg_bal", "adults": 5, "children": 0},
        ],
        **booker,
    }
    r = api.post(f"{BASE_URL}/api/bookings", json=payload)
    assert r.status_code == 400, f"Expected 400, got {r.status_code}: {r.text}"
    detail = (r.json().get("detail") or "").lower()
    assert "personne" in detail and "max" in detail, f"Unexpected detail: {detail}"


# ---------- 3. Unknown package_id ----------
def test_package_unknown_id(api):
    booker = _booker()
    participants = [_participant("adult", 1, with_contact=True), _participant("adult", 2)]
    payload = {
        "offer_type": "special_event",
        "special_event_id": EVENT_ID,
        "date": EVENT_DATE,
        "multi_day_dates": [EVENT_DATE],
        "boat_time": BOAT_TIME,
        "return_boat_time": RETURN_BOAT_TIME,
        "adults": 2,
        "children": 0,
        "participants": participants,
        "package_selections": [
            {"date": EVENT_DATE, "package_id": "pkg_does_not_exist", "adults": 2, "children": 0},
        ],
        **booker,
    }
    r = api.post(f"{BASE_URL}/api/bookings", json=payload)
    assert r.status_code == 400, f"Expected 400, got {r.status_code}: {r.text}"
    detail = (r.json().get("detail") or "").lower()
    assert "introuvable" in detail or "package" in detail, f"Unexpected detail: {detail}"


# ---------- 4. Non-regression: no packages → classical pricing ----------
def test_special_event_without_packages_uses_classical_pricing(api):
    booker = _booker()
    participants = [
        _participant("adult", 1, with_contact=True),
        _participant("adult", 2),
        _participant("child", 1),
    ]
    payload = {
        "offer_type": "special_event",
        "special_event_id": EVENT_ID,
        "date": EVENT_DATE,
        "multi_day_dates": [EVENT_DATE],
        "boat_time": BOAT_TIME,
        "return_boat_time": RETURN_BOAT_TIME,
        "adults": 2,
        "children": 1,
        "participants": participants,
        **booker,
    }
    r = api.post(f"{BASE_URL}/api/bookings", json=payload)
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
    data = r.json()
    # 2 adults * 25000 + 1 child * 10000 = 60000
    assert data.get("total_amount") == 60000, f"total_amount={data.get('total_amount')} != 60000"
    assert not data.get("package_lines"), f"package_lines should be empty/none, got {data.get('package_lines')}"


# ---------- 5. Mixed participants accepted on package flow ----------
def test_mixed_participants_accepted(api):
    """4 adults + 2 children, all rows present; package flow accepts the
    legacy len(participants)==total_guests path."""
    booker = _booker()
    participants = [_participant("adult", i, with_contact=(i == 1)) for i in range(1, 5)]
    participants += [_participant("child", i) for i in range(1, 3)]
    payload = {
        "offer_type": "special_event",
        "special_event_id": EVENT_ID,
        "date": EVENT_DATE,
        "multi_day_dates": [EVENT_DATE],
        "boat_time": BOAT_TIME,
        "return_boat_time": RETURN_BOAT_TIME,
        "adults": 4,
        "children": 2,
        "participants": participants,
        "package_selections": [
            {"date": EVENT_DATE, "package_id": "pkg_std", "adults": 2, "children": 1},
            {"date": EVENT_DATE, "package_id": "pkg_bal", "adults": 2, "children": 1},
        ],
        **booker,
    }
    r = api.post(f"{BASE_URL}/api/bookings", json=payload)
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
    data = r.json()
    assert data.get("total_amount") == 170000
    assert len(data.get("participants") or []) == 6
