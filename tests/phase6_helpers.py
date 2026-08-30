"""Shared helpers for phase 6 tests."""


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


async def click_tile(page, x, y):
    p = await tile_screen(page, x, y)
    await page.mouse.click(p["sx"], p["sy"])
    await page.wait_for_timeout(70)


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


async def drag(page, v0, v1):
    p0 = await vertex_screen(page, *v0)
    p1 = await vertex_screen(page, *v1)
    await page.mouse.move(p0["sx"], p0["sy"])
    await page.mouse.down()
    await page.mouse.move(p1["sx"], p1["sy"], steps=10)
    await page.wait_for_timeout(120)
    await page.mouse.up()
    await page.wait_for_timeout(100)


async def boot(page, url):
    await page.goto(url, wait_until="networkidle", timeout=30000)
    await page.wait_for_timeout(1200)
    await page.evaluate("localStorage.setItem('aetherion_tutorial_done','1')")
    await page.click('[data-testid="mode-sandbox"]')
    await page.click('[data-testid="start-game-button"]')
    await page.wait_for_timeout(2000)
    await page.click('[data-testid="hud-time-pause-button"]')


async def flatten(page, points):
    await page.click('[data-testid="cat-terrain"]')
    await page.click('[data-testid="tool-flatten"]')
    await page.click('[data-testid="brush-size-3"]')
    for tx, ty in points:
        await click_tile(page, tx, ty)
    await page.click('[data-testid="brush-size-1"]')


async def build_park(page):
    """Flatten, entrance paths + admin + platform, two rect enclosures A(40-46,30-36) B(48-54,30-36)."""
    S = lambda expr: page.evaluate(expr)
    ent = await S("window.__game.state.entrance")
    ex, ey = ent["x"], ent["y"]
    await page.evaluate("window.__gameRenderer.centerOn(%d, %d)" % (ex, ey - 4))
    await flatten(page, [(ex, ey - 2), (ex, ey - 5), (ex + 3, ey - 4), (ex - 3, ey - 4)])
    # paths from entrance up
    await page.click('[data-testid="cat-paths"]')
    await page.click('[data-testid="tool-path"]')
    for i in range(0, 6):
        await click_tile(page, ex, ey - i)
    await page.click('[data-testid="cat-facilities"]')
    await page.click('[data-testid="building-admin"]')
    await click_tile(page, ex + 1, ey - 4)
    # enclosures + platform area
    await page.evaluate("window.__gameRenderer.centerOn(47, 33)")
    await flatten(page, [(41, 31), (45, 31), (41, 35), (45, 35), (43, 33), (49, 31), (53, 31), (49, 35), (53, 35), (51, 33), (47, 38)])
    await page.click('[data-testid="cat-fences"]')
    await page.click('[data-testid="fence-shape-rect"]')
    await page.click('[data-testid="fence-tier-1"]')
    await drag(page, (40, 30), (46, 36))
    await drag(page, (48, 30), (54, 36))
    # viewing platform south of enclosure A + path to it
    await page.click('[data-testid="cat-paths"]')
    await page.click('[data-testid="tool-path"]')
    for i in range(6):
        await click_tile(page, ex, ey - 6 - i)  # extend main path
    await page.click('[data-testid="cat-facilities"]')
    await page.click('[data-testid="building-viewing"]')
    await click_tile(page, 43, 38)
    # unlock all acquisition tiers
    await page.evaluate("window.__game.state.research.completed.push('ops_field2','ops_field3')")


async def acquire_and_place(page, species, x, y):
    await page.click('button:has-text("Field Ops")')
    await page.wait_for_timeout(350)
    await page.click(f'[data-testid="acquire-buy-{species}"]')
    await page.wait_for_timeout(250)
    await click_tile(page, x, y)
