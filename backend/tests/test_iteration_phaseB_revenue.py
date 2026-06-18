"""Iteration Phase-B Revenue Engine — backend regression.

Covers:
* Public POST /api/contact-messages (with marketing mirror)
* Public POST /api/newsletter-subscribers (idempotent)
* Staff GET /api/staff/contact-messages
* Staff PATCH /api/staff/contact-messages/{id}
* Staff GET /api/staff/newsletter-subscribers
* Staff GET /api/staff/newsletter-subscribers/export.csv
* Staff GET /api/staff/marketing/dashboard?period={7d,30d,90d,365d}
* Existing GET /api/marketing/stats/today (regression — should still work)
"""
import os
import time
import uuid
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE:
    pytest.skip("REACT_APP_BACKEND_URL not set", allow_module_level=True)

ADMIN_EMAIL = "admin@boulay.ci"
ADMIN_PASSWORD = "Admin@2026"


@pytest.fixture(scope="module")
def admin_token():
    """Login as admin via known endpoint(s). Try /api/auth/login first."""
    for path in ("/api/auth/staff/login", "/api/auth/login", "/api/staff/auth/login", "/api/login"):
        try:
            r = requests.post(f"{BASE}{path}",
                              json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
                              timeout=10)
            if r.status_code == 200:
                data = r.json()
                tok = data.get("token") or data.get("access_token") or data.get("jwt")
                if tok:
                    return tok
        except Exception:
            continue
    pytest.skip("Cannot obtain admin token")


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# ── Public endpoints ──────────────────────────────────────────────────
class TestPublicLeadEndpoints:
    def test_contact_message_submit(self):
        payload = {
            "name": "TEST QA Tester",
            "email": f"qa-contact-{uuid.uuid4().hex[:8]}@bbr.ci",
            "message": "Test message for QA",
            "phone": "+225 0700000000",
            "subject": "QA subject",
            "page": "/contact",
            "visitor_id": f"vqa-{uuid.uuid4().hex[:8]}",
            "attribution": {"utm_source": "qa", "utm_campaign": "phaseB"},
        }
        r = requests.post(f"{BASE}/api/contact-messages", json=payload, timeout=10)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("ok") is True
        assert "id" in data

    def test_contact_message_validation(self):
        # missing required `name`
        r = requests.post(f"{BASE}/api/contact-messages",
                          json={"email": "noname@bbr.ci", "message": "x"}, timeout=10)
        assert r.status_code == 422

    def test_newsletter_subscribe_new(self):
        email = f"qa-boutique-{uuid.uuid4().hex[:8]}@bbr.ci"
        payload = {"email": email, "first_name": "QA",
                   "source": "boutique_waitlist",
                   "visitor_id": f"vqa-{uuid.uuid4().hex[:8]}"}
        r = requests.post(f"{BASE}/api/newsletter-subscribers", json=payload, timeout=10)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("ok") is True
        assert data.get("already_subscribed") is False
        assert "id" in data

    def test_newsletter_subscribe_idempotent(self):
        email = f"qa-idem-{uuid.uuid4().hex[:8]}@bbr.ci"
        payload = {"email": email, "first_name": "QA", "source": "boutique_waitlist"}
        r1 = requests.post(f"{BASE}/api/newsletter-subscribers", json=payload, timeout=10)
        assert r1.status_code == 200, r1.text
        first_id = r1.json()["id"]
        # resubmit same email
        r2 = requests.post(f"{BASE}/api/newsletter-subscribers", json=payload, timeout=10)
        assert r2.status_code == 200, r2.text
        d2 = r2.json()
        assert d2.get("ok") is True
        assert d2.get("already_subscribed") is True
        assert d2.get("id") == first_id

    def test_newsletter_invalid_email(self):
        r = requests.post(f"{BASE}/api/newsletter-subscribers",
                          json={"email": "not-an-email"}, timeout=10)
        assert r.status_code in (400, 422)


# ── Marketing stats existing endpoint (regression) ─────────────────────
class TestExistingMarketing:
    def test_stats_today(self):
        r = requests.get(f"{BASE}/api/marketing/stats/today", timeout=10)
        assert r.status_code == 200, r.text
        body = r.json()
        assert isinstance(body, dict)


# ── Staff endpoints (require admin) ────────────────────────────────────
class TestStaffLeadsEndpoints:
    _seeded_email = None
    _seeded_msg_id = None

    @classmethod
    def setup_class(cls):
        # Seed one contact + one newsletter so list endpoints have content
        unique = uuid.uuid4().hex[:8]
        cls._seeded_email = f"qa-seed-{unique}@bbr.ci"
        msg = requests.post(f"{BASE}/api/contact-messages", json={
            "name": "TEST seed",
            "email": cls._seeded_email,
            "message": "seed message",
            "page": "/contact",
        }, timeout=10)
        if msg.status_code == 200:
            cls._seeded_msg_id = msg.json().get("id")
        requests.post(f"{BASE}/api/newsletter-subscribers", json={
            "email": cls._seeded_email, "first_name": "TESTSeed",
            "source": "boutique_waitlist",
        }, timeout=10)

    def test_list_contact_messages_requires_auth(self):
        r = requests.get(f"{BASE}/api/staff/contact-messages", timeout=10)
        assert r.status_code in (401, 403)

    def test_list_contact_messages_admin(self, admin_headers):
        r = requests.get(f"{BASE}/api/staff/contact-messages",
                         headers=admin_headers, timeout=10)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "items" in data
        assert "total_new" in data
        assert isinstance(data["items"], list)
        # mongo _id should be removed
        for item in data["items"][:5]:
            assert "_id" not in item
            assert "id" in item

    def test_patch_contact_message(self, admin_headers):
        if not self._seeded_msg_id:
            pytest.skip("No seeded msg")
        r = requests.patch(f"{BASE}/api/staff/contact-messages/{self._seeded_msg_id}",
                           json={"status": "in_progress"},
                           headers=admin_headers, timeout=10)
        assert r.status_code == 200, r.text
        # verify persistence
        r2 = requests.get(f"{BASE}/api/staff/contact-messages?q=seed",
                          headers=admin_headers, timeout=10)
        assert r2.status_code == 200
        items = r2.json().get("items", [])
        match = next((i for i in items if i.get("id") == self._seeded_msg_id), None)
        if match:
            assert match.get("status") == "in_progress"

    def test_patch_contact_message_404(self, admin_headers):
        r = requests.patch(f"{BASE}/api/staff/contact-messages/does-not-exist",
                           json={"status": "in_progress"},
                           headers=admin_headers, timeout=10)
        assert r.status_code == 404

    def test_list_newsletter_subscribers_requires_auth(self):
        r = requests.get(f"{BASE}/api/staff/newsletter-subscribers", timeout=10)
        assert r.status_code in (401, 403)

    def test_list_newsletter_subscribers_admin(self, admin_headers):
        r = requests.get(f"{BASE}/api/staff/newsletter-subscribers",
                         headers=admin_headers, timeout=10)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "items" in data
        assert "total_active" in data
        assert "by_source" in data
        assert isinstance(data["by_source"], list)
        for item in data["items"][:5]:
            assert "_id" not in item
            assert "id" in item

    def test_export_newsletter_csv(self, admin_headers):
        r = requests.get(f"{BASE}/api/staff/newsletter-subscribers/export.csv",
                         headers=admin_headers, timeout=15)
        assert r.status_code == 200, r.text
        assert "text/csv" in r.headers.get("content-type", "")
        assert "attachment" in r.headers.get("content-disposition", "").lower()
        body = r.text
        # CSV header should contain known columns
        assert "email" in body.split("\n")[0]


# ── Marketing analytics dashboard ─────────────────────────────────────
class TestMarketingDashboard:
    def test_dashboard_requires_auth(self):
        r = requests.get(f"{BASE}/api/staff/marketing/dashboard", timeout=10)
        assert r.status_code in (401, 403)

    @pytest.mark.parametrize("period", ["7d", "30d", "90d", "365d"])
    def test_dashboard_period(self, admin_headers, period):
        r = requests.get(f"{BASE}/api/staff/marketing/dashboard?period={period}",
                         headers=admin_headers, timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        # required keys
        for k in ("period", "start", "end", "kpis", "trend", "campaigns",
                  "by_source", "top_pages", "funnel", "leads_pipeline"):
            assert k in data, f"missing key {k} for period={period}"
        assert data["period"] == period
        kpis = data["kpis"]
        for k in ("unique_visitors", "page_views", "booking_intents",
                  "leads", "purchases", "conversion_rate_pct",
                  "lead_rate_pct", "total_events"):
            assert k in kpis
        # funnel must have 5 steps
        assert len(data["funnel"]) == 5
        assert data["funnel"][0]["event"] == "page_view"
        # leads_pipeline keys
        lp = data["leads_pipeline"]
        for k in ("contact_messages_total", "contact_messages_new",
                  "newsletter_total", "newsletter_active"):
            assert k in lp

    def test_dashboard_invalid_period(self, admin_headers):
        r = requests.get(f"{BASE}/api/staff/marketing/dashboard?period=42x",
                         headers=admin_headers, timeout=10)
        assert r.status_code == 422
