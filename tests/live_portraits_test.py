"""Live Portraits (Phase L3) acceptance in a real browser.

  live    Species Database portraits (dock drawer) carry data-live=on; the detail portrait's
          pixels change over ~1.2s (idle loop) and it blinks within ~5s (a frame equal to the
          blink render); list rows animate too; the shared ticker count (window.__portraitLive)
          matches the mounted portraits and drops to 0 when the drawer closes.
  still   with prefers-reduced-motion: reduce the portraits are data-live=off and their pixels stay
          constant over 1.2s.
  cost    the still image at t=0 equals renderPortrait frame 0 (first paint unchanged), and a
          hidden (scrolled-out) row does not repaint.

Usage: AETHERION_URL=... python tests/live_portraits_test.py   (preview URL by default)
"""
import asyncio, sys
from playwright.async_api import async_playwright

from config import URL

results = []


def check(name, ok, detail=""):
    results.append(bool(ok))
    print(f"{'PASS' if ok else 'FAIL'} {name} {detail}")


HASH = """(sel) => { const fnv = (d) => { let h = 2166136261; for (let i = 0; i < d.length; i++) { h ^= d[i]; h = Math.imul(h, 16777619) >>> 0; } return h; };
  const cv = document.querySelector(sel); if (!cv) return null; return fnv(cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data); }"""

REF = """([id, size, frame, blink]) => { const fnv = (d) => { let h = 2166136261; for (let i = 0; i < d.length; i++) { h ^= d[i]; h = Math.imul(h, 16777619) >>> 0; } return h; };
  const cv = document.createElement('canvas'); cv.width = size; cv.height = size; window.__gameRenderer.portraitFor(cv, id, 'adult', { frame, blink });
  return fnv(cv.getContext('2d').getImageData(0, 0, size, size).data); }"""

DETAIL = '[data-testid="species-detail"] [data-testid="portrait-veyra"]'


async def boot(page):
    await page.goto(URL, wait_until="networkidle", timeout=30000)
    await page.evaluate("localStorage.setItem('aetherion_tutorial_done','1')")
    await page.wait_for_timeout(500)
    await page.click('[data-testid="mode-sandbox"]')
    await page.click('[data-testid="start-game-button"]')
    await page.wait_for_timeout(1200)
    await page.click('[data-testid="hud-time-pause-button"]')
    await page.click('[data-testid="dock-species-database-open-button"]')
    await page.wait_for_timeout(400)


async def samples(page, sel, ms, step=60):
    out = []
    for _ in range(ms // step):
        out.append(await page.evaluate(HASH, sel))
        await page.wait_for_timeout(step)
    return out


async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        page = await browser.new_page(viewport={"width": 1600, "height": 900})
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)[:160]))
        page.on("console", lambda m: errors.append(m.text[:160]) if m.type == "error" else None)

        await boot(page)
        n_live = await page.locator('[data-testid="ops-drawer"] canvas[data-live="on"]').count()
        count = await page.evaluate("window.__portraitLive")
        check("LIVE 1 Species Database portraits are live and registered on the shared ticker", n_live >= 20 and count == n_live, f"canvases={n_live} ticker={count}")
        h = await samples(page, DETAIL, 1200)
        check("LIVE 2 detail portrait pixels change over 1.2s (idle loop)", len(set(h)) >= 2, f"distinct={len(set(h))}")
        # blink: the veyra idle sheet has 6 frames; look for a sample equal to ANY blink-frame render
        blinks = {await page.evaluate(REF, ["veyra", 220, f, True]) for f in range(6)}
        opens = {await page.evaluate(REF, ["veyra", 220, f, False]) for f in range(6)}
        seen = set(await samples(page, DETAIL, 5200, 40))
        check("LIVE 3 detail portrait blinks within ~5s and every sample is a valid idle/blink render",
              bool(seen & blinks) and seen <= (blinks | opens), f"blink hits={len(seen & blinks)} unknown={len(seen - blinks - opens)}")
        row = await samples(page, '[data-testid="species-row-skitter"] canvas', 1200)
        check("LIVE 4 list-row portraits animate as well", len(set(row)) >= 2, f"distinct={len(set(row))}")
        # scrolled-out rows do not repaint: scroll the list to the bottom, sample the top row
        await page.evaluate("document.querySelector('[data-testid=\"species-row-veyra\"]').parentElement.scrollTop = 4000")
        await page.wait_for_timeout(200)
        top = await samples(page, '[data-testid="species-row-veyra"] canvas', 900)
        check("LIVE 5 a scrolled-out row stops repainting", len(set(top)) == 1, f"distinct={len(set(top))}")
        await page.click('[data-testid="drawer-close"]')
        await page.wait_for_timeout(300)
        check("LIVE 6 ticker registry drops to 0 once the drawer closes", await page.evaluate("window.__portraitLive") == 0)

        # ---- reduced motion ----
        await page.emulate_media(reduced_motion="reduce")
        await boot(page)
        n_off = await page.locator('[data-testid="ops-drawer"] canvas[data-live="off"]').count()
        n_on = await page.locator('[data-testid="ops-drawer"] canvas[data-live="on"]').count()
        h0 = await page.evaluate(HASH, DETAIL)
        still = set(await samples(page, DETAIL, 1200))
        ref0 = await page.evaluate(REF, ["veyra", 220, 0, False])
        check("STILL 1 reduced motion: portraits are data-live=off and never repaint", n_off >= 20 and n_on == 0 and still == {h0}, f"off={n_off} on={n_on} distinct={len(still)}")
        check("STILL 2 the still image is the frame-0 portrait (first paint unchanged)", h0 == ref0)

        check("NO console / page errors", not errors, str(errors)[:300])
        await browser.close()

    print(f"\n{sum(results)}/{len(results)} checks passed")
    sys.exit(0 if all(results) else 1)


asyncio.run(main())
