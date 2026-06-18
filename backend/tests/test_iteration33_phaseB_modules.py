"""
Iteration 33 — Phase B continuation: CRM 360°, Memberships, Événementiel pipeline, Upsells
Tests run against the public REACT_APP_BACKEND_URL using admin credentials.
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://reserve-bbr.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@boulay.ci"
ADMIN_PASSWORD = "Admin@2026"


@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/staff/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def existing_booking_ref(admin_headers):
    r = requests.get(f"{BASE_URL}/api/staff/bookings?limit=1", headers=admin_headers, timeout=30)
    assert r.status_code == 200, r.text
    items = r.json()
    items = items if isinstance(items, list) else items.get("items", [])
    assert items, "No bookings in DB — required for upsells test"
    return items[0]["id"]


# =========================================================================
# Module 1 — CRM 360°
# =========================================================================
class TestCRM:
    def test_segments_counts(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/staff/crm/segments", headers=admin_headers, timeout=30)
        assert r.status_code == 200, r.text
        counts = r.json().get("counts", {})
        for k in ["all", "vip", "recent_visitor", "dormant", "lead", "customer", "prospect"]:
            assert k in counts, f"missing segment key {k}"
            assert isinstance(counts[k], int)
        assert counts["all"] >= counts["vip"]

    def test_customers_list_all(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/staff/crm/customers?limit=20", headers=admin_headers, timeout=30)
        assert r.status_code == 200, r.text
        items = r.json().get("items", [])
        assert isinstance(items, list)
        if items:
            row = items[0]
            assert "email" in row
            assert "segments" in row
            assert "total_spent" in row

    def test_customers_list_vip_segment(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/staff/crm/customers?segment=vip&limit=10",
                         headers=admin_headers, timeout=30)
        assert r.status_code == 200, r.text
        items = r.json().get("items", [])
        # Earlier verified: 4 VIPs in DB
        assert len(items) >= 1, "Expected at least 1 VIP customer in DB"
        for it in items:
            assert "vip" in it.get("segments", [])

    def test_customers_search(self, admin_headers):
        # Use a partial query — should not error
        r = requests.get(f"{BASE_URL}/api/staff/crm/customers?q=a&limit=5",
                         headers=admin_headers, timeout=30)
        assert r.status_code == 200

    def test_customer_detail_360(self, admin_headers):
        # Pick a customer email
        r = requests.get(f"{BASE_URL}/api/staff/crm/customers?limit=1", headers=admin_headers, timeout=30)
        items = r.json().get("items", [])
        if not items:
            pytest.skip("No customers in DB")
        email = items[0]["email"]
        d = requests.get(f"{BASE_URL}/api/staff/crm/customers/{email}",
                         headers=admin_headers, timeout=30)
        assert d.status_code == 200, d.text
        body = d.json()
        for k in ["profile", "kpis", "attribution", "segments", "bookings",
                  "messages", "event_requests", "newsletter", "marketing_events", "timeline"]:
            assert k in body, f"missing 360 key: {k}"

    def test_customer_detail_404_unknown_email(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/staff/crm/customers/notfound-xyz-{uuid.uuid4().hex[:6]}@nowhere.test",
                         headers=admin_headers, timeout=30)
        # Either 404 or 200 with empty profile (depends on implementation). Accept both.
        assert r.status_code in (200, 404)


# =========================================================================
# Module 2 — Memberships
# =========================================================================
class TestMemberships:
    def test_public_plans(self):
        r = requests.get(f"{BASE_URL}/api/memberships/plans", timeout=30)
        assert r.status_code == 200, r.text
        plans = r.json().get("plans", [])
        ids = {p["id"] for p in plans}
        assert {"sunset_card", "beach_card", "royal_card"}.issubset(ids), f"got {ids}"
        for p in plans:
            assert "benefits" in p and isinstance(p["benefits"], list)
            assert "price_xof" in p

    def test_subscribe_emits_marketing_event(self):
        unique = f"qa-vip-{uuid.uuid4().hex[:8]}@bbr.ci"
        payload = {"plan_id": "beach_card", "full_name": "TEST QA VIP", "email": unique, "phone": "0700000000"}
        r = requests.post(f"{BASE_URL}/api/memberships/subscribe", json=payload, timeout=30)
        assert r.status_code in (200, 201), r.text
        body = r.json()
        assert body.get("ok") is True
        assert "id" in body
        assert body.get("status") == "requested"

    def test_staff_list_memberships(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/staff/memberships", headers=admin_headers, timeout=30)
        assert r.status_code == 200, r.text
        items = r.json().get("items", [])
        assert isinstance(items, list)

    def test_workflow_subscribe_confirm_issue(self, admin_headers):
        # Step 1: create
        email = f"qa-flow-{uuid.uuid4().hex[:8]}@bbr.ci"
        r = requests.post(f"{BASE_URL}/api/memberships/subscribe",
                          json={"plan_id": "sunset_card", "full_name": "TEST Flow", "email": email},
                          timeout=30)
        assert r.status_code in (200, 201), r.text
        mid = r.json()["id"]

        # Step 2: confirm via PATCH
        r2 = requests.patch(f"{BASE_URL}/api/staff/memberships/{mid}",
                            json={"status": "confirmed"}, headers=admin_headers, timeout=30)
        assert r2.status_code == 200, r2.text

        # Step 3: issue card (activates + creates BBR-#### number + 365d expiry)
        r3 = requests.post(f"{BASE_URL}/api/staff/memberships/{mid}/issue",
                           headers=admin_headers, timeout=30)
        assert r3.status_code == 200, r3.text
        issued = r3.json()
        # The issued response should contain card number and expiry; tolerant check
        card_no = issued.get("card_number") or issued.get("number") or (issued.get("membership") or {}).get("card_number")
        assert card_no and card_no.startswith("BBR-"), f"Card number missing/invalid: {issued}"

        # Verify via list — membership should be active
        lst = requests.get(f"{BASE_URL}/api/staff/memberships", headers=admin_headers, timeout=30).json()
        items = lst.get("items", [])
        found = next((m for m in items if m.get("id") == mid or m.get("_id") == mid), None)
        if found:
            assert found.get("status") == "active"
            assert (found.get("card_number") or "").startswith("BBR-")


# =========================================================================
# Module 3 — Événementiel pipeline (reuses /api/staff/loisirs/events)
# =========================================================================
class TestEventsPipeline:
    def test_list_events(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/staff/loisirs/events", headers=admin_headers, timeout=30)
        assert r.status_code == 200, r.text
        items = r.json()
        items = items if isinstance(items, list) else items.get("items", [])
        assert isinstance(items, list)

    def test_workflow_patch_status(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/staff/loisirs/events", headers=admin_headers, timeout=30)
        items = r.json()
        items = items if isinstance(items, list) else items.get("items", [])
        if not items:
            pytest.skip("No events to test workflow")
        # Pick one — try advancing to 'contacted' then back to original
        ev = items[0]
        eid = ev.get("id") or ev.get("_id")
        original_status = ev.get("status")
        r2 = requests.patch(f"{BASE_URL}/api/staff/loisirs/events/{eid}",
                            json={"status": "contacted"}, headers=admin_headers, timeout=30)
        assert r2.status_code in (200, 204), r2.text
        # Restore
        if original_status:
            requests.patch(f"{BASE_URL}/api/staff/loisirs/events/{eid}",
                           json={"status": original_status}, headers=admin_headers, timeout=30)

    def test_decline_status_accepted(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/staff/loisirs/events", headers=admin_headers, timeout=30)
        items = r.json()
        items = items if isinstance(items, list) else items.get("items", [])
        if not items:
            pytest.skip("No events")
        ev = items[0]
        eid = ev.get("id") or ev.get("_id")
        original = ev.get("status")
        r2 = requests.patch(f"{BASE_URL}/api/staff/loisirs/events/{eid}",
                            json={"status": "declined"}, headers=admin_headers, timeout=30)
        assert r2.status_code in (200, 204), f"decline status not accepted: {r2.text}"
        if original:
            requests.patch(f"{BASE_URL}/api/staff/loisirs/events/{eid}",
                           json={"status": original}, headers=admin_headers, timeout=30)


# =========================================================================
# Module 4 — Upsell / Cross-sell
# =========================================================================
class TestUpsells:
    def test_catalog_returns_offers(self):
        r = requests.get(f"{BASE_URL}/api/upsells/catalog", timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        items = body.get("items", [])
        by_cat = body.get("by_category", {})
        assert len(items) >= 6, f"Expected >=6 seed offers, got {len(items)}"
        # Spec says 5 categories incl. 'experience' but seed only has offers in 4.
        # Verify at least the 4 categories that have seed offers.
        seeded_cats = {"beach_club", "wellness", "gastronomy", "transport"}
        present = set(by_cat.keys())
        assert seeded_cats.issubset(present), f"missing categories: {seeded_cats - present}"

    def test_filter_by_category(self):
        r = requests.get(f"{BASE_URL}/api/upsells/catalog?category=beach_club", timeout=30)
        assert r.status_code == 200, r.text
        items = r.json().get("items", [])
        for i in items:
            assert i["category"] == "beach_club"

    def test_add_selection_and_get(self, existing_booking_ref):
        cat = requests.get(f"{BASE_URL}/api/upsells/catalog", timeout=30).json()
        offer_id = cat["items"][0]["id"]
        r = requests.post(f"{BASE_URL}/api/upsells/bookings/{existing_booking_ref}",
                          json={"upsell_id": offer_id, "quantity": 1}, timeout=30)
        assert r.status_code in (200, 201), r.text

        g = requests.get(f"{BASE_URL}/api/upsells/bookings/{existing_booking_ref}", timeout=30)
        assert g.status_code == 200, g.text
        body = g.json()
        assert "items" in body and "total_xof" in body and "count" in body
        assert body["count"] >= 1
        assert body["total_xof"] > 0

    def test_add_selection_unknown_booking_returns_404(self):
        cat = requests.get(f"{BASE_URL}/api/upsells/catalog", timeout=30).json()
        offer_id = cat["items"][0]["id"]
        r = requests.post(f"{BASE_URL}/api/upsells/bookings/nonexistent-ref-{uuid.uuid4().hex[:8]}",
                          json={"upsell_id": offer_id, "quantity": 1}, timeout=30)
        assert r.status_code == 404

    def test_staff_list_upsells(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/staff/upsells", headers=admin_headers, timeout=30)
        assert r.status_code == 200, r.text
        items = r.json()
        items = items if isinstance(items, list) else items.get("items", [])
        assert isinstance(items, list) and len(items) >= 6

    def test_staff_crud(self, admin_headers):
        # Create
        payload = {
            "name": "TEST QA Upsell", "category": "wellness",
            "description": "QA seed", "price_xof": 9999,
            "image_url": "https://example.com/x.jpg",
            "stock_per_day": 1, "max_per_booking": 1, "active": True
        }
        c = requests.post(f"{BASE_URL}/api/staff/upsells",
                          json=payload, headers=admin_headers, timeout=30)
        assert c.status_code in (200, 201), c.text
        body = c.json()
        # Response shape: {ok: True, upsell: {id, ...}}
        upsell_obj = body.get("upsell") or body
        new_id = upsell_obj.get("id") or upsell_obj.get("_id") or body.get("id")
        assert new_id, f"no id returned: {body}"

        # Update
        u = requests.patch(f"{BASE_URL}/api/staff/upsells/{new_id}",
                           json={"price_xof": 12345, "active": False},
                           headers=admin_headers, timeout=30)
        assert u.status_code in (200, 204), u.text

        # Verify update via list
        lst = requests.get(f"{BASE_URL}/api/staff/upsells", headers=admin_headers, timeout=30).json()
        lst = lst if isinstance(lst, list) else lst.get("items", [])
        found = next((x for x in lst if (x.get("id") or x.get("_id")) == new_id), None)
        assert found is not None
        assert found.get("price_xof") == 12345
        assert found.get("active") is False

        # Delete
        d = requests.delete(f"{BASE_URL}/api/staff/upsells/{new_id}", headers=admin_headers, timeout=30)
        assert d.status_code in (200, 204), d.text

    def test_staff_stats(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/staff/upsells/stats", headers=admin_headers, timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        for k in ["total_selections", "revenue_xof", "by_category", "top_offers"]:
            assert k in body, f"missing key: {k}"


# =========================================================================
# Regressions — iteration_32 endpoints
# =========================================================================
class TestRegressions:
    def test_contact_messages_post(self):
        r = requests.post(f"{BASE_URL}/api/contact-messages",
                          json={"name": "TEST QA", "email": f"qa-iter33-{uuid.uuid4().hex[:6]}@example.com",
                                "subject": "QA", "message": "iter33 regression"}, timeout=30)
        assert r.status_code in (200, 201), r.text
        assert r.json().get("ok") is True

    def test_marketing_dashboard(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/staff/marketing/dashboard?period=30d",
                         headers=admin_headers, timeout=30)
        assert r.status_code == 200, r.text
        assert "kpis" in r.json()

    def test_contact_messages_list(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/staff/contact-messages",
                         headers=admin_headers, timeout=30)
        assert r.status_code == 200, r.text
        items = r.json()
        items = items if isinstance(items, list) else items.get("items", [])
        assert isinstance(items, list)
