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
- The game is feature-complete through **Phase 21**, and the post-Phase-19 code health + QoL + feel + polish passes are **complete and verified**.
- Top priority is **Phase G: Creature Art Rework** — redesign the creature visuals (all 19 species) to look sharper/crisper, more dynamic, and more threatening (predators), while preserving the deterministic sim.

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
  - **Edge scrolling is input/render layer only** and must not be triggered by HUD/toolbars/modals (target must be the canvas).
  - **Bloodline Ledger** is an **additive registry** (backwards compatible; safe on old saves).
  - **Keeper Radio Chatter** is **lightweight + rate-limited** and should not spam toasts.
- **Phase G constraints (hard):**
  - Creature art overhaul is a **render/art layer change**; do not change sim rules.
  - Keep old saves compatible.
  - Preserve the existing “unknown biology” readability: silhouettes must remain legible on dark terrain.

**Phase G scope confirmations (recent):**
- Animation depth: **RICH**
  - Target per species: **idle 6 frames** + **walk 8-frame gait** + **threat 4 frames** + **lunge/attack 4 frames**.
- Predator ambience: approved
  - **Faint eye-glow at night** (preferably via recorded eye rects)
  - **Crimson/darker shadow halo** when in threat/lunge display

**Status (high-level):**
- **Phase 1–21 COMPLETE & VERIFIED** (see testing baselines below).
- **Phase G (Creature Art Rework): ✅ COMPLETE & VERIFIED (iteration_20 = 100%)**. All 19 species repainted at scale 1 with idle 6 / walk 8 / threat 4 / lunge 4; predator eye-glow + crimson halo; species auras; portraits fit trimmed bounds at 2x backing.
  - Toolkits: `pixel.js` crisp primitives + `rig.js` anatomy helpers ✅
  - Species repaints:
    - `creatures_a.js` ✅ repainted
    - `creatures_b.js` ✅ repainted (also fixed a build-breaking syntax error at `creatures_b.js:306`)
    - `creatures_c.js` ❌ still legacy (Tier-4 apex set needs repaint)
  - Integration updates partially present:
    - `creatures.js` baker + `renderer.js` updated to support `threat` and per-sheet scale ✅ (but needs extension for lunge, 8-frame gait, menace glow/halo metadata)
    - `fx.js` has general FX (dust/prints) ✅ but still needs **species aura emitters**
- **Phase H — Assessment Fixes: ✅ COMPLETE & VERIFIED (iteration_21 = 100%)**: H1 fence-aware newborn placement, H2 load backfills, H3 ErrorBoundary + M3 load toast, H4 RNG cursor in state (exact replay), H5 per-player save scoping + indexes + pagination, .env.example/README/AETHERION_URL.
- **Project health:** ✅ **Green** (after the `creatures_b.js` syntax fix, build passes again).

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
- **iteration_19: post-Phase F (Phase 21) verification** (**testing_agent_v3 100% overall**; backend 19/19; frontend 28/28; integration 100%; regressions green).

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
(unchanged; complete and verified — see prior plan)

---

### Phase 3 — Stabilization + Proving Scenarios + Polish ✅ COMPLETE
(unchanged; complete and verified — see prior plan)

---

### Phase 4 — Fence UX Rework ✅ COMPLETE
(unchanged; complete and verified — see prior plan)

---

### Phase 5 — Feature Expansion: Rectangles + Security + Expeditions ✅ COMPLETE
(unchanged; complete and verified — see prior plan)

---

### Phase 6 — Immersion + Late Game Systems (Panic, Night Tours, Breeding, Abilities) ✅ COMPLETE
(unchanged; complete and verified — see prior plan)

---

### Phase 7 — Dedicated Visual Quality Pass (Pixel Art Cohesion) ✅ COMPLETE
(unchanged; complete and verified — see prior plan)

---

### Phase 8 — Keeper Staff ✅ COMPLETE
(unchanged; complete and verified — see prior plan)

---

### Phase 9 — Scenario Missions ✅ COMPLETE
(unchanged; complete and verified — see prior plan)

---

### Phase 10 — Code Quality / Code Review Remediation ✅ COMPLETE (accepted)
(unchanged; complete and verified — see prior plan)

---

### Phase 11 — High-End Visual Asset Redesign Pass ✅ COMPLETE (fully verified)
(unchanged; complete and verified — see prior plan)

---

### Phase 12 — Apex-Class Species (Tier 4) ✅ COMPLETE (fully verified)
(unchanged; complete and verified — see prior plan)

---

### Phase 13 — Genetics & Breeding Lines ✅ COMPLETE (verified)
(unchanged; complete and verified — see prior plan)

---

### Phase 14 — Park Events Engine + Rival Rumbles ✅ COMPLETE (verified)
(unchanged; complete and verified — see prior plan)

---

### Phase 15 — Guest Interest System ✅ COMPLETE (verified)
(unchanged; complete and verified — see prior plan)

---

### Phase 16 — Attractions, Amenities & Transport (~30 buildings) ✅ COMPLETE (verified)
(unchanged; complete and verified — see prior plan)

---

### Phase 17 — Apex Scenario: “Sovereign Containment” (Nyxarr) ✅ COMPLETE (verified)
(unchanged; complete and verified — see prior plan)

---

### Phase 18 — Verification & Regression ✅ COMPLETE (Phases 13–17)
(unchanged; complete and verified — see prior plan)

---

### Phase 19 — Photo Mode ✅ COMPLETE (fully verified)
(unchanged; complete and verified — see prior plan)

---

### Phase A — Code Quality Completion & Re-Verification (post-Phase 19) ✅ COMPLETE (verified)
(unchanged; complete and verified — see prior plan)

---

### Phase B — Feature: Keeper Priorities (post-Phase 19) ✅ COMPLETE (verified)
(unchanged; complete and verified — see prior plan)

---

### Phase C — QoL: Staff Report Card + Input UX Improvements ✅ COMPLETE (verified)
(unchanged; complete and verified — see prior plan)

---

### Phase D — Game-Feel Pass (render-only polish) ✅ COMPLETE (verified)
(unchanged; complete and verified — see prior plan)

---

### Phase E (Phase 20) — Ambient Audio + Sovereign Bloodline + Creature Idle Life + Keeper Markers ✅ COMPLETE (verified)
(unchanged; complete and verified — see prior plan)

---

### Phase F (Phase 21) — Edge Scrolling + Bloodline Ledger + Keeper Radio Chatter ✅ COMPLETE (verified)
(unchanged; complete and verified — see prior plan)

---

### Phase G (Phase 22) — Creature Art Rework (Sharper, crisper, richly animated, more menacing) ✅ COMPLETE (verified: iteration_20 = 100%)
**Goal:** Rework **all 19 species sprites** so they are visibly different from the old art: sharper/crisper rendering, richer animation, stronger silhouettes; predators more threatening/maniacal; herbivores powerful/dynamic.

**High-level deliverables:**
1. **Pixel art tool upgrades** (`/app/frontend/src/game/art/pixel.js`) ✅ DONE
2. **Shared rig/anatomy helpers** (`/app/frontend/src/game/art/rig.js`) ✅ DONE
3. **Repaint all species** (`/app/frontend/src/game/art/creatures_a.js`, `_b.js`, `_c.js`) 🚧 IN PROGRESS
4. **Sheet pipeline** (`/app/frontend/src/game/art/creatures.js`) 🚧 IN PROGRESS
5. **Renderer integration** (`/app/frontend/src/game/renderer.js`) 🚧 IN PROGRESS
6. **Ambient creature auras + predator menace** (`/app/frontend/src/game/fx.js` + renderer touchpoints) ❌ NOT STARTED
7. **Verification**: gallery + tests + regressions + testing agent **iteration_20** ❌ NOT STARTED

#### Phase G1 — Pixel painter “crisp” toolkit ✅ COMPLETE
**Delivered:**
- Crisp primitives in `pixel.js`: `line`, `poly`, `wedge`, `band`, `eye` (records rects), `fang`, `claw`, `spike`, `rim`.
- Motion helpers: `stride()` (6-phase) and `breathe()`.
- Shared rig in `rig.js`: articulated `legs`, `tail`, `ridge`, `jaw`, `plates`, `stripes`.

**Acceptance:** achieved; existing art still bakes; new painters use the helpers.

#### Phase G2 — Repaint all 19 species with richer animation 🚧 IN PROGRESS
**Target frame counts (final):**
- `idleFrames: 6`
- `walkFrames: 8` (rich gait cycle)
- `threatFrames: 4`
- `lungeFrames: 4` (attack burst / predatory pounce / charge)

**Completed:**
- `creatures_a.js` repainted (Phase G style) ✅
- `creatures_b.js` repainted (Phase G style) ✅
  - Build issue fixed: `creatures_b.js:306` syntax error ✅

**Remaining:**
- **G2c:** repaint `creatures_c.js` (nyxarr, zephyrmaw, aurox, sylvarr) to Phase G style at `scale: 1` with `idle/walk/threat/lunge`.
- **G2-rich:** bump all repainted species to **8-frame walk**:
  - Ensure `stride()` defaults/uses `frames: 8` for walk.
  - Fix any per-frame arrays indexed by `f` that assume 6 frames (notably the current walk-indexed arrays like `veyra`’s `bob` and `umbra`’s `wf` mapping).
- **G2-lunge:** implement `paint(P,f,'lunge')` per species:
  - Predators: forward head snap, jaw open, forelimb extension.
  - Herbivores: power shove/charge, hoof-stomp, horn sweep.
  - Neutral/floaters: burst pulse or aggressive flare.
- **Anti-clipping:** pad bake canvas (or per-mode bounds) so tall spikes / threat raises / lunges do not clip.

**Acceptance:** all species render with new crisp style; predators are visibly menacing; herbivores look assertive/powerful; silhouettes read at night.

#### Phase G3 — Sheet baking pipeline: add lunge + eye metadata + padding 🚧 IN PROGRESS
**Files:** `/app/frontend/src/game/art/creatures.js`

**Required changes:**
- Bake modes: `idle`, `walk`, `threat`, **`lunge`**.
- Blink generation:
  - Prefer recorded eye rects from `P.eye()`.
  - Maintain fallback heuristic for any unrecorded species.
- Record eye rects **per frame per mode**:
  - Store `sheet.eyesBy = { idle: [...], walk: [...], threat: [...], lunge: [...] }` (or equivalent).
- Add bake padding support:
  - Either inflate painter canvas by `pad` per mode and record draw offsets, or add a standardized internal margin.
- Pass metadata needed by renderer/fx:
  - `sheet.pace` (cadence tuning by species)
  - `sheet.menace` (predator menace settings)
  - `sheet.aura` (already in some A/B species)

**Acceptance:** `getCreatureSheet(id)` returns `{ idle, walk, threat, lunge, blink, scale, shadow, hover, aura, eyesBy, pace, menace }` without errors for all 19.

#### Phase G4 — Renderer integration: lunge bursts, cadence by pace, menace glow/halo 🚧 IN PROGRESS
**Files:** `/app/frontend/src/game/renderer.js`

**Required changes:**
- Frame selection:
  - Add `lunge` selection above `threat` when conditions hit.
  - Proposed trigger (render-only; no sim changes):
    - escaped + high stress OR
    - hungry/flee + stationary burst OR
    - recent feeding (if available) OR
    - periodic “display burst” while threat is active.
- Cadence:
  - Tune cadence per mode (walk faster than idle; lunge fastest) and allow per-species overrides.
- Menace:
  - **Night eye-glow** for predators using exact eye rects (`sheet.eyesBy`) to paint glow pixels cleanly.
  - **Crimson/darker shadow halo** when `threat` or `lunge` selected.
- Pixel crispness:
  - Preserve integer snapping of sprite origin.

**Acceptance:** lunge/threat appear at the right times; sprites remain crisp; no regressions in selection/shadows.

#### Phase G5 — Creature ambience: per-species auras + predator menace FX ❌ NOT STARTED
**Files:** `/app/frontend/src/game/fx.js` (and minimal call site wiring)

**Required changes:**
- Add render-only aura emitters driven by `sheet.aura`:
  - embers (emberoot/rhoak)
  - spores (mosswarden)
  - sparks (voltari)
  - motes (skitter/shardling)
  - wisps (umbra)
  - glints (crystal)
- Night gating and reduced-motion support.
- Cap emissions to avoid perf spikes.

**Acceptance:** subtle ambience, no sim changes, respects reduced-motion.

#### Phase G6 — Testing + verification ❌ NOT STARTED
**Gallery:**
- Update `art_gallery.py` to render **5 rows**: `idle / walk / threat / lunge / blink`.
- Capture day/night screenshots for A/B/C sets.

**Add tests:**
- New: `/app/tests/creature_art_test.py`
  - All 19 sheets bake
  - Frame counts match: idle 6, walk 8, threat 4, lunge 4
  - Blink frames present (recorded eyes preferred)
  - Threat/lunge differ from idle (pixel diff threshold)
  - No page errors
- Update existing tests:
  - `phase20_features_test.py` “IDLE 1 blink frames auto-derived” diff-range may need widening due to exact eye-rect blink shading and increased sprite detail.

**Verification sequence:**
1. Local: `python -m pytest -q tests/creature_art_test.py` + smoke/regressions
2. Visual: run `python tests/art_gallery.py a|b|c`, inspect screenshots
3. Run `testing_agent_v3` → **iteration_20**

---

### Phase H — Assessment Fixes (local verification + correctness + hardening) ✅ COMPLETE (verified: iteration_21 = 100%; assessment_fixes_test 25/25)
**Goal:** convert “green on Emergent” into “verifiable locally”, fix correctness edge cases, and harden save/load and backend scope.

> User decision: **do Phase H after Phase G**, but start the backend per-player token work immediately once Phase H begins.

#### Phase H0 — Dev ergonomics + local run parity
**Deliverables:**
- Add:
  - `frontend/.env.example` with `REACT_APP_BACKEND_URL=http://localhost:8001`
  - `backend/.env.example` with `MONGO_URL` and `DB_NAME`
  - A short `README.md` with the three run commands (frontend, backend, mongodb docker)
- Parametrize all hard-coded test URLs through one env var:
  - Use `AETHERION_URL` (fallback to preview URL)
  - Update all impacted test files (currently 27)
- Ensure tests never touch Emergent DB during local runs (document docker mongo).

#### Phase H1 — Newborn spawn correctness (fence boundary)
**Issue:** `adjacentOpenTile()` in `frontend/src/game/creatures.js` does not check `fenceBetween()`.
- Fix: when picking an adjacent tile, reject tiles across fences.
- Add test: breeding on a boundary tile must not place newborn outside enclosure.

#### Phase H2 — Deserialize defensive backfills
**Issue:** `frontend/src/game/state.js` `deserialize()` lacks knowledge backfill from `SPECIES_LIST`.
- Fix: on load, ensure `state.knowledge[sp.id]` exists for every species.
- Add defensive filtering:
  - unknown `research.completed` ids should be filtered out (or ignored safely)
  - unknown building types should be filtered or replaced with safe defaults

#### Phase H3 / M3 — Error boundary + load error toast
- Add React error boundary around the game screen.
- Add load/save try/catch path with a user-facing toast on failure.

#### Phase H4 — Determinism (seeded LCG state)
**Issue:** `rnd()` LCG `seedCounter` is module-level in `frontend/src/game/state.js`, not stored in state, not reset on `newGame`, not restored on `loadGame`.
- Fix:
  - Put seed into state (e.g., `state.rng = { seed, counter }`)
  - Reset LCG in `newGame` / scenario init
  - Restore LCG on load
- Add determinism tests:
  - Hash serialized state at fixed tick across two loads
  - Replay a save for N ticks twice and compare hashes

#### Phase H5 — Backend hardening + per-player token
**User-approved:** add per-player token now (when Phase H starts).
- Generate random UUID in localStorage.
- Send as `X-Player-Token` header on save CRUD.
- Store on save document as owner token.
- Compatibility rule: legacy saves with no owner remain visible to everyone.
- Add index on save `id`.
- Consider list cap raise or pagination.
- Add separate DB_NAME for tests (doc + optional env default).

**Deferred (measure-first):**
- Renderer culling and dirty-rect terrain repaint.
- Balance items (cooldowns, difficulty tuning) until humans play.

---

## 3) Next Actions (backlog — pick with the user)
1. **Photo Album (P1)** — persist captured photos + in-game gallery with re-download.
2. **Pairing Planner (P1)** — projected inbreeding for two picked creatures; recommended pairings in the ledger.
3. **World-seed picker (P2)** — surface `createNewGame({ seed })` on the new-game screen (plumbing done in Phase H).
4. **Ambient Mix / Keeper Voices (P2)**, popover outside-click dismissal (P2).
5. **Deferred from the assessment (measure first)** — renderer culling / dirty-rect terrain; balance items after human playtests.

---

## 4) Success Criteria
- **Core fantasy works:** player starts ignorant, observes, discovers, adapts habitat, profits.
- **Deterministic + stable:** fixed-timestep sim; save/load reproduces park reliably.
- **Unknown biology enforced:** UI cannot infer undiscovered traits.
- **No fake systems:** every UI metric corresponds to actual sim causes.
- **Explainability:** welfare/satisfaction/finances/containment risk have breakdowns.
- **Code quality restored:** no known Code Quality Analysis findings outstanding; tests reflect correct semantics; art API is maintainable.
- **Keeper Priorities delivered:** per-keeper enclosure assignment with **flexible prioritization**, persisted via save/load.
- **Staff report cards delivered:** per-cycle per-staff tallies that reset at daily rollover.
- **Modern input UX delivered:** drag-pan, right-click cancel/clear, with toolbar sync and preserved workflows.
- **Game-feel delivered (render-only):** eased zoom, pan inertia, breach shake, placement pop + dust — with reduced-motion support.
- **Phase E delivered (verified):** ambient audio, Sovereign Bloodline, idle life, keeper markers.
- **Phase F delivered (verified):** edge scrolling, bloodline ledger, keeper radio.
- **Phase G delivered (to be verified):**
  - All 19 species repainted with crisper, sharper silhouette.
  - Rich animation: **idle 6 + walk 8 + threat 4 + lunge 4**.
  - Predators visibly menacing; herbivores powerful/dynamic.
  - Predator menace: eye-glow at night + threat/lunge halo.
  - Aura ambience implemented (render-only) for selected species.
  - No regressions; **iteration_20 passes**.
- **Phase H delivered (to be verified):**
  - Local run parity docs + env examples
  - Tests use `AETHERION_URL`
  - H1/H2/H4 correctness fixed and covered by tests
  - Error boundary + load error toast
  - Backend save scoping via per-player token (legacy compatible)

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
- Phase E acceptance: ✅ met (iteration_18 = 100%).
- Phase F acceptance: ✅ met (iteration_19 = 100%).

**Next verification to produce:**
- **iteration_20: post-Phase G verification** ✅ (**testing_agent_v3 100% overall**; backend 12/12; creature_art 17/17; phase20 39/39; phase21 28/28; visual/sovereign/gamefeel/smoke green; perf within budget).
- **iteration_21: post-Phase H verification** ✅ (**testing_agent_v3 100%**; backend 12/12; assessment_fixes 25/25; creature_art 17/17; keeper/gamefeel/phase17/phase20/phase21/input_ux green. phase21 LEDGER 7 was made data-independent — the ledger itself was correct).
- **Next:** iteration_22 after the next feature phase.
