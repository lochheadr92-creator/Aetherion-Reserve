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
- **Phase R — CINEMATIC 3D WORLD**
  - Total visual rework away from pixel art: **true 3D via three.js/WebGL**, realistic/cinematic diorama look, full world scope.
  - **Hard constraint:** visuals only — gameplay/sim/save/picking math must remain unchanged.

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
- Phase F constraints:
  - **Edge scrolling is input/render layer only** and must not be triggered by HUD/toolbars/modals.
  - **Bloodline Ledger** is an **additive registry**.
  - **Keeper Radio Chatter** is **lightweight + rate-limited** and should not spam toasts.

**Phase G constraints (hard):**
- Creature art overhaul is a **render/art layer change**; do not change sim rules.
- Keep old saves compatible.
- Preserve the existing “unknown biology” readability: silhouettes must remain legible on dark terrain.

**HUD / Ops Deck constraints (updated, hard):**
- **Ops Deck is now the only HUD**.
- Retired:
  - `OPS_DECK` flag
  - `?legacyHud=1`
  - `localStorage['aetherion.opsDeck']='off'`
  - legacy full-screen management modals (`GameModals.jsx`, ScreenFrame modal host)
- Keep **Ops Deck geometry unchanged**: **56px dock + 320px drawer** (≤376px total coverage).
- **Strict determinism**: do not introduce `Math.random()` or non-deterministic operations into sim logic (`src/game/state.js`, `controller.js`, etc.).
- No new dependencies (Tailwind plugin additions are allowed only if already available).

**Phase O confirmations (binding):**
- **Neglect CAN kill**: health reaching **0** causes death (with escalating warnings).
- **Breach destroys the barrier segment**: enclosure becomes physically open (gap) until rebuilt/repaired.
- **Serious in-pen aggression** triggers **Rapid Response** intervention when a post is in range (separates animals); biomedical staff treat injuries afterward.
- Same rules in **Sandbox and Management**.
- Minimal UI additions approved:
  - Canvas distress marker
  - Enclosure stress tint + breach-gap markers
  - EnclosurePanel tension/incompatibility section + breached state
  - CreaturePanel health bar + INJURED/CRITICAL badge
  - Ledger DECEASED status
- **Hybrid/interbreeding sprites**: explicitly **parked as a follow-up backlog item** (not Phase O).

**Phase R confirmations (binding):**
- Rendering: **TRUE 3D via three.js/WebGL** (not Canvas2D, not sprites).
- Art direction: **REALISTIC / CINEMATIC** (Planet Zoo / Jurassic World Evolution diorama feel).
- Scope: **EVERYTHING** — terrain, water, flora, fences, paths, buildings, creatures, guests/staff/security, transport, waste, entrance, weather.
- Textures: **AI-generated offline** via Gemini image generation (`emergentintegrations`, model `gemini-3.1-flash-image-preview`, `EMERGENT_LLM_KEY`) using a one-off asset pipeline script.
- Constraint: **VISUALS ONLY**.
  - Isometric camera remains **2:1 dimetric**: yaw 45°, pitch 30°, **orthographic**.
  - Zoom/pan behaviour stays identical.
  - Picking math stays identical (`renderer.screenToTile/edgeFromPointer/vertexFromPointer`, `worldPx`).
  - Sim, save format and gameplay remain unchanged.
  - `window.__gameRenderer` API must keep working for HUD/tests.

**Phase R implementation approach choice (binding for continuation):**
- Creatures/guests/staff will be **procedural 3D bodies** (meshes/groups/instancing) with **AI-generated PBR textures** (no billboard cards).

**Working style (user-confirmed):**
- plan → implement → write Playwright test → run testing agent → auto-continue to next item without stopping.

**Status (high-level):**
- **Phase 1–21 COMPLETE & VERIFIED**.
- **Phase G (Creature Art Rework): ✅ COMPLETE & VERIFIED (iteration_20 = 100%)**.
- **Phase H (Assessment Fixes): ✅ COMPLETE & VERIFIED (iteration_21 = 100%)**.
- **Stabilisation + Remediation passes:** ✅ COMPLETE & VERIFIED (iteration_22 and iteration_23 = 100%).
- **Phase J (ART_V2 post-passes): ✅ COMPLETE & VERIFIED (iteration_24 = 100%)**.
- **Phase K (Ops Deck Step 1 shell): ✅ COMPLETE & VERIFIED (iteration_24 = 100%)**.
- **Phase L (juveniles/seed picker/live portraits/voices): ✅ COMPLETE & VERIFIED (iteration_25 = 100%)**.
- **Phase M (Ops Deck Step 2 native drawer panels): ✅ COMPLETE & VERIFIED (iteration_26 = 100%, 289/289)**.
- **Phase N (Polish/QA pass): ✅ COMPLETE & VERIFIED (iteration_26 = 100%)**.
- **Phase O (Creature Tension Pass): ✅ COMPLETE & VERIFIED (iteration_27 = green)**.

**Phase R progress (updated):**
- **R1 Foundation: ✅ IMPLEMENTED**
  - Three.js WebGL pipeline in place (`/app/frontend/src/game/three/*`).
  - Camera lock math implemented (`iso.js`) and integrated.
  - Terrain heightfield + splat PBR shader (`terrain.js`).
  - Water merged mesh + shader (`water.js`).
  - Lighting rig + day/night + storm (`lighting.js`).
  - Post stack (`post.js`) + quality tiers.
  - Hybrid stacked canvases (`GameCanvas.jsx`): WebGL behind, 2D overlay above.
  - WebGL software-renderer (SwiftShader/llvmpipe) fallback retained to keep Playwright stable.
  - AI texture generation pipeline (`backend/tools/gen_textures.py`) + PBR texture pack under `frontend/public/textures/`.

- **R2 World completeness (flora/fences/paths/buildings/entrance/skirt): ✅ IMPLEMENTED & VERIFIED**
  - `materials.js`: PBR kit, procedural alpha textures, wind uniforms, instancing helper.
  - `flora3d.js`: instanced trees + foliage cards, shrubs, grass, reeds, spores, aether fronds.
  - `fences3d.js`: T1–T4 fence variants, gates, damage tint/lean.
  - `buildings3d.js`: procedural kit, merged buckets, emissive windows/signage, station pylons.
  - `props3d.js`: waste + entrance gate + guideways + hanging cars.
  - Terrain skirt + diorama void.

- **R3 Creatures: ✅ IMPLEMENTED & VERIFIED**
  - `creatures3d.js`: rigs for `quad/tall/winged/insect/amphib/crystal/blob/float/serpent`.
  - PBR skins + genes/morph tint; distress/injury desat; gait/idle/state pose.

- **R4 People + transport + waste: ✅ IMPLEMENTED & VERIFIED**
  - `people3d.js`: instanced humanoids with walk cycle.
  - Transport in 3D driven by `state.transport.cars`.

- **R5 Verification: ✅ COMPLETE (tests)**
  - `tests/render3d_test.py` now **25/25** (shoreline + storm checks added).
  - Regression suites still green.

**Phase S (post-3D follow-ups picked by the user): ✅ IMPLEMENTED & TESTED**
- **S1 Shoreline softening:**
  - Terrain basin now uses a **BFS distance-field beach profile** (0.9 steps first ring, +0.65/ring), capped by per-corner mean basin targets (1.3 shallow / 2.6 deep).
  - Underwater bed becomes **sand/mud** in the terrain splat shader.
  - Half-tile **wet-sand band** darkens/glosses ground around water.
  - Water shader now reads per-vertex **bed height (aBed)** to compute true column depth for colour/alpha/foam: transparent at the waterline, opaque in deeps.

- **S2 Legacy HUD retirement:**
  - Removed OPS_DECK flag and all legacy modal routing.
  - `ScreenFrame` is drawer-only.
  - `GameModals.jsx` removed.
  - `BloodlineLedger` no longer portals; `CreaturePanel` always routes ledger to the drawer.
  - Tests rewritten to assert legacy switch is ignored; baseline/record script removed.

- **S3 Living weather:**
  - `Lights.storm` smoothed factor (visual easing), gusty wind (`Lights.gust`).
  - Wind shader supports gust flutter + lean.
  - Water: slate storm tint + chop + rain rings.
  - Terrain: storm **wet soak** (`uWet`).
  - New `weather3d.js` **RainSplashes** instanced additive rings on rooftops/slabs/paths.
  - `BuildingLayer.roofAt()` provides hard-surface height for splash placement.

- **S4 Species roster filters:**
  - Species database drawer now has: search box + family-class chips (**Grazers/Predators/Colossi/Anomalous**) + tier chips + counts + CLEAR + empty state.
  - Locked species never leak identity: search/class only match catalogued entries.

**Key fixes / technical notes (Phase R/S):**
- TextureRegistry stand-in fix (canvas-backed `THREE.Texture`) retained.
- Environment reflections via `RoomEnvironment` PMREM.
- Water now uses aBed-derived depth (shoreline gradient is geometry + shader, not just alpha tricks).

**Testing baselines (updated):**
- iteration_5–19: green
- iteration_20: Phase G green
- iteration_21: Phase H green
- iteration_22: stabilisation green
- iteration_23: remediation green
- iteration_24: Ops Deck Step 1 green
- iteration_25: Phase L green
- iteration_26: Phase M+N green
- iteration_27: Phase O green
- iteration_28: Phase R regression sweep green

**New/updated tests (post S):**
- `tests/render3d_test.py`: **25/25**
- `tests/species_filters_test.py`: **8/8**
- `tests/ops_deck_test.py`: **29/29**
- `tests/ops_deck_native_test.py`: **17/17**
- Jest unit tests: **40/40**

**Tooling note (Playwright):**
- Playwright is now 1.62; required installing `chromium-headless-shell v1234` into `/pw-browsers/`.

> Constraint (hard): changes must remain robust and regression-safe. Save schema can be extended **only additively** with backward-compatible defaults; existing tests must remain green.

---

## 2) Implementation Steps

### Phase 1 — Core POC ✅ COMPLETE
(unchanged; complete and verified)

---

### Phase 2 — V1 App Development ✅ COMPLETE
(unchanged; complete and verified)

---

### Phase 3 — Stabilization + Proving Scenarios + Polish ✅ COMPLETE
(unchanged; complete and verified)

---

### Phase 4 — Fence UX Rework ✅ COMPLETE
(unchanged; complete and verified)

---

### Phase 5 — Feature Expansion: Rectangles + Security + Expeditions ✅ COMPLETE
(unchanged; complete and verified)

---

### Phase 6 — Immersion + Late Game Systems ✅ COMPLETE
(unchanged; complete and verified)

---

### Phase 7 — Dedicated Visual Quality Pass ✅ COMPLETE
(unchanged; complete and verified)

---

### Phase 8 — Keeper Staff ✅ COMPLETE
(unchanged; complete and verified)

---

### Phase 9 — Scenario Missions ✅ COMPLETE
(unchanged; complete and verified)

---

### Phase 10 — Code Quality / Code Review Remediation ✅ COMPLETE
(unchanged; complete and verified)

---

### Phase 11 — High-End Visual Asset Redesign Pass ✅ COMPLETE
(unchanged; complete and verified)

---

### Phase 12 — Apex-Class Species (Tier 4) ✅ COMPLETE
(unchanged; complete and verified)

---

### Phase 13 — Genetics & Breeding Lines ✅ COMPLETE
(unchanged; complete and verified)

---

### Phase 14 — Park Events Engine + Rival Rumbles ✅ COMPLETE
(unchanged; complete and verified)

---

### Phase 15 — Guest Interest System ✅ COMPLETE
(unchanged; complete and verified)

---

### Phase 16 — Attractions, Amenities & Transport ✅ COMPLETE
(unchanged; complete and verified)

---

### Phase 17 — Apex Scenario: “Sovereign Containment” ✅ COMPLETE
(unchanged; complete and verified)

---

### Phase 18 — Verification & Regression ✅ COMPLETE
(unchanged; complete and verified)

---

### Phase 19 — Photo Mode ✅ COMPLETE
(unchanged; complete and verified)

---

### Phase A — Code Quality Completion & Re-Verification ✅ COMPLETE
(unchanged; complete and verified)

---

### Phase B — Feature: Keeper Priorities ✅ COMPLETE
(unchanged; complete and verified)

---

### Phase C — QoL: Staff Report Card + Input UX Improvements ✅ COMPLETE
(unchanged; complete and verified)

---

### Phase D — Game-Feel Pass ✅ COMPLETE
(unchanged; complete and verified)

---

### Phase E (Phase 20) — Ambient Audio + Sovereign Bloodline + Creature Idle Life + Keeper Markers ✅ COMPLETE
(unchanged; complete and verified)

---

### Phase F (Phase 21) — Edge Scrolling + Bloodline Ledger + Keeper Radio Chatter ✅ COMPLETE
(unchanged; complete and verified)

---

### Phase G (Phase 22) — Creature Art Rework ✅ COMPLETE
(unchanged; complete and verified)

---

### Phase H — Assessment Fixes ✅ COMPLETE
(unchanged; complete and verified)

---

### Phase I — Remediation Pass ✅ COMPLETE
(unchanged; complete and verified)

---

### Phase J — ART_V2 post-passes ✅ COMPLETE & VERIFIED
(unchanged; complete and verified)

---

### Phase K — Ops Deck Step 1 shell ✅ COMPLETE & VERIFIED
(unchanged; complete and verified)

---

### Phase L — Phase G continuation backlog ✅ COMPLETE & VERIFIED
(unchanged; complete and verified)

---

### Phase M — Ops Deck Step 2: Native Drawer Panels ✅ COMPLETE & VERIFIED
(unchanged; complete and verified)

---

### Phase N — Polish / QA Pass ✅ COMPLETE & VERIFIED
(unchanged; complete and verified)

---

### Phase O — CREATURE TENSION PASS ✅ COMPLETED & VERIFIED
(unchanged; complete and verified)

---

### Phase R — CINEMATIC 3D WORLD (three.js/WebGL) ✅ IMPLEMENTED + ✅ TEST-VERIFIED
**Goal:** Replace the pixel-art Canvas2D world with a realistic/cinematic **true 3D** world renderer, while keeping gameplay/sim/save/input/picking math unchanged.

#### R0) Hard constraints (non-negotiable)
- **Visuals only**: no sim rule changes, no save format changes, no input semantics changes.
- **Isometric camera lock** (orthographic, yaw 45°, pitch 30°). Zoom/pan identical.
- **Picking math unchanged**: the existing 2D picking stays authoritative.
- **Fallback-safe**: if WebGL is unavailable, or `?classic=1`, game uses the legacy 2D renderer unchanged.
- **Stability**: preserve `window.__gameRenderer` API used by tests and HUD.
- **Determinism**: no `Math.random()` in sim; render-only effects may use nondeterminism.

#### R1–R5)
✅ Complete (see **Phase R progress** above).

---

### Phase S — Post-3D Follow-ups (S1–S4) ✅ IMPLEMENTED + ✅ TESTED
**Goal:** Ship the first “cinematic complete” experience after the renderer transition.

#### S1) Shoreline softening ✅ COMPLETE
- BFS distance-field basin profile in terrain geometry.
- Sand/mud underwater splat + wet-sand shoreline band.
- Water depth derived from `aBed` for colour/alpha/foam.

#### S2) Legacy HUD retirement ✅ COMPLETE
- Deck-only management UI; legacy full-screen modals removed.
- Flags and tests updated accordingly.

#### S3) Living weather ✅ COMPLETE
- Smoothed storm factor + gusts.
- Water/terrain wetness and rain rings.
- 3D rain splashes on hard surfaces.

#### S4) Species roster filters ✅ COMPLETE
- Search + family-class chips + tier chips.
- Locked species never leak identity.
- Added test `tests/species_filters_test.py`.

---

### Phase T — Verification Sweep (post S) ✅ COMPLETE (iteration_29: 177/178 automated + manual 3D/storm/shoreline checks; the two LOW findings — roster strip 43.8% > 40% and Esc-in-search closing the drawer — were fixed and re-verified: species_filters_test 9/9, ops_deck_native_test 17/17)
**Goal:** Prove everything stays green after the HUD retirement + living weather + shoreline changes.

**Planned deliverables:**
1) Run a **full testing-agent sweep** (frontend + backend).
2) Confirm **all suites** still pass:
   - `tests/render3d_test.py`, `tests/species_filters_test.py`
   - core interaction suites (gamefeel, input UX, placement, fence drag, tension, photo)
   - ops deck suites (`ops_deck_test.py`, `ops_deck_native_test.py`, phase_mn manual)
   - backend suites (API + regression)
3) Fix any regressions and re-run the sweep.

---

## 3) Next Actions (backlog — pick with the user)
2. **Phase R polish (P0.5)** — performance confidence + high-tier reference shots across day/night/storm.
3. **Photo Album (P1)** — persist captured photos + in-game gallery with re-download.
4. **Pairing Planner (P1)** — projected inbreeding for two picked creatures; recommended pairings in the ledger.
5. **Ambient Mix sliders / Keeper Voices (P2)**.
6. **Hybrid / interbreeding sprites (P3)** — parked.

---

## 4) Success Criteria
- **Core fantasy works:** player starts ignorant, observes, discovers, adapts habitat, profits.
- **Deterministic + stable:** fixed-timestep sim; save/load reproduces park reliably.
- **Unknown biology enforced:** UI cannot infer undiscovered traits.
- **No fake systems:** every UI metric corresponds to actual sim causes.
- **Explainability:** welfare/satisfaction/finances/containment risk have breakdowns.
- **Code quality restored:** no known Code Quality Analysis findings outstanding.

**Delivered milestones (verified):**
- Phase E (iteration_18), Phase F (iteration_19), Phase G (iteration_20), Phase H (iteration_21), stabilisation (iteration_22), remediation (iteration_23).
- Ops Deck Step 1 (iteration_24), Phase L (iteration_25), Phase M+N (iteration_26), Phase O (iteration_27).
- Phase R regression sweep (iteration_28).
- Phase S (S1–S4) implemented + locally verified by test runs listed above.

**Phase R acceptance (updated):**
- World viewport is fully 3D with realistic/cinematic PBR look, meeting `/app/design_guidelines_3d.md`.
- Camera is orthographic iso and **numerically aligned** with existing `worldPx` mapping.
- Input/picking/tool previews remain correct and unchanged.
- Sim/save format unchanged; deterministic tests still pass.
- WebGL fallback and `?classic=1` preserve the original 2D renderer and its tests.
- Performance target met (60fps @1080p on mid-range laptop GPU) with clear quality tiers.
- Photo mode captures WebGL + overlay correctly.
- Full regression suite remains green.
