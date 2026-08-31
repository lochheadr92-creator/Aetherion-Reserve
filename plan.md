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
- **Project is feature-complete through Phase 19 and fully verified.**
- Next work is optional / future roadmap only (no committed tasks).

**User confirmations (scope decisions):**
- Transport: **station-to-station rides** with a **visible elevated car** that **rises over fences/enclosures safely** mid-route and **lowers at stations**; **no full vehicle traffic sim**.
- Genetics: offspring variation via **per-creature hue/size/glow modifiers** (no hand-drawn morph variants).
- Sequencing followed: **Verify Phases 13–16 first**, then **Phase 17 Sovereign Containment**, then **Photo Mode**.

**Status:**
- **Phase 1–6 COMPLETE** and fully test-backed.
- **Phase 7 COMPLETE** (visual/art overhaul) and fully verified.
- **Phase 8 COMPLETE** (Keeper Staff) and verified.
- **Phase 9 COMPLETE** (Scenario Missions) and verified.
- **Phase 10 COMPLETE** (Code Quality / Code Review remediation) and **accepted**.
- **Phase 11 COMPLETE** (High-End Visual Asset Redesign) and **fully verified**.
- **Phase 12 COMPLETE** (4 Apex-class species) and **fully verified**.
- **Phases 13–16 COMPLETE & VERIFIED** (genetics, events/rivalry, guest archetypes, ~30 buildings, attractions/transport).
- **Phase 17 COMPLETE & VERIFIED** (Sovereign Containment scenario + mastery system).
- **Phase 19 COMPLETE & VERIFIED** (Photo Mode).

> Constraint (hard): new content must be **systemic, reusable, and interconnected**; changes must remain robust and regression-safe. Save schema can be extended **only additively** with backward-compatible defaults; existing tests must remain green.

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
- `/app/tests/phase9_scenarios_test.py` updated to expect 5 scenario cards.
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
- Visual validation at night with glowing species (screenshots produced during dev).
- Full regression sweep green: smoke, phase8, phase9, phase16_visual, phase17.
- `testing_agent_v3` **iteration_13 = 100%** (backend/frontend/integration).

---

## 3) Next Actions (immediate)
No required work. Optional roadmap items (not committed):
1. **Photo Gallery (persistence):** store recent captures (localStorage or backend save attachments).
2. **Scenario medals:** bronze/silver/gold grading or mastery badge persistence/leaderboards.
3. **Keeper priorities:** assign keepers to specific enclosures with priority sliders.
4. **More apex scenarios:** additional handcrafted missions leveraging genetics/rivalry/transport.

---

## 4) Success Criteria
- **Core fantasy works:** player starts ignorant, observes, discovers, adapts habitat, profits.
- **Deterministic + stable:** fixed-timestep sim; save/load reproduces park reliably.
- **Unknown biology enforced:** UI cannot infer undiscovered traits.
- **No fake systems:** every UI metric corresponds to actual sim causes.
- **Explainability:** welfare/satisfaction/finances/containment risk have breakdowns.

**Verified milestones:**
- Phase 11 acceptance: ✅ met (iteration_9 = 100%).
- Phase 12 acceptance: ✅ met (iteration_10 = 100%).
- Phase 13–16 acceptance: ✅ met (iteration_11 = 100% + `phase16_visual.py` PASS).
- Phase 17 acceptance: ✅ met (iteration_12 = 100% + `phase17_sovereign_test.py` PASS).
- Phase 19 acceptance: ✅ met (iteration_13 = 100% + `phase19_photo_test.py` PASS).
