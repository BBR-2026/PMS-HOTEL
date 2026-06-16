"""Capture screenshots of the Team Planning module for the PDF training manual.

Run:  python3 scripts/capture_planning_screenshots.py

Output:
    /app/manual_assets/01_login.png
    /app/manual_assets/02_planning_chef.png
    /app/manual_assets/03_add_employee_modal.png
    /app/manual_assets/04_admin_planning.png
"""
import asyncio
import os
from playwright.async_api import async_playwright

BASE = "https://reserve-bbr.preview.emergentagent.com"
OUT = "/app/manual_assets"
CHEF_EMAIL = "chef.ressources.humaines@boulay.ci"
CHEF_PASSWORD = "VNJ0kabhSG"
ADMIN_EMAIL = "admin@boulay.ci"
ADMIN_PASSWORD = "Admin@2026"

os.makedirs(OUT, exist_ok=True)


async def login(page, email, password):
    await page.goto(f"{BASE}/staff/login", wait_until="networkidle")
    await page.wait_for_timeout(800)
    await page.fill('input[type="email"]', email)
    await page.fill('input[type="password"]', password)
    await page.click('button[type="submit"]')
    await page.wait_for_timeout(2500)


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=["--no-sandbox"])
        ctx = await browser.new_context(viewport={"width": 1280, "height": 800})

        # 1. Login screen (pre-filled with chef email so it's instructional)
        page = await ctx.new_page()
        await page.goto(f"{BASE}/staff/login", wait_until="networkidle")
        await page.wait_for_timeout(1500)
        await page.fill('input[type="email"]', CHEF_EMAIL)
        await page.fill('input[type="password"]', CHEF_PASSWORD)
        await page.screenshot(path=f"{OUT}/01_login.png", full_page=False)
        print("✓ 01_login.png")

        # 2. Chef view of planning grid (after login)
        await page.click('button[type="submit"]')
        await page.wait_for_timeout(3000)
        await page.goto(f"{BASE}/staff/planning", wait_until="networkidle")
        await page.wait_for_timeout(2500)
        await page.screenshot(path=f"{OUT}/02_planning_chef.png", full_page=False)
        print("✓ 02_planning_chef.png")

        # 3. Add employee modal (chef view)
        btns = await page.query_selector_all('button')
        for b in btns:
            try:
                txt = (await b.inner_text()).strip().lower()
                if "ajouter un employ" in txt:
                    await b.click(force=True)
                    break
            except Exception:
                pass
        await page.wait_for_timeout(1500)
        await page.screenshot(path=f"{OUT}/03_add_employee_modal.png", full_page=False)
        print("✓ 03_add_employee_modal.png")
        await page.close()

        # 4. Admin/RH view with KPI panel
        page = await ctx.new_page()
        await login(page, ADMIN_EMAIL, ADMIN_PASSWORD)
        # Larger viewport so the KPIs row fits on a single line in the screenshot
        await page.set_viewport_size({"width": 1280, "height": 900})
        await page.goto(f"{BASE}/staff/planning", wait_until="networkidle")
        await page.wait_for_timeout(2500)
        await page.screenshot(path=f"{OUT}/04_admin_planning.png", full_page=False)
        print("✓ 04_admin_planning.png")
        await page.close()

        await ctx.close()
        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
