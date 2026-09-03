"""Phase 19: Photo Mode — HUD entry, letterbox overlay, grid + pause toggles,
capture to framed PNG, preview dialog with download, retake and exit flows."""
import asyncio
import os
from playwright.async_api import async_playwright

URL = os.environ.get("AETHERION_URL", "https://discovery-bio.preview.emergentagent.com")


async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        page = await browser.new_page(viewport={"width": 1920, "height": 950})
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)[:300]))
        S = lambda expr: page.evaluate(expr)
        await page.goto(URL, wait_until="networkidle", timeout=30000)
        await page.wait_for_timeout(1200)
        await page.evaluate("localStorage.setItem('aetherion_tutorial_done','1')")
        await page.click('[data-testid="mode-sandbox"]')
        await page.click('[data-testid="start-game-button"]')
        await page.wait_for_timeout(2000)

        # ---- TEST 1: enter photo mode from the HUD ----
        await page.click('[data-testid="hud-photo-button"]')
        await page.wait_for_timeout(400)
        overlay = await page.locator('[data-testid="photo-mode-overlay"]').count()
        hud = await page.locator('[data-testid="hud-save-button"]').count()
        toolbar = await page.locator('[data-testid="build-toolbar"]').count()
        print("TEST 1 photo mode opens, HUD/toolbar hidden:",
              "PASS" if overlay == 1 and hud == 0 and toolbar == 0 else f"FAIL (o={overlay} hud={hud} tb={toolbar})")

        # ---- TEST 2: grid + pause toggles ----
        grid0 = await page.locator('[data-testid="photo-grid-lines"]').count()
        await page.click('[data-testid="photo-grid-toggle"]')
        await page.wait_for_timeout(150)
        grid1 = await page.locator('[data-testid="photo-grid-lines"]').count()
        await page.click('[data-testid="photo-grid-toggle"]')
        print("TEST 2a rule-of-thirds grid toggles:", "PASS" if grid0 == 1 and grid1 == 0 else f"FAIL ({grid0}->{grid1})")
        await page.click('[data-testid="photo-pause-toggle"]')
        await page.wait_for_timeout(150)
        paused = await S("window.__game.state.paused")
        await page.click('[data-testid="photo-pause-toggle"]')
        print("TEST 2b freeze-the-moment pause toggle:", "PASS" if paused else "FAIL")

        # ---- TEST 3: capture -> preview dialog with framed PNG ----
        await page.click('[data-testid="photo-capture-button"]')
        await page.wait_for_timeout(700)
        dlg = await page.locator('[data-testid="photo-preview-dialog"]').count()
        src = await page.locator('[data-testid="photo-preview-image"]').get_attribute("src")
        print("TEST 3a capture opens preview:", "PASS" if dlg == 1 else f"FAIL ({dlg})")
        print("TEST 3b image is a PNG data URL:",
              "PASS" if src and src.startswith("data:image/png") and len(src) > 20000 else f"FAIL (len={len(src or '')})")
        href = await page.locator('[data-testid="photo-download-button"]').get_attribute("href")
        dl = await page.locator('[data-testid="photo-download-button"]').get_attribute("download")
        print("TEST 3c download link ready:",
              "PASS" if href and href.startswith("data:image/png") and dl and dl.endswith(".png") else f"FAIL ({dl})")

        # ---- TEST 4: retake returns to framing ----
        await page.click('[data-testid="photo-retake-button"]')
        await page.wait_for_timeout(250)
        dlg2 = await page.locator('[data-testid="photo-preview-dialog"]').count()
        cap = await page.locator('[data-testid="photo-capture-button"]').count()
        print("TEST 4 retake returns to framing:", "PASS" if dlg2 == 0 and cap == 1 else f"FAIL (d={dlg2} c={cap})")

        # ---- TEST 5: SPACE captures, Done closes back to game UI ----
        await page.keyboard.press("Space")
        await page.wait_for_timeout(700)
        dlg3 = await page.locator('[data-testid="photo-preview-dialog"]').count()
        print("TEST 5a SPACE shortcut captures:", "PASS" if dlg3 == 1 else f"FAIL ({dlg3})")
        await page.click('[data-testid="photo-close-button"]')
        await page.wait_for_timeout(300)
        overlay2 = await page.locator('[data-testid="photo-mode-overlay"]').count()
        hud2 = await page.locator('[data-testid="hud-save-button"]').count()
        print("TEST 5b Done exits photo mode, HUD restored:", "PASS" if overlay2 == 0 and hud2 == 1 else f"FAIL (o={overlay2} h={hud2})")

        # ---- TEST 6: ESC exits photo mode ----
        await page.click('[data-testid="hud-photo-button"]')
        await page.wait_for_timeout(300)
        await page.keyboard.press("Escape")
        await page.wait_for_timeout(300)
        overlay3 = await page.locator('[data-testid="photo-mode-overlay"]').count()
        print("TEST 6 ESC exits photo mode:", "PASS" if overlay3 == 0 else f"FAIL ({overlay3})")

        print("No page errors." if not errors else f"PAGE ERRORS: {errors}")
        await browser.close()


asyncio.run(main())
