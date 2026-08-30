import asyncio
from playwright.async_api import async_playwright

URL = "http://localhost:3000"

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={"width": 1920, "height": 900})
        logs = []
        page.on("console", lambda m: logs.append(f"{m.type}: {m.text[:300]}"))
        page.on("pageerror", lambda e: logs.append(f"PAGEERROR: {str(e)[:400]}"))
        await page.goto(URL, wait_until="networkidle", timeout=30000)
        await page.wait_for_timeout(1500)
        await page.click('[data-testid="start-game-button"]')
        await page.wait_for_timeout(4000)
        gs = await page.locator('[data-testid="game-screen"]').count()
        cv = await page.locator('[data-testid="game-canvas"]').count()
        print("game-screen:", gs, "canvas:", cv)
        cash = await page.locator('[data-testid="hud-cash-value"]').count()
        print("hud cash el:", cash)
        if cash:
            print("cash text:", await page.locator('[data-testid="hud-cash-value"]').inner_text())
        await page.screenshot(path="/tmp/game_dbg.jpg", quality=30, type="jpeg")
        for l in logs[:30]:
            print("LOG>", l)
        await browser.close()

asyncio.run(main())
