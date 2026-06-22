"""Tests for `_resolve_qr_token` robustness (iter-50).

Hits the live FastAPI app via the deployed REACT_APP_BACKEND_URL — no
camera or zbar dependency required.

Run:  cd /app/backend && python -m pytest tests/test_qr_resolve_robustness.py
"""
from __future__ import annotations

import json
import os

import pytest
import httpx


def _backend_url() -> str:
    path = os.path.join(os.path.dirname(__file__), "..", "..", "frontend", ".env")
    with open(path, "r", encoding="utf-8") as fh:
        for line in fh:
            if line.startswith("REACT_APP_BACKEND_URL="):
                return line.split("=", 1)[1].strip()
    raise RuntimeError("REACT_APP_BACKEND_URL not found")


BASE = _backend_url()


@pytest.fixture(scope="module")
def staff_token():
    r = httpx.post(
        f"{BASE}/api/auth/staff/login",
        json={"email": "admin@boulay.ci", "password": "Admin@2026"},
        timeout=15,
    )
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def sample_booking(staff_token):
    headers = {"Authorization": f"Bearer {staff_token}"}
    r = httpx.get(f"{BASE}/api/staff/bookings?limit=30&status=confirmed", headers=headers, timeout=15)
    assert r.status_code == 200, r.text
    items = r.json().get("items", []) if isinstance(r.json(), dict) else r.json()
    for b in items:
        d = httpx.get(f"{BASE}/api/staff/bookings/{b['id']}", headers=headers, timeout=15)
        if d.status_code != 200:
            continue
        body = d.json()
        qrs = body.get("qr_codes") or []
        if qrs and qrs[0].get("qr_token"):
            return body
    pytest.skip("No confirmed booking with QR token available")


def _scan(token_str, bearer):
    return httpx.get(
        f"{BASE}/api/staff/scan/{token_str}",
        headers={"Authorization": f"Bearer {bearer}"},
        timeout=15,
    )


class TestQRResolveRobustness:
    def test_full_token(self, staff_token, sample_booking):
        qr = sample_booking["qr_codes"][0]["qr_token"]
        r = _scan(qr, staff_token)
        assert r.status_code == 200, r.text
        assert r.json()["booking_id"] == sample_booking["id"]

    def test_short_ref_uppercase(self, staff_token, sample_booking):
        qr = sample_booking["qr_codes"][0]["qr_token"]
        r = _scan(qr[:10].upper(), staff_token)
        assert r.status_code == 200
        assert r.json()["booking_id"] == sample_booking["id"]

    def test_short_ref_lowercase(self, staff_token, sample_booking):
        qr = sample_booking["qr_codes"][0]["qr_token"]
        r = _scan(qr[:10].lower(), staff_token)
        assert r.status_code == 200
        assert r.json()["booking_id"] == sample_booking["id"]

    def test_8char_booking_ref(self, staff_token, sample_booking):
        ref = sample_booking["id"][:8].upper()
        r = _scan(ref, staff_token)
        assert r.status_code == 200
        assert r.json()["booking_id"] == sample_booking["id"]

    def test_booking_id_with_dashes(self, staff_token, sample_booking):
        bid = sample_booking["id"]
        r = _scan(bid, staff_token)
        assert r.status_code == 200, r.text
        assert r.json()["booking_id"] == bid

    def test_booking_id_no_dashes(self, staff_token, sample_booking):
        bid = sample_booking["id"]
        r = _scan(bid.replace("-", ""), staff_token)
        assert r.status_code == 200, r.text
        assert r.json()["booking_id"] == bid

    def test_json_ticket_payload(self, staff_token, sample_booking):
        qr = sample_booking["qr_codes"][0]["qr_token"]
        payload = json.dumps(
            {"type": "ticket", "token": qr, "ref": sample_booking["id"][:8].upper()},
            ensure_ascii=False, separators=(",", ":"),
        )
        r = _scan(payload, staff_token)
        assert r.status_code == 200
        assert r.json()["booking_id"] == sample_booking["id"]

    def test_json_guest_token_legacy(self, staff_token, sample_booking):
        qr = sample_booking["qr_codes"][0]["qr_token"]
        payload = json.dumps({"guest_token": qr})
        r = _scan(payload, staff_token)
        assert r.status_code == 200

    def test_json_pass_token(self, staff_token, sample_booking):
        qr = sample_booking["qr_codes"][0]["qr_token"]
        payload = json.dumps({"pass_token": qr})
        r = _scan(payload, staff_token)
        assert r.status_code == 200

    def test_whitespace_stripped(self, staff_token, sample_booking):
        qr = sample_booking["qr_codes"][0]["qr_token"]
        r = _scan(f"  {qr}  ", staff_token)
        assert r.status_code == 200

    def test_unknown_token_returns_404(self, staff_token):
        r = _scan("00000000000000000000000000000000", staff_token)
        assert r.status_code == 404

    def test_garbage_returns_404(self, staff_token):
        r = _scan("garbagexyz", staff_token)
        assert r.status_code == 404
