"""Iteration 7 — Traversées history endpoint + PDF export.

Covers:
- GET /api/staff/traversees/history with day/week/month + status filter, role gating, validation.
- GET /api/staff/traversees/history/report.pdf binary stream + filename + content.
"""

import os
import pytest
import requests
from urllib.parse import urlencode

def _load_frontend_env():
    p = "/app/frontend/.env"
    if os.path.exists(p):
        with open(p) as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    return line.split("=", 1)[1].strip()
    return None


BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or _load_frontend_env()).rstrip("/")
API = f"{BASE_URL}/api"

CREDS = {
    "admin": ("admin@boulay.ci", "Admin@2026"),
    "manager": ("manager@boulay.ci", "Manager@2026"),
    "reception": ("reception@boulay.ci", "Reception@2026"),
}


@pytest.fixture(scope="module")
def tokens():
    s = requests.Session()
    out = {}
    for role, (email, pwd) in CREDS.items():
        r = s.post(f"{API}/auth/staff/login", json={"email": email, "password": pwd})
        assert r.status_code == 200, f"login {role}: {r.status_code} {r.text}"
        out[role] = r.json()["access_token"]
    return out


def _hdr(t):
    return {"Authorization": f"Bearer {t}"}


# ---------- AUTH / ROLE ACCESS ----------
class TestAuthAccess:
    def test_history_requires_auth(self):
        r = requests.get(f"{API}/staff/traversees/history?period=day&date=2026-05-11")
        assert r.status_code in (401, 403)

    def test_pdf_requires_auth(self):
        r = requests.get(f"{API}/staff/traversees/history/report.pdf?period=day&date=2026-05-11")
        assert r.status_code in (401, 403)

    @pytest.mark.parametrize("role", ["admin", "manager", "reception"])
    def test_all_staff_roles_can_read_history(self, tokens, role):
        r = requests.get(
            f"{API}/staff/traversees/history?period=day&date=2026-05-11",
            headers=_hdr(tokens[role]),
        )
        assert r.status_code == 200, f"{role}: {r.status_code} {r.text}"

    @pytest.mark.parametrize("role", ["admin", "manager", "reception"])
    def test_all_staff_roles_can_download_pdf(self, tokens, role):
        r = requests.get(
            f"{API}/staff/traversees/history/report.pdf?period=day&date=2026-05-11",
            headers=_hdr(tokens[role]),
        )
        assert r.status_code == 200, f"{role}: {r.status_code}"
        assert r.headers.get("content-type", "").startswith("application/pdf")


# ---------- PERIOD RESOLUTION ----------
class TestPeriodResolution:
    def test_day_period_returns_correct_range(self, tokens):
        r = requests.get(
            f"{API}/staff/traversees/history?period=day&date=2026-05-11",
            headers=_hdr(tokens["admin"]),
        )
        assert r.status_code == 200
        j = r.json()
        assert j["period"] == "day"
        assert j["reference_date"] == "2026-05-11"
        assert j["date_from"] == "2026-05-11"
        assert j["date_to"] == "2026-05-12"

    def test_week_period_returns_monday_to_next_monday(self, tokens):
        # 2026-05-11 is a Monday → date_from=2026-05-11, date_to=2026-05-18
        r = requests.get(
            f"{API}/staff/traversees/history?period=week&date=2026-05-11",
            headers=_hdr(tokens["admin"]),
        )
        assert r.status_code == 200
        j = r.json()
        assert j["date_from"] == "2026-05-11"
        assert j["date_to"] == "2026-05-18"
        # label like "Semaine du 11 May au 17 May 2026" (locale-dependent month abbrev)
        assert j["label"].lower().startswith("semaine du 11")
        assert "17" in j["label"] and "2026" in j["label"]

    def test_week_mid_week_date_snaps_to_monday(self, tokens):
        # 2026-05-13 is Wednesday → still Monday 2026-05-11
        r = requests.get(
            f"{API}/staff/traversees/history?period=week&date=2026-05-13",
            headers=_hdr(tokens["admin"]),
        )
        assert r.status_code == 200
        j = r.json()
        assert j["date_from"] == "2026-05-11"
        assert j["date_to"] == "2026-05-18"

    def test_month_period(self, tokens):
        r = requests.get(
            f"{API}/staff/traversees/history?period=month&date=2026-05-15",
            headers=_hdr(tokens["admin"]),
        )
        assert r.status_code == 200
        j = r.json()
        assert j["date_from"] == "2026-05-01"
        assert j["date_to"] == "2026-06-01"
        assert "2026" in j["label"]


# ---------- VALIDATION ----------
class TestValidation:
    def test_invalid_period_returns_400(self, tokens):
        r = requests.get(
            f"{API}/staff/traversees/history?period=invalid&date=2026-05-11",
            headers=_hdr(tokens["admin"]),
        )
        assert r.status_code == 400

    def test_invalid_date_returns_400(self, tokens):
        r = requests.get(
            f"{API}/staff/traversees/history?period=day&date=not-a-date",
            headers=_hdr(tokens["admin"]),
        )
        assert r.status_code == 400

    def test_invalid_status_returns_400(self, tokens):
        params = urlencode({"period": "day", "date": "2026-05-11", "status": "bogus"})
        r = requests.get(
            f"{API}/staff/traversees/history?{params}",
            headers=_hdr(tokens["admin"]),
        )
        assert r.status_code == 400


# ---------- PAYLOAD SHAPE ----------
class TestPayloadShape:
    def test_history_payload_contains_all_keys(self, tokens):
        r = requests.get(
            f"{API}/staff/traversees/history?period=day&date=2026-05-11",
            headers=_hdr(tokens["admin"]),
        )
        assert r.status_code == 200
        j = r.json()
        for k in ("period", "reference_date", "label", "date_from", "date_to", "total",
                  "by_status", "by_direction", "by_day", "by_boat",
                  "total_passengers", "total_guests", "items"):
            assert k in j, f"missing key {k}"
        for st in ("programmé", "en_cours", "terminé"):
            assert st in j["by_status"]
        for dr in ("aller", "retour"):
            assert dr in j["by_direction"]
        assert isinstance(j["items"], list)
        assert isinstance(j["by_day"], list)
        assert isinstance(j["by_boat"], list)

    def test_status_filter_only_returns_terminated(self, tokens):
        params = urlencode({"period": "day", "date": "2026-05-11", "status": "terminé"})
        r = requests.get(
            f"{API}/staff/traversees/history?{params}",
            headers=_hdr(tokens["admin"]),
        )
        assert r.status_code == 200
        j = r.json()
        assert j["status_filter"] == "terminé"
        # by_status counts only reflect filtered set
        assert j["by_status"]["programmé"] == 0
        assert j["by_status"]["en_cours"] == 0
        # every item must be 'terminé'
        for it in j["items"]:
            assert it["status"] == "terminé"


# ---------- PDF EXPORT ----------
class TestPdfExport:
    def test_pdf_is_valid_binary(self, tokens):
        r = requests.get(
            f"{API}/staff/traversees/history/report.pdf?period=day&date=2026-05-11",
            headers=_hdr(tokens["admin"]),
        )
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("application/pdf")
        assert r.content[:4] == b"%PDF", f"first bytes: {r.content[:8]!r}"
        assert len(r.content) > 1000  # PDF should be more than a kilobyte
        # filename in Content-Disposition
        cd = r.headers.get("content-disposition", "")
        assert "bbr-traversees-day-2026-05-11.pdf" in cd

    def test_pdf_week_and_month_succeed(self, tokens):
        for period, date in (("week", "2026-05-11"), ("month", "2026-05-15")):
            r = requests.get(
                f"{API}/staff/traversees/history/report.pdf?period={period}&date={date}",
                headers=_hdr(tokens["manager"]),
            )
            assert r.status_code == 200, f"{period}: {r.status_code}"
            assert r.content[:4] == b"%PDF"
            cd = r.headers.get("content-disposition", "")
            assert f"bbr-traversees-{period}-{date}.pdf" in cd

    def test_pdf_with_status_filter(self, tokens):
        params = urlencode({"period": "day", "date": "2026-05-11", "status": "terminé"})
        r = requests.get(
            f"{API}/staff/traversees/history/report.pdf?{params}",
            headers=_hdr(tokens["reception"]),
        )
        assert r.status_code == 200
        assert r.content[:4] == b"%PDF"

    def test_pdf_invalid_period_returns_400(self, tokens):
        r = requests.get(
            f"{API}/staff/traversees/history/report.pdf?period=invalid&date=2026-05-11",
            headers=_hdr(tokens["admin"]),
        )
        assert r.status_code == 400
