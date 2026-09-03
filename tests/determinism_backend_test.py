"""Determinism/persistence sanity + backend health check."""
import asyncio
import os
import requests
from playwright.async_api import async_playwright
from phase6_helpers import boot, build_park

URL = os.environ.get("AETHERION_URL", "https://discovery-bio.preview.emergentagent.com")
BACKEND_URL = os.environ.get("AETHERION_URL", "https://discovery-bio.preview.emergentagent.com")


async def main():
    # ---- Backend health check ----
    print("=== BACKEND HEALTH CHECK ===")
    try:
        r = requests.get(f"{BACKEND_URL}/api/", timeout=10)
        print(f"GET /api/ status: {r.status_code} {'PASS' if r.status_code == 200 else 'FAIL'}")
    except Exception as e:
        print(f"GET /api/ FAIL: {e}")

    # ---- Determinism/persistence check ----
    print("\n=== DETERMINISM/PERSISTENCE CHECK ===")
    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        page = await browser.new_page(viewport={"width": 1920, "height": 950})
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)[:300]))
        await boot(page, URL)
        S = lambda expr: page.evaluate(expr)

        await build_park(page)
        await page.wait_for_timeout(800)  # let pops/dust settle

        # Save the game
        save = await page.evaluate("window.__game.saveGame('Determinism Test')")
        save_id = save["id"] if isinstance(save, dict) and "id" in save else await S("window.__game.saveId")
        
        # Check the save payload for fx-related fields by inspecting the state object
        # The state is serialized, so we check if any fx properties exist
        state_keys = await page.evaluate("Object.keys(window.__game.state)")
        
        # Check if any fx state leaked into the game state
        has_zoom_target = "zoomTarget" in state_keys
        has_pan_vel = "panVel" in state_keys
        has_shake_mag = "shakeMag" in state_keys
        has_pops = "pops" in state_keys
        has_particles = "particles" in state_keys
        
        fx_leak = has_zoom_target or has_pan_vel or has_shake_mag or has_pops or has_particles
        print(f"FX state leak check: {'FAIL' if fx_leak else 'PASS'}")
        if fx_leak:
            print(f"  zoomTarget: {has_zoom_target}, panVel: {has_pan_vel}, shakeMag: {has_shake_mag}, pops: {has_pops}, particles: {has_particles}")
        
        # Reload and check for console errors
        await page.evaluate(f"window.__game.loadGame('{save_id}')")
        await page.wait_for_timeout(1000)
        
        print(f"Console errors after load: {'FAIL' if errors else 'PASS'}")
        if errors:
            print(f"  Errors: {errors}")
        
        # Check that fx state is present on renderer but not in game state
        fx_on_renderer = await S("window.__gameRenderer.fx !== undefined && window.__gameRenderer.fx.zoomTarget !== undefined")
        fx_in_state = await S("window.__game.state.zoomTarget !== undefined || window.__game.state.panVel !== undefined")
        
        print(f"FX on renderer only: {'PASS' if fx_on_renderer and not fx_in_state else 'FAIL'}")
        
        # Clean up
        await page.evaluate(f"window.__game.deleteSave('{save_id}')")
        
        # Test saves CRUD via backend
        print("\n=== BACKEND SAVES CRUD ===")
        try:
            # Get saves list
            saves_response = await page.evaluate("""
                fetch(window.BACKEND_URL + '/api/saves', {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' }
                }).then(r => ({ status: r.status, ok: r.ok }))
            """)
            print(f"GET /api/saves status: {saves_response['status']} {'PASS' if saves_response['ok'] else 'FAIL'}")
        except Exception as e:
            print(f"GET /api/saves FAIL: {e}")
        
        print(f"\nPAGE ERRORS: {errors if errors else 'none'}")
        await browser.close()


asyncio.run(main())
