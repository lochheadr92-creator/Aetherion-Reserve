"""Input UX + Staff Report Card:
- wheel zoom, select-mode left-drag pan, click-to-select preserved
- quick right-click cancels the active tool (toolbar syncs) or clears selection
- right-drag still pans without cancelling
- per-keeper report card counts work this cycle and resets on day rollover."""
import asyncio
import os
from playwright.async_api import async_playwright
from phase6_helpers import boot, build_park, acquire_and_place, click_tile

URL = os.environ.get("AETHERION_URL", "https://discovery-bio.preview.emergentagent.com")


async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        page = await browser.new_page(viewport={"width": 1920, "height": 950})
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)[:300]))
        await boot(page, URL)
        S = lambda expr: page.evaluate(expr)

        await build_park(page)
        await page.evaluate(
            """(() => { const s = window.__game.state;
                s.tick = Math.floor(s.tick / 1800) * 1800 + 500;
                s.weather = { type: 'clear', ticksLeft: 900000 };
            })()"""
        )
        await acquire_and_place(page, "veyra", 43, 33)

        # ensure Select tool
        await page.click('[data-testid="tool-select"]')
        await page.wait_for_timeout(150)

        # ---- TEST 1: mouse wheel zooms ----
        z0 = await S("window.__gameRenderer.cam.zoom")
        await page.mouse.move(960, 400)
        await page.mouse.wheel(0, -240)
        await page.wait_for_timeout(150)
        z1 = await S("window.__gameRenderer.cam.zoom")
        print("TEST 1 wheel zoom:", "PASS" if z1 > z0 else f"FAIL ({z0} -> {z1})")

        # ---- TEST 2: left-drag in Select mode pans the camera ----
        cam0 = await S("window.__gameRenderer.cam.x")
        await page.mouse.move(960, 400)
        await page.mouse.down()
        await page.mouse.move(1180, 470, steps=8)
        await page.mouse.up()
        await page.wait_for_timeout(150)
        cam1 = await S("window.__gameRenderer.cam.x")
        sel_after_drag = await S("window.__gameRenderer.selection")
        print("TEST 2a left-drag pans camera:", "PASS" if abs(cam1 - cam0) > 100 else f"FAIL ({cam0} -> {cam1})")
        print("TEST 2b drag does not select:", "PASS" if sel_after_drag is None else f"FAIL ({sel_after_drag})")

        # ---- TEST 3: plain left click still selects ----
        await page.evaluate("window.__gameRenderer.centerOn(43, 33)")
        await click_tile(page, 42, 32)  # empty tile inside enclosure A
        sel = await S("window.__gameRenderer.selection")
        ok3 = sel is not None and sel.get("kind") in ("enclosure", "creature")
        print("TEST 3 left click selects:", "PASS" if ok3 else f"FAIL ({sel})")

        # ---- TEST 4: quick right-click in Select mode clears the selection ----
        await page.mouse.click(960, 400, button="right")
        await page.wait_for_timeout(150)
        sel2 = await S("window.__gameRenderer.selection")
        print("TEST 4 right-click clears selection:", "PASS" if sel2 is None else f"FAIL ({sel2})")

        # ---- TEST 5: quick right-click cancels the active tool + toolbar syncs ----
        await page.click('[data-testid="cat-paths"]')
        await page.click('[data-testid="tool-path"]')
        await page.wait_for_timeout(150)
        mode0 = await S("window.__gameRenderer.tool.mode")
        await page.mouse.click(960, 400, button="right")
        await page.wait_for_timeout(200)
        mode1 = await S("window.__gameRenderer.tool.mode")
        active = await page.get_attribute('[data-testid="tool-select"]', "data-active")
        print("TEST 5a right-click cancels tool:", "PASS" if mode0 == "path" and mode1 == "select" else f"FAIL ({mode0} -> {mode1})")
        print("TEST 5b toolbar highlight synced:", "PASS" if active == "true" else f"FAIL (data-active={active})")

        # ---- TEST 6: right-DRAG pans without cancelling the tool ----
        await page.click('[data-testid="tool-path"]')
        await page.wait_for_timeout(150)
        camr0 = await S("window.__gameRenderer.cam.x")
        await page.mouse.move(960, 400)
        await page.mouse.down(button="right")
        await page.mouse.move(1120, 460, steps=8)
        await page.mouse.up(button="right")
        await page.wait_for_timeout(150)
        camr1 = await S("window.__gameRenderer.cam.x")
        moder = await S("window.__gameRenderer.tool.mode")
        print("TEST 6 right-drag pans, keeps tool:", "PASS" if abs(camr1 - camr0) > 80 and moder == "path" else f"FAIL (cam {camr0}->{camr1}, mode={moder})")
        await page.mouse.click(960, 400, button="right")  # back to select

        # ---- TEST 7: keeper report card counts feeds this cycle ----
        await page.click('[data-testid="open-staff-button"]')
        await page.wait_for_timeout(400)
        await page.click('[data-testid="hire-xenobiologist-button"]')
        await page.wait_for_timeout(250)
        await page.click('[data-testid="staff-close-button"]')
        await page.evaluate("window.__game.state.creatures[0].needs.hunger = 0.1")
        await page.click('[data-testid="hud-time-pause-button"]')  # unpause
        await page.click('[data-testid="hud-speed-3-button"]')
        fed = False
        for _ in range(90):
            await page.wait_for_timeout(500)
            if await S("(window.__game.state.staff[0].report && window.__game.state.staff[0].report.feeds) >= 1"):
                fed = True
                break
        print("TEST 7a report card counts feed:", "PASS" if fed else "FAIL")
        await page.click('[data-testid="hud-time-pause-button"]')  # pause
        await page.click('[data-testid="open-staff-button"]')
        await page.wait_for_timeout(400)
        sid = await S("window.__game.state.staff[0].id")
        line = await page.text_content(f'[data-testid="staff-report-{sid}"]')
        ok7b = line is not None and "fed" in line and "this cycle" in line and not line.strip().startswith("0 fed")
        print("TEST 7b report line rendered:", "PASS" if ok7b else f"FAIL ({line})")
        await page.click('[data-testid="staff-close-button"]')

        # ---- TEST 8: report card resets on the next cycle ----
        await page.evaluate(
            """(() => { const s = window.__game.state;
                s.creatures[0].needs.hunger = 1;
                s.tick = (Math.floor(s.tick / 1800) + 1) * 1800 - 5; })()"""
        )
        await page.click('[data-testid="hud-time-pause-button"]')  # unpause
        reset = False
        for _ in range(40):
            await page.wait_for_timeout(300)
            if await S("(() => { const st = window.__game.state.staff[0]; return !st.report || !st.report.feeds; })()"):
                reset = True
                break
        print("TEST 8 report resets on new cycle:", "PASS" if reset else "FAIL")

        print("PAGE ERRORS:", errors if errors else "none")
        await browser.close()


asyncio.run(main())
