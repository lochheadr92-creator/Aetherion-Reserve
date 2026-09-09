"""
Phase M+N Manual Testing - Ops Deck Drawer Refactor & HUD Responsiveness
Tests the specific features mentioned in the review request.
"""
import asyncio
import sys
from playwright.async_api import async_playwright, expect
from config import URL

async def test_ops_deck_drawers():
    """Test Ops Deck drawer functionality at different viewports"""
    print("\n=== TESTING OPS DECK DRAWERS ===\n")
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        
        # Test at 1600x900
        print("Testing at viewport 1600x900...")
        context = await browser.new_context(viewport={'width': 1600, 'height': 900})
        page = await context.new_page()
        
        errors = []
        page.on("pageerror", lambda err: errors.append(str(err)))
        
        await page.goto(URL)
        await page.wait_for_load_state("networkidle")
        
        # Skip tutorial
        await page.evaluate("localStorage.setItem('aetherion_tutorial_done', '1')")
        await page.reload()
        await page.wait_for_load_state("networkidle")
        
        # Start sandbox game
        await page.click('[data-testid="mode-sandbox"]')
        await page.wait_for_timeout(500)
        await page.click('[data-testid="start-game-button"]')
        await page.wait_for_timeout(3000)
        
        # Test each dock button
        dock_buttons = [
            ('dock-open-fieldops-button', 'FIELD OPS'),
            ('dock-open-staff-button', 'STAFF'),
            ('dock-species-database-open-button', 'SPECIES DATABASE'),
            ('dock-open-research-button', 'RESEARCH'),
            ('dock-open-finances-button', 'FINANCES')
        ]
        
        for button_id, expected_title in dock_buttons:
            print(f"  Testing {button_id}...")
            
            # Click dock button
            await page.click(f'[data-testid="{button_id}"]')
            await page.wait_for_timeout(500)
            
            # Check drawer exists
            drawer = await page.query_selector('[data-testid="ops-drawer"]')
            if not drawer:
                print(f"    ❌ FAIL: Drawer not found for {button_id}")
                continue
            
            # Check drawer position and size
            drawer_box = await drawer.bounding_box()
            if drawer_box['x'] != 56:
                print(f"    ❌ FAIL: Drawer x position is {drawer_box['x']}, expected 56")
            elif drawer_box['width'] != 320:
                print(f"    ❌ FAIL: Drawer width is {drawer_box['width']}, expected 320")
            else:
                print(f"    ✅ PASS: Drawer positioned correctly at x=56, width=320")
            
            # Check data-host attribute
            screen_modal = await page.query_selector('[data-testid$="-modal"]')
            if screen_modal:
                host_attr = await screen_modal.get_attribute('data-host')
                if host_attr == 'drawer':
                    print(f"    ✅ PASS: Screen has data-host='drawer'")
                else:
                    print(f"    ❌ FAIL: Screen has data-host='{host_attr}', expected 'drawer'")
            
            # Check header and close button
            header = await page.query_selector('.nl-panel-header')
            close_btn = await page.query_selector('[data-testid$="-close-button"]')
            
            if header and close_btn:
                print(f"    ✅ PASS: Header and close button found")
            else:
                print(f"    ❌ FAIL: Missing header or close button")
            
            # Check title
            title_elem = await page.query_selector('[data-testid="drawer-title"]')
            if title_elem:
                title_text = await title_elem.inner_text()
                if expected_title in title_text:
                    print(f"    ✅ PASS: Title matches '{expected_title}'")
                else:
                    print(f"    ❌ FAIL: Title is '{title_text}', expected '{expected_title}'")
            
            # Check for horizontal overflow
            overflow_check = await page.evaluate("""() => {
                const drawer = document.querySelector('[data-testid="ops-drawer"]');
                if (!drawer) return {hasOverflow: true, elements: []};
                
                const overflowing = [];
                const allElements = drawer.querySelectorAll('*');
                
                for (const el of allElements) {
                    if (el.scrollWidth > el.clientWidth) {
                        overflowing.push(el.getAttribute('data-testid') || el.className);
                    }
                }
                
                return {hasOverflow: overflowing.length > 0, elements: overflowing};
            }""")
            
            if not overflow_check['hasOverflow']:
                print(f"    ✅ PASS: No horizontal overflow")
            else:
                print(f"    ❌ FAIL: Horizontal overflow detected in: {overflow_check['elements'][:3]}")
            
            # Close drawer
            await page.click(f'[data-testid="{button_id}"]')
            await page.wait_for_timeout(300)
        
        # Test Field Ops tabs specifically
        print("\n  Testing Field Ops tabs...")
        await page.click('[data-testid="dock-open-fieldops-button"]')
        await page.wait_for_timeout(500)
        
        tabs = ['fieldops-tab-acquire', 'fieldops-tab-expeditions', 'fieldops-tab-contracts']
        for tab_id in tabs:
            tab = await page.query_selector(f'[data-testid="{tab_id}"]')
            if tab:
                await tab.click()
                await page.wait_for_timeout(300)
                
                overflow_check = await page.evaluate("""() => {
                    const drawer = document.querySelector('[data-testid="ops-drawer"]');
                    if (!drawer) return true;
                    
                    const allElements = drawer.querySelectorAll('*');
                    for (const el of allElements) {
                        if (el.scrollWidth > el.clientWidth) return true;
                    }
                    return false;
                }""")
                
                if not overflow_check:
                    print(f"    ✅ PASS: {tab_id} - no overflow")
                else:
                    print(f"    ❌ FAIL: {tab_id} - has overflow")
        
        # Check no .ops-drawer-host exists
        drawer_host = await page.query_selector('.ops-drawer-host')
        if not drawer_host:
            print(f"  ✅ PASS: No .ops-drawer-host element exists")
        else:
            print(f"  ❌ FAIL: .ops-drawer-host element found (should not exist)")
        
        if not errors:
            print("\n✅ No console errors")
        else:
            print(f"\n❌ Console errors: {errors[:3]}")
        
        await context.close()
        await browser.close()

async def test_species_database():
    """Test Species Database drawer layout"""
    print("\n=== TESTING SPECIES DATABASE DRAWER ===\n")
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={'width': 1600, 'height': 900})
        page = await context.new_page()
        
        await page.goto(URL)
        await page.wait_for_load_state("networkidle")
        await page.evaluate("localStorage.setItem('aetherion_tutorial_done', '1')")
        await page.reload()
        await page.wait_for_load_state("networkidle")
        
        # Start sandbox
        await page.click('[data-testid="mode-sandbox"]')
        await page.wait_for_timeout(500)
        await page.click('[data-testid="start-game-button"]')
        await page.wait_for_timeout(3000)
        
        # Open Species Database
        await page.click('[data-testid="dock-species-database-open-button"]')
        await page.wait_for_timeout(500)
        
        # Check roster and detail layout
        layout_check = await page.evaluate("""() => {
            const drawer = document.querySelector('[data-testid="ops-drawer"]');
            if (!drawer) return {error: 'No drawer'};
            
            const drawerHeight = drawer.clientHeight;
            const detail = document.querySelector('[data-testid="species-detail"]');
            const roster = detail?.parentElement?.previousElementSibling;
            
            if (!detail || !roster) return {error: 'Missing detail or roster'};
            
            const rosterBox = roster.getBoundingClientRect();
            const detailBox = detail.getBoundingClientRect();
            
            const rosterScrolls = roster.scrollHeight > roster.clientHeight;
            const rosterPercent = (rosterBox.height / drawerHeight) * 100;
            const rosterAboveDetail = rosterBox.bottom <= detailBox.top;
            
            return {
                drawerHeight,
                rosterHeight: rosterBox.height,
                rosterPercent,
                rosterScrolls,
                rosterAboveDetail,
                detailTop: detailBox.top,
                rosterBottom: rosterBox.bottom
            };
        }""")
        
        if 'error' in layout_check:
            print(f"  ❌ FAIL: {layout_check['error']}")
        else:
            if layout_check['rosterAboveDetail']:
                print(f"  ✅ PASS: Roster stacks ABOVE detail pane")
            else:
                print(f"  ❌ FAIL: Roster does not stack above detail")
            
            if layout_check['rosterScrolls']:
                print(f"  ✅ PASS: Roster scrolls")
            else:
                print(f"  ⚠️  WARN: Roster does not scroll")
            
            if layout_check['rosterPercent'] <= 40:
                print(f"  ✅ PASS: Roster is {layout_check['rosterPercent']:.1f}% of panel height (<= 40%)")
            else:
                print(f"  ❌ FAIL: Roster is {layout_check['rosterPercent']:.1f}% of panel height (> 40%)")
        
        # Test clicking a species row
        skitter_row = await page.query_selector('[data-testid="species-row-skitter"]')
        if skitter_row:
            await skitter_row.click()
            await page.wait_for_timeout(500)
            
            # Check portrait and selection
            portrait = await page.query_selector('[data-testid="portrait-skitter"]')
            selected_attr = await skitter_row.get_attribute('data-selected')
            
            if portrait:
                print(f"  ✅ PASS: Skitter portrait shown in detail pane")
            else:
                print(f"  ❌ FAIL: Skitter portrait not found")
            
            if selected_attr == 'true':
                print(f"  ✅ PASS: Row has data-selected='true'")
            else:
                print(f"  ❌ FAIL: Row data-selected is '{selected_attr}'")
        
        # Check knowledge chip
        knowledge_chip = await page.query_selector('[data-testid="knowledge-level"]')
        if knowledge_chip:
            knowledge_text = await knowledge_chip.inner_text()
            if 'FULLY DOCUMENTED' in knowledge_text or '100%' in knowledge_text:
                print(f"  ✅ PASS: Knowledge chip shows full documentation")
            else:
                print(f"  ⚠️  INFO: Knowledge chip: {knowledge_text}")
        
        await context.close()
        await browser.close()

async def test_species_deeplink():
    """Test species deep-link from creature panel in sovereign_bloodline scenario"""
    print("\n=== TESTING SPECIES DEEP-LINK ===\n")
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={'width': 1600, 'height': 900})
        page = await context.new_page()
        
        await page.goto(URL)
        await page.wait_for_load_state("networkidle")
        await page.evaluate("localStorage.setItem('aetherion_tutorial_done', '1')")
        await page.evaluate("localStorage.removeItem('aetherion_scenarios_done')")
        await page.reload()
        await page.wait_for_load_state("networkidle")
        
        # Start sovereign_bloodline scenario
        await page.click('[data-testid="mode-scenario"]')
        await page.wait_for_timeout(500)
        await page.click('[data-testid="scenario-card-sovereign_bloodline"]')
        await page.wait_for_timeout(500)
        await page.click('[data-testid="start-game-button"]')
        await page.wait_for_timeout(3000)
        
        # Select a creature
        creature_selected = await page.evaluate("""() => {
            const creatures = window.__gameRenderer?.state?.creatures || [];
            if (creatures.length === 0) return false;
            
            const c = creatures[0];
            window.__gameRenderer.centerOn(c.x, c.y);
            window.__gameRenderer.selection = {kind: 'creature', id: c.id};
            return true;
        }""")
        
        if not creature_selected:
            print("  ❌ FAIL: Could not select a creature")
            await context.close()
            await browser.close()
            return
        
        await page.wait_for_timeout(500)
        
        # Check creature panel appears
        creature_panel = await page.query_selector('[data-testid="creature-panel"]')
        if not creature_panel:
            print("  ❌ FAIL: Creature panel did not appear")
            await context.close()
            await browser.close()
            return
        
        print("  ✅ PASS: Creature panel opened")
        
        # Click species button
        species_btn = await page.query_selector('[data-testid="creature-species-button"]')
        if species_btn:
            await species_btn.click()
            await page.wait_for_timeout(500)
            
            # Check drawer opened on nyxarr
            drawer = await page.query_selector('[data-testid="ops-drawer"][data-drawer="db"]')
            if drawer:
                print("  ✅ PASS: Species Database drawer opened")
                
                # Check nyxarr portrait and row
                portrait = await page.query_selector('[data-testid="portrait-nyxarr"]')
                row = await page.query_selector('[data-testid="species-row-nyxarr"]')
                
                if portrait:
                    print("  ✅ PASS: Nyxarr portrait shown in detail pane")
                else:
                    print("  ❌ FAIL: Nyxarr portrait not found")
                
                if row:
                    # Check row is visible
                    is_visible = await row.is_visible()
                    if is_visible:
                        print("  ✅ PASS: Nyxarr row visible in roster")
                    else:
                        print("  ❌ FAIL: Nyxarr row not visible")
                    
                    # Check it's not shown as SIGNAL DETECTED
                    row_text = await row.inner_text()
                    if 'SIGNAL DETECTED' not in row_text:
                        print("  ✅ PASS: Species is catalogued (not SIGNAL DETECTED)")
                    else:
                        print("  ❌ FAIL: Species shown as SIGNAL DETECTED")
                else:
                    print("  ❌ FAIL: Nyxarr row not found")
            else:
                print("  ❌ FAIL: Species Database drawer did not open")
        else:
            print("  ❌ FAIL: Species button not found")
        
        await context.close()
        await browser.close()

async def test_bloodline_ledger():
    """Test Bloodline Ledger drawer from creature panel"""
    print("\n=== TESTING BLOODLINE LEDGER DRAWER ===\n")
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={'width': 1600, 'height': 900})
        page = await context.new_page()
        
        await page.goto(URL)
        await page.wait_for_load_state("networkidle")
        await page.evaluate("localStorage.setItem('aetherion_tutorial_done', '1')")
        await page.evaluate("localStorage.removeItem('aetherion_scenarios_done')")
        await page.reload()
        await page.wait_for_load_state("networkidle")
        
        # Start sovereign_bloodline scenario
        await page.click('[data-testid="mode-scenario"]')
        await page.wait_for_timeout(500)
        await page.click('[data-testid="scenario-card-sovereign_bloodline"]')
        await page.wait_for_timeout(500)
        await page.click('[data-testid="start-game-button"]')
        await page.wait_for_timeout(3000)
        
        # Select a creature
        creature_selected = await page.evaluate("""() => {
            const creatures = window.__gameRenderer?.state?.creatures || [];
            if (creatures.length === 0) return false;
            
            const c = creatures[0];
            window.__gameRenderer.selection = {kind: 'creature', id: c.id};
            return true;
        }""")
        
        if not creature_selected:
            print("  ❌ FAIL: Could not select a creature")
            await context.close()
            await browser.close()
            return
        
        await page.wait_for_timeout(500)
        
        # Click ledger button
        ledger_btn = await page.query_selector('[data-testid="creature-ledger-button"]')
        if not ledger_btn:
            print("  ❌ FAIL: Ledger button not found")
            await context.close()
            await browser.close()
            return
        
        await ledger_btn.click()
        await page.wait_for_timeout(500)
        
        # Check ledger drawer
        ledger_drawer = await page.query_selector('[data-testid="ops-drawer"][data-drawer="ledger"]')
        if not ledger_drawer:
            print("  ❌ FAIL: Ledger drawer did not open")
            await context.close()
            await browser.close()
            return
        
        print("  ✅ PASS: Ledger drawer opened with data-drawer='ledger'")
        
        # Check ledger content
        ledger_content = await page.query_selector('[data-testid="bloodline-ledger"]')
        if ledger_content:
            host_attr = await ledger_content.get_attribute('data-host')
            if host_attr == 'drawer':
                print("  ✅ PASS: Ledger has data-host='drawer'")
            else:
                print(f"  ❌ FAIL: Ledger has data-host='{host_attr}'")
        
        # Check header title
        title = await page.query_selector('[data-testid="drawer-title"]')
        if title:
            title_text = await title.inner_text()
            if 'BLOODLINE LEDGER' in title_text:
                print("  ✅ PASS: Header title is 'BLOODLINE LEDGER'")
            else:
                print(f"  ❌ FAIL: Header title is '{title_text}'")
        
        # Check close button
        close_btn = await page.query_selector('[data-testid="ledger-close-button"]')
        if close_btn:
            print("  ✅ PASS: Ledger close button found")
        else:
            print("  ❌ FAIL: Ledger close button not found")
        
        # Check no dock button is lit
        lit_count = await page.evaluate("""() => {
            const buttons = document.querySelectorAll('[data-testid^="dock-"][aria-pressed="true"]');
            return buttons.length;
        }""")
        
        if lit_count == 0:
            print("  ✅ PASS: No dock button has aria-pressed='true'")
        else:
            print(f"  ❌ FAIL: {lit_count} dock button(s) are lit")
        
        # Check left shift
        shift_box = await page.evaluate("""() => {
            const shift = document.querySelector('[data-testid="ops-left-shift"]');
            if (!shift) return null;
            const box = shift.getBoundingClientRect();
            return {x: box.x, width: box.width};
        }""")
        
        if shift_box and shift_box['x'] == 376:
            print(f"  ✅ PASS: ops-left-shift x == 376")
        else:
            print(f"  ❌ FAIL: ops-left-shift x == {shift_box['x'] if shift_box else 'N/A'}")
        
        # Check no table inside ledger
        table = await page.query_selector('[data-testid="bloodline-ledger"] table')
        if not table:
            print("  ✅ PASS: No <table> inside ledger (cards layout)")
        else:
            print("  ❌ FAIL: <table> found inside ledger")
        
        # Check ledger elements
        ledger_title = await page.query_selector('[data-testid="ledger-title"]')
        ledger_descendants = await page.query_selector('[data-testid="ledger-descendants"]')
        
        if ledger_title and ledger_descendants:
            print("  ✅ PASS: ledger-title and ledger-descendants present")
        else:
            print("  ❌ FAIL: Missing ledger-title or ledger-descendants")
        
        # Test clicking a candidate
        candidate = await page.query_selector('[data-testid^="ledger-candidate-"]')
        if candidate:
            safe_attr = await candidate.get_attribute('data-safe')
            print(f"  ✅ PASS: Candidate has data-safe attribute: {safe_attr}")
            
            # Get candidate name button
            name_btn = await candidate.query_selector('button')
            if name_btn:
                await name_btn.click()
                await page.wait_for_timeout(500)
                
                # Check drawer closed
                drawer_after = await page.query_selector('[data-testid="ops-drawer"]')
                if not drawer_after:
                    print("  ✅ PASS: Clicking candidate closes drawer")
                else:
                    print("  ❌ FAIL: Drawer still open after clicking candidate")
        
        await context.close()
        await browser.close()

async def test_legacy_hud():
    """The legacy HUD is retired: ?legacyHud=1 must be ignored (deck still renders, screens are drawer panels)."""
    print("\n=== TESTING LEGACY HUD SWITCH IS RETIRED ===\n")

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={'width': 1600, 'height': 900})
        page = await context.new_page()

        await page.goto(URL + "?legacyHud=1")
        await page.wait_for_load_state("networkidle")
        await page.evaluate("localStorage.setItem('aetherion_tutorial_done', '1')")
        await page.reload()
        await page.wait_for_load_state("networkidle")

        await page.click('[data-testid="mode-sandbox"]')
        await page.wait_for_timeout(500)
        await page.click('[data-testid="start-game-button"]')
        await page.wait_for_timeout(3000)

        dock = await page.query_selector('[data-testid="ops-dock"]')
        if dock:
            print("  ✅ PASS: ops-dock renders even with ?legacyHud=1 (switch retired)")
        else:
            print("  ❌ FAIL: ops-dock missing with ?legacyHud=1")

        await page.click('[data-testid="species-database-open-button"]')
        await page.wait_for_timeout(500)
        modal = await page.query_selector('[data-testid="species-database-modal"]')
        if modal:
            host_attr = await modal.get_attribute('data-host')
            modal_box = await modal.bounding_box()
            if host_attr == 'drawer' and modal_box and modal_box['width'] <= 320:
                print("  ✅ PASS: Species screen is a drawer panel (data-host='drawer', <= 320px)")
            else:
                print(f"  ❌ FAIL: Species screen host={host_attr} width={modal_box and modal_box['width']}")
        else:
            print("  ❌ FAIL: Species screen did not open")

        await context.close()
        await browser.close()


async def test_hud_responsiveness():
    """Test HUD responsiveness at different viewports"""
    print("\n=== TESTING HUD RESPONSIVENESS ===\n")
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        
        viewports = [
            {'width': 1366, 'height': 768, 'name': '1366x768'},
            {'width': 1600, 'height': 900, 'name': '1600x900'},
            {'width': 1920, 'height': 1080, 'name': '1920x1080'}
        ]
        
        for vp in viewports:
            print(f"\nTesting at {vp['name']}...")
            
            context = await browser.new_context(viewport={'width': vp['width'], 'height': vp['height']})
            page = await context.new_page()
            
            await page.goto(URL)
            await page.wait_for_load_state("networkidle")
            await page.evaluate("localStorage.setItem('aetherion_tutorial_done', '1')")
            await page.reload()
            await page.wait_for_load_state("networkidle")
            
            # Start sandbox
            await page.click('[data-testid="mode-sandbox"]')
            await page.wait_for_timeout(500)
            await page.click('[data-testid="start-game-button"]')
            await page.wait_for_timeout(3000)
            
            # Check HUD elements
            hud_check = await page.evaluate(f"""() => {{
                const parkName = document.querySelector('[data-testid="hud-park-name"]');
                const pauseBtn = document.querySelector('[data-testid="hud-time-pause-button"]');
                const seedChip = document.querySelector('[data-testid="hud-seed"]');
                const exitBtn = document.querySelector('[data-testid="hud-exit-button"]');
                const researchBtn = document.querySelector('[data-testid="open-research-button"]');
                
                const viewport = {vp['width']};
                
                const result = {{}};
                
                if (parkName) {{
                    const box = parkName.getBoundingClientRect();
                    result.parkName = {{
                        visible: box.width > 150,
                        width: box.width,
                        overlapped: pauseBtn ? box.right > pauseBtn.getBoundingClientRect().left : false
                    }};
                }}
                
                if (seedChip) {{
                    result.seedChip = {{visible: seedChip.offsetParent !== null}};
                }}
                
                if (exitBtn) {{
                    const box = exitBtn.getBoundingClientRect();
                    result.exitBtn = {{
                        fullyInside: box.right <= viewport,
                        x: box.x,
                        right: box.right
                    }};
                }}
                
                if (researchBtn && viewport >= 1920) {{
                    const text = researchBtn.textContent;
                    result.researchBtn = {{
                        hasLabel: text.includes('Research')
                    }};
                }}
                
                return result;
            }}""")
            
            # Check park name
            if 'parkName' in hud_check:
                if hud_check['parkName']['visible']:
                    print(f"  ✅ PASS: Park name visible (width={hud_check['parkName']['width']:.0f})")
                else:
                    print(f"  ❌ FAIL: Park name too narrow (width={hud_check['parkName']['width']:.0f})")
                
                if not hud_check['parkName']['overlapped']:
                    print(f"  ✅ PASS: Park name not overlapped by pause button")
                else:
                    print(f"  ❌ FAIL: Park name overlapped by pause button")
            
            # Check seed chip
            if 'seedChip' in hud_check and hud_check['seedChip']['visible']:
                print(f"  ✅ PASS: Seed chip visible")
            
            # Check exit button
            if 'exitBtn' in hud_check:
                if hud_check['exitBtn']['fullyInside']:
                    print(f"  ✅ PASS: Exit button fully inside viewport")
                else:
                    print(f"  ❌ FAIL: Exit button clipped (right={hud_check['exitBtn']['right']}, viewport={vp['width']})")
            
            # Check labels at 1920
            if vp['width'] >= 1920 and 'researchBtn' in hud_check:
                if hud_check['researchBtn']['hasLabel']:
                    print(f"  ✅ PASS: Button labels visible at 1920px")
                else:
                    print(f"  ❌ FAIL: Button labels not visible at 1920px")
            
            # Check build toolbar at 1366
            if vp['width'] == 1366:
                toolbar_check = await page.evaluate("""() => {
                    const toolbar = document.querySelector('[data-testid="build-toolbar"]');
                    if (!toolbar) return {found: false};
                    
                    const tabs = toolbar.querySelectorAll('[data-testid^="cat-"]');
                    const hasOverflow = toolbar.scrollWidth > toolbar.clientWidth;
                    
                    return {
                        found: true,
                        tabCount: tabs.length,
                        hasOverflow
                    };
                }""")
                
                if toolbar_check['found']:
                    if not toolbar_check['hasOverflow']:
                        print(f"  ✅ PASS: Build toolbar tabs visible with no overflow ({toolbar_check['tabCount']} tabs)")
                    else:
                        print(f"  ❌ FAIL: Build toolbar has overflow")
            
            await context.close()
        
        await browser.close()

async def main():
    """Run all manual tests"""
    print("=" * 60)
    print("PHASE M+N MANUAL TESTING")
    print("=" * 60)
    
    try:
        await test_ops_deck_drawers()
        await test_species_database()
        await test_species_deeplink()
        await test_bloodline_ledger()
        await test_legacy_hud()
        await test_hud_responsiveness()
        
        print("\n" + "=" * 60)
        print("MANUAL TESTING COMPLETE")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    return 0

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
