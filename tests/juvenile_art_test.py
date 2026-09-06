"""Juvenile proportions (Phase L1) acceptance in a real browser.

  sheets  for all 19 species: cub / young sheets derive from the adult without mutating it;
          idle[0] hashes differ per stage; frame counts, w, h unchanged; the cub silhouette is
          shorter and its head-width : height ratio is larger than the adult's ("big head, stubby
          legs"); eye rects are preserved per frame, remapped onto solid pixels, and the cub blink
          frame only differs from the cub idle frame around those remapped eyes.
  adult   with ART_V2 off the adult idle[0] hashes still equal tests/art_v2_baseline.json
          (the adult bake path is untouched).
  ingame  a juvenile creature renders without errors; the inspect portrait uses the cub sheet
          (data-stage) and its pixels differ from the adult portrait.

Usage: AETHERION_URL=... python tests/juvenile_art_test.py   (preview URL by default)
"""
import asyncio, json, os, sys
from playwright.async_api import async_playwright

from config import URL

HERE = os.path.dirname(os.path.abspath(__file__))
BASE = json.load(open(os.path.join(HERE, "art_v2_baseline.json")))
results = []


def check(name, ok, detail=""):
    results.append(bool(ok))
    print(f"{'PASS' if ok else 'FAIL'} {name} {detail}")


SHEETS = """(() => { const r = window.__gameRenderer; const out = {};
  const fnv = (d) => { let h = 2166136261; for (let i = 0; i < d.length; i++) { h ^= d[i]; h = Math.imul(h, 16777619) >>> 0; } return h; };
  const px = (cv) => cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
  const hc = (cv) => fnv(px(cv));
  const solid = (d, w, x, y) => d[(y * w + x) * 4 + 3] >= 200;
  const measure = (sh) => { const d = px(sh.idle[0]), w = sh.idle[0].width, hh = sh.idle[0].height, b = sh.bounds;
    // head-mass share: solid pixels within a box around the eye anchor (box = 0.42 x adult silhouette height) / all solid pixels
    const rects = sh.eyesBy.idle[0] || []; if (!rects.length) return { h: b.h, w: b.w, headShare: null };
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const e of rects) { x0 = Math.min(x0, e.x); y0 = Math.min(y0, e.y); x1 = Math.max(x1, e.x + e.w); y1 = Math.max(y1, e.y + e.h); }
    const ax = (x0 + x1) / 2, ay = (y0 + y1) / 2, R = Math.max(4, Math.round(sh.h * 0.21));
    let all = 0, near = 0; for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) { if (!solid(d, w, x, y)) continue; all++; if (Math.abs(x - ax) <= R && Math.abs(y - ay) <= R) near++; }
    return { h: b.h, w: b.w, headShare: near / all }; };
  const eyesOk = (sh) => { let total = 0, onSolid = 0; (sh.eyesBy.idle || []).forEach((rects, i) => { const d = px(sh.idle[i]), w = sh.idle[i].width;
    for (const e of rects) { total++; const cx = Math.min(w - 1, e.x + Math.floor(e.w / 2)), cy = e.y + Math.floor(e.h / 2); if (cy >= 0 && cy < sh.idle[i].height && solid(d, w, cx, cy)) onSolid++; } });
    return { total, onSolid }; };
  const blinkLocal = (sh) => { if (!sh.blink) return null; const a = px(sh.idle[0]), b = px(sh.blink[0]), w = sh.idle[0].width; let diff = 0, inside = 0;
    const rects = sh.eyesBy.idle[0] || [];
    for (let i = 0; i < a.length; i += 4) { if (a[i] === b[i] && a[i+1] === b[i+1] && a[i+2] === b[i+2] && a[i+3] === b[i+3]) continue; diff++;
      const p = i / 4, x = p % w, y = Math.floor(p / w);
      if (rects.some((e) => x >= e.x - 3 && x < e.x + e.w + 3 && y >= e.y - 3 && y < e.y + e.h + 3)) inside++; }
    return { diff, inside }; };
  for (const id of Object.keys(window.__game.state.knowledge).sort()) {
    const adult = r.sheetFor(id); const before = hc(adult.idle[0]);
    const cub = r.sheetFor(id, 'cub'), young = r.sheetFor(id, 'young');
    const after = hc(adult.idle[0]);
    const counts = (sh) => [sh.idle.length, sh.walk ? sh.walk.length : 0, sh.threat ? sh.threat.length : 0, sh.lunge ? sh.lunge.length : 0, sh.blink ? sh.blink.length : 0].join(',');
    const eyeCounts = (sh) => (sh.eyesBy.idle || []).map((e) => e.length).join(',');
    out[id] = { adultBefore: before, adultAfter: after, cub: hc(cub.idle[0]), young: hc(young.idle[0]),
      sameDims: cub.w === adult.w && cub.h === adult.h && young.w === adult.w && young.h === adult.h,
      sameCounts: counts(cub) === counts(adult) && counts(young) === counts(adult),
      sameEyeCounts: eyeCounts(cub) === eyeCounts(adult) && eyeCounts(young) === eyeCounts(adult),
      adultM: measure(adult), cubM: measure(cub), youngM: measure(young), cubEyes: eyesOk(cub), cubBlink: blinkLocal(cub), stage: cub.stage + '/' + young.stage + '/' + (adult.stage || 'adult') };
  }
  return out; })()"""

PORTRAITS = """(() => { const fnv = (d) => { let h = 2166136261; for (let i = 0; i < d.length; i++) { h ^= d[i]; h = Math.imul(h, 16777619) >>> 0; } return h; };
  const draw = (stage) => { const cv = document.createElement('canvas'); cv.width = 144; cv.height = 144; window.__gameRenderer.portraitFor(cv, 'skitter', stage); return fnv(cv.getContext('2d').getImageData(0, 0, 144, 144).data); };
  return { adult: draw('adult'), cub: draw('cub'), young: draw('young') }; })()"""


async def boot(page, art_v2=None):
    await page.goto(URL, wait_until="networkidle", timeout=30000)
    await page.evaluate("localStorage.setItem('aetherion_tutorial_done','1'); localStorage.removeItem('aetherion.artV2'); localStorage.removeItem('aetherion_scenarios_done')")
    if art_v2:
        await page.evaluate("localStorage.setItem('aetherion.artV2', '%s')" % art_v2)
    await page.reload(wait_until="networkidle")
    await page.wait_for_timeout(900)


async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        page = await browser.new_page(viewport={"width": 1600, "height": 900})
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)[:160]))
        page.on("console", lambda m: errors.append(m.text[:160]) if m.type == "error" else None)

        # ---- default build (ART_V2 on): derived sheets ----
        await boot(page)
        await page.click('[data-testid="mode-sandbox"]')
        await page.click('[data-testid="start-game-button"]')
        await page.wait_for_timeout(1200)
        await page.click('[data-testid="hud-time-pause-button"]')
        d = await page.evaluate(SHEETS)
        ids = sorted(d.keys())
        check("SHEET 1 19 species, stage tags cub/young/adult", len(ids) == 19 and all(d[i]["stage"] == "cub/young/adult" for i in ids), str(len(ids)))
        check("SHEET 2 deriving juveniles never mutates the adult frames", all(d[i]["adultBefore"] == d[i]["adultAfter"] for i in ids))
        bad = [i for i in ids if d[i]["cub"] == d[i]["adultBefore"] or d[i]["young"] == d[i]["adultBefore"] or d[i]["cub"] == d[i]["young"]]
        check("SHEET 3 cub / young / adult idle[0] all differ", not bad, str(bad))
        check("SHEET 4 canvas size + frame counts preserved per stage", all(d[i]["sameDims"] and d[i]["sameCounts"] for i in ids))
        shorter = [i for i in ids if not (d[i]["cubM"]["h"] < d[i]["adultM"]["h"] and d[i]["youngM"]["h"] < d[i]["adultM"]["h"])]
        check("SHEET 5 cub and young silhouettes are shorter than the adult", not shorter, str(shorter))
        eyed = [i for i in ids if d[i]["adultM"]["headShare"] is not None]
        bigger = [i for i in eyed if not (d[i]["cubM"]["headShare"] > d[i]["adultM"]["headShare"] * 1.1)]
        check("SHEET 6 cub head-mass share (solid pixels around the eyes) >= 1.1x the adult's for every eyed species", len(eyed) >= 17 and not bigger,
              str([(i, round(d[i]["adultM"]["headShare"], 3), round(d[i]["cubM"]["headShare"], 3)) for i in bigger])[:300])
        check("SHEET 7 per-frame eye rect counts preserved", all(d[i]["sameEyeCounts"] for i in ids))
        off = [i for i in ids if d[i]["cubEyes"]["total"] and d[i]["cubEyes"]["onSolid"] < d[i]["cubEyes"]["total"]]
        check("SHEET 8 remapped cub eye rects sit on solid pixels", not off, str(off))
        loose = [i for i in ids if d[i]["cubBlink"] and (d[i]["cubBlink"]["diff"] == 0 or d[i]["cubBlink"]["inside"] < d[i]["cubBlink"]["diff"] * 0.85)]
        check("SHEET 9 cub blink frame differs from idle only around the remapped eyes", not loose, str([(i, d[i]["cubBlink"]) for i in loose])[:240])

        # ---- in-game: juvenile renders, inspect portrait uses the cub sheet ----
        await page.click('[data-testid="hud-exit-button"]')
        await page.wait_for_timeout(600)
        await page.click('[data-testid="mode-scenario"]')
        await page.click('[data-testid="scenario-card-skitter_bloom"]')
        await page.click('[data-testid="start-game-button"]')
        await page.wait_for_timeout(1500)
        await page.click('[data-testid="hud-time-pause-button"]')
        pos = await page.evaluate("""(() => { const s = window.__game.state, r = window.__gameRenderer; const c = s.creatures[1];
            c.juvenile = true; c.growth = 0.1; c.path = []; r.cam.zoom = 3; r.centerOn(c.x, c.y);
            const h = s.heights[Math.floor(c.y) * s.size + Math.floor(c.x)] || 0;
            const wx = (c.x - c.y) * 32, wy = (c.x + c.y) * 16 - h * 10; return { x: wx * r.cam.zoom + r.cam.x, y: wy * r.cam.zoom + r.cam.y - 10 }; })()""")
        await page.wait_for_timeout(500)
        n_err = len(errors)
        await page.mouse.click(pos["x"], pos["y"])
        await page.wait_for_timeout(500)
        badge = await page.locator('[data-testid="creature-juvenile-badge"]').count()
        stage = await page.locator('[data-testid="inspect-panel"] [data-testid^="portrait-"]').first.get_attribute("data-stage") if badge else None
        check("GAME 1 juvenile renders and its dossier portrait uses the cub sheet", badge == 1 and stage == "cub" and len(errors) == n_err, f"badge={badge} stage={stage}")
        p = await page.evaluate(PORTRAITS)
        check("GAME 2 portrait pixels differ between adult / cub / young", len({p["adult"], p["cub"], p["young"]}) == 3, str(p))

        # ---- ART_V2 off: adult bake path untouched ----
        await boot(page, "off")
        await page.click('[data-testid="mode-sandbox"]')
        await page.click('[data-testid="start-game-button"]')
        await page.wait_for_timeout(1200)
        await page.click('[data-testid="hud-time-pause-button"]')
        d2 = await page.evaluate(SHEETS)
        bad = [i for i in sorted(BASE.keys()) if d2[i]["adultAfter"] != BASE[i]["idle0"]]
        check("ADULT 1 with ART_V2 off, adult idle[0] hashes still equal the recorded main baseline", not bad, str(bad))
        check("ADULT 2 juvenile stages also derive with ART_V2 off (hashes differ from adult)", all(d2[i]["cub"] != d2[i]["adultAfter"] for i in d2))

        check("NO console / page errors", not errors, str(errors)[:300])
        await browser.close()

    print(f"\n{sum(results)}/{len(results)} checks passed")
    sys.exit(0 if all(results) else 1)


asyncio.run(main())
