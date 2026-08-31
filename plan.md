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
- Transition to **P2 backlog** work:
  - **P2: Genetic Traits** — offspring inherit colors/traits so breeding lines become collectible.
  - **P2: Photo Mode** — camera tool to capture and share beautiful shots of glowing night exhibits.

Status:
- **Phase 1–6 COMPLETE** and fully test-backed.
- **Phase 7 COMPLETE** (visual/art overhaul) and **fully verified**.
- **Phase 8 COMPLETE** (Keeper Staff) and verified.
- **Phase 9 COMPLETE** (Scenario Missions) and verified.
- **Phase 10 COMPLETE** (Code Quality / Code Review remediation) and **accepted**.
- **Phase 11 COMPLETE** (High-End Visual Asset Redesign) and **fully verified**.
- **Phase 12 COMPLETE** (Apex-Class Species, Tier 4) and **fully verified**.

> Constraint (hard): new content must be **additive** and must **not** change existing save schema or simulation rules; regression tests must remain green.

**Testing baselines:**
- iteration_5: pre-Phase 7 green baseline.
- iteration_6: post-Phase 7 green baseline (**testing_agent_v3 100%**, plus local suites).
- iteration_7: post-Phase 8+9 green baseline (**testing_agent_v3 100% backend**, local suites green).
- iteration_8: post-Phase 10 refactor verification (**testing_agent_v3 100% frontend**, 16/16).
- iteration_9: post-Phase 11 visual remake verification (**testing_agent_v3 100% overall**, backend 7/7, frontend 29/29; local suites green).
- iteration_10: post-Phase 12 apex species verification (**testing_agent_v3 100% frontend**, 12/12; local suites green).

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
**Delivered:**
- Fence toolbar includes DRAW toggle: **Line | Rectangle** (`tool.fenceShape`).
- `construction.js`:
  - `fenceRectEdges(v0,v1)` perimeter generator.
  - Shared commit/remove helpers for line/rect placement.
  - Degenerate rectangles fall back to a straight line.
- `input.js` fence drag flow commits line or rect edges.
- Live preview + cost label works for rectangles; remove tool supports rectangle drag-removal.

**Testing:**
- Verified via `/app/tests/phase5_test.py`.

#### Phase 5B — Security Response (Escapes, Emergencies, Security Teams) ✅ COMPLETE
**Delivered:**
- New building: **Rapid Response Post** (`security_post`) in Facilities/Operations, needs path.
- New module: `game/security.js`
  - Auto-dispatches units to escaped creatures (one active recovery per post).
  - **◈250 dispatch cost** to `finances.today.expenses.response`.
  - Capture loop: toTarget → capturing → returning.
  - Escort back to `homeTile` if possible; otherwise relocate to **largest intact enclosure**.
  - Cooldown + warning if no containment exists.
- UI: `EmergencyBanner.jsx` top-center, listing escapees with clickable chips (centers camera).
- Renderer: `drawSecurityUnit(...)`.
- Objectives: new `security_post` directive; `initObjectives` merges missing objectives into old saves.
- Stats: `stats.captures`.

**Testing:**
- Verified in `/app/tests/phase5_test.py` plus testing agent iteration_4.

#### Phase 5C — Expedition Board + Contracts ✅ COMPLETE
**Delivered:**
- Expeditions:
  - `data/expeditions.js`: zones with cost/duration/risk/species pools.
  - `game/expeditions.js`: staged progress **Transit → Survey → Recovery → Return**.
  - Rewards: salvage cash, specimen recovery, wild evidence injection.
  - Claim flow: **CLAIM & RELEASE** arms free creature placement.
- Contracts:
  - `game/contracts.js`: templates; refresh cadence; expiry; payouts.
- Field Ops UI:
  - Field Ops modal tabbed: **Acquire | Expeditions | Contracts**, with attention dots.

**Persistence:**
- `state.deserialize()` defaults for `security`, `expeditions`, `contracts` so old saves load safely.

**Testing:**
- `/app/tests/phase5_test.py`.
- Additional suites (`smoke_game.py`, etc.) green.
- Testing agent iteration_4: backend 100%, frontend 100%, integration 100%.

---

### Phase 6 — Immersion + Late Game Systems (Panic, Night Tours, Breeding, Abilities) ✅ COMPLETE
**Goal:** make emergencies feel cinematic, make night time a monetizable gameplay mode, add sustainable population growth, and introduce anomalous late-game counterplay.

#### Phase 6A — Guest Panic + Evacuation Flow ✅ COMPLETE
Delivered + tested via `/app/tests/phase6a_test.py`.

#### Phase 6B — Night Tours ✅ COMPLETE
Delivered + tested via `/app/tests/phase6a_test.py`.

#### Phase 6C — Breeding Program ✅ COMPLETE
Delivered + tested via `/app/tests/phase6b_test.py`.

#### Phase 6D — Late Game Abilities + Counterplay Research ✅ COMPLETE
Delivered + tested via `/app/tests/phase6b_test.py`.

#### Phase 6E — Testing + Regression ✅ COMPLETE
- `/app/test_reports/iteration_5.json` all green.

---

### Phase 7 — Dedicated Visual Quality Pass (Pixel Art Cohesion) ✅ COMPLETE
**Goal:** Upgrade all visuals (15 creatures, staff, buildings, archive portraits) to cohesive slightly-3D pixel art with upper-left lighting, shadows, and restrained bioluminescence — **without changing simulation logic**.

**Delivered:**
- New procedural pixel art system in `/app/frontend/src/game/art/`.
- Renderer & portrait pipeline updated to use cached sprite sheets.
- Verified by full suite + `testing_agent_v3` iteration_6.

---

### Phase 8 — Keeper Staff (Hireable keepers: feed/clean/calm automation) ✅ COMPLETE
**Goal:** Reduce micromanagement by adding hireable staff that autonomously provide routine creature care.

**Delivered:**
- Data/roles:
  - `/app/frontend/src/game/data/staffRoles.js` (roles, wages, hire costs, labels)
- Staff simulation:
  - `/app/frontend/src/game/staff.js`
  - Controlled mutators: `hireStaff`, `fireStaff`
  - Deterministic tasking:
    - **Hand-feeding** hungry creatures (xenobiologist)
    - **Biowaste cleaning** (xenobiologist)
    - **Stress/health treatment** (biomedical)
    - **Fence repair** (warden)
    - Patrol/wander fallback
  - A* movement with **facility access** (crosses fences; avoids deep water/buildings)
  - Stats counters: `staffFeedings/staffTreatments/staffCleanings/staffRepairs`
- Biowaste system:
  - `wasteTick` adds waste in enclosures
  - Guests complain if exhibits are dirty (integrated into `guests.js`)
- Economy:
  - Daily payroll at `dailyRollover` → `expenses.wages`
  - Finance UI label added (“Staff wages”)
- UI:
  - `StaffScreen.jsx` modal: hire cards + roster + fire
  - HUD Staff button added
- Rendering:
  - `renderer.js` draws staff sprites (from Phase 7 art) + draws waste sprites
- Persistence:
  - `state.staff` and `state.waste` defaults in createNewGame + deserialize

**Testing:**
- `/app/tests/phase8_staff_test.py` **12/12**.
- Full regression sweep green.

---

### Phase 9 — Scenario Missions (Campaign challenges with start states + goals) ✅ COMPLETE
**Goal:** Provide a mission-driven campaign layer with handcrafted starting states, win goals, and fail conditions.

**Delivered:**
- Scenario definitions:
  - `/app/frontend/src/game/data/scenarios.js` (4 missions)
- Scenario engine:
  - `/app/frontend/src/game/scenarios.js`
  - `applyScenario` builds starter enclosures + optional starter buildings/creatures
  - `scenarioTick` evaluates win/lose; rewards added on victory
  - Controlled mutator: `ackScenario`
- UI:
  - `ScenarioTracker.jsx` mission tracker + victory/defeat dialogs
  - Main menu **Scenarios** mode + scenario picker cards
  - Completion badges stored in localStorage

**Testing:**
- `/app/tests/phase9_scenarios_test.py` **17/17**.
- Full regression sweep green.

---

### Phase 10 — Code Quality / Code Review Remediation ✅ COMPLETE (accepted)
**Goal:** Resolve the strict code review block (hooks deps, complexity, performance) and ensure the React UI refactor remains stable.

**Final acceptance results:**
- Testing agent **iteration_8**: frontend **100%** (16/16 scenarios), zero UI bugs, zero integration issues, zero regressions.
- Canvas2D `willReadFrequently` perf suggestion fixed in `game/art/pixel.js`.
- Webpack compiles with **zero warnings**; esbuild clean; all local Playwright suites green.

---

### Phase 11 — High-End Visual Asset Redesign Pass ✅ COMPLETE (fully verified)
**Goal:** Perform a **full production-quality visual remake** (not a polish pass), upgrading silhouettes, geometry, materials, textures, surface detail, animation quality, and cohesion — while keeping **all gameplay logic identical**.

**Delivered (visual-only, no sim changes):**
- Phase 11A–11F implemented across:
  - Environment pipeline (`art/terrain_tex.js`, `art/flora.js`, water overlays)
  - Buildings remake (`art/buildings.js`)
  - Creatures remake (15 species: `art/creatures_a.js`, `art/creatures_b.js`)
  - Staff/guests/fences/entrance (`art/staff.js`, `art/guests.js`, `renderer.js`)
  - Atmosphere/lighting/day-night (`renderer.js`)

**Verification (all green):**
- Local Python suites:
  - `/app/tests/smoke_game.py` ✅
  - `/app/tests/phase8_staff_test.py` ✅
  - `/app/tests/phase9_scenarios_test.py` ✅
- `testing_agent_v3` iteration_9: **100% overall** (backend 7/7, frontend 29/29), zero regressions.

---

### Phase 12 — Apex-Class Species (Tier 4) ✅ COMPLETE (fully verified)
**Goal:** Add a small “Apex-class” set of **Tier 4** species (super predators + super herbivores) plus the minimal progression gating to acquire them.

**Hard constraints (met):**
- No changes to simulation behavior, AI rules, existing species entries, or save schema.
- Changes are additive and data-driven.

#### Phase 12A — Data: Tier-4 species entries ✅ COMPLETE
**Delivered:**
- `/app/frontend/src/game/data/species.js`: appended 4 new Tier-4 `Apex` species (no existing entries modified):
  1. `nyxarr` — **Nyxarr Sovereign** (titan apex predator), danger 5
  2. `zephyrmaw` — **Zephyrmaw Skyrender** (aerial apex predator), danger 5
  3. `aurox` — **Aurox Titanhorn** (colossal grazer), danger 3
  4. `sylvarr` — **Sylvarr Crownspire** (canopy colossus), danger 2

#### Phase 12B — Research: acquisition gating for Tier 4 ✅ COMPLETE
**Delivered:**
- `/app/frontend/src/game/data/research.js`: added `ops_field4` (**Field Operations IV**) requiring `ops_field3`, cost **◈14,000**, time **220**.
- `/app/frontend/src/game/state.js`: sandbox pre-completed research list includes `ops_field4`.

#### Phase 12C — Expeditions: Titanfall Reach ✅ COMPLETE
**Delivered:**
- `/app/frontend/src/game/data/expeditions.js`: added new zone `titanfall` — **Titanfall Reach (ZONE T-1)**, cost **◈16,000**, risk 3, pool includes the 4 Tier-4 species.

#### Phase 12D — UI gating updates ✅ COMPLETE
**Delivered:**
- `/app/frontend/src/components/game/AcquisitionScreen.jsx`: `tierUnlocked()` now supports tier 4 (requires `ops_field4`), lock label displays **II / III / IV** correctly.
- `/app/frontend/src/components/game/SpeciesDatabase.jsx`: same tier 4 gating + lock label behavior.

#### Phase 12E — Art: apex creature painters ✅ COMPLETE
**Delivered:**
- **NEW** `/app/frontend/src/game/art/creatures_c.js`: 4 production-quality sprite painters following Phase 11 conventions (layered anatomy, gait/limb, rimlight, restrained bioluminescence).
- `/app/frontend/src/game/art/creatures.js`: registered `CREATURES_C` into `CREATURE_ART`.

#### Phase 12F — Verification + regression ✅ COMPLETE
**Build + regression (all green):**
- `esbuild` compile: ✅
- Local suites re-run:
  - `/app/tests/smoke_game.py` ✅
  - `/app/tests/phase8_staff_test.py` ✅
  - `/app/tests/phase9_scenarios_test.py` ✅

**Interactive verification (all green):**
- Visual checks: Tier-4 cards + portraits render in Field Ops; all 4 apex creatures released into sandbox enclosure render/animate and remain contained.
- `testing_agent_v3` iteration_10: **100% frontend** (12/12):
  - Sandbox: Tier-4 species unlocked and acquirable
  - Management: Tier-4 species locked with “Field Operations IV required”
  - Research: ops_field4 node visible w/ correct prereq
  - Species DB: 19 species listed
  - Expeditions: Titanfall Reach zone visible
  - Zero console errors, no regressions

---

## 3) Next Actions (immediate)
1. Start **P2: Genetic Traits**
   - Decide trait schema (color + 1–2 gameplay-affecting traits)
   - Add inheritance rules to breeding outcomes
   - Add UI for offspring lineage/traits
2. Start **P2: Photo Mode**
   - Camera controls (hide UI, depth-of-field-like overlay, time freeze)
   - Export screenshot pipeline
   - Optional: saved “shots” gallery

---

## 4) Success Criteria
- **Core fantasy works:** player starts ignorant, observes, discovers, adapts habitat, profits.
- **Deterministic + stable:** fixed-timestep sim; save/load reproduces park reliably.
- **Unknown biology enforced:** UI cannot infer undiscovered traits (including from habitat cause text).
- **No fake systems:** every UI metric corresponds to actual sim causes.
- **Explainability:** welfare/satisfaction/finances/containment risk have breakdowns + recent-cause reasoning.
- **Construction UX:**
  - Fence **Line**: drag builds a straight wall; click places one segment.
  - Fence **Rectangle**: drag outlines a full 4-wall enclosure perimeter.
- **Security:** escapes generate clear alerts/banners; response units dispatch; capture loop resolves breaches with costs.
- **Progression:** expeditions + contracts provide goals and acquisition variety beyond tutorial.
- **Phase 7 acceptance (visual-only):** ✅ met.
- **Phase 8 acceptance (Keeper Staff):** ✅ met.
- **Phase 9 acceptance (Scenario Missions):** ✅ met.
- **Phase 10 acceptance (Code Quality):** ✅ met.
- **Phase 11 acceptance (High-End Visual Remake):** ✅ met; all regressions green; `testing_agent_v3` iteration_9 = 100%.
- **Phase 12 acceptance (Apex-Class Species):** ✅ met; all regressions green; `testing_agent_v3` iteration_10 = 100% frontend.
