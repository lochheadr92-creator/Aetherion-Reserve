"""Debug helper: force the 3D renderer on SwiftShader, stage a showcase scene, and screenshot.

    python tests/_dbg_3d.py [low|medium|high] [out.png] [zoom] [night 0/1]
"""
import asyncio, sys, time
sys.path.insert(0, '/app/tests')
from playwright.async_api import async_playwright
from config import URL

STAGE = """
(() => {
  const g = window.__game; const s = g.state; const d = g.dev;
  const e = s.entrance; const cx = e.x, cy = e.y;
  d.grant(999999);
  // flat plaza north of the entrance
  d.flatten(cx - 14, cy - 22, cx + 14, cy - 1, 2);
  // paths from the entrance up the middle
  for (let y = cy - 20; y <= cy; y++) s.paths[y * 72 + cx] = 1;
  for (let x = cx - 8; x <= cx + 8; x++) s.paths[(cy - 10) * 72 + x] = 1;
  // buildings
  d.spawnBuilding('admin', cx + 2, cy - 6);
  d.spawnBuilding('lab', cx - 5, cy - 5);
  d.spawnBuilding('food_stall', cx - 3, cy - 9);
  d.spawnBuilding('drink_stall', cx + 2, cy - 9);
  d.spawnBuilding('power', cx + 6, cy - 10);
  d.spawnBuilding('viewing', cx - 7, cy - 13);
  d.spawnBuilding('tower', cx + 6, cy - 14);
  d.spawnBuilding('shelter', cx + 4, cy - 19);
  d.spawnBuilding('feeder_forage', cx + 2, cy - 17);
  d.spawnBuilding('tram_station', cx - 12, cy - 8);
  d.spawnBuilding('tram_station', cx + 10, cy - 18);
  d.spawnBuilding('underwater_dome', cx - 12, cy - 16);
  // enclosures with every fence tier
  d.fenceRect(cx - 9, cy - 21, cx - 1, cy - 14, 1);
  d.fenceRect(cx + 1, cy - 21, cx + 9, cy - 15, 3);
  d.fenceRect(cx - 9, cy - 13, cx - 3, cy - 11, 2);
  d.fenceRect(cx + 9, cy - 13, cx + 13, cy - 8, 4);
  // creatures of every body plan
  d.addCreature('veyra', cx - 6, cy - 18);
  d.addCreature('thornback', cx - 4, cy - 17);
  d.addCreature('skitter', cx - 7, cy - 16);
  d.addCreature('hollowcrest', cx + 3, cy - 18);
  d.addCreature('mirefin', cx + 6, cy - 17);
  d.addCreature('shardling', cx + 7, cy - 20);
  d.addCreature('mosswarden', cx - 6, cy - 12);
  d.addCreature('lumen', cx + 11, cy - 11);
  d.addCreature('voltari', cx + 11, cy - 9);
  d.addCreature('karrgan', cx + 4, cy - 16);
  d.hireStaff('warden'); d.hireStaff('biomedical'); d.hireStaff('xenobiologist');
  // a gate on the T1 pen, shallow + deep water pond near the T4 pen
  const gk = Object.keys(s.fences).find((k) => k.endsWith(',S') && +k.split(',')[1] === cy - 14); if (gk) s.fences[gk].gate = true;
  for (let y = cy - 7; y <= cy - 4; y++) for (let x = cx + 10; x <= cx + 13; x++) { s.water[y * 72 + x] = (x > cx + 10 && x < cx + 13 && y > cy - 7 && y < cy - 4) ? 2 : 1; s.veg[y * 72 + x] = 0; }
  d.addCreature('nyxarr', cx + 3, cy - 20); d.addCreature('sylvarr', cx - 8, cy - 19); d.addCreature('emberoot', cx - 5, cy - 12);
  s.veg[(cy - 3) * 72 + cx - 6] = 4; s.veg[(cy - 3) * 72 + cx + 6] = 3; s.veg[(cy - 2) * 72 + cx - 8] = 2; s.veg[(cy - 4) * 72 + cx + 8] = 6; s.veg[(cy - 2) * 72 + cx + 9] = 7; s.veg[(cy - 4) * 72 + cx - 9] = 5;
  s._terrainDirty = true; s._occDirty = true; s._encDirty = true;
  return { creatures: s.creatures.length, buildings: s.buildings.length, fences: Object.keys(s.fences).length };
})()
"""

async def main():
    q = sys.argv[1] if len(sys.argv) > 1 else "medium"
    out = sys.argv[2] if len(sys.argv) > 2 else "/tmp/dbg_3d.png"
    zoom = float(sys.argv[3]) if len(sys.argv) > 3 else 1.6
    mode = sys.argv[4] if len(sys.argv) > 4 else '0'
    night = mode == '1'
    storm = mode == 'storm'
    focus = [float(v) for v in sys.argv[5].split(',')] if len(sys.argv) > 5 else [0, -12]
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
        page = await browser.new_page(viewport={"width": 1280, "height": 720})
        logs = []
        page.on("console", lambda m: logs.append(m.type + ': ' + m.text[:300]))
        page.on("pageerror", lambda e: logs.append("PAGEERROR: " + str(e)[:300]))
        await page.goto(URL + "?gfx=" + q + "&render3d=1", wait_until="networkidle", timeout=60000)
        await page.evaluate("localStorage.setItem('aetherion_tutorial_done','1')")
        await page.reload(wait_until="networkidle")
        await page.click('[data-testid="mode-sandbox"]', force=True)
        await page.click('[data-testid="start-game-button"]', force=True)
        await page.wait_for_timeout(1500)
        print("staged:", await page.evaluate(STAGE))
        await page.evaluate("window.__game.stepTicks(40)")
        if night:
            await page.evaluate("(() => { const s = window.__game.state; s.tick = Math.floor(1800 * 0.8); })()")
        if storm:
            await page.evaluate("(() => { const s = window.__game.state; s.weather = { type: 'storm', ticksLeft: 900 }; const w = window.__world3d; if (w) w.lights.storm = 1; })()")
        await page.evaluate("window.__game.setPaused(true)")
        # zoom in around the plaza using the renderer camera (same math as worldPx)
        await page.evaluate("""([z, ox, oy]) => { const r = window.__gameRenderer; if (!r) return; const s = r.state; const e = s.entrance;
            r.cam.zoom = z; const W = r.canvas.width, H = r.canvas.height; const fx = e.x + ox, fy = e.y + oy;
            const px = (fx - fy) * 32, py = (fx + fy) * 16 - 20; r.cam.x = W/2 - px * z; r.cam.y = H/2 - py * z; }""", [zoom, focus[0], focus[1]])
        t0 = time.time()
        for i in range(3):
            await page.wait_for_timeout(1500)
            try:
                info = await asyncio.wait_for(page.evaluate("(() => { const w = window.__world3d; const r = window.__gameRenderer; return { mode: window.__renderMode, frame: r && r.frame, q: w && w.quality, ms: w && Math.round(w.stats.frameMs), calls: w && w.stats.drawCalls, tris: w && w.stats.triangles }; })()"), 20)
                print(round(time.time() - t0, 1), info)
            except Exception as e:
                print(round(time.time() - t0, 1), "evaluate timeout", str(e)[:80])
        await page.screenshot(path=out, timeout=150000)
        print("LOGS:", [l for l in logs if 'Canvas2D' not in l and 'DevTools' not in l][:12])
        await browser.close()

asyncio.run(main())
