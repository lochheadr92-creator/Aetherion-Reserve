"""Renders a juvenile review gallery to /app/artifacts/juveniles_<set>.png.

Rows per species: adult idle f0 / cub idle f0 / young idle f0 / cub walk f2 / cub blink f0.
Usage: python tests/juvenile_gallery.py [a|b|c]
"""
import asyncio, os, sys, json
from playwright.async_api import async_playwright

from config import URL
from art_gallery import SETS

SCRIPT = """(ids) => {
  const r = window.__gameRenderer;
  const Z = 3; const pad = 14;
  let x = pad; let maxH = 0; const cols = [];
  for (const id of ids) { const sh = r.sheetFor(id); if (!sh) continue; cols.push({ id, x, adult: sh, cub: r.sheetFor(id, 'cub'), young: r.sheetFor(id, 'young') }); x += sh.w * Z + pad; maxH = Math.max(maxH, sh.h * Z); }
  const rows = 5;
  const cv = document.createElement('canvas'); cv.width = x; cv.height = rows * (maxH + 26) + 10; cv.id = 'gallery';
  cv.style.cssText = 'position:fixed;left:0;top:0;z-index:99999;background:#1c2a24;image-rendering:pixelated';
  document.body.appendChild(cv);
  const ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false;
  ctx.font = '11px monospace';
  const labels = ['adult', 'cub', 'young', 'cub walk', 'cub blink'];
  const out = {};
  cols.forEach(({ id, x, adult, cub, young }) => {
    const pick = [adult.idle[0], cub.idle[0], young.idle[0], cub.walk ? cub.walk[2] : null, cub.blink ? cub.blink[0] : null];
    pick.forEach((fr, row) => { const y = 8 + row * (maxH + 26);
      ctx.fillStyle = '#9fb'; ctx.fillText(id + ' ' + labels[row], x, y + 10);
      if (!fr) return;
      const dy = y + 14 + (maxH - adult.h * Z);
      ctx.drawImage(fr, x, dy, adult.w * Z, adult.h * Z);
      // eye rects overlay (exactness check): cub idle eyes
      if (row === 1) { ctx.strokeStyle = 'rgba(255,80,80,0.9)'; for (const e of cub.eyesBy.idle[0] || []) ctx.strokeRect(x + e.x * Z + 0.5, dy + e.y * Z + 0.5, e.w * Z, e.h * Z); }
    });
    out[id] = { adult: adult.bounds, cub: cub.bounds, young: young.bounds, eyes: (adult.eyes || []).length, cubEyes: (cub.eyes || []).length };
  });
  return { w: cv.width, h: cv.height, out };
}"""


async def main():
    which = sys.argv[1] if len(sys.argv) > 1 else "a"
    ids = SETS[which]
    os.makedirs("/app/artifacts", exist_ok=True)
    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        page = await browser.new_page(viewport={"width": 1900, "height": 1000})
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)[:300]))
        await page.goto(URL, wait_until="networkidle", timeout=30000)
        await page.evaluate("localStorage.setItem('aetherion_tutorial_done','1')")
        await page.click('[data-testid="mode-sandbox"]')
        await page.click('[data-testid="start-game-button"]')
        await page.wait_for_timeout(1200)
        await page.click('[data-testid="hud-time-pause-button"]')
        info = await page.evaluate(SCRIPT, ids)
        await page.locator("#gallery").screenshot(path=f"/app/artifacts/juveniles_{which}.png")
        print(json.dumps(info["out"], indent=1))
        print("errors:", errors)
        await browser.close()


asyncio.run(main())
