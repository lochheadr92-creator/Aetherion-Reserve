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
- The game is feature-complete through **Phase 20**, and the post-Phase-19 code health + QoL + game-feel + polish passes are **complete and verified**:
  1) **Code Quality Analysis / Code Review remediation** + full re-verification.
  2) **Keeper Priorities** (keeper→enclosure assignment; flexible prioritization).
  3) **Staff Report Card + Input UX Improvements**.
  4) **Game-Feel Pass** (render-only polish: zoom easing, pan inertia, breach shake, placement pop/dust).
  5) **Phase E**: Ambient Audio + Sovereign Bloodline scenario + Creature Idle Life + Keeper Markers.

**User confirmations (scope decisions):**
- Transport: **station-to-station rides** with a **visible elevated car** that **rises over fences/enclosures safely** mid-route and **lowers at stations**; **no full vehicle traffic sim**.
- Genetics: offspring variation via **per-creature hue/size/glow modifiers** (no hand-drawn morph variants).
- Keeper Priorities behavior: **flexible mode** (assigned enclosure first, then help elsewhere if idle).
- Input UX goals:
  - Left click selects
  - Left click + drag pans (in Select mode)
  - Right click cancels active tool / clears selection
  - Mouse wheel zoom
- Game-feel pass goals:
  - Camera zoom easing anchored to cursor
  - Pan release inertia
  - Breach screen shake
  - Building placement pop + dust
  - **Render-only** (no sim behavior changes, no save-format changes)
- Phase E constraints:
  - Audio, idle life, and keeper markers must remain **render/UI-layer only** (no sim determinism impacts).
  - Scenario work may add state/logic **additively** with backward-compatible defaults.

**Status (high-level):**
- **Phase 1–20 COMPLETE & VERIFIED** (see testing baselines below).
- **Post-Phase 19 work:**
  - Phase A (Code Quality Completion) ✅ COMPLETE + VERIFIED.
  - Phase B (Keeper Priorities) ✅ COMPLETE + VERIFIED.
  - Phase C (Staff Report Card + Input UX Improvements) ✅ COMPLETE + VERIFIED.
  - Phase D (Game-Feel Pass) ✅ COMPLETE + VERIFIED.
  - **Phase E (Audio + New Scenario + Idle Life + Keeper Markers) ✅ COMPLETE + VERIFIED.**
- **Project health:** ✅ **Green**.

> Constraint (hard): changes must be **systemic, reusable, and interconnected**; changes must remain robust and regression-safe. Save schema can be extended **only additively** with backward-compatible defaults; existing tests must remain green.

**Testing baselines:**
- iteration_5: pre-Phase 7 green baseline.
- iteration_6: post-Phase 7 green baseline (**testing_agent_v3 100%**, plus local suites).
- iteration_7: post-Phase 8+9 green baseline (**testing_agent_v3 100% backend**, local suites green).
- iteration_8: post-Phase 10 refactor verification (**testing_agent_v3 100% frontend**, 16/16).
- iteration_9: post-Phase 11 visual remake verification (**testing_agent_v3 100% overall**, backend 7/7, frontend 29/29; local suites green).
- iteration_10: post-Phase 12 apex species verification (**testing_agent_v3 100% frontend**, 12/12; local suites green).
- **iteration_11: post-Phase 13–16 verification** (**testing_agent_v3 100% overall**; backend 6/6; frontend 100%; regression 100%).
- **iteration_12: post-Phase 17 verification** (**testing_agent_v3 100% overall**; backend 10/10; frontend 100% + regression 5/5).
- **iteration_13: post-Phase 19 verification** (**testing_agent_v3 100% overall**; backend/frontend/integration 100%; Photo Mode fully verified).
- **iteration_14: post-Phase A Code-Quality Completion verification** (**testing_agent_v3 100% overall**; backend 11/11; frontend green; smoke + visual suites pass).
- **iteration_15: post-Phase B Keeper Priorities verification** (**testing_agent_v3 100% overall**; backend 6/6; frontend 21/21; feature tests pass).
- **iteration_16: post-Phase C Input UX + Staff Report Card verification** (**testing_agent_v3 100% overall**; all new feature tests + regressions pass).
- **iteration_17: post-Phase D Game-Feel Pass verification** (**testing_agent_v3 100% overall**; gamefeel + regressions + determinism/backend sanity pass).
- **iteration_18: post-Phase E (Phase 20) verification** (**testing_agent_v3 100% overall**; backend 6/6; frontend 39/39; integration + regressions 100%).

---

## 2) Implementation Steps

### Phase 1 — Core POC (in-app vertical proof; no separate Python script) ✅ COMPLETE
**Goal:** validate the hardest parts (Canvas isometric + terrain editing + deterministic sim + creature nav + discovery gating) before full content/UI.

**Built (confirmed via /app/tests/smoke_game.py):**
1. Canvas isometric engine: tile grid, camera pan/zoom, render height, water, materials; selection highlight.
2. Deterministic sim loop: fixed timestep (100ms) decoupled from render; pause/1x/3x.
3. Terrain tools: raise/lower/flatten/smooth + paint materials + water brush (shallow/deep gated by research) + vegetation + undo stack.
4. Placement system: paths + buildings + fences (edges) + gates; collision/slope rules; refunds.
5. Enclosure detection: flood-fill regions bounded by fences; composition stats.
6. Creature prototype expanded to roster-ready framework: needs + state machine + A* pathfinding respecting slope/water/fences.
7. Unknown biology gating: hidden prefs enforced at the data layer via knowledge accessors.
8. Evidence logging + discoveries: observe behaviour → evidence thresholds → hypothesis + breakthrough notifications.
9. Minimal viewing system: platform visibility score.
10. Instrumentation: alerts/cause log; deterministic authoritative state.

**Exit criteria:** all passed.

**POC fixes captured:**
- Fixed **E-edge fence geometry bug** (fenceCorners wrong edge) → correct fence placement/render/snap.
- Edge picking now snaps to **nearest visible elevated edge midpoint**.
- Social evidence bug fixed: renamed movement state to **seekSocial** so arrival triggers evidence.
- Resting now generates **terrain/elevation/forest** evidence.

---

### Phase 2 — V1 App Development (First Playable) ✅ COMPLETE
**Goal:** expand POC into a complete playable management loop with 15 species, guests, economy, research, save slots.

**Delivered:**
1. Project structure: React UI shell + Canvas scene + sim/state module (single authoritative state object).
2. Data-driven content:
   - 15 authored original species (data-driven schema with `hiddenAttrs` and distinct management questions).
   - Compatibility and symbiosis support (learned via observation/cohabitation).
3. Full habitat evaluation per enclosure:
   - Factors: space, terrain, canopy, water (drink vs aquatic), elevation, shelter, social, symbiosis, cohabitation, temperature.
   - Welfare breakdown panel with explicit causes.
   - **Unknown biology enforcement:** habitat “cause text” is **masked** until attribute discovered.
4. Buildings & infrastructure (functional): Admin, Lab, Feeders, Shelter, Viewing Platform/Tower, Food/Drink, Restroom, Gift Shop, Power Relay.
5. Power MVP: radius coverage + overlay.
6. Guests MVP:
   - Spawn at entrance once park operational; path BFS; simplified needs/spending; opinion feed.
7. Viewing system v1:
   - Distance + vegetation/elevation occlusion approximation; viewing overlay.
8. Research system:
   - Timed projects + costs; lab requirement; **observation-driven dynamic Field Studies**.
9. Acquisition v1:
   - Field Ops modal for purchasing species; placement tool releases into enclosures.
10. Park rating + progression:
   - Rating from diversity/welfare/guest satisfaction/discoveries/rarity/safety.
11. Alerts + objectives/tutorial:
   - Click-to-navigate alerts; objective chain teaches unknown biology.
12. Save/load (backend):
   - FastAPI CRUD save slots + MongoDB persistence of full authoritative state.
13. UI screens & overlays:
   - MainMenu (Management/Sandbox + save slots), HUD, BuildToolbar, InspectPanel, Species DB, Research, Finances, Field Ops, Objectives, overlays.
14. Undo/rollback:
   - Terrain undo (bounded history) + refunds.
15. Performance baseline:
   - Terrain layer cached to offscreen canvas; entities depth-sorted.

**Verified end-to-end in management mode (/app/tests/scenario_discovery.py):**
- Built paths, admin+lab+viewing+stalls, enclosure with water+feeder.
- Acquired 3 Veyra (hidden attrs: water/social).
- Observation loop: evidence → hypothesis alert → dynamic field study → breakthrough (water requirement confirmed) + grant.
- Guests spawned and paid tickets; welfare stable; objectives completed; no page errors.

---

### Phase 3 — Stabilization + Proving Scenarios + Polish ✅ COMPLETE
**Goal:** ensure causal correctness, explainability, robustness, and fun first 5–10 minutes.

**Workstream: Post-Refactor Verification & Code Quality Completion** ✅ COMPLETE
- Verified the large React UI refactor compiles and boots.
- Completed code quality report items:
  - `server.py`: type hints for all 7 functions.
  - `controller.js`: removed direct mutations for pause/speed; added controlled `setTimeControls` mutator.
  - Stable keys: Finance chart/day keys; guest feed IDs; Tutorial steps IDs.
- Regression: `visual_v2.py`, `scenario_discovery.py`, `smoke_game.py`, and testing agent iteration_3 all green.

---

### Phase 4 — Fence UX Rework ✅ COMPLETE
**Goal:** eliminate finicky fence building; make construction fast and predictable.

**Delivered:**
- **Drag-to-line fences** (fence tool): drag draws one clean straight wall; diagonal drags snap to dominant axis.
- Live preview: valid segments highlighted + cost label (e.g., `8 seg · ◈400`).
- Click remains precise (single segment); drag-remove supports bulk removal.
- Tutorial + toolbar hint updated.

**Tests:**
- Added `/app/tests/fence_drag_test.py` (passes).
- Full smoke regression still green.

---

### Phase 5 — Feature Expansion: Rectangles + Security + Expeditions ✅ COMPLETE
**Goal:** deepen construction UX, add escape/emergency drama, and add progression beyond the tutorial.

#### Phase 5A — Rectangle Mode (Fence drag → 4-wall perimeter) ✅ COMPLETE
Verified via `/app/tests/phase5_test.py`.

#### Phase 5B — Security Response (Escapes, Emergencies, Security Teams) ✅ COMPLETE
Verified via `/app/tests/phase5_test.py` and later regression suites.

#### Phase 5C — Expedition Board + Contracts ✅ COMPLETE
Verified via `/app/tests/phase5_test.py` and later regression suites.

---

### Phase 6 — Immersion + Late Game Systems (Panic, Night Tours, Breeding, Abilities) ✅ COMPLETE
Verified via `/app/tests/phase6a_test.py`, `/app/tests/phase6b_test.py`.

**Note (verification maintenance):**
- Phase 6A panic test was hardened to remove a race condition by seeding guests before breach.

---

### Phase 7 — Dedicated Visual Quality Pass (Pixel Art Cohesion) ✅ COMPLETE
Verified via local suites + `testing_agent_v3` iteration_6.

---

### Phase 8 — Keeper Staff ✅ COMPLETE
Verified via `/app/tests/phase8_staff_test.py`.

---

### Phase 9 — Scenario Missions ✅ COMPLETE
Verified via `/app/tests/phase9_scenarios_test.py`.

---

### Phase 10 — Code Quality / Code Review Remediation ✅ COMPLETE (accepted)
Verified via `testing_agent_v3` iteration_8.

---

### Phase 11 — High-End Visual Asset Redesign Pass ✅ COMPLETE (fully verified)
Verified via full regression sweep + `testing_agent_v3` iteration_9.

---

### Phase 12 — Apex-Class Species (Tier 4) ✅ COMPLETE (fully verified)
Verified via full regression sweep + `testing_agent_v3` iteration_10.

---

### Phase 13 — Genetics & Breeding Lines ✅ COMPLETE (verified)
Verified via `/app/tests/phase16_visual.py` + `testing_agent_v3` iteration_11.

---

### Phase 14 — Park Events Engine + Rival Rumbles ✅ COMPLETE (verified)
Verified via `testing_agent_v3` iteration_11.

---

### Phase 15 — Guest Interest System ✅ COMPLETE (verified)
Verified via `testing_agent_v3` iteration_11.

---

### Phase 16 — Attractions, Amenities & Transport (~30 buildings) ✅ COMPLETE (verified)
**Verification additions:**
- Fixed an esbuild syntax error in `art/buildings.js` (`tunnelDetail` missing parenthesis).
- Added `/app/tests/phase16_visual.py` (8/8 PASS) verifying:
  - new building painters
  - synergy report
  - transport car arc clearing fences (geometry verified)
  - genetics morph visibility day/night
  - CreaturePanel genetics UI

Verified via `testing_agent_v3` iteration_11.

---

### Phase 17 — Apex Scenario: “Sovereign Containment” (Nyxarr) ✅ COMPLETE (verified)
**Goal:** high-pressure scenario with real trade-offs, multiple viable strategies, and optional mastery.

**Delivered:**
1. **Scenario definition** (`/app/frontend/src/game/data/scenarios.js`)
   - New **BRUTAL** scenario `sovereign_containment`.
   - Setup: Nyxarr in deterministic **pre-damaged** 13×13 Tier-4 pen.
   - Start: **◈30,000**, starter `admin` + `lab`, `feeder_meat` + `shelter`.
   - Research granted: containment tiers up to `cont_insulated`.
   - Goals (all): full undamaged Tier-4 perimeter, Nyxarr welfare ≥ 65%, 60 guests, 3.0★ rating.
   - Fails (any): debt exceeds ◈5,000; 4 breaches; 3000 cumulative escapeTicks.
   - Mastery (optional, graded on victory): ironwall, solvent, court, spectacle.
2. **Scenario engine extensions** (`/app/frontend/src/game/scenarios.js`)
   - Deterministic fence pre-damage.
   - Trackers: `scenario.escapeTicks`, `scenario.minCash`.
   - Mastery grading into `scenario.mastery` on victory.
3. **UI**
   - `ScenarioTracker.jsx`: mastery tracker + mastery results in victory dialog.
   - `MainMenu.jsx`: BRUTAL difficulty color.

**Verification:**
- `/app/tests/phase17_sovereign_test.py` (**14/14 PASS**).
- `/app/tests/phase9_scenarios_test.py` updated to expect 6 scenario cards (after Phase E).
- `testing_agent_v3` **iteration_12 = 100%**.

---

### Phase 18 — Verification & Regression ✅ COMPLETE (Phases 13–17)
**Key artifacts:**
- `/app/tests/phase16_visual.py`
- `/app/tests/phase17_sovereign_test.py`
- `/app/test_reports/iteration_11.json`
- `/app/test_reports/iteration_12.json`

---

### Phase 19 — Photo Mode ✅ COMPLETE (fully verified)
**Goal:** camera tool to capture beautiful shots of glowing night exhibits, render/UI-only.

**Delivered:**
- New component: `/app/frontend/src/components/game/PhotoMode.jsx`
  - Enter via HUD **Photo** button (`hud-photo-button`).
  - Letterbox overlay + hints.
  - Rule-of-thirds grid toggle (`photo-grid-toggle`, `photo-grid-lines`).
  - Freeze-the-moment pause toggle (`photo-pause-toggle`) using existing `game.setPaused`.
  - Capture button (`photo-capture-button`) and **SPACE** shortcut.
  - Exit via **ESC** or exit button (`photo-exit-button`).
- Capture pipeline:
  - Composes **game canvas** into a **PNG** (vignette + caption plate).
  - Watermark includes park name and `AETHERION INITIATIVE · CYCLE n · clock`.
  - Preview dialog (`photo-preview-dialog`) with:
    - preview image (`photo-preview-image`)
    - download anchor (`photo-download-button`)
    - retake (`photo-retake-button`)
    - done (`photo-close-button`)
- Wiring:
  - `HudBar.jsx`: added Camera icon button.
  - `GameScreen.jsx`: hides HUD/toolbars/panels/trackers during Photo Mode.
  - Overlay is pointer-events-none except control bar to preserve pan/zoom.

**Hard constraints met:**
- Render/UI-only; **no simulation behavior changes**.
- Capture is **on-demand** only (no per-frame capture work).

**Verification:**
- New test: `/app/tests/phase19_photo_test.py` (**10/10 PASS**).
- Visual validation at night with glowing species.
- Full regression sweep green.
- `testing_agent_v3` **iteration_13 = 100%**.

---

### Phase A — Code Quality Completion & Re-Verification (post-Phase 19) ✅ COMPLETE (verified)
**Goal:** address remaining Code Quality Analysis findings and restore a fully verified green baseline after the recent React refactors.

**Completed fixes:**
1. React hook dependency fixes.
2. Performance fixes (`BuildToolbar.jsx` memoization).
3. Cyclomatic complexity refactors (PhotoMode/ScenarioTracker/BuildingPanel/CreaturePanel).
4. Backend test fixes (`/app/backend/backend_test.py`) including splitting scenario persistence and replacing `is` misuse.
5. Procedural art API cleanup (`/app/frontend/src/game/art/buildings.js`): convert long positional args into config objects.

**Mandatory verification completed:**
- `testing_agent_v3` **iteration_14 = 100%**.

---

### Phase B — Feature: Keeper Priorities (post-Phase 19) ✅ COMPLETE (verified)
**Goal:** allow assigning each keeper to an enclosure; assigned keepers prioritise that enclosure first, then help elsewhere.

**Delivered:**
- `assignedEnclosureId` + stable `assignedAnchor`.
- `assignStaffEnclosure` / `resolveAssignment`.
- Two-pass task selection (assigned enclosure → global fallback).
- StaffScreen dropdown assignment UI.

**Verification:**
- `/app/tests/keeper_priorities_test.py` (**9/9 PASS**).
- `testing_agent_v3` **iteration_15 = 100%**.

---

### Phase C — QoL: Staff Report Card + Input UX Improvements ✅ COMPLETE (verified)
**Goal:** better feedback and mouse UX without changing simulation rules.

**Delivered:**
- Staff report card (`staff.report`) with per-cycle tallies; reset at daily rollover.
- Input UX improvements:
  - Select-mode left drag pans
  - right-click cancels tool / clears selection
  - right-drag pans without cancelling
  - fence drag-line can be cancelled
  - toolbar active tool stays synced via `onToolChange` bridge

**Verification:**
- `/app/tests/input_ux_test.py` (**12/12 PASS**).
- `testing_agent_v3` **iteration_16 = 100%**.

---

### Phase D — Game-Feel Pass (render-only polish) ✅ COMPLETE (verified)
**Goal:** improve perceived quality and “feel” without introducing gameplay differences.

**Hard constraints:**
- **Render-layer only**: must not modify sim determinism.
- **No save-format changes**: FX state must never be serialized.
- Honor `prefers-reduced-motion`.

**Delivered:**
- New file: `/app/frontend/src/game/fx.js`
  - `FxManager` attached to `GameRenderer` (`renderer.fx`).
  - Eased wheel zoom toward cursor.
  - Pan inertia with release velocity sampling + decay.
  - Breach screen shake watching `state.stats.breaches`.
  - Building placement pop + dust (ID diffing; silent adopt on load/new game).
  - Uses `Math.random` only for render-only effects; sim stays seeded.

**Verification:**
- New test: `/app/tests/gamefeel_test.py` (**11/11 PASS**).
- Regressions green.
- `testing_agent_v3` **iteration_17 = 100%**.

---

### Phase E (Phase 20) — Ambient Audio + Sovereign Bloodline + Creature Idle Life + Keeper Markers ✅ COMPLETE (verified)
**Goal:** complete the “feel” layer (audio + micro-life), add a second apex scenario that meaningfully uses genetics/breeding, and improve assignment legibility.

#### Phase E1 — Ambient Audio (render/UI-layer only) ✅ COMPLETE
**Delivered:**
- New module: `/app/frontend/src/game/audio.js` (`AudioManager` + `audio` singleton)
  - Web Audio synth pipeline with no external assets:
    - **Wind bed**: brown noise buffer → LFO’d low-pass filter → gain
    - **Storm rain hiss**: high-pass noise bed, enabled only in storms
    - **Night hum**: detuned sine stack; enabled at night only when **glowing exhibits** exist
  - One-shots:
    - UI click, placement confirm, placement deny, breach impact thud
    - Alert stingers per type (`danger/warning/success/breakthrough/info`), throttled (380ms)
  - Settings:
    - `localStorage` persistence: `aetherion_audio_enabled`, `aetherion_audio_volume`
    - Autoplay-safe: audio context created only after first user gesture
  - Debug: `window.__audio` exposed for tests.
- Wiring:
  - `App.js`: `audio.install()` on app mount
  - `GameCanvas.jsx`: `audio.update(game.state)` every rAF frame; `audio.update(null)` on unmount
  - `useGameScreenActions.js`: tool result hook (`audio.toolResult(res)`) to trigger place/deny
  - `HudBar.jsx`: new **Audio** button (`hud-audio-button`) with popover UI (`audio-popover`, `audio-mute-toggle`, `audio-volume-slider`, `audio-volume-value`).

#### Phase E2 — Scenario: “Sovereign Bloodline” (Nyxarr breeding under pressure) ✅ COMPLETE
**Delivered:**
- New BRUTAL scenario: `sovereign_bloodline` in `/app/frontend/src/game/data/scenarios.js`
  - Reward: **+◈50,000**
  - Setup:
    - Deterministic large Tier-4 pen with pre-damage mix
    - Starter admin + lab
    - Starter xenobiologist (auto-assigned to the pen)
    - Briefing knowledge: `nyxarr.social` pre-discovered
    - Research granted includes `bio_breeding` and containment tiers up to insulated
  - Goals with live progress chips:
    - Pair-bond (courtship observed)
    - Raise 3 Nyxarr offspring (`0/3`, `1/3`, ...)
    - At least one park-bred Sovereign matures
    - Bloodline health check (all living Sovereigns: welfare ≥ 65%, none inbred; gated until first birth)
  - Fail conditions (with progress chips where relevant):
    - Deadline: funding closes at **Cycle 16**
    - Inbred Nyxarr birth
    - Debt threshold
    - Breach threshold
    - At-large timer threshold
  - Mastery objectives:
    - Dynasty (rare morph), Swift (before Cycle 10), Iron Wall (0 breaches), Solvent (never in debt)
- Scenario engine extensions in `/app/frontend/src/game/scenarios.js`:
  - Setup supports `setup.discovered` knowledge seeding
  - Setup supports `setup.staff` (hiring + optional assign-to-starter-enclosure)
  - Scenario cash is applied **last** so starter hires do not dent the mission budget

#### Phase E3 — Creature Idle Life (render-only micro-animations) ✅ COMPLETE
**Delivered:**
- Auto-derived blink frames:
  - `/app/frontend/src/game/art/creatures.js`: `deriveBlinkFrame()` scans baked idle frames for eye-highlight clusters and shades them shut
  - `getCreatureSheet()` now includes `sheet.blink` (aligned with idle frames)
- Renderer micro-idles:
  - `/app/frontend/src/game/renderer.js`: `idleLife()`
    - Per-creature blink cadence (resting/sheltering keeps eyes shut)
    - Subtle breathing pulse (y-scale)
    - Periodic flick shear (tail/body twitch)
  - Exposed debug helper: `renderer.sheetFor(speciesId)`
- Footprints:
  - `/app/frontend/src/game/fx.js`: footprint decal system
    - TTL: 210 frames, cap 320 decals
    - No prints for `float` / `winged`, cloaked creatures, or in water
    - Drawn under entities (`renderer.render()` calls `fx.drawFootprints()` before depth-sorted entities)

#### Phase E4 — Keeper Markers (render-only assignment visibility) ✅ COMPLETE
**Delivered:**
- `/app/frontend/src/game/renderer.js`:
  - `keeperPins()` resolves assignment via `assignedAnchor` → live enclosure, computes centroid, and returns pin data
  - `drawKeeperMarkers()` draws teardrop pins with role tint and keeper initial, bobbing subtly
  - Fanning: multiple keepers on one enclosure spread horizontally (20px step)
  - Debug/testing: `renderer._keeperPins`

#### Phase E5 — Testing & Verification ✅ COMPLETE
**Tests added/updated:**
- New: `/app/tests/phase20_features_test.py` (**39/39 PASS**) covering:
  - sovereign_bloodline menu + setup
  - progress chips
  - victory/defeat outcomes
  - breeding mechanics sanity
  - keeper markers
  - idle-life blink/motion/footprints
  - audio unlock + controls persistence
- Updated:
  - `/app/tests/phase9_scenarios_test.py` expects **6** scenario cards
  - `/app/tests/phase17_sovereign_test.py` expects **6** scenario cards
- Added test-only deterministic stepping:
  - `/app/frontend/src/game/controller.js`: `game.stepTicks(n)`

**Verification:**
- Sequential local regressions green:
  - `smoke_game.py`, `input_ux_test.py`, `keeper_priorities_test.py`, `gamefeel_test.py`, `phase6b_test.py`, `phase9_scenarios_test.py`, `phase17_sovereign_test.py`, `phase20_features_test.py`
- `testing_agent_v3`: **iteration_18 = 100%** (backend 6/6, frontend 39/39, integration + regressions 100%).

---

## 3) Next Actions (immediate)
1. **Balance/feel pass (optional, gameplay tuning only):**
   - Review `sovereign_bloodline` difficulty (Cycle 16 deadline, damage severity, starting cash, fail thresholds) based on player feedback.
   - Consider adding a small in-UI hint about transferring surplus adults to keep the pair breeding (already described in scenario text).
2. **P2 backlog items:**
   - **Photo Album**: persist captured photos and add an in-game gallery.
   - **Edge Scrolling**: camera glides when mouse approaches screen edge.
   - **Audio polish**: optional per-category volume (UI vs ambience) and/or a very light reverb bus.
3. **Maintenance:**
   - When any future refactor/feature is added, re-run:
     - `yarn --cwd /app/frontend build`
     - `python /app/tests/smoke_game.py`
     - (if needed) `playwright install chromium`
     - `testing_agent_v3` and produce the next iteration report.

---

## 4) Success Criteria
- **Core fantasy works:** player starts ignorant, observes, discovers, adapts habitat, profits.
- **Deterministic + stable:** fixed-timestep sim; save/load reproduces park reliably.
- **Unknown biology enforced:** UI cannot infer undiscovered traits.
- **No fake systems:** every UI metric corresponds to actual sim causes.
- **Explainability:** welfare/satisfaction/finances/containment risk have breakdowns.
- **Code quality restored:** no known Code Quality Analysis findings outstanding; tests reflect correct semantics; art API is maintainable.
- **Keeper Priorities delivered:** per-keeper enclosure assignment with **flexible prioritization**, persisted via save/load.
- **Staff report cards delivered:** per-cycle per-staff tallies that reset on day rollover.
- **Modern input UX delivered:** drag-pan, right-click cancel/clear, with toolbar sync and preserved workflows.
- **Game-feel delivered (render-only):** eased zoom, pan inertia, breach shake, placement pop + dust — with reduced-motion support.
- **Phase E delivered (verified):**
  - **Ambient Audio delivered:** synthesized Web Audio layer, stingers + ambience, HUD mute/volume, persisted, no sim changes.
  - **Sovereign Bloodline scenario delivered:** new BRUTAL mission with deterministic setup, deadline pressure, and breeding/health constraints.
  - **Creature Idle Life delivered (render-only):** blink + subtle idle motion + footprints; respects reduced motion.
  - **Keeper Markers delivered (render-only):** map pins for keeper assignments, readable with overlaps handled.

**Verified milestones:**
- Phase 11 acceptance: ✅ met (iteration_9 = 100%).
- Phase 12 acceptance: ✅ met (iteration_10 = 100%).
- Phase 13–16 acceptance: ✅ met (iteration_11 = 100% + `phase16_visual.py` PASS).
- Phase 17 acceptance: ✅ met (iteration_12 = 100% + `phase17_sovereign_test.py` PASS).
- Phase 19 acceptance: ✅ met (iteration_13 = 100% + `phase19_photo_test.py` PASS).
- Phase A acceptance: ✅ met (iteration_14 = 100%).
- Phase B acceptance: ✅ met (iteration_15 = 100%).
- Phase C acceptance: ✅ met (iteration_16 = 100%).
- Phase D acceptance: ✅ met (iteration_17 = 100%).
- **Phase E acceptance: ✅ met (iteration_18 = 100%).**

**Next verification to produce:**
- **iteration_19:** after the next feature addition (e.g., Photo Album / Edge Scrolling), via `testing_agent_v3`.