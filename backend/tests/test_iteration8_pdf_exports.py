"""Iteration 8 — PDF exports for clients & revenue (manager+).

Covers:
- /api/staff/clients/report.pdf (auth, roles, content, search, route ordering)
- /api/staff/revenue/report.pdf (auth, roles, content for each period)
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # Fallback for backend container without REACT_APP_BACKEND_URL
    BASE_URL = "http://localhost:8001"

API = f"{BASE_URL}/api"

ADMIN = {"email": "admin@boulay.ci", "password": "Admin@2026"}
MANAGER = {"email": "manager@boulay.ci", "password": "Manager@2026"}
RECEPTION = {"email": "reception@boulay.ci", "password": "Reception@2026"}


def _login(creds):
    r = requests.post(f"{API}/auth/staff/login", json=creds, timeout=15)
    assert r.status_code == 200, f"login failed for {creds['email']}: {r.status_code} {r.text}"
    tok = r.json().get("token") or r.json().get("access_token")
    assert tok, f"no token returned: {r.json()}"
    return tok


@pytest.fixture(scope="module")
def manager_token():
    return _login(MANAGER)


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN)


@pytest.fixture(scope="module")
def reception_token():
    return _login(RECEPTION)


# ----------------------- CLIENTS PDF -----------------------
class TestClientsPdf:
    def test_unauthenticated_returns_401(self):
        r = requests.get(f"{API}/staff/clients/report.pdf", timeout=15)
        assert r.status_code in (401, 403), f"expected 401/403 got {r.status_code}"

    def test_reception_forbidden(self, reception_token):
        r = requests.get(
            f"{API}/staff/clients/report.pdf",
            headers={"Authorization": f"Bearer {reception_token}"},
            timeout=15,
        )
        assert r.status_code == 403, f"expected 403 got {r.status_code} {r.text[:200]}"

    def test_manager_ok_pdf(self, manager_token):
        r = requests.get(
            f"{API}/staff/clients/report.pdf",
            headers={"Authorization": f"Bearer {manager_token}"},
            timeout=30,
        )
        assert r.status_code == 200, f"got {r.status_code} {r.text[:200]}"
        assert "application/pdf" in r.headers.get("content-type", "")
        assert r.content[:4] == b"%PDF", "not a valid PDF magic"
        assert len(r.content) > 1024, f"PDF too small: {len(r.content)} bytes"
        cd = r.headers.get("content-disposition", "")
        assert "bbr-clients.pdf" in cd, f"missing filename in CD: {cd}"

    def test_admin_ok_pdf(self, admin_token):
        r = requests.get(
            f"{API}/staff/clients/report.pdf",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=30,
        )
        assert r.status_code == 200
        assert r.content[:4] == b"%PDF"

    def test_with_search_filter(self, manager_token):
        # Search likely-empty token: must still return valid PDF
        r = requests.get(
            f"{API}/staff/clients/report.pdf",
            params={"search": "zzzNOMATCHzzz"},
            headers={"Authorization": f"Bearer {manager_token}"},
            timeout=30,
        )
        assert r.status_code == 200
        assert r.content[:4] == b"%PDF"
        # Should contain the search keyword (rendered in subtitle "Recherche : ...")
        # We can't easily read inside PDF, but at least body is valid
        assert len(r.content) > 800

    def test_route_ordering_not_intercepted_by_email_route(self, manager_token):
        """Critical: /staff/clients/report.pdf must NOT match /staff/clients/{email}."""
        r = requests.get(
            f"{API}/staff/clients/report.pdf",
            headers={"Authorization": f"Bearer {manager_token}"},
            timeout=30,
        )
        # Must be a PDF, not a JSON 404 "Client not found"
        assert r.status_code == 200, f"route ordering broken: {r.status_code} {r.text[:300]}"
        assert "application/pdf" in r.headers.get("content-type", "")
        assert r.content[:4] == b"%PDF"


# ----------------------- REVENUE PDF -----------------------
class TestRevenuePdf:
    def test_unauthenticated_returns_401(self):
        r = requests.get(f"{API}/staff/revenue/report.pdf", timeout=15)
        assert r.status_code in (401, 403)

    def test_reception_forbidden(self, reception_token):
        r = requests.get(
            f"{API}/staff/revenue/report.pdf",
            headers={"Authorization": f"Bearer {reception_token}"},
            timeout=15,
        )
        assert r.status_code == 403

    @pytest.mark.parametrize("period", ["day", "week", "month", "year", "all"])
    def test_manager_pdf_all_periods(self, manager_token, period):
        r = requests.get(
            f"{API}/staff/revenue/report.pdf",
            params={"period": period},
            headers={"Authorization": f"Bearer {manager_token}"},
            timeout=30,
        )
        assert r.status_code == 200, f"period={period} got {r.status_code} {r.text[:200]}"
        assert "application/pdf" in r.headers.get("content-type", "")
        assert r.content[:4] == b"%PDF"
        cd = r.headers.get("content-disposition", "")
        assert f"bbr-revenue-{period}.pdf" in cd, f"missing filename for {period}: {cd}"
        # Even an empty dataset PDF must be > a few hundred bytes
        assert len(r.content) > 800, f"PDF too small for period={period}: {len(r.content)}"

    def test_period_all_with_data_minsize(self, manager_token):
        """If there is any paid booking, period=all should be >= 1KB."""
        # Ensure at least one paid booking exists by checking the JSON dashboard first
        rj = requests.get(
            f"{API}/staff/revenue",
            params={"period": "all"},
            headers={"Authorization": f"Bearer {manager_token}"},
            timeout=15,
        )
        assert rj.status_code == 200
        has_data = (rj.json().get("total_bookings") or 0) > 0
        r = requests.get(
            f"{API}/staff/revenue/report.pdf",
            params={"period": "all"},
            headers={"Authorization": f"Bearer {manager_token}"},
            timeout=30,
        )
        assert r.status_code == 200
        assert r.content[:4] == b"%PDF"
        if has_data:
            assert len(r.content) > 1024, f"PDF with data must be >= 1KB got {len(r.content)}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
