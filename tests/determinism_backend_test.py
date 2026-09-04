"""Determinism/persistence sanity + backend health check.

Every PASS/FAIL line is collected; the process exits 1 if any check failed.
All HTTP calls go through config.API (AETHERION_URL env var, preview fallback).
"""
import asyncio
import os
import sys
import requests
from playwright.async_api import async_playwright
from phase6_helpers import boot, build_park

from config import URL, API
from save_cleanup import SaveCleanup

results = []


def check(name, ok, detail=""):
    results.append(bool(ok))
    print(f"{name}: {'PASS' if ok else 'FAIL'}" + (f" {detail}" if detail else ""))


async def main():
    # ---- Backend health check ----
    print("=== BACKEND HEALTH CHECK ===")
    try:
        r = requests.get(f"{API}/", timeout=10)
        check("GET /api/ status", r.status_code == 200, str(r.status_code))
    except Exception as e:
        check("GET /api/ status", False, str(e))

    # ---- Determinism/persistence check ----
    print("\n=== DETERMINISM/PERSISTENCE CHECK ===")
    async with async_playwright() as pw, SaveCleanup() as tracker:  # deletes every save this run creates
        browser = await pw.chromium.launch()
        page = await browser.new_page(viewport={"width": 1920, "height": 950})
        tracker.attach(page)
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)[:300]))
        await boot(page, URL)
        S = lambda expr: page.evaluate(expr)

        await build_park(page)
        await page.wait_for_timeout(800)  # let pops/dust settle

        # Save the game
        save = await page.evaluate("window.__game.saveGame('Determinism Test')")
        save_id = save["id"] if isinstance(save, dict) and "id" in save else await S("window.__game.saveId")
        tracker.add(save_id, await S("window.__gameDebug.playerToken()"))

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
        check("FX state leak check", not fx_leak,
              "" if not fx_leak else f"zoomTarget: {has_zoom_target}, panVel: {has_pan_vel}, shakeMag: {has_shake_mag}, pops: {has_pops}, particles: {has_particles}")

        # Reload and check for console errors
        await page.evaluate(f"window.__game.loadGame('{save_id}')")
        await page.wait_for_timeout(1000)

        check("Console errors after load", not errors, "" if not errors else f"Errors: {errors}")

        # Check that fx state is present on renderer but not in game state
        fx_on_renderer = await S("window.__gameRenderer.fx !== undefined && window.__gameRenderer.fx.zoomTarget !== undefined")
        fx_in_state = await S("window.__game.state.zoomTarget !== undefined || window.__game.state.panVel !== undefined")

        check("FX on renderer only", fx_on_renderer and not fx_in_state)

        # Clean up
        await page.evaluate(f"window.__game.deleteSave('{save_id}')")
        tracker.forget(save_id)  # already deleted by the test itself

        # Test saves CRUD via backend
        print("\n=== BACKEND SAVES CRUD ===")
        try:
            r = requests.get(f"{API}/saves", headers={"Content-Type": "application/json"}, timeout=10)
            check("GET /api/saves status", r.ok, str(r.status_code))
        except Exception as e:
            check("GET /api/saves status", False, str(e))

        print(f"\nPAGE ERRORS: {errors if errors else 'none'}")
        await browser.close()

    print(f"\n{sum(results)}/{len(results)} checks passed")
    sys.exit(0 if all(results) else 1)


asyncio.run(main())
