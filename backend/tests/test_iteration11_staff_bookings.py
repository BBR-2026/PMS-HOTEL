"""Iteration 11 — Hébergement stats/PDF + Manager-side booking creation.

Covers:
- GET /api/staff/hebergement/stats (manager/admin only, 403 for receptionist)
- GET /api/staff/hebergement/report.pdf (>=2KB %PDF, 403 for receptionist)
- POST /api/staff/bookings — confirmed booking with QR + wallet, 403 for receptionist
- POST /api/staff/bookings Hébergement with deposit_pct=30 -> 30/70 split
- Regression: public POST /api/bookings + /api/bookings/{id}/pay (pass_day & hebergement deposit 30)
- Regression: GET /api/staff/hebergement/today, /calendar, /api/staff/revenue, /api/staff/clients
"""
import os
from datetime import date, datetime, timedelta, timezone

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://reserve-bbr.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = ("admin@boulay.ci", "Admin@2026")
MANAGER = ("manager@boulay.ci", "Manager@2026")
RECEPTION = ("reception@boulay.ci", "Reception@2026")

BOAT_TIMES_WEEKDAY = ["10H", "12H", "14H", "16H", "18H", "20H"]
BOAT_TIMES_WEEKEND = [f"{h}H" for h in range(10, 21)]


def _login(email, password):
    r = requests.post(f"{API}/auth/staff/login", json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, f"Login failed for {email}: {r.status_code} {r.text}"
    tok = r.json().get("access_token")
    assert tok
    return tok


@pytest.fixture(scope="module")
def manager_headers():
    return {"Authorization": f"Bearer {_login(*MANAGER)}"}


@pytest.fixture(scope="module")
def admin_headers():
    return {"Authorization": f"Bearer {_login(*ADMIN)}"}


@pytest.fixture(scope="module")
def reception_headers():
    return {"Authorization": f"Bearer {_login(*RECEPTION)}"}


def _next_weekday(target_wd: int, min_days_ahead: int = 7) -> str:
    d = date.today() + timedelta(days=min_days_ahead)
    while d.weekday() != target_wd:
        d += timedelta(days=1)
    return d.isoformat()


# ============================================================
# Hébergement stats
# ============================================================
class TestHebergementStats:
    def test_stats_receptionist_forbidden(self, reception_headers):
        r = requests.get(f"{API}/staff/hebergement/stats?period=month", headers=reception_headers, timeout=15)
        assert r.status_code == 403

    def test_stats_unauth(self):
        r = requests.get(f"{API}/staff/hebergement/stats?period=month", timeout=15)
        assert r.status_code in (401, 403)

    @pytest.mark.parametrize("period", ["day", "week", "month", "year", "all"])
    def test_stats_manager_each_period(self, manager_headers, period):
        r = requests.get(f"{API}/staff/hebergement/stats?period={period}", headers=manager_headers, timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["period"] == period
        assert "period_label" in data
        for k in ("kpis", "by_tier", "daily_trend", "top_guests", "history"):
            assert k in data, f"Missing key {k}"
        k = data["kpis"]
        for f in ("total_stays", "nights_sold", "occupancy_rate_pct", "revenue_total",
                  "revenue_paid", "balance_due_total", "avg_stay_nights",
                  "avg_revenue_per_stay", "avg_revenue_per_night"):
            assert f in k
        assert isinstance(data["by_tier"], list)
        assert isinstance(data["daily_trend"], list)
        assert isinstance(data["top_guests"], list)
        assert isinstance(data["history"], list)
        # Ensure no leaked _id
        assert "_id" not in data
        for b in data["history"]:
            assert "_id" not in b

    def test_stats_invalid_period_falls_back(self, manager_headers):
        # 'all' branch is the default fallback, but server doesn't reject unknown values
        r = requests.get(f"{API}/staff/hebergement/stats?period=garbage", headers=manager_headers, timeout=15)
        assert r.status_code == 200


# ============================================================
# Hébergement PDF
# ============================================================
class TestHebergementPDF:
    def test_pdf_receptionist_forbidden(self, reception_headers):
        r = requests.get(f"{API}/staff/hebergement/report.pdf?period=month", headers=reception_headers, timeout=20)
        assert r.status_code == 403

    def test_pdf_manager_ok(self, manager_headers):
        r = requests.get(f"{API}/staff/hebergement/report.pdf?period=month", headers=manager_headers, timeout=30)
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("application/pdf")
        body = r.content
        assert len(body) > 2048, f"PDF too small: {len(body)} bytes"
        assert body[:4] == b"%PDF", f"Bad PDF magic: {body[:8]!r}"


# ============================================================
# Staff Booking creation (manager+)
# ============================================================
def _participants(adults=2, children=0):
    arr = []
    for i in range(adults):
        arr.append({
            "kind": "adult",
            "name": f"Adult{i}",
            "surname": "TEST_StaffBk",
            "phone": "+225 07 00 00 00 00",
            "email": f"test_adult{i}@boulay.ci",
            "nationality": "CI",
            "birth_date": "1990-01-01",
        })
    for i in range(children):
        arr.append({
            "kind": "child",
            "name": f"Child{i}",
            "surname": "TEST_StaffBk",
            "birth_date": "2018-01-01",
        })
    return arr


class TestStaffCreateBooking:
    def test_receptionist_forbidden(self, reception_headers):
        body = {
            "offer_type": "pass_day",
            "date": _next_weekday(0),
            "adults": 1, "children": 0,
            "boat_time": "10H",
            "participants": _participants(1, 0),
            "payment_method": "cash",
        }
        r = requests.post(f"{API}/staff/bookings", json=body, headers=reception_headers, timeout=20)
        assert r.status_code == 403

    def test_unauth_rejected(self):
        r = requests.post(f"{API}/staff/bookings", json={}, timeout=15)
        assert r.status_code in (401, 403, 422)

    def test_manager_creates_passday_cash(self, manager_headers):
        body = {
            "offer_type": "pass_day",
            "date": _next_weekday(0),  # Monday
            "adults": 2, "children": 0,
            "boat_time": "10H",
            "participants": _participants(2, 0),
            "payment_method": "cash",
        }
        r = requests.post(f"{API}/staff/bookings", json=body, headers=manager_headers, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["status"] == "confirmed"
        assert data.get("created_by_staff") is True
        assert data.get("created_by_email") == MANAGER[0]
        assert "qr_codes" in data
        assert len(data["qr_codes"]) >= 2  # at least 2 adults tickets
        assert data.get("paid_amount", 0) > 0
        assert data.get("balance_due", 0) == 0
        # No mongo _id leak
        assert "_id" not in data
        for q in data.get("qr_codes", []):
            assert "_id" not in q
        # Wallet QR is also created
        assert data.get("wallet_qr") is not None

    def test_manager_creates_hebergement_deposit_30(self, manager_headers):
        arrival = _next_weekday(0, min_days_ahead=14)
        checkout = (datetime.strptime(arrival, "%Y-%m-%d").date() + timedelta(days=2)).isoformat()
        # arrival weekday for boat time
        wd = datetime.strptime(arrival, "%Y-%m-%d").date().weekday()
        boat = "10H" if wd not in (5, 6) else "10H"
        wd_chk = datetime.strptime(checkout, "%Y-%m-%d").date().weekday()
        return_boat = "18H" if wd_chk not in (5, 6) else "18H"
        body = {
            "offer_type": "hebergement",
            "date": arrival,
            "checkout_date": checkout,
            "room_tier": "superieure",
            "rooms": 1,
            "adults": 2, "children": 0,
            "boat_time": boat,
            "return_boat_time": return_boat,
            "participants": _participants(2, 0),
            "payment_method": "deposit",
            "deposit_pct": 30,
        }
        r = requests.post(f"{API}/staff/bookings", json=body, headers=manager_headers, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["status"] == "confirmed"
        total = data["total_amount"]
        assert data["paid_amount"] == int(round(total * 30 / 100))
        assert data["balance_due"] == total - data["paid_amount"]
        assert data.get("deposit_pct") == 30
        assert data.get("created_by_staff") is True
        assert data.get("nights") == 2


# ============================================================
# Public regression
# ============================================================
class TestPublicRegression:
    def test_public_passday_full_flow(self):
        body = {
            "offer_type": "pass_day",
            "date": _next_weekday(1),  # Tuesday
            "adults": 1, "children": 0,
            "boat_time": "12H",
            "participants": _participants(1, 0),
        }
        r = requests.post(f"{API}/bookings", json=body, timeout=20)
        assert r.status_code == 200, r.text
        bk = r.json()
        assert bk["status"] == "pending"
        assert bk.get("reference_token")
        pay = requests.post(
            f"{API}/bookings/{bk['id']}/pay",
            json={"reference_token": bk["reference_token"], "payment_method": "card"},
            timeout=20,
        )
        assert pay.status_code == 200, pay.text
        pd = pay.json()
        assert pd["status"] == "confirmed"
        assert pd.get("paid_amount", 0) > 0
        assert pd.get("balance_due", 0) == 0

    def test_public_hebergement_deposit_30(self):
        arrival = _next_weekday(2, min_days_ahead=21)  # Wednesday
        checkout = (datetime.strptime(arrival, "%Y-%m-%d").date() + timedelta(days=3)).isoformat()
        body = {
            "offer_type": "hebergement",
            "date": arrival,
            "checkout_date": checkout,
            "room_tier": "suite_jardin",
            "rooms": 1,
            "adults": 2, "children": 0,
            "boat_time": "10H",
            "return_boat_time": "18H",
            "participants": _participants(2, 0),
        }
        r = requests.post(f"{API}/bookings", json=body, timeout=20)
        assert r.status_code == 200, r.text
        bk = r.json()
        pay = requests.post(
            f"{API}/bookings/{bk['id']}/pay",
            json={
                "reference_token": bk["reference_token"],
                "payment_method": "deposit",
                "deposit_pct": 30,
            },
            timeout=20,
        )
        assert pay.status_code == 200, pay.text
        pd = pay.json()
        assert pd["status"] == "confirmed"
        total = pd["total_amount"]
        assert pd["paid_amount"] == int(round(total * 30 / 100))
        assert pd["balance_due"] == total - pd["paid_amount"]


# ============================================================
# Existing staff endpoints regression (manager)
# ============================================================
class TestExistingStaffEndpoints:
    def test_hebergement_today(self, manager_headers):
        r = requests.get(f"{API}/staff/hebergement/today", headers=manager_headers, timeout=15)
        assert r.status_code == 200, r.text
        j = r.json()
        assert "arrivals" in j and "departures" in j

    def test_hebergement_calendar(self, manager_headers):
        m = datetime.now(timezone.utc).strftime("%Y-%m")
        r = requests.get(f"{API}/staff/hebergement/calendar?month={m}", headers=manager_headers, timeout=15)
        assert r.status_code == 200, r.text
        j = r.json()
        assert j.get("month") == m
        assert "days" in j and isinstance(j["days"], list)

    def test_revenue(self, manager_headers):
        r = requests.get(f"{API}/staff/revenue", headers=manager_headers, timeout=15)
        assert r.status_code == 200, r.text
        j = r.json()
        # Required summary fields
        assert "by_method" in j or "by_offer" in j or "total" in j or "kpis" in j

    def test_clients(self, manager_headers):
        r = requests.get(f"{API}/staff/clients", headers=manager_headers, timeout=15)
        assert r.status_code == 200, r.text
        j = r.json()
        assert isinstance(j, (list, dict))
