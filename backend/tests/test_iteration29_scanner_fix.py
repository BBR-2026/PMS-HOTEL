"""Iteration 29 — Scanner fix (iter-41) end-to-end validation.

Validates the make_ticket_image() change (QR_SIZE=440, ECC=M, HERO_H=600) and
the _resolve_qr_token() enhancements:

  - Step 0: JSON payload extraction ({"type":"ticket","token":"...","ref":"..."})
  - Step 1/2: exact / lowercase hex32 token
  - Step 3: prefix match on qr_token (>=8 hex chars)
  - Step 4 (iter-41 NEW): fallback on booking_id prefix (the printed "ref")

Plus full check-in flow (aller → retour → fully_used).
"""
import os
import io
import json
import time
import uuid
import urllib.parse
from datetime import datetime, timedelta, timezone

import pytest
import requests
from PIL import Image
from pyzbar.pyzbar import decode as zbar_decode

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL", "https://reserve-bbr.preview.emergentagent.com"
).rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"email": "admin@boulay.ci", "password": "Admin@2026"}

# Iter-41 spec: QR_SIZE=440 in the PIL canvas. After Image.NEAREST resize + JPEG
# anti-noise the effective decoded bbox should land at >=380px (loose lower-bound
# accounting for any padding the pyzbar bounding-box reports).
MIN_QR_BBOX_PX = 380


# -------- Auth + helpers --------
@pytest.fixture(scope="session")
def admin_hdr():
    r = requests.post(f"{API}/auth/staff/login", json=ADMIN, timeout=20)
    if r.status_code != 200:
        pytest.skip(f"Admin login failed: {r.status_code} {r.text[:200]}")
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def _next_weekday(target_weekday: int) -> str:
    d = datetime.now(timezone.utc).date() + timedelta(days=7)
    while d.weekday() != target_weekday:
        d += timedelta(days=1)
    return d.isoformat()


def _booker(prefix="TEST_iter29"):
    return {
        "kind": "adult",
        "name": f"{prefix}_Booker_{uuid.uuid4().hex[:4]}",
        "surname": "Scanner",
        "nationality": "Ivoirienne",
        "email": f"{prefix.lower()}_{uuid.uuid4().hex[:6]}@example.com",
        "phone": "+2250700000099",
        "date_of_birth": "1990-01-01",
    }


def _create_booking(offer_type, date, boat_time, adults=2, children=0):
    participants = [_booker()]
    for i in range(adults - 1):
        participants.append({
            "kind": "adult",
            "name": f"TEST_iter29_Adult{i}_{uuid.uuid4().hex[:3]}",
            "surname": "T",
            "nationality": "Française",
        })
    for i in range(children):
        participants.append({
            "kind": "child",
            "name": f"TEST_iter29_Kid_{uuid.uuid4().hex[:3]}",
            "surname": "K",
            "nationality": "Ivoirienne",
            "date_of_birth": "2018-05-05",
        })
    payload = {
        "offer_type": offer_type,
        "date": date,
        "adults": adults,
        "children": children,
        "boat_time": boat_time,
        "participants": participants,
    }
    return requests.post(f"{API}/bookings", json=payload, timeout=30)


def _pay_and_confirm(booking, admin_hdr):
    bid = booking.get("id") or booking.get("booking_id")
    ref = booking.get("reference_token")
    rpay = requests.post(
        f"{API}/bookings/{bid}/pay",
        json={"payment_method": "cash", "reference_token": ref},
        timeout=20,
    )
    assert rpay.status_code == 200, f"pay cash: {rpay.status_code} {rpay.text[:300]}"
    rconf = requests.post(
        f"{API}/staff/bookings/{bid}/confirm-cash-payment",
        headers=admin_hdr, timeout=30,
    )
    assert rconf.status_code == 200, f"confirm: {rconf.status_code} {rconf.text[:300]}"
    return bid, ref


@pytest.fixture(scope="session")
def confirmed_booking(admin_hdr):
    """Create one confirmed pass_day booking, return useful fields."""
    date = _next_weekday(0)  # Monday
    r = _create_booking("pass_day", date, boat_time="10H", adults=2)
    assert r.status_code == 200, f"create: {r.status_code} {r.text[:300]}"
    b = r.json()
    bid, ref = _pay_and_confirm(b, admin_hdr)
    # Re-fetch booking to get qr_codes
    rget = requests.get(
        f"{API}/staff/bookings/{bid}",
        headers=admin_hdr, timeout=20,
    )
    assert rget.status_code == 200, f"staff get: {rget.status_code} {rget.text[:200]}"
    bk = rget.json()
    qrs = bk.get("qr_codes") or []
    assert qrs, "booking has no qr_codes"
    token = qrs[0].get("qr_token")
    assert token and len(token) == 32, f"unexpected qr_token: {token!r}"
    return {
        "booking_id": bid,
        "ref": ref,
        "qr_token": token,
        "ref_short_10": token[:10].upper(),         # legacy 10-char printed ref
        "booking_ref_short_8": bid[:8].upper(),     # NEW iter-41 8-char booking id ref
    }


# ============================================================
# 1) Auth — admin login works
# ============================================================
def test_admin_login_returns_token(admin_hdr):
    assert "Authorization" in admin_hdr
    assert admin_hdr["Authorization"].startswith("Bearer ")


# ============================================================
# 2) Scanner accepts the full hex32 qr_token (status 200 + payload)
# ============================================================
def test_scan_hex32_token(confirmed_booking, admin_hdr):
    token = confirmed_booking["qr_token"]
    r = requests.get(f"{API}/staff/scan/{token}", headers=admin_hdr, timeout=15)
    assert r.status_code == 200, f"scan(hex32): {r.status_code} {r.text[:200]}"
    body = r.json()
    assert body["booking_id"] == confirmed_booking["booking_id"]
    assert body["guest_name"]  # non-empty
    assert body["qr_token"] == token


# ============================================================
# 3) Scanner accepts the RAW JSON payload (iter-41 step 0 fallback)
# ============================================================
def test_scan_raw_json_payload(confirmed_booking, admin_hdr):
    token = confirmed_booking["qr_token"]
    ref = confirmed_booking["booking_ref_short_8"]
    payload = json.dumps({"type": "ticket", "token": token, "ref": ref})
    # URL-encode (path segment)
    encoded = urllib.parse.quote(payload, safe="")
    r = requests.get(f"{API}/staff/scan/{encoded}", headers=admin_hdr, timeout=15)
    assert r.status_code == 200, \
        f"scan(json-payload): {r.status_code} {r.text[:300]}"
    body = r.json()
    assert body["booking_id"] == confirmed_booking["booking_id"]
    assert body["qr_token"] == token


# ============================================================
# 4) Scanner accepts the 10-char printed ref (legacy prefix path)
# ============================================================
def test_scan_ref_10_upper(confirmed_booking, admin_hdr):
    ref10 = confirmed_booking["ref_short_10"]
    r = requests.get(f"{API}/staff/scan/{ref10}", headers=admin_hdr, timeout=15)
    assert r.status_code == 200, f"scan(ref10): {r.status_code} {r.text[:300]}"
    body = r.json()
    assert body["booking_id"] == confirmed_booking["booking_id"]
    assert body["qr_token"] == confirmed_booking["qr_token"]


# ============================================================
# 5) Scanner accepts booking_id[:8] short ref — iter-41 NEW step 4
# ============================================================
def test_scan_booking_ref_short_8(confirmed_booking, admin_hdr):
    # booking_id[:8] is hex-only (UUIDs start with 8 hex chars) → matches the
    # new fallback. Use the lowercase form (closer to what the printed JSON
    # payload contains in lower case; the regex is case-insensitive).
    short = confirmed_booking["booking_id"][:8]
    r = requests.get(f"{API}/staff/scan/{short}", headers=admin_hdr, timeout=15)
    assert r.status_code == 200, \
        f"scan(booking_id[:8]): {r.status_code} {r.text[:300]}"
    body = r.json()
    assert body["booking_id"] == confirmed_booking["booking_id"]
    # Should also work uppercase (the "ref" form printed on the ticket)
    short_up = confirmed_booking["booking_ref_short_8"]
    r2 = requests.get(f"{API}/staff/scan/{short_up}", headers=admin_hdr, timeout=15)
    assert r2.status_code == 200, \
        f"scan(booking_id[:8].upper()): {r2.status_code} {r2.text[:300]}"


# ============================================================
# 6) Ticket PNG: QR decodes back to the {type:ticket,token,ref} JSON AND
#    its on-image bbox is >=380px (iter-41 new size 440 - bordure).
# ============================================================
def test_ticket_qr_decodes_and_is_large(confirmed_booking):
    bid = confirmed_booking["booking_id"]
    ref = confirmed_booking["ref"]
    r = requests.get(
        f"{API}/bookings/{bid}/ticket.png",
        params={"ref": ref}, timeout=30,
    )
    assert r.status_code == 200, f"ticket.png: {r.status_code} {r.text[:200]}"
    img = Image.open(io.BytesIO(r.content))
    assert img.size == (1080, 1920), f"wrong dims: {img.size}"
    decoded = zbar_decode(img)
    assert decoded, "pyzbar found NO QR code on the rendered ticket"
    # First decoded symbol = the ticket QR
    sym = decoded[0]
    raw = sym.data.decode("utf-8")
    # Must be the JSON payload {type:ticket,token,ref}
    obj = json.loads(raw)
    assert obj.get("type") == "ticket", f"unexpected QR payload: {obj}"
    assert obj.get("token") == confirmed_booking["qr_token"]
    assert obj.get("ref") == confirmed_booking["booking_ref_short_8"]
    # Bbox size — width/height of the QR drawn on the canvas
    rect = sym.rect
    qr_w, qr_h = rect.width, rect.height
    print(f"  → QR bbox on ticket: {qr_w}x{qr_h}px (min expected {MIN_QR_BBOX_PX})")
    assert qr_w >= MIN_QR_BBOX_PX and qr_h >= MIN_QR_BBOX_PX, (
        f"QR too small ({qr_w}x{qr_h}) — iter-41 expects >= {MIN_QR_BBOX_PX}px"
    )


# ============================================================
# 7) After ticket rendered, immediate scan of the decoded token works
# ============================================================
def test_immediate_scan_after_ticket_render(confirmed_booking, admin_hdr):
    token = confirmed_booking["qr_token"]
    r = requests.get(f"{API}/staff/scan/{token}", headers=admin_hdr, timeout=15)
    assert r.status_code == 200
    body = r.json()
    assert body["guest_name"]
    assert body["scan_count"] == 0
    assert body["next_direction"] == "aller"


# ============================================================
# 8) Full check-in flow on a FRESH booking — aller → retour → fully_used
# ============================================================
def test_full_checkin_flow(admin_hdr):
    """Create a brand-new booking dedicated to the check-in walk so it doesn't
    interfere with the shared confirmed_booking fixture state."""
    date = _next_weekday(1)  # Tuesday
    r = _create_booking("pass_day", date, boat_time="10H", adults=1)
    assert r.status_code == 200, f"create: {r.status_code} {r.text[:300]}"
    b = r.json()
    bid, _ref = _pay_and_confirm(b, admin_hdr)
    rget = requests.get(f"{API}/staff/bookings/{bid}", headers=admin_hdr, timeout=20)
    assert rget.status_code == 200
    token = rget.json()["qr_codes"][0]["qr_token"]

    # 1st check-in — aller
    r1 = requests.post(
        f"{API}/staff/scan/{token}/checkin",
        headers=admin_hdr,
        json={"direction": "aller", "boat_time": "10H"},
        timeout=20,
    )
    assert r1.status_code == 200, f"checkin aller: {r1.status_code} {r1.text[:300]}"

    rs1 = requests.get(f"{API}/staff/scan/{token}", headers=admin_hdr, timeout=15)
    assert rs1.status_code == 200
    s1 = rs1.json()
    assert s1["scan_count"] == 1, f"after aller, scan_count={s1['scan_count']}"
    assert s1["next_direction"] == "retour", f"next_direction={s1['next_direction']}"
    assert s1["fully_used"] is False

    # 2nd check-in — retour
    r2 = requests.post(
        f"{API}/staff/scan/{token}/checkin",
        headers=admin_hdr,
        json={"direction": "retour", "boat_time": "18H"},
        timeout=20,
    )
    assert r2.status_code == 200, f"checkin retour: {r2.status_code} {r2.text[:300]}"

    rs2 = requests.get(f"{API}/staff/scan/{token}", headers=admin_hdr, timeout=15)
    assert rs2.status_code == 200
    s2 = rs2.json()
    assert s2["scan_count"] == 2, f"after retour, scan_count={s2['scan_count']}"
    assert s2["fully_used"] is True, f"fully_used={s2['fully_used']}"


# ============================================================
# 9) No backend exceptions during the run
# ============================================================
def test_no_backend_exceptions_during_run():
    """Scan backend err log AFTER all tests for new Pillow / qrcode / JSON
    exceptions tied to the scanner fix. Best-effort — log files may be empty
    or rotated."""
    log_path = "/var/log/supervisor/backend.err.log"
    if not os.path.exists(log_path):
        pytest.skip("backend.err.log not present")
    with open(log_path, "r", errors="ignore") as f:
        content = f.read()[-200_000:]  # tail last 200KB
    needles = [
        "Traceback (most recent call last)",
        "json.decoder.JSONDecodeError",
        "PIL.UnidentifiedImageError",
        "qrcode.exceptions",
        "AttributeError: 'NoneType' object has no attribute",
        "Exception in _resolve_qr_token",
    ]
    # Filter: only flag if any needle appears AND mentions scan/ticket/qr context
    suspect_lines = []
    lines = content.splitlines()
    for i, ln in enumerate(lines):
        for needle in needles:
            if needle in ln:
                # gather 5-line context
                ctx = "\n".join(lines[max(0, i - 2):i + 3])
                if any(k in ctx.lower() for k in ("scan", "qr_token", "ticket", "make_ticket")):
                    suspect_lines.append(ctx)
                    break
    assert not suspect_lines, (
        f"Found {len(suspect_lines)} suspect log entries:\n"
        + "\n---\n".join(suspect_lines[:3])
    )
