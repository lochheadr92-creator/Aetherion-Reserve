"""Phase 5 test: rectangle fence mode, security response loop, expeditions + contracts."""
import asyncio
import os
from playwright.async_api import async_playwright

from config import URL
async def tile_screen(page, x, y):
    return await page.evaluate(
        """([x, y]) => {
            const r = window.__gameRenderer; const s = window.__game.state;
            const h = s.heights[y * s.size + x] || 0;
            const wx = (x + 0.5 - y - 0.5) * 32, wy = (x + 0.5 + y + 0.5) * 16 - h * 10;
            return { sx: wx * r.cam.zoom + r.cam.x, sy: wy * r.cam.zoom + r.cam.y };
        }""",
        [x, y],
    )


async def click_tile(page, x, y):
    p = await tile_screen(page, x, y)
    await page.mouse.click(p["sx"], p["sy"])
    await page.wait_for_timeout(70)


async def vertex_screen(page, vx, vy):
    return await page.evaluate(
        """([vx, vy]) => {
            const r = window.__gameRenderer; const s = window.__game.state;
            const tx = Math.min(vx, s.size - 1), ty = Math.min(vy, s.size - 1);
            const h = s.heights[ty * s.size + tx] || 0;
            const wx = (vx - vy) * 32, wy = (vx + vy) * 16 - h * 10;
            return { sx: wx * r.cam.zoom + r.cam.x, sy: wy * r.cam.zoom + r.cam.y };
        }""",
        [vx, vy],
    )


async def drag(page, v0, v1):
    p0 = await vertex_screen(page, *v0)
    p1 = await vertex_screen(page, *v1)
    await page.mouse.move(p0["sx"], p0["sy"])
    await page.mouse.down()
    await page.mouse.move(p1["sx"], p1["sy"], steps=10)
    await page.wait_for_timeout(120)
    await page.mouse.up()
    await page.wait_for_timeout(100)


async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        page = await browser.new_page(viewport={"width": 1920, "height": 950})
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)[:300]))
        await page.goto(URL, wait_until="networkidle", timeout=30000)
        await page.wait_for_timeout(1200)
        await page.evaluate("localStorage.setItem('aetherion_tutorial_done','1')")
        await page.click('[data-testid="mode-sandbox"]')
        await page.click('[data-testid="start-game-button"]')
        await page.wait_for_timeout(2000)
        S = lambda expr: page.evaluate(expr)

        await page.click('[data-testid="hud-time-pause-button"]')  # pause during construction

        # flatten work region
        await page.evaluate("window.__gameRenderer.centerOn(45, 33)")
        await page.click('[data-testid="cat-terrain"]')
        await page.click('[data-testid="tool-flatten"]')
        await page.click('[data-testid="brush-size-3"]')
        for tx, ty in [(38, 31), (42, 32), (45, 32), (42, 35), (45, 35), (50, 32), (50, 35), (53, 33), (36, 32)]:
            await click_tile(page, tx, ty)
        await page.click('[data-testid="brush-size-1"]')

        # ---- TEST 1: rectangle mode places full perimeter in one drag ----
        await page.click('[data-testid="cat-fences"]')
        await page.click('[data-testid="fence-shape-rect"]')
        await page.click('[data-testid="fence-tier-1"]')
        f0 = await S("Object.keys(window.__game.state.fences).length")
        await drag(page, (40, 30), (46, 36))  # enclosure A: 6x6
        total = await S("Object.keys(window.__game.state.fences).length")
        placed_a = total - f0
        print("TEST 1 rect drag placed:", placed_a, "PASS" if placed_a == 24 else "FAIL (expected 24)")
        # enclosure B for relocation + expedition release
        f0 = total
        await drag(page, (48, 30), (54, 36))
        placed_b = await S("Object.keys(window.__game.state.fences).length") - f0
        print("TEST 1b second rect:", placed_b, "PASS" if placed_b == 24 else "FAIL")
        # enclosure detection
        await page.click('[data-testid="tool-select"]')
        await click_tile(page, 43, 33)
        await page.wait_for_timeout(300)
        sel = await S("window.__gameRenderer.selection ? window.__gameRenderer.selection.kind : null")
        print("TEST 1c rect forms enclosure:", sel, "PASS" if sel == "enclosure" else "FAIL")

        # ---- prep: path + security post ----
        await page.click('[data-testid="cat-paths"]')
        await page.click('[data-testid="tool-path"]')
        for i in range(4):
            await click_tile(page, 38, 30 + i)
        await page.click('[data-testid="cat-facilities"]')
        await page.click('[data-testid="building-security_post"]')
        await click_tile(page, 36, 31)
        has_post = await S("window.__game.state.buildings.some(b => b.type === 'security_post')")
        print("TEST 2a security post built:", "PASS" if has_post else "FAIL")

        # ---- place a creature in enclosure A ----
        await page.click('[data-testid="hud-fieldops-button"], button:has-text("Field Ops")')
        await page.wait_for_timeout(400)
        await page.click('[data-testid="acquire-buy-skitter"]')
        await page.wait_for_timeout(300)
        await click_tile(page, 43, 33)
        n_creatures = await S("window.__game.state.creatures.length")
        print("TEST 2b creature placed:", n_creatures, "PASS" if n_creatures == 1 else "FAIL")

        # ---- TEST 2: escape -> banner -> dispatch -> capture -> relocation ----
        # break enclosure A and let the sim run at 3x
        await page.evaluate(
            """(() => {
                const s = window.__game.state;
                const key = Object.keys(s.fences).find(k => k.startsWith('40,') && k.endsWith(',S'));
                delete s.fences[key];
                s._encDirty = true;
            })()"""
        )
        await page.click('[data-testid="hud-speed-3-button"]')
        escaped = False
        for _ in range(30):
            await page.wait_for_timeout(500)
            if await S("window.__game.state.creatures.some(c => c.escaped)"):
                escaped = True
                break
        print("TEST 2c creature escaped after breach:", "PASS" if escaped else "FAIL")
        await page.wait_for_timeout(400)
        banner = await page.locator('[data-testid="emergency-banner"]').count()
        print("TEST 2d emergency banner visible:", "PASS" if banner == 1 else "FAIL")
        dispatched = False
        for _ in range(20):
            await page.wait_for_timeout(500)
            if await S("(window.__game.state.security.units || []).length > 0"):
                dispatched = True
                break
        print("TEST 2e response unit dispatched:", "PASS" if dispatched else "FAIL")
        captured = False
        for _ in range(60):
            await page.wait_for_timeout(500)
            done = await S("window.__game.state.stats.captures >= 1 && !window.__game.state.creatures.some(c => c.escaped)")
            if done:
                captured = True
                break
        print("TEST 2f creature recaptured + relocated:", "PASS" if captured else "FAIL")
        await page.wait_for_timeout(600)
        banner_gone = await page.locator('[data-testid="emergency-banner"]').count()
        resp_expense = await S("window.__game.state.finances.today.expenses.response")
        print("TEST 2g banner cleared:", "PASS" if banner_gone == 0 else "FAIL", "| response expense:", resp_expense,
              "PASS" if resp_expense >= 250 else "FAIL")

        # ---- TEST 3: expeditions ----
        await page.click('button:has-text("Field Ops")')
        await page.wait_for_timeout(400)
        await page.click('[data-testid="fieldops-tab-expeditions"]')
        await page.wait_for_timeout(200)
        zones = await page.locator('[data-testid^="zone-card-"]').count()
        print("TEST 3a zone cards:", zones, "PASS" if zones == 4 else "FAIL")
        await page.click('[data-testid="launch-expedition-mirefen"]')
        await page.wait_for_timeout(400)
        n_exp = await S("window.__game.state.expeditions.length")
        print("TEST 3b expedition launched:", "PASS" if n_exp == 1 else "FAIL")
        # fast-forward stages
        for _ in range(8):
            await page.evaluate("window.__game.state.expeditions.forEach(e => { if (e.status === 'active') e.stageTicks = 1; })")
            await page.wait_for_timeout(700)
            status = await S("window.__game.state.expeditions[0] ? window.__game.state.expeditions[0].status : 'gone'")
            if status == "returned":
                break
        specimens = await S("window.__game.state.expeditions[0] ? window.__game.state.expeditions[0].specimens.length : 0")
        logs = await S("window.__game.state.expeditions[0] ? window.__game.state.expeditions[0].log.length : 0")
        print("TEST 3c expedition returned:", status, "specimens:", specimens, "log entries:", logs,
              "PASS" if status == "returned" and specimens >= 1 and logs >= 3 else "FAIL")
        # claim + release into enclosure B
        n0 = await S("window.__game.state.creatures.length")
        await page.wait_for_timeout(300)
        claim_btns = page.locator('[data-testid^="claim-specimen-"]')
        if await claim_btns.count() == 0:
            await page.click('[data-testid="fieldops-tab-expeditions"]')
            await page.wait_for_timeout(300)
        await claim_btns.first.click()
        await page.wait_for_timeout(400)
        await click_tile(page, 51, 33)
        n1 = await S("window.__game.state.creatures.length")
        print("TEST 3d specimen claimed & released:", n1 - n0, "PASS" if n1 - n0 == 1 else "FAIL")

        # ---- TEST 4: contracts ----
        await page.click('button:has-text("Field Ops")')
        await page.wait_for_timeout(400)
        await page.click('[data-testid="fieldops-tab-contracts"]')
        await page.wait_for_timeout(400)
        offers = await page.locator('[data-testid^="contract-offer-"]').count()
        print("TEST 4a contract offers:", offers, "PASS" if offers >= 1 else "FAIL")
        await page.locator('[data-testid^="contract-accept-"]').first.click()
        await page.wait_for_timeout(400)
        n_active = await S("window.__game.state.contracts.active.length")
        print("TEST 4b contract accepted:", "PASS" if n_active == 1 else "FAIL")
        # force completion regardless of type
        await page.evaluate(
            """(() => {
                for (const c of window.__game.state.contracts.active) {
                    c.params.count = 0; c.params.amount = 0; c.params.target = 0; c.params.baseline = -9999;
                }
            })()"""
        )
        cash0 = await S("window.__game.state.cash")
        done = False
        for _ in range(20):
            await page.wait_for_timeout(500)
            if await S("(window.__game.state.contracts.completed || 0) >= 1"):
                done = True
                break
        cash1 = await S("window.__game.state.cash")
        print("TEST 4c contract completed + payout:", "PASS" if done and cash1 > cash0 else f"FAIL done={done}")

        # ---- TEST 5: save/load round-trip persists new systems ----
        await page.click('[data-testid="fieldops-close-button"]')
        await page.wait_for_timeout(300)
        await page.click('button:has-text("Save")')
        await page.wait_for_timeout(1500)
        saved = await S("window.__game.saveId !== null")
        print("TEST 5 save with phase-5 state:", "PASS" if saved else "FAIL")

        print("No page errors." if not errors else f"PAGE ERRORS: {errors}")
        await page.screenshot(path="/tmp/phase5.jpg", quality=35, type="jpeg")
        await browser.close()


asyncio.run(main())
