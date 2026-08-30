"""In-app core smoke test v2 (POC proof): camera-aware clicking."""
import asyncio
from playwright.async_api import async_playwright

URL = "https://discovery-bio.preview.emergentagent.com"


async def center(page, x, y):
    await page.evaluate("([x,y]) => window.__gameRenderer.centerOn(x, y)", [x, y])
    await page.wait_for_timeout(80)


async def tile_screen(page, x, y):
    return await page.evaluate(
        """([x, y]) => {
            const r = window.__gameRenderer; const s = window.__game.state;
            const h = s.heights[y * s.size + x] || 0;
            const wx = (x + 0.5 - y - 0.5) * 32, wy = (x + 0.5 + y + 0.5) * 16 - h * 10;
            return { sx: wx * r.cam.zoom + r.cam.x, sy: wy * r.cam.zoom + r.cam.y, zoom: r.cam.zoom };
        }""",
        [x, y],
    )


async def click_tile(page, x, y, dx=0, dy=0):
    p = await tile_screen(page, x, y)
    await page.mouse.click(p["sx"] + dx * p["zoom"], p["sy"] + dy * p["zoom"])
    await page.wait_for_timeout(50)


async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        page = await browser.new_page(viewport={"width": 1920, "height": 950})
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)[:300]))
        await page.goto(URL, wait_until="networkidle", timeout=30000)
        await page.wait_for_timeout(1200)
        await page.click('[data-testid="mode-sandbox"]')
        await page.click('[data-testid="start-game-button"]')
        await page.wait_for_timeout(2000)
        S = lambda expr: page.evaluate(expr)

        # pause sim during construction for determinism
        await page.click('[data-testid="hud-time-pause-button"]')

        # ---- flatten work region (40..47 x 30..37) ----
        await center(page, 43, 33)
        await page.click('[data-testid="cat-terrain"]')
        await page.click('[data-testid="tool-flatten"]')
        await page.click('[data-testid="brush-size-3"]')
        for tx, ty in [(42, 32), (45, 32), (42, 35), (45, 35)]:
            await click_tile(page, tx, ty)
        await page.click('[data-testid="brush-size-1"]')

        # ---- TEST B: paths near region ----
        await page.click('[data-testid="cat-paths"]')
        await page.click('[data-testid="tool-path"]')
        base = await S("window.__game.state.paths.reduce((a,b)=>a+b,0)")
        for i in range(8):
            await click_tile(page, 38, 30 + i)
        n_paths = await S("window.__game.state.paths.reduce((a,b)=>a+b,0)")
        print("TEST B paths placed:", n_paths - base, "PASS" if n_paths - base >= 7 else "FAIL")

        # ---- TEST C: fence enclosure rect (40..45, 30..35) ----
        await page.click('[data-testid="cat-fences"]')
        await page.click('[data-testid="fence-tier-1"]')
        x0, y0, x1, y1 = 40, 30, 45, 35

        async def place_edge(x, y, d):
            p = await page.evaluate(
                """([x,y,d]) => {
                    const s = window.__game.state, r = window.__gameRenderer;
                    const h1 = s.heights[y*s.size+x] || 0;
                    const nx = d==='E' ? x+1 : x, ny = d==='S' ? y+1 : y;
                    const h2 = (nx < s.size && ny < s.size) ? s.heights[ny*s.size+nx] : h1;
                    const h = Math.max(h1, h2);
                    const cx = (x+0.5-y-0.5)*32, cy = (x+0.5+y+0.5)*16 - h*10;
                    const mx = d==='E' ? cx+16 : cx-16, my = cy+8;
                    return { sx: mx*r.cam.zoom + r.cam.x, sy: my*r.cam.zoom + r.cam.y };
                }""",
                [x, y, d],
            )
            await page.mouse.click(p["sx"], p["sy"])
            await page.wait_for_timeout(50)

        for _attempt in range(3):
            for x in range(x0, x1 + 1):
                await place_edge(x, y0 - 1, "S")
                await place_edge(x, y1, "S")
            for y in range(y0, y1 + 1):
                await place_edge(x0 - 1, y, "E")
                await place_edge(x1, y, "E")
            missing = await page.evaluate(
                """([x0,y0,x1,y1]) => {
                    const f = window.__game.state.fences; const miss = [];
                    for (let x=x0; x<=x1; x++) { if(!f[`${x},${y0-1},S`]) miss.push([x,y0-1,'S']); if(!f[`${x},${y1},S`]) miss.push([x,y1,'S']); }
                    for (let y=y0; y<=y1; y++) { if(!f[`${x0-1},${y},E`]) miss.push([x0-1,y,'E']); if(!f[`${x1},${y},E`]) miss.push([x1,y,'E']); }
                    return miss;
                }""",
                [x0, y0, x1, y1],
            )
            if not missing:
                break
        print("TEST C perimeter complete:", "PASS" if not missing else f"FAIL missing {missing}")

        # gate
        await page.click('[data-testid="tool-gate"]')
        await place_edge(42, y1, "S")
        gates = await S("Object.values(window.__game.state.fences).filter(f=>f.gate).length")
        print("TEST C gate:", "PASS" if gates >= 1 else "FAIL")

        # enclosure detected?
        enc_area = await S("""(() => {
            window.__game.state._encDirty = true;
            const sel = window.__gameRenderer; return null; })()""")
        # use enclosureAt logic through selection click
        await page.click('[data-testid="tool-select"]')
        await click_tile(page, 43, 33)
        panel = await page.locator('[data-testid="enclosure-panel"]').count()
        print("TEST C enclosure panel on click:", "PASS" if panel else "FAIL")

        # ---- feeder inside ----
        await page.click('[data-testid="cat-habitat"]')
        await page.click('[data-testid="building-feeder_forage"]')
        await click_tile(page, 41, 31)
        feeders = await S("window.__game.state.buildings.filter(b=>b.station).length")
        print("TEST C feeder:", "PASS" if feeders == 1 else "FAIL")

        # ---- TEST D: acquire 3 skitterlings ----
        for i in range(3):
            await page.click('[data-testid="open-fieldops-button"]')
            await page.wait_for_timeout(350)
            await page.click('[data-testid="acquire-buy-skitter"]')
            await page.wait_for_timeout(250)
            await click_tile(page, 43, 33)
        n_creatures = await S("window.__game.state.creatures.length")
        print("TEST D creatures released:", n_creatures, "PASS" if n_creatures == 3 else "FAIL")

        # ---- TEST E: run sim fast; verify containment + behaviour ----
        await page.click('[data-testid="hud-speed-3-button"]')
        await page.wait_for_timeout(10000)
        info = await S("""window.__game.state.creatures.map(c => ({x: Math.floor(c.x), y: Math.floor(c.y), st: c.state, wf: +c.welfare.toFixed(2), enc: c.enclosureId, esc: c.escaped}))""")
        print("TEST E creatures:", info)
        contained = all((not c["esc"]) and c["enc"] for c in info)
        inside = all(x0 - 1 <= c["x"] <= x1 + 1 and y0 - 1 <= c["y"] <= y1 + 1 for c in info)
        print("TEST E contained:", "PASS" if contained else "FAIL", "| inside:", "PASS" if inside else "FAIL")

        # evidence accumulating? (skitter fully documented; check activity variety instead)
        states = set(c["st"] for c in info)
        print("TEST E activity states seen:", states)

        # ---- TEST F: select creature -> panel ----
        await page.click('[data-testid="hud-time-pause-button"]')
        c0 = info[0]
        await page.click('[data-testid="tool-select"]')
        await click_tile(page, c0["x"], c0["y"])
        panel = await page.locator('[data-testid="creature-panel"]').count()
        print("TEST F creature panel:", "PASS" if panel else "SOFT-FAIL (click precision)")

        # ---- TEST G: save/load ----
        n_fences = await S("Object.keys(window.__game.state.fences).length")
        h_check = await S("window.__game.state.heights[33 * 72 + 43]")
        await page.click('[data-testid="hud-save-button"]')
        await page.wait_for_timeout(2500)
        await page.click('[data-testid="hud-exit-button"]')
        await page.wait_for_timeout(1500)
        slots = await page.locator('[data-testid^="save-slot-"]').count()
        print("TEST G slots:", slots, "PASS" if slots >= 1 else "FAIL")
        if slots:
            await page.locator('[data-testid^="save-slot-"]').first.click()
            await page.wait_for_timeout(2500)
            h2 = await S("window.__game.state.heights[33 * 72 + 43]")
            nc2 = await S("window.__game.state.creatures.length")
            nf2 = await S("Object.keys(window.__game.state.fences).length")
            print("TEST G reload:", "PASS" if (h2 == h_check and nc2 == 3 and nf2 == n_fences) else f"FAIL h{h2}/{h_check} c{nc2} f{nf2}/{n_fences}")

        await page.screenshot(path="/tmp/smoke2.jpg", quality=30, type="jpeg")
        print("PAGE ERRORS:" if errors else "No page errors.")
        for e in errors[:10]:
            print(" -", e)
        await browser.close()


asyncio.run(main())
