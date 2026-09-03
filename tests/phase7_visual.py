"""Phase 7 visual verification: place many species in-world, capture day/night/DB shots."""
import asyncio
import os
from playwright.async_api import async_playwright
from phase6_helpers import boot, build_park, acquire_and_place, click_tile

URL = os.environ.get("AETHERION_URL", "https://discovery-bio.preview.emergentagent.com")


async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        page = await browser.new_page(viewport={"width": 1920, "height": 900})
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)[:200]))
        await boot(page, URL)
        S = lambda expr: page.evaluate(expr)

        await build_park(page)
        # clear weather + daytime
        await page.evaluate(
            """(() => { const s = window.__game.state;
                s.tick = Math.floor(s.tick / 1800) * 1800 + 500;
                s.weather = { type: 'clear', ticksLeft: 900000 }; })()"""
        )
        # Enclosure A (40-46,30-36): plains group; Enclosure B (48-54,30-36): heavies
        for sp, x, y in [
            ("veyra", 42, 32), ("skitter", 44, 34), ("thornback", 41, 34), ("hollowcrest", 44, 31),
            ("vantha", 42, 35), ("shardling", 45, 33),
            ("silttitan", 50, 32), ("karrgan", 52, 34), ("mosswarden", 50, 35),
            ("lumen", 53, 31), ("voltari", 49, 33), ("umbra", 52, 31),
            ("rhoak", 45, 35), ("emberoot", 53, 35), ("mirefin", 49, 30),
        ]:
            await acquire_and_place(page, sp, x, y)
        n = await S("window.__game.state.creatures.length")
        print(f"placed {n}/15 creatures")
        await page.evaluate("window.__gameRenderer.centerOn(47.5, 33)")
        await page.evaluate("window.__gameRenderer.cam.zoom = 1.15; window.__gameRenderer.cam.x = window.__gameRenderer.canvas.width/2 - (47.5-33)*32*1.15; window.__gameRenderer.cam.y = window.__gameRenderer.canvas.height/2 - ((47.5+33)*16 - 0)*1.15")
        await page.wait_for_timeout(600)
        await page.screenshot(path="/tmp/world_day.jpg", quality=40, type="jpeg", full_page=False)
        print("day shot captured")
        # let them move a little at 1x
        await page.click('[data-testid="hud-time-pause-button"]')  # unpause
        await page.wait_for_timeout(3500)
        await page.screenshot(path="/tmp/world_moving.jpg", quality=40, type="jpeg", full_page=False)
        print("movement shot captured")
        # night with glow
        await page.evaluate(
            "window.__game.state.tick = Math.floor(window.__game.state.tick / 1800) * 1800 + 1420"
        )
        await page.wait_for_timeout(900)
        await page.screenshot(path="/tmp/world_night.jpg", quality=40, type="jpeg", full_page=False)
        print("night shot captured")
        # DB detail views for umbra, voltari, emberoot
        await page.click('button:has-text("Species")')
        await page.wait_for_timeout(600)
        for sid in ["umbra", "voltari", "emberoot"]:
            btn = page.locator(f'[data-testid="species-row-{sid}"], text=/{"Umbra Veilwing" if sid=="umbra" else "Voltari Archling" if sid=="voltari" else "Emberoot Gorger"}/').first
            try:
                await btn.click(force=True)
                await page.wait_for_timeout(400)
            except Exception as e:
                print(f"click {sid} failed: {e}")
        await page.screenshot(path="/tmp/db_emberoot.jpg", quality=40, type="jpeg", full_page=False)
        print("db detail captured")
        print("No page errors." if not errors else f"PAGE ERRORS: {errors}")
        await browser.close()


asyncio.run(main())
