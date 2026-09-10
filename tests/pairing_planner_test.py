"""Pairing Planner: pick two organisms in the Bloodline Ledger, read projected inbreeding risk,
readiness gates, morph odds, trait outlook and recommended pairings.

  1 pure helpers: founders unrelated -> CLEAN 0%; parent x offspring -> ELEVATED 33% (juvenile = hard block);
    siblings -> SEVERE 67%; inbreeding depression on fertility/hardiness matches inheritGenes
  2 helpers are deterministic + read-only: RNG cursor and state untouched by projections
  3 recommendations rank the unrelated mate first; best pairs put the founders on top
  4 UI: dossier -> ledger shows the planner with A = subject and B = top recommendation (CLEAN 0%)
  5 clicking a recommended partner re-targets B (ELEVATED 33%, depression badge, blockers listed)
  6 swap flips A/B; the B dropdown lets the player choose any same-species resident
  7 best-pair row sets both slots
  8 no page errors

    python tests/pairing_planner_test.py
"""
import asyncio
import sys
from playwright.async_api import async_playwright

from config import URL

results = []


def check(name, ok, detail=""):
    results.append(bool(ok))
    print(f"{'PASS' if ok else 'FAIL'} {name} {detail}")


async def select_creature(page, cid):
    await page.evaluate(f"(() => {{ const c = window.__game.state.creatures.find(q => q.id === {cid}); window.__gameRenderer.centerOn(c.x, c.y); }})()")
    await page.wait_for_timeout(300)
    box = await page.locator('[data-testid="game-canvas"]').bounding_box()
    await page.mouse.click(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2 - 8)
    await page.wait_for_timeout(400)
    sel = await page.evaluate("window.__gameRenderer.selection")
    if not sel or sel.get("id") != cid:
        # overlapping sprites can hand the click to a neighbour: select through the input layer so React's
        # inspect panel follows (renderer.selection alone never reaches the UI)
        await page.evaluate(f"window.__gameInput.setSelection({{ kind: 'creature', id: {cid} }})")
        await page.wait_for_timeout(300)


async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        page = await browser.new_page(viewport={"width": 1600, "height": 900})
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)[:200]))
        await page.goto(URL, wait_until="networkidle", timeout=60000)
        await page.evaluate("localStorage.setItem('aetherion_tutorial_done','1'); localStorage.removeItem('aetherion_scenarios_done');")
        await page.reload(wait_until="networkidle")
        await page.click('[data-testid="mode-scenario"]')
        await page.wait_for_timeout(300)
        await page.click('[data-testid="scenario-card-sovereign_bloodline"]')
        await page.wait_for_timeout(200)
        await page.click('[data-testid="start-game-button"]')
        await page.wait_for_timeout(2000)
        await page.click('[data-testid="hud-time-pause-button"]')
        S = page.evaluate

        # ---- stage a bloodline: founders m, f; juvenile child k1; adult child k2 ----
        st = await S("""(() => { const s = window.__game.state; window.__game.stepTicks(200);
            const [m, f] = s.creatures; const t = { x: Math.floor(m.x), y: Math.floor(m.y) };
            const k1 = window.__game.dev.offspring(m.id, f.id, t.x, t.y, true);
            const k2 = window.__game.dev.offspring(m.id, f.id, t.x, t.y, false);
            window.__game.stepTicks(200);
            return { m: m.id, f: f.id, k1: k1.id, k2: k2.id, names: { m: m.name, f: f.name, k1: k1.name, k2: k2.name },
                     enc: [m.enclosureId, f.enclosureId, k1.enclosureId, k2.enclosureId] }; })()""")
        m, f, k1, k2 = st["m"], st["f"], st["k1"], st["k2"]

        pf = await S(f"window.__gameDebug.projectPairing({m}, {f})")
        pk1 = await S(f"window.__gameDebug.projectPairing({m}, {k1})")
        pk = await S(f"window.__gameDebug.projectPairing({k1}, {k2})")
        check("1a founders: CLEAN 0%, Unrelated, research + housed gates green",
              pf["inbreed"] == 0 and pf["risk"]["id"] == "clean" and pf["relation"] == "Unrelated" and pf["shared"] == 0
              and all(g["ok"] for g in pf["checklist"] if g["id"] in ("research", "housed", "species", "distinct")),
              f'{pf["relation"]} {pf["inbreed"]} enc={st["enc"]}')
        hard = [g["id"] for g in pk1["blockers"] if g.get("hard")]
        check("1b parent x juvenile offspring: ELEVATED 33%, Parent / offspring, juvenile is a hard block",
              abs(pk1["inbreed"] - 0.33) < 0.01 and pk1["risk"]["id"] == "elevated" and pk1["relation"] == "Parent / offspring"
              and "b-adult" in hard and pk1["impossible"] is True, f'{pk1["relation"]} {pk1["inbreed"]} hard={hard}')
        check("1c siblings: SEVERE 67%, Sibling", abs(pk["inbreed"] - 0.67) < 0.01 and pk["risk"]["id"] == "severe" and pk["relation"] == "Sibling",
              f'{pk["relation"]} {pk["inbreed"]}')
        g = pk1["genes"]["fertility"]
        exp_mean = max(0.05, min(0.98, (g["a"] + g["b"]) / 2 * (1 - pk1["inbreed"] * 0.6)))
        r = pk1["genes"]["resilience"]
        check("1d inbreeding depression mirrors inheritGenes (fertility x(1-0.6i), hardiness x(1-0.5i))",
              abs(g["mean"] - exp_mean) < 0.005 and g["depression"] == 20 and r["depression"] == 17 and pk1["genes"]["intel"]["depression"] == 0
              and 0 < pk1["pairChance"] < 1 and pk1["expected"]["gen"] == 2,
              f'fert {g["mean"]:.3f} vs {exp_mean:.3f} dep={g["depression"]}/{r["depression"]}')
        check("1e morph odds: no morph in either line -> 2% spontaneous only", pf["morph"]["id"] is None and abs(pf["morph"]["pMorph"] - 0.02) < 0.001, str(pf["morph"]))

        det = await S(f"""(() => {{ const d = window.__gameDebug; const before = d.getRngCursor(); const snap = JSON.stringify(d.serialize(window.__game.state));
            for (let i = 0; i < 5; i++) {{ d.projectPairing({m}, {k2}); d.recommendPartners({m}, 5); d.bestPairs('nyxarr', 3); }}
            return {{ same: d.getRngCursor() === before, stateSame: JSON.stringify(d.serialize(window.__game.state)) === snap }}; }})()""")
        check("2 projections are deterministic and read-only (RNG cursor + serialized state unchanged)", det["same"] and det["stateSame"], str(det))

        recs = await S(f"window.__gameDebug.recommendPartners({m}, 5)")
        pairs = await S("window.__gameDebug.bestPairs('nyxarr', 3)")
        check("3 recommendations: unrelated mate ranks first over kin; best pair is the founder couple",
              recs and recs[0]["id"] == f and recs[0]["inbreed"] == 0 and all(r["inbreed"] > 0 for r in recs[1:])
              and pairs and {pairs[0]["aId"], pairs[0]["bId"]} == {m, f},
              f'recs={[(r["name"], r["inbreed"]) for r in recs]} best={pairs[0]["aName"] if pairs else None}x{pairs[0]["bName"] if pairs else None}')

        # ---- UI ----
        await select_creature(page, m)
        await page.click('[data-testid="creature-ledger-button"]')
        await page.wait_for_selector('[data-testid="pairing-planner"]', timeout=8000)
        proj = page.locator('[data-testid="pairing-projection"]')
        a_txt = await page.locator('[data-testid="pairing-slot-a"]').inner_text()
        check("4 ledger opens the planner: A = subject, B = top recommendation (mate), CLEAN 0%",
              st["names"]["m"] in a_txt and await proj.get_attribute("data-a") == str(m) and await proj.get_attribute("data-b") == str(f)
              and await page.get_attribute('[data-testid="pairing-risk"]', "data-tier") == "clean"
              and await page.locator('[data-testid="pairing-inbreed"]').inner_text() == "0%"
              and await page.locator('[data-testid="pairing-recommend-"][data-rank="1"], [data-testid^="pairing-recommend-"][data-rank="1"]').get_attribute("data-active") == "true",
              a_txt)

        await page.click(f'[data-testid="pairing-recommend-{k2}"]')
        await page.wait_for_timeout(300)
        rel = await page.locator('[data-testid="pairing-relation"]').inner_text()
        check("5 picking a recommended partner re-targets B: ELEVATED 33%, Parent / offspring, fertility depression badge, gates listed",
              await proj.get_attribute("data-b") == str(k2) and await page.get_attribute('[data-testid="pairing-risk"]', "data-tier") == "elevated"
              and await page.locator('[data-testid="pairing-inbreed"]').inner_text() == "33%" and "Parent / offspring" in rel
              and await page.locator('[data-testid="pairing-depression-fertility"]').count() == 1
              and await page.locator('[data-testid="pairing-viability"]').count() == 1
              and await page.locator('[data-testid="pairing-odds"]').count() == 1 and await page.locator('[data-testid="pairing-morph"]').count() == 1
              and await page.locator('[data-testid^="pairing-trait-"]').count() >= 6, rel)

        await page.click('[data-testid="pairing-swap"]')
        await page.wait_for_timeout(200)
        swapped = (await proj.get_attribute("data-a"), await proj.get_attribute("data-b"))
        await page.click('[data-testid="pairing-slot-b"]')
        await page.wait_for_selector(f'[data-testid="pairing-slot-b-option-{k1}"]', timeout=5000)
        await page.click(f'[data-testid="pairing-slot-b-option-{k1}"]')
        await page.wait_for_timeout(300)
        chosen = (await proj.get_attribute("data-a"), await proj.get_attribute("data-b"))
        hard_gate = await page.locator('[data-testid="pairing-gate-b-adult"]').count()
        check("6 swap flips A/B; the B dropdown picks any same-species resident (juvenile sibling -> SEVERE + hard block)",
              swapped == (str(k2), str(m)) and chosen == (str(k2), str(k1))
              and await page.get_attribute('[data-testid="pairing-risk"]', "data-tier") == "severe" and hard_gate == 1, f"{swapped} {chosen}")

        await page.click('[data-testid="pairing-pair-1"]')
        await page.wait_for_timeout(300)
        best = {await proj.get_attribute("data-a"), await proj.get_attribute("data-b")}
        check("7 best-pair row sets both slots to the founder couple", best == {str(m), str(f)} and await page.get_attribute('[data-testid="pairing-risk"]', "data-tier") == "clean", str(best))

        # the original outlook + tree are still there
        check("7b family tree + pairing outlook still render alongside the planner",
              await page.locator('[data-testid="ledger-tree"]').count() == 1 and await page.locator('[data-testid="ledger-pairing"]').count() == 1)

        # ---- Species Database shortcut: "Plan pairing" opens the ledger focused on the species ----
        await page.click('[data-testid="dock-species-database-open-button"]')
        await page.wait_for_selector('[data-testid="species-database-modal"]', timeout=8000)
        await page.click('[data-testid="species-row-nyxarr"]')
        await page.wait_for_timeout(300)
        btn = page.locator('[data-testid="species-plan-pairing-button"]')
        btn_txt = await btn.inner_text()
        await btn.click()
        await page.wait_for_selector('[data-testid="bloodline-ledger"] [data-testid="pairing-planner"]', timeout=8000)
        await page.wait_for_timeout(300)
        title = await page.locator('[data-testid="ledger-title"]').inner_text()
        pa, pb = await proj.get_attribute("data-a"), await proj.get_attribute("data-b")
        check("9 Species Database 'Plan pairing' opens the ledger focused on the species: A = first resident, B = top recommendation, no dossier needed",
              "Plan pairing" in btn_txt and "in park" in btn_txt and "Pairing Planner" in title and "Nyxarr" in title
              and await page.locator('[data-testid="ledger-tree"]').count() == 0 and await page.locator('[data-testid="ledger-residents"]').count() == 1
              and pa is not None and pb is not None and pa != pb
              and await page.get_attribute('[data-testid="pairing-planner"]', "data-focus-species") == "nyxarr", f"{btn_txt} | {title} | {pa}x{pb}")
        await page.click('[data-testid="dock-species-database-open-button"]')
        await page.wait_for_selector('[data-testid="species-database-modal"]', timeout=8000)
        await page.click('[data-testid="species-row-skitter"]')
        await page.wait_for_timeout(300)
        check("9b species with no residents: button disabled with a hint",
              await page.locator('[data-testid="species-plan-pairing-button"]').get_attribute("aria-disabled") == "true"
              and await page.locator('[data-testid="species-plan-pairing-hint"]').count() == 1)
        check("8 no page errors", not errors, errors[:2])
        await browser.close()
    print(f"\n{sum(results)}/{len(results)} checks passed")
    sys.exit(0 if all(results) else 1)


asyncio.run(main())
