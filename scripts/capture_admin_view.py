"""Capture just the admin/HR planning view."""
import asyncio
from playwright.async_api import async_playwright

BASE = "https://reserve-bbr.preview.emergentagent.com"
OUT = "/app/manual_assets"


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=["--no-sandbox"])
        ctx = await browser.new_context(viewport={"width": 1280, "height": 900})
        page = await ctx.new_page()
        await page.goto(f"{BASE}/staff/login", wait_until="domcontentloaded")
        await page.wait_for_selector('input[type="email"]', timeout=15000)
        await page.fill('input[type="email"]', "admin@boulay.ci")
        await page.fill('input[type="password"]', "Admin@2026")
        await page.click('button[type="submit"]')
        await page.wait_for_timeout(3500)
        await page.goto(f"{BASE}/staff/planning", wait_until="networkidle")
        await page.wait_for_timeout(3000)
        await page.screenshot(path=f"{OUT}/04_admin_planning.png", full_page=False)
        print("✓ 04_admin_planning.png")
        await browser.close()


asyncio.run(main())
