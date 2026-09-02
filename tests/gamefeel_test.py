"""Game-feel pass: eased wheel zoom, pan release inertia, breach screen shake,
building placement pop + dust particles, and silent adoption on save/load."""
import asyncio
from playwright.async_api import async_playwright
from phase6_helpers import boot, build_park, click_tile

URL = "https://discovery-bio.preview.emergentagent.com"


async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        page = await browser.new_page(viewport={"width": 1920, "height": 950})
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)[:300]))
        await boot(page, URL)
        S = lambda expr: page.evaluate(expr)

        await build_park(page)
        await page.wait_for_timeout(600)  # let build_park placement pops settle

        # ---- TEST 1: wheel zoom eases toward a target (not instant) ----
        z0 = await S("window.__gameRenderer.cam.zoom")
        await page.mouse.move(960, 400)
        await page.mouse.wheel(0, -240)
        target_set = await S("window.__gameRenderer.fx.zoomTarget !== null")
        await page.wait_for_timeout(600)
        z1 = await S("window.__gameRenderer.cam.zoom")
        cleared = await S("window.__gameRenderer.fx.zoomTarget === null")
        print("TEST 1a zoom target engaged:", "PASS" if target_set else "FAIL")
        print("TEST 1b zoom converged + target cleared:", "PASS" if z1 > z0 and cleared else f"FAIL ({z0} -> {z1}, cleared={cleared})")

        # ---- TEST 2: fast pan release glides the camera (inertia) ----
        await page.click('[data-testid="tool-select"]')
        await page.mouse.move(700, 400)
        await page.mouse.down()
        await page.mouse.move(1250, 430, steps=4)  # fast fling
        await page.mouse.up()
        vel = await S("window.__gameRenderer.fx.panVel !== null")
        cam0 = await S("window.__gameRenderer.cam.x")
        await page.wait_for_timeout(350)
        cam1 = await S("window.__gameRenderer.cam.x")
        glided = abs(cam1 - cam0) > 8
        print("TEST 2a inertia velocity captured:", "PASS" if vel else "FAIL")
        print("TEST 2b camera glides after release:", "PASS" if glided else f"FAIL (moved {abs(cam1 - cam0):.1f}px)")

        # ---- TEST 3: mousedown stops the glide ----
        await page.mouse.move(960, 400)
        await page.mouse.down()
        stopped = await S("window.__gameRenderer.fx.panVel === null")
        await page.mouse.up()
        print("TEST 3 press cancels glide:", "PASS" if stopped else "FAIL")

        # ---- TEST 4: breach triggers a screen shake that decays ----
        await page.evaluate("window.__game.state.stats.breaches = (window.__game.state.stats.breaches || 0) + 1")
        await page.wait_for_timeout(120)
        mag = await S("window.__gameRenderer.fx.shakeMag")
        await page.wait_for_timeout(1500)
        mag_after = await S("window.__gameRenderer.fx.shakeMag")
        print("TEST 4a breach shakes the screen:", "PASS" if mag > 0.4 else f"FAIL (mag={mag})")
        print("TEST 4b shake decays to rest:", "PASS" if mag_after == 0 else f"FAIL (mag={mag_after})")

        # ---- TEST 5: placing a building pops + puffs dust ----
        # power relay needs no path adjacency; spot was flattened by build_park
        ent = await S("window.__game.state.entrance")
        bx, by = ent["x"] - 3, ent["y"] - 4
        await page.evaluate(f"window.__gameRenderer.centerOn({bx}, {by})")
        n0 = await S("window.__game.state.buildings.length")
        await page.click('[data-testid="cat-facilities"]')
        await page.click('[data-testid="building-power"]')
        await click_tile(page, bx, by)
        n1 = await S("window.__game.state.buildings.length")
        pops = await S("window.__gameRenderer.fx.pops.size")
        dust = await S("window.__gameRenderer.fx.particles.length")
        print("TEST 5a building placed + pop active:", "PASS" if n1 == n0 + 1 and pops >= 1 else f"FAIL (placed={n1 - n0}, pops={pops})")
        print("TEST 5b dust particles spawned:", "PASS" if dust > 0 else f"FAIL ({dust})")
        await page.wait_for_timeout(1300)
        pops2 = await S("window.__gameRenderer.fx.pops.size")
        dust2 = await S("window.__gameRenderer.fx.particles.length")
        print("TEST 5c pop + dust settle:", "PASS" if pops2 == 0 and dust2 == 0 else f"FAIL (pops={pops2}, dust={dust2})")

        # ---- TEST 6: loading a save adopts the world silently (no pops/shake) ----
        save = await page.evaluate("window.__game.saveGame('Gamefeel Test')")
        save_id = save["id"] if isinstance(save, dict) and "id" in save else await S("window.__game.saveId")
        await page.evaluate(f"window.__game.loadGame('{save_id}')")
        await page.wait_for_timeout(700)
        pops3 = await S("window.__gameRenderer.fx.pops.size")
        dust3 = await S("window.__gameRenderer.fx.particles.length")
        mag3 = await S("window.__gameRenderer.fx.shakeMag")
        ok6 = pops3 == 0 and dust3 == 0 and mag3 == 0
        print("TEST 6 load adopts silently:", "PASS" if ok6 else f"FAIL (pops={pops3}, dust={dust3}, mag={mag3})")
        await page.evaluate(f"window.__game.deleteSave('{save_id}')")

        print("PAGE ERRORS:", errors if errors else "none")
        await browser.close()


asyncio.run(main())
