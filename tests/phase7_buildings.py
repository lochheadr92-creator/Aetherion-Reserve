"""Phase 7: building showcase + remaining DB portraits."""
import asyncio
import os
from playwright.async_api import async_playwright
from phase6_helpers import boot, flatten, click_tile

from config import URL
async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        page = await browser.new_page(viewport={"width": 1920, "height": 900})
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)[:200]))
        await boot(page, URL)
        await page.evaluate("window.__gameRenderer.centerOn(44, 33)")
        await flatten(page, [(38, 30), (42, 30), (46, 30), (50, 30), (38, 34), (42, 34), (46, 34), (50, 34), (38, 38), (42, 38), (46, 38), (50, 38), (54, 34), (54, 30), (54, 38)])
        # paths so needsPath buildings accept placement
        await page.click('[data-testid="cat-paths"]')
        await page.click('[data-testid="tool-path"]')
        for x in range(36, 56):
            await click_tile(page, x, 32)
            await click_tile(page, x, 36)
        # facilities row 1 (y=30-31) and row 2 (y=34-35)
        await page.click('[data-testid="cat-facilities"]')
        placements = [
            ("admin", 37, 29), ("lab", 41, 29), ("power", 45, 29), ("security_post", 48, 29),
            ("viewing", 51, 29), ("tower", 54, 29),
            ("food_stall", 37, 34), ("drink_stall", 40, 34), ("restroom", 43, 34),
            ("gift_shop", 46, 34), 
        ]
        for b, x, y in placements:
            await page.click(f'[data-testid="building-{b}"]')
            await click_tile(page, x, y)
        # habitat tab: shelter + feeders (y=38)
        await page.click('[data-testid="cat-habitat"]')
        hab = [("shelter", 37, 38), ("feeder_forage", 41, 38), ("feeder_meat", 43, 38),
               ("feeder_mineral", 45, 38), ("feeder_fungal", 47, 38), ("feeder_energy", 49, 38)]
        for b, x, y in hab:
            try:
                await page.click(f'[data-testid="building-{b}"]')
                await click_tile(page, x, y)
            except Exception as e:
                print(f"{b}: {e}")
        n = await page.evaluate("window.__game.state.buildings.length")
        print(f"buildings placed: {n}")
        await page.evaluate("window.__gameRenderer.centerOn(45, 34)")
        await page.evaluate("window.__gameRenderer.cam.zoom = 1.0")
        await page.evaluate("window.__gameRenderer.centerOn(45, 34)")
        await page.wait_for_timeout(700)
        await page.screenshot(path="/tmp/buildings_day.jpg", quality=42, type="jpeg", full_page=False)
        print("building shot captured")
        # DB bottom species portraits
        await page.click('button:has-text("Species")')
        await page.wait_for_timeout(600)
        await page.click('[data-testid="species-row-emberoot"]')
        await page.wait_for_timeout(400)
        await page.screenshot(path="/tmp/db_emberoot.jpg", quality=42, type="jpeg", full_page=False)
        await page.click('[data-testid="species-row-voltari"]')
        await page.wait_for_timeout(400)
        await page.screenshot(path="/tmp/db_voltari.jpg", quality=42, type="jpeg", full_page=False)
        print("db shots captured")
        print("No page errors." if not errors else f"PAGE ERRORS: {errors}")
        await browser.close()


asyncio.run(main())
