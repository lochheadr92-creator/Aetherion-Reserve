"""Record tests/ops_deck_dom_baseline.json from the CURRENT build (run this on main / with the
GameScreen changes stashed). Captures every [data-testid] element (tag#id, DOM order) in a fresh
sandbox with nothing open, and again with the Species Database open."""
import asyncio, json, os, sys
from playwright.async_api import async_playwright

from config import URL

DOM_IDS = "Array.from(document.querySelectorAll('[data-testid]')).map(e => e.tagName.toLowerCase() + '#' + e.dataset.testid)"


async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        page = await browser.new_page(viewport={"width": 1600, "height": 900})
        await page.goto(URL + "/?legacyHud=1", wait_until="networkidle", timeout=30000)
        await page.evaluate("localStorage.setItem('aetherion_tutorial_done','1'); localStorage.removeItem('aetherion.opsDeck')")
        await page.reload(wait_until="networkidle")
        await page.wait_for_timeout(900)
        await page.click('[data-testid="mode-sandbox"]')
        await page.click('[data-testid="start-game-button"]')
        await page.wait_for_timeout(1500)
        await page.click('[data-testid="hud-time-pause-button"]')
        has_dock = await page.locator('[data-testid="ops-dock"]').count()
        closed = await page.evaluate(DOM_IDS)
        await page.click('[data-testid="species-database-open-button"]')
        await page.wait_for_timeout(300)
        opened = await page.evaluate(DOM_IDS)
        await browser.close()
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ops_deck_dom_baseline.json")
    json.dump({"closed": closed, "species_open": opened}, open(out, "w"), indent=1)
    print(f"recorded {len(closed)} closed / {len(opened)} open ids -> {out} (dock present: {has_dock})")


asyncio.run(main())
