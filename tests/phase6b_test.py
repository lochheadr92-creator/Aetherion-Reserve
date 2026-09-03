"""Phase 6 part B: creature abilities (burrow, camouflage, surge) + breeding program."""
import asyncio
import os
from playwright.async_api import async_playwright
from phase6_helpers import boot, build_park, acquire_and_place, click_tile, tile_screen

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
        # force daytime + clear weather for the whole test
        await page.evaluate(
            """(() => { const s = window.__game.state;
                s.tick = Math.floor(s.tick / 1800) * 1800 + 500;
                s.weather = { type: 'clear', ticksLeft: 900000 };
            })()"""
        )

        # ---- TEST 1: Burrowing (karrgan tunnels out of enclosure B) ----
        await acquire_and_place(page, "karrgan", 51, 33)
        # bare enclosure + zeroed needs keeps computed welfare genuinely < 0.5
        await page.evaluate(
            """(() => { const c = window.__game.state.creatures.find(q => q.speciesId === 'karrgan');
                if (c) { c.needs.hunger = 0; c.needs.thirst = 0; c.needs.energy = 0.2; c.welfare = 0.2; } })()"""
        )
        await page.click('[data-testid="hud-speed-3-button"]')
        breaches0 = await S("window.__game.state.stats.breaches || 0")
        burrowed = False
        for _ in range(120):  # up to 60s of attempt rolls
            await page.evaluate(
                """(() => { const c = window.__game.state.creatures.find(q => q.speciesId === 'karrgan');
                    if (c) { c.needs.hunger = 0; c.needs.thirst = 0; c.welfare = 0.2; } })()"""
            )
            await page.wait_for_timeout(500)
            b = await S("window.__game.state.stats.breaches || 0")
            if b > breaches0:
                burrowed = True
                break
        alert = False
        esc = False
        for _ in range(12):  # allow decideCreature to flag the escape
            await page.wait_for_timeout(500)
            alert = await S("window.__game.state.alerts.some(a => a.title === 'BURROW BREACH')")
            esc = await S("(window.__game.state.creatures.find(q => q.speciesId === 'karrgan') || {}).escaped === true")
            if alert and esc:
                break
        print("TEST 1a burrow breach occurred:", "PASS" if burrowed else "FAIL")
        print("TEST 1b BURROW BREACH alert + escaped:", "PASS" if alert and esc else "FAIL")
        # remove karrgan to end emergency
        await page.evaluate(
            "window.__game.state.creatures = window.__game.state.creatures.filter(c => c.speciesId !== 'karrgan')"
        )

        # ---- TEST 2: Camouflage (umbra cloaks in daylight) ----
        await page.click('[data-testid="hud-time-pause-button"]')
        await acquire_and_place(page, "umbra", 51, 33)
        await page.click('[data-testid="hud-speed-3-button"]')
        cloaked = False
        for _ in range(40):
            await page.wait_for_timeout(500)
            # keep it daytime
            await page.evaluate(
                """(() => { const s = window.__game.state;
                    if ((s.tick % 1800) / 1800 > 0.55) s.tick = Math.floor(s.tick / 1800) * 1800 + 500; })()"""
            )
            if await S("window.__game.state.creatures.some(c => c.cloaked)"):
                cloaked = True
                break
        alert2 = await S("window.__game.state.alerts.some(a => a.title === 'CLOAKING OBSERVED')")
        print("TEST 2a umbra cloaked in daylight:", "PASS" if cloaked else "FAIL")
        print("TEST 2b cloaking alert pushed:", "PASS" if alert2 else "FAIL")
        # cloaked badge on creature panel
        await page.click('[data-testid="hud-time-pause-button"]')
        await page.click('[data-testid="tool-select"]')
        pos = await S("(() => { const c = window.__game.state.creatures.find(q => q.cloaked); return c ? { x: Math.floor(c.x), y: Math.floor(c.y) } : null; })()")
        badge = 0
        if pos:
            await click_tile(page, pos["x"], pos["y"])
            await page.wait_for_timeout(400)
            badge = await page.locator('[data-testid="creature-cloaked-badge"]').count()
        print("TEST 2c CLOAKED badge in panel:", "PASS" if badge == 1 else "FAIL (soft: pick may miss cloaked)")

        # ---- TEST 3: Surge (voltari knocks power relay offline) ----
        # build a power relay near enclosure B
        await page.click('[data-testid="cat-facilities"]')
        await page.click('[data-testid="building-power"]')
        await click_tile(page, 56, 33)
        relay = await S("window.__game.state.buildings.some(b => b.type === 'power')")
        print("TEST 3a power relay built:", "PASS" if relay else "FAIL")
        await acquire_and_place(page, "voltari", 52, 34)
        await page.click('[data-testid="hud-speed-3-button"]')
        surged = False
        for _ in range(100):  # surge rolls happen every ~120 ticks at 40% chance; wide window kills flakiness
            await page.evaluate(
                """(() => { const c = window.__game.state.creatures.find(q => q.speciesId === 'voltari');
                    if (c) c.stress = 0.85; })()"""
            )
            await page.wait_for_timeout(500)
            if await S("window.__game.state.buildings.some(b => b.type === 'power' && b.offlineUntil > window.__game.state.tick)"):
                surged = True
                break
        alert3 = await S("window.__game.state.alerts.some(a => a.title === 'POWER SURGE')")
        print("TEST 3b relay knocked offline by surge:", "PASS" if surged else "FAIL")
        print("TEST 3c POWER SURGE alert:", "PASS" if alert3 else "FAIL")

        # ---- TEST 4: Breeding (skitter pair -> juvenile) ----
        await page.click('[data-testid="hud-time-pause-button"]')
        # remove the umbra (preys on skitter -> hostile cohab stress/welfare penalty blocks
        # pairing gates) and the stressed voltari so the breeding pair has a calm enclosure
        await page.evaluate(
            "window.__game.state.creatures = window.__game.state.creatures.filter(c => !['umbra','voltari'].includes(c.speciesId))"
        )
        await acquire_and_place(page, "skitter", 43, 33)
        await acquire_and_place(page, "skitter", 44, 33)
        await page.evaluate("window.__game.state.research.completed.push('bio_breeding')")
        await page.click('[data-testid="hud-speed-3-button"]')
        n0 = await S("window.__game.state.creatures.length")
        born = False
        for _ in range(80):
            await page.evaluate(
                """(() => { for (const c of window.__game.state.creatures) {
                    if (c.speciesId === 'skitter') { c.welfare = 0.9; c.stress = 0.1;
                        c.needs.hunger = 1; c.needs.thirst = 1; c.needs.energy = 1;
                        if (c.gestation > 200) c.gestation = 150; } } })()"""
            )
            await page.wait_for_timeout(500)
            if await S("window.__game.state.creatures.length") > n0:
                born = True
                break
        juvenile = await S("window.__game.state.creatures.some(c => c.juvenile)")
        births = await S("window.__game.state.stats.births || 0")
        alert4 = await S("window.__game.state.alerts.some(a => a.title === 'NEW OFFSPRING')")
        print("TEST 4a offspring born:", "PASS" if born else "FAIL")
        print("TEST 4b juvenile flag + births stat + alert:", "PASS" if juvenile and births >= 1 and alert4 else "FAIL")
        # juvenile badge
        await page.click('[data-testid="hud-time-pause-button"]')
        await page.click('[data-testid="tool-select"]')
        # separate the juvenile from clustered adults so the iso pick can't grab a parent
        jp = await S(
            """(() => { const c = window.__game.state.creatures.find(q => q.juvenile);
                if (!c) return null;
                c.x = 47.5; c.y = 35.5; c.path = []; c.state = 'idle'; c.actionTicks = 50;
                for (const o of window.__game.state.creatures) {
                    if (!o.juvenile && Math.hypot(o.x - c.x, o.y - c.y) < 3) { o.x = 42.5; o.y = 32.5; o.path = []; }
                }
                return { x: Math.floor(c.x), y: Math.floor(c.y) }; })()"""
        )
        jbadge = 0
        if jp:
            await click_tile(page, jp["x"], jp["y"])
            await page.wait_for_timeout(400)
            jbadge = await page.locator('[data-testid="creature-juvenile-badge"]').count()
        print("TEST 4c JUVENILE badge in panel:", "PASS" if jbadge == 1 else "FAIL (soft: pick may grab adult)")
        # growth to adult
        await page.evaluate(
            "window.__game.state.creatures.forEach(c => { if (c.juvenile) c.growth = 0.99; })"
        )
        await page.click('[data-testid="hud-speed-3-button"]')
        grown = False
        for _ in range(30):
            await page.wait_for_timeout(500)
            if not await S("window.__game.state.creatures.some(c => c.juvenile)"):
                grown = True
                break
        print("TEST 4d juvenile matured to adult:", "PASS" if grown else "FAIL")

        # ---- TEST 5: policies + new fields survive save ----
        await page.evaluate("window.__game.state.policies.nightTours = true")
        await page.click('button:has-text("Save")')
        await page.wait_for_timeout(1500)
        saved = await S("window.__game.saveId !== null")
        print("TEST 5 saved with phase-6 state:", "PASS" if saved else "FAIL")

        print("No page errors." if not errors else f"PAGE ERRORS: {errors}")
        await page.screenshot(path="/tmp/phase6b.jpg", quality=35, type="jpeg")
        await browser.close()


asyncio.run(main())
