"""Renders a review gallery of creature sheets to /app/artifacts/gallery_<set>[_night].png.

Rows: idle f0 / walk f2 / threat f1 / lunge f2 / blink f0.
Usage: python tests/art_gallery.py [a|b|c] [night]
"""
import asyncio, os, sys, json
from playwright.async_api import async_playwright

from config import URL
SETS = {
    "a": ["veyra", "skitter", "thornback", "hollowcrest", "mirefin", "silttitan", "shardling", "mosswarden"],
    "b": ["rhoak", "vantha", "karrgan", "lumen", "umbra", "voltari", "emberoot"],
    "c": ["nyxarr", "zephyrmaw", "aurox", "sylvarr"],
}

SCRIPT = """([ids, night]) => {
  const r = window.__gameRenderer;
  const Z = 2; const pad = 14;
  let x = pad; let maxH = 0; const cols = [];
  for (const id of ids) { const sh = r.sheetFor(id); if (!sh) continue; cols.push({ id, sh, x }); x += sh.w * Z + pad; maxH = Math.max(maxH, sh.h * Z); }
  const rows = 5;
  const cv = document.createElement('canvas'); cv.width = x; cv.height = rows * (maxH + 26) + 10; cv.id = 'gallery';
  cv.style.cssText = 'position:fixed;left:0;top:0;z-index:99999;background:' + (night ? '#0b1410' : '#1c2a24') + ';image-rendering:pixelated';
  document.body.appendChild(cv);
  const ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false;
  ctx.font = '11px monospace';
  const labels = ['idle', 'walk', 'threat', 'lunge', 'blink'];
  const out = {};
  cols.forEach(({ id, sh, x }) => {
    const pick = [sh.idle[0], sh.walk ? sh.walk[2] : null, sh.threat ? sh.threat[1] : null, sh.lunge ? sh.lunge[2] : null, sh.blink ? sh.blink[0] : null];
    const eyesPick = [sh.eyesBy.idle[0], sh.eyesBy.walk ? sh.eyesBy.walk[2] : [], sh.eyesBy.threat ? sh.eyesBy.threat[1] : [], sh.eyesBy.lunge ? sh.eyesBy.lunge[2] : [], []];
    pick.forEach((fr, row) => { const y = 8 + row * (maxH + 26);
      ctx.fillStyle = '#9fb'; ctx.fillText(id + ' ' + labels[row], x, y + 10);
      if (!fr) return;
      const dy = y + 14 + (maxH - sh.h * Z);
      if (night) { ctx.save(); ctx.globalAlpha = 0.62; ctx.filter = 'brightness(0.55) saturate(0.8)'; ctx.drawImage(fr, x, dy, sh.w * Z, sh.h * Z); ctx.restore(); }
      else ctx.drawImage(fr, x, dy, sh.w * Z, sh.h * Z);
      if (night && sh.menace) { // preview of the renderer's eye-glow pass
        ctx.save(); ctx.shadowColor = sh.menace; ctx.shadowBlur = 8; ctx.fillStyle = sh.menace;
        for (const e of eyesPick[row] || []) ctx.fillRect(x + e.x * Z, dy + e.y * Z, e.w * Z, e.h * Z);
        ctx.restore();
      }
    });
    out[id] = { w: sh.w, h: sh.h, idle: sh.idle.length, walk: sh.walk ? sh.walk.length : 0, threat: sh.threat ? sh.threat.length : 0,
      lunge: sh.lunge ? sh.lunge.length : 0, eyes: sh.eyes ? sh.eyes.length : 0, blink: !!sh.blink, scale: sh.scale, menace: sh.menace, pace: sh.pace, aura: sh.aura ? sh.aura.kind : null };
  });
  return { w: cv.width, h: cv.height, out };
}"""


async def main():
    which = sys.argv[1] if len(sys.argv) > 1 else "a"
    night = len(sys.argv) > 2 and sys.argv[2] == "night"
    ids = SETS[which]
    os.makedirs("/app/artifacts", exist_ok=True)
    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        page = await browser.new_page(viewport={"width": 1900, "height": 1000})
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)[:300]))
        await page.goto(URL, wait_until="networkidle", timeout=30000)
        await page.wait_for_timeout(1000)
        await page.evaluate("localStorage.setItem('aetherion_tutorial_done','1')")
        await page.click('[data-testid="mode-sandbox"]')
        await page.click('[data-testid="start-game-button"]')
        await page.wait_for_timeout(1500)
        await page.click('[data-testid="hud-time-pause-button"]')
        res = await page.evaluate(SCRIPT, [ids, night])
        print(json.dumps(res["out"], indent=0))
        await page.wait_for_timeout(300)
        suffix = "_night" if night else ""
        await page.locator("#gallery").screenshot(path=f"/app/artifacts/gallery_{which}{suffix}.png")
        print("errors:", errors)
        await browser.close()


asyncio.run(main())
