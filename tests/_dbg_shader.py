import asyncio, sys
sys.path.insert(0, '/app/tests')
from playwright.async_api import async_playwright
from phase6_helpers import boot
from config import URL

SCENE = """(() => { const g = window.__game; g.setPaused(true); const s = g.state; s.cash = 1e9;
  g.dev.flatten(36, 26, 60, 48, 2); g.dev.fenceRect(40, 30, 46, 36, 1); g.dev.fenceRect(48, 30, 54, 36, 4);
  g.dev.addCreature('karrgan', 41, 31); g.dev.addCreature('veyra', 44, 34); g.dev.addCreature('aurox', 51, 33);
  g.dev.spawnBuilding('admin', 40, 40); g.dev.spawnBuilding('security_post', 47, 40);
  for (let x = 44; x < 56; x++) { s.paths[43 * s.size + x] = 1; }
  for (let y = 26; y < 30; y++) for (let x = 44; x < 50; x++) { s.water[y * s.size + x] = (x > 45 && x < 48 && y > 26 && y < 29) ? 2 : 1; }
  s._terrainDirty = true; g.stepTicks(2); window.__gameRenderer.centerOn(47, 35); })()"""

async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
        page = await browser.new_page(viewport={"width": 1400, "height": 800})
        logs = []
        page.on("console", lambda m: logs.append(m.text[:300]) if m.type in ("error", "warning") else None)
        await boot(page, URL + "?gfx=" + (sys.argv[1] if len(sys.argv) > 1 else "low"))
        await page.evaluate(SCENE)
        await page.wait_for_timeout(2500)
        out = await page.evaluate("""(() => { const w = window.__world3d; const gl = w.renderer.getContext();
          const a = w.registry.atlas; const d = a.albedo.image.data; let nz = 0; for (let i = 0; i < 4096; i += 4) if (d[i]) nz++;
          return { err: gl.getError(), loaded: a.loaded, nz, sample: Array.from(d.slice(0, 8)), sunI: w.lights.sun.intensity, hemi: w.lights.hemi.intensity, exp: w.renderer.toneMappingExposure, fog: [w.lights.fog.near, w.lights.fog.far], camPos: w.camera.position.toArray().map((v) => v.toFixed(1)), terrainVisible: w.terrain.mesh.visible, matNeedsUpdate: w.terrain.material.needsUpdate, progs: w.renderer.info.programs.length }; })()""")
        print(out)
        await page.screenshot(path="/tmp/dbg_a.png")
        await page.evaluate("(() => { const s = window.__game.state; s.tick = Math.floor(s.tick / 1800) * 1800 + 1500; s.weather = { type: 'clear', ticksLeft: 9000 }; window.__game.stepTicks(1); })()")
        await page.wait_for_timeout(1500)
        await page.screenshot(path="/tmp/dbg_night.png")
        await page.evaluate("(() => { const s = window.__game.state; s.tick = Math.floor(s.tick / 1800) * 1800 + 1200; s.weather = { type: 'storm', ticksLeft: 9000 }; window.__game.stepTicks(1); })()")
        await page.wait_for_timeout(1500)
        await page.screenshot(path="/tmp/dbg_dusk_storm.png")
        print("LOGS:", logs[:6])
        await browser.close()

asyncio.run(main())
