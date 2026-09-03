"""Phase G — creature art rework verification.

Checks every species sheet bakes with the rich animation set (idle 6 / walk 8 /
threat 4 / lunge 4), that eyes are recorded for exact blink + night eye-glow,
that threat/lunge/walk frames are genuinely different from idle, that predator
menace metadata is present, and that species auras emit in-world at night.
Also captures day/night in-world screenshots to /app/artifacts/ for review.

Usage: python tests/creature_art_test.py
"""
import asyncio, os, sys
from playwright.async_api import async_playwright

from config import URL
SPECIES = ["veyra", "skitter", "thornback", "hollowcrest", "mirefin", "silttitan", "shardling", "mosswarden",
           "rhoak", "vantha", "karrgan", "lumen", "umbra", "voltari", "emberoot",
           "nyxarr", "zephyrmaw", "aurox", "sylvarr"]
FLOATERS = {"lumen"}  # bob instead of walking
PREDATORS = {"mirefin", "vantha", "karrgan", "umbra", "nyxarr", "zephyrmaw"}
AURA_SPECIES = {"shardling", "mosswarden", "rhoak", "vantha", "lumen", "umbra", "voltari", "emberoot", "nyxarr", "zephyrmaw", "sylvarr"}

results = []


def check(name, ok, detail=""):
    results.append(ok)
    print(f"{'PASS' if ok else 'FAIL'} {name} {detail}")


SHEET_INFO = """(ids) => {
  const r = window.__gameRenderer;
  const diff = (a, b) => { const w = a.width, h = a.height;
    const A = a.getContext('2d').getImageData(0, 0, w, h).data, B = b.getContext('2d').getImageData(0, 0, w, h).data;
    let n = 0; for (let i = 0; i < A.length; i += 4) { if (A[i] !== B[i] || A[i+1] !== B[i+1] || A[i+2] !== B[i+2] || A[i+3] !== B[i+3]) n++; } return n; };
  const opaque = (cv) => { const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 40) n++; return n; };
  const out = {};
  for (const id of ids) {
    const sh = r.sheetFor(id);
    if (!sh) { out[id] = null; continue; }
    out[id] = {
      w: sh.w, h: sh.h, scale: sh.scale,
      idle: sh.idle.length, walk: sh.walk ? sh.walk.length : 0, threat: sh.threat ? sh.threat.length : 0, lunge: sh.lunge ? sh.lunge.length : 0,
      eyes: sh.eyes ? sh.eyes.length : 0, blink: !!sh.blink, menace: sh.menace, pace: sh.pace, aura: sh.aura ? sh.aura.kind : null,
      eyesByOk: !!(sh.eyesBy && sh.eyesBy.idle && sh.eyesBy.idle.length === sh.idle.length
                   && (!sh.threat || (sh.eyesBy.threat && sh.eyesBy.threat.length === sh.threat.length))
                   && (!sh.lunge || (sh.eyesBy.lunge && sh.eyesBy.lunge.length === sh.lunge.length))),
      px: opaque(sh.idle[0]),
      dThreat: sh.threat ? diff(sh.idle[0], sh.threat[1]) : -1,
      dLunge: sh.lunge ? diff(sh.idle[0], sh.lunge[2]) : -1,
      dWalk: sh.walk ? diff(sh.walk[0], sh.walk[4]) : -1,
      dIdle: diff(sh.idle[0], sh.idle[3]),
      dBlink: sh.blink ? diff(sh.idle[0], sh.blink[0]) : -1,
      // no frame may be empty / clipped to nothing
      minPx: Math.min(...[...sh.idle, ...(sh.walk || []), ...(sh.threat || []), ...(sh.lunge || [])].map(opaque)),
    };
  }
  return out;
}"""

SPAWN = """(() => { const s = window.__game.state;
  const mk = (sid, x, y, extra) => ({
    id: s.nextId++, speciesId: sid, name: sid + '-art', x: x + 0.5, y: y + 0.5, path: [], state: 'idle', stateTicks: 0, actionTicks: 0,
    needs: { hunger: 0.8, thirst: 0.8, energy: 0.9 }, welfare: 0.7, comfort: 0.7, stress: 0.1, health: 1,
    factors: [], enclosureId: null, homeTile: { x, y }, escaped: false, dir: 1, trait: 'Calm', genes: null, ...extra });
  s.creatures.push(mk('nyxarr', 44, 6, { escaped: true, stress: 0.9 }));       // lunge/threat display
  s.creatures.push(mk('karrgan', 49, 6, { state: 'eating' }));                  // feeding lunge
  s.creatures.push(mk('vantha', 53, 8, { stress: 0.7 }));                       // threat display
  s.creatures.push(mk('umbra', 44, 11, {}));                                    // idle predator (night eyes)
  s.creatures.push(mk('aurox', 49, 11, {}));                                    // idle herbivore
  s.creatures.push(mk('veyra', 53, 12, { dir: -1 }));                           // flipped
  s.creatures.push(mk('sylvarr', 46, 15, {}));
  s.creatures.push(mk('emberoot', 51, 15, {}));                                 // ember aura (always on)
  s.creatures.push(mk('voltari', 55, 16, {}));                                  // spark aura
  s._encDirty = true; return s.creatures.length; })()"""


async def main():
    os.makedirs("/app/artifacts", exist_ok=True)
    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        page = await browser.new_page(viewport={"width": 1600, "height": 900})
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)[:300]))
        await page.goto(URL, wait_until="networkidle", timeout=30000)
        await page.wait_for_timeout(1000)
        await page.evaluate("localStorage.setItem('aetherion_tutorial_done','1')")
        await page.click('[data-testid="mode-sandbox"]')
        await page.click('[data-testid="start-game-button"]')
        await page.wait_for_timeout(1500)
        await page.click('[data-testid="hud-time-pause-button"]')
        await page.wait_for_timeout(200)

        info = await page.evaluate(SHEET_INFO, SPECIES)
        check("ART 1 all 19 species bake a sheet", all(info[s] for s in SPECIES), str([s for s in SPECIES if not info[s]]))
        bad = [s for s in SPECIES if info[s] and (info[s]["idle"] != 6 or info[s]["threat"] != 4 or info[s]["lunge"] != 4
                                                 or info[s]["walk"] != (0 if s in FLOATERS else 8))]
        check("ART 2 frame counts idle 6 / walk 8 / threat 4 / lunge 4", not bad, str(bad))
        check("ART 3 every species is a scale-1 crisp painter", all(info[s]["scale"] == 1 for s in SPECIES), "")
        noeyes = [s for s in SPECIES if info[s]["eyes"] < 1 or not info[s]["blink"]]
        check("ART 4 eyes recorded + blink frame for every species", not noeyes, str(noeyes))
        check("ART 5 per-mode eye rects recorded (eyesBy)", all(info[s]["eyesByOk"] for s in SPECIES), "")
        flat_t = [s for s in SPECIES if info[s]["dThreat"] < 40]
        flat_l = [s for s in SPECIES if info[s]["dLunge"] < 60]
        check("ART 6 threat frames differ from idle", not flat_t, str(flat_t))
        check("ART 7 lunge frames differ from idle (whole-body kinematics)", not flat_l, str(flat_l))
        flat_w = [s for s in SPECIES if s not in FLOATERS and info[s]["dWalk"] < 20]
        check("ART 8 8-frame walk cycle animates (f0 vs f4)", not flat_w, str(flat_w))
        flat_i = [s for s in SPECIES if info[s]["dIdle"] < 2]
        check("ART 9 idle frames breathe / move", not flat_i, str(flat_i))
        check("ART 10 blink frame differs from idle by a small eye-sized patch",
              all(1 <= info[s]["dBlink"] <= 60 for s in SPECIES), str({s: info[s]["dBlink"] for s in SPECIES}))
        men = [s for s in SPECIES if bool(info[s]["menace"]) != (s in PREDATORS)]
        check("ART 11 predators carry menace eye-glow metadata (and only predators)", not men, str(men))
        aur = [s for s in AURA_SPECIES if not info[s]["aura"]]
        check("ART 12 aura species carry aura descriptors", not aur, str(aur))
        empty = [s for s in SPECIES if info[s]["minPx"] < 60]
        check("ART 13 no empty/clipped frames", not empty, str(empty))
        check("ART 14 no page errors during baking", not errors, str(errors))

        # ---- in-world: spawn a display group, capture day + night, verify aura emission ----
        n = await page.evaluate(SPAWN)
        await page.evaluate("window.__gameRenderer.centerOn(49, 11)")
        await page.evaluate("(() => { const r = window.__gameRenderer; r.cam.zoom = 2.0; r.centerOn(49, 11); })()")
        await page.wait_for_timeout(700)
        await page.screenshot(path="/app/artifacts/creatures_ingame_day.png")
        # night (tick fraction 0.833 → night)
        await page.evaluate("(() => { const s = window.__game.state; s.tick = Math.floor(s.tick / 1800) * 1800 + 1500; s._terrainDirty = true; })()")
        await page.wait_for_timeout(900)
        auras = await page.evaluate("window.__gameRenderer.fx.particles.filter(p => p.aura).length")
        kinds = await page.evaluate("[...new Set(window.__gameRenderer.fx.particles.filter(p => p.aura).map(p => p.shape))]")
        check("ART 15 species auras emit at night (render-only particles)", auras > 0, f"({auras} particles, shapes {kinds})")
        capped = await page.evaluate("window.__gameRenderer.fx.particles.filter(p => p.aura).length <= 360")
        check("ART 16 aura particle budget respected", capped, "")
        await page.screenshot(path="/app/artifacts/creatures_ingame_night.png")
        # frame selection sanity: escaped nyxarr should be in a threat or lunge display; the renderer must not throw
        st = await page.evaluate("window.__game.state.creatures.filter(c => c.name && c.name.endsWith('-art')).map(c => c.speciesId)")
        check("ART 17 display group rendered without errors", len(st) == 9 and not errors, f"({len(st)} spawned, errors={errors})")
        await browser.close()

    print(f"\n{sum(results)}/{len(results)} checks passed")
    sys.exit(0 if all(results) else 1)


asyncio.run(main())
