"""Capture screenshots of the Cantine module for the PDF training manual."""
import asyncio
import os
from playwright.async_api import async_playwright

BASE = "https://reserve-bbr.preview.emergentagent.com"
OUT = "/app/manual_assets/cantine"
ADMIN_EMAIL = "admin@boulay.ci"
ADMIN_PASSWORD = "Admin@2026"

os.makedirs(OUT, exist_ok=True)


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=["--no-sandbox"])
        ctx = await browser.new_context(viewport={"width": 1100, "height": 850})

        # ── PUBLIC SIDE ──
        page = await ctx.new_page()

        # 1. Landing — tab "Créer mon compte" (empty)
        await page.goto(f"{BASE}/cantine", wait_until="networkidle")
        await page.wait_for_timeout(1500)
        await page.screenshot(path=f"{OUT}/01_landing_register.png", full_page=False)
        print("✓ 01_landing_register.png")

        # 2. Registration form filled
        await page.fill('[data-testid="cantine-first-name"]', "Aminata")
        await page.fill('[data-testid="cantine-last-name"]', "Kouassi")
        # Service select
        sel = await page.query_selector('[data-testid="cantine-service"]')
        if sel:
            options = await sel.query_selector_all('option')
            for opt in options[1:]:
                val = await opt.get_attribute('value')
                if val and val.strip():
                    await sel.select_option(val)
                    break
        await page.fill('[data-testid="cantine-position"]', "Réceptionniste")
        await page.fill('[data-testid="cantine-phone"]', "+225 07 00 00 00 99")
        await page.wait_for_timeout(500)
        await page.screenshot(path=f"{OUT}/02_register_filled.png", full_page=False)
        print("✓ 02_register_filled.png")

        # 3. Submit and capture success
        await page.click('[data-testid="cantine-inscription-submit"]')
        await page.wait_for_timeout(2500)
        await page.screenshot(path=f"{OUT}/03_register_success.png", full_page=False)
        print("✓ 03_register_success.png")

        # Extract the generated code from the page
        try:
            code_el = await page.query_selector('[data-testid="cantine-generated-code"]')
            generated_code = (await code_el.inner_text()).strip() if code_el else None
        except Exception:
            generated_code = None
        print(f"  Generated code: {generated_code}")

        # 4. Switch to "Réserver mon repas" tab
        await page.click('[data-testid="cantine-tab-reserve"]')
        await page.wait_for_timeout(1500)
        await page.screenshot(path=f"{OUT}/04_reserve_landing.png", full_page=False)
        print("✓ 04_reserve_landing.png")

        # 5. Lookup user with the generated code (if any)
        if generated_code:
            await page.fill('[data-testid="cantine-reserve-code-input"]', generated_code)
            await page.click('[data-testid="cantine-reserve-lookup-btn"]')
            await page.wait_for_timeout(2000)
            await page.screenshot(path=f"{OUT}/05_reserve_user_found.png", full_page=False)
            print("✓ 05_reserve_user_found.png")
            # 6. Check the checkbox and capture before submit
            try:
                cb = await page.query_selector('[data-testid="cantine-reserve-checkbox"]')
                if cb:
                    await cb.check()
                    await page.wait_for_timeout(800)
                    await page.screenshot(path=f"{OUT}/06_reserve_confirmed.png", full_page=False)
                    print("✓ 06_reserve_confirmed.png")
            except Exception as e:
                print(f"  WARN checkbox: {e}")

        await page.close()

        # ── STAFF SIDE ──
        page = await ctx.new_page()
        await page.set_viewport_size({"width": 1280, "height": 900})
        await page.goto(f"{BASE}/staff/login", wait_until="domcontentloaded")
        await page.wait_for_selector('input[type="email"]', timeout=15000)
        await page.fill('input[type="email"]', ADMIN_EMAIL)
        await page.fill('input[type="password"]', ADMIN_PASSWORD)
        await page.click('button[type="submit"]')
        await page.wait_for_timeout(3500)

        # 7. Staff cantine dashboard
        await page.goto(f"{BASE}/staff/cantine", wait_until="networkidle")
        await page.wait_for_timeout(3000)
        await page.screenshot(path=f"{OUT}/07_staff_dashboard.png", full_page=False)
        print("✓ 07_staff_dashboard.png")

        # 8. Staff cantine pointage (tablet view)
        await page.goto(f"{BASE}/staff/cantine/pointage", wait_until="networkidle")
        await page.wait_for_timeout(2500)
        await page.screenshot(path=f"{OUT}/08_staff_pointage.png", full_page=False)
        print("✓ 08_staff_pointage.png")
        await page.close()

        await ctx.close()
        await browser.close()


asyncio.run(main())
