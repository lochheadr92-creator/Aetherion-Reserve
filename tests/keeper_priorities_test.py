"""Keeper Priorities: assign a keeper to an enclosure; they prioritise its care
(feeding/cleaning) over other areas, help elsewhere when idle, and the
assignment survives save/load."""
import asyncio
from playwright.async_api import async_playwright
from phase6_helpers import boot, build_park, acquire_and_place

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
        # calm daytime baseline
        await page.evaluate(
            """(() => { const s = window.__game.state;
                s.tick = Math.floor(s.tick / 1800) * 1800 + 500;
                s.weather = { type: 'clear', ticksLeft: 900000 };
            })()"""
        )
        # one creature in enclosure A (40-46,30-36), one in enclosure B (48-54,30-36)
        await acquire_and_place(page, "veyra", 43, 33)
        await acquire_and_place(page, "veyra", 51, 33)
        enc_a = await S("window.__game.state.creatures[0].enclosureId")
        enc_b = await S("window.__game.state.creatures[1].enclosureId")
        cid_a = await S("window.__game.state.creatures[0].id")
        cid_b = await S("window.__game.state.creatures[1].id")
        print("SETUP enclosures detected:", "PASS" if enc_a and enc_b and enc_a != enc_b else f"FAIL (A={enc_a} B={enc_b})")

        # ---- TEST 1: hire keeper; assignment select renders ----
        await page.click('[data-testid="open-staff-button"]')
        await page.wait_for_timeout(400)
        await page.click('[data-testid="hire-xenobiologist-button"]')
        await page.wait_for_timeout(250)
        sid = await S("window.__game.state.staff[0].id")
        sel = await page.locator(f'[data-testid="staff-assign-select-{sid}"]').count()
        print("TEST 1 assignment select renders:", "PASS" if sel == 1 else f"FAIL ({sel})")

        # ---- TEST 2: assign keeper to enclosure B via the UI ----
        await page.click(f'[data-testid="staff-assign-select-{sid}"]')
        await page.wait_for_timeout(300)
        await page.click(f'[data-testid="staff-assign-enc-{sid}-{enc_b}"]')
        await page.wait_for_timeout(300)
        assigned = await S("window.__game.state.staff[0].assignedEnclosureId")
        anchor = await S("window.__game.state.staff[0].assignedAnchor")
        print("TEST 2a assignment stored:", "PASS" if assigned == enc_b else f"FAIL ({assigned} != {enc_b})")
        print("TEST 2b anchor tile stored:", "PASS" if anchor and "x" in anchor else f"FAIL ({anchor})")
        await page.click('[data-testid="staff-close-button"]')

        # ---- TEST 3: feed priority — creature A is hungrier, but B gets fed first ----
        await page.evaluate(
            """(() => { const s = window.__game.state;
                s.creatures[0].needs.hunger = 0.10;  // A: hungriest overall
                s.creatures[1].needs.hunger = 0.30;  // B: hungry, in assigned enclosure
            })()"""
        )
        await page.click('[data-testid="hud-time-pause-button"]')  # unpause
        await page.click('[data-testid="hud-speed-3-button"]')
        first_feed_target = None
        for _ in range(200):
            await page.wait_for_timeout(150)
            t = await S("(() => { const st = window.__game.state.staff[0]; return st.task && st.task.type === 'feed' ? st.task.targetId : null; })()")
            if t is not None:
                first_feed_target = t
                break
        print("TEST 3 assigned enclosure fed first:",
              "PASS" if first_feed_target == cid_b else f"FAIL (target={first_feed_target}, expected B={cid_b})")

        # ---- TEST 4: flexible fallback — keeper then helps enclosure A ----
        fed_a = False
        for _ in range(120):
            await page.wait_for_timeout(500)
            if await S(f"(() => {{ const s = window.__game.state; return (s.stats.staffFeedings || 0) >= 2 || s.creatures[0].needs.hunger > 0.5; }})()"):
                fed_a = True
                break
        hunger_a = await S("window.__game.state.creatures[0].needs.hunger")
        print("TEST 4 idle keeper helped other enclosure:", "PASS" if fed_a else f"FAIL (hungerA={hunger_a})")

        # ---- TEST 5: clean priority — planted waste in B beats nearer waste in A ----
        await page.click('[data-testid="hud-time-pause-button"]')  # pause
        await page.evaluate(
            """(() => { const s = window.__game.state;
                s.creatures[0].needs.hunger = 1; s.creatures[1].needs.hunger = 1;
                s.waste = [ { id: 900001, x: 42, y: 33 }, { id: 900002, x: 52, y: 33 } ];
                const st = s.staff[0];
                st.x = 43.5; st.y = 28.5;  // much closer to A's waste
                st.task = null; st.state = 'idle'; st.path = []; st.workTicks = 0;
            })()"""
        )
        await page.click('[data-testid="hud-time-pause-button"]')  # unpause
        first_clean = None
        for _ in range(200):
            await page.wait_for_timeout(150)
            t = await S("(() => { const st = window.__game.state.staff[0]; return st.task && st.task.type === 'clean' ? st.task.targetId : null; })()")
            if t is not None:
                first_clean = t
                break
        # any waste inside B (48-54,30-36) is acceptable (new waste can spawn there too)
        clean_in_b = False
        if first_clean is not None:
            clean_in_b = await S(
                f"(() => {{ const s = window.__game.state; const w = s.waste.find((q) => q.id === {first_clean}); "
                f"return w ? (w.x >= 48 && w.x <= 54 && w.y >= 30 && w.y <= 36) : {str(first_clean == 900002).lower()}; }})()"
            )
        print("TEST 5 assigned enclosure cleaned first:", "PASS" if clean_in_b else f"FAIL (target={first_clean})")

        # ---- TEST 6: persistence — assignment survives save/load round-trip ----
        await page.click('[data-testid="hud-time-pause-button"]')  # pause
        save = await page.evaluate("window.__game.saveGame('Keeper Priorities Test')")
        save_id = save["id"] if isinstance(save, dict) and "id" in save else await S("window.__game.saveId")
        await page.evaluate(f"window.__game.loadGame('{save_id}')")
        await page.wait_for_timeout(800)
        a2 = await S("window.__game.state.staff[0].assignedEnclosureId")
        an2 = await S("window.__game.state.staff[0].assignedAnchor")
        print("TEST 6 assignment persists through save/load:",
              "PASS" if a2 == enc_b and an2 and "x" in an2 else f"FAIL (id={a2}, anchor={an2})")
        await page.evaluate(f"window.__game.deleteSave('{save_id}')")

        # ---- TEST 7: unassign via UI returns keeper to general duties ----
        await page.click('[data-testid="open-staff-button"]')
        await page.wait_for_timeout(400)
        sid2 = await S("window.__game.state.staff[0].id")
        await page.click(f'[data-testid="staff-assign-select-{sid2}"]')
        await page.wait_for_timeout(300)
        await page.click(f'[data-testid="staff-assign-none-{sid2}"]')
        await page.wait_for_timeout(300)
        un = await S("window.__game.state.staff[0].assignedEnclosureId")
        print("TEST 7 unassign works:", "PASS" if un is None else f"FAIL ({un})")

        print("PAGE ERRORS:", errors if errors else "none")
        await browser.close()


asyncio.run(main())
