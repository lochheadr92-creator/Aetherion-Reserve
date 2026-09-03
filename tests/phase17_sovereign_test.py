"""Phase 17: Sovereign Containment scenario — setup template (damaged tier-4 pen,
nyxarr, starter admin/lab), escape-time fail counter, tracker + mastery UI,
victory grading with mastery badges, defeat flow."""
import asyncio
import os
from playwright.async_api import async_playwright

URL = os.environ.get("AETHERION_URL", "https://discovery-bio.preview.emergentagent.com")


async def boot_menu(page):
    await page.goto(URL, wait_until="networkidle", timeout=30000)
    await page.wait_for_timeout(1200)
    await page.evaluate(
        "localStorage.setItem('aetherion_tutorial_done','1');"
        "localStorage.removeItem('aetherion_scenarios_done')"
    )


async def start_sovereign(page):
    await page.click('[data-testid="mode-scenario"]')
    await page.wait_for_timeout(300)
    await page.click('[data-testid="scenario-card-sovereign_containment"]')
    await page.wait_for_timeout(200)
    await page.click('[data-testid="start-game-button"]')
    await page.wait_for_timeout(2500)


async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        page = await browser.new_page(viewport={"width": 1920, "height": 950})
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)[:300]))
        S = lambda expr: page.evaluate(expr)
        await boot_menu(page)

        # ---- TEST 1: picker shows the new BRUTAL mission ----
        await page.click('[data-testid="mode-scenario"]')
        await page.wait_for_timeout(300)
        cards = await page.locator('[data-testid^="scenario-card-"]').count()
        print("TEST 1a picker shows 6 missions:", "PASS" if cards == 6 else f"FAIL ({cards})")
        card = page.locator('[data-testid="scenario-card-sovereign_containment"]')
        txt = await card.inner_text()
        print("TEST 1b card shows BRUTAL difficulty:", "PASS" if "BRUTAL" in txt else f"FAIL ({txt[:80]})")

        # ---- TEST 2: setup template ----
        await page.click('[data-testid="scenario-card-sovereign_containment"]')
        await page.wait_for_timeout(200)
        await page.click('[data-testid="start-game-button"]')
        await page.wait_for_timeout(2500)
        await S("(() => { window.__game.state.paused = true; })()")
        snap = await S(
            """(() => { const s = window.__game.state;
                const fences = Object.values(s.fences);
                const t1 = fences.filter(f => f.tier === 1).length;
                const weak = fences.filter(f => f.tier === 4 && f.hp <= 70).length;
                const full4 = fences.filter(f => f.tier === 4 && f.hp > 400).length;
                return { sc: s.scenario?.id, status: s.scenario?.status, cash: s.cash,
                    nyx: s.creatures.filter(c => c.speciesId === 'nyxarr').length,
                    contained: s.creatures.every(c => c.enclosureId && !c.escaped),
                    admin: s.buildings.some(b => b.type === 'admin'),
                    lab: s.buildings.some(b => b.type === 'lab'),
                    feeder: s.buildings.some(b => b.type === 'feeder_meat'),
                    shelter: s.buildings.some(b => b.type === 'shelter'),
                    tier4Research: s.research.completed.includes('cont_insulated'),
                    t1, weak, full4, gates: fences.filter(f => f.gate).length,
                    escapeTicks: s.scenario?.escapeTicks, minCash: s.scenario?.minCash }; })()"""
        )
        ok2 = (snap["sc"] == "sovereign_containment" and snap["status"] == "active"
               and 30000 <= snap["cash"] <= 31500 and snap["nyx"] == 1 and snap["contained"]
               and snap["admin"] and snap["lab"] and snap["feeder"] and snap["shelter"]
               and snap["tier4Research"])
        print("TEST 2a template applied (cash/nyxarr/admin/lab/feeder/shelter/research):",
              "PASS" if ok2 else f"FAIL ({snap})")
        dmg_ok = snap["t1"] >= 3 and snap["weak"] >= 4 and snap["full4"] >= 20 and snap["gates"] == 1
        print(f"TEST 2b perimeter pre-damaged (t1 patches={snap['t1']}, weakened={snap['weak']}, intact4={snap['full4']}):",
              "PASS" if dmg_ok else f"FAIL ({snap})")
        print("TEST 2c escape/cash trackers initialised:",
              "PASS" if snap["escapeTicks"] == 0 and snap["minCash"] == 30000 else f"FAIL ({snap})")

        # ---- TEST 3: tracker shows 4 goals + mastery section ----
        goals = await page.locator('[data-testid^="scenario-goal-"]').count()
        mast = await page.locator('[data-testid="scenario-mastery-tracker"]').count()
        mrows = await page.locator('[data-testid^="scenario-mastery-row-"]').count()
        print("TEST 3 tracker goals + optional mastery:",
              "PASS" if goals == 4 and mast == 1 and mrows == 4 else f"FAIL (g={goals} m={mast} rows={mrows})")

        # ---- TEST 4: perimeter goal flips once wall is fully tier-4 & repaired ----
        await S(
            """(() => { const s = window.__game.state;
                for (const f of Object.values(s.fences)) { f.tier = 4; f.hp = 420; }
                s._encDirty = true; })()"""
        )
        await page.click('[data-testid="hud-speed-3-button"]')
        peri = False
        for _ in range(20):
            await page.wait_for_timeout(500)
            if await S("!!window.__game.state.scenario.progress.perimeter"):
                peri = True
                break
        print("TEST 4 perimeter goal satisfied after full repair:", "PASS" if peri else "FAIL")

        # ---- TEST 5: forced victory + mastery grading in dialog ----
        # sim recomputes welfare/rating constantly — hold forced values with an
        # in-page interval so scenarioTick always reads a winning state
        await S(
            """(() => { const s = window.__game.state;
                window.__forceWin = setInterval(() => {
                    s.stats.guestsTotal = 130;          // guests goal + spectacle mastery
                    s.stats.guestSat = 1;               // rating driver
                    s.stats.discoveries = 12;           // rating driver
                    s.rating.overall = 0.7;             // rating goal
                    const c = s.creatures.find(q => q.speciesId === 'nyxarr');
                    if (c) c.welfare = 0.9;             // welfare goal + court mastery
                }, 40); })()"""
        )
        won = False
        for _ in range(24):
            await page.wait_for_timeout(500)
            if await S("window.__game.state.scenario.status === 'won'"):
                won = True
                break
        await S("clearInterval(window.__forceWin)")
        print("TEST 5a scenario won:", "PASS" if won else "FAIL")
        vd = await page.locator('[data-testid="scenario-victory-dialog"]').count()
        mres = await page.locator('[data-testid="scenario-mastery-results"]').count()
        print("TEST 5b victory dialog + mastery results:", "PASS" if vd == 1 and mres == 1 else f"FAIL (v={vd} m={mres})")
        mastery = await S("window.__game.state.scenario.mastery")
        earned = await page.locator('[data-testid^="scenario-mastery-"][data-earned="true"]').count()
        exp = mastery and mastery.get("ironwall") and mastery.get("solvent") and mastery.get("court") and mastery.get("spectacle")
        print(f"TEST 5c mastery graded ({mastery}):", "PASS" if exp and earned == 4 else f"FAIL (earned={earned})")
        reward = await S("window.__game.state.cash")
        print("TEST 5d reward granted:", "PASS" if reward >= 30000 + 40000 - 5000 else f"FAIL ({reward})")
        await page.screenshot(path="/tmp/p17_victory.png")

        # ---- TEST 6: defeat via cumulative escape time ----
        await boot_menu(page)
        await start_sovereign(page)
        await S(
            """(() => { const s = window.__game.state;
                const c = s.creatures.find(q => q.speciesId === 'nyxarr');
                c.escaped = true; c.enclosureId = null;
                s.scenario.escapeTicks = 2950;
                s.paused = false; s.speed = 3; })()"""
        )
        lost = False
        for _ in range(24):
            await page.wait_for_timeout(500)
            if await S("window.__game.state.scenario.status === 'lost'"):
                lost = True
                break
        failed_by = await S("window.__game.state.scenario.failedBy")
        print("TEST 6a scenario lost via at-large timer:",
              "PASS" if lost and failed_by == "loose" else f"FAIL (lost={lost} by={failed_by})")
        dd = await page.locator('[data-testid="scenario-defeat-dialog"]').count()
        print("TEST 6b defeat dialog shown:", "PASS" if dd == 1 else f"FAIL ({dd})")

        # ---- TEST 7: minCash tracker follows cash lows ----
        min_cash = await S("window.__game.state.scenario.minCash")
        print("TEST 7 minCash tracked:", "PASS" if isinstance(min_cash, (int, float)) and min_cash <= 30000 else f"FAIL ({min_cash})")

        print("No page errors." if not errors else f"PAGE ERRORS: {errors}")
        await browser.close()


asyncio.run(main())
