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

**Ops Deck constraints (hard):**
- ART_V2 and OPS_DECK are **behind flags** and must be removable.
- **OPS_DECK defaults ON**; `?legacyHud=1` and `localStorage['aetherion.opsDeck']='off'` force legacy.
- **Legacy mode DOM baseline must stay identical** (as applicable); re-record `tests/ops_deck_dom_baseline.json` only if intentionally changing permanent legacy DOM.
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

**Phase R progress:**
- **R1 Foundation: ✅ IMPLEMENTED (rendering and debugged)**
  - Three.js WebGL pipeline in place (`/app/frontend/src/game/three/*`).
  - Camera lock math implemented (`iso.js`) and integrated.
  - Terrain heightfield + splat PBR shader implemented (`terrain.js`).
  - Water merged mesh + shader implemented (`water.js`).
  - Lighting rig + day/night + storm implemented (`lighting.js`).
  - Post stack implemented (`post.js`).
  - Hybrid stacked canvases implemented (`GameCanvas.jsx`): WebGL behind, 2D overlay above.
  - WebGL software-renderer (SwiftShader/llvmpipe) fallback retained to keep Playwright stable.
  - AI texture generation pipeline implemented (`backend/tools/gen_textures.py`) and base texture pack exists under `frontend/public/textures/`.

- **R2 World completeness (flora/fences/paths/buildings/entrance/skirt): ✅ IMPLEMENTED & VISUALLY VERIFIED**
  - `materials.js`: PBR kit (material presets + tinting + emissive hooks), procedural alpha textures, wind uniforms + onBeforeCompile hooks, `Instances` helper.
  - `flora3d.js`: instanced trees (smooth jittered lobes + camera-facing foliage cards), shrubs, grass cards, reeds, spore pillars, aether fronds; vertex wind.
  - `fences3d.js`: T1 rails / T2 mesh / T3 plinth+mesh / T4 energy-field shader, gate hazard strip, damage tint + lean.
  - `buildings3d.js`: procedural kit per building type merged into material buckets; vertex-coloured emissive windows/signage that ramp at night; station pylons.
  - `props3d.js`: waste + entrance gate + transport guideway tubes and hanging cars.
  - Terrain skirt implemented in `terrain.js`; world background darkened for diorama void.

- **R3 Creatures: ✅ IMPLEMENTED & VISUALLY VERIFIED**
  - `creatures3d.js`: rigs for `quad/tall/winged/insect/amphib/crystal/blob/float/serpent`.
  - AI PBR skin materials; genes/morph tint; distress/injury desat; render-side velocity → gait; render-side heading; swimming/flight/rest/feed poses.

- **R4 People + transport + waste: ✅ IMPLEMENTED & VERIFIED**
  - `people3d.js`: 7 instanced humanoid parts for guests/staff/security + walk cycle.
  - Transport 3D: guideway + cars driven by `state.transport.cars`.
  - 2D `drawTransport` removed from the 3D render path (kept implicitly classic-only).

- **R5 Verification: ✅ COMPLETE (tests) + ⏳ CONTINUING (visual polish + perf confidence)**
  - Added `tests/render3d_test.py` (SwiftShader forced 3D) and it passes **22/22**.
  - Testing agent iteration_28: regression suites green after two fixes:
    - WebGL canvas now **unmounted in classic mode** to preserve legacy DOM baseline (ops deck tests).
    - render3d staging now steps **60 ticks** so transport pairing (every 50 ticks) is deterministic.

**Key fixes / technical notes (Phase R):**
- **TextureRegistry stand-in bug fixed:** `DataTexture` placeholders could not be swapped to `<img>`; replaced with canvas-backed `THREE.Texture` stand-ins → resolved “black materials”.
- **Environment reflections:** added `RoomEnvironment` PMREM env map for metals/glass.
- **Terrain border:** skirt mesh + darker void background.
- **Grass texture update:** regenerated to be lusher and then desaturated.
- **Water foam:** toned down to reduce “white ring” artifacts; shallow/deep colours retuned.

**Testing baselines:**
- iteration_5–19: all green milestones as recorded.
- iteration_20: Phase G verified.
- iteration_21: Phase H verified.
- iteration_22: stabilisation pass verified.
- iteration_23: remediation pass verified.
- **iteration_24: Ops Deck Step 1 verified (Phase J + K) — 100%**.
- **iteration_25: Phase L verified (L1–L4) + regressions — 100% (109/109)**.
- **iteration_26: Phase M (native drawer panels) + Phase N (QA pass) + 21 regression suites — 100% (289/289)**.
- **iteration_27: Phase O + full regressions — green**.
- **iteration_28: Phase R regression sweep — green**.

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
(unchanged; complete and verified; Phase G continuation moved to Phase L)

---

### Phase H — Assessment Fixes ✅ COMPLETE
(unchanged; complete and verified)

---

### Phase I — Remediation Pass ✅ COMPLETE
(unchanged; complete and verified; iteration_23 = 100%)

---

### Phase J — ART_V2 post-passes (cel ramp, rim light, ground AO/contact shadow, glow halo) behind flag (Ops Deck Step 1) ✅ COMPLETE & VERIFIED
(unchanged; complete and verified)

---

### Phase K — Ops Deck dock + drawer shell behind OPS_DECK flag (Ops Deck Step 1) ✅ COMPLETE & VERIFIED
(unchanged; complete and verified)

---

### Phase L — Phase G continuation backlog (render/UI only): Juveniles → Seed Picker → Live Portraits → Creature Voices ✅ COMPLETE & VERIFIED
(unchanged; complete and verified)

---

### Phase M — Ops Deck Step 2: Native Drawer Panels (Species DB + Bloodline Ledger focus) ✅ COMPLETE & VERIFIED
(unchanged; complete and verified)

---

### Phase N — Polish / QA Pass ✅ COMPLETE & VERIFIED
(unchanged; complete and verified)

---

### Phase O — CREATURE TENSION PASS — AGGRESSION, NEEDS DEGRADATION & ESCAPE ✅ COMPLETED & VERIFIED (iteration_27)
(unchanged; complete and verified)

---

### Phase R — CINEMATIC 3D WORLD (three.js/WebGL) ✅ IMPLEMENTED + ✅ TEST-VERIFIED + ⏳ POLISH/PERF
**Goal:** Replace the pixel-art Canvas2D world with a realistic/cinematic **true 3D** world renderer, while keeping gameplay/sim/save/input/picking math unchanged.

#### R0) Hard constraints (non-negotiable)
- **Visuals only**: no sim rule changes, no save format changes, no input semantics changes.
- **Isometric camera lock** (orthographic, yaw 45°, pitch 30°). Zoom/pan identical.
- **Picking math unchanged**: the existing 2D picking stays authoritative.
- **Fallback-safe**: if WebGL is unavailable, or `?classic=1`, game uses the legacy 2D renderer unchanged.
- **Stability**: preserve `window.__gameRenderer` API used by tests and HUD.
- **Determinism**: no `Math.random()` in sim; render-side variation may use hash-seeded jitter from tile/entity ids.
- UI guidelines remain: `/app/design_guidelines.md` unchanged.

#### R1) Foundation — renderer architecture + camera lock + core terrain/water/lighting/post ✅ COMPLETE
**Delivered:**
1) Hybrid stacked canvas architecture (`GameCanvas.jsx`) with WebGL behind and 2D overlay kept authoritative for input/picking and all HUD markers.
2) Camera-lock orthographic iso (`iso.js`), wired into world sync.
3) Terrain heightfield + PBR splat blending (`terrain.js`).
4) Water merged plane + shader (`water.js`).
5) Lighting rig with day/night/storm (`lighting.js`).
6) Post stack AO/Bloom/grade/AA (`post.js`) with quality tiers.
7) Offline texture pipeline (`backend/tools/gen_textures.py`) and initial texture set under `frontend/public/textures/`.
8) Headless/VM software renderer detection with classic fallback preserved.

#### R2) World completeness — flora/fences/paths/buildings/entrance + terrain edge skirt ✅ COMPLETE
**Delivered:**
- `materials.js`, `flora3d.js`, `fences3d.js`, `buildings3d.js`, `props3d.js` + terrain skirt.
- Dark void background for diorama edge.
- Environment PMREM (`RoomEnvironment`) for reflections.

#### R3) Creatures — procedural rigs, skins, animation, genes ✅ COMPLETE
**Delivered:**
- Procedural rigs by `species.bodyType`.
- PBR skins + genes/morph tint.
- State-driven animation and render-derived heading.

#### R4) People + transport + remaining props ✅ COMPLETE
**Delivered:**
- Guests/staff/security instancing.
- 3D transport guideways + hanging cars.
- Waste + entrance props.

#### R5) Verification — automated 3D checks + regressions ✅ COMPLETE
**Delivered:**
- `tests/render3d_test.py` = **22/22**.
- Legacy DOM baseline preserved by unmounting the 3D canvas in classic mode.
- Ops Deck DOM baseline test is green again.

#### R6) Polish / performance confidence (P0.5) ⏳ NEXT
**Goal:** Move from “working + verified” to “cinematic, consistent, and shippable”.

**Planned deliverables:**
1) **High-tier visual smoke**
   - Run `_dbg_quality.py` and `_dbg_3d.py` for `low/medium/high` at day/night/storm and capture reference frames.
   - Ensure post stack (AO/bloom/grade) behaves as intended across tiers.
2) **Water + shoreline refinement**
   - Reduce remaining shoreline artifacts (foam banding / depth tile edge visibility) without changing sim.
3) **Creature rig polish**
   - Address remaining seam/pose artifacts (e.g. tall neck join) and improve silhouette readability at zoomed-out levels.
4) **Ground micro-detail**
   - Optional: improve grass card texture + density heuristics at medium/high quality.
   - Optional: add subtle path-edge curb/trim instancing if readability is insufficient.
5) **Performance sanity pass**
   - Confirm draw-call budgets for typical parks.
   - Ensure merged building meshes and instanced layers stay stable.

#### Phase R risks / notes
- Headless Chromium uses SwiftShader: WebGL slow and visually variant; tests must avoid fragile pixel hashes.
- Existing pixel-art tests must remain green as long as classic renderer exists.
- Never introduce sim nondeterminism; render variation must be deterministic via hashes or local visuals only.
- Camera lock must remain exact enough that overlay picking/markers align.

---

## 3) Next Actions (backlog — pick with the user)
1. **Phase R (P0)** — Cinematic 3D World (true 3D renderer, realistic/cinematic, whole world scope, visuals-only constraint).
2. **Phase R (P0.5)** — 3D polish + performance confidence (R6).
3. **Species Roster Filters (P1)** — search box + family/tier filter chips in Species Database.
4. **Retire Legacy HUD (P1)** — turn off old full-screen modal paths completely.
5. **Photo Album (P1)** — persist captured photos + in-game gallery with re-download.
6. **Pairing Planner (P1)** — projected inbreeding for two picked creatures; recommended pairings in the ledger.
7. **Ambient Mix sliders / Keeper Voices (P2)**.
8. **Hybrid / interbreeding sprites (P3)** — new sprite logic/art for interbreeding outcomes (parked; requires a separate spec).

---

## 4) Success Criteria
- **Core fantasy works:** player starts ignorant, observes, discovers, adapts habitat, profits.
- **Deterministic + stable:** fixed-timestep sim; save/load reproduces park reliably.
- **Unknown biology enforced:** UI cannot infer undiscovered traits.
- **No fake systems:** every UI metric corresponds to actual sim causes.
- **Explainability:** welfare/satisfaction/finances/containment risk have breakdowns.
- **Code quality restored:** no known Code Quality Analysis findings outstanding; tests reflect correct semantics; art API is maintainable.

**Delivered milestones (verified):**
- Phase E (iteration_18), Phase F (iteration_19), Phase G (iteration_20), Phase H (iteration_21), stabilisation (iteration_22), remediation (iteration_23).
- **Ops Deck Step 1: Phase J + Phase K (iteration_24 = 100%)**.
- **Phase L (juveniles/seed picker/live portraits/voices): iteration_25 = 100% (109/109)**.
- **Phase M+N (native drawer panels + QA): iteration_26 = 100% (289/289)**.
- **Phase O (Creature Tension Pass): iteration_27 = green**.
- **Phase R regression sweep: iteration_28 = green**.

**Phase R acceptance (updated):**
- World viewport is fully 3D with realistic/cinematic PBR look, meeting `/app/design_guidelines_3d.md`.
- Camera is orthographic iso and **numerically aligned** with existing `worldPx` mapping.
- Input/picking/tool previews remain correct and unchanged.
- Sim/save format unchanged; deterministic tests still pass.
- WebGL fallback and `?classic=1` preserve the original 2D renderer and its tests.
- Performance target met (60fps @1080p on mid-range laptop GPU) with clear quality tiers.
- Photo mode captures WebGL + overlay correctly.
- Full regression suite remains green.
