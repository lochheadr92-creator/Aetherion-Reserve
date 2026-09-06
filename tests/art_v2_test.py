"""ART_V2 (Spec 01) acceptance in a real browser.

  off  bake all 19 species; idle[0] hash / all-frames hash / bounds equal tests/art_v2_baseline.json
       (recorded in Chromium on main); every sheet reports v2:false
  on   every sheet has v2:true; idle[0] hash differs from main; bounds / w / h equal main;
       terrain tiles show <= 4 distinct luminance bands per material (histogram over
       renderer.tileTextureFor output); no console errors in either mode after a reload
  shots one saved park loaded under both flag values, day and night:
       artifacts/art_v2_{day,night}_{on,off}.png

Usage: AETHERION_URL=... python tests/art_v2_test.py   (preview URL by default)
"""
import asyncio, json, os, sys
from playwright.async_api import async_playwright

from config import URL
from save_cleanup import SaveCleanup

BASE = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "art_v2_baseline.json")))
results = []


def check(name, ok, detail=""):
    results.append(bool(ok))
    print(f"{'PASS' if ok else 'FAIL'} {name} {detail}")


SHEETS = """(() => { const r = window.__gameRenderer; const out = {};
  const fnv = (d) => { let h = 2166136261; for (let i = 0; i < d.length; i++) { h ^= d[i]; h = Math.imul(h, 16777619) >>> 0; } return h; };
  const hc = (cv) => fnv(cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data);
  for (const id of Object.keys(window.__game.state.knowledge).sort()) { const sh = r.sheetFor(id);
    const all = []; for (const m of ['idle','walk','threat','lunge','blink']) if (sh[m]) for (const cv of sh[m]) all.push(hc(cv));
    out[id] = { idle0: hc(sh.idle[0]), all: fnv(new Uint8Array(new Uint32Array(all).buffer)), bounds: sh.bounds, w: sh.w, h: sh.h, frames: all.length, v2: sh.v2 }; }
  return out; })()"""

TILE_BANDS = """(() => { const r = window.__gameRenderer; const out = {};
  const L = (a, b, c) => (Math.max(a, b, c) + Math.min(a, b, c)) / 510;
  for (let m = 0; m <= 10; m++) { let worst = 0;
    for (let x = 0; x < 12; x++) { const cv = r.tileTextureFor(m, x, 3); const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
      const ls = []; for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 40) ls.push(L(d[i], d[i + 1], d[i + 2]));
      ls.sort((a, b) => a - b); let bands = 0, last = -1; for (const l of ls) { if (l - last > 0.012) { bands++; last = l; } }
      worst = Math.max(worst, bands); }
    out[m] = worst; }
  return out; })()"""


async def boot(page, flag):
    await page.goto(URL, wait_until="networkidle", timeout=30000)
    await page.evaluate("localStorage.setItem('aetherion_tutorial_done','1'); localStorage.setItem('aetherion.artV2', '%s')" % flag)
    await page.reload(wait_until="networkidle")  # flags are read once at module load
    await page.wait_for_timeout(900)


async def start_sandbox(page):
    await page.click('[data-testid="mode-sandbox"]')
    await page.click('[data-testid="start-game-button"]')
    await page.wait_for_timeout(1200)
    await page.click('[data-testid="hud-time-pause-button"]')


async def shoot(page, save_id, flag):
    await page.evaluate("(async () => { const g = window.__game; await g.loadGame('%s'); g.setPaused(true); })()" % save_id)
    await page.wait_for_timeout(400)
    c = await page.evaluate("(() => { const s = window.__game.state; const c = s.creatures[0]; return c ? { x: c.x, y: c.y } : { x: 32, y: 32 }; })()")
    await page.evaluate("window.__gameRenderer.cam.zoom = 2.2; window.__gameRenderer.centerOn(%d, %d);" % (c["x"], c["y"]))
    os.makedirs("/app/artifacts", exist_ok=True)
    for phase, frac in (("day", 0.3), ("night", 0.85)):
        await page.evaluate("(() => { const s = window.__game.state; s.tick = Math.floor(s.tick / 1800) * 1800 + Math.floor(1800 * %f); s._terrainDirty = true; })()" % frac)
        await page.wait_for_timeout(700)
        await page.locator('[data-testid="game-canvas"]').screenshot(path=f"/app/artifacts/art_v2_{phase}_{flag}.png")


async def main():
    async with async_playwright() as pw, SaveCleanup() as tracker:
        browser = await pw.chromium.launch()
        page = await browser.new_page(viewport={"width": 1600, "height": 900})
        tracker.attach(page)
        console_errors = {"on": [], "off": []}
        current = {"flag": "off"}
        page.on("pageerror", lambda e: console_errors[current["flag"]].append(str(e)[:160]))
        page.on("console", lambda m: console_errors[current["flag"]].append(m.text[:160]) if m.type == "error" else None)

        # ---- one shared park (scenario template: fenced starter creatures + feeder) ----
        await boot(page, "off")
        await page.evaluate("localStorage.removeItem('aetherion_scenarios_done')")
        await page.click('[data-testid="mode-scenario"]')
        await page.click('[data-testid="scenario-card-skitter_bloom"]')
        await page.click('[data-testid="start-game-button"]')
        await page.wait_for_timeout(1500)
        await page.click('[data-testid="hud-time-pause-button"]')
        save_id = await page.evaluate("(async () => { const r = await window.__game.saveGame('art-v2-shots'); return r.id; })()")
        tracker.add(save_id, await page.evaluate("window.__gameDebug.playerToken()"))

        # ---- OFF: byte-identical to main ----
        off = await page.evaluate(SHEETS)
        ids = sorted(BASE.keys())
        check("OFF 1 all 19 sheets report v2:false", len(off) == 19 and all(off[i]["v2"] is False for i in ids))
        bad = [i for i in ids if off[i]["idle0"] != BASE[i]["idle0"] or off[i]["all"] != BASE[i]["all"] or off[i]["frames"] != BASE[i]["frames"]]
        check("OFF 2 idle[0] + all-frame hashes equal main for every species", not bad, str(bad))
        bad = [i for i in ids if off[i]["bounds"] != BASE[i]["bounds"] or off[i]["w"] != BASE[i]["w"] or off[i]["h"] != BASE[i]["h"]]
        check("OFF 3 bounds / w / h equal main", not bad, str(bad))
        await shoot(page, save_id, "off")

        # ---- ON ----
        current["flag"] = "on"
        await boot(page, "on")
        await start_sandbox(page)
        on = await page.evaluate(SHEETS)
        check("ON 1 all 19 sheets report v2:true", len(on) == 19 and all(on[i]["v2"] is True for i in ids))
        same = [i for i in ids if on[i]["idle0"] == BASE[i]["idle0"]]
        check("ON 2 idle[0] hash differs from main for every species", not same, str(same))
        bad = [i for i in ids if on[i]["bounds"] != BASE[i]["bounds"] or on[i]["w"] != BASE[i]["w"] or on[i]["h"] != BASE[i]["h"] or on[i]["frames"] != BASE[i]["frames"]]
        check("ON 3 bounds / w / h / frame counts equal main", not bad, str(bad))
        bands = await page.evaluate(TILE_BANDS)
        check("ON 4 terrain tiles <= 4 luminance bands per material", all(v <= 4 for v in bands.values()), str(bands))
        await shoot(page, save_id, "on")

        check("TOGGLE no console errors with the flag off", not console_errors["off"], str(console_errors["off"])[:300])
        check("TOGGLE no console errors with the flag on", not console_errors["on"], str(console_errors["on"])[:300])
        await page.evaluate("(async () => { try { await window.__game.deleteSave('%s'); } catch (e) {} })()" % save_id)
        await browser.close()

    print(f"\n{sum(results)}/{len(results)} checks passed")
    sys.exit(0 if all(results) else 1)


asyncio.run(main())
