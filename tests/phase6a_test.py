"""Phase 6 part A: Night Tours premium economy + Guest Panic stampede."""
import asyncio
from playwright.async_api import async_playwright
from phase6_helpers import boot, build_park, acquire_and_place, click_tile, drag

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
        await acquire_and_place(page, "skitter", 43, 33)
        await acquire_and_place(page, "skitter", 44, 33)

        # ---- TEST 1: Night Tours toggle + premium income ----
        await page.click('button:has-text("Finances")')
        await page.wait_for_timeout(400)
        await page.click('[data-testid="night-tours-toggle"]')
        await page.wait_for_timeout(200)
        enabled = await S("window.__game.state.policies.nightTours")
        print("TEST 1a night tours toggled on:", "PASS" if enabled else "FAIL")
        await page.click('[data-testid="finances-close-button"]')
        # force night + clear weather
        await page.evaluate(
            """(() => { const s = window.__game.state;
                s.tick = Math.floor(s.tick / 1800) * 1800 + 1400;
                s.weather = { type: 'clear', ticksLeft: 90000 };
            })()"""
        )
        await page.click('[data-testid="hud-speed-3-button"]')
        tours = 0
        for _ in range(40):
            await page.wait_for_timeout(500)
            tours = await S("window.__game.state.finances.today.income.tours || 0")
            if tours > 0:
                break
        night_guest = await S("window.__game.state.guests.some(g => g.nightTour)")
        ticket = await S("window.__game.state.ticketPrice")
        print(f"TEST 1b night tour premium income: \u25c8{tours} (ticket {ticket})",
              "PASS" if tours > 0 and tours >= ticket * 1.5 else "FAIL")
        print("TEST 1c night-tour guests flagged:", "PASS" if night_guest else "FAIL")

        # wait for a few guests then trigger emergency
        for _ in range(20):
            await page.wait_for_timeout(400)
            if await S("window.__game.state.guests.length >= 3"):
                break
        n_guests = await S("window.__game.state.guests.length")

        # ---- TEST 2: Guest Panic stampede ----
        await page.click('[data-testid="hud-time-pause-button"]')  # pause to set up
        await acquire_and_place(page, "karrgan", 51, 33)  # danger 5 apex in enclosure B
        placed = await S("window.__game.state.creatures.some(c => c.speciesId === 'karrgan')")
        print("TEST 2a karrgan placed:", "PASS" if placed else "FAIL")
        # top up the park so guests are guaranteed present when the breach happens
        # (night-tour arrivals are sparse and interest-driven guests may finish
        #  their visit during the escape wait — the race is not what we test here)
        await page.evaluate(
            """(() => { const s = window.__game.state;
                for (let k = 0; k < 4; k++) {
                    s.guests.push({ id: s.nextId++, x: s.entrance.x + 0.5, y: s.entrance.y - 2 - k + 0.5,
                        path: [], target: null, dwell: 0, archetype: 'family', nightTour: false,
                        needs: { hunger: 0.9, thirst: 0.9, restroom: 0.9, fun: 0.2 },
                        satisfaction: 0.6, opinions: [], ticksInPark: 10, leaving: false, seen: 0 });
                }
            })()"""
        )
        # break enclosure B
        await page.evaluate(
            """(() => { const s = window.__game.state;
                const key = Object.keys(s.fences).find(k => k.startsWith('48,') && k.endsWith(',S'));
                delete s.fences[key]; s._encDirty = true;
            })()"""
        )
        await page.click('[data-testid="hud-speed-3-button"]')
        escaped = False
        for _ in range(30):
            await page.wait_for_timeout(500)
            if await S("window.__game.state.creatures.some(c => c.escaped)"):
                escaped = True
                break
        print("TEST 2b karrgan escaped:", "PASS" if escaped else "FAIL")
        panicked = False
        for _ in range(20):
            await page.wait_for_timeout(500)
            if await S("window.__game.state.guests.some(g => g.panic)"):
                panicked = True
                break
        print("TEST 2c guests panicked (park-wide stampede):", "PASS" if panicked else "FAIL")
        evac = await page.locator('[data-testid="emergency-evacuating"]').count()
        print("TEST 2d banner shows evacuation:", "PASS" if evac == 1 else "FAIL")
        g0 = await S("window.__game.state.guests.length")
        await page.wait_for_timeout(4000)
        g1 = await S("window.__game.state.guests.length")
        total0 = await S("window.__game.state.stats.guestsTotal")
        await page.wait_for_timeout(3000)
        total1 = await S("window.__game.state.stats.guestsTotal")
        print(f"TEST 2e guests evacuating ({g0} -> {g1}) & gate closed (arrivals {total0} -> {total1}):",
              "PASS" if g1 <= g0 and total1 == total0 else "FAIL")

        print("No page errors." if not errors else f"PAGE ERRORS: {errors}")
        await page.screenshot(path="/tmp/phase6a.jpg", quality=35, type="jpeg")
        await browser.close()


asyncio.run(main())
