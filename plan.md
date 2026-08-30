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
- **Current objective (top priority):** **hold** for user review with a confirmed green regression baseline; do not start new features until approved.

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
A large React UI refactor (splitting monolithic components such as `GameScreen.jsx`, `InspectPanel.jsx`, `BuildToolbar.jsx` into smaller components/hooks) was applied. This phase verified the refactor did not break runtime behavior and completed remaining Code Quality Report items.

#### Phase 3A — Post-Refactor Verification (UI health check) ✅ COMPLETE
**Outcome:**
- Frontend compilation verified (esbuild clean; only non-blocking warnings).
- Game boots successfully: main route mounts, **Canvas renders**, key panels open/close, tools interact with canvas.

#### Phase 3B — Complete remaining Code Quality Report items (must-fix) ✅ COMPLETE
**Backend: add Python type hints**
- File: `/app/backend/server.py`
- Added return types to all **7** functions:
  - `root() -> Dict[str, str]`
  - `list_saves() -> List[Dict[str, Any]]`
  - `get_save(save_id: str) -> Dict[str, Any]`
  - `create_save(payload: SaveCreate) -> Dict[str, Any]`
  - `update_save(save_id: str, payload: SaveCreate) -> Dict[str, Any]`
  - `delete_save(save_id: str) -> Dict[str, str]`
  - `shutdown_db_client() -> None`

**Frontend sim bridge: fix direct state mutations**
- File: `/app/frontend/src/game/controller.js`
- Removed direct mutations in `setPaused` and `setSpeed`.
- Added controlled mutator in `/app/frontend/src/game/state.js`:
  - `setTimeControls(state, { paused, speed })`
- Controller now calls `setTimeControls(...)` and emits UI refresh.

**React: replace array-index keys with stable unique identifiers**
- File: `/app/frontend/src/components/game/FinanceScreen.jsx`
  - Chart bar cells now key by stable day string (`key={d.day}`)
  - Guest feed uses stable `id` via `state.nextId++` in guests feed items (`key={f.id}`)
  - Ticket price slider now uses controlled `setTicketPrice(state, value)` mutator from `state.js`
- File: `/app/frontend/src/components/game/TutorialOverlay.jsx`
  - `STEPS` now has stable `id` fields and uses `key={st.id}` for step dots
  - Added `aria-label` to step dot buttons

**Exit criteria:** met. No remaining index-key patterns found under `/app/frontend/src/components/game/`.

#### Phase 3C — Regression test pass (automated + testing agent) ✅ COMPLETE
**Automated tests:**
- `/app/tests/visual_v2.py` ✅ pass
- `/app/tests/scenario_discovery.py` ✅ pass
- `/app/tests/smoke_game.py` ✅ pass

**Testing agent:**
- `/app/test_reports/iteration_3.json` ✅ pass
  - Backend: **100% (10/10)**
  - Frontend: **100%**
  - No console errors
  - No React key warnings
  - Verified time controls + hotkeys + finance slider + save/load

#### Phase 3D — STOP for user review ⏸️ CURRENT
Per user instruction: stop after verification/fixes/testing and hand off for review. No P1 features started.

---

### Phase 4 — Post-v1 Expansion (after delivery) 💤 BACKLOG (Not Started)
> NOTE: per user direction, do **not** start until after review.
- Escapes/emergencies depth: readable failure causes + response units.
- Expeditions depth: multi-step field ops, timelines, outcomes.
- Contracts beyond tutorial directives.
- Weather/incidents, staff entities.
- Additional overlays (guest heatmaps), accessibility improvements (key rebinding), content packs via data pipeline.

## 3) Next Actions (immediate)
1. **STOP — User review**
   - User to play the game and validate UX/functionality.
2. If user approves, pick **one** next workstream:
   - **P1:** Escapes, Emergencies, and Security Teams
   - **P1:** Expeditions, Contract Board, and Night Tours
   - Or other priorities user selects.

## 4) Success Criteria
- **Core fantasy works:** player starts ignorant, observes, discovers, adapts habitat, profits.
- **Deterministic + stable:** fixed-timestep sim; save/load reproduces park reliably.
- **Unknown biology enforced:** UI cannot infer undiscovered traits (including from habitat cause text).
- **No fake systems:** every UI metric corresponds to actual sim causes.
- **Explainability:** welfare/satisfaction/finances/containment risk have breakdowns + recent-cause reasoning.
- **Refactor-safe:** frontend compiles; panels/tools work; no runtime console errors.
- **Code quality compliance:** `server.py` type hints added; controller time controls no longer direct-mutate; React stable keys used; ticket price uses controlled mutator.
- **Automated verification:** tests + testing agent pass (iteration_3 baseline).
- **First 10 minutes fun:** build first enclosure, acquire first creature, see a discovery, guests react, money moves—without friction.
