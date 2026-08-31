"""Phase 9: Scenario Missions — picker UI, starter templates, goal tracking, win/lose flow, persistence."""
import asyncio
from playwright.async_api import async_playwright

URL = "https://discovery-bio.preview.emergentagent.com"


async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        page = await browser.new_page(viewport={"width": 1920, "height": 950})
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)[:300]))
        S = lambda expr: page.evaluate(expr)

        await page.goto(URL, wait_until="networkidle", timeout=30000)
        await page.wait_for_timeout(1200)
        await page.evaluate("localStorage.setItem('aetherion_tutorial_done','1'); localStorage.removeItem('aetherion_scenarios_done')")

        # ---- TEST 1: scenario mode + picker in main menu ----
        await page.click('[data-testid="mode-scenario"]')
        await page.wait_for_timeout(300)
        cards = await page.locator('[data-testid^="scenario-card-"]').count()
        print("TEST 1a scenario picker shows 5 missions:", "PASS" if cards == 5 else f"FAIL ({cards})")
        await page.click('[data-testid="scenario-card-skitter_bloom"]')
        desc = await page.locator('[data-testid="scenario-desc"]').inner_text()
        print("TEST 1b description updates:", "PASS" if "Skitterling" in desc else "FAIL")

        # ---- TEST 2: starting skitter_bloom applies the template ----
        await page.click('[data-testid="start-game-button"]')
        await page.wait_for_timeout(2500)
        snap = await S(
            """(() => { const s = window.__game.state;
                return { sc: s.scenario ? s.scenario.id : null, status: s.scenario?.status,
                    cash: s.cash, skitters: s.creatures.filter(c => c.speciesId === 'skitter').length,
                    fences: Object.keys(s.fences).length,
                    gate: Object.values(s.fences).some(f => f.gate),
                    feeder: s.buildings.some(b => b.type === 'feeder_forage'),
                    breeding: s.research.completed.includes('bio_breeding'),
                    contained: s.creatures.every(c => c.enclosureId) }; })()"""
        )
        print("TEST 2a scenario active:", "PASS" if snap["sc"] == "skitter_bloom" and snap["status"] == "active" else f"FAIL ({snap})")
        print("TEST 2b template applied (cash/creatures/fences/gate/feeder/research):",
              "PASS" if snap["cash"] == 40000 and snap["skitters"] == 4 and snap["fences"] >= 30
              and snap["gate"] and snap["feeder"] and snap["breeding"] else f"FAIL ({snap})")
        print("TEST 2c starter creatures contained:", "PASS" if snap["contained"] else f"FAIL ({snap})")

        # ---- TEST 3: mission tracker panel renders goals ----
        tracker = await page.locator('[data-testid="scenario-tracker"]').count()
        goals = await page.locator('[data-testid^="scenario-goal-"]').count()
        print("TEST 3 mission tracker visible with goals:", "PASS" if tracker == 1 and goals == 3 else f"FAIL (t={tracker} g={goals})")

        # ---- TEST 4: victory flow (force goals, expect dialog + reward) ----
        cash0 = await S("window.__game.state.cash")
        await page.evaluate(
            """(() => { const s = window.__game.state;
                s.stats.births = 4;
                const { x, y } = { x: 43, y: 34 };
                while (s.creatures.filter(c => c.speciesId === 'skitter').length < 8) {
                    const c = JSON.parse(JSON.stringify(s.creatures[0]));
                    c.id = s.nextId++; c.x = x + Math.random(); c.y = y + Math.random();
                    s.creatures.push(c);
                }
                for (const c of s.creatures) { c.welfare = 0.9; }
            })()"""
        )
        won = False
        for _ in range(20):
            await page.evaluate("for (const c of window.__game.state.creatures) c.welfare = 0.9")
            await page.wait_for_timeout(500)
            if await S("window.__game.state.scenario.status === 'won'"):
                won = True
                break
        cash1 = await S("window.__game.state.cash")
        dialog = await page.locator('[data-testid="scenario-victory-dialog"]').count()
        print("TEST 4a scenario won:", "PASS" if won else "FAIL")
        print("TEST 4b victory dialog shown:", "PASS" if dialog == 1 else f"FAIL ({dialog})")
        print("TEST 4c reward granted:", "PASS" if cash1 - cash0 >= 12000 else f"FAIL (+{cash1 - cash0})")

        # ---- TEST 5: continue in freeplay dismisses dialog; save persists scenario ----
        await page.click('[data-testid="scenario-continue-button"]')
        await page.wait_for_timeout(300)
        gone = await page.locator('[data-testid="scenario-victory-dialog"]').count()
        print("TEST 5a freeplay continue:", "PASS" if gone == 0 else "FAIL")
        await page.click('button:has-text("Save")')
        await page.wait_for_timeout(1500)
        saved = await S("window.__game.saveId !== null")
        print("TEST 5b saved with scenario state:", "PASS" if saved else "FAIL")

        # ---- TEST 6: completion badge in menu + defeat flow on containment_crisis ----
        await page.click('[data-testid="hud-exit-button"]')
        await page.wait_for_timeout(800)
        await page.click('[data-testid="mode-scenario"]')
        await page.wait_for_timeout(300)
        badge = await page.locator('[data-testid="scenario-done-skitter_bloom"]').count()
        print("TEST 6a completion badge in menu:", "PASS" if badge == 1 else f"FAIL ({badge})")
        await page.click('[data-testid="scenario-card-containment_crisis"]')
        await page.click('[data-testid="start-game-button"]')
        await page.wait_for_timeout(2500)
        karrgan = await S("window.__game.state.creatures.some(c => c.speciesId === 'karrgan')")
        print("TEST 6b crisis template (karrgan on site):", "PASS" if karrgan else "FAIL")
        await page.evaluate("window.__game.state.stats.breaches = 8")
        lost = False
        for _ in range(20):
            await page.wait_for_timeout(500)
            if await S("window.__game.state.scenario.status === 'lost'"):
                lost = True
                break
        defeat = await page.locator('[data-testid="scenario-defeat-dialog"]').count()
        print("TEST 6c scenario lost on fail condition:", "PASS" if lost else "FAIL")
        print("TEST 6d defeat dialog shown:", "PASS" if defeat == 1 else f"FAIL ({defeat})")

        # ---- TEST 7: exit from defeat returns to menu; management mode untouched ----
        await page.click('[data-testid="scenario-exit-button"]')
        await page.wait_for_timeout(800)
        menu = await page.locator('[data-testid="main-menu"]').count()
        print("TEST 7a exit to menu:", "PASS" if menu == 1 else "FAIL")
        await page.click('[data-testid="mode-management"]')
        await page.click('[data-testid="start-game-button"]')
        await page.wait_for_timeout(2500)
        clean = await S("(() => { const s = window.__game.state; return !s.scenario && s.cash === 150000; })()")
        print("TEST 7b plain management unaffected:", "PASS" if clean else "FAIL")

        print("No page errors." if not errors else f"PAGE ERRORS: {errors}")
        await page.screenshot(path="/tmp/phase9.jpg", quality=35, type="jpeg")
        await browser.close()


asyncio.run(main())
