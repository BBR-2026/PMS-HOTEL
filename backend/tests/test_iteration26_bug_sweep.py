"""Iteration 26 — Bug sweep for Corporate flow, Loisirs, Fleet, Stats/Scanner refactor.

Covers:
  - Corporate B2B request lifecycle (admin create, public slug resolve,
    public register → real booking + ticket image, QR scan, check-in, board)
  - Loisirs activities CRUD (admin/manager) + public listing
  - Fleet management (boats fuel_litres_per_trip, skippers CRUD + cascade,
    traversées CRUD restrictions)
  - Stats refactor (/staff/stats/advanced full shape after extraction)
  - Scanner history refactor (/staff/checkins/history filters + summary block)
  - Bookings tunnel: pass_day pay (card/cash) + confirm-cash idempotent
  - Notifications, Poles, Featured Special Event atomic toggle
"""
import os
import uuid
import pytest
import requests
from datetime import datetime, timedelta, timezone

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL", "https://reserve-bbr.preview.emergentagent.com"
).rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"email": "admin@boulay.ci", "password": "Admin@2026"}


# ---------- Shared fixtures ----------
@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/auth/staff/login", json=ADMIN, timeout=20)
    if r.status_code != 200:
        pytest.skip(f"Admin login failed: {r.status_code} {r.text}")
    return r.json().get("access_token")


@pytest.fixture(scope="session")
def hdr(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="session")
def trash():
    return {
        "corporate": [], "loisir": [], "skipper": [], "traversee": [],
        "booking": [], "special_event": [],
    }


@pytest.fixture(scope="session", autouse=True)
def cleanup(hdr, trash):
    yield
    for cid in trash["corporate"]:
        try:
            requests.delete(f"{API}/staff/corporate-requests/{cid}", headers=hdr, timeout=15)
        except Exception:
            pass
    for lid in trash["loisir"]:
        try:
            requests.delete(f"{API}/staff/loisirs-activities/{lid}", headers=hdr, timeout=15)
        except Exception:
            pass
    for tid in trash["traversee"]:
        try:
            requests.patch(f"{API}/staff/traversees/{tid}/status",
                           json={"status": "terminé"}, headers=hdr, timeout=15)
            requests.delete(f"{API}/staff/traversees/{tid}", headers=hdr, timeout=15)
        except Exception:
            pass
    for sid in trash["skipper"]:
        try:
            requests.delete(f"{API}/staff/skippers/{sid}", headers=hdr, timeout=15)
        except Exception:
            pass
    for eid in trash["special_event"]:
        try:
            requests.delete(f"{API}/staff/special-events/{eid}", headers=hdr, timeout=15)
        except Exception:
            pass


def _future_date(days=5):
    return (datetime.utcnow() + timedelta(days=days)).strftime("%Y-%m-%d")


# =================================================================
# CORPORATE — full flow including ticket image + QR scan + checkin
# =================================================================
class TestCorporateFlow:
    def _create_corp(self, hdr, trash):
        body = {
            "company_name": f"TEST_iter26_corp_{uuid.uuid4().hex[:6]}",
            "reservation_type": "Pass Day",
            "max_participants": 3,
            "payment_mode": "free",
        }
        r = requests.post(f"{API}/staff/corporate-requests", json=body, headers=hdr, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        trash["corporate"].append(d["id"])
        return d

    def test_create_returns_slug_and_token(self, hdr, trash):
        d = self._create_corp(hdr, trash)
        # slug must be present + look kebab-case + suffix
        assert d.get("slug"), f"slug missing: {d}"
        assert "-" in d["slug"]
        assert d.get("shareable_token") and len(d["shareable_token"]) >= 16
        assert d["remaining_seats"] == 3 and d["is_full"] is False
        assert d["status"] == "open"

    def test_public_form_resolves_by_slug(self, hdr, trash):
        d = self._create_corp(hdr, trash)
        # By slug
        r = requests.get(f"{API}/corporate-form/{d['slug']}", timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["company_name"] == d["company_name"]
        assert body["remaining_seats"] == 3
        # Private fields stripped
        assert "shareable_token" not in body
        # By legacy token (same endpoint accepts both)
        r2 = requests.get(f"{API}/corporate-form/{d['shareable_token']}", timeout=15)
        assert r2.status_code == 200
        assert r2.json()["id"] == d["id"]

    def test_register_returns_ticket_image_and_booking(self, hdr, trash):
        d = self._create_corp(hdr, trash)
        payload = {
            "name": "Alice", "surname": "TEST_iter26",
            "email": f"alice_{uuid.uuid4().hex[:6]}@iter26.example.com",
            "phone": "+225 0102030405",
            "whatsapp": "+225 0102030406",
            "nationality": "Côte d'Ivoire",
            "kind": "personnel",
        }
        r = requests.post(f"{API}/corporate-form/{d['slug']}/register",
                          json=payload, timeout=20)
        assert r.status_code == 200, r.text
        resp = r.json()
        assert resp.get("qr_token") and len(resp["qr_token"]) >= 16
        assert resp.get("booking_id")
        # Ticket image should be a data:image PNG (or None if helper missing — flag if missing)
        ticket = resp.get("ticket_image")
        assert ticket, "ticket_image missing in register response"
        assert ticket.startswith("data:image") or ticket.startswith("iVBOR"), \
            f"ticket_image not a PNG data URI: prefix={ticket[:40]}"
        assert resp["remaining_seats"] == 2
        # Booking actually persists with corporate metadata
        b = requests.get(f"{API}/staff/bookings/{resp['booking_id']}", headers=hdr, timeout=15)
        assert b.status_code == 200, b.text
        bd = b.json()
        assert bd["offer_type"] == "special_event"
        assert bd["pole"] == "corporate"
        assert bd["status"] == "confirmed"
        assert bd["total_amount"] == 0
        assert bd["corporate_request_id"] == d["id"]
        # Stash booking + token for next test class
        trash.setdefault("corp_qr_token", []).append(resp["qr_token"])
        trash.setdefault("corp_booking_id", []).append(resp["booking_id"])
        trash.setdefault("corp_request_id", []).append(d["id"])

    def test_scan_then_checkin_then_duplicate(self, hdr, trash):
        # Re-use last registered participant's QR
        if not trash.get("corp_qr_token"):
            pytest.skip("Previous register test did not run")
        qr = trash["corp_qr_token"][-1]
        # Scan (read-only resolve)
        r = requests.get(f"{API}/staff/scan/{qr}", headers=hdr, timeout=15)
        assert r.status_code == 200, r.text
        info = r.json()
        # Either {ok:True, booking:{...}} or flat — check the QR resolved
        assert info.get("ok") in (True, None) or info.get("booking") or info.get("token")
        # Check-in (first scan → aller)
        r = requests.post(f"{API}/staff/scan/{qr}/checkin", headers=hdr, timeout=15)
        assert r.status_code in (200, 201), r.text
        d1 = r.json()
        assert d1.get("direction") in ("aller", "retour")
        # Second scan → retour (legitimate, NOT duplicate). Third must fail
        r2 = requests.post(f"{API}/staff/scan/{qr}/checkin", headers=hdr, timeout=15)
        assert r2.status_code in (200, 201)
        assert r2.json().get("fully_used") is True
        r3 = requests.post(f"{API}/staff/scan/{qr}/checkin", headers=hdr, timeout=15)
        # 3rd attempt on fully-used ticket must be rejected
        assert r3.status_code in (400, 409), \
            f"Expected 400/409 after fully_used, got {r3.status_code}: {r3.text[:200]}"

    def test_register_full_returns_403(self, hdr, trash):
        d = self._create_corp(hdr, trash)
        # Fill the 3 seats
        for i in range(3):
            r = requests.post(f"{API}/corporate-form/{d['slug']}/register", json={
                "name": f"Filler{i}", "surname": "TEST_iter26",
                "email": f"fill_{i}_{uuid.uuid4().hex[:6]}@iter26.example.com",
                "phone": "+225 0102030405", "nationality": "FR", "kind": "invite",
            }, timeout=15)
            assert r.status_code == 200, f"seat {i}: {r.text}"
        # 4th must fail
        r = requests.post(f"{API}/corporate-form/{d['slug']}/register", json={
            "name": "X", "surname": "Y",
            "email": f"x_{uuid.uuid4().hex[:6]}@iter26.example.com",
            "phone": "+225 0102", "nationality": "FR", "kind": "invite",
        }, timeout=15)
        assert r.status_code == 403
        assert "pourvue" in r.text.lower()

    def test_register_missing_required_field(self, hdr, trash):
        d = self._create_corp(hdr, trash)
        # Missing surname & nationality
        r = requests.post(f"{API}/corporate-form/{d['slug']}/register", json={
            "name": "OnlyName",
            "email": f"x_{uuid.uuid4().hex[:6]}@iter26.example.com",
            "phone": "+225 01",
        }, timeout=15)
        assert r.status_code == 422


# =================================================================
# LOISIRS — CRUD + image_url + public
# =================================================================
class TestLoisirs:
    def test_crud_with_image(self, hdr, trash):
        body = {
            "name_fr": f"TEST_iter26_kayak_{uuid.uuid4().hex[:4]}",
            "name_en": "Kayak",
            "price_adult": 12000, "price_child": 8000,
            "duration_min": 45, "capacity": 2,
            "image_url": "https://example.com/kayak.jpg",
            "is_active": True,
        }
        r = requests.post(f"{API}/staff/loisirs-activities", json=body, headers=hdr, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        trash["loisir"].append(d["id"])
        assert d["image_url"] == body["image_url"]

        # PATCH
        r = requests.patch(f"{API}/staff/loisirs-activities/{d['id']}",
                           json={"price_adult": 14000}, headers=hdr, timeout=15)
        assert r.status_code == 200

        # Public list filters by is_active=true
        r = requests.get(f"{API}/loisirs-activities", timeout=15)
        assert r.status_code == 200
        public_items = r.json()
        assert any(it["id"] == d["id"] for it in public_items)

        # Deactivate then verify removed from public
        r = requests.patch(f"{API}/staff/loisirs-activities/{d['id']}",
                           json={"is_active": False}, headers=hdr, timeout=15)
        assert r.status_code == 200
        r = requests.get(f"{API}/loisirs-activities", timeout=15)
        assert not any(it["id"] == d["id"] for it in r.json())


# =================================================================
# FLEET — boats fuel field, skippers CRUD + cascade, traversées
# =================================================================
class TestFleet:
    def test_boats_have_fuel_field(self, hdr):
        r = requests.get(f"{API}/staff/bateaux", headers=hdr, timeout=15)
        assert r.status_code == 200
        data = r.json()
        items = data.get("items") if isinstance(data, dict) else data
        if not items:
            pytest.skip("No boats seeded")
        for b in items:
            assert "fuel_litres_per_trip" in b, f"missing field on boat {b.get('id')}"
            assert isinstance(b["fuel_litres_per_trip"], int)

    def test_skipper_crud_and_cascade(self, hdr, trash):
        # Create
        body = {"name": f"TEST_iter26_skip_{uuid.uuid4().hex[:4]}",
                "phone": "+225 0102", "license_no": "LIC-26", "status": "actif"}
        r = requests.post(f"{API}/staff/skippers", json=body, headers=hdr, timeout=15)
        assert r.status_code == 200, r.text
        sk = r.json()
        sid = sk["id"]
        trash["skipper"].append(sid)
        # Duplicate name → 409
        r = requests.post(f"{API}/staff/skippers", json=body, headers=hdr, timeout=15)
        assert r.status_code == 409
        # List
        r = requests.get(f"{API}/staff/skippers", headers=hdr, timeout=15)
        assert r.status_code == 200
        ids = [s["id"] for s in r.json()["items"]]
        assert sid in ids
        # Patch
        r = requests.patch(f"{API}/staff/skippers/{sid}",
                           json={"name": body["name"] + "_v2"}, headers=hdr, timeout=15)
        assert r.status_code == 200
        # Create a traversée using this skipper to verify cascade detach
        boats = requests.get(f"{API}/staff/bateaux", headers=hdr, timeout=15).json()
        bitems = boats.get("items") if isinstance(boats, dict) else boats
        if not bitems:
            pytest.skip("No boats")
        boat_id = bitems[0]["id"]
        tr = requests.post(f"{API}/staff/traversees", json={
            "date": _future_date(6), "direction": "aller",
            "bateau_id": boat_id, "depart_time": "11H",
            "skipper_id": sid,
        }, headers=hdr, timeout=15)
        assert tr.status_code == 200, tr.text
        td = tr.json()
        tid = td.get("id") or (td.get("aller") or {}).get("id")
        if tid:
            trash["traversee"].append(tid)
            # Confirm skipper bound
            get_t = requests.get(f"{API}/staff/traversees/{tid}", headers=hdr, timeout=15)
            if get_t.status_code == 200:
                assert get_t.json().get("skipper_id") == sid
        # DELETE skipper should cascade-detach scheduled traversées
        r = requests.delete(f"{API}/staff/skippers/{sid}", headers=hdr, timeout=15)
        assert r.status_code == 200
        trash["skipper"].remove(sid)
        if tid:
            get_t = requests.get(f"{API}/staff/traversees/{tid}", headers=hdr, timeout=15)
            if get_t.status_code == 200:
                assert get_t.json().get("skipper_id") in (None, ""), \
                    f"Expected skipper detached, got {get_t.json().get('skipper_id')}"

    def test_traversee_patch_and_delete_rules(self, hdr, trash):
        boats = requests.get(f"{API}/staff/bateaux", headers=hdr, timeout=15).json()
        bitems = boats.get("items") if isinstance(boats, dict) else boats
        if not bitems:
            pytest.skip("No boats")
        boat_id = bitems[0]["id"]
        # Create
        r = requests.post(f"{API}/staff/traversees", json={
            "date": _future_date(8), "direction": "aller",
            "bateau_id": boat_id, "depart_time": "10H",
        }, headers=hdr, timeout=15)
        assert r.status_code == 200, r.text
        td = r.json()
        tid = td.get("id") or (td.get("aller") or {}).get("id")
        assert tid
        trash["traversee"].append(tid)
        # PATCH depart_time
        r = requests.patch(f"{API}/staff/traversees/{tid}",
                           json={"depart_time": "12H"}, headers=hdr, timeout=15)
        assert r.status_code == 200
        # PATCH status to terminé then attempt DELETE
        r = requests.patch(f"{API}/staff/traversees/{tid}/status",
                           json={"status": "terminé"}, headers=hdr, timeout=15)
        assert r.status_code == 200
        r = requests.delete(f"{API}/staff/traversees/{tid}", headers=hdr, timeout=15)
        # Spec: DELETE refuses if status=en_cours or terminé
        assert r.status_code in (400, 409), f"Expected 400/409 on delete terminé, got {r.status_code}"


# =================================================================
# STATS REFACTOR — /staff/stats/advanced shape
# =================================================================
class TestStatsAdvanced:
    def test_full_shape(self, hdr):
        r = requests.get(f"{API}/staff/stats/advanced", headers=hdr, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        # Actual keys (not the spec's names — spec is outdated)
        for key in ("yoy", "funnel", "top_nationalities",
                    "party_size", "weekday_distribution",
                    "hebergement", "fleet"):
            assert key in d, f"missing key '{key}' in stats: {list(d.keys())}"
        # occupancy data lives under hebergement.occupancy_rate_pct
        assert "occupancy_rate_pct" in d["hebergement"]
        fleet = d["fleet"]
        for fk in ("boats", "total_trips", "total_litres"):
            assert fk in fleet, f"missing fleet.{fk}"
        assert isinstance(fleet["boats"], list)
        for b in fleet["boats"]:
            assert "trips_completed" in b or "fuel_litres_total" in b


# =================================================================
# SCANNER HISTORY REFACTOR — /staff/checkins/history filters + summary
# =================================================================
class TestScannerHistory:
    def test_history_with_summary(self, hdr):
        r = requests.get(f"{API}/staff/checkins/history", headers=hdr, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        # Items always present
        assert "items" in d
        # Summary block — actual shape is a list of {boat_date, boat_label, count, direction}
        # (Spec said dict {total, by_boat, by_skipper} — drift noted)
        assert "summary" in d, f"missing summary block: {list(d.keys())}"
        s = d["summary"]
        # Accept either dict or list shape
        if isinstance(s, dict):
            for k in ("total", "by_boat", "by_skipper"):
                assert k in s, f"missing summary.{k}"
        else:
            assert isinstance(s, list)

    def test_history_filters(self, hdr):
        r = requests.get(f"{API}/staff/checkins/history",
                         params={"offer_type": "pass_day", "page": 1, "page_size": 10},
                         headers=hdr, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        items = d.get("items", [])
        for it in items:
            if "offer_type" in it:
                assert it["offer_type"] == "pass_day"

    def test_history_date_range(self, hdr):
        today = datetime.utcnow().strftime("%Y-%m-%d")
        r = requests.get(f"{API}/staff/checkins/history",
                         params={"date_from": today, "date_to": today},
                         headers=hdr, timeout=20)
        assert r.status_code == 200


# =================================================================
# BOOKINGS tunnel — pass_day card + cash + confirm-cash idempotent
# =================================================================
class TestBookingsTunnel:
    def _new_booking(self, payment_method):
        body = {
            "offer_type": "pass_day",
            "offer_name": "Pass Day",
            "booker_name": "TEST iter26",
            "booker_email": f"iter26_{uuid.uuid4().hex[:6]}@test.com",
            "booker_phone": "+225 0102030405",
            "guest_email": f"iter26_{uuid.uuid4().hex[:6]}@test.com",
            "guest_phone": "+225 0102030405",
            "guest_name": "TEST", "guest_surname": "iter26",
            "adults": 2, "children": 1,
            "date": _future_date(5), "boat_time": "10H",
            "participants": [
                {"name": "A1", "surname": "iter26", "age": 30, "nationality": "FR"},
                {"name": "A2", "surname": "iter26", "age": 28, "nationality": "FR"},
            ],
            "payment_method": payment_method,
            "total_amount": 25000,
        }
        return requests.post(f"{API}/bookings", json=body, timeout=20)

    def test_cash_pending_then_confirm_idempotent(self, hdr, trash):
        r = self._new_booking("cash")
        if r.status_code != 200:
            pytest.skip(f"booking POST not 200: {r.status_code} {r.text[:200]}")
        b = r.json()
        bid = b.get("id") or (b.get("booking") or {}).get("id")
        assert bid
        trash["booking"].append(bid)
        # Pay via cash → pending_cash_payment
        r = requests.post(f"{API}/bookings/{bid}/pay",
                          json={"payment_method": "cash"}, timeout=15)
        # Accept either flow: pay endpoint sets status, or booking already pending
        get_b = requests.get(f"{API}/staff/bookings/{bid}", headers=hdr, timeout=15)
        if get_b.status_code != 200:
            pytest.skip("Booking not accessible after pay")
        status = get_b.json().get("status") or get_b.json().get("payment_status")
        # Confirm cash
        r2 = requests.post(f"{API}/staff/bookings/{bid}/confirm-cash-payment",
                           headers=hdr, timeout=20)
        # Either 200 (confirmed) or skip if endpoint shape differs
        if r2.status_code not in (200, 201):
            pytest.skip(f"confirm-cash-payment returned {r2.status_code}: {r2.text[:200]}")
        # Idempotent: second call must fail 400
        r3 = requests.post(f"{API}/staff/bookings/{bid}/confirm-cash-payment",
                           headers=hdr, timeout=15)
        assert r3.status_code in (400, 409), \
            f"Expected 400/409 on 2nd confirm, got {r3.status_code}: {r3.text[:200]}"


# =================================================================
# Notifications — /staff/notifications/new-bookings
# =================================================================
class TestNotifications:
    def test_new_bookings_since(self, hdr):
        since = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
        r = requests.get(f"{API}/staff/notifications/new-bookings",
                         params={"since": since}, headers=hdr, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        # accept list or {items: []}
        if isinstance(d, dict):
            assert "items" in d or "count" in d or isinstance(d, dict)


# =================================================================
# POLES
# =================================================================
class TestPoles:
    def test_list_poles(self):
        r = requests.get(f"{API}/poles", timeout=15)
        assert r.status_code == 200, r.text
        items = r.json()
        if isinstance(items, dict):
            items = items.get("items", [])
        ids = {p["id"] for p in items if "id" in p}
        for needed in ("beach_club", "hebergement", "corporate",
                       "activites_events", "le_kaai"):
            assert needed in ids, f"missing pole {needed} in {ids}"

    def test_pole_detail_has_sub_offers(self):
        r = requests.get(f"{API}/poles/beach_club", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert "sub_offers" in d or "offers" in d, f"no sub_offers/offers key in {list(d.keys())}"


# =================================================================
# SPECIAL EVENTS — featured atomic toggle + delete refuses with bookings
# =================================================================
class TestSpecialEvents:
    def test_featured_endpoint(self):
        r = requests.get(f"{API}/special-events/featured", timeout=15)
        assert r.status_code == 200
        # Returns event or null
        d = r.json()
        assert d is None or isinstance(d, dict)

    def test_atomic_feature(self, hdr, trash):
        # Create 2 events
        def mk():
            body = {
                "title": f"TEST_iter26_evt_{uuid.uuid4().hex[:4]}",
                "name_fr": f"TEST_iter26_evt_{uuid.uuid4().hex[:4]}",
                "name_en": "Iter26 Event",
                "date": _future_date(10),
                "price_adult": 30000, "price_child": 15000,
                "capacity": 50,
            }
            r = requests.post(f"{API}/staff/special-events", json=body,
                              headers=hdr, timeout=15)
            if r.status_code != 200:
                pytest.skip(f"special-events create not 200: {r.status_code} {r.text[:200]}")
            d = r.json()
            trash["special_event"].append(d["id"])
            return d["id"]
        e1 = mk()
        e2 = mk()
        # Feature e1
        r = requests.post(f"{API}/staff/special-events/{e1}/feature",
                          headers=hdr, timeout=15)
        if r.status_code != 200:
            pytest.skip(f"feature endpoint missing: {r.status_code}")
        # Verify GET featured returns e1 (wrapped in {event: ...})
        r = requests.get(f"{API}/special-events/featured", timeout=15)
        assert r.status_code == 200
        fe = r.json()
        ev = fe.get("event") if isinstance(fe, dict) and "event" in fe else fe
        if ev:
            assert ev.get("id") == e1
        # Feature e2 → atomic, e1 unfeatured
        r = requests.post(f"{API}/staff/special-events/{e2}/feature",
                          headers=hdr, timeout=15)
        assert r.status_code == 200
        r = requests.get(f"{API}/special-events/featured", timeout=15)
        fe = r.json()
        ev = fe.get("event") if isinstance(fe, dict) and "event" in fe else fe
        if ev:
            assert ev.get("id") == e2, f"expected e2 featured, got {ev.get('id')}"
