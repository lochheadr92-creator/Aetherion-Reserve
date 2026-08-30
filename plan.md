# plan.md (Updated)

## 1) Objectives
- Deliver a complete **First Playable** desktop creature-containment/park-management game (**React + Canvas isometric**, **FastAPI**, **MongoDB save slots**).
- Prove the **core fantasy** end-to-end:
  - Deterministic sim (fixed timestep) decoupled from render
  - Terrain sculpt/paint/water/veg with undo + costs
  - Fences/gates/enclosure detection
  - Creature AI/needs + pathfinding constraints
  - **Unknown biology** discovered through observation (hypotheses → breakthroughs)
  - Guests + viewing tension + economy + research
- Ensure **explainability** (why numbers change) and **overlays** (habitat/visibility/view ranges/power).
- Keep systems real (no dead UI), data-driven (species/buildings/research), and **save/load reproduces authoritative state**.

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

### Phase 3 — Stabilization + Proving Scenarios + Polish 🔄 IN PROGRESS
**Goal:** ensure causal correctness, explainability, robustness, and fun first 5–10 minutes.

1. **Automated proving scenarios** (implement as scripts + manual checklist):
   - Terrain modification persists through save/reload.
   - Rocky/cliff species dissatisfied on flat grassland → improves with elevation/rock.
   - Semi-aquatic species unsatisfied with drinking-only water; deep-water requirement verified.
   - Unknown species reveals preference via behaviour; discoveries update Species DB.
   - Compatible cohabitation stable; incompatible cohabitation causes stress with readable explanation.
   - Social species alone → welfare drops; add group → welfare recovers.
   - Viewing visibility responds to distance/cover; guests react.
   - Guest needs (food/drink/restroom) affect satisfaction and spending with reasons.
   - Bad park loses money; good park profits; ticket price impacts guest rate.
   - Save/load preserves entire park + discoveries.
2. Tighten AI state transitions and reduce micromanagement:
   - Ensure evidence events are frequent enough (but not trivial) across species.
   - Remove any remaining “dead ends” (e.g., guests stuck when paths disconnected).
3. Expand overlays/tooltips:
   - Ensure every key number has a breakdown (welfare, satisfaction, finances, security).
4. Edge-case robustness:
   - Placement snapping and recovery from invalid placements.
   - Terrain edit blocking reasons, fence/enclosure edge correctness on slopes.
5. Visual identity polish (Night-Lab OS):
   - Final pass on readability, panel density, discovery toast treatment.
6. Performance profiling:
   - Target: 100+ creatures, 500–2,000 guests visible; introduce guest LOD/aggregation if needed.

**End of Phase 3:** run testing agent + fix loop until all proving scenarios pass.

---

### Phase 4 — Post-v1 Expansion (after delivery)
- Escapes/emergencies depth: readable failure causes + response units.
- Expeditions depth: multi-step field ops, timelines, outcomes.
- Contracts beyond tutorial directives.
- Weather/incidents, staff entities.
- Additional overlays (guest heatmaps), accessibility improvements (key rebinding), content packs via data pipeline.

## 3) Next Actions (immediate)
1. Run **testing_agent_v3** for a comprehensive end-to-end pass across proving scenarios.
2. Convert remaining proving scenarios into Playwright scripts (extend /app/tests) where feasible.
3. Fix-loop on any failures found (AI stuck states, placement edge cases, discovery pacing, UI clarity).
4. Performance check at higher scales (spawn stress test: 100 creatures / 1000 guests).
5. Final UX pass: tooltips, masked unknown wording, early onboarding friction.

## 4) Success Criteria
- **Core fantasy works:** player starts ignorant, observes, discovers, adapts habitat, profits.
- **Deterministic + stable:** fixed-timestep sim; save/load reproduces park reliably.
- **Unknown biology enforced:** UI cannot infer undiscovered traits (including from habitat cause text).
- **No fake systems:** every UI metric corresponds to actual sim causes.
- **Explainability:** welfare/satisfaction/finances/containment risk have breakdowns + recent-cause reasoning.
- **Performance:** smooth at target scale; creatures get richest sim budget; guests simplified if needed.
- **First 10 minutes fun:** build first enclosure, acquire first creature, see a discovery, guests react, money moves—without friction.
