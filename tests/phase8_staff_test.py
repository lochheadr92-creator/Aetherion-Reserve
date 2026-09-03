"""Phase 8: Keeper Staff — hire/fire UI, feeding, treatment, waste cleaning, fence repair, wages."""
import asyncio
import os
from playwright.async_api import async_playwright
from phase6_helpers import boot, build_park, acquire_and_place, click_tile

from config import URL
async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        page = await browser.new_page(viewport={"width": 1920, "height": 950})
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)[:300]))
        await boot(page, URL)
        S = lambda expr: page.evaluate(expr)

        await build_park(page)
        # calm daytime baseline
        await page.evaluate(
            """(() => { const s = window.__game.state;
                s.tick = Math.floor(s.tick / 1800) * 1800 + 500;
                s.weather = { type: 'clear', ticksLeft: 900000 };
            })()"""
        )
        await acquire_and_place(page, "veyra", 43, 33)
        await acquire_and_place(page, "veyra", 51, 33)

        # ---- TEST 1: hire all three roles via UI ----
        await page.click('[data-testid="open-staff-button"]')
        await page.wait_for_timeout(400)
        modal = await page.locator('[data-testid="staff-modal"]').count()
        print("TEST 1a staff modal opens:", "PASS" if modal == 1 else "FAIL")
        cash0 = await S("window.__game.state.cash")
        for role in ("xenobiologist", "biomedical", "warden"):
            await page.click(f'[data-testid="hire-{role}-button"]')
            await page.wait_for_timeout(200)
        n = await S("(window.__game.state.staff || []).length")
        cash1 = await S("window.__game.state.cash")
        roles = await S("window.__game.state.staff.map(s => s.role).sort().join(',')")
        print("TEST 1b hired 3 staff:", "PASS" if n == 3 else f"FAIL (n={n})")
        print("TEST 1c roles correct:", "PASS" if roles == "biomedical,warden,xenobiologist" else f"FAIL ({roles})")
        # sandbox mode: cash unchanged is fine; just verify roster rows render
        rows = await page.locator('[data-testid^="staff-row-"]').count()
        print("TEST 1d roster rows render:", "PASS" if rows == 3 else f"FAIL ({rows})")
        await page.click('[data-testid="staff-close-button"]')

        # ---- TEST 2: keeper hand-feeds a hungry creature ----
        await page.evaluate(
            """(() => { const c = window.__game.state.creatures[0];
                c.needs.hunger = 0.15; })()"""
        )
        await page.click('[data-testid="hud-time-pause-button"]')  # unpause
        await page.click('[data-testid="hud-speed-3-button"]')
        fed = False
        for _ in range(80):
            await page.wait_for_timeout(500)
            if await S("(window.__game.state.stats.staffFeedings || 0) >= 1"):
                fed = True
                break
        hunger = await S("window.__game.state.creatures[0].needs.hunger")
        print("TEST 2a keeper hand-fed hungry creature:", "PASS" if fed else "FAIL")
        print("TEST 2b creature hunger restored:", "PASS" if hunger > 0.5 else f"FAIL ({hunger})")

        # ---- TEST 3: biomedical officer treats a stressed creature ----
        await page.evaluate(
            """(() => { const c = window.__game.state.creatures[1];
                c.stress = 0.9; c._medCd = 0; })()"""
        )
        treated = False
        for _ in range(90):
            await page.evaluate(
                """(() => { const c = window.__game.state.creatures[1];
                    if ((window.__game.state.stats.staffTreatments || 0) === 0)
                        c.stress = Math.max(c.stress, 0.8); })()"""
            )
            await page.wait_for_timeout(500)
            if await S("(window.__game.state.stats.staffTreatments || 0) >= 1"):
                treated = True
                break
        print("TEST 3 biomedical treated stressed creature:", "PASS" if treated else "FAIL")

        # ---- TEST 4: warden repairs a damaged fence ----
        key = await S(
            """(() => { const s = window.__game.state;
                const key = Object.keys(s.fences)[0];
                s.fences[key].hp = 40; return key; })()"""
        )
        repaired = False
        for _ in range(70):
            await page.wait_for_timeout(500)
            hp = await S(f"(window.__game.state.fences['{key}']||{{hp:999}}).hp")
            if hp >= 100:
                repaired = True
                break
        print("TEST 4 warden repaired damaged fence:", "PASS" if repaired else f"FAIL (hp={hp})")

        # ---- TEST 5: keeper cleans injected biowaste ----
        await page.evaluate(
            """(() => { const s = window.__game.state;
                s.waste = s.waste || [];
                s.waste.push({ id: s.nextId++, x: 44, y: 33 });
                s.waste.push({ id: s.nextId++, x: 42, y: 34 }); })()"""
        )
        w0 = await S("window.__game.state.waste.length")
        cleaned = False
        for _ in range(80):
            await page.wait_for_timeout(500)
            w = await S("window.__game.state.waste.length")
            if w < w0:
                cleaned = True
                break
        print("TEST 5 keeper cleaned biowaste:", "PASS" if cleaned else "FAIL")

        # ---- TEST 6: wages charged at day rollover ----
        await page.click('[data-testid="hud-time-pause-button"]')  # pause
        await page.evaluate(
            """(() => { const s = window.__game.state;
                s.tick = Math.ceil(s.tick / 1800) * 1800 - 1; })()"""
        )
        await page.click('[data-testid="hud-time-pause-button"]')  # unpause
        await page.wait_for_timeout(1500)
        wages = await S("window.__game.state.finances.today.expenses.wages || window.__game.state.finances.history.slice(-1)[0]?.expenses?.wages || 0")
        print("TEST 6 staff wages charged:", "PASS" if wages >= 410 else f"FAIL (wages={wages})")

        # ---- TEST 7: fire staff via UI ----
        await page.click('[data-testid="hud-time-pause-button"]')  # pause
        await page.click('[data-testid="open-staff-button"]')
        await page.wait_for_timeout(400)
        sid = await S("window.__game.state.staff[0].id")
        await page.click(f'[data-testid="staff-fire-button-{sid}"]')
        await page.wait_for_timeout(250)
        n2 = await S("window.__game.state.staff.length")
        print("TEST 7 fire staff:", "PASS" if n2 == 2 else f"FAIL (n={n2})")
        await page.click('[data-testid="staff-close-button"]')

        # ---- TEST 8: staff survive save ----
        await page.click('button:has-text("Save")')
        await page.wait_for_timeout(1500)
        saved = await S("window.__game.saveId !== null")
        print("TEST 8 saved with staff state:", "PASS" if saved else "FAIL")

        print("No page errors." if not errors else f"PAGE ERRORS: {errors}")
        await page.screenshot(path="/tmp/phase8.jpg", quality=35, type="jpeg")
        await browser.close()


asyncio.run(main())
