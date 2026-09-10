"""Night lighting: player lamps lift guest comfort/safety after dark, and a Lighting overlay shows the gaps.

  SIM
    L1  a path lamp lights the path tiles within its reach (light map), a far tile stays dark
    L2  night, guest on a lit path tile -> satisfaction rises (comfort bonus); the guest is tagged 'lit'
    L3  night, guest on a dark path tile -> satisfaction falls (penalty); the guest is tagged 'dark'
    L4  by day the lamps do nothing to guests (no bonus, no penalty, no tag)
    L5  tallies: lit / dark path visits accumulate through the night
    L6  dawn rollover freezes last night's tallies, resets tonight's and folds the lit share into nightSafety
    L7  rating: the safety carrot lifts a marked (breach) park's safety score by up to +5%
    L8  save round-trip keeps the new stats (additive schema); an old save without them gets defaults
    L9  determinism guard: the light map is a pure function of the lamp layout (same key -> same map)
  UI
    U1  the overlay toggles include Lighting; toggling sets renderer.overlay = 'lighting' and renders without errors
    U2  the lamp's inspect panel shows a NIGHT LIGHTING report (path tiles lit, guests under it)
    U3  the Finances drawer shows the Night Lighting panel with lamp count, coverage and last night's visits

    python tests/lighting_test.py
"""
import asyncio
import sys
from playwright.async_api import async_playwright

from config import URL

results = []


def check(name, ok, detail=""):
    results.append(bool(ok))
    print(f"{'PASS' if ok else 'FAIL'} {name} {detail}")


# Stage: a straight guest path with a lamp beside its west end; the east end lies outside the lamp's reach.
STAGE = """(() => {
  const g = window.__game, s = g.state, D = window.__gameDebug;
  const size = Math.round(Math.sqrt(s.paths.length));
  const y = Math.floor(size / 2), x0 = Math.floor(size / 2) - 8;
  for (let i = 0; i < 14; i++) s.paths[(y) * size + (x0 + i)] = 1;   // 14 path tiles in a row
  s._occDirty = true; s._terrainDirty = true;
  const lamp = g.dev.spawnBuilding('path_lamp', x0, y - 1);            // beside the west end
  return { size, y, litX: x0 + 1, darkX: x0 + 12, lampId: lamp.id };
})()"""


async def sim(page):
    st = await page.evaluate(STAGE)
    D = "window.__gameDebug"
    lit_lv = await page.evaluate(f"{D}.lightAt({st['litX']}, {st['y']})")
    dark_lv = await page.evaluate(f"{D}.lightAt({st['darkX']}, {st['y']})")
    check("L1 a path lamp lights the path tiles within its reach; a far tile stays dark", lit_lv > 0 and dark_lv == 0, (lit_lv, dark_lv))

    # night
    await page.evaluate("window.__game.state.tick = Math.floor(1800 * 0.85)")
    r = await page.evaluate("""([lx, dx, y]) => {
      const g = window.__game, s = g.state, D = window.__gameDebug;
      const a = g.dev.spawnGuest(lx, y, { satisfaction: 0.5 }), b = g.dev.spawnGuest(dx, y, { satisfaction: 0.5 });
      // strip the one-off opinion swing so the deltas are the pure comfort effect: run several checks, compare direction
      const before = [a.satisfaction, b.satisfaction];
      const ra = D.guestLightingTick(a.id), rb = D.guestLightingTick(b.id);
      return { ra, rb, before, after: [a.satisfaction, b.satisfaction], tags: [a.lit, b.lit], ids: [a.id, b.id], tonight: JSON.parse(JSON.stringify(s.stats.lighting)) };
    }""", [st["litX"], st["darkX"], st["y"]])
    check("L2 night + lit path tile -> comfort rises and the guest is tagged lit", r["ra"] == "lit" and r["after"][0] > r["before"][0] and r["tags"][0] == "lit", str(r))
    check("L3 night + dark path tile -> comfort falls and the guest is tagged dark", r["rb"] == "dark" and r["after"][1] < r["before"][1] and r["tags"][1] == "dark", str(r))
    check("L5 lit / dark path visits are tallied for tonight", r["tonight"]["lit"] >= 1 and r["tonight"]["dark"] >= 1, str(r["tonight"]))

    # day: nothing happens
    r2 = await page.evaluate("""([ida, idb]) => {
      const s = window.__game.state, D = window.__gameDebug; s.tick = Math.floor(1800 * 0.3);
      const a = s.guests.find(q => q.id === ida), b = s.guests.find(q => q.id === idb);
      const before = [a.satisfaction, b.satisfaction];
      const ra = D.guestLightingTick(ida), rb = D.guestLightingTick(idb);
      return { ra, rb, same: a.satisfaction === before[0] && b.satisfaction === before[1], tags: [a.lit, b.lit] };
    }""", r["ids"])
    check("L4 by day the lamps do nothing to guests (no bonus, no penalty, no tag)", r2["ra"] is None and r2["rb"] is None and r2["same"] and r2["tags"] == [None, None], str(r2))

    # more night visits, then the dawn rollover (tick crosses a day boundary while running)
    await page.evaluate("""([ida, idb]) => { const s = window.__game.state, D = window.__gameDebug; s.tick = Math.floor(1800 * 0.9);
      for (let i = 0; i < 9; i++) { D.guestLightingTick(ida); D.guestLightingTick(idb); } }""", r["ids"])
    before_roll = await page.evaluate("JSON.parse(JSON.stringify(window.__game.state.stats.lighting))")
    await page.evaluate("(() => { const s = window.__game.state; s.stats.breaches = 4; s.tick = 1800 * 3 - 2; })()")  # a marked park, 2 ticks before dawn
    await page.evaluate("window.__game.setPaused(false)")
    await page.wait_for_timeout(700)
    await page.evaluate("window.__game.setPaused(true)")
    # the park rating is recomputed every 100 ticks: jump to just before the next recompute and let it pass
    await page.evaluate("(() => { const s = window.__game.state; s.tick = Math.floor(s.tick / 100) * 100 + 98; })()")
    await page.evaluate("window.__game.setPaused(false)")
    await page.wait_for_timeout(600)
    await page.evaluate("window.__game.setPaused(true)")
    after = await page.evaluate("(() => { const s = window.__game.state; return { day: s.day, tick: s.tick, l: JSON.parse(JSON.stringify(s.stats.lighting)), ns: s.stats.nightSafety, safety: s.rating.comp.safety, rep: window.__gameDebug.lightingReport() }; })()")
    total = before_roll["lit"] + before_roll["dark"]
    check("L6 dawn rollover freezes last night's tallies, resets tonight's and folds the lit share into nightSafety",
          after["tick"] >= 1800 * 3 and after["l"]["lastLit"] == before_roll["lit"] and after["l"]["lastDark"] == before_roll["dark"]
          and after["l"]["lit"] + after["l"]["dark"] < total and abs(after["ns"] - 0.4 * before_roll["lit"] / total) < 1e-6, str((before_roll, after["l"], after["ns"])))
    base_safety = max(0, 1 - min(0.4, 4 * 0.05))   # 4 breaches -> 0.8 base
    check("L7 rating: the lit-night share adds a safety carrot on top of the breach marks (<= +5%)",
          after["safety"] > base_safety and abs(after["safety"] - (base_safety + 0.05 * after["ns"])) < 1e-6 and after["rep"]["safetyBonus"] > 0, (after["safety"], base_safety, after["ns"]))

    # save round-trip + old-save defaults
    rt = await page.evaluate("""(() => { const D = window.__gameDebug, s = window.__game.state;
      const snap = D.serialize(s); const back = D.deserialize(JSON.parse(JSON.stringify(snap)));
      const old = JSON.parse(JSON.stringify(snap)); delete old.stats.lighting; delete old.stats.nightSafety; const oldBack = D.deserialize(old);
      return { keep: back.stats.nightSafety === s.stats.nightSafety && back.stats.lighting.lastLit === s.stats.lighting.lastLit, noCache: !('_light' in snap),
               defaults: oldBack.stats.nightSafety === 0 && oldBack.stats.lighting && oldBack.stats.lighting.lit === 0 }; })()""")
    check("L8 save round-trip keeps the lighting stats; an older save gets safe defaults; the light cache never serializes",
          rt["keep"] and rt["defaults"] and rt["noCache"], str(rt))
    det = await page.evaluate("""(() => { const s = window.__game.state, D = window.__gameDebug; const a = D.lightingReport(); s._light = null; const b = D.lightingReport();
      return a.litPathTiles === b.litPathTiles && a.pathTiles === b.pathTiles && a.coverage === b.coverage && a.lamps === b.lamps; })()""")
    check("L9 the light map is a pure function of the lamp layout (rebuild after cache drop is identical)", det)
    return st


async def ui(page, st):
    await page.evaluate("window.__game.state.tick = Math.floor(1800 * 0.85)")
    n_before = await page.locator('[data-testid="overlay-toggles"] button').count()
    await page.click('[data-testid="overlay-lighting"]')
    await page.wait_for_timeout(400)
    ov = await page.evaluate("window.__gameRenderer.overlay")
    active = await page.get_attribute('[data-testid="overlay-lighting"]', 'data-active')
    check("U1 the overlay toggles include Lighting; toggling sets renderer.overlay='lighting' and it renders", n_before == 4 and ov == "lighting" and active == "true", (n_before, ov, active))
    await page.click('[data-testid="overlay-lighting"]')
    # lamp inspect panel
    await page.evaluate("""(id) => { const s = window.__game.state, r = window.__gameRenderer; const b = s.buildings.find(q => q.id === id); r.centerOn(b.x + 0.5, b.y + 0.5); r.cam.zoom = 2; }""", st["lampId"])
    await page.evaluate("(id) => window.__gameInput.setSelection({ kind: 'building', id })", st["lampId"])  # same path a canvas click takes
    await page.wait_for_selector('[data-testid="building-panel"]', timeout=5000)
    rep = await page.locator('[data-testid="lamp-report"]').count()
    tiles = await page.locator('[data-testid="lamp-path-tiles"]').inner_text() if rep else None
    check("U2 the lamp's inspect panel shows a NIGHT LIGHTING report with the path tiles it lights", rep == 1 and tiles and int(tiles) >= 2, (rep, tiles))
    # finances drawer panel
    await page.click('[data-testid="dock-open-finances-button"]')
    await page.wait_for_selector('[data-testid="night-lighting-panel"]', timeout=8000)
    lamps = await page.locator('[data-testid="lighting-lamps"]').inner_text()
    cov = await page.locator('[data-testid="lighting-coverage"]').inner_text()
    last = await page.locator('[data-testid="lighting-last-night"]').inner_text()
    status = await page.get_attribute('[data-testid="lighting-status"]', 'data-on')
    check("U3 the Finances drawer shows the Night Lighting panel: lamp count, walkway coverage, last night's lit/dark visits, LAMPS ON at night",
          lamps.startswith("1") and "tiles" in cov and "%" in cov and "lit" in last and "dark" in last and status == "true", (lamps, cov, last, status))


async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        page = await browser.new_page(viewport={"width": 1600, "height": 900})
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)[:160]))
        await page.goto(URL, wait_until="networkidle", timeout=60000)
        await page.evaluate("localStorage.setItem('aetherion_tutorial_done','1'); localStorage.removeItem('aetherion_scenarios_done')")
        await page.reload(wait_until="networkidle")
        await page.click('[data-testid="mode-sandbox"]')
        await page.click('[data-testid="start-game-button"]')
        await page.wait_for_timeout(1500)
        await page.evaluate("window.__game.setPaused(true)")
        st = await sim(page)
        await ui(page, st)
        check("no page errors", not errors, errors[:2])
        await browser.close()
    n = sum(results)
    print(f"\n{n}/{len(results)} checks passed")
    sys.exit(0 if n == len(results) else 1)


asyncio.run(main())
