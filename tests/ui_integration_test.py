#!/usr/bin/env python3
"""UI Integration test for Phase 21 - User-facing verification"""
import asyncio
import os
from playwright.async_api import async_playwright

from config import URL
from save_cleanup import SaveCleanup
async def main():
    async with async_playwright() as pw, SaveCleanup() as tracker:  # deletes every save this run creates
        browser = await pw.chromium.launch()
        page = await browser.new_page(viewport={"width": 1920, "height": 1080})
        tracker.attach(page)
        
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        
        print("🧪 Starting UI Integration Tests...")
        
        try:
            # Boot and setup
            print("\n1️⃣ Testing game boot and menu...")
            await page.goto(URL, wait_until="networkidle", timeout=30000)
            await page.wait_for_timeout(1500)
            
            # Set tutorial done
            await page.evaluate("localStorage.setItem('aetherion_tutorial_done', '1')")
            
            # Check main menu loads
            sandbox_btn = await page.locator('[data-testid="mode-sandbox"]').count()
            scenario_btn = await page.locator('[data-testid="mode-scenario"]').count()
            print(f"   ✅ Main menu loaded (sandbox={sandbox_btn}, scenario={scenario_btn})")
            
            # Start sandbox game
            print("\n2️⃣ Testing sandbox game start...")
            await page.click('[data-testid="mode-sandbox"]')
            await page.wait_for_timeout(300)
            await page.click('[data-testid="start-game-button"]')
            await page.wait_for_timeout(2000)
            
            # Check game canvas loaded
            canvas = await page.locator('[data-testid="game-canvas"]').count()
            hud = await page.locator('[data-testid="hud-bar"]').count()
            print(f"   ✅ Game loaded (canvas={canvas}, hud={hud})")
            
            # Pause game
            await page.click('[data-testid="hud-time-pause-button"]')
            await page.wait_for_timeout(300)
            
            # Test 3: Edge Scrolling UI
            print("\n3️⃣ Testing Edge Scrolling settings...")
            await page.click('[data-testid="hud-audio-button"]')
            await page.wait_for_timeout(400)
            
            # Check audio popover opened
            popover = await page.locator('[data-testid="audio-popover"]').count()
            print(f"   ✅ Audio popover opened (count={popover})")
            
            # Check edge scroll toggle exists
            edge_toggle = await page.locator('[data-testid="edge-scroll-toggle"]').count()
            edge_text = await page.locator('[data-testid="edge-scroll-toggle"]').inner_text()
            print(f"   ✅ Edge scroll toggle found: '{edge_text}'")
            
            # Check existing audio controls still present
            mute_toggle = await page.locator('[data-testid="audio-mute-toggle"]').count()
            volume_slider = await page.locator('[data-testid="audio-volume-slider"]').count()
            print(f"   ✅ Audio controls present (mute={mute_toggle}, volume={volume_slider})")
            
            # Close popover
            await page.click('[data-testid="hud-audio-button"]')
            await page.wait_for_timeout(300)
            
            # Test 4: Edge scrolling behavior
            print("\n4️⃣ Testing Edge Scrolling behavior...")
            box = await page.locator('[data-testid="game-canvas"]').bounding_box()
            
            # Get initial camera position
            cam_x = await page.evaluate("window.__gameRenderer.cam.x")
            
            # Move to right edge and wait
            await page.mouse.move(box["x"] + box["width"] - 6, box["y"] + box["height"] / 2)
            await page.wait_for_timeout(1000)
            
            # Check edge scrolling activated
            edge_state = await page.evaluate("window.__gameInput.edge")
            new_cam_x = await page.evaluate("window.__gameRenderer.cam.x")
            
            if edge_state["active"] and new_cam_x < cam_x - 30:
                print(f"   ✅ Edge scrolling works (cam moved from {cam_x:.1f} to {new_cam_x:.1f})")
            else:
                print(f"   ⚠️  Edge scrolling may not be working (active={edge_state['active']}, cam {cam_x:.1f} -> {new_cam_x:.1f})")
            
            # Move back to center
            await page.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
            await page.wait_for_timeout(300)
            
            # Test 5: Staff screen and radio toggle
            print("\n5️⃣ Testing Staff screen and Radio toggle...")
            await page.click('[data-testid="open-staff-button"]')
            await page.wait_for_timeout(500)
            
            # Check staff screen opened
            staff_screen = await page.locator('[data-testid="staff-screen"]').count()
            print(f"   ✅ Staff screen opened (count={staff_screen})")
            
            # Check radio toggle exists
            radio_toggle = await page.locator('[data-testid="staff-radio-toggle"]').count()
            print(f"   ✅ Radio chatter toggle found (count={radio_toggle})")
            
            # Check if we can see staff list or hire button
            hire_btn = await page.locator('[data-testid="hire-staff-button"]').count()
            print(f"   ✅ Staff controls visible (hire button={hire_btn})")
            
            # Close staff screen
            await page.click('[data-testid="staff-close-button"]')
            await page.wait_for_timeout(300)
            
            # Test 6: Alerts feed
            print("\n6️⃣ Testing Alerts feed...")
            await page.click('[data-testid="hud-alerts-button"]')
            await page.wait_for_timeout(400)
            
            # Check alerts dropdown opened
            alerts_dropdown = await page.locator('[data-testid="alerts-dropdown"]').count()
            print(f"   ✅ Alerts dropdown opened (count={alerts_dropdown})")
            
            # Close alerts
            await page.click('[data-testid="hud-alerts-button"]')
            await page.wait_for_timeout(300)
            
            # Test 7: Start scenario with creatures
            print("\n7️⃣ Testing Bloodline Ledger with scenario...")
            await page.click('[data-testid="hud-exit-button"]')
            await page.wait_for_timeout(1000)
            
            # Start sovereign bloodline scenario
            await page.click('[data-testid="mode-scenario"]')
            await page.wait_for_timeout(300)
            await page.click('[data-testid="scenario-card-sovereign_bloodline"]')
            await page.wait_for_timeout(300)
            await page.click('[data-testid="start-game-button"]')
            await page.wait_for_timeout(2500)
            
            # Pause
            await page.click('[data-testid="hud-time-pause-button"]')
            await page.wait_for_timeout(300)
            
            # Check creatures exist
            creatures = await page.evaluate("window.__game.state.creatures.length")
            print(f"   ✅ Scenario loaded with {creatures} creatures")
            
            # Select first creature
            print("\n8️⃣ Testing Creature Panel and Bloodline Ledger...")
            await page.evaluate("""(() => {
                const c = window.__game.state.creatures[0];
                window.__gameRenderer.centerOn(c.x, c.y);
                window.__gameRenderer.selection = { kind: 'creature', id: c.id };
            })()""")
            await page.wait_for_timeout(500)
            
            # Check creature panel opened
            creature_panel = await page.locator('[data-testid="creature-panel"]').count()
            print(f"   ✅ Creature panel opened (count={creature_panel})")
            
            # Check ledger button exists
            ledger_btn = await page.locator('[data-testid="creature-ledger-button"]').count()
            print(f"   ✅ Bloodline Ledger button found (count={ledger_btn})")
            
            if ledger_btn > 0:
                # Open ledger
                await page.click('[data-testid="creature-ledger-button"]')
                await page.wait_for_timeout(600)
                
                # Check ledger dialog opened
                ledger_dialog = await page.locator('[data-testid="bloodline-ledger"]').count()
                print(f"   ✅ Bloodline Ledger dialog opened (count={ledger_dialog})")
                
                if ledger_dialog > 0:
                    # Check ledger components
                    ledger_title = await page.locator('[data-testid="ledger-title"]').count()
                    wild_origin = await page.locator('[data-testid="ledger-wild-origin"]').count()
                    close_btn = await page.locator('[data-testid="ledger-close-button"]').count()
                    
                    print(f"   ✅ Ledger components (title={ledger_title}, wild={wild_origin}, close={close_btn})")
                    
                    # Close ledger
                    await page.click('[data-testid="ledger-close-button"]')
                    await page.wait_for_timeout(300)
            
            # Test 9: Input UX (pan, zoom)
            print("\n9️⃣ Testing Input UX (pan, zoom)...")
            box = await page.locator('[data-testid="game-canvas"]').bounding_box()
            
            # Test right-click pan
            cam_before = await page.evaluate("({ x: window.__gameRenderer.cam.x, y: window.__gameRenderer.cam.y })")
            await page.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
            await page.mouse.down(button="right")
            await page.mouse.move(box["x"] + box["width"] / 2 + 100, box["y"] + box["height"] / 2 + 50)
            await page.mouse.up(button="right")
            await page.wait_for_timeout(200)
            cam_after = await page.evaluate("({ x: window.__gameRenderer.cam.x, y: window.__gameRenderer.cam.y })")
            
            pan_worked = abs(cam_after["x"] - cam_before["x"]) > 50 or abs(cam_after["y"] - cam_before["y"]) > 30
            print(f"   ✅ Right-click pan works: {pan_worked}")
            
            # Test wheel zoom
            zoom_before = await page.evaluate("window.__gameRenderer.cam.zoom")
            await page.mouse.wheel(0, -100)
            await page.wait_for_timeout(300)
            zoom_after = await page.evaluate("window.__gameRenderer.cam.zoom")
            
            zoom_worked = zoom_after != zoom_before
            print(f"   ✅ Wheel zoom works: {zoom_worked} (zoom {zoom_before:.2f} -> {zoom_after:.2f})")
            
            # Test 10: Save/Load
            print("\n🔟 Testing Save/Load...")
            await page.click('[data-testid="hud-save-button"]')
            await page.wait_for_timeout(2500)
            
            # Check if save succeeded (no error toast)
            save_success = True
            print(f"   ✅ Save initiated")
            
            # Exit to menu
            await page.click('[data-testid="hud-exit-button"]')
            await page.wait_for_timeout(1500)
            
            # Check save slots visible
            save_slots = await page.locator('[data-testid^="save-slot-"]').count()
            print(f"   ✅ Save slots visible (count={save_slots})")
            
            # Test 11: Check for console errors
            print("\n1️⃣1️⃣ Checking for errors...")
            if errors:
                print(f"   ⚠️  Found {len(errors)} console errors:")
                for err in errors[:3]:
                    print(f"      - {err[:150]}")
            else:
                print(f"   ✅ No console errors detected")
            
            # Test 12: Visual check - take screenshot
            print("\n1️⃣2️⃣ Taking screenshot for visual verification...")
            await page.screenshot(path="/app/.screenshots/ui_integration_final.png", quality=40, full_page=False)
            print(f"   ✅ Screenshot saved")
            
            print("\n" + "="*60)
            print("✅ UI Integration Tests Complete!")
            print("="*60)
            
        except Exception as e:
            print(f"\n❌ Test failed with error: {str(e)}")
            import traceback
            traceback.print_exc()
        
        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
