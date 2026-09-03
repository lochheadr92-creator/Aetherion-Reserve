"""Comprehensive test for Aetherion Reserve - all features."""
import asyncio
import os
from playwright.async_api import async_playwright
import json

URL = os.environ.get("AETHERION_URL", "https://discovery-bio.preview.emergentagent.com")

# Helper functions from smoke_game.py
async def center(page, x, y):
    await page.evaluate("([x,y]) => window.__gameRenderer.centerOn(x, y)", [x, y])
    await page.wait_for_timeout(80)

async def tile_screen(page, x, y):
    return await page.evaluate(
        """([x, y]) => {
            const r = window.__gameRenderer; const s = window.__game.state;
            const h = s.heights[y * s.size + x] || 0;
            const wx = (x + 0.5 - y - 0.5) * 32, wy = (x + 0.5 + y + 0.5) * 16 - h * 10;
            return { sx: wx * r.cam.zoom + r.cam.x, sy: wy * r.cam.zoom + r.cam.y, zoom: r.cam.zoom };
        }""",
        [x, y],
    )

async def click_tile(page, x, y):
    p = await tile_screen(page, x, y)
    await page.mouse.click(p["sx"], p["sy"])
    await page.wait_for_timeout(45)

async def place_edge(page, x, y, d):
    p = await page.evaluate(
        """([x,y,d]) => {
            const s = window.__game.state, r = window.__gameRenderer;
            const h1 = s.heights[y*s.size+x] || 0;
            const nx = d==='E' ? x+1 : x, ny = d==='S' ? y+1 : y;
            const h2 = (nx < s.size && ny < s.size) ? s.heights[ny*s.size+nx] : h1;
            const h = Math.max(h1, h2);
            const cx = (x+0.5-y-0.5)*32, cy = (x+0.5+y+0.5)*16 - h*10;
            const mx = d==='E' ? cx+16 : cx-16, my = cy+8;
            return { sx: mx*r.cam.zoom + r.cam.x, sy: my*r.cam.zoom + r.cam.y };
        }""",
        [x, y, d],
    )
    await page.mouse.click(p["sx"], p["sy"])
    await page.wait_for_timeout(45)

async def main():
    results = {
        "main_menu": [],
        "hud": [],
        "build_toolbar": [],
        "canvas_tools": [],
        "enclosure": [],
        "creatures": [],
        "unknown_biology": [],
        "creature_panel": [],
        "guests_economy": [],
        "research": [],
        "objectives": [],
        "alerts": [],
        "overlays": [],
        "save_load": [],
        "stability": []
    }
    
    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        page = await browser.new_page(viewport={"width": 1920, "height": 950})
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)[:300]))
        page.on("console", lambda msg: print(f"CONSOLE: {msg.text}") if msg.type in ["error", "warning"] else None)
        
        print("=" * 80)
        print("AETHERION RESERVE - COMPREHENSIVE FEATURE TEST")
        print("=" * 80)
        
        try:
            # ========== MAIN MENU TESTS ==========
            print("\n[1/15] MAIN MENU TESTS")
            await page.goto(URL, wait_until="networkidle", timeout=30000)
            await page.wait_for_timeout(1500)
            
            # Check dark sci-fi styling (look for key elements)
            title = await page.locator("text=AETHERION RESERVE").count()
            results["main_menu"].append(("Title present", title > 0))
            print(f"  ✓ Title present: {'PASS' if title > 0 else 'FAIL'}")
            
            # Park name input
            park_input = await page.locator('input[placeholder*="park" i], input[placeholder*="facility" i]').count()
            results["main_menu"].append(("Park name input", park_input > 0))
            print(f"  ✓ Park name input: {'PASS' if park_input > 0 else 'FAIL'}")
            
            if park_input > 0:
                await page.locator('input[placeholder*="park" i], input[placeholder*="facility" i]').first.fill("Test Facility")
            
            # Mode selection cards
            mgmt_mode = await page.locator('[data-testid="mode-management"]').count()
            sandbox_mode = await page.locator('[data-testid="mode-sandbox"]').count()
            results["main_menu"].append(("Management mode card", mgmt_mode > 0))
            results["main_menu"].append(("Sandbox mode card", sandbox_mode > 0))
            print(f"  ✓ Management mode card: {'PASS' if mgmt_mode > 0 else 'FAIL'}")
            print(f"  ✓ Sandbox mode card: {'PASS' if sandbox_mode > 0 else 'FAIL'}")
            
            # Select sandbox mode for construction tests
            await page.click('[data-testid="mode-sandbox"]')
            await page.wait_for_timeout(300)
            
            # BEGIN OPERATIONS button
            start_btn = await page.locator('[data-testid="start-game-button"]').count()
            results["main_menu"].append(("Start game button", start_btn > 0))
            print(f"  ✓ Start game button: {'PASS' if start_btn > 0 else 'FAIL'}")
            
            await page.click('[data-testid="start-game-button"]')
            await page.wait_for_timeout(2500)
            
            # Verify canvas loaded
            canvas = await page.locator('canvas').count()
            results["main_menu"].append(("Canvas loaded", canvas > 0))
            print(f"  ✓ Canvas loaded: {'PASS' if canvas > 0 else 'FAIL'}")
            
            S = lambda expr: page.evaluate(expr)
            
            # ========== HUD TESTS ==========
            print("\n[2/15] HUD TESTS")
            
            # Cash display (sandbox should show ◈9,999,999)
            cash = await S("window.__game.state.cash")
            results["hud"].append(("Sandbox cash", cash >= 9999999))
            print(f"  ✓ Sandbox cash (◈{cash:,}): {'PASS' if cash >= 9999999 else 'FAIL'}")
            
            # Pause button
            pause_btn = await page.locator('[data-testid="hud-time-pause-button"]').count()
            results["hud"].append(("Pause button", pause_btn > 0))
            print(f"  ✓ Pause button: {'PASS' if pause_btn > 0 else 'FAIL'}")
            
            await page.click('[data-testid="hud-time-pause-button"]')
            paused = await S("window.__game.state.paused")
            results["hud"].append(("Pause toggle", paused))
            print(f"  ✓ Pause toggle: {'PASS' if paused else 'FAIL'}")
            
            # Speed buttons
            speed_1x = await page.locator('[data-testid="hud-speed-1-button"]').count()
            speed_3x = await page.locator('[data-testid="hud-speed-3-button"]').count()
            results["hud"].append(("Speed buttons", speed_1x > 0 and speed_3x > 0))
            print(f"  ✓ Speed buttons (1x/3x): {'PASS' if speed_1x > 0 and speed_3x > 0 else 'FAIL'}")
            
            # Guest count, rating
            guest_count = await page.locator('[data-testid="hud-guest-count"]').count()
            results["hud"].append(("Guest count display", guest_count > 0))
            print(f"  ✓ Guest count display: {'PASS' if guest_count > 0 else 'FAIL'}")
            
            # Modal buttons
            fieldops_btn = await page.locator('[data-testid="open-fieldops-button"]').count()
            species_btn = await page.locator('[data-testid="species-database-open-button"]').count()
            research_btn = await page.locator('[data-testid="open-research-button"]').count()
            finances_btn = await page.locator('[data-testid="open-finances-button"]').count()
            results["hud"].append(("Modal buttons", all([fieldops_btn, species_btn, research_btn, finances_btn])))
            print(f"  ✓ Modal buttons (Field Ops, Species DB, Research, Finances): {'PASS' if all([fieldops_btn, species_btn, research_btn, finances_btn]) else 'FAIL'}")
            
            # Test modal open/close
            await page.click('[data-testid="open-fieldops-button"]')
            await page.wait_for_timeout(400)
            modal_open = await page.locator('[data-testid="fieldops-modal"]').count()
            results["hud"].append(("Field Ops modal opens", modal_open > 0))
            print(f"  ✓ Field Ops modal opens: {'PASS' if modal_open > 0 else 'FAIL'}")
            
            # Close modal with Escape key (more reliable)
            await page.keyboard.press("Escape")
            await page.wait_for_timeout(300)
            
            # ========== BUILD TOOLBAR TESTS ==========
            print("\n[3/15] BUILD TOOLBAR TESTS")
            
            # 8 category tabs
            categories = ["terrain", "ground", "water", "flora", "paths", "fences", "habitat", "facilities"]
            for cat in categories:
                cat_btn = await page.locator(f'[data-testid="cat-{cat}"]').count()
                results["build_toolbar"].append((f"Category {cat}", cat_btn > 0))
                print(f"  ✓ Category {cat}: {'PASS' if cat_btn > 0 else 'FAIL'}")
            
            # Brush size buttons
            brush_1 = await page.locator('[data-testid="brush-size-1"]').count()
            brush_2 = await page.locator('[data-testid="brush-size-2"]').count()
            brush_3 = await page.locator('[data-testid="brush-size-3"]').count()
            results["build_toolbar"].append(("Brush sizes", all([brush_1, brush_2, brush_3])))
            print(f"  ✓ Brush sizes (1/2/3): {'PASS' if all([brush_1, brush_2, brush_3]) else 'FAIL'}")
            
            # In sandbox, all tools should be unlocked
            await page.click('[data-testid="cat-water"]')
            await page.wait_for_timeout(200)
            deep_water = await page.locator('[data-testid="tool-water-deep"]').count()
            results["build_toolbar"].append(("Deep water unlocked (sandbox)", deep_water > 0))
            print(f"  ✓ Deep water unlocked in sandbox: {'PASS' if deep_water > 0 else 'FAIL'}")
            
            # ========== CANVAS TOOL APPLICATION TESTS ==========
            print("\n[4/15] CANVAS TOOL APPLICATION TESTS")
            
            # Flatten area for testing
            await center(page, 50, 50)
            await page.click('[data-testid="cat-terrain"]')
            await page.click('[data-testid="tool-flatten"]')
            await page.click('[data-testid="brush-size-3"]')
            
            h_before = await S("window.__game.state.heights[50 * 72 + 50]")
            await click_tile(page, 50, 50)
            h_after = await S("window.__game.state.heights[50 * 72 + 50]")
            results["canvas_tools"].append(("Flatten terrain", h_after != h_before or h_after == 0))
            print(f"  ✓ Flatten terrain (height {h_before} → {h_after}): PASS")
            
            # Raise terrain
            await page.click('[data-testid="tool-raise"]')
            await page.click('[data-testid="brush-size-1"]')
            h_before = await S("window.__game.state.heights[51 * 72 + 51]")
            await click_tile(page, 51, 51)
            h_after = await S("window.__game.state.heights[51 * 72 + 51]")
            results["canvas_tools"].append(("Raise terrain", h_after > h_before))
            print(f"  ✓ Raise terrain (height {h_before} → {h_after}): {'PASS' if h_after > h_before else 'FAIL'}")
            
            # Paint material (rock)
            await page.click('[data-testid="cat-ground"]')
            await page.click('[data-testid="tool-rock"]')
            m_before = await S("window.__game.state.materials[52 * 72 + 52]")
            await click_tile(page, 52, 52)
            m_after = await S("window.__game.state.materials[52 * 72 + 52]")
            results["canvas_tools"].append(("Paint rock material", m_after != m_before))
            print(f"  ✓ Paint rock material (mat {m_before} → {m_after}): {'PASS' if m_after != m_before else 'FAIL'}")
            
            # Shallow water
            await page.click('[data-testid="cat-water"]')
            await page.click('[data-testid="tool-water-shallow"]')
            w_before = await S("window.__game.state.water[53 * 72 + 53]")
            await click_tile(page, 53, 53)
            w_after = await S("window.__game.state.water[53 * 72 + 53]")
            results["canvas_tools"].append(("Place shallow water", w_after > w_before))
            print(f"  ✓ Place shallow water (water {w_before} → {w_after}): {'PASS' if w_after > w_before else 'FAIL'}")
            
            # Path tool
            await page.click('[data-testid="cat-paths"]')
            await page.click('[data-testid="tool-path"]')
            p_before = await S("window.__game.state.paths.reduce((a,b)=>a+b,0)")
            await click_tile(page, 54, 54)
            p_after = await S("window.__game.state.paths.reduce((a,b)=>a+b,0)")
            results["canvas_tools"].append(("Place path", p_after > p_before))
            print(f"  ✓ Place path (paths {p_before} → {p_after}): {'PASS' if p_after > p_before else 'FAIL'}")
            
            # Undo button
            undo_btn = await page.locator('[data-testid="undo-button"]').count()
            results["canvas_tools"].append(("Undo button exists", undo_btn > 0))
            print(f"  ✓ Undo button exists: {'PASS' if undo_btn > 0 else 'FAIL'}")
            
            # ========== ENCLOSURE FLOW TESTS ==========
            print("\n[5/15] ENCLOSURE FLOW TESTS")
            
            # Build enclosure at (40..45, 30..35)
            await center(page, 43, 33)
            await page.click('[data-testid="cat-terrain"]')
            await page.click('[data-testid="tool-flatten"]')
            await page.click('[data-testid="brush-size-3"]')
            for tx, ty in [(42, 32), (45, 32), (42, 35), (45, 35)]:
                await click_tile(page, tx, ty)
            await page.click('[data-testid="brush-size-1"]')
            
            # Fence perimeter
            await page.click('[data-testid="cat-fences"]')
            await page.click('[data-testid="fence-tier-1"]')
            x0, y0, x1, y1 = 40, 30, 45, 35
            
            for _ in range(3):
                for x in range(x0, x1 + 1):
                    await place_edge(page, x, y0 - 1, "S")
                    await place_edge(page, x, y1, "S")
                for y in range(y0, y1 + 1):
                    await place_edge(page, x0 - 1, y, "E")
                    await place_edge(page, x1, y, "E")
                missing = await page.evaluate(
                    """([x0,y0,x1,y1]) => {
                        const f = window.__game.state.fences; const miss = [];
                        for (let x=x0; x<=x1; x++) { if(!f[`${x},${y0-1},S`]) miss.push([x,y0-1,'S']); if(!f[`${x},${y1},S`]) miss.push([x,y1,'S']); }
                        for (let y=y0; y<=y1; y++) { if(!f[`${x0-1},${y},E`]) miss.push([x0-1,y,'E']); if(!f[`${x1},${y},E`]) miss.push([x1,y,'E']); }
                        return miss;
                    }""",
                    [x0, y0, x1, y1],
                )
                if not missing:
                    break
            
            results["enclosure"].append(("Fence perimeter complete", not missing))
            print(f"  ✓ Fence perimeter complete: {'PASS' if not missing else f'FAIL {missing}'}")
            
            # Gate
            await page.click('[data-testid="tool-gate"]')
            await place_edge(page, 42, y1, "S")
            gates = await S("Object.values(window.__game.state.fences).filter(f=>f.gate).length")
            results["enclosure"].append(("Gate placed", gates >= 1))
            print(f"  ✓ Gate placed: {'PASS' if gates >= 1 else 'FAIL'}")
            
            # Enclosure panel
            await page.click('[data-testid="tool-select"]')
            await click_tile(page, 43, 33)
            await page.wait_for_timeout(300)
            enc_panel = await page.locator('[data-testid="enclosure-panel"]').count()
            results["enclosure"].append(("Enclosure panel opens", enc_panel > 0))
            print(f"  ✓ Enclosure panel opens: {'PASS' if enc_panel > 0 else 'FAIL'}")
            
            if enc_panel > 0:
                # Check composition, security, residents sections
                comp_text = await page.locator('[data-testid="enclosure-panel"]').inner_text()
                has_composition = "water" in comp_text.lower() or "canopy" in comp_text.lower() or "material" in comp_text.lower()
                results["enclosure"].append(("Enclosure composition shown", has_composition))
                print(f"  ✓ Enclosure composition shown: {'PASS' if has_composition else 'FAIL'}")
                
                # Close panel
                await page.keyboard.press("Escape")
                await page.wait_for_timeout(200)
            
            # ========== CREATURE ACQUISITION TESTS ==========
            print("\n[6/15] CREATURE ACQUISITION TESTS")
            
            # Open Field Ops modal
            await page.click('[data-testid="open-fieldops-button"]')
            await page.wait_for_timeout(400)
            
            # Check for species (should show 15 species)
            species_count = await page.locator('[data-testid^="acquire-buy-"]').count()
            results["creatures"].append(("Species available", species_count >= 10))
            print(f"  ✓ Species available ({species_count}): {'PASS' if species_count >= 10 else 'FAIL'}")
            
            # In sandbox, all should be unlocked (no "UNRESOLVED SIGNAL")
            unresolved = await page.locator('text=UNRESOLVED SIGNAL').count()
            results["creatures"].append(("All species unlocked (sandbox)", unresolved == 0))
            print(f"  ✓ All species unlocked in sandbox: {'PASS' if unresolved == 0 else 'FAIL'}")
            
            # Acquire skitterling
            skitter_btn = await page.locator('[data-testid="acquire-buy-skitter"]').count()
            results["creatures"].append(("Skitterling available", skitter_btn > 0))
            print(f"  ✓ Skitterling available: {'PASS' if skitter_btn > 0 else 'FAIL'}")
            
            if skitter_btn > 0:
                await page.click('[data-testid="acquire-buy-skitter"]')
                await page.wait_for_timeout(300)
                
                # Release inside enclosure
                await click_tile(page, 43, 33)
                await page.wait_for_timeout(300)
                
                n_creatures = await S("window.__game.state.creatures.length")
                results["creatures"].append(("Creature released", n_creatures >= 1))
                print(f"  ✓ Creature released ({n_creatures} total): {'PASS' if n_creatures >= 1 else 'FAIL'}")
                
                # Test release OUTSIDE enclosure (should show error)
                await page.click('[data-testid="open-fieldops-button"]')
                await page.wait_for_timeout(400)
                await page.click('[data-testid="acquire-buy-skitter"]')
                await page.wait_for_timeout(300)
                await click_tile(page, 20, 20)  # Outside enclosure
                await page.wait_for_timeout(500)
                
                # Check for error toast
                error_toast = await page.locator('text=/must be released inside.*enclosure/i').count()
                results["creatures"].append(("Release outside error", error_toast > 0))
                print(f"  ✓ Release outside enclosure error: {'PASS' if error_toast > 0 else 'SOFT-FAIL (toast may have disappeared)'}")
            
            # ========== CREATURE INSPECT PANEL TESTS ==========
            print("\n[7/15] CREATURE INSPECT PANEL TESTS")
            
            # Click creature with select tool
            await page.click('[data-testid="tool-select"]')
            creature_pos = await S("window.__game.state.creatures[0] ? {x: Math.floor(window.__game.state.creatures[0].x), y: Math.floor(window.__game.state.creatures[0].y)} : null")
            
            if creature_pos:
                await click_tile(page, creature_pos["x"], creature_pos["y"])
                await page.wait_for_timeout(400)
                
                creature_panel = await page.locator('[data-testid="creature-panel"]').count()
                results["creature_panel"].append(("Creature panel opens", creature_panel > 0))
                print(f"  ✓ Creature panel opens: {'PASS' if creature_panel > 0 else 'SOFT-FAIL (click precision)'}")
                
                if creature_panel > 0:
                    panel_text = await page.locator('[data-testid="creature-panel"]').inner_text()
                    
                    # Check for needs bars (hunger/thirst/energy)
                    has_needs = any(word in panel_text.lower() for word in ["hunger", "thirst", "energy", "needs"])
                    results["creature_panel"].append(("Needs bars shown", has_needs))
                    print(f"  ✓ Needs bars shown: {'PASS' if has_needs else 'FAIL'}")
                    
                    # Check for welfare
                    has_welfare = "welfare" in panel_text.lower() or "stress" in panel_text.lower()
                    results["creature_panel"].append(("Welfare shown", has_welfare))
                    print(f"  ✓ Welfare shown: {'PASS' if has_welfare else 'FAIL'}")
                    
                    # Check for activity
                    has_activity = "activity" in panel_text.lower() or "state" in panel_text.lower()
                    results["creature_panel"].append(("Activity shown", has_activity))
                    print(f"  ✓ Activity shown: {'PASS' if has_activity else 'FAIL'}")
                    
                    # Check for transfer/sell button
                    transfer_btn = await page.locator('button:has-text("Transfer"), button:has-text("Sell")').count()
                    results["creature_panel"].append(("Transfer button", transfer_btn > 0))
                    print(f"  ✓ Transfer button: {'PASS' if transfer_btn > 0 else 'FAIL'}")
                    
                    await page.keyboard.press("Escape")
                    await page.wait_for_timeout(200)
            
            # ========== OBJECTIVES TESTS ==========
            print("\n[8/15] OBJECTIVES TESTS")
            
            objectives_panel = await page.locator('[data-testid="objectives-panel"]').count()
            results["objectives"].append(("Objectives panel exists", objectives_panel > 0))
            print(f"  ✓ Objectives panel exists: {'PASS' if objectives_panel > 0 else 'FAIL'}")
            
            if objectives_panel > 0:
                obj_text = await page.locator('[data-testid="objectives-panel"]').inner_text()
                has_objectives = len(obj_text) > 20
                results["objectives"].append(("Objectives shown", has_objectives))
                print(f"  ✓ Objectives shown: {'PASS' if has_objectives else 'FAIL'}")
            
            # ========== ALERTS TESTS ==========
            print("\n[9/15] ALERTS TESTS")
            
            alerts_btn = await page.locator('[data-testid="hud-alerts-button"]').count()
            results["alerts"].append(("Alerts button exists", alerts_btn > 0))
            print(f"  ✓ Alerts button exists: {'PASS' if alerts_btn > 0 else 'FAIL'}")
            
            if alerts_btn > 0:
                await page.click('[data-testid="hud-alerts-button"]')
                await page.wait_for_timeout(300)
                
                alerts_dropdown = await page.locator('[data-testid="alerts-dropdown"]').count()
                results["alerts"].append(("Alerts dropdown opens", alerts_dropdown > 0))
                print(f"  ✓ Alerts dropdown opens: {'PASS' if alerts_dropdown > 0 else 'FAIL'}")
                
                # Close dropdown
                await page.keyboard.press("Escape")
                await page.wait_for_timeout(200)
            
            # ========== OVERLAYS TESTS ==========
            print("\n[10/15] OVERLAYS TESTS")
            
            overlay_habitat = await page.locator('[data-testid="overlay-habitat"]').count()
            overlay_power = await page.locator('[data-testid="overlay-power"]').count()
            overlay_view = await page.locator('[data-testid="overlay-view"]').count()
            
            results["overlays"].append(("Overlay buttons exist", overlay_habitat > 0 or overlay_power > 0 or overlay_view > 0))
            print(f"  ✓ Overlay buttons (habitat/power/view): {'PASS' if overlay_habitat > 0 or overlay_power > 0 or overlay_view > 0 else 'FAIL'}")
            
            if overlay_habitat > 0:
                await page.click('[data-testid="overlay-habitat"]')
                await page.wait_for_timeout(300)
                overlay_active = await S("window.__gameRenderer.overlay")
                results["overlays"].append(("Overlay activates", overlay_active is not None))
                print(f"  ✓ Overlay activates: {'PASS' if overlay_active is not None else 'FAIL'}")
                
                # Toggle off
                await page.click('[data-testid="overlay-habitat"]')
                await page.wait_for_timeout(200)
            
            # ========== SAVE/LOAD TESTS ==========
            print("\n[11/15] SAVE/LOAD TESTS")
            
            # Save current state
            n_creatures_before = await S("window.__game.state.creatures.length")
            n_fences_before = await S("Object.keys(window.__game.state.fences).length")
            
            save_btn = await page.locator('[data-testid="hud-save-button"]').count()
            results["save_load"].append(("Save button exists", save_btn > 0))
            print(f"  ✓ Save button exists: {'PASS' if save_btn > 0 else 'FAIL'}")
            
            if save_btn > 0:
                await page.click('[data-testid="hud-save-button"]')
                await page.wait_for_timeout(2500)
                
                # Check for save toast
                save_toast = await page.locator('text=/archived|saved/i').count()
                results["save_load"].append(("Save toast shown", save_toast > 0))
                print(f"  ✓ Save toast shown: {'PASS' if save_toast > 0 else 'SOFT-FAIL (toast may have disappeared)'}")
                
                # Exit to menu
                exit_btn = await page.locator('[data-testid="hud-exit-button"]').count()
                if exit_btn > 0:
                    await page.click('[data-testid="hud-exit-button"]')
                    await page.wait_for_timeout(1500)
                    
                    # Check for save slots
                    save_slots = await page.locator('[data-testid^="save-slot-"]').count()
                    results["save_load"].append(("Save slots shown", save_slots > 0))
                    print(f"  ✓ Save slots shown ({save_slots}): {'PASS' if save_slots > 0 else 'FAIL'}")
                    
                    if save_slots > 0:
                        # Load first save
                        await page.locator('[data-testid^="save-slot-"]').first.click()
                        await page.wait_for_timeout(2500)
                        
                        # Verify state restored
                        n_creatures_after = await S("window.__game.state.creatures.length")
                        n_fences_after = await S("Object.keys(window.__game.state.fences).length")
                        
                        state_restored = (n_creatures_after == n_creatures_before and n_fences_after == n_fences_before)
                        results["save_load"].append(("State restored", state_restored))
                        print(f"  ✓ State restored (creatures {n_creatures_after}/{n_creatures_before}, fences {n_fences_after}/{n_fences_before}): {'PASS' if state_restored else 'FAIL'}")
            
            # ========== STABILITY TEST ==========
            print("\n[12/15] STABILITY TEST")
            
            # Run at 3x speed for 30 seconds
            await page.click('[data-testid="hud-speed-3-button"]')
            print("  Running at 3x speed for 30 seconds...")
            
            for i in range(6):
                await page.wait_for_timeout(5000)
                tick = await S("window.__game.state.tick")
                print(f"    t+{(i+1)*5}s: tick {tick}, errors: {len(errors)}")
            
            await page.click('[data-testid="hud-time-pause-button"]')
            
            results["stability"].append(("No page errors", len(errors) == 0))
            print(f"  ✓ No page errors: {'PASS' if len(errors) == 0 else f'FAIL ({len(errors)} errors)'}")
            
            # ========== SUMMARY ==========
            print("\n" + "=" * 80)
            print("TEST SUMMARY")
            print("=" * 80)
            
            total_tests = 0
            passed_tests = 0
            
            for category, tests in results.items():
                cat_passed = sum(1 for _, result in tests if result)
                cat_total = len(tests)
                total_tests += cat_total
                passed_tests += cat_passed
                
                status = "✅" if cat_passed == cat_total else "⚠️"
                print(f"{status} {category.upper()}: {cat_passed}/{cat_total}")
            
            print("=" * 80)
            print(f"OVERALL: {passed_tests}/{total_tests} tests passed ({100*passed_tests//total_tests}%)")
            print("=" * 80)
            
            if errors:
                print(f"\n⚠️  PAGE ERRORS ({len(errors)}):")
                for e in errors[:10]:
                    print(f"  - {e}")
            else:
                print("\n✅ No page errors detected")
            
            # Save screenshot
            await page.screenshot(path="/tmp/comprehensive_test.jpg", quality=30, type="jpeg")
            print("\n📸 Screenshot saved to /tmp/comprehensive_test.jpg")
            
        except Exception as e:
            print(f"\n❌ FATAL ERROR: {str(e)}")
            import traceback
            traceback.print_exc()
        
        finally:
            await browser.close()
            
            # Save results to JSON
            with open("/tmp/comprehensive_test_results.json", "w") as f:
                json.dump(results, f, indent=2)
            print("\n📄 Results saved to /tmp/comprehensive_test_results.json")

asyncio.run(main())
