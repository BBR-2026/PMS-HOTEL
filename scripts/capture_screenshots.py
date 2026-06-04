"""Capture all screenshots needed for the BBR presentation PDF.

Runs Playwright headless against the preview URL, logs in as admin where
needed, and saves PNGs to /tmp/bbr_screens. Idempotent: it overrides any
previous run. Best effort — missing screenshots are simply omitted from the
final PDF rather than blocking the whole build.
"""
import asyncio
import os
import sys
from pathlib import Path

from playwright.async_api import async_playwright

BASE = os.environ.get("BBR_BASE_URL", "https://reserve-bbr.preview.emergentagent.com")
OUT = Path("/tmp/bbr_screens")
OUT.mkdir(parents=True, exist_ok=True)

PUBLIC_PAGES = [
    ("01_landing.png", "/", 2000),
    ("02_pole_beachclub.png", "/pole/beach_club", 1500),
    ("03_pole_hebergement.png", "/pole/hebergement", 1500),
    ("04_pole_corporate.png", "/pole/corporate", 1500),
    ("05_pole_activites.png", "/pole/activites_events", 1500),
    ("06_pole_kaai.png", "/pole/le_kaai", 1500),
    ("07_booking_pass_day.png", "/booking/pass_day", 2200),
    ("08_event_detail.png", "/event/a9119968-09d6-4688-85c8-2915784b3a44", 2200),
    ("09_gallery.png", "/galerie", 1800),
    ("10_corporate_form.png", "/corporate/seminaire", 1500),
    ("11_enregistrement.png", "/accueil/enregistrement", 1500),
    ("12_wifi.png", "/accueil/wifi", 1500),
]

# Staff pages need an authenticated context (cookies set via /staff/login).
STAFF_PAGES = [
    ("20_staff_dashboard.png", "/staff", 1800),
    ("21_staff_reservations.png", "/staff/reservations", 1800),
    ("22_staff_payments.png", "/staff/paiements", 1500),
    ("23_staff_clients.png", "/staff/clients", 1500),
    ("24_staff_hebergement.png", "/staff/hebergement", 1800),
    ("25_staff_kaai.png", "/staff/le-kaai", 1800),
    ("26_staff_embarquement.png", "/staff/embarquement", 1500),
    ("27_staff_scanner.png", "/staff/scanner", 1300),
    ("28_staff_activites.png", "/staff/activites", 1500),
    ("29_staff_revenue.png", "/staff/revenue", 1800),
    ("30_staff_receipts.png", "/staff/recus", 1500),
    ("31_staff_events.png", "/staff/evenements-speciaux", 1500),
    ("32_staff_corporate.png", "/staff/corporate", 1500),
    ("33_staff_registrations.png", "/staff/enregistrements", 1500),
    ("34_staff_gallery.png", "/staff/galerie", 1500),
    ("35_staff_notifications.png", "/staff/notifications", 1500),
    ("36_staff_config.png", "/staff/configuration", 1500),
    ("37_staff_feedback.png", "/staff/feedback", 1500),
]


async def capture_one(page, name, path, wait):
    try:
        await page.goto(f"{BASE}{path}", wait_until="domcontentloaded", timeout=20000)
        await page.wait_for_timeout(wait)
        target = OUT / name
        await page.screenshot(path=str(target), full_page=False, type="png")
        print(f"  ✓ {name}")
    except Exception as ex:
        print(f"  ✗ {name} — {ex}")


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        ctx = await browser.new_context(viewport={"width": 1440, "height": 900})
        page = await ctx.new_page()

        print("=== PUBLIC ===")
        for name, path, wait in PUBLIC_PAGES:
            await capture_one(page, name, path, wait)

        print("=== STAFF LOGIN ===")
        try:
            await page.goto(f"{BASE}/staff/login", wait_until="domcontentloaded", timeout=20000)
            await page.wait_for_timeout(1500)
            await page.fill('input[type="email"]', "admin@boulay.ci")
            await page.fill('input[type="password"]', "Admin@2026")
            await page.click('button[type="submit"]')
            await page.wait_for_timeout(2500)
            print("  ✓ logged in")
        except Exception as ex:
            print(f"  ✗ login failed — {ex}")

        print("=== STAFF ===")
        for name, path, wait in STAFF_PAGES:
            await capture_one(page, name, path, wait)

        await browser.close()
        print(f"\nDone. Files in {OUT}")


if __name__ == "__main__":
    asyncio.run(main())
