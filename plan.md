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

**Current objective (top priority):** maintain a stable, test-backed baseline and await user direction on next expansion workstream.

Status: **Phase 5 COMPLETE** (feature expansion delivered + fully verified). Regression baseline green.

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
7. Unknown biology gating: hidden prefs enforced by knowledge accessors.
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
  - `controller.js`: removed direct mutations for pause/speed; added `setTimeControls`.
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
- Fence toolbar now includes DRAW toggle: **Line | Rectangle** (`tool.fenceShape`).
- `construction.js`:
  - `fenceRectEdges(v0,v1)` perimeter generator.
  - Shared commit/remove helpers for line/rect placement.
  - Degenerate rectangles fall back to a straight line.
- `input.js` fence drag flow now commits either line or rect edges.
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
- Renderer: `drawSecurityUnit(...)` glyph + existing escape ring remains.
- Objectives: new `security_post` directive; `initObjectives` merges missing objectives into old saves.
- Stats: `stats.captures`.

**Testing:**
- Verified in `/app/tests/phase5_test.py` plus testing agent iteration_4.

#### Phase 5C — Expedition Board + Contracts ✅ COMPLETE
**Delivered:**
- Expeditions:
  - `data/expeditions.js`: 4 zones (Mirefen Delta, Shardpeak Ascent, Umbral Grove, Ember Wastes) with cost/duration/risk/species pools.
  - `game/expeditions.js`: staged progress **Transit → Survey → Recovery → Return** with event log.
  - Rewards: salvage cash, specimen recovery, and wild evidence injection.
  - Claim flow: **CLAIM & RELEASE** arms a free creature placement tool (`tool.free`) and marks specimen placed.
- Contracts:
  - `game/contracts.js`: 5 templates (welfare, guests, discovery, rating, tickets-best-in-cycle).
  - Refresh every 2 cycles; up to 3 active; expiry; payout via grants.
- Field Ops UI:
  - Field Ops modal now tabbed: **Acquire | Expeditions | Contracts**, with attention dots.

**Persistence:**
- `state.deserialize()` now provides defaults for `security`, `expeditions`, and `contracts` so old saves load safely.

**Testing:**
- `/app/tests/phase5_test.py` (18/18).
- `smoke_game.py`, `scenario_discovery.py`, `visual_v2.py`, `fence_drag_test.py` all green.
- Testing agent iteration_4: backend 100%, frontend 100%, integration 100%.

#### Phase 5D — Full regression verification ✅ COMPLETE
- Automated tests: all green.
- Testing agent: `/app/test_reports/iteration_4.json` all green.

---

## 3) Next Actions (immediate)
**Stop for user review and direction.**

Choose next workstream (not started):
1. **P1.2** Security deepening: injuries, guest panic routing, lock-down actions, repair crews, security staffing economy.
2. **P2** Late-game creatures and abilities: anomalous/electrical/camouflage/burrowing, plus counterplay systems.
3. **P1.3** Night Tours: turn night-time into an explicit monetizable mode.
4. **P3** Sandbox extras: unlimited toggles, debug overlays, scenario presets.
5. **P3/P4** Breeding/genetics; campaigns/multiplayer.

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
- **Automated verification:** full suite + testing agent pass (iteration_4 baseline).