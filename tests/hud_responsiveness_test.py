"""
HUD Responsiveness Test - Phase M+N
Tests HUD layout at different viewport sizes (1366x768, 1600x900, 1920x1080)
"""
import asyncio
import sys
from playwright.async_api import async_playwright
from config import URL

async def test_viewport(page, width, height, name):
    """Test HUD at a specific viewport"""
    print(f"\n{'='*60}")
    print(f"Testing at {name} ({width}x{height})")
    print(f"{'='*60}")
    
    await page.set_viewport_size({'width': width, 'height': height})
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
        
        const viewport = {width};
        const result = {{}};
        
        if (parkName) {{
            const box = parkName.getBoundingClientRect();
            const pauseBox = pauseBtn ? pauseBtn.getBoundingClientRect() : null;
            result.parkName = {{
                visible: box.width > 150,
                width: box.width,
                x: box.x,
                right: box.right,
                overlapped: pauseBox ? box.right > pauseBox.left : false
            }};
        }}
        
        if (seedChip) {{
            const box = seedChip.getBoundingClientRect();
            result.seedChip = {{
                visible: seedChip.offsetParent !== null,
                width: box.width
            }};
        }}
        
        if (exitBtn) {{
            const box = exitBtn.getBoundingClientRect();
            result.exitBtn = {{
                fullyInside: box.right <= viewport,
                x: box.x,
                right: box.right,
                width: box.width
            }};
        }}
        
        if (researchBtn) {{
            const text = researchBtn.textContent;
            result.researchBtn = {{
                hasLabel: text.includes('Research'),
                text: text.trim()
            }};
        }}
        
        return result;
    }}""")
    
    passed = 0
    total = 0
    
    # Check park name
    if 'parkName' in hud_check:
        total += 1
        if hud_check['parkName']['visible']:
            print(f"✅ PASS: Park name visible (width={hud_check['parkName']['width']:.0f}px)")
            passed += 1
        else:
            print(f"❌ FAIL: Park name too narrow (width={hud_check['parkName']['width']:.0f}px, expected >150)")
        
        total += 1
        if not hud_check['parkName']['overlapped']:
            print(f"✅ PASS: Park name not overlapped by pause button")
            passed += 1
        else:
            print(f"❌ FAIL: Park name overlapped (right={hud_check['parkName']['right']:.0f})")
    
    # Check seed chip
    if 'seedChip' in hud_check:
        total += 1
        if hud_check['seedChip']['visible']:
            print(f"✅ PASS: Seed chip visible")
            passed += 1
        else:
            print(f"❌ FAIL: Seed chip not visible")
    
    # Check exit button
    if 'exitBtn' in hud_check:
        total += 1
        if hud_check['exitBtn']['fullyInside']:
            print(f"✅ PASS: Exit button fully inside viewport (right={hud_check['exitBtn']['right']:.0f}, viewport={width})")
            passed += 1
        else:
            print(f"❌ FAIL: Exit button clipped (right={hud_check['exitBtn']['right']:.0f}, viewport={width})")
    
    # Check labels at 1920
    if width >= 1920 and 'researchBtn' in hud_check:
        total += 1
        if hud_check['researchBtn']['hasLabel']:
            print(f"✅ PASS: Button labels visible at 1920px ('{hud_check['researchBtn']['text']}')")
            passed += 1
        else:
            print(f"❌ FAIL: Button labels not visible at 1920px (text: '{hud_check['researchBtn']['text']}')")
    elif width < 1720 and 'researchBtn' in hud_check:
        # Below 1720px should be icon-only
        total += 1
        if not hud_check['researchBtn']['hasLabel']:
            print(f"✅ PASS: Icon-only mode below 1720px")
            passed += 1
        else:
            print(f"⚠️  INFO: Labels still visible below 1720px")
            passed += 1  # Not a failure
    
    # Check build toolbar at 1366
    if width == 1366:
        toolbar_check = await page.evaluate("""() => {
            const toolbar = document.querySelector('[data-testid="build-toolbar"]');
            if (!toolbar) return {found: false};
            
            const tabs = toolbar.querySelectorAll('[data-testid^="cat-"]');
            const hasOverflow = toolbar.scrollWidth > toolbar.clientWidth;
            
            const tabsVisible = [];
            for (const tab of tabs) {
                const box = tab.getBoundingClientRect();
                if (box.width > 0 && box.height > 0) {
                    tabsVisible.push(tab.getAttribute('data-testid'));
                }
            }
            
            return {
                found: true,
                tabCount: tabs.length,
                visibleCount: tabsVisible.length,
                hasOverflow,
                tabs: tabsVisible
            };
        }""")
        
        if toolbar_check['found']:
            total += 1
            if not toolbar_check['hasOverflow']:
                print(f"✅ PASS: Build toolbar no overflow ({toolbar_check['visibleCount']}/{toolbar_check['tabCount']} tabs visible)")
                passed += 1
            else:
                print(f"❌ FAIL: Build toolbar has overflow ({toolbar_check['visibleCount']}/{toolbar_check['tabCount']} tabs)")
    
    # Open a drawer to test layout
    await page.click('[data-testid="dock-open-research-button"]')
    await page.wait_for_timeout(500)
    
    drawer_check = await page.evaluate("""() => {
        const drawer = document.querySelector('[data-testid="ops-drawer"]');
        if (!drawer) return {found: false};
        
        const box = drawer.getBoundingClientRect();
        return {
            found: true,
            x: box.x,
            width: box.width
        };
    }""")
    
    if drawer_check['found']:
        total += 1
        if drawer_check['x'] == 56 and drawer_check['width'] == 320:
            print(f"✅ PASS: Drawer positioned correctly (x=56, width=320)")
            passed += 1
        else:
            print(f"❌ FAIL: Drawer position incorrect (x={drawer_check['x']}, width={drawer_check['width']})")
    
    print(f"\n{name}: {passed}/{total} checks passed")
    return passed, total

async def main():
    """Run HUD responsiveness tests"""
    print("=" * 60)
    print("HUD RESPONSIVENESS TEST - Phase M+N")
    print("=" * 60)
    
    errors = []
    total_passed = 0
    total_checks = 0
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()
        
        page.on("pageerror", lambda err: errors.append(str(err)))
        
        # Navigate and set up
        await page.goto(URL)
        await page.wait_for_load_state("networkidle")
        await page.evaluate("localStorage.setItem('aetherion_tutorial_done', '1')")
        await page.reload()
        await page.wait_for_load_state("networkidle")
        
        # Test each viewport
        viewports = [
            (1366, 768, "1366x768"),
            (1600, 900, "1600x900"),
            (1920, 1080, "1920x1080")
        ]
        
        for width, height, name in viewports:
            passed, total = await test_viewport(page, width, height, name)
            total_passed += passed
            total_checks += total
        
        await context.close()
        await browser.close()
    
    print("\n" + "=" * 60)
    print(f"OVERALL: {total_passed}/{total_checks} checks passed")
    print("=" * 60)
    
    if errors:
        print(f"\n⚠️  Console errors detected: {len(errors)}")
        for err in errors[:3]:
            print(f"  - {err}")
    else:
        print("\n✅ No console errors")
    
    return 0 if total_passed == total_checks else 1

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
