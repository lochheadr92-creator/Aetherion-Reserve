"""Fence drag-to-line placement test: drag draws a straight wall, click places one segment."""
import asyncio
import os
from playwright.async_api import async_playwright

URL = os.environ.get("AETHERION_URL", "https://discovery-bio.preview.emergentagent.com")


async def center(page, x, y):
    await page.evaluate("([x,y]) => window.__gameRenderer.centerOn(x, y)", [x, y])
    await page.wait_for_timeout(80)


async def tile_screen(page, x, y):
    return await page.evaluate(
        """([x, y]) => {
            const r = window.__gameRenderer; const s = window.__game.state;
            const h = s.heights[y * s.size + x] || 0;
            const wx = (x + 0.5 - y - 0.5) * 32, wy = (x + 0.5 + y + 0.5) * 16 - h * 10;
            return { sx: wx * r.cam.zoom + r.cam.x, sy: wy * r.cam.zoom + r.cam.y };
        }""",
        [x, y],
    )


async def vertex_screen(page, vx, vy):
    return await page.evaluate(
        """([vx, vy]) => {
            const r = window.__gameRenderer; const s = window.__game.state;
            const tx = Math.min(vx, s.size - 1), ty = Math.min(vy, s.size - 1);
            const h = s.heights[ty * s.size + tx] || 0;
            const wx = (vx - vy) * 32, wy = (vx + vy) * 16 - h * 10;
            return { sx: wx * r.cam.zoom + r.cam.x, sy: wy * r.cam.zoom + r.cam.y };
        }""",
        [vx, vy],
    )


async def drag(page, v0, v1, check_preview=False):
    p0 = await vertex_screen(page, *v0)
    p1 = await vertex_screen(page, *v1)
    await page.mouse.move(p0["sx"], p0["sy"])
    await page.mouse.down()
    await page.mouse.move(p1["sx"], p1["sy"], steps=10)
    await page.wait_for_timeout(120)
    preview = None
    if check_preview:
        preview = await page.evaluate(
            "() => { const p = window.__gameRenderer.fenceLinePreview; return p ? { n: p.edges.length, ok: p.count, cost: p.cost } : null; }"
        )
    await page.mouse.up()
    await page.wait_for_timeout(100)
    return preview


async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        page = await browser.new_page(viewport={"width": 1920, "height": 950})
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)[:300]))
        await page.goto(URL, wait_until="networkidle", timeout=30000)
        await page.wait_for_timeout(1200)
        await page.evaluate("localStorage.setItem('aetherion_tutorial_done','1')")
        await page.click('[data-testid="mode-sandbox"]')
        await page.click('[data-testid="start-game-button"]')
        await page.wait_for_timeout(2000)
        S = lambda expr: page.evaluate(expr)

        await page.click('[data-testid="hud-time-pause-button"]')

        # flatten a work region so vertex math is exact
        await center(page, 43, 33)
        await page.click('[data-testid="cat-terrain"]')
        await page.click('[data-testid="tool-flatten"]')
        await page.click('[data-testid="brush-size-3"]')
        for tx, ty in [(41, 31), (45, 31), (41, 35), (45, 35), (43, 33)]:
            p = await tile_screen(page, tx, ty)
            await page.mouse.click(p["sx"], p["sy"])
            await page.wait_for_timeout(60)
        await page.click('[data-testid="brush-size-1"]')

        await page.click('[data-testid="cat-fences"]')
        await page.click('[data-testid="fence-tier-1"]')

        # ---- TEST 1: horizontal drag (40,30)->(46,30) => 6 S fences on row 29, live preview shown
        f0 = await S("Object.keys(window.__game.state.fences).length")
        prev = await drag(page, (40, 30), (46, 30), check_preview=True)
        fences = await S(
            "Object.keys(window.__game.state.fences).filter(k => k.endsWith(',S') && k.split(',')[1] === '29').length"
        )
        total = await S("Object.keys(window.__game.state.fences).length")
        e_count = await S("Object.keys(window.__game.state.fences).filter(k => k.endsWith(',E')).length")
        print("TEST 1 preview during drag:", prev, "PASS" if prev and prev["n"] == 6 else "FAIL")
        print("TEST 1 horizontal drag placed:", total - f0, "S-row29:", fences,
              "PASS" if total - f0 == 6 and fences >= 6 else "FAIL")
        print("TEST 1 no stray E fences from horizontal drag:", "PASS" if e_count == 0 else f"FAIL ({e_count})")

        # ---- TEST 2: vertical drag (40,30)->(40,36) => 6 E fences on column 39
        f0 = await S("Object.keys(window.__game.state.fences).length")
        await drag(page, (40, 30), (40, 36))
        e_col = await S(
            "Object.keys(window.__game.state.fences).filter(k => k.endsWith(',E') && k.split(',')[0] === '39').length"
        )
        total = await S("Object.keys(window.__game.state.fences).length")
        print("TEST 2 vertical drag placed:", total - f0, "E-col39:", e_col,
              "PASS" if total - f0 == 6 and e_col >= 6 else "FAIL")

        # ---- TEST 3: diagonal-ish drag snaps to dominant axis (one straight line only)
        f0 = await S("Object.keys(window.__game.state.fences).length")
        await drag(page, (42, 33), (46, 34))  # dx=4 > dy=1 -> horizontal S row 32
        placed = await S(
            "Object.keys(window.__game.state.fences).filter(k => k.endsWith(',S') && k.split(',')[1] === '32').length"
        )
        total = await S("Object.keys(window.__game.state.fences).length")
        print("TEST 3 diagonal snaps straight:", total - f0, "S-row32:", placed,
              "PASS" if total - f0 == 4 and placed == 4 else "FAIL")

        # ---- TEST 4: plain click places exactly one segment
        f0 = await S("Object.keys(window.__game.state.fences).length")
        p = await vertex_screen(page, 44, 36)
        # click slightly toward the S edge midpoint of tile (43,35): midpoint between corners (43,36)-(44,36)
        pm = await vertex_screen(page, 43, 36)
        await page.mouse.click((p["sx"] + pm["sx"]) / 2, (p["sy"] + pm["sy"]) / 2)
        await page.wait_for_timeout(100)
        total = await S("Object.keys(window.__game.state.fences).length")
        print("TEST 4 single click places 1:", total - f0, "PASS" if total - f0 == 1 else "FAIL")

        # ---- TEST 5: drag-remove clears the horizontal wall from TEST 1
        await page.click('[data-testid="tool-fence-remove"]')
        f0 = await S("Object.keys(window.__game.state.fences).length")
        await drag(page, (40, 30), (46, 30))
        remaining_row29 = await S(
            "Object.keys(window.__game.state.fences).filter(k => k.endsWith(',S') && k.split(',')[1] === '29').length"
        )
        total = await S("Object.keys(window.__game.state.fences).length")
        print("TEST 5 drag-remove:", f0 - total, "removed, row29 left:", remaining_row29,
              "PASS" if f0 - total == 6 and remaining_row29 == 0 else "FAIL")

        # ---- TEST 6: full rectangle with 4 drags forms an enclosure
        await page.click('[data-testid="fence-tier-1"]')
        await drag(page, (41, 32), (45, 32))  # top
        await drag(page, (41, 36), (45, 36))  # bottom
        await drag(page, (41, 32), (41, 36))  # left
        await drag(page, (45, 32), (45, 36))  # right
        enc = await S(
            """(() => {
                const m = window.__game.modules;
                return null;
            })()"""
        )
        # detect enclosure via select click in the middle
        await page.click('[data-testid="tool-select"]')
        p = await tile_screen(page, 43, 34)
        await page.mouse.click(p["sx"], p["sy"])
        await page.wait_for_timeout(300)
        panel = await page.locator('[data-testid="enclosure-panel"]').count()
        sel = await S("window.__gameRenderer.selection ? window.__gameRenderer.selection.kind : null")
        print("TEST 6 rectangle -> enclosure:", sel, "panel:", panel,
              "PASS" if sel == "enclosure" or panel > 0 else "FAIL")

        print("No page errors." if not errors else f"PAGE ERRORS: {errors}")
        await page.screenshot(path="/tmp/fence_drag.jpg", quality=35, type="jpeg")
        await browser.close()


asyncio.run(main())
