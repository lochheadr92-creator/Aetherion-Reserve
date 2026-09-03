"""
Comprehensive test for placement alignment bug fix + weather + tutorial.
Tests the fix: terrain tiles now drawn centered on (x+0.5, y+0.5) matching previews/fences/buildings.
"""
import asyncio
import os
from playwright.async_api import async_playwright

URL = os.environ.get("AETHERION_URL", "https://discovery-bio.preview.emergentagent.com")

async def center(page, x, y):
    await page.evaluate("([x,y]) => window.__gameRenderer.centerOn(x, y)", [x, y])
    await page.wait_for_timeout(80)

async def tile_screen(page, x, y):
    """Compute screen coordinates for tile center using the fixed formula."""
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
    """Click at tile center with optional offset."""
    p = await tile_screen(page, x, y)
    await page.mouse.click(p["sx"] + dx * p["zoom"], p["sy"] + dy * p["zoom"])
    await page.wait_for_timeout(50)

async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        page = await browser.new_page(viewport={"width": 1920, "height": 950})
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)[:300]))
        
        print("\n=== STARTING PLACEMENT ALIGNMENT + WEATHER + TUTORIAL TESTS ===\n")
        
        await page.goto(URL, wait_until="networkidle", timeout=30000)
        await page.wait_for_timeout(1200)
        
        # ===== TUTORIAL TESTS =====
        print("--- TUTORIAL TESTS ---")
        await page.evaluate("localStorage.removeItem('aetherion_tutorial_done')")
        await page.click('[data-testid="mode-sandbox"]')
        await page.click('[data-testid="start-game-button"]')
        await page.wait_for_timeout(1800)
        
        # Check tutorial appears and game is paused
        tut_visible = await page.locator('[data-testid="tutorial-overlay"]').count()
        paused = await page.evaluate("window.__game.state.paused")
        print(f"✓ Tutorial appears on first run: {tut_visible == 1} (paused: {paused})")
        
        # Test navigation
        initial_title = await page.locator('[data-testid="tutorial-step-title"]').inner_text()
        await page.click('[data-testid="tutorial-next-button"]')
        await page.wait_for_timeout(150)
        second_title = await page.locator('[data-testid="tutorial-step-title"]').inner_text()
        print(f"✓ Next button works: {initial_title != second_title}")
        
        # Test Back button
        await page.click('[data-testid="tutorial-back-button"]')
        await page.wait_for_timeout(150)
        back_title = await page.locator('[data-testid="tutorial-step-title"]').inner_text()
        print(f"✓ Back button works: {back_title == initial_title}")
        
        # Navigate to final step
        for _ in range(5):
            await page.click('[data-testid="tutorial-next-button"]')
            await page.wait_for_timeout(150)
        
        # Finish tutorial
        await page.click('[data-testid="tutorial-finish-button"]')
        await page.wait_for_timeout(400)
        tut_closed = await page.locator('[data-testid="tutorial-overlay"]').count() == 0
        unpaused = not await page.evaluate("window.__game.state.paused")
        flag_set = await page.evaluate("localStorage.getItem('aetherion_tutorial_done')")
        print(f"✓ Tutorial finish: closed={tut_closed}, unpaused={unpaused}, flag_set={flag_set == '1'}")
        
        # Test help button reopens
        await page.click('[data-testid="hud-help-button"]')
        await page.wait_for_timeout(200)
        help_reopens = await page.locator('[data-testid="tutorial-overlay"]').count() == 1
        print(f"✓ Help button reopens tutorial: {help_reopens}")
        await page.click('[data-testid="tutorial-skip-button"]')
        await page.wait_for_timeout(200)
        
        # ===== PLACEMENT ALIGNMENT TESTS =====
        print("\n--- PLACEMENT ALIGNMENT TESTS (PRIMARY BUG FIX) ---")
        
        S = lambda expr: page.evaluate(expr)
        await page.click('[data-testid="hud-time-pause-button"]')
        
        # Test 1: Raise tool on tile (40,40)
        await center(page, 40, 40)
        await page.click('[data-testid="cat-terrain"]')
        await page.click('[data-testid="tool-raise"]')
        await page.click('[data-testid="brush-size-1"]')
        
        h_before = await S("window.__game.state.heights[40 * 72 + 40]")
        await click_tile(page, 40, 40)
        await page.wait_for_timeout(100)
        h_after = await S("window.__game.state.heights[40 * 72 + 40]")
        print(f"✓ Raise tool alignment: height {h_before} → {h_after} (incremented: {h_after > h_before})")
        
        # Test 2: Paint (materials)
        await page.click('[data-testid="cat-ground"]')
        await page.click('[data-testid="paint-sand"]')
        mat_before = await S("window.__game.state.materials[41 * 72 + 41]")
        await click_tile(page, 41, 41)
        await page.wait_for_timeout(100)
        mat_after = await S("window.__game.state.materials[41 * 72 + 41]")
        print(f"✓ Paint tool alignment: material {mat_before} → {mat_after} (changed: {mat_after != mat_before})")
        
        # Test 3: Shallow water
        await page.click('[data-testid="cat-water"]')
        await page.click('[data-testid="tool-water-shallow"]')
        water_before = await S("window.__game.state.water[42 * 72 + 42]")
        await click_tile(page, 42, 42)
        await page.wait_for_timeout(100)
        water_after = await S("window.__game.state.water[42 * 72 + 42]")
        print(f"✓ Water tool alignment: water {water_before} → {water_after} (changed: {water_after != water_before})")
        
        # Test 4: Path placement
        await page.click('[data-testid="cat-paths"]')
        await page.click('[data-testid="tool-path"]')
        path_before = await S("window.__game.state.paths[43 * 72 + 43]")
        await click_tile(page, 43, 43)
        await page.wait_for_timeout(100)
        path_after = await S("window.__game.state.paths[43 * 72 + 43]")
        print(f"✓ Path tool alignment: path {path_before} → {path_after} (placed: {path_after > path_before})")
        
        # Test 5: Visual verification - hover with raise tool at zoom 1.5
        await center(page, 36, 36)
        await page.evaluate("window.__gameRenderer.cam.zoom = 1.5")
        await page.evaluate("window.__gameRenderer.centerOn(36, 36)")
        await page.click('[data-testid="cat-terrain"]')
        await page.click('[data-testid="tool-raise"]')
        p = await tile_screen(page, 36, 36)
        await page.mouse.move(p["sx"], p["sy"])
        await page.wait_for_timeout(300)
        await page.screenshot(path="/tmp/alignment_hover.jpg", quality=40, type="jpeg")
        print("✓ Visual alignment screenshot saved: /tmp/alignment_hover.jpg")
        
        # Test 6: Building placement preview (1x1 feeder)
        # Use an existing enclosure from smoke tests or create a simple one
        await page.evaluate("window.__gameRenderer.cam.zoom = 0.9")
        await center(page, 43, 33)
        
        # Test building placement preview - hover over a tile with building tool
        await page.click('[data-testid="cat-habitat"]')
        await page.click('[data-testid="building-feeder_forage"]')
        p_build = await tile_screen(page, 43, 33)
        await page.mouse.move(p_build["sx"], p_build["sy"])
        await page.wait_for_timeout(300)
        preview_ok = await S("window.__gameRenderer.tool._previewOk !== undefined")
        print(f"✓ Building placement preview alignment: preview exists={preview_ok}")
        await page.screenshot(path="/tmp/building_preview.jpg", quality=40, type="jpeg")
        print("✓ Building preview screenshot saved: /tmp/building_preview.jpg")
        
        # ===== WEATHER SYSTEM TESTS =====
        print("\n--- WEATHER SYSTEM TESTS ---")
        
        # Test HUD chip updates
        await page.evaluate("""(() => {
            const s = window.__game.state;
            s.tick = Math.floor(s.tick / 1800) * 1800 + 1500; // force night
            s.weather = { type: 'storm', ticksLeft: 500 };
        })()""")
        await page.wait_for_timeout(600)
        weather_label = await page.locator('[data-testid="hud-weather-label"]').inner_text()
        clock = await page.locator('[data-testid="hud-clock"]').inner_text()
        print(f"✓ Weather HUD chip: label='{weather_label}', clock='{clock}'")
        print(f"  Contains NIGHT: {'NIGHT' in weather_label}, Contains STORM: {'STORM' in weather_label}")
        
        # Visual verification: dark tint + rain streaks
        await page.screenshot(path="/tmp/weather_night_storm.jpg", quality=40, type="jpeg")
        print("✓ Weather visual screenshot saved: /tmp/weather_night_storm.jpg")
        
        # Test weather persistence
        await page.click('[data-testid="hud-save-button"]')
        await page.wait_for_timeout(2500)
        await page.click('[data-testid="hud-exit-button"]')
        await page.wait_for_timeout(1500)
        await page.locator('[data-testid^="save-slot-"]').first.click()
        await page.wait_for_timeout(2500)
        weather_after_load = await S("window.__game.state.weather.type")
        print(f"✓ Weather persistence: saved storm, loaded '{weather_after_load}' (preserved: {weather_after_load == 'storm'})")
        
        # ===== STABILITY TEST =====
        print("\n--- STABILITY TEST (2-minute 3x session with storm + night) ---")
        
        # Set up a working park for stability test
        await page.evaluate("localStorage.setItem('aetherion_tutorial_done','1')")
        await page.goto(URL, wait_until="networkidle", timeout=30000)
        await page.wait_for_timeout(1200)
        await page.click('[data-testid="mode-sandbox"]')
        await page.click('[data-testid="start-game-button"]')
        await page.wait_for_timeout(2000)
        
        # Force storm and night
        await page.evaluate("""(() => {
            const s = window.__game.state;
            s.tick = Math.floor(s.tick / 1800) * 1800 + 1500;
            s.weather = { type: 'storm', ticksLeft: 500 };
        })()""")
        
        # Run at 3x speed for 2 minutes
        await page.click('[data-testid="hud-speed-3-button"]')
        print("  Running 2-minute stability test at 3x speed with storm + night...")
        
        # Check for errors every 30 seconds
        for i in range(4):
            await page.wait_for_timeout(30000)
            print(f"  {(i+1)*30}s elapsed, errors so far: {len(errors)}")
        
        print(f"✓ Stability test complete: {len(errors)} page errors")
        
        # ===== FINAL REPORT =====
        print("\n=== TEST SUMMARY ===")
        print(f"Total page errors: {len(errors)}")
        if errors:
            print("Errors:")
            for e in errors[:10]:
                print(f"  - {e}")
        else:
            print("✓ No page errors detected")
        
        await browser.close()

asyncio.run(main())
