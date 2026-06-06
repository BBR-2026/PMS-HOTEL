"""Iteration 17 — booker-only booking tunnel.

The frontend now always sends ONE participant (the booker) regardless of the
total head-count. The backend must:
  1. Accept the single-booker shape (new flow)
  2. Reject a child-only booker (booker must be an adult)
  3. Reject an empty participants list
  4. Still accept the legacy shape (one entry per adult, or full mixed list)
  5. Expand the booker into N adults + M children when storing the booking
  6. Generate N adult QR codes on /pay (children attached on the first ticket)
"""
import os
import uuid
import pytest
import requests

def _load_backend_url():
    url = os.environ.get("REACT_APP_BACKEND_URL")
    if not url:
        # Fall back to frontend/.env (pytest runs without React env loaded)
        try:
            from pathlib import Path
            env = Path("/app/frontend/.env").read_text()
            for line in env.splitlines():
                if line.startswith("REACT_APP_BACKEND_URL="):
                    url = line.split("=", 1)[1].strip()
                    break
        except Exception:
            pass
    assert url, "REACT_APP_BACKEND_URL is not configured"
    return url.rstrip("/")


BASE_URL = _load_backend_url()
API = f"{BASE_URL}/api"

PASS_DAY = "pass_day"  # Mon-Fri, boat times: 10/12/14/16/18/20
EVENT_ID = "a9119968-09d6-4688-85c8-2915784b3a44"  # multi-day special event

BOOKER_EMAIL = "test_booker_iter17@example.com"


# ---------- helpers ----------

def _next_weekday(weekday_target: int) -> str:
    """Return YYYY-MM-DD of the next future date matching weekday_target (0=Mon)."""
    from datetime import date, timedelta
    today = date.today()
    # always at least +14 days in the future to avoid same-day caps
    d = today + timedelta(days=14)
    while d.weekday() != weekday_target:
        d += timedelta(days=1)
    return d.isoformat()


def _booker(kind="adult", email=BOOKER_EMAIL):
    return {
        "name": "Iter17",
        "surname": "Booker",
        "email": email,
        "phone": "+225 0707070707",
        "nationality": "France",
        "kind": kind,
    }


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---------- 1. NEW FLOW — single booker for N adults + M children ----------

class TestBookerOnlyFlow:
    """The new flow: 1 participant payload regardless of adults+children."""

    def test_pass_day_5_adults_2_children_single_booker_succeeds(self, session):
        date_iso = _next_weekday(0)  # Monday
        body = {
            "offer_type": PASS_DAY,
            "date": date_iso,
            "adults": 5,
            "children": 2,
            "participants": [_booker()],
            "boat_time": "12H",
        }
        r = session.post(f"{API}/bookings", json=body)
        assert r.status_code == 200, r.text
        data = r.json()
        # Server should have expanded the booker -> 5 adults + 2 children
        parts = data["participants"]
        assert len(parts) == 7
        adults = [p for p in parts if p["kind"] == "adult"]
        kids = [p for p in parts if p["kind"] == "child"]
        assert len(adults) == 5
        assert len(kids) == 2
        # All cloned from the booker
        for p in parts:
            assert p["name"] == "Iter17"
            assert p["surname"] == "Booker"
            assert p["nationality"] == "France"
        # Booking can be paid → 5 adult QR codes, children attached on ticket #1
        bid = data["id"]
        ref = data["reference_token"]
        pay = session.post(
            f"{API}/bookings/{bid}/pay",
            json={"reference_token": ref, "payment_method": "fineo"},
        )
        assert pay.status_code == 200, pay.text
        pay_data = pay.json()
        qrs = pay_data["qr_codes"]
        assert len(qrs) == 5, f"Expected 5 adult QRs, got {len(qrs)}"
        for q in qrs:
            assert q["guest_name"] == "Iter17"
            assert q["guest_surname"] == "Booker"
            assert q["kind"] == "adult"
        # tokens unique
        tokens = {q["qr_token"] for q in qrs}
        assert len(tokens) == 5
        # children attached on first ticket only
        assert qrs[0]["children_attached"] == 2
        for q in qrs[1:]:
            assert q["children_attached"] == 0

    def test_pass_day_3_adults_only_single_booker(self, session):
        date_iso = _next_weekday(1)  # Tuesday
        body = {
            "offer_type": PASS_DAY,
            "date": date_iso,
            "adults": 3,
            "children": 0,
            "participants": [_booker()],
            "boat_time": "14H",
        }
        r = session.post(f"{API}/bookings", json=body)
        assert r.status_code == 200, r.text
        data = r.json()
        assert len(data["participants"]) == 3
        assert all(p["kind"] == "adult" for p in data["participants"])
        bid = data["id"]
        ref = data["reference_token"]
        pay = session.post(
            f"{API}/bookings/{bid}/pay",
            json={"reference_token": ref, "payment_method": "fineo"},
        )
        assert pay.status_code == 200
        qrs = pay.json()["qr_codes"]
        assert len(qrs) == 3
        assert all(q["children_attached"] == 0 for q in qrs)


# ---------- 2/3. VALIDATION ERRORS ----------

class TestBookerValidation:
    def test_child_only_booker_rejected(self, session):
        date_iso = _next_weekday(2)
        body = {
            "offer_type": PASS_DAY,
            "date": date_iso,
            "adults": 1,
            "children": 0,
            "participants": [_booker(kind="child")],
            "boat_time": "10H",
        }
        r = session.post(f"{API}/bookings", json=body)
        assert r.status_code == 400
        assert "adult" in r.text.lower() or "réservant" in r.text.lower()

    def test_empty_participants_rejected(self, session):
        date_iso = _next_weekday(3)
        body = {
            "offer_type": PASS_DAY,
            "date": date_iso,
            "adults": 2,
            "children": 0,
            "participants": [],
            "boat_time": "10H",
        }
        r = session.post(f"{API}/bookings", json=body)
        assert r.status_code in (400, 422), r.text


# ---------- 4/5. LEGACY BACKWARD COMPATIBILITY ----------

class TestLegacyParticipantsShape:
    def test_legacy_3_adults_3_participants(self, session):
        """Old client: one entry per adult (no children)."""
        date_iso = _next_weekday(3)
        parts = [
            {**_booker(email=f"booker_{i}@example.com"), "name": f"Adult{i}"}
            for i in range(3)
        ]
        body = {
            "offer_type": PASS_DAY,
            "date": date_iso,
            "adults": 3,
            "children": 0,
            "participants": parts,
            "boat_time": "16H",
        }
        r = session.post(f"{API}/bookings", json=body)
        assert r.status_code == 200, r.text
        data = r.json()
        assert len(data["participants"]) == 3
        names = sorted([p["name"] for p in data["participants"]])
        assert names == ["Adult0", "Adult1", "Adult2"]

    def test_legacy_mixed_2_adults_1_child(self, session):
        """Old package flow: full mixed list (2 adults + 1 child)."""
        date_iso = _next_weekday(4)  # Friday
        parts = [
            {**_booker(email="a1@example.com"), "name": "A1", "kind": "adult"},
            {**_booker(email="a2@example.com"), "name": "A2", "kind": "adult"},
            {**_booker(email="c1@example.com"), "name": "C1", "kind": "child"},
        ]
        body = {
            "offer_type": PASS_DAY,
            "date": date_iso,
            "adults": 2,
            "children": 1,
            "participants": parts,
            "boat_time": "18H",
        }
        r = session.post(f"{API}/bookings", json=body)
        assert r.status_code == 200, r.text
        data = r.json()
        assert len(data["participants"]) == 3
        adults = [p for p in data["participants"] if p["kind"] == "adult"]
        kids = [p for p in data["participants"] if p["kind"] == "child"]
        assert len(adults) == 2 and len(kids) == 1
        # Pay → 2 adult QRs (1 child attached on the first one)
        pay = session.post(
            f"{API}/bookings/{data['id']}/pay",
            json={"reference_token": data["reference_token"], "payment_method": "fineo"},
        )
        assert pay.status_code == 200
        qrs = pay.json()["qr_codes"]
        assert len(qrs) == 2
        assert qrs[0]["children_attached"] == 1
