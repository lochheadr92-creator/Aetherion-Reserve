"""Visual verification: tutorial, alignment (preview vs tile), weather/night render."""
import asyncio
from playwright.async_api import async_playwright

URL = "http://localhost:3000"


async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        page = await browser.new_page(viewport={"width": 1920, "height": 950})
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)[:300]))
        await page.goto(URL, wait_until="networkidle", timeout=30000)
        await page.wait_for_timeout(1200)
        # clear tutorial flag to simulate first-time user
        await page.evaluate("localStorage.removeItem('aetherion_tutorial_done')")
        await page.click('[data-testid="mode-sandbox"]')
        await page.click('[data-testid="start-game-button"]')
        await page.wait_for_timeout(1800)

        tut = await page.locator('[data-testid="tutorial-overlay"]').count()
        paused = await page.evaluate("window.__game.state.paused")
        print("tutorial visible:", tut, "| paused during tutorial:", paused)
        await page.screenshot(path="/tmp/v2_tutorial.jpg", quality=30, type="jpeg")

        # walk through and finish
        for _ in range(5):
            await page.click('[data-testid="tutorial-next-button"]')
            await page.wait_for_timeout(150)
        await page.click('[data-testid="tutorial-finish-button"]')
        await page.wait_for_timeout(400)
        print("tutorial closed:", await page.locator('[data-testid="tutorial-overlay"]').count() == 0,
              "| unpaused:", not await page.evaluate("window.__game.state.paused"))
        print("help reopens:", end=" ")
        await page.click('[data-testid="hud-help-button"]')
        await page.wait_for_timeout(200)
        print(await page.locator('[data-testid="tutorial-overlay"]').count() == 1)
        await page.click('[data-testid="tutorial-skip-button"]')

        # alignment check: hover with raise tool at a tile, screenshot zoomed in
        await page.evaluate("window.__gameRenderer.centerOn(36, 36); window.__gameRenderer.cam.zoom = 1.8;")
        await page.evaluate("window.__gameRenderer.centerOn(36, 36)")
        await page.click('[data-testid="cat-terrain"]')
        await page.click('[data-testid="tool-raise"]')
        p = await page.evaluate(
            """(() => {
                const r = window.__gameRenderer; const s = window.__game.state;
                const x=36,y=36; const h = s.heights[y*s.size+x]||0;
                const wx=(x+0.5-y-0.5)*32, wy=(x+0.5+y+0.5)*16-h*10;
                return {sx: wx*r.cam.zoom+r.cam.x, sy: wy*r.cam.zoom+r.cam.y};
            })()"""
        )
        await page.mouse.move(p["sx"], p["sy"])
        await page.wait_for_timeout(300)
        await page.screenshot(path="/tmp/v2_align.jpg", quality=40, type="jpeg")

        # night + storm render
        await page.evaluate("""(() => {
            const s = window.__game.state;
            s.tick = Math.floor(s.tick / 1800) * 1800 + 1500; // night
            s.weather = { type: 'storm', ticksLeft: 500 };
        })()""")
        await page.wait_for_timeout(600)
        label = await page.locator('[data-testid="hud-weather-label"]').inner_text()
        clock = await page.locator('[data-testid="hud-clock"]').inner_text()
        print("weather chip:", label, clock)
        await page.screenshot(path="/tmp/v2_night_storm.jpg", quality=30, type="jpeg")

        print("PAGE ERRORS:" if errors else "No page errors.")
        for e in errors[:8]:
            print(" -", e)
        await browser.close()


asyncio.run(main())
