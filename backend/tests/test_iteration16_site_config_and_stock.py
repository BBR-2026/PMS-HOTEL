"""Iteration 16 tests — site-config (footer email + livret PDF), event matches/stock,
booking stock enforcement.

Run:  pytest -v backend/tests/test_iteration16_site_config_and_stock.py
"""
from __future__ import annotations

import io
import os
import uuid

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # Fallback to the frontend/.env value if env var not exported in the test shell.
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                    break
    except Exception:
        pass
assert BASE_URL, "REACT_APP_BACKEND_URL missing"

ADMIN_EMAIL = "admin@boulay.ci"
ADMIN_PASSWORD = "Admin@2026"

EVENT_ID = "a9119968-09d6-4688-85c8-2915784b3a44"
EVENT_DATE = "2026-12-15"


# ---------- shared fixtures ----------
@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(
        f"{BASE_URL}/api/auth/staff/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=30,
    )
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def serveur_token():
    """Try to authenticate as a non-admin/non-manager role to assert 403.
    We use the dedicated hotesse seed account from /app/memory/test_credentials.md."""
    r = requests.post(
        f"{BASE_URL}/api/auth/staff/login",
        json={"email": "hotesse.test@boulay.ci", "password": "Hotesse@2026"},
        timeout=30,
    )
    if r.status_code != 200:
        pytest.skip("hotesse role not available in this env")
    return r.json()["access_token"]


def _make_pdf_bytes() -> bytes:
    """Build a minimal valid PDF without external deps."""
    try:
        from reportlab.pdfgen.canvas import Canvas
        buf = io.BytesIO()
        c = Canvas(buf)
        c.drawString(72, 720, "BBR Livret Test")
        c.showPage()
        c.save()
        return buf.getvalue()
    except Exception:
        # Hand-rolled minimal PDF (valid header + EOF) — works for size/mime checks.
        return (
            b"%PDF-1.4\n1 0 obj<<>>endobj\n"
            b"trailer<<>>\n%%EOF\n"
        )


# ---------- SITE-CONFIG ----------
class TestSiteConfig:
    """GET/PATCH /api/staff/site-config and livret upload/get/delete."""

    def test_get_site_config_seeded(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/staff/site-config", headers=admin_headers, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "email_footer_html" in data
        assert isinstance(data["email_footer_html"], str)
        assert len(data["email_footer_html"]) > 0
        assert "livret_enabled" in data
        assert "livret_media_id" in data  # may be None or set from prior tests

    def test_patch_footer_admin_ok(self, admin_headers):
        new_html = f"<p>Test footer {uuid.uuid4().hex[:6]}</p>"
        r = requests.patch(
            f"{BASE_URL}/api/staff/site-config",
            headers=admin_headers,
            json={"email_footer_html": new_html},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["email_footer_html"] == new_html
        # Confirm persistence
        r2 = requests.get(f"{BASE_URL}/api/staff/site-config", headers=admin_headers, timeout=30)
        assert r2.status_code == 200
        assert r2.json()["email_footer_html"] == new_html

    def test_patch_footer_lower_role_forbidden(self, serveur_token):
        """SPEC: 'rôle serveur_caisse doit échouer 403'. We probe with hotesse
        (the only non-admin seed available) which, like serveur_caisse, is NOT in
        the literal ['admin','manager'] allowlist on site-config PATCH.

        NOTE: ROLE_INCLUDES maps both hotesse and serveur_caisse to 'manager'
        for legacy backward-compat, so the inheritance graph currently grants
        bypass on this endpoint. Test left as-is to surface the issue."""
        h = {"Authorization": f"Bearer {serveur_token}", "Content-Type": "application/json"}
        r = requests.patch(
            f"{BASE_URL}/api/staff/site-config",
            headers=h,
            json={"email_footer_html": "<p>hacked</p>"},
            timeout=30,
        )
        assert r.status_code == 403, f"expected 403 got {r.status_code} body={r.text}"

    def test_upload_livret_pdf_ok(self, admin_token):
        pdf = _make_pdf_bytes()
        files = {"file": ("test_livret.pdf", pdf, "application/pdf")}
        r = requests.post(
            f"{BASE_URL}/api/staff/site-config/livret",
            headers={"Authorization": f"Bearer {admin_token}"},
            files=files,
            timeout=60,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["livret_media_id"]
        assert data["livret_filename"] == "test_livret.pdf"
        assert data["livret_size"] > 0

    def test_upload_livret_non_pdf_rejected(self, admin_token):
        files = {"file": ("notes.txt", b"hello world", "text/plain")}
        r = requests.post(
            f"{BASE_URL}/api/staff/site-config/livret",
            headers={"Authorization": f"Bearer {admin_token}"},
            files=files,
            timeout=30,
        )
        assert r.status_code == 400, f"expected 400 got {r.status_code} {r.text}"

    def test_upload_livret_oversize_rejected(self, admin_token):
        # 16 MB > 15 MB cap
        big = b"%PDF-1.4\n" + b"0" * (16 * 1024 * 1024)
        files = {"file": ("big.pdf", big, "application/pdf")}
        r = requests.post(
            f"{BASE_URL}/api/staff/site-config/livret",
            headers={"Authorization": f"Bearer {admin_token}"},
            files=files,
            timeout=90,
        )
        assert r.status_code == 400, f"expected 400 got {r.status_code} {r.text}"

    def test_public_get_livret_after_upload(self, admin_headers):
        # Make sure a livret is configured (upload again if needed)
        cfg = requests.get(f"{BASE_URL}/api/staff/site-config", headers=admin_headers, timeout=30).json()
        if not cfg.get("livret_media_id"):
            pdf = _make_pdf_bytes()
            files = {"file": ("seed.pdf", pdf, "application/pdf")}
            requests.post(
                f"{BASE_URL}/api/staff/site-config/livret",
                headers={"Authorization": admin_headers["Authorization"]},
                files=files,
                timeout=60,
            )
        r = requests.get(f"{BASE_URL}/api/site-config/livret", timeout=30)
        assert r.status_code == 200, r.text
        assert r.headers.get("content-type", "").startswith("application/pdf")
        assert r.content.startswith(b"%PDF"), "response is not a PDF"

    def test_delete_livret_then_404(self, admin_headers):
        # Delete
        r = requests.delete(
            f"{BASE_URL}/api/staff/site-config/livret",
            headers={"Authorization": admin_headers["Authorization"]},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["livret_media_id"] is None
        # Public endpoint now 404
        r2 = requests.get(f"{BASE_URL}/api/site-config/livret", timeout=30)
        assert r2.status_code == 404


# ---------- SPECIAL EVENT — matches + packages.stock ----------
class TestSpecialEventMatchesAndStock:

    def test_public_event_returns_matches_and_stock(self):
        r = requests.get(f"{BASE_URL}/api/special-events/{EVENT_ID}", timeout=30)
        assert r.status_code == 200, r.text
        ev = r.json()["event"]
        prog = ev.get("programme") or []
        assert prog, "programme empty"
        day0 = prog[0]
        matches = day0.get("matches") or []
        assert len(matches) >= 1, "no matches in programme[0]"
        m0 = matches[0]
        for k in ("time", "team_home", "team_away"):
            assert k in m0 and m0[k]
        # Packages annotated with sold / remaining
        for pkg in (day0.get("packages") or []):
            assert "sold" in pkg
            if int(pkg.get("stock", 0) or 0) > 0:
                assert pkg["remaining"] is not None
                assert pkg["remaining"] == pkg["stock"] - pkg["sold"]

    def test_patch_event_accepts_matches_and_stock(self, admin_headers):
        # Fetch current event (staff endpoint exposes full doc)
        r = requests.get(
            f"{BASE_URL}/api/staff/special-events/{EVENT_ID}", headers=admin_headers, timeout=30
        )
        assert r.status_code == 200, r.text
        ev = r.json()  # staff endpoint returns the event dict directly
        prog = ev.get("programme") or []
        assert prog, "programme empty"
        # Build PATCH body preserving structure with explicit matches+stock
        new_prog = []
        for p in prog:
            new_pkgs = []
            for pkg in (p.get("packages") or []):
                pkg2 = {k: pkg.get(k) for k in (
                    "id", "label", "description", "price_adult", "price_child",
                    "max_persons", "stock",
                ) if k in pkg}
                new_pkgs.append(pkg2)
            new_prog.append({
                "date": p["date"],
                "title": p["title"],
                "description": p.get("description", ""),
                "price_adult": p.get("price_adult", 0),
                "price_child": p.get("price_child", 0),
                "packages": new_pkgs,
                "matches": [
                    {"time": "17H00", "team_home": "France", "team_away": "Argentine",
                     "stage": "Match d ouverture", "flag_home": "🇫🇷", "flag_away": "🇦🇷"},
                    {"time": "20H00", "team_home": "Brésil", "team_away": "Maroc",
                     "stage": "Groupe A", "flag_home": "🇧🇷", "flag_away": "🇲🇦"},
                ],
            })
        r2 = requests.patch(
            f"{BASE_URL}/api/staff/special-events/{EVENT_ID}",
            headers=admin_headers,
            json={"programme": new_prog},
            timeout=30,
        )
        assert r2.status_code == 200, r2.text
        # Verify
        r3 = requests.get(f"{BASE_URL}/api/special-events/{EVENT_ID}", timeout=30)
        assert r3.status_code == 200
        pp = r3.json()["event"]["programme"][0]
        assert len(pp["matches"]) == 2
        assert pp["matches"][0]["flag_home"] == "🇫🇷"


# ---------- BOOKING stock enforcement ----------
class TestBookingStockEnforcement:
    """Create bookings for pkg_bal (stock=2) and assert the 3rd returns 409."""

    @pytest.fixture(scope="class")
    def created_ids(self):
        return []

    def _make_payload(self, package_id):
        suffix = uuid.uuid4().hex[:6]
        return {
            "offer_type": "special_event",
            "date": EVENT_DATE,
            "boat_time": "17H",
            "adults": 2,
            "children": 0,
            "participants": [
                {"name": "Adult", "surname": f"One{suffix}", "nationality": "FR",
                 "email": f"TEST_stk_{suffix}@example.com", "phone": "+22500000000",
                 "kind": "adult"},
                {"name": "Adult", "surname": f"Two{suffix}", "nationality": "FR",
                 "kind": "adult"},
            ],
            "special_event_id": EVENT_ID,
            "package_selections": [
                {"date": EVENT_DATE, "package_id": package_id, "adults": 2, "children": 0},
            ],
        }

    def test_stock_pkg_bal_two_ok_then_third_409(self, created_ids):
        # Cleanup any previous TEST_ bookings for this pkg to start fresh
        # (no admin DELETE endpoint exposed for arbitrary bookings — best-effort:
        #  rely on the event having stock=2 still).
        r0 = requests.get(f"{BASE_URL}/api/special-events/{EVENT_ID}", timeout=30)
        bal = next(
            (p for p in r0.json()["event"]["programme"][0]["packages"] if p["id"] == "pkg_bal"),
            None,
        )
        assert bal and bal["stock"] == 2, f"unexpected pkg_bal stock: {bal}"
        remaining = bal["remaining"]
        if remaining <= 0:
            pytest.skip(f"pkg_bal already sold out (remaining={remaining}) — needs DB cleanup")

        # Book until full
        booked = 0
        for _ in range(remaining):
            r = requests.post(
                f"{BASE_URL}/api/bookings",
                json=self._make_payload("pkg_bal"),
                timeout=30,
            )
            assert r.status_code in (200, 201), f"unexpected {r.status_code} {r.text}"
            booked += 1
            bid = r.json().get("id") or r.json().get("booking", {}).get("id")
            if bid:
                created_ids.append(bid)
        # Next must 409
        r_over = requests.post(
            f"{BASE_URL}/api/bookings",
            json=self._make_payload("pkg_bal"),
            timeout=30,
        )
        assert r_over.status_code == 409, f"expected 409 got {r_over.status_code} {r_over.text}"
        body = r_over.json()
        detail = body.get("detail") or ""
        assert "limité à 2" in detail or "exemplaire" in detail, f"unexpected detail: {detail}"

    def test_stock_zero_means_unlimited(self, admin_headers):
        """Patch a dummy package to stock=0 and ensure many bookings pass.
        We use pkg_std and set its stock=0 for this assertion, then restore."""
        # Save original
        sev = requests.get(
            f"{BASE_URL}/api/staff/special-events/{EVENT_ID}", headers=admin_headers, timeout=30
        ).json()
        prog = sev["programme"]
        orig_stock = None
        for p in prog:
            for pkg in p["packages"]:
                if pkg["id"] == "pkg_std":
                    orig_stock = pkg["stock"]
                    pkg["stock"] = 0
        assert orig_stock is not None
        # PATCH
        r = requests.patch(
            f"{BASE_URL}/api/staff/special-events/{EVENT_ID}",
            headers=admin_headers,
            json={"programme": prog},
            timeout=30,
        )
        assert r.status_code == 200, r.text

        try:
            # Make 3 bookings — should all succeed since stock=0 means unlimited
            for _ in range(3):
                r = requests.post(
                    f"{BASE_URL}/api/bookings",
                    json=self._make_payload("pkg_std"),
                    timeout=30,
                )
                assert r.status_code in (200, 201), f"stock=0 should be unlimited, got {r.status_code} {r.text}"
        finally:
            # Restore original stock
            for p in prog:
                for pkg in p["packages"]:
                    if pkg["id"] == "pkg_std":
                        pkg["stock"] = orig_stock
            requests.patch(
                f"{BASE_URL}/api/staff/special-events/{EVENT_ID}",
                headers=admin_headers,
                json={"programme": prog},
                timeout=30,
            )
