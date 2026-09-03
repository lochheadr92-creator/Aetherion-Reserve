"""Quick headless render-perf probe: frames/sec with and without a creature crowd (Phase G cost check)."""
import asyncio, os, sys
from playwright.async_api import async_playwright

URL = os.environ.get("AETHERION_URL", "https://discovery-bio.preview.emergentagent.com")
SPAWN = """(n) => { const s = window.__game.state;
  const ids = ['veyra','skitter','thornback','hollowcrest','mirefin','silttitan','shardling','mosswarden','rhoak','vantha','karrgan','lumen','umbra','voltari','emberoot','nyxarr','zephyrmaw','aurox','sylvarr'];
  for (let i = 0; i < n; i++) { const sid = ids[i % ids.length];
    s.creatures.push({ id: s.nextId++, speciesId: sid, name: sid + i, x: 40 + (i % 6) * 3 + 0.5, y: 6 + Math.floor(i / 6) * 3 + 0.5, path: [], state: 'idle', stateTicks: 0, actionTicks: 0,
      needs: { hunger: 0.8, thirst: 0.8, energy: 0.9 }, welfare: 0.7, comfort: 0.7, stress: i % 4 === 0 ? 0.9 : 0.1, health: 1, factors: [], enclosureId: null, homeTile: { x: 40, y: 6 }, escaped: i % 7 === 0, dir: 1, trait: 'Calm', genes: null }); }
  s._encDirty = true; return s.creatures.length; }"""


async def fps(page, ms=3000):
    f0 = await page.evaluate("window.__gameRenderer.frame")
    await page.wait_for_timeout(ms)
    f1 = await page.evaluate("window.__gameRenderer.frame")
    return (f1 - f0) / (ms / 1000)


async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        page = await browser.new_page(viewport={"width": 1600, "height": 900})
        await page.goto(URL, wait_until="networkidle", timeout=30000)
        await page.wait_for_timeout(1000)
        await page.evaluate("localStorage.setItem('aetherion_tutorial_done','1')")
        await page.click('[data-testid="mode-sandbox"]')
        await page.click('[data-testid="start-game-button"]')
        await page.wait_for_timeout(1500)
        base = await fps(page)
        await page.evaluate("(() => { const s = window.__game.state; s.tick = Math.floor(s.tick / 1800) * 1800 + 1500; s._terrainDirty = true; })()")
        await page.wait_for_timeout(800)
        base_night = await fps(page)
        await page.evaluate("(() => { const s = window.__game.state; s.tick = Math.floor(s.tick / 1800) * 1800 + 300; s._terrainDirty = true; })()")
        await page.wait_for_timeout(800)
        await page.evaluate(SPAWN, 24)
        await page.evaluate("(() => { const r = window.__gameRenderer; r.cam.zoom = 1.2; r.centerOn(47, 10); })()")
        await page.wait_for_timeout(1500)  # let all sheets bake
        day = await fps(page)
        await page.evaluate("(() => { const s = window.__game.state; s.tick = Math.floor(s.tick / 1800) * 1800 + 1500; s._terrainDirty = true; })()")
        await page.wait_for_timeout(800)
        night = await fps(page)
        parts = await page.evaluate("window.__gameRenderer.fx.particles.length")
        print(f"fps baseline={base:.1f} baseline_night={base_night:.1f} crowd24_day={day:.1f} crowd24_night={night:.1f} particles={parts}")
        await browser.close()


asyncio.run(main())
