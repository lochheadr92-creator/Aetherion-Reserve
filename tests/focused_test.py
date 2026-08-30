"""Focused test for remaining features not covered by smoke/scenario tests."""
import asyncio
from playwright.async_api import async_playwright

URL = "https://discovery-bio.preview.emergentagent.com"

async def main():
    results = []
    
    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        page = await browser.new_page(viewport={"width": 1920, "height": 950})
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)[:300]))
        
        print("=" * 80)
        print("FOCUSED FEATURE TEST - Remaining Features")
        print("=" * 80)
        
        try:
            # ========== MAIN MENU - Park Name Input ==========
            print("\n[1] MAIN MENU - Park Name Input")
            await page.goto(URL, wait_until="networkidle", timeout=30000)
            await page.wait_for_timeout(1500)
            
            park_input = await page.locator('[data-testid="park-name-input"]').count()
            results.append(("Park name input exists", park_input > 0))
            print(f"  ✓ Park name input: {'PASS' if park_input > 0 else 'FAIL'}")
            
            if park_input > 0:
                await page.locator('[data-testid="park-name-input"]').fill("Test Facility Omega")
                value = await page.locator('[data-testid="park-name-input"]').input_value()
                results.append(("Park name input works", value == "Test Facility Omega"))
                print(f"  ✓ Park name input works: {'PASS' if value == 'Test Facility Omega' else 'FAIL'}")
            
            # ========== MANAGEMENT MODE - Locked Tools ==========
            print("\n[2] MANAGEMENT MODE - Locked Tools")
            await page.click('[data-testid="mode-management"]')
            await page.wait_for_timeout(300)
            await page.click('[data-testid="start-game-button"]')
            await page.wait_for_timeout(2500)
            
            S = lambda expr: page.evaluate(expr)
            
            # Check cash in management mode
            cash = await S("window.__game.state.cash")
            results.append(("Management cash", cash == 150000))
            print(f"  ✓ Management cash (◈{cash:,}): {'PASS' if cash == 150000 else 'FAIL'}")
            
            # Check locked tools
            await page.click('[data-testid="cat-water"]')
            await page.wait_for_timeout(300)
            
            deep_water_disabled = await page.locator('[data-testid="tool-water-deep"][disabled]').count()
            results.append(("Deep water locked in management", deep_water_disabled > 0))
            print(f"  ✓ Deep water locked: {'PASS' if deep_water_disabled > 0 else 'FAIL'}")
            
            await page.click('[data-testid="cat-fences"]')
            await page.wait_for_timeout(300)
            
            # Check for tier 2+ fences locked
            tier2_locked = await page.locator('[data-testid="fence-tier-2"][disabled]').count()
            results.append(("Tier 2 fence locked in management", tier2_locked > 0))
            print(f"  ✓ Tier 2 fence locked: {'PASS' if tier2_locked > 0 else 'FAIL'}")
            
            # ========== SPECIES DATABASE - UNKNOWN Fields ==========
            print("\n[3] SPECIES DATABASE - UNKNOWN Fields")
            
            await page.click('[data-testid="species-database-open-button"]')
            await page.wait_for_timeout(500)
            
            db_modal = await page.locator('[data-testid="species-database-modal"]').count()
            results.append(("Species database opens", db_modal > 0))
            print(f"  ✓ Species database opens: {'PASS' if db_modal > 0 else 'FAIL'}")
            
            if db_modal > 0:
                # Click on Veyra (should have UNKNOWN fields in management mode)
                veyra_row = await page.locator('[data-testid="species-row-veyra"]').count()
                results.append(("Veyra species row exists", veyra_row > 0))
                print(f"  ✓ Veyra species row: {'PASS' if veyra_row > 0 else 'FAIL'}")
                
                if veyra_row > 0:
                    await page.click('[data-testid="species-row-veyra"]')
                    await page.wait_for_timeout(500)
                    
                    # Check for UNKNOWN redacted fields
                    unknown_water = await page.locator('[data-testid="db-unknown-water"]').count()
                    unknown_social = await page.locator('[data-testid="db-unknown-social"]').count()
                    results.append(("Veyra UNKNOWN fields", unknown_water > 0 or unknown_social > 0))
                    print(f"  ✓ Veyra UNKNOWN fields (water: {unknown_water}, social: {unknown_social}): {'PASS' if unknown_water > 0 or unknown_social > 0 else 'FAIL'}")
                    
                    # Check knowledge level
                    page_text = await page.locator('[data-testid="species-database-modal"]').inner_text()
                    has_unclassified = "unclassified" in page_text.lower()
                    results.append(("Knowledge level shown", has_unclassified))
                    print(f"  ✓ Knowledge level 'Unclassified': {'PASS' if has_unclassified else 'FAIL'}")
                
                # Check Skitterling (should be fully documented)
                skitter_row = await page.locator('[data-testid="species-row-skitter"]').count()
                if skitter_row > 0:
                    await page.click('[data-testid="species-row-skitter"]')
                    await page.wait_for_timeout(500)
                    
                    page_text = await page.locator('[data-testid="species-database-modal"]').inner_text()
                    has_documented = "fully documented" in page_text.lower() or "documented" in page_text.lower()
                    results.append(("Skitterling fully documented", has_documented))
                    print(f"  ✓ Skitterling fully documented: {'PASS' if has_documented else 'SOFT-FAIL'}")
                
                await page.keyboard.press("Escape")
                await page.wait_for_timeout(300)
            
            # ========== FIELD OPS - Tier Locks ==========
            print("\n[4] FIELD OPS - Tier Locks in Management")
            
            await page.click('[data-testid="open-fieldops-button"]')
            await page.wait_for_timeout(500)
            
            # Check for UNRESOLVED SIGNAL on tier 2/3 species
            unresolved = await page.locator('text=UNRESOLVED SIGNAL').count()
            results.append(("Tier 2/3 locked in management", unresolved > 0))
            print(f"  ✓ Tier 2/3 species locked (UNRESOLVED SIGNAL count: {unresolved}): {'PASS' if unresolved > 0 else 'FAIL'}")
            
            await page.keyboard.press("Escape")
            await page.wait_for_timeout(300)
            
            # ========== RESEARCH - Lab Requirement ==========
            print("\n[5] RESEARCH - Lab Requirement")
            
            await page.click('[data-testid="open-research-button"]')
            await page.wait_for_timeout(500)
            
            research_modal = await page.locator('[data-testid="research-modal"]').count()
            results.append(("Research modal opens", research_modal > 0))
            print(f"  ✓ Research modal opens: {'PASS' if research_modal > 0 else 'FAIL'}")
            
            if research_modal > 0:
                # Try to start research without lab
                has_lab = await S("window.__game.state.buildings.some(b => b.type === 'lab')")
                
                if not has_lab:
                    # Try to start research
                    start_btn = await page.locator('[data-testid^="research-start-"]').first.count()
                    if start_btn > 0:
                        await page.locator('[data-testid^="research-start-"]').first.click()
                        await page.wait_for_timeout(500)
                        
                        # Check for error message
                        error_msg = await page.locator('text=/requires.*laboratory/i').count()
                        results.append(("Research requires lab error", error_msg > 0))
                        print(f"  ✓ Research requires lab error: {'PASS' if error_msg > 0 else 'SOFT-FAIL (toast may have disappeared)'}")
                else:
                    print(f"  ⚠️  Lab already exists, skipping lab requirement test")
                
                await page.keyboard.press("Escape")
                await page.wait_for_timeout(300)
            
            # ========== OVERLAYS ==========
            print("\n[6] OVERLAYS")
            
            overlay_btns = await page.locator('[data-testid^="overlay-"]').count()
            results.append(("Overlay buttons exist", overlay_btns > 0))
            print(f"  ✓ Overlay buttons ({overlay_btns}): {'PASS' if overlay_btns > 0 else 'FAIL'}")
            
            if overlay_btns > 0:
                # Try habitat overlay
                habitat_btn = await page.locator('[data-testid="overlay-habitat"]').count()
                if habitat_btn > 0:
                    await page.click('[data-testid="overlay-habitat"]')
                    await page.wait_for_timeout(300)
                    
                    overlay_active = await S("window.__gameRenderer.overlay")
                    results.append(("Overlay activates", overlay_active is not None))
                    print(f"  ✓ Overlay activates: {'PASS' if overlay_active is not None else 'FAIL'}")
                    
                    # Toggle off
                    await page.click('[data-testid="overlay-habitat"]')
                    await page.wait_for_timeout(200)
            
            # ========== ALERTS DROPDOWN ==========
            print("\n[7] ALERTS DROPDOWN")
            
            alerts_btn = await page.locator('[data-testid="hud-alerts-button"]').count()
            results.append(("Alerts button exists", alerts_btn > 0))
            print(f"  ✓ Alerts button: {'PASS' if alerts_btn > 0 else 'FAIL'}")
            
            if alerts_btn > 0:
                await page.click('[data-testid="hud-alerts-button"]')
                await page.wait_for_timeout(400)
                
                alerts_dropdown = await page.locator('[data-testid="alerts-dropdown"]').count()
                results.append(("Alerts dropdown opens", alerts_dropdown > 0))
                print(f"  ✓ Alerts dropdown opens: {'PASS' if alerts_dropdown > 0 else 'FAIL'}")
                
                if alerts_dropdown > 0:
                    # Check for alert history
                    alert_count = await S("window.__game.state.alerts.length")
                    print(f"  ℹ️  Alert history count: {alert_count}")
                    
                    await page.keyboard.press("Escape")
                    await page.wait_for_timeout(200)
            
            # ========== OBJECTIVES PANEL ==========
            print("\n[8] OBJECTIVES PANEL")
            
            objectives_panel = await page.locator('[data-testid="objectives-panel"]').count()
            results.append(("Objectives panel exists", objectives_panel > 0))
            print(f"  ✓ Objectives panel: {'PASS' if objectives_panel > 0 else 'FAIL'}")
            
            if objectives_panel > 0:
                obj_text = await page.locator('[data-testid="objectives-panel"]').inner_text()
                has_objectives = len(obj_text) > 20
                results.append(("Objectives shown", has_objectives))
                print(f"  ✓ Objectives shown: {'PASS' if has_objectives else 'FAIL'}")
                print(f"  ℹ️  Objectives preview: {obj_text[:100]}...")
            
            # ========== SUMMARY ==========
            print("\n" + "=" * 80)
            print("TEST SUMMARY")
            print("=" * 80)
            
            passed = sum(1 for _, result in results if result)
            total = len(results)
            
            print(f"✅ PASSED: {passed}/{total} tests ({100*passed//total}%)")
            
            if errors:
                print(f"\n⚠️  PAGE ERRORS ({len(errors)}):")
                for e in errors[:5]:
                    print(f"  - {e}")
            else:
                print("\n✅ No page errors detected")
            
            print("\n" + "=" * 80)
            
        except Exception as e:
            print(f"\n❌ FATAL ERROR: {str(e)}")
            import traceback
            traceback.print_exc()
        
        finally:
            await browser.close()

asyncio.run(main())
