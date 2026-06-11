"""Iteration 27 — Deep second-pass bug sweep.

Focus areas NOT covered by iter26:
  - Booking tunnel end-to-end (create → pay cash → confirm → scan aller)
  - Hebergement booking with deposit (30% deposit math)
  - Special event booking via published event (price comes from event)
  - Wallet (Consommation sur place) — token lookup w/ + w/o dashes,
    charge + close, re-close validation, missing-body 422
  - RBAC: management_general read-only (403 on writes), manager_pole token has pole_id,
    hotesse staff dashboard accessible
  - PDF/XLSX exports (clients, revenue, traversées history, traversée manifest)
  - FineoPay graceful failure (no 500)
  - Auth brute-force protection probe (informational)
  - i18n payNow duplicate regression (file lint)
  - APScheduler "coroutine never awaited" regression (log scan window)
"""
import os
import re
import time
import uuid
import requests
import pytest
from datetime import datetime, timedelta, timezone

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL", "https://reserve-bbr.preview.emergentagent.com"
).rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"email": "admin@boulay.ci", "password": "Admin@2026"}
MGR_POLE = {"email": "mgr.pole.test@boulay.ci", "password": "MgrPole@2026"}
DIRECTION = {"email": "direction.test@boulay.ci", "password": "Direction@2026"}
HOTESSE = {"email": "hotesse.test@boulay.ci", "password": "Hotesse@2026"}


def _login(creds):
    r = requests.post(f"{API}/auth/staff/login", json=creds, timeout=20)
    if r.status_code != 200:
        pytest.skip(f"Login failed for {creds['email']}: {r.status_code} {r.text}")
    return r.json().get("access_token"), r.json()


@pytest.fixture(scope="session")
def admin_hdr():
    tok, _ = _login(ADMIN)
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="session")
def next_weekday():
    """Return YYYY-MM-DD for next Mon-Fri at least 7 days out (avoid weekend)."""
    d = datetime.now(timezone.utc).date() + timedelta(days=10)
    while d.weekday() >= 5:
        d += timedelta(days=1)
    return d.isoformat()


def _booker_participant(prefix="TEST_iter27"):
    return {
        "kind": "adult",
        "name": prefix + "_First",
        "surname": "Booker",
        "nationality": "Ivoirienne",
        "email": f"{prefix.lower()}_{uuid.uuid4().hex[:6]}@example.com",
        "phone": "+2250700000001",
        "passport_number": "A12345678",
        "date_of_birth": "1990-01-01",
    }


# ============================================================
# REGRESSION — APScheduler async fix + i18n payNow dedupe
# ============================================================
class TestRegressionFixes:
    def test_apscheduler_no_coroutine_warning_in_recent_window(self):
        """The fixed _run_campaigns wrapper must NOT emit 'never awaited'.
        We look at the section of the err.log AFTER the most recent uvicorn restart."""
        log_path = "/var/log/supervisor/backend.err.log"
        if not os.path.exists(log_path):
            pytest.skip("backend.err.log not present in env")
        with open(log_path, "r", errors="ignore") as f:
            content = f.read()
        # Find last "Application startup complete." anchor
        anchors = [m.end() for m in re.finditer(r"Application startup complete", content)]
        recent = content[anchors[-1]:] if anchors else content[-50_000:]
        offenders = re.findall(r"coroutine 'run_due_campaigns' was never awaited", recent)
        assert not offenders, f"Found {len(offenders)} 'never awaited' warnings since last startup"

    def test_i18n_paynow_no_duplicate_key(self):
        """payNow must appear exactly twice (once FR, once EN) — not duplicated within a locale."""
        path = "/app/frontend/src/lib/i18n.js"
        if not os.path.exists(path):
            pytest.skip("i18n.js not found")
        with open(path) as f:
            txt = f.read()
        count = len(re.findall(r"^\s*payNow\s*:", txt, re.MULTILINE))
        assert count == 2, f"payNow key must appear exactly 2x (FR+EN), got {count}"

    def test_run_j_minus_1_endpoint_works(self, admin_hdr):
        """Manual trigger of J-1 reminder dispatcher must not crash."""
        r = requests.post(f"{API}/staff/notifications/run-j-minus-1", headers=admin_hdr, timeout=30)
        # 200 (sent N) or 404 (endpoint not exposed) or 200 with count 0 — all OK as long as not 500
        assert r.status_code in (200, 202, 404), f"Got {r.status_code}: {r.text[:200]}"


# ============================================================
# BACKEND — Full booking tunnel (cash → confirm → scan aller)
# ============================================================
class TestBookingTunnelCash:
    @pytest.fixture(scope="class")
    def created_booking(self, admin_hdr, next_weekday):
        payload = {
            "offer_type": "pass_day",
            "date": next_weekday,
            "adults": 2,
            "children": 1,
            "boat_time": "10H",
            "participants": [
                _booker_participant(),
                {"kind": "adult", "name": "TEST_iter27_Second", "surname": "Adult",
                 "nationality": "Française"},
                {"kind": "child", "name": "TEST_iter27_Kid", "surname": "Junior",
                 "nationality": "Ivoirienne", "date_of_birth": "2018-05-05"},
            ],
        }
        r = requests.post(f"{API}/bookings", json=payload, timeout=30)
        if r.status_code != 200:
            pytest.fail(f"Create booking failed: {r.status_code} {r.text}")
        return r.json()

    def test_booking_created(self, created_booking):
        assert "id" in created_booking or "booking_id" in created_booking
        bid = created_booking.get("id") or created_booking.get("booking_id")
        assert bid

    def test_pay_cash_marks_pending(self, created_booking):
        bid = created_booking.get("id") or created_booking.get("booking_id")
        ref = created_booking.get("reference_token")
        r = requests.post(
            f"{API}/bookings/{bid}/pay",
            json={"payment_method": "cash", "reference_token": ref},
            timeout=20,
        )
        assert r.status_code == 200, f"pay cash failed: {r.status_code} {r.text}"
        data = r.json()
        # Either booking.status or top-level status
        status = (data.get("booking") or data).get("status", data.get("status"))
        assert status in ("pending_cash_payment", "pending_payment"), f"got status={status}"

    def test_confirm_cash_payment(self, admin_hdr, created_booking):
        bid = created_booking.get("id") or created_booking.get("booking_id")
        r = requests.post(
            f"{API}/staff/bookings/{bid}/confirm-cash-payment",
            headers=admin_hdr, timeout=20,
        )
        assert r.status_code == 200, f"confirm-cash failed: {r.status_code} {r.text}"
        data = r.json()
        assert data.get("status") == "confirmed"
        assert data.get("paid_at"), "paid_at must be set"
        # Fetch the booking to verify QR codes were regenerated server-side
        g = requests.get(f"{API}/staff/bookings/{bid}", headers=admin_hdr, timeout=15)
        assert g.status_code == 200, f"GET booking after confirm: {g.status_code}"
        body = g.json()
        qrs = body.get("qr_codes") or []
        assert len(qrs) >= 1, f"QR codes must be regenerated on confirm-cash, got: {body}"
        created_booking["__qr_token"] = qrs[0].get("qr_token") or qrs[0].get("token")

    def test_reconfirm_idempotent_400(self, admin_hdr, created_booking):
        bid = created_booking.get("id") or created_booking.get("booking_id")
        r = requests.post(
            f"{API}/staff/bookings/{bid}/confirm-cash-payment",
            headers=admin_hdr, timeout=20,
        )
        # Idempotent guard — already confirmed
        assert r.status_code in (400, 409), f"Expected 4xx on re-confirm, got {r.status_code} {r.text[:200]}"

    def test_scan_token_returns_booking(self, admin_hdr, created_booking):
        tok = created_booking.get("__qr_token")
        if not tok:
            pytest.skip("no QR token captured")
        r = requests.get(f"{API}/staff/scan/{tok}", headers=admin_hdr, timeout=20)
        assert r.status_code == 200, f"scan get failed: {r.status_code} {r.text[:200]}"

    def test_checkin_aller(self, admin_hdr, created_booking):
        tok = created_booking.get("__qr_token")
        if not tok:
            pytest.skip("no QR token captured")
        r = requests.post(f"{API}/staff/scan/{tok}/checkin", headers=admin_hdr, timeout=20)
        assert r.status_code == 200, f"checkin failed: {r.status_code} {r.text[:200]}"
        data = r.json()
        # arrived or status mentions aller leg
        s = str(data).lower()
        assert "arriv" in s or "aller" in s or data.get("status") in ("arrived", "checked_in"), \
            f"unexpected checkin response: {data}"


# ============================================================
# BACKEND — Hebergement deposit booking
# ============================================================
class TestHebergementDeposit:
    def test_hebergement_booking_with_deposit_30(self, next_weekday):
        checkin = next_weekday
        checkout = (datetime.fromisoformat(next_weekday) + timedelta(days=1)).date().isoformat()
        payload = {
            "offer_type": "hebergement",
            "date": checkin,
            "checkout_date": checkout,
            "adults": 1,
            "children": 0,
            "boat_time": "10H",
            "return_boat_time": "16H",
            "rooms": 1,
            "room_tier": "superieure",
            "participants": [_booker_participant("TEST_iter27_HEB")],
        }
        r = requests.post(f"{API}/bookings", json=payload, timeout=30)
        if r.status_code != 200:
            pytest.skip(f"Hebergement booking create rejected: {r.status_code} {r.text[:300]}")
        b = r.json()
        bid = b.get("id") or b.get("booking_id")
        total = b.get("total_amount") or b.get("price") or b.get("total")
        assert total, f"no total amount in response: {b}"

        # Deposit payment
        r2 = requests.post(
            f"{API}/bookings/{bid}/pay",
            json={"payment_method": "deposit", "deposit_pct": 30, "reference_token": b.get("reference_token")},
            timeout=30,
        )
        assert r2.status_code in (200, 400), f"deposit pay status: {r2.status_code} {r2.text[:200]}"
        if r2.status_code != 200:
            pytest.skip(f"deposit pay returned 400 (may need card flow): {r2.text[:200]}")
        d = r2.json()
        booking = d.get("booking") or d
        paid = booking.get("paid_amount") or booking.get("deposit_amount") or 0
        balance = booking.get("balance_due") or booking.get("remaining_amount")
        if paid and total:
            ratio = paid / total
            assert 0.25 <= ratio <= 0.35, f"deposit ratio off: {ratio} (paid={paid}, total={total})"


# ============================================================
# BACKEND — Special event booking (price from event)
# ============================================================
class TestSpecialEventBooking:
    def test_special_event_book(self, admin_hdr):
        # Find any published special event
        r = requests.get(f"{API}/special-events/featured", timeout=15)
        ev = None
        if r.status_code == 200:
            ev = (r.json() or {}).get("event")
        if not ev:
            # try listing
            r2 = requests.get(f"{API}/special-events?status=published", timeout=15)
            if r2.status_code == 200:
                lst = r2.json()
                if isinstance(lst, dict):
                    lst = lst.get("items", [])
                if lst:
                    ev = lst[0]
        if not ev:
            pytest.skip("no published special event in DB")
        ev_id = ev.get("id") or ev.get("_id")
        dates = ev.get("event_dates") or ev.get("dates") or []
        if not dates:
            pytest.skip("event has no event_dates")
        ev_date = dates[0] if isinstance(dates[0], str) else dates[0].get("date")
        payload = {
            "offer_type": "special_event",
            "special_event_id": ev_id,
            "date": ev_date,
            "adults": 1,
            "children": 0,
            "boat_time": "10H",
            "participants": [_booker_participant("TEST_iter27_EVT")],
        }
        r3 = requests.post(f"{API}/bookings", json=payload, timeout=30)
        assert r3.status_code in (200, 400), f"special_event book: {r3.status_code} {r3.text[:300]}"
        if r3.status_code == 200:
            b = r3.json()
            assert (b.get("offer_type") == "special_event") or b.get("special_event_id") == ev_id


# ============================================================
# BACKEND — Wallet (Consommation sur place)
# ============================================================
class TestWallet:
    @pytest.fixture(scope="class")
    def open_wallet(self, admin_hdr):
        # Find any booking with a wallet_token
        r = requests.get(f"{API}/staff/bookings?limit=50", headers=admin_hdr, timeout=20)
        if r.status_code != 200:
            pytest.skip(f"list bookings: {r.status_code}")
        items = r.json()
        if isinstance(items, dict):
            items = items.get("items", [])
        wt = None
        for b in items:
            if b.get("wallet_token"):
                wt = b.get("wallet_token")
                break
        if not wt:
            pytest.skip("no booking with wallet_token in current DB")
        return wt

    def test_wallet_lookup_with_dashes(self, admin_hdr, open_wallet):
        r = requests.get(f"{API}/staff/wallets/{open_wallet}", headers=admin_hdr, timeout=15)
        assert r.status_code == 200, f"wallet lookup w/dashes: {r.status_code} {r.text[:200]}"

    def test_wallet_lookup_without_dashes(self, admin_hdr, open_wallet):
        compact = open_wallet.replace("-", "")
        r = requests.get(f"{API}/staff/wallets/{compact}", headers=admin_hdr, timeout=15)
        assert r.status_code == 200, f"wallet lookup w/o dashes: {r.status_code} {r.text[:200]}"

    def test_wallet_close_missing_body_422(self, admin_hdr, open_wallet):
        r = requests.post(f"{API}/staff/wallets/{open_wallet}/close", headers=admin_hdr, timeout=15)
        assert r.status_code in (400, 422), f"missing-body close: {r.status_code} {r.text[:200]}"

    def test_wallet_close_invalid_method_422(self, admin_hdr, open_wallet):
        r = requests.post(
            f"{API}/staff/wallets/{open_wallet}/close",
            headers=admin_hdr, json={"payment_method": "bitcoin"}, timeout=15,
        )
        assert r.status_code in (400, 422), f"invalid method close: {r.status_code} {r.text[:200]}"


# ============================================================
# BACKEND — RBAC enforcement
# ============================================================
class TestRBAC:
    def test_management_general_readonly(self):
        tok, _ = _login(DIRECTION)
        h = {"Authorization": f"Bearer {tok}"}
        # GET should be allowed
        r_get = requests.get(f"{API}/staff/dashboard", headers=h, timeout=15)
        assert r_get.status_code in (200, 204, 404), f"GET dashboard for direction: {r_get.status_code}"
        # POST should be 403 (readonly_role_middleware)
        r_post = requests.post(
            f"{API}/staff/bateaux",
            headers=h,
            json={"label": "TEST_iter27_should_fail", "capacity": 10},
            timeout=15,
        )
        assert r_post.status_code == 403, f"Direction POST must be 403 got {r_post.status_code} {r_post.text[:200]}"

    def test_manager_pole_token_has_pole_id(self):
        tok, payload = _login(MGR_POLE)
        # check JWT body or user payload in login response
        import base64, json
        try:
            body = tok.split(".")[1] + "=="
            data = json.loads(base64.urlsafe_b64decode(body))
        except Exception:
            data = {}
        # Try multiple shapes: in token claims OR in login response user object
        user = payload.get("user") or payload
        pole_id = data.get("pole_id") or user.get("pole_id") or user.get("user", {}).get("pole_id")
        assert pole_id is not None and isinstance(pole_id, str) and len(pole_id) > 0, \
            f"manager_pole MUST carry a pole_id, got {pole_id!r} (token={data}, payload_user={user})"

    def test_hotesse_dashboard_access(self):
        tok, _ = _login(HOTESSE)
        h = {"Authorization": f"Bearer {tok}"}
        r = requests.get(f"{API}/staff/dashboard", headers=h, timeout=15)
        assert r.status_code == 200, f"hotesse dashboard: {r.status_code} {r.text[:200]}"


# ============================================================
# BACKEND — PDF / XLSX exports
# ============================================================
class TestExports:
    def _is_pdf(self, content): return content[:5] == b"%PDF-"
    def _is_xlsx(self, content): return content[:2] == b"PK"

    def test_clients_pdf(self, admin_hdr):
        r = requests.get(f"{API}/staff/clients/report.pdf", headers=admin_hdr, timeout=30)
        assert r.status_code == 200, f"clients pdf: {r.status_code} {r.text[:200]}"
        assert self._is_pdf(r.content), f"not a PDF magic, head={r.content[:8]}"

    def test_revenue_pdf(self, admin_hdr):
        r = requests.get(f"{API}/staff/revenue/report.pdf?period=month", headers=admin_hdr, timeout=30)
        assert r.status_code == 200, f"revenue pdf: {r.status_code} {r.text[:200]}"
        assert self._is_pdf(r.content)

    def test_traversees_history_pdf(self, admin_hdr):
        r = requests.get(f"{API}/staff/traversees/history/report.pdf", headers=admin_hdr, timeout=30)
        assert r.status_code == 200, f"traversees history pdf: {r.status_code} {r.text[:200]}"
        assert self._is_pdf(r.content)

    def test_traversees_history_xlsx(self, admin_hdr):
        r = requests.get(f"{API}/staff/traversees/history/report.xlsx", headers=admin_hdr, timeout=30)
        assert r.status_code == 200, f"traversees history xlsx: {r.status_code} {r.text[:200]}"
        assert self._is_xlsx(r.content), f"not xlsx, head={r.content[:8]}"


# ============================================================
# BACKEND — FineoPay graceful failure
# ============================================================
class TestFineoPay:
    def test_fineo_checkout_no_500(self, admin_hdr, next_weekday):
        # Create a quick pass_day booking, then attempt fineo checkout
        payload = {
            "offer_type": "pass_day",
            "date": next_weekday,
            "adults": 1,
            "children": 0,
            "boat_time": "10H",
            "participants": [_booker_participant("TEST_iter27_FNO")],
        }
        b = requests.post(f"{API}/bookings", json=payload, timeout=30)
        if b.status_code != 200:
            pytest.skip(f"can't create booking for fineo test: {b.status_code} {b.text[:200]}")
        bid = b.json().get("id") or b.json().get("booking_id")
        r = requests.post(
            f"{API}/payments/fineo/checkout",
            json={"booking_id": bid},
            timeout=30,
        )
        # Either 400 (sandbox rejected) or 200 (checkout_url). 500 = bug.
        assert r.status_code != 500, f"FineoPay crashed with 500: {r.text[:300]}"
        assert r.status_code in (200, 400, 404, 422), f"unexpected: {r.status_code} {r.text[:200]}"


# ============================================================
# BACKEND — Auth brute-force protection probe (informational)
# ============================================================
class TestBruteForce:
    def test_login_rate_limit_probe(self):
        """Send 6 wrong passwords; report whether 6th gets 429/423.
        Will be reported as informational only — failure here doesn't block."""
        statuses = []
        for _ in range(6):
            r = requests.post(
                f"{API}/auth/staff/login",
                json={"email": "admin@boulay.ci", "password": "wrong_iter27"},
                timeout=10,
            )
            statuses.append(r.status_code)
        # If 6th is 429/423, brute-force protection is ON
        protected = statuses[-1] in (423, 429)
        # Don't FAIL the test — just record. (Use xfail-like soft assert)
        print(f"\n[BruteForce probe] statuses={statuses} protected={protected}")
        # Always pass — protection presence/absence is informational
        assert all(s in (401, 423, 429, 403) for s in statuses), f"unexpected statuses: {statuses}"
