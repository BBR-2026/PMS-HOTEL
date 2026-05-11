"""Iteration 9 - Tests for deposit payment option (Hébergement only).

Covers:
- POST /api/bookings/{id}/pay with payment_method='deposit' + deposit_pct in {10,30,70}
  on overnight (hebergement) offer
- Rejection of deposit_pct=50 (HTTP 422 Literal) and deposit on non-overnight offers (HTTP 400)
- Backwards-compat: card/fineo/mobile_money produce full payment
- Backwards-compat: cash on non-overnight offers still works
- GET /api/staff/bookings/{id} exposes paid_amount/balance_due/deposit_pct/payment_method
"""

import os
from datetime import date, timedelta

import pytest
import requests

def _load_backend_url():
    url = os.environ.get("REACT_APP_BACKEND_URL")
    if not url:
        env_path = "/app/frontend/.env"
        if os.path.exists(env_path):
            with open(env_path) as f:
                for line in f:
                    if line.startswith("REACT_APP_BACKEND_URL="):
                        url = line.split("=", 1)[1].strip()
                        break
    assert url, "REACT_APP_BACKEND_URL not configured"
    return url.rstrip("/")


BASE_URL = _load_backend_url()
API = f"{BASE_URL}/api"

MANAGER = {"email": "manager@boulay.ci", "password": "Manager@2026"}


# ---------- Helpers ----------
def _future_weekday():
    """Return a future Monday (weekday=0) to match pass_day open days."""
    d = date.today() + timedelta(days=14)
    while d.weekday() != 0:
        d += timedelta(days=1)
    return d.isoformat()


def _future_date_offset(days=21):
    return (date.today() + timedelta(days=days)).isoformat()


def _staff_token():
    r = requests.post(f"{API}/auth/staff/login", json=MANAGER, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def _create_hebergement_booking():
    """Create a 1-night Hebergement booking (superieure, 1 adult, 1 room)."""
    checkin = _future_date_offset(30)
    checkout = _future_date_offset(31)
    payload = {
        "offer_type": "hebergement",
        "name": "TEST_Deposit",
        "surname": "Client",
        "phone": "+225 07 11 22 33 44",
        "email": "test_deposit@example.ci",
        "date": checkin,
        "checkout_date": checkout,
        "room_tier": "superieure",
        "rooms": 1,
        "adults": 1,
        "children": 0,
        "boat_time": "10H",
        "return_boat_time": "16H",
        "participants": [
            {"kind": "adult", "name": "TEST", "surname": "Deposit",
             "email": "test_deposit@example.ci", "phone": "+225 07 11 22 33 44",
             "nationality": "France"}
        ],
        "special_requests": "",
    }
    r = requests.post(f"{API}/bookings", json=payload, timeout=20)
    assert r.status_code == 200, f"Create hebergement booking failed: {r.status_code} {r.text}"
    return r.json()


def _create_passday_booking():
    """Create a 1-adult pass_day booking on a Monday."""
    target = _future_weekday()
    payload = {
        "offer_type": "pass_day",
        "name": "TEST_Cash",
        "surname": "Client",
        "phone": "+225 07 11 22 33 44",
        "email": "test_cash@example.ci",
        "date": target,
        "rooms": 1,
        "adults": 1,
        "children": 0,
        "boat_time": "10H",
        "participants": [
            {"kind": "adult", "name": "TEST", "surname": "Cash",
             "email": "test_cash@example.ci", "phone": "+225 07 11 22 33 44",
             "nationality": "France"}
        ],
        "special_requests": "",
    }
    r = requests.post(f"{API}/bookings", json=payload, timeout=20)
    assert r.status_code == 200, f"Create pass_day failed: {r.status_code} {r.text}"
    return r.json()


# ---------- Tests ----------
class TestDepositPaymentHebergement:
    """Deposit payment flow on Hebergement (is_overnight=True)."""

    @pytest.mark.parametrize("pct", [10, 30, 70])
    def test_deposit_pct_valid(self, pct):
        booking = _create_hebergement_booking()
        total = int(booking["total_amount"])
        assert total > 0, "Hebergement booking should have non-zero total"

        r = requests.post(
            f"{API}/bookings/{booking['id']}/pay",
            json={"reference_token": booking["reference_token"],
                  "payment_method": "deposit", "deposit_pct": pct},
            timeout=30,
        )
        assert r.status_code == 200, f"pct={pct}: {r.status_code} {r.text}"
        data = r.json()

        expected_paid = int(round(total * pct / 100))
        expected_balance = total - expected_paid

        assert data["status"] == "confirmed"
        assert data["payment_method"] == "deposit"
        assert data["deposit_pct"] == pct
        assert data["paid_amount"] == expected_paid
        assert data["balance_due"] == expected_balance
        assert data["paid_at"] is not None
        assert isinstance(data.get("qr_codes"), list) and len(data["qr_codes"]) == 1

        # Styled gold ticket expected for deposit (not cash receipt)
        entry = data["qr_codes"][0]
        assert entry.get("qr_code"), "Missing qr_code (base64) for deposit"
        assert entry.get("ticket_image"), "Missing ticket_image for deposit"

    def test_deposit_pct_50_rejected_422(self):
        booking = _create_hebergement_booking()
        r = requests.post(
            f"{API}/bookings/{booking['id']}/pay",
            json={"reference_token": booking["reference_token"],
                  "payment_method": "deposit", "deposit_pct": 50},
            timeout=20,
        )
        # Pydantic Literal[10,30,70] -> 422; backend safety net would yield 400.
        assert r.status_code in (400, 422), f"Expected 400/422, got {r.status_code}: {r.text}"

    def test_deposit_missing_pct_rejected(self):
        booking = _create_hebergement_booking()
        r = requests.post(
            f"{API}/bookings/{booking['id']}/pay",
            json={"reference_token": booking["reference_token"],
                  "payment_method": "deposit"},
            timeout=20,
        )
        assert r.status_code in (400, 422)


class TestDepositRejectedOnNonOvernight:
    def test_deposit_on_passday_rejected(self):
        booking = _create_passday_booking()
        r = requests.post(
            f"{API}/bookings/{booking['id']}/pay",
            json={"reference_token": booking["reference_token"],
                  "payment_method": "deposit", "deposit_pct": 10},
            timeout=20,
        )
        assert r.status_code == 400
        detail = r.json().get("detail", "")
        assert "overnight" in detail.lower() or "deposit" in detail.lower(), detail


class TestBackwardsCompatFullPayment:
    @pytest.mark.parametrize("method", ["card", "fineo", "mobile_money"])
    def test_full_payment_on_hebergement(self, method):
        booking = _create_hebergement_booking()
        total = int(booking["total_amount"])
        r = requests.post(
            f"{API}/bookings/{booking['id']}/pay",
            json={"reference_token": booking["reference_token"],
                  "payment_method": method},
            timeout=30,
        )
        assert r.status_code == 200, f"{method}: {r.status_code} {r.text}"
        data = r.json()
        assert data["payment_method"] == method
        assert data["paid_amount"] == total
        assert data["balance_due"] == 0
        assert data.get("deposit_pct") is None
        assert data["status"] == "confirmed"

    def test_cash_on_passday_still_works(self):
        booking = _create_passday_booking()
        total = int(booking["total_amount"])
        r = requests.post(
            f"{API}/bookings/{booking['id']}/pay",
            json={"reference_token": booking["reference_token"],
                  "payment_method": "cash"},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["payment_method"] == "cash"
        assert data["paid_amount"] == total
        assert data["balance_due"] == 0
        assert data["status"] == "confirmed"
        entry = data["qr_codes"][0]
        # Cash on non-overnight -> cash receipt (still has ticket_image, but unstyled).
        assert entry.get("ticket_image"), "cash receipt image expected"


class TestStaffBookingDetailExposesDepositFields:
    def test_manager_sees_deposit_fields(self):
        booking = _create_hebergement_booking()
        total = int(booking["total_amount"])
        pay = requests.post(
            f"{API}/bookings/{booking['id']}/pay",
            json={"reference_token": booking["reference_token"],
                  "payment_method": "deposit", "deposit_pct": 30},
            timeout=30,
        )
        assert pay.status_code == 200, pay.text

        token = _staff_token()
        r = requests.get(
            f"{API}/staff/bookings/{booking['id']}",
            headers={"Authorization": f"Bearer {token}"},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["payment_method"] == "deposit"
        assert data["deposit_pct"] == 30
        assert data["paid_amount"] == int(round(total * 30 / 100))
        assert data["balance_due"] == total - data["paid_amount"]
