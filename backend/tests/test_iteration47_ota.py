"""Iteration 47 — Phase C Vague 3 — OTA & Channel Manager (SiteMinder).

Covers:
- /api/staff/ota/config GET/PUT (password never echoed; empty pwd preserves)
- /api/staff/ota/mappings POST/PATCH/DELETE + duplicate 409
- /api/staff/ota/sync/availability + sync/room-rates → log_id, no 500
- /api/staff/ota/sync-logs filter
- /api/webhooks/siteminder/reservations SOAP parse + WSSE auth
- /api/staff/ota/reservations list + filter
- /api/staff/ota/status aggregated counts
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://reserve-bbr.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@boulay.ci"
ADMIN_PASSWORD = "Admin@2026"


@pytest.fixture(scope="module")
def headers():
    r = requests.post(
        f"{BASE_URL}/api/auth/staff/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=30,
    )
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text[:300]}"
    tok = r.json().get("token") or r.json().get("access_token")
    assert tok
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def created():
    return {"mappings": []}


@pytest.fixture(scope="module", autouse=True)
def _cleanup(created, headers):
    yield
    for mid in created["mappings"]:
        try:
            requests.delete(f"{BASE_URL}/api/staff/ota/mappings/{mid}", headers=headers, timeout=10)
        except Exception:
            pass
    # Restore webhook creds to empty to not break later tests
    try:
        requests.put(
            f"{BASE_URL}/api/staff/ota/config",
            headers=headers,
            json={"webhook_username": "", "webhook_password": ""},
            timeout=10,
        )
    except Exception:
        pass


# ── Config ──────────────────────────────────────────────────────────
class TestConfig:
    def test_get_config_returns_defaults_and_no_password(self, headers):
        r = requests.get(f"{BASE_URL}/api/staff/ota/config", headers=headers, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("mode") == "sandbox"
        assert d.get("hotel_code") == "PMSXTEST1"
        assert "pms_password" not in d
        assert "webhook_password" not in d
        assert "pms_password_set" in d
        assert "webhook_password_set" in d
        assert "ota_channels" in d and "booking_com" in d["ota_channels"]

    def test_put_config_does_not_overwrite_password_when_omitted(self, headers):
        # First set webhook password
        r = requests.put(
            f"{BASE_URL}/api/staff/ota/config",
            headers=headers,
            json={"webhook_username": "smtest", "webhook_password": "smpwd_iter47"},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        assert r.json().get("webhook_password_set") is True

        # Now update only hotel_code (no password fields sent) → existing pwd preserved
        r = requests.put(
            f"{BASE_URL}/api/staff/ota/config",
            headers=headers,
            json={"hotel_code": "PMSXTEST1"},  # unchanged but valid
            timeout=15,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("webhook_password_set") is True, "password lost when not provided"
        # Confirm we can still hit the auth-protected webhook later with the saved creds


# ── Mappings ────────────────────────────────────────────────────────
class TestMappings:
    @pytest.fixture(scope="class")
    def mapping_id(self, headers, created):
        unique = f"TEST_offer_{uuid.uuid4().hex[:8]}"
        r = requests.post(
            f"{BASE_URL}/api/staff/ota/mappings",
            headers=headers,
            json={
                "internal_offer_id": unique,
                "label": "Test mapping",
                "sm_room_type_code": "PMSXTEST_ROOM",
                "channels": ["booking_com", "expedia"],
                "enabled": True,
            },
            timeout=15,
        )
        assert r.status_code in (200, 201), r.text
        mid = r.json().get("id")
        assert mid
        created["mappings"].append(mid)
        return {"id": mid, "internal_offer_id": unique}

    def test_create_then_get_lists_it(self, headers, mapping_id):
        r = requests.get(f"{BASE_URL}/api/staff/ota/mappings", headers=headers, timeout=15)
        assert r.status_code == 200
        items = r.json().get("items", [])
        assert any(it.get("id") == mapping_id["id"] for it in items)

    def test_duplicate_returns_409(self, headers, mapping_id):
        r = requests.post(
            f"{BASE_URL}/api/staff/ota/mappings",
            headers=headers,
            json={
                "internal_offer_id": mapping_id["internal_offer_id"],
                "sm_room_type_code": "X",
            },
            timeout=15,
        )
        assert r.status_code == 409, f"expected 409, got {r.status_code}: {r.text}"

    def test_patch_toggles_enabled(self, headers, mapping_id):
        r = requests.patch(
            f"{BASE_URL}/api/staff/ota/mappings/{mapping_id['id']}",
            headers=headers, json={"enabled": False}, timeout=15,
        )
        assert r.status_code == 200, r.text
        # verify
        items = requests.get(f"{BASE_URL}/api/staff/ota/mappings", headers=headers).json()["items"]
        m = next(it for it in items if it["id"] == mapping_id["id"])
        assert m["enabled"] is False

    def test_patch_then_delete(self, headers, created):
        # Create throwaway
        unique = f"TEST_del_{uuid.uuid4().hex[:6]}"
        c = requests.post(
            f"{BASE_URL}/api/staff/ota/mappings",
            headers=headers,
            json={"internal_offer_id": unique, "sm_room_type_code": "PMSXTEST_ROOM"},
            timeout=15,
        )
        mid = c.json()["id"]
        r = requests.delete(f"{BASE_URL}/api/staff/ota/mappings/{mid}", headers=headers, timeout=15)
        assert r.status_code == 200
        # Confirm not present
        items = requests.get(f"{BASE_URL}/api/staff/ota/mappings", headers=headers).json()["items"]
        assert not any(it["id"] == mid for it in items)


# ── Sync ────────────────────────────────────────────────────────────
class TestSync:
    def test_availability_push_returns_log_id_no_crash(self, headers, created):
        # Need at least one mapping
        if not created["mappings"]:
            r = requests.post(
                f"{BASE_URL}/api/staff/ota/mappings",
                headers=headers,
                json={"internal_offer_id": f"TEST_sync_{uuid.uuid4().hex[:6]}",
                      "sm_room_type_code": "PMSXTEST_ROOM"},
                timeout=15,
            )
            created["mappings"].append(r.json()["id"])
        mid = created["mappings"][0]
        # Re-enable in case prior test disabled
        requests.patch(f"{BASE_URL}/api/staff/ota/mappings/{mid}", headers=headers, json={"enabled": True})
        r = requests.post(
            f"{BASE_URL}/api/staff/ota/sync/availability",
            headers=headers,
            json={"updates": [{
                "mapping_id": mid,
                "start_date": "2026-06-01",
                "end_date": "2026-06-07",
                "booking_limit": 5,
            }]},
            timeout=90,
        )
        assert r.status_code == 200, f"status={r.status_code} body={r.text[:500]}"
        body = r.json()
        assert "log_id" in body
        # ok may be true or false depending on sandbox; both are acceptable

    def test_room_rates_fetch_no_500(self, headers):
        r = requests.post(f"{BASE_URL}/api/staff/ota/sync/room-rates", headers=headers, timeout=90)
        assert r.status_code == 200, f"status={r.status_code} body={r.text[:500]}"
        assert "log_id" in r.json()

    def test_sync_logs_filter(self, headers):
        r = requests.get(f"{BASE_URL}/api/staff/ota/sync-logs?kind=availability_push", headers=headers, timeout=15)
        assert r.status_code == 200
        items = r.json().get("items", [])
        for it in items:
            assert it["kind"] == "availability_push"


# ── Webhook ─────────────────────────────────────────────────────────
SAMPLE_RES_XML_TEMPLATE = """<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:wsse="http://schemas.xmlsoap.org/ws/2002/07/secext">
 <soap:Header>{wsse_block}</soap:Header>
 <soap:Body>
  <OTA_HotelResNotifRQ xmlns="http://www.opentravel.org/OTA/2003/05" EchoToken="echo-iter47-{rand}" TimeStamp="2026-01-15T10:00:00Z" Version="1.0">
   <POS><Source BookingChannelCode="booking_com"><RequestorID Type="22" ID="PMSXTEST"/></Source></POS>
   <HotelReservations>
    <HotelReservation ResStatus="NEW">
     <UniqueID Type="14" ID="SM-RES-{rand}"/>
     <RoomStays>
      <RoomStay>
       <RoomTypes><RoomType RoomTypeCode="PMSXTEST_ROOM"/></RoomTypes>
       <RatePlans><RatePlan RatePlanCode="STD"/></RatePlans>
       <TimeSpan Start="2026-07-01" End="2026-07-03"/>
       <Total AmountAfterTax="240.00" CurrencyCode="EUR"/>
       <BasicPropertyInfo HotelCode="PMSXTEST1"/>
      </RoomStay>
     </RoomStays>
     <ResGuests><ResGuest><Profiles><ProfileInfo><Profile><Customer>
      <PersonName><GivenName>Iter47</GivenName><Surname>Tester</Surname></PersonName>
      <Email>iter47.tester@example.com</Email>
      <Telephone PhoneNumber="+33600000047"/>
     </Customer></Profile></ProfileInfo></Profiles></ResGuest></ResGuests>
     <HotelReservationIDs><HotelReservationID ResID_Value="SM-RES-{rand}"/></HotelReservationIDs>
    </HotelReservation>
   </HotelReservations>
  </OTA_HotelResNotifRQ>
 </soap:Body>
</soap:Envelope>"""

WSSE_BLOCK = """<wsse:Security><wsse:UsernameToken><wsse:Username>{u}</wsse:Username><wsse:Password>{p}</wsse:Password></wsse:UsernameToken></wsse:Security>"""


class TestWebhook:
    def test_webhook_rejects_without_wsse_when_auth_configured(self, headers):
        # ensure auth creds are set
        requests.put(
            f"{BASE_URL}/api/staff/ota/config",
            headers=headers,
            json={"webhook_username": "smtest", "webhook_password": "smpwd_iter47"},
            timeout=15,
        )
        rand = uuid.uuid4().hex[:6]
        body = SAMPLE_RES_XML_TEMPLATE.format(wsse_block="", rand=rand)
        r = requests.post(
            f"{BASE_URL}/api/webhooks/siteminder/reservations",
            data=body.encode("utf-8"),
            headers={"Content-Type": "text/xml; charset=utf-8"},
            timeout=15,
        )
        assert r.status_code == 401, f"expected 401, got {r.status_code}: {r.text[:300]}"

    def test_webhook_accepts_valid_wsse_and_persists(self, headers):
        # Make sure creds are set (idempotent)
        requests.put(
            f"{BASE_URL}/api/staff/ota/config",
            headers=headers,
            json={"webhook_username": "smtest", "webhook_password": "smpwd_iter47"},
            timeout=15,
        )
        rand = uuid.uuid4().hex[:6]
        wsse = WSSE_BLOCK.format(u="smtest", p="smpwd_iter47")
        body = SAMPLE_RES_XML_TEMPLATE.format(wsse_block=wsse, rand=rand)
        r = requests.post(
            f"{BASE_URL}/api/webhooks/siteminder/reservations",
            data=body.encode("utf-8"),
            headers={"Content-Type": "text/xml; charset=utf-8"},
            timeout=20,
        )
        assert r.status_code == 200, f"got {r.status_code}: {r.text[:300]}"
        assert "Success" in r.text or "UniqueID" in r.text
        assert "OTA_HotelResNotifRS" in r.text

        # Filter persisted reservation by channel
        rr = requests.get(
            f"{BASE_URL}/api/staff/ota/reservations?channel=booking_com",
            headers=headers, timeout=15,
        )
        assert rr.status_code == 200
        items = rr.json().get("items", [])
        # Look for our new SM-RES-{rand}
        match = [i for i in items if i.get("sm_reservation_id") == f"SM-RES-{rand}"]
        assert match, f"reservation SM-RES-{rand} not persisted; got {len(items)} items"
        assert match[0]["channel"] == "booking_com"
        assert match[0]["guest_name"] == "Iter47 Tester"


# ── Reservations + Status ───────────────────────────────────────────
class TestReservationsAndStatus:
    def test_reservations_filter_booking_com(self, headers):
        r = requests.get(f"{BASE_URL}/api/staff/ota/reservations?channel=booking_com", headers=headers, timeout=15)
        assert r.status_code == 200
        for it in r.json().get("items", []):
            assert it["channel"] == "booking_com"

    def test_status_aggregates(self, headers):
        r = requests.get(f"{BASE_URL}/api/staff/ota/status", headers=headers, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "mappings_total" in d and isinstance(d["mappings_total"], int)
        assert "reservations_total" in d
        assert "by_channel" in d and "booking_com" in d["by_channel"]
        assert d["by_channel"]["booking_com"] >= 1
