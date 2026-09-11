# plan.md (Updated)

## 1) Objectives
- Deliver a complete, playable **First Playable** desktop creature-containment/park-management game (**React + Canvas isometric**, **FastAPI**, **MongoDB save slots**).
- Prove the **core fantasy** end-to-end:
  - Deterministic sim (fixed timestep) decoupled from render
  - Terrain sculpt/paint/water/veg with undo + costs
  - Fences/gates/enclosure detection
  - Creature AI/needs + pathfinding constraints
  - **Unknown biology** discovered through observation (hypotheses → breakthroughs)
  - Guests + viewing tension + economy + research
- Ensure **explainability** (why numbers change) and **overlays** (habitat/visibility/view ranges/power).
- Keep systems real (no dead UI), data-driven (species/buildings/research), and **save/load reproduces authoritative state**.

**Current objective (top priority):**
- **Phase Y — Night Mood Icons + Lamp Auto-Suggest + Floodlight Power Link + Contact Sheet Filters** ✅ COMPLETED + ✅ VERIFIED
  - Local sweeps green: `lighting_test.py` 19/19 (incl. F1–F6), `photo_album_test.py` 20/20 (incl. 9d/9e filters), `render3d_test.py` 31/31 (B22–B27 unaffected), `determinism_test.py` 8/8, `save_compat_test.py` 6/6, `phase_v_test.py` 19/19.
  - Independent sweep: `test_reports/iteration_33.json` — **117/117**, zero bugs, no regressions.
  - **Status:** no open bugs, no pending tasks. Awaiting the user's next feature pick (backlog in `HANDOFF.md` §13).

**Handoff refresh (this session):**
- `/app/HANDOFF.md` rewritten as the complete, current technical handoff (stack, ops, API, code map, sim/render architecture, feature inventory through Phase Y, debug surface, tests, caveats, conventions, backlog).
- Fresh-container environment fixes (no product code touched): frontend crash-looped with `ENOSPC` (node-wide inotify budget exhausted, `sysctl` read-only) → `CHOKIDAR_USEPOLLING=true` + `WATCHPACK_POLLING=1000` appended to `frontend/.env` (gitignored); Playwright chromium re-installed. Re-verified: backend suite ✅, `determinism_test` 8/8, `lighting_test` 19/19.

### Phase Y — details (this session)
- **Y1 Guest Night Mood Icons** — renderer draws a warm lamp glyph over guests who feel safe on a lit path and a cool crescent-moon glyph over guests caught in the dark. New `renderer.drawGuestMoodIcons` + `moodLampGlyph`/`moodMoonGlyph`, wired into both the 2D and 3D overlay passes; reads the existing `g.lit` tag (only shows at night, skips panicked/riding). Debug: `__gameDebug.guestMoods()` and `lighting.guestMoodCounts`.
- **Y2 Lamp Auto-Suggest ("Light the gaps")** — new `lighting.suggestLampSpots(state,{max})` ranks the darkest, busiest walkway tiles (real foot traffic via a transient `state._footfall` accumulator + structural closeness to the entrance/attractions) and returns a spaced set of dark path tiles. Footfall bumped in `guests.tickGuestMovement`, decayed at dawn (`economy` → `footfallDecay`). Facilities lighting group gains a `lamp-suggest-button` that arms pulsing on-map markers (`renderer.setLampSuggestions`/`drawLampSuggestions`, self-expiring + drops a tile the instant a lamp covers it) and selects the Path Lamp tool. Debug: `__gameDebug.suggestLampSpots(max)`.
- **Y3 Floodlight Power Link** — a floodlight only shines while an online Power Relay covers it, so a surge that knocks a relay offline now blacks out its floodlights (visible night cost). `lighting.relayPowered`/`lampPowered` (kept local to avoid a lighting↔construction↔economy cycle), `lightMap` skips unpowered floods with a power-aware cache key, `lampReport` gains `needsPower`/`powered`/`lit`, `lightingReport.floodsOffline`. 2D lighting overlay draws unpowered flood rings red-dashed with a NO POWER tag; `BuildingPanel` LampReport shows the power state; 3D `lamps3d.js` gates player masts (rebuild on a power-state flip, dark fixture keeps its pole/head but loses the lens glow + light pool + real light). Placement rules unchanged (does NOT require power to place — keeps render3d B27 green). Floodlight desc updated.
- **Y4 Contact Sheet Filters** — `album.filterPhotos`/`photoDays` (pure); `AlbumScreen` grid gains a From/To cycle range (Shadcn Select) + a Captioned-only Switch that scope both the grid preview and the exported contact sheet, with a live "Exports X of N" count (`album-sheet-count`). Defaults = whole album so existing exports are unchanged.


---

## 2) Constraints (binding)

### Render / determinism (hard)
- **Visuals only** for Three.js systems (no sim mutation, no RNG bleed). Sim logic must continue using `rnd()` only.
- Isometric camera remains **2:1 dimetric**: yaw 45°, pitch 30°, **orthographic**. Zoom/pan unchanged.
- Picking math unchanged (`renderer.screenToTile/edgeFromPointer/vertexFromPointer`, `worldPx`).
- 2D overlay remains authoritative for selection rings / hover / HUD markers.

### HUD / Ops Deck constraints (updated, hard)
- **Ops Deck is the only HUD**.
- Retired (must remain removed):
  - `OPS_DECK` flag
  - `?legacyHud=1`
  - `localStorage['aetherion.opsDeck']='off'`
  - legacy full-screen management modals (`GameModals.jsx`, ScreenFrame modal host)
- Keep **Ops Deck geometry unchanged**: **56px dock + 320px drawer** (≤376px total coverage).

### Backend / storage constraints (hard)
- Save schema can be extended **only additively** (backward-compatible defaults).
- Owner scoping: new collections must follow the **X-Player-Token** ownership model used for `saves`.

### Test constraints (hard)
- Default headless Playwright must remain fast/stable by falling back to classic 2D when software GL is detected.
- Forced 3D tests must use SwiftShader (`?render3d=1&gfx=low` + chromium args) and **poll frames**.

---

## 3) Status Summary (what is done)

### Phase R — CINEMATIC 3D WORLD ✅ IMPLEMENTED + ✅ VERIFIED
- R1 foundation: Three.js pipeline + camera lock + terrain splat PBR + water + lighting + post + quality tiers.
- R2 world completeness: flora / fences / buildings / props / transport / entrance / terrain skirt.
- R3 creatures: procedural rigs per body plan, skin PBR, genes/morph tint, state animation.
- R4 people: instanced guests/staff/security with walk cycles.
- R5 verification: `tests/render3d_test.py` green; classic regression suites remain green.

### Phase S — Follow-ups (shoreline, HUD retirement, living weather, species filters) ✅ IMPLEMENTED + ✅ VERIFIED
- S1 Shoreline softening: BFS beach profile + sand/mud bed + wet shoreline band + water depth from `aBed`.
- S2 Legacy HUD retirement: deck-only; modal host removed; ledger is drawer-only.
- S3 Living weather: smoothed storm + gusts; water chop + rain rings; terrain wetness; rain splash rings on hard surfaces.
- S4 Species filters: search + family-class + tier chips; locked species never leak.

### Phase U — Immersion + Meta Tools ✅ IMPLEMENTED + ✅ VERIFIED
All four original new requirements are complete and independently validated.

#### U1 — Photo Album ✅ COMPLETE + ✅ VERIFIED
- Backend: `/api/photos` CRUD, owner scoping via `X-Player-Token`, listing returns meta (thumb only), `GET /photos/{id}` returns full image.
- Frontend:
  - `PhotoMode` auto-saves JPEG+thumb best-effort + status indicator (saved/failed/retry).
  - `AlbumScreen` Ops Deck drawer supports browse/detail/download/delete.
  - Ops Dock includes Album button.
- Tests: `tests/photo_album_test.py` green.

#### U2 — Pairing Planner ✅ COMPLETE + ✅ VERIFIED
- New pure projection module: `frontend/src/game/pairing.js`.
- New UI: `frontend/src/components/game/PairingPlanner.jsx`.
- Integrated into `BloodlineLedger.jsx`.
- Debug/testing hooks exposed via `window.__gameDebug.projectPairing/recommendPartners/bestPairs`.
- Tests: `tests/pairing_planner_test.py` and `tests/phase21_features_test.py` green.

#### U3 — Creature Vocals ✅ COMPLETE + ✅ VERIFIED
- New scheduler: `frontend/src/game/vocals.js`.
- Audio upgrades (`frontend/src/game/audio.js`) with positional placement.
- Tests: `tests/creature_vocals_test.py` green (classic + forced 3D).

#### U4 — Night Lighting Pass ✅ COMPLETE + ✅ VERIFIED
- New `frontend/src/game/three/lamps3d.js` for automatic path lamps + building floodlights.
- Tests: `tests/render3d_test.py` extended; green.

### Phase V — Quality-of-life + Immersion Extensions ✅ COMPLETED + ✅ VERIFIED
(Planner Shortcut, Vocal Subtitles, Lamp Placement Tool, Album Captions)
- Verified by independent sweep: `test_reports/iteration_31.json`.

---

## 4) Phase U — New User Picks (DONE)
The user picked 4 features; all are complete.

---

## 5) Implementation Steps (revised sequence)

### U0–U5 ✅ complete
- Phase U is completed and verified (see Status Summary).

### V0–V5 ✅ complete
- Phase V delivered and verified (see §3 and `test_reports/iteration_31.json`).

### W0) Code Review Response ✅ complete
- Behaviour-preserving refactors for complexity.
- Added context logging to previously empty catches.
- Added Python type hints to the flagged scripts.
- Hardened forced-3D vocal test to poll frames.

---

## Phase X — New User Picks ✅ COMPLETED + ✅ VERIFIED
Independent sweep: `test_reports/iteration_32.json` — backend 11/11, frontend 52/52, zero bugs, no regressions.
Status per item:
- **X1 Lamp Comfort Bonus + Lighting overlay** ✅ — `game/lighting.js` (cached light map, `guestLightingTick`, tallies, `lightingRollover`, `safetyCarrot`, reports); wired in `guests.js`, `economy.js` (dawn), `sim.js` (rating), `state.js` (defaults); renderer `drawLightingOverlay`; `OverlayToggles` 4th toggle; `BuildingPanel` LampReport; `FinanceScreen` NightLightingPanel; dev hooks `spawnGuest`, `__gameDebug.lightingReport/lightAt/lampReport/guestLightingTick`. Tests: `tests/lighting_test.py` 13/13.
- **X2 Album Contact Sheet** ✅ — `album.js` `buildContactSheet/sheetLayout/sheetOrder/sheetFileName`; `AlbumScreen` grid header button (`album-contact-sheet-button`, `data-status`), `window.__albumDebug.lastSheet`. Tests: `photo_album_test.py` 18/18 (9a–9c).
- **X3 Species Caption Colours** ✅ — `vocals.js` `captionTint/captionSwatch` (accent lifted 42% toward white, memoised), captions carry `speciesId`; renderer draws swatch dot + tinted text, alarm ring stays red. Tests: `creature_vocals_test.py` 21/21 (SUB 1b, SUB 5).
- **X4 Ternary Cleanup** ✅ — `components/game/tone.js` (`levelTone`, `hazardTone`, `scoreTone`, `dangerTone`, `tierNumeral`, `researchBorder`, `logTone`, `relationClass`, `registryChipClass`, `traitTone`, `captionHint`); 13 nested ternaries replaced across 10 files. Regression: species_filters 9/9, phase21 28/28, ops_deck 29/29, ui_integration ✅, determinism 8/8, save_compat 6/6, pairing_planner 15/15 ×3.
- Test hardening: `pairing_planner_test.py` / `phase21_features_test.py` `select_creature` fallback now selects via `__gameInput.setSelection` (React inspect panel follows) — removed a random-seed flake where an overlapping sprite took the click.

### Original Phase X spec (kept for reference)
User picked four enhancements:
1. **X1 Lamp Comfort Bonus + Lighting Overlay** (night penalty on unlit paths + bonus on lit paths + safety carrot + overlay)
2. **X2 Album Contact Sheet Export** (one tall JPEG, 3 columns, all photos, caption + cycle under each, park name header)
3. **X3 Species Caption Colours** (default: subtitle text uses species accent + a small swatch dot; alarm ring stays red)
4. **X4 Ternary Cleanup** (default: top ~12 nested ternaries in HUD/drawers refactored into shared tone helpers)

### X1) Lamp Comfort Bonus + Lighting Overlay (P0)
**Goal:** Player-placed lamps earn their upkeep by improving night experience.

**Simulation (deterministic, additive):**
- Add `frontend/src/game/lighting.js`:
  - `LAMP_RADIUS = { path: 2.5, flood: 4.0 }` (tile-distance).
  - `lampsOn(state)` returns `true` when `getDayPhase(state.tick).phase` is `dusk|night`.
  - `lightMap(state)`: cached `Uint8Array` keyed by (lamp placements + day-phase) stored under `state._light` (non-serialized, recomputed).
  - `isLit(state, x, y)` returns whether a tile is lit when lamps are on.

**Guest impact (carrot + stick):**
- In `guestNeedsTick(state, g)`:
  - When `phase === 'night'` and guest is on a path tile:
    - If lit: `g.satisfaction += 0.006` (capped to 1).
    - If unlit: `g.satisfaction -= 0.012` (floored to 0).
  - One-off opinions:
    - First time lit at night → positive opinion.
    - First time unlit at night → negative opinion.
- Aggregate statistics:
  - `state.stats.lighting = { lit: 0, dark: 0 }` tallies guest path-steps at night.
  - `state.stats.nightSafety` stores an EMA of `lit / (lit + dark)` (reset/updated on dawn edge).

**Rating carrot:**
- In `computeRating(state)` (`game/sim.js`):
  - Add a small bonus: `safety = min(1, safety + 0.05 * (state.stats.nightSafety || 0))`.

**UI & explainability:**
- Add a new overlay toggle:
  - `OverlayToggles.jsx` adds `{ id: 'lighting', icon: Lightbulb, label: 'Lighting coverage overlay' }`.
  - `renderer.js drawOverlays` adds a `lighting` branch:
    - At night/dusk: path tiles tinted warm when lit; cool/blue when dark.
    - By day: show coverage footprint (neutral faint tint) for planning.
- Add a small report surface:
  - FinanceScreen: add a compact “Night Lighting” panel showing last-night coverage %, lit/dark visits, and the applied safety bonus.
  - Optional: BuildingPanel for lamp objects shows type/radius and a small nightly impact summary.

**Files likely touched:**
- `frontend/src/game/lighting.js` (new)
- `frontend/src/game/guests.js` (night comfort tick + opinions + tallies)
- `frontend/src/game/sim.js` (rating safety bonus)
- `frontend/src/components/game/OverlayToggles.jsx` (new toggle)
- `frontend/src/game/renderer.js` (overlay rendering)
- `frontend/src/game/state.js` (deserialize defaults for new stats)
- `frontend/src/components/game/FinanceScreen.jsx` (+ panel)

**Tests:**
- Add `tests/lighting_test.py`:
  - place path lamps, advance tick to night, spawn a guest on path tiles; assert satisfaction delta differs for lit vs dark.
  - assert overlay toggle exists and doesn’t crash.
  - assert rating safety component increases slightly when `nightSafety` improves.

### X2) Album Contact Sheet Export (P0)
**Goal:** Export the whole album as a printable, scrollable contact sheet.

**Client-only (no backend change):**
- Add `buildContactSheet(photos)` to `frontend/src/game/album.js`:
  - Output: **one tall JPEG data URL**.
  - Layout: fixed width ~1240px, **3 columns**, uses stored `thumb` images.
  - Header: park name + photo count + cycle range.
  - Each cell: thumbnail + `CYCLE d · clock` + caption.
- Album UI:
  - `AlbumScreen` grid view adds a button (e.g. top actions row): `data-testid="album-contact-sheet-button"`.
  - Click builds and downloads the JPEG. Show toast progress (“Building contact sheet…”, “Downloaded”).
  - Expose debug hook: `window.__albumDebug.lastSheet` for tests.

**Files likely touched:**
- `frontend/src/game/album.js`
- `frontend/src/components/game/AlbumScreen.jsx`

**Tests:**
- Extend `tests/photo_album_test.py`:
  - generate ≥ 3 photos, click contact sheet, decode downloaded data URL dimensions and assert:
    - width fixed, height larger than a single tile,
    - header text stamped (non-empty pixels in header band),
    - captions appear (optional heuristic).

### X3) Species Caption Colours (P1)
**Default decision:** subtitle text uses species accent tint + small swatch dot; alarm ring remains red.

**Implementation:**
- Add `captionTint(speciesId)` helper (likely in `vocals.js` or a small `uiColors.js`):
  - Derive from `speciesById(speciesId).colors.accent`.
  - Adjust for contrast (lighten/darken) so text is readable over the dark chip.
- Update `renderer.drawVocalCaptions(ctx)`:
  - Draw a 4px dot/swatch at the left of the caption.
  - Set text fill style to the tint (or near-white mixed with tint), while keeping alarm stroke ring red.

**Files likely touched:**
- `frontend/src/game/vocals.js` (helper)
- `frontend/src/game/renderer.js` (caption rendering)

**Tests:**
- Extend `tests/creature_vocals_test.py`:
  - evaluate `captionTint('skitter')` returns a valid CSS hex and differs between two species.

### X4) Ternary Cleanup (P1)
**Default scope:** top ~12 truly nested ternaries in HUD/drawer components.

**Implementation approach:**
- Add `frontend/src/components/game/tone.js`:
  - helpers: `levelTone(v)`, `dangerTone(d)`, `scoreTone(v)`, `hazardTone(v)`, plus small maps.
- Replace the densest nested ternaries (target list):
  - `AcquisitionScreen.jsx:61`
  - `SpeciesDatabase.jsx:120, 203`
  - `fieldops/ExpeditionsTab.jsx:102`
  - `AlbumScreen.jsx:79` (caption status)
  - `BloodlineLedger.jsx:91`
  - `PairingPlanner.jsx:133`
  - `ResearchScreen.jsx:70`
  - `panels/Bar.jsx:13`
  - `panels/BuildingPanel.jsx:54`
  - `panels/EnclosurePanel.jsx:70, 82, 169`

**Tests:**
- No new tests required; rely on existing UI suites + smoke run.

### X5) Final verification sweep (for Phase X)
1. Run targeted suites:
   - `tests/photo_album_test.py` (extended)
   - `tests/creature_vocals_test.py` (extended)
   - new `tests/lighting_test.py`
2. Run UI integration suites:
   - `tests/comprehensive_test.py` (or the project’s normal full pass)
3. Forced 3D smoke:
   - `tests/render3d_test.py` remains green; lighting overlay must not affect 3D pipeline.
4. Run `testing_agent_v3` for an independent sweep and produce `test_reports/iteration_32.json`.

---

## 6) Next Actions (updated backlog)
1. **Phase X implementation (P0/P1)**
   - **Order:** X1 → X2 → X3 → X4
2. **Stabilization & QA (P0)**
   - Full regression (classic + forced 3D) + `testing_agent_v3`.
3. **Polish (P1)**
   - Tooltips / small UX refinements after Phase X is stable.

---

## 7) Success Criteria
- All Phase R/S/U/V acceptance criteria remain true.
- **X1 Lighting:**
  - Unlit path tiles at night apply a satisfaction penalty; lit path tiles apply a bonus.
  - A **Lighting overlay** exists and clearly differentiates lit vs unlit path tiles.
  - A small safety carrot is reflected in the park rating computation.
- **X2 Contact Sheet:**
  - One tall JPEG export exists, 3 columns, includes header + cycle + caption under each photo.
- **X3 Subtitle Colours:**
  - Vocal subtitles remain readable and gain species accent identity; alarm styling remains clearly alarmed.
- **X4 Ternary Cleanup:**
  - Targeted nested ternaries replaced with readable helpers; UI output unchanged.
- Full automated regression stays green (classic and forced 3D).