import asyncio, sys, time
sys.path.insert(0, '/app/tests')
from playwright.async_api import async_playwright
from config import URL

async def main():
    q = sys.argv[1] if len(sys.argv) > 1 else "medium"
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
        page = await browser.new_page(viewport={"width": 900, "height": 520})
        logs = []
        page.on("console", lambda m: logs.append(m.type + ': ' + m.text[:300]))
        page.on("pageerror", lambda e: logs.append("PAGEERROR: " + str(e)[:300]))
        await page.goto(URL + "?gfx=" + q, wait_until="networkidle", timeout=60000)
        await page.evaluate("localStorage.setItem('aetherion_tutorial_done','1')")
        await page.reload(wait_until="networkidle")
        await page.click('[data-testid="mode-sandbox"]', force=True)
        await page.click('[data-testid="start-game-button"]', force=True)
        t0 = time.time()
        for i in range(6):
            await page.wait_for_timeout(2000)
            try:
                info = await asyncio.wait_for(page.evaluate("(() => { const w = window.__world3d; const r = window.__gameRenderer; return { mode: window.__renderMode, frame: r && r.frame, q: w && w.quality, ms: w && w.stats.frameMs, hud: !!document.querySelector('[data-testid=hud-time-pause-button]') }; })()"), 15)
                print(round(time.time() - t0, 1), info)
            except Exception as e:
                print(round(time.time() - t0, 1), "evaluate timeout", str(e)[:80])
        await page.screenshot(path="/tmp/dbg_q.png")
        print("LOGS:", [l for l in logs if 'Canvas2D' not in l and 'DevTools' not in l][:8])
        await browser.close()

asyncio.run(main())
