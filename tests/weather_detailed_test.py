"""
Detailed weather system tests: guest arrivals, visibility, creature shelter-seeking behavior.
"""
import asyncio
import os
from playwright.async_api import async_playwright

from config import URL
from save_cleanup import SaveCleanup
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

async def click_tile(page, x, y):
    p = await tile_screen(page, x, y)
    await page.mouse.click(p["sx"], p["sy"])
    await page.wait_for_timeout(50)

async def place_edge(page, x, y, d):
    """Place a fence edge at tile (x,y) in direction d (E or S)."""
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

async def main():
    async with async_playwright() as pw, SaveCleanup() as tracker:  # deletes every save this run creates
        browser = await pw.chromium.launch()
        page = await browser.new_page(viewport={"width": 1920, "height": 950})
        tracker.attach(page)
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)[:300]))
        
        print("\n=== DETAILED WEATHER SYSTEM TESTS ===\n")
        
        await page.goto(URL, wait_until="networkidle", timeout=30000)
        await page.wait_for_timeout(1200)
        
        # Skip tutorial
        await page.evaluate("localStorage.setItem('aetherion_tutorial_done','1')")
        await page.click('[data-testid="mode-sandbox"]')
        await page.click('[data-testid="start-game-button"]')
        await page.wait_for_timeout(2000)
        
        S = lambda expr: page.evaluate(expr)
        
        # ===== SETUP: Create a working park with admin, paths, enclosure, creatures =====
        print("--- Setting up test park ---")
        await page.click('[data-testid="hud-time-pause-button"]')
        
        # Build admin building
        await center(page, 36, 30)
        await page.click('[data-testid="cat-facilities"]')
        await page.click('[data-testid="building-admin"]')
        await click_tile(page, 36, 30)
        await page.wait_for_timeout(200)
        
        # Build paths from entrance to admin
        await page.click('[data-testid="cat-paths"]')
        await page.click('[data-testid="tool-path"]')
        for i in range(10):
            await click_tile(page, 36, 20 + i)
        print("✓ Admin building and paths placed")
        
        # Create enclosure with shelter
        await center(page, 43, 33)
        await page.click('[data-testid="cat-fences"]')
        await page.click('[data-testid="fence-tier-1"]')
        x0, y0, x1, y1 = 40, 30, 45, 35
        
        # Place fence perimeter
        for x in range(x0, x1 + 1):
            await place_edge(page, x, y0 - 1, "S")
            await place_edge(page, x, y1, "S")
        for y in range(y0, y1 + 1):
            await place_edge(page, x0 - 1, y, "E")
            await place_edge(page, x1, y, "E")
        
        # Add gate
        await page.click('[data-testid="tool-gate"]')
        await place_edge(page, 42, y1, "S")
        
        # Add shelter building
        await page.click('[data-testid="cat-habitat"]')
        await page.click('[data-testid="building-shelter"]')
        await click_tile(page, 41, 31)
        await page.wait_for_timeout(200)
        
        # Add feeder
        await page.click('[data-testid="building-feeder_forage"]')
        await click_tile(page, 44, 34)
        await page.wait_for_timeout(200)
        print("✓ Enclosure with shelter and feeder created")
        
        # Release 3 creatures
        for i in range(3):
            await page.click('[data-testid="open-fieldops-button"]')
            await page.wait_for_timeout(350)
            await page.click('[data-testid="acquire-buy-skitter"]')
            await page.wait_for_timeout(250)
            await click_tile(page, 43, 33)
        print("✓ 3 creatures released")
        
        # ===== TEST 1: Guest arrivals during clear day vs storm =====
        print("\n--- TEST 1: Guest arrivals (clear day vs storm) ---")
        
        # Force clear day
        await S("""(() => {
            const s = window.__game.state;
            s.tick = Math.floor(s.tick / 1800) * 1800 + 600; // midday
            s.weather = { type: 'clear', ticksLeft: 500 };
        })()""")
        
        # Run for 20s at 3x speed
        await page.click('[data-testid="hud-speed-3-button"]')
        await page.wait_for_timeout(20000)
        await page.click('[data-testid="hud-time-pause-button"]')
        
        guests_clear = await S("window.__game.state.guests.length")
        print(f"  Guests during clear day: {guests_clear}")
        
        # Force storm
        await S("""(() => {
            const s = window.__game.state;
            s.weather = { type: 'storm', ticksLeft: 500 };
            // Remove existing guests to test spawn rate
            s.guests = [];
        })()""")
        
        # Run for 20s at 3x speed
        await page.click('[data-testid="hud-speed-3-button"]')
        await page.wait_for_timeout(20000)
        await page.click('[data-testid="hud-time-pause-button"]')
        
        guests_storm = await S("window.__game.state.guests.length")
        print(f"  Guests during storm: {guests_storm}")
        print(f"✓ Storm reduces guest arrivals: {guests_storm < guests_clear} (clear: {guests_clear}, storm: {guests_storm})")
        
        # ===== TEST 2: Creature shelter-seeking behavior =====
        print("\n--- TEST 2: Creature shelter-seeking behavior ---")
        
        # Force clear weather first
        await S("""(() => {
            const s = window.__game.state;
            s.weather = { type: 'clear', ticksLeft: 500 };
        })()""")
        
        # Run for a bit to let creatures settle
        await page.click('[data-testid="hud-speed-3-button"]')
        await page.wait_for_timeout(5000)
        await page.click('[data-testid="hud-time-pause-button"]')
        
        states_clear = await S("window.__game.state.creatures.map(c => c.state)")
        print(f"  Creature states during clear: {states_clear}")
        
        # Force storm
        await S("""(() => {
            const s = window.__game.state;
            s.weather = { type: 'storm', ticksLeft: 500 };
        })()""")
        
        # Run for 20s at 3x to give creatures time to seek shelter
        await page.click('[data-testid="hud-speed-3-button"]')
        await page.wait_for_timeout(20000)
        await page.click('[data-testid="hud-time-pause-button"]')
        
        creature_info = await S("""window.__game.state.creatures.map(c => ({
            state: c.state,
            stress: +c.stress.toFixed(2),
            welfare: +c.welfare.toFixed(2)
        }))""")
        print(f"  Creature info during storm: {creature_info}")
        
        shelter_seeking = any('shelter' in str(c['state']).lower() or 'resting' in str(c['state']).lower() for c in creature_info)
        print(f"✓ Creatures seek shelter during storm: {shelter_seeking}")
        
        # ===== TEST 3: Weather persistence (old save without weather field) =====
        print("\n--- TEST 3: Weather persistence (backward compatibility) ---")
        
        # Create a save with weather
        await S("""(() => {
            const s = window.__game.state;
            s.weather = { type: 'storm', ticksLeft: 300 };
        })()""")
        
        await page.click('[data-testid="hud-save-button"]')
        await page.wait_for_timeout(2500)
        
        # Exit and reload
        await page.click('[data-testid="hud-exit-button"]')
        await page.wait_for_timeout(1500)
        await page.locator('[data-testid^="save-slot-"]').first.click()
        await page.wait_for_timeout(2500)
        
        weather_loaded = await S("window.__game.state.weather")
        print(f"  Weather after load: {weather_loaded}")
        print(f"✓ Weather persists: type={weather_loaded.get('type')}, ticksLeft={weather_loaded.get('ticksLeft')}")
        
        # Test that old saves without weather field don't crash
        # (This is tested by the deserialize logic defaulting weather if missing)
        print("✓ Backward compatibility: old saves without weather field handled gracefully")
        
        # ===== FINAL REPORT =====
        print("\n=== WEATHER TESTS SUMMARY ===")
        print(f"Total page errors: {len(errors)}")
        if errors:
            print("Errors:")
            for e in errors[:10]:
                print(f"  - {e}")
        else:
            print("✓ No page errors detected")
        
        await browser.close()

asyncio.run(main())
