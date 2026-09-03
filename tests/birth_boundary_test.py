"""Birth on an enclosure boundary tile (stabilisation item 2): the newborn must be placed inside
the mother's enclosure, never across the fence, and must not be flagged escaped.

Usage: AETHERION_URL=http://localhost:3000 python tests/birth_boundary_test.py
"""
import asyncio, sys
from playwright.async_api import async_playwright

from config import URL
from save_cleanup import SaveCleanup

results = []


def check(name, ok, detail=""):
    results.append(bool(ok))
    print(f"{'PASS' if ok else 'FAIL'} {name} {detail}")


# Enclosure tiles x0..x1 / y0..y1, fenced on all four sides (edge keys `${x},${y},E|S`).
SETUP = """(() => { const s = window.__game.state;
  const x0 = 20, y0 = 20, x1 = 25, y1 = 24;
  const F = () => ({ tier: 2, hp: 400, gate: false });
  for (let x = x0; x <= x1; x++) { s.fences[`${x},${y0 - 1},S`] = F(); s.fences[`${x},${y1},S`] = F(); }
  for (let y = y0; y <= y1; y++) { s.fences[`${x0 - 1},${y},E`] = F(); s.fences[`${x1},${y},E`] = F(); }
  // keep the pen flat, dry and clear so the enclosure is valid
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = y * 64 + x; s.water[i] = 0; s.veg[i] = 0; }
  s._encDirty = true; s._occDirty = true; s._terrainDirty = true;
  if (!s.research.completed.includes('bio_breeding')) s.research.completed.push('bio_breeding');
  const mk = (x, y, name) => ({ id: s.nextId++, speciesId: 'veyra', name, x: x + 0.5, y: y + 0.5, path: [], state: 'idle', stateTicks: 0, actionTicks: 0,
    needs: { hunger: 0.9, thirst: 0.9, energy: 0.9 }, welfare: 0.8, comfort: 0.8, stress: 0.05, health: 1, factors: [],
    enclosureId: null, homeTile: { x, y }, escaped: false, dir: 1, trait: 'Calm', genes: null, breedCd: 0 });
  const mother = mk(x1, y0 + 2, 'Boundary Dam');   // east boundary tile: the tile beyond x1 is outside the pen
  const father = mk(x0 + 1, y0 + 1, 'Boundary Sire');
  s.creatures.push(mother, father);
  return { motherId: mother.id, fatherId: father.id, x1, y0, y1, x0 }; })()"""


async def main():
    async with async_playwright() as pw, SaveCleanup() as tracker:
        browser = await pw.chromium.launch()
        page = await browser.new_page(viewport={"width": 1400, "height": 800})
        tracker.attach(page)
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)[:200]))
        await page.goto(URL, wait_until="networkidle", timeout=30000)
        await page.wait_for_timeout(800)
        await page.evaluate("localStorage.setItem('aetherion_tutorial_done','1')")
        await page.click('[data-testid="mode-sandbox"]')
        await page.click('[data-testid="start-game-button"]')
        await page.wait_for_timeout(1000)
        await page.click('[data-testid="hud-time-pause-button"]')
        ids = await page.evaluate(SETUP)
        # let both adults take one decision so enclosureId is assigned from the pen
        pre = await page.evaluate("(() => { const g = window.__game; g.stepTicks(60); const s = g.state; const m = s.creatures.find(c => c.id === %d), f = s.creatures.find(c => c.id === %d);"
                                  " return { mEnc: m.enclosureId, fEnc: f.enclosureId, mEsc: m.escaped, fEsc: f.escaped, count: s.creatures.length }; })()" % (ids["motherId"], ids["fatherId"]))
        check("1 both adults are inside one valid enclosure", pre["mEnc"] and pre["mEnc"] == pre["fEnc"] and not pre["mEsc"] and not pre["fEsc"], str(pre))
        # pin the mother on the east boundary tile (re-pinned between short steps so she cannot wander off it),
        # make her give birth on her next breeding check, and read the newborn the moment it appears
        res = await page.evaluate(
            "(() => { const g = window.__game, s = g.state; const m = s.creatures.find(c => c.id === %d);"
            " const pin = () => { m.x = %d + 0.5; m.y = %d + 0.5; m.path = []; m.state = 'idle'; };"
            " pin(); m.gestation = 1; m._mateId = %d; m.breedCd = 0; m.juvenile = false;"
            " const before = s.creatures.length; const mEnc = m.enclosureId; let stepped = 0;"
            " while (s.creatures.length === before && stepped < 400) { pin(); g.stepTicks(10); stepped += 10; }"
            " const baby = s.creatures.reduce((a, c) => (!a || c.id > a.id ? c : a), null);"
            " const bornAt = { x: Math.floor(baby.x), y: Math.floor(baby.y), enc: baby.enclosureId, esc: baby.escaped };"
            " g.stepTicks(400 - stepped);"
            " const mNow = s.creatures.find(c => c.id === %d);"
            " return { born: s.creatures.length > before, stepped, babyId: baby.id, babyName: baby.name, bornAt, babyEnc: baby.enclosureId, babyEsc: baby.escaped,"
            " bx: Math.floor(baby.x), by: Math.floor(baby.y), mEnc, mEncNow: mNow.enclosureId, mEsc: mNow.escaped, juvenile: !!baby.juvenile, births: s.stats.births || 0 }; })()"
            % (ids["motherId"], ids["x1"], ids["y0"] + 2, ids["fatherId"], ids["motherId"]))
        check("2 a birth happened within 400 ticks", res["born"] and res["juvenile"] and res["births"] >= 1, str(res))
        b = res["bornAt"]
        spawn_ok = ids["x0"] <= b["x"] <= ids["x1"] and ids["y0"] <= b["y"] <= ids["y1"] and abs(b["x"] - ids["x1"]) <= 1 and abs(b["y"] - (ids["y0"] + 2)) <= 1
        check("3 newborn spawned next to the mother INSIDE the pen (never across the east fence)", spawn_ok, f"born at ({b['x']},{b['y']}) mother at ({ids['x1']},{ids['y0'] + 2}), pen x {ids['x0']}..{ids['x1']} y {ids['y0']}..{ids['y1']}")
        inside = ids["x0"] <= res["bx"] <= ids["x1"] and ids["y0"] <= res["by"] <= ids["y1"]
        check("3b newborn still inside the pen 400 ticks later", inside, f"baby at ({res['bx']},{res['by']})")
        check("4 newborn.enclosureId === mother.enclosureId", res["babyEnc"] and res["babyEnc"] == res["mEnc"] == res["mEncNow"], f"baby {res['babyEnc']} mother {res['mEnc']}/{res['mEncNow']}")
        check("5 newborn.escaped === false (and mother still contained)", res["babyEsc"] is False and res["mEsc"] is False, str({k: res[k] for k in ('babyEsc', 'mEsc')}))
        check("6 no page errors", not errors, str(errors))
        await browser.close()

    print(f"\n{sum(results)}/{len(results)} checks passed")
    sys.exit(0 if all(results) else 1)


asyncio.run(main())
