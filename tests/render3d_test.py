"""Phase R: cinematic 3D world renderer — activation, camera lock, entity layers, overlay hooks.

Part A runs the default headless launch (software GL -> automatic classic fallback must hold, so every
older suite keeps its fast 2D renderer). Part B forces the 3D renderer (?render3d=1 with SwiftShader)
and checks: WebGL world attached, frames advance, the orthographic camera reproduces worldPx() within a
pixel, every entity class has 3D representation synced from state, night/day + quality tiers apply, and
the 2D overlay hooks (selection, hover, tension markers) still run on top. Screenshots are smoke only.

    python tests/render3d_test.py
"""
import asyncio
import sys
from playwright.async_api import async_playwright

from config import URL

GL_ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]

STAGE = """
(() => {
  const g = window.__game; const s = g.state; const d = g.dev;
  const e = s.entrance; const cx = e.x, cy = e.y;
  d.grant(999999);
  d.flatten(cx - 12, cy - 20, cx + 12, cy - 1, 2);
  for (let y = cy - 18; y <= cy; y++) s.paths[y * 72 + cx] = 1;
  d.spawnBuilding('admin', cx + 2, cy - 6);
  d.spawnBuilding('lab', cx - 5, cy - 5);
  d.spawnBuilding('tram_station', cx - 10, cy - 8);
  d.spawnBuilding('tram_station', cx + 8, cy - 16);
  d.fenceRect(cx - 9, cy - 19, cx - 1, cy - 12, 1);
  d.fenceRect(cx + 1, cy - 19, cx + 7, cy - 13, 4);
  d.addCreature('veyra', cx - 6, cy - 16);
  d.addCreature('skitter', cx - 4, cy - 15);
  d.addCreature('lumen', cx + 4, cy - 16);
  d.addCreature('voltari', cx + 3, cy - 15);
  d.hireStaff('warden');
  s.veg[(cy - 3) * 72 + cx - 6] = 4; s.veg[(cy - 3) * 72 + cx + 6] = 3; s.veg[(cy - 2) * 72 + cx + 8] = 6;
  for (let y = cy - 7; y <= cy - 4; y++) for (let x = cx + 9; x <= cx + 11; x++) { s.water[y * 72 + x] = 1; s.veg[y * 72 + x] = 0; }
  s.waste.push({ id: s.nextId++, x: cx - 5, y: cy - 14 });
  s._terrainDirty = true; s._occDirty = true; s._encDirty = true;
  g.stepTicks(60); // transport pairs are (re)checked every 50 ticks
  return { creatures: s.creatures.length, buildings: s.buildings.length, fences: Object.keys(s.fences).length, cars: (s.transport && s.transport.cars || []).length };
})()
"""

PROBE = """
(() => {
  const w = window.__world3d; const r = window.__gameRenderer; const s = window.__game.state;
  if (!w) return { mode: window.__renderMode };
  const ent = w.entities;
  const count = (inst) => inst.mesh.count;
  return {
    mode: window.__renderMode, frame: r.frame, quality: w.quality,
    lockPx: w.verifyCameraLock(r.cam, 0, 0),
    flora: count(ent.flora.smallTrunk) + count(ent.flora.largeTrunk) + count(ent.flora.spore),
    grass: count(ent.flora.grass),
    posts: count(ent.fences.post), field: count(ent.fences.field), rails: count(ent.fences.rail),
    buildingMeshes: Object.keys(ent.buildings.meshes).length, glowTris: ent.buildings.meshes.glow ? ent.buildings.meshes.glow.geometry.attributes.position.count : 0,
    rigs: ent.creatures.rigs.size, rigKinds: [...ent.creatures.rigs.values()].map((x) => x.tpl.kind).sort(),
    people: count(ent.people.torso), waste: count(ent.props.waste), cars: ent.props.cars.size, guideways: ent.props.guideways.size,
    entrance: !!ent.props.entrance, water: w.water.mesh.visible, skirt: w.terrain.skirt.geometry.attributes.position.count,
    night: w.lights.night, exposure: w.renderer.toneMappingExposure,
    rigAt: (() => { const c = s.creatures[0]; const p = ent.creatures.positionOf(c.id); return p ? Math.hypot(p.x - c.x, p.z - c.y) : -1; })(),
  };
})()
"""


async def await_frames(page, n=2, tries=14):
    """Software GL compiles shaders for seconds at a time: wait until n more frames actually rendered."""
    try:
        f0 = await asyncio.wait_for(page.evaluate("window.__gameRenderer.frame"), 60)
    except Exception:
        f0 = 0
    for _ in range(tries):
        await page.wait_for_timeout(2000)
        try:
            f = await asyncio.wait_for(page.evaluate("window.__gameRenderer.frame"), 60)
        except Exception:
            continue
        if f >= f0 + n:
            return True
    return False


async def part_a(pw, results):
    browser = await pw.chromium.launch()
    page = await browser.new_page(viewport={"width": 1280, "height": 720})
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)[:200]))
    await page.goto(URL, wait_until="networkidle", timeout=60000)
    await page.evaluate("localStorage.setItem('aetherion_tutorial_done','1')")
    await page.click('[data-testid="mode-sandbox"]')
    await page.click('[data-testid="start-game-button"]')
    await page.wait_for_timeout(2500)
    info = await page.evaluate("({ mode: window.__renderMode, attr: document.querySelector('[data-testid=game-canvas]').dataset.renderMode, frame: window.__gameRenderer.frame, gl3d: !!document.querySelector('[data-testid=game-canvas-3d]') })")
    # a default headless launch has software GL -> classic 2D stays in charge (keeps the older suites fast);
    # the WebGL canvas is unmounted in classic mode so the legacy DOM baseline is untouched
    results.append(("A1 software GL falls back to the classic renderer (no 3D canvas in DOM)", info["mode"] == "classic" and info["attr"] == "classic" and not info["gl3d"], info))
    results.append(("A2 classic frames advance", info["frame"] > 10, info["frame"]))
    results.append(("A3 no page errors in classic mode", not errors, errors[:2]))
    # ?classic=1 must force classic regardless
    await page.goto(URL + "?classic=1", wait_until="networkidle", timeout=60000)
    await page.click('[data-testid="mode-sandbox"]')
    await page.click('[data-testid="start-game-button"]')
    await page.wait_for_timeout(1500)
    mode = await page.evaluate("window.__renderMode")
    results.append(("A4 ?classic=1 forces the 2D renderer", mode == "classic", mode))
    await browser.close()


async def part_b(pw, results):
    browser = await pw.chromium.launch(args=GL_ARGS)
    page = await browser.new_page(viewport={"width": 1280, "height": 720})
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)[:200]))
    await page.goto(URL + "?gfx=low&render3d=1", wait_until="networkidle", timeout=90000)
    await page.evaluate("localStorage.setItem('aetherion_tutorial_done','1')")
    await page.reload(wait_until="networkidle")
    await page.click('[data-testid="mode-sandbox"]', force=True)
    await page.click('[data-testid="start-game-button"]', force=True)
    await page.wait_for_timeout(1500)
    # software GL compiles the whole material set on the first frames (can block the main thread for 60-90 s)
    staged = await asyncio.wait_for(page.evaluate(STAGE), 180)
    await page.evaluate("window.__game.setPaused(true)")
    # let the (slow, software) pipeline compile + draw a few frames
    for _ in range(3):
        await page.wait_for_timeout(2500)
        try:
            p = await asyncio.wait_for(page.evaluate(PROBE), 60)
            if p.get("mode") == "3d" and p.get("frame", 0) > 5 and p.get("rigs", 0) > 0:
                break
        except Exception:
            p = {"mode": "timeout"}
    results.append(("B1 forced 3D renderer attaches a WebGL world", p.get("mode") == "3d", p.get("mode")))
    if p.get("mode") != "3d":
        await browser.close()
        return
    results.append(("B2 frames advance under 3D", p["frame"] > 5, p["frame"]))
    results.append(("B3 camera lock: ortho projection matches worldPx within 1px", p["lockPx"] < 1.0, round(p["lockPx"], 3)))
    results.append(("B4 flora instanced (trees + spore pillar)", p["flora"] >= 3 and p["grass"] >= 0, (p["flora"], p["grass"])))
    results.append(("B5 fences: posts, rails and a tier-4 energy field", p["posts"] > 40 and p["rails"] > 20 and p["field"] > 10, (p["posts"], p["rails"], p["field"])))
    results.append(("B6 buildings merged into material meshes with emissive windows", p["buildingMeshes"] >= 4 and p["glowTris"] > 0, (p["buildingMeshes"], p["glowTris"])))
    results.append(("B7 one rig per creature, four body plans", p["rigs"] == staged["creatures"] and p["rigKinds"] == ["float", "insect", "serpent", "tall"], p["rigKinds"]))
    results.append(("B8 rig sits on the creature's authoritative tile", 0 <= p["rigAt"] < 0.05, p["rigAt"]))
    results.append(("B9 people instanced (staff + guests)", p["people"] >= 1, p["people"]))
    results.append(("B10 props: waste, entrance, transport guideway + car", p["waste"] >= 1 and p["entrance"] and p["guideways"] >= 1 and p["cars"] >= 1, (p["waste"], p["entrance"], p["guideways"], p["cars"])))
    results.append(("B11 water surface + border skirt built", p["water"] and p["skirt"] > 100, (p["water"], p["skirt"])))
    results.append(("B12 daytime lighting state", p["night"] < 0.2 and 0.9 <= p["exposure"] <= 1.1, (round(p["night"], 2), round(p["exposure"], 2))))
    # night lighting pass: lamps exist along the staged paths + floods on buildings, but they are OFF by day
    lampsDay = await asyncio.wait_for(page.evaluate("(() => { const L = window.__world3d.entities.lamps; return { count: L.count, floods: L.floods.length, on: L.on, bulb: L.bulbMat.emissiveIntensity, pool: L.poolMat.opacity, lights: L.lights.length, visibleLights: L.lights.filter(l => l.visible).length }; })()"), 60)
    results.append(("B22 night pass: path lamps placed along walkway edges + floodlights on building roofs", lampsDay["count"] >= 3 and lampsDay["floods"] >= 6, (lampsDay["count"], lampsDay["floods"])))
    results.append(("B23 night pass: lamps are dark by day (switch curve 0, no real lights lit)", lampsDay["on"] < 0.02 and lampsDay["bulb"] < 0.05 and lampsDay["pool"] < 0.02 and lampsDay["visibleLights"] == 0, lampsDay))
    # night: exposure drops, night factor rises, building glow ramps up
    await page.evaluate("(() => { window.__game.state.tick = Math.floor(1800 * 0.8); })()")
    await await_frames(page, 2)
    q = await asyncio.wait_for(page.evaluate("(() => { const w = window.__world3d; const L = w.entities.lamps; return { night: w.lights.night, exposure: w.renderer.toneMappingExposure, glow: w.entities.buildings.materials.glow.emissiveIntensity, lampsOn: L.on, bulb: L.bulbMat.emissiveIntensity, lens: L.lensMat.emissiveIntensity, pool: L.poolMat.opacity, floodPool: L.floodPoolMat.opacity, lights: L.lights.length, visibleLights: L.lights.filter(l => l.visible).length, quality: w.quality }; })()"), 60)
    results.append(("B13 night phase: dark exposure + emissive ramp", q and q["night"] > 0.9 and q["exposure"] < 0.7 and q["glow"] > 1.2, q))
    results.append(("B24 night pass: lamps switch on at night (warm bulbs, cool lenses, ground pools)", q and q["lampsOn"] > 0.95 and q["bulb"] > 1.8 and q["lens"] > 2.5 and q["pool"] > 0.3 and q["floodPool"] > 0.2, q))
    results.append(("B25 night pass: real light pool sized by quality tier (low = 0, medium = 4, high = 8)", q and q["lights"] == {"low": 0, "medium": 4, "high": 8}[q["quality"]] and q["visibleLights"] == q["lights"], (q["quality"], q["lights"], q["visibleLights"])))
    # dusk: a partial switch (the curve ramps through dusk rather than snapping)
    await page.evaluate("(() => { window.__game.state.tick = Math.floor(1800 * 0.68); })()")
    await await_frames(page, 2)
    dusk = await asyncio.wait_for(page.evaluate("(() => { const w = window.__world3d; return { night: w.lights.night, on: w.entities.lamps.on }; })()"), 60)
    results.append(("B26 night pass: dusk ramps the lamps part-way on (0 < on < 1)", dusk and 0.2 < dusk["night"] < 0.95 and 0.05 < dusk["on"] < 0.98, dusk))
    await page.evaluate("(() => { window.__game.state.tick = Math.floor(1800 * 0.8); })()")
    await await_frames(page, 2)
    # player lighting: a Path Lamp beside the staged path + a Floodlight Mast beside the lab join the pass
    placed = await asyncio.wait_for(page.evaluate("""(() => { const g = window.__game, s = g.state, e = s.entrance; const cx = e.x, cy = e.y;
        const before = { lamps: window.__world3d.entities.lamps.count, floods: window.__world3d.entities.lamps.floods.length };
        const a = g.dev.placeBuilding('path_lamp', cx + 1, cy - 10);      // grass tile east of the path column
        const b = g.dev.placeBuilding('floodlight', cx - 6, cy - 3);      // touching the lab's south-west corner
        const bad = g.dev.canPlaceBuilding('floodlight', cx - 11, cy - 2); // nothing nearby
        return { before, a: a.ok, b: b.ok, bad: bad.ok, badReason: bad.reason }; })()"""), 120)
    await await_frames(page, 3)
    pl = await asyncio.wait_for(page.evaluate("(() => { const L = window.__world3d.entities.lamps; return { count: L.count, floods: L.floods.length, playerLamps: L.playerLamps, playerFloods: L.playerFloods, on: L.on, pole: L.pole.count }; })()"), 60)
    results.append(("B27 player lighting: placed Path Lamp + Floodlight Mast join the 3D lamp pass (rules enforced)",
                    placed["a"] and placed["b"] and not placed["bad"] and pl["playerLamps"] == 1 and pl["playerFloods"] == 1
                    and pl["count"] == placed["before"]["lamps"] + 1 and pl["floods"] == placed["before"]["floods"] + 1 and pl["pole"] == 1 and pl["on"] > 0.95, (placed, pl)))
    # removing a fence run / creature shrinks the 3D layers (state-driven sync); wait for real frames
    shrink = await asyncio.wait_for(page.evaluate("""(() => { const s = window.__game.state; const w = window.__world3d; const ent = w.entities;
        const before = { frame: window.__gameRenderer.frame, posts: ent.fences.post.mesh.count, rigs: ent.creatures.rigs.size };
        s.creatures.splice(0, 1); for (const k of Object.keys(s.fences).slice(0, 10)) delete s.fences[k]; s._encDirty = true;
        return before; })()"""), 60)
    after = None
    for _ in range(12):
        await page.wait_for_timeout(2000)
        try:
            after = await asyncio.wait_for(page.evaluate("(() => { const ent = window.__world3d.entities; return { frame: window.__gameRenderer.frame, posts: ent.fences.post.mesh.count, rigs: ent.creatures.rigs.size }; })()"), 60)
        except Exception:
            continue
        if after["frame"] >= shrink["frame"] + 2:
            break
    results.append(("B16 layers follow state removals (fence posts + rigs shrink)", after and after["rigs"] == shrink["rigs"] - 1 and after["posts"] < shrink["posts"], (shrink, after)))
    # quality tier switch keeps rendering
    await page.evaluate("window.__world3d.setQuality('medium')")
    await page.wait_for_timeout(3000)
    try:
        qq = await asyncio.wait_for(page.evaluate("({ q: window.__world3d.quality, ao: !!window.__world3d.post.ao, bloom: !!window.__world3d.post.bloom })"), 60)
    except Exception:
        qq = {"q": "timeout"}
    results.append(("B14 quality tier switch (low -> medium adds AO + bloom)", qq.get("q") == "medium" and qq.get("ao") and qq.get("bloom"), qq))
    # overlay hooks still run on the 2D canvas: select a creature, hover a tile, tension summary exists
    sel = await page.evaluate("""(() => { const s = window.__game.state; const c = s.creatures[0]; const r = window.__gameRenderer;
        r.selection = { kind: 'creature', id: c.id }; r.hover = { x: Math.floor(c.x), y: Math.floor(c.y) };
        return { hasSel: !!r.selection, tension: Array.isArray(r.tensionSummary()), pick: typeof r.screenToTile === 'function' }; })()""")
    results.append(("B15 2D overlay hooks (selection / hover / tension / picking) intact", sel["hasSel"] and sel["tension"] and sel["pick"], sel))
    # shoreline: the water surface carries a bed attribute and the softened basin gives a depth GRADIENT (no single step)
    shore = await asyncio.wait_for(page.evaluate("""(() => { const w = window.__world3d; const g = w.water.mesh.geometry; const bed = g.attributes.aBed, pos = g.attributes.position;
        if (!bed) return { ok: false };
        const depths = new Set(); let maxD = 0;
        for (let i = 0; i < bed.count; i++) { const d = Math.max(0, pos.getY(i) - bed.getX(i)); depths.add(Math.round(d * 40) / 40); maxD = Math.max(maxD, d); }
        return { ok: true, levels: depths.size, maxD, shader: w.water.material.fragmentShader.includes('vBed') && w.terrain.material.fragmentShader === undefined ? true : true }; })()"""), 60)
    results.append(("B19 shoreline: bed depth attribute with a multi-level gradient into the deeps", shore.get("ok") and shore["levels"] >= 3 and 0.2 < shore["maxD"] < 1.0, shore))
    # living weather: a storm eases the storm factor in; water / ground / wind / rain splashes follow it
    await page.evaluate("(() => { const s = window.__game.state; s.weather = { type: 'storm', ticksLeft: 900 }; })()")
    await await_frames(page, 6, tries=40)  # software GL: a frame can take several seconds; the ease-in needs real frames
    storm = await asyncio.wait_for(page.evaluate("""(() => { const w = window.__world3d; const ent = w.entities;
        return { storm: w.lights.storm, water: w.water.uniforms.uStorm.value, wet: w.terrain.uniforms.uWet.value, wind: w.lights.wind, gust: w.lights.gust, splashes: ent.rain.pool.length, quality: w.quality }; })()"""), 60)
    results.append(("B20 storm: smoothed storm factor drives water slate tint, ground wetness and gusty wind", storm["storm"] > 0.15 and storm["water"] > 0.15 and storm["wet"] > 0.15 and storm["wind"] > 1.5 and storm["gust"] > 0, storm))
    splashes = storm["splashes"]
    for _ in range(8):  # software GL renders a frame every few seconds; the pool fills as the front builds
        if splashes > 0:
            break
        await await_frames(page, 2)
        try:
            splashes = await asyncio.wait_for(page.evaluate("window.__world3d.entities.rain.pool.length"), 60)
        except Exception:
            pass
    results.append(("B21 storm: rain splash pool spawns on hard surfaces (medium quality)", splashes > 0, splashes))
    results.append(("B17 no page errors under 3D", not errors, errors[:2]))
    try:
        await page.screenshot(path="/tmp/render3d_smoke.png", timeout=120000)
        results.append(("B18 3D smoke screenshot captured", True, "/tmp/render3d_smoke.png"))
    except Exception as e:
        results.append(("B18 3D smoke screenshot captured", False, str(e)[:80]))
    await browser.close()


async def main():
    results = []
    async with async_playwright() as pw:
        await part_a(pw, results)
        await part_b(pw, results)
    failed = 0
    for name, ok, detail in results:
        print(f"{name}: {'PASS' if ok else 'FAIL'}", "" if ok else f"-> {detail}")
        failed += 0 if ok else 1
    print(f"\n{len(results) - failed}/{len(results)} passed")
    sys.exit(1 if failed else 0)


asyncio.run(main())
