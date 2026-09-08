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
- **Phase O — CREATURE TENSION PASS — AGGRESSION, NEEDS DEGRADATION & ESCAPE**
  - Introduce the core danger loop using **existing** creature substrate (stress/health/welfare/fence damage/security/staff), not a parallel system.
  - Focus areas:
    1. Needs degradation → stress escalation → health decline → distress → death (neglect can kill)
    2. Aggression + incompatibility conflicts (minor/serious/fatal), using existing biology data (danger/social/compat)
    3. Containment breach driven by stress + degraded containment; breach **destroys a fence segment** (physical gap)
    4. Keeper relevance: assigned keepers slow degradation and provide warning/radio; response posts intervene
    5. Player feedback: minimal, critical UI/renderer signals + alerts

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

**Phase O confirmations (this conversation):**
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

**Testing baselines:**
- iteration_5–19: all green milestones as recorded.
- iteration_20: Phase G verified.
- iteration_21: Phase H verified.
- iteration_22: stabilisation pass verified.
- iteration_23: remediation pass verified.
- **iteration_24: Ops Deck Step 1 verified (Phase J + K) — 100%**.
- **iteration_25: Phase L verified (L1–L4) + regressions — 100% (109/109)**.
- **iteration_26: Phase M (native drawer panels) + Phase N (QA pass) + 21 regression suites — 100% (289/289)**.

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

### Phase O — CREATURE TENSION PASS — AGGRESSION, NEEDS DEGRADATION & ESCAPE ✅ IMPLEMENTED — verification via iteration_27 (In Progress)
**Status log:**
- O1 core sim (tensionProfile.js + creatures.js degradation/health/death) — DONE
- O2 aggression (tension.js conflictTick, graduated outcomes, knowledge confirmation, response intervention) — DONE
- O3 breach (breachTick, performBreach → destroyFence + state.gaps, holding, warden rebuild, gap lifecycle) — DONE
- O4 keeper relevance (keeperMult, passive relief, radioEvent stress/conflict/breach) — DONE
- O5 feedback — DONE: renderer tint/gap markers/distress chevrons/shake+siren; CreaturePanel health bar + condition badge; EnclosurePanel TENSION section (status, mean stress, counters, INCOMPATIBLE SPECIES / OVERCROWDED / BREACH RISK / NO KEEPER warnings) + BREACHED banner with gap locate + CONTAINMENT LOST view; EmergencyBanner gap chips + gaps-only PERIMETER OPEN variant; BloodlineLedger DECEASED.
- O6 dev harness (`window.__game.dev`: fenceRect/addCreature/offspring/kill/spawnBuilding/hireStaff/assignStaff/enclosureAt/enclosures/damageFence/grant/flatten/watchAlerts) + `tests/tension_test.py` (48/48 locally) — DONE
- Fixes found by local regression: `stats.deaths` now initialised in createNewGame (deserialize backfill made continue≠load hashes differ → determinism_test B). `gapsFor` made geometric (region ids renumber after fence edits; stored encId is history only).
- Local regression so far: phase5 19/19, keeper_priorities, phase8_staff, determinism 8/8, phase20 39/39, phase21 28/28.
- NEXT: testing agent iteration_27 → PRD/plan final update → commit.
**Goal:** Make the park feel alive and consequential via a deterministic, explainable danger loop. Must use existing creature stats and systems (stress/health/welfare, fences, security posts, staff), not a parallel system.

**Hard constraints:**
- **Do not change species data, art, or UI layout** unless a new UI element is strictly required.
- No nondeterminism; no new dependencies.
- Save compatibility: additive state only with safe defaults.
- Maintain unknown-biology gating: do not leak undiscovered needs through new UI text.

**Existing substrate to build on (must not duplicate):**
- `creatures.js`: `updateNeeds`, `updateWelfare` (stress from welfare), `cohabTick` (hostility stress + knowledge), `fencePressure` (stress damages fences), escape detection + alert.
- `construction.js`: `damageFence` deletes a segment on hp≤0 and increments `stats.breaches`.
- `security.js`: rapid response posts/units + capture loop.
- `staff.js`: keeper/biomedical/warden tasks, repair tick, and batched radio chatter.
- `rivalry.js`: apex neighbour rivalries.
- `guests.js`: panic when dangerous escapes exist.
- `renderer.js`: escaped ring + agitated/lunge animation hooks.
- `audio.js`: alert stingers keyed by alert type.
- `EnclosurePanel.jsx`: knownPairs compatibility view (knowledge-gated).
- `CreaturePanel.jsx`: stress/welfare/needs bars exist (no health bar yet).

#### O1) Core sim: tension module + deterministic hooks (no new parallel state)
**Approach:** Introduce a single new module `frontend/src/game/tension.js` and call it from the existing sim cadence (preferably folded into the same tick schedule as welfare/pressure/cohab), keeping creature state changes in-place.

**Data additions (additive; defaults safe):**
- Creature:
  - `c._healthWarn` (0/1/2) for escalating warnings per episode
  - `c._breachWarned` (bool) early risk warning throttling
  - `c._aggrCd`, `c._conflictCd` cooldowns
  - `c.injuredAt` or `c.injured` (tick timestamp) for UI + medical priority
- State:
  - `state.tension` = { incidents: [], encCooldown: {}, lastAlertAt: {} } (optional caches)
  - `state.gaps` (see O3) — registry of breached fence segments (additive)
  - `state.stats.deaths`, `state.stats.deathsBySpecies`, `state.stats.conflicts`, `state.stats.breachEvents`, `state.stats.fatalConflicts`
- Lineage:
  - Extend statuses to include `deceased` (via existing `markLineageLeft`)

**Degradation model (build on updateWelfare semantics, not parallel):**
- `tensionProfile(sp)` → `degradeMult = (0.6 + danger*0.16) * (0.85 + (tier-1)*0.1)`
- Fast channel: hunger/thirst deficits → stress increase per welfare check
- Slow channel: habitat/social comfort deficits → slower stress increase
- Keepers assigned to enclosure reduce escalation: `keeperMult = 0.55` + passive stress relief per assigned keeper (cap 2)
- Health loss:
  - high stress (>0.8) drains health
  - starvation (hunger or thirst ≤0.02) drains health
  - recovery only when stress<0.6
  - **remove existing health floor**; allow `health → 0`
- Escalating warnings (throttled per episode):
  - health < 0.6 → warning alert (`HEALTH DECLINING`)
  - health < 0.3 → danger alert (`CRITICAL CONDITION`)
  - stress crossing 0.6 upward triggers a keeper radio callout (if assigned keeper exists)
- Death:
  - `killCreature(state, c, cause)` → `removeCreature(state, c.id, 'deceased')`
  - stats increment; major park rating hit; alert (`ORGANISM LOST`); park event; logCause

#### O2) Aggression: conflict triggers + graduated outcomes
**Tick cadence:** `conflictTick` every ~90 ticks; cap conflicts to 1 per call; per-enclosure cooldown 300; per-creature aggressor cooldown 600.

**Triggers (existing species biology; deterministic):**
- Incompatible species: compat prey/hostile + danger differential
- Overcrowding: sameSpecies > `social.max`
- High stress eligibility: stress ≥ 0.75
- Dominance: same species, tier ≥ 3, adults, occasional
- Juveniles never aggressors

**Outcomes:**
- Minor: stress spike + brief separation behaviour (flee within enclosure)
- Serious: injury (health loss + injured flag), stress spike, incident registered
- Fatal: calls `killCreature` (only when victim weakened OR apex predation)

**Response integration:**
- Serious conflicts register an incident consumed by rapid response posts:
  - if a post within radius, dispatch a unit to pen → separates animals (stress reduction + forced separation move)
  - biomedical staff then naturally prioritises injured due to expanded medical criteria (health<0.8 or injured flag)

#### O3) Breach: stress + degraded containment causes a physical gap
**Eligibility:**
- stress ≥ 0.7 AND weakest boundary segment HP ratio < threshold that scales with danger, OR boundary tier under species requirement
- Nearby security post reduces probability / reduces time-to-response
- First eligibility triggers early warning alert (`BREACH RISK`) once per episode

**On breach event:**
- Determine weakest boundary segment and **destroy it** (delete `state.fences[key]` via `damageFence` or direct deletion for breach event)
- Register the gap: `state.gaps[key] = { tier, tick, encId }`
- Place creature outside through that gap; mark escaped; guests panic (existing)
- Fire distinctive alert (`CONTAINMENT BREACH`) and a new stinger `breach` (siren-like) if audio enabled

**Capture outcomes:**
- `security.resolveCapture`:
  - if home enclosure remains open/unavailable: creature goes to **HOLDING** at the post (`c.held=postId`, `c.state='held'`, `escaped=false`)
  - securityTick releases held creatures when pen is closed again
  - capture alert includes health percent

**Gap lifecycle / repair:**
- Player placing a fence at the key clears `state.gaps[key]`
- Wardens gain a rebuild task for gaps (spend fence cost) if allowed; fixing a gap restores full hp
- Enclosure remains marked breached until gaps repaired

#### O4) Keeper relevance and player feedback wiring
- Assigned keepers:
  - slow degradation, reduce stress, call out stress/conflict/breach via radio chatter (new lines, same batched system)
- Rapid response posts:
  - already recapture escapes; now also respond to serious in-pen incidents

#### O5) UI / Feedback (minimal, additive)
**Renderer (canvas):**
- Distress marker over distressed/injured creatures (pulsing chevron or ring)
- Subtle stress tint overlay on enclosures with mean stress > 0.6
- Gap markers (red dashed) for breached fence segments

**CreaturePanel:**
- Add Health bar (`data-testid="creature-health"`)
- Add condition badge (`data-testid="creature-condition"`) = INJURED / CRITICAL / STABLE

**EnclosurePanel:**
- Add `TensionSection`:
  - mean stress + warnings
  - incompatible mixes warning (only what the sim knows + safe public heuristics)
  - overcrowding warning (only if `social` discovered; otherwise generic masked cause)
  - breach-risk residents
  - assigned keepers count
- If breached: show `BREACHED` state and list gaps with locate action

**BloodlineLedger:**
- Extend STATUS_META to include `deceased` label (DECEASED) and colour

#### O6) Balance targets
- T1 species forgiving; T3+ predators degrade faster
- With assigned keepers + good habitat + compatible mixes: stable
- Neglect death pacing: gradual, warnings first, fatality is late punishment
- Conflicts rate-limited and fatal only when plausible

#### O7) Deterministic tests + regression safety
**New tests:**
- `tests/tension_test.py` (new): deterministic scenarios using `window.__game.stepTicks(n)` and a minimal dev harness `window.__game.dev` for setup:
  - Degradation: D1 vs D5 rates; keeper slows degradation
  - Stress → health decline → alerts → death → lineage status `deceased`
  - Aggression: predation/incompatibility, overcrowding, dominance; outcomes minor/serious/fatal; response separation
  - Breach: risk warning → breach destroys segment → gap markers/state.gaps → escape → recapture/holding → rebuild clears gap
  - Radio callouts for stress/conflict/breach (rate-limited)
  - UI testids: creature-health/condition, enclosure tension section
  - Determinism: two identical runs yield identical stats and alerts

**Regression requirement:**
- All existing suites must remain green.
- Watch existing assumptions that health floors at 0.1 (will change) and fence destruction semantics.

**Phase O execution order:**
- **O1** core sim + state additions (tension.js + hooks) + initial alerts
- **O2** aggression + response intervention + injuries/deaths
- **O3** breach + gap registry + holding + rebuild
- **O4** player feedback (renderer + panels + ledger)
- **O5** tests + balance + testing agent run (**iteration_27**)
- **O6** docs update (PRD.md + plan.md) and commit

---

## 3) Next Actions (backlog — pick with the user)
1. **Phase O (P1)** — Creature Tension Pass (aggression, degradation, breach, keeper relevance, feedback, tests).
2. **Photo Album (P1)** — persist captured photos + in-game gallery with re-download.
3. **Pairing Planner (P1)** — projected inbreeding for two picked creatures; recommended pairings in the ledger.
4. **Ambient Mix sliders / Keeper Voices (P2)**.
5. **Legacy HUD retirement (P2)** — once the deck has soaked, drop the `OPS_DECK` flag + GameModals path.
6. **Hybrid / interbreeding sprites (P3)** — new sprite logic/art for interbreeding outcomes (parked; requires a separate spec).

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

**Phase O acceptance (to verify in iteration_27):**
- Needs degradation escalates stress and then health loss when neglected; keepers meaningfully slow it.
- Stress/health crisis escalates with warnings; neglect can kill; lineage marks DECEASED.
- Aggression triggers are reliable when incompatible/overcrowded/high-stress; outcomes are graduated and rate-limited.
- Serious aggression triggers rapid response intervention when a post is in range; biomedical staff treat injured.
- Breach eligibility depends on stress + degraded containment; breach destroys a fence segment and creates a gap until rebuilt.
- Player feedback exists before disaster: stress visible + enclosure warnings + breach-risk alert.
- New UI indicators are minimal and do not disturb Ops Deck geometry.
- All new behaviour has deterministic Playwright coverage; full regression suite remains green.

**Next verification to produce:**
- **iteration_27**: Phase O (Creature Tension Pass) + regressions.
