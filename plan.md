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
- **Phase M:** Ops Deck Step 2 — refactor management screens to be **native drawer panels** (remove CSS “chrome-neutralising” hacks), with emphasis on:
  - `SpeciesDatabase.jsx` (native drawer layout)
  - `BloodlineLedger.jsx` (native drawer layout; still supports legacy modal/portal)
- **Phase N:** Polish/QA pass — fresh smoke test + screenshot review; fix findings; re-verify.

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
**Spec source:** `01-sprite-pipeline-v2.md` (artifact)

**Status:** ✅ COMPLETE & VERIFIED (iteration_24 = 100%)

**Flag design:**
- `frontend/src/game/art/flags.js`
  - `export const ART_V2` from `localStorage.getItem('aetherion.artV2')` (default `'on'`).

**What landed (high level):**
- `pixel.js`: deterministic post passes `celRamp`, `rimLight2`, `haloGlow` that **mask recorded eye rects**.
- `creatures.js`: bake ordering:
  - cel/rim after `def.paint()` and before outline.
  - halo after outline, and silhouette `bounds` measured pre-halo so bounds match flag-off.
  - `sheet.v2 = ART_V2`.
- `terrain_tex.js`: apply `celRamp(steps=4)` when ART_V2 is on.
- `rig.js` + `renderer.js`: `groundAO` and `contactShadow` wired into the single shadow draw site.

**Verification:**
- `tests/art_v2_test.py` passes (9/9).
- Flag-off outputs match baseline (`tests/art_v2_baseline.json`).

**Commit:**
- `e138f63 art: ART_V2 post-passes (cel/rim/halo/AO) behind flag`

---

### Phase K — Ops Deck dock + drawer shell behind OPS_DECK flag (Ops Deck Step 1) ✅ COMPLETE & VERIFIED
**Spec source:** `02-ops-deck-shell.md` (artifact)

**Status:** ✅ COMPLETE & VERIFIED (iteration_24 = 100%)

**Flag design (user-confirmed):**
- `OPS_DECK` defaults **ON**.
- `?legacyHud=1` **forces legacy HUD**.
- `localStorage.setItem('aetherion.opsDeck','off')` **forces legacy HUD**.
- Flags read once at module load: set localStorage then reload.

**Implementation notes (landed decisions):**
- `OpsDock.jsx`: left 56px dock; `data-testid` values are **`dock-` prefixed** to avoid Playwright strict-mode collisions with legacy HudBar.
- `Drawer.jsx`: 320px drawer with title/close; Esc closes.
- `useDrawer.js`: single drawer state; same-id toggles closed; `{toggle:false}` to guarantee open.
- `GameScreen.jsx`:
  - In deck mode, `HudBar.onOpenModal` routes to `openDrawer`, and `GameModals` is **not mounted**.
  - Legacy `setModal` writers (alerts + inspect panel open-species) are routed into the deck via an effect.
  - Left overlays wrapper `ops-left-shift` sits at **left-14** with the drawer closed and **left-[376px]** when open (prevents the build toolbar being covered).
- `index.css`:
  - `.ops-drawer-host` neutralises only the **modal chrome** (absolute inset-0 backdrop and fixed-width centered panel) with screen files untouched.
  - Adds a **generic narrow-host reflow** (grids → 1 column; Species list stacks above detail; header wraps).

**Verification:**
- `tests/ops_deck_test.py` passes (26/26).
- Legacy DOM baseline re-recording script: `tests/ops_deck_record_baseline.py`.

**Commit:**
- `9996f97 hud: Ops Deck dock + drawer shell behind OPS_DECK flag`

---

### Phase L — Phase G continuation backlog (render/UI only): Juveniles → Seed Picker → Live Portraits → Creature Voices ✅ COMPLETE & VERIFIED
**Status:** ✅ COMPLETE & VERIFIED (**iteration_25 = 100% (109/109)**)

(unchanged; complete and verified)

---

### Phase M — Ops Deck Step 2: Native Drawer Panels (Species DB + Bloodline Ledger focus) ✅ COMPLETE & VERIFIED
**Status:** ✅ COMPLETE & VERIFIED (iteration_26 = 100%). Commits: `47cbb00` (native panels + tests), `3bfff50` (QA fixes).
**Landed exactly as designed below**, plus: `catalogued(s, species)` in SpeciesDatabase (a species the park holds/held is documented even before its acquisition tier is researched — fixes scenario Sovereigns showing as locked); ledger subject node 220px wide in the drawer; `ledger-empty` state; `drawer-close` testid retired (the header close IS the screen's `*-close-button`).

**Original plan:**
**Goal:** Remove the “CSS chrome-neutralising” approach and make Ops Deck drawer panels **native**.

**Scope (user-confirmed):**
- Refactor **`SpeciesDatabase.jsx`** and **`BloodlineLedger.jsx`** to be native drawer panels.
- Keep legacy behavior intact:
  - Legacy HUD mode must remain baseline-identical where tests require it.
  - Bloodline Ledger must still be reachable from CreaturePanel and behave as a full-screen modal in legacy mode.
- Maintain shell geometry: dock 56px + drawer 320px.

**Phase M design decisions (to land):**
- Create `frontend/src/components/game/ScreenFrame.jsx`:
  - `ScreenHostContext` with `{ host: 'modal' | 'drawer', title }`.
  - `useScreenHost()`.
  - `ScreenFrame` abstraction:
    - Props: `testId`, `closeTestId`, `eyebrow`, `subtitle`, `actions`, `toolbar`, `size`, `bodyClassName`, `scroll`, `layer`, `onClose`.
    - Modal host renders the existing full-screen chrome (backdrop + centred `.nl-panel` + `.nl-panel-header`) **with identical [data-testid] order**.
    - Drawer host renders a compact header using the screen’s own close button (`*-close-button`) and optional strips.
    - Root retains the screen’s `*-modal` testid and adds `data-host` for styling.
- Tailwind variant `drawer:` = `[data-host="drawer"] &` added in `tailwind.config.js` (plugin code only; no new dependency).
- `Drawer.jsx` becomes geometry + Esc + context provider:
  - No header of its own (ScreenFrame provides it).
  - Add `DRAWER_TITLES.ledger = 'Bloodline Ledger'`.
- `useDrawer.js` extended:
  - `openDrawer(id, { toggle, params })`.
  - Return `{ drawer, drawerParams }`.
  - Add `ledger` to `DRAWER_IDS`.
- Convert all five management screens to `ScreenFrame` and drawer-native layouts:
  - SpeciesDatabase (deep adapt; no horizontal overflow; stack roster above detail).
  - Research/Finance/Acquisition: drawer-friendly single-column layouts.
  - Staff: drawer-friendly single-column hire cards + compact roster.
  - (This ensures consistency and eliminates reliance on global CSS hacks.)
- Bloodline Ledger refactor:
  - Use `ScreenFrame`.
  - Only uses `createPortal` in modal host.
  - Drawer host uses compact node sizing and pairing outlook rendered as cards (maintain existing testids and `data-safe`).
- Thread ledger navigation:
  - Add `onOpenLedger(creatureId)` path from `CreaturePanel/InspectPanel`.
  - In Ops Deck mode: open the `ledger` drawer with params.
  - In legacy mode: keep local portal modal behavior.
- Remove CSS hack:
  - Delete `.ops-drawer-host` override block from `index.css`.

**Verification plan (Phase M):**
- Update existing tests where appropriate (keeping semantics):
  - `ops_deck_test.py`: close buttons should still close drawers; adjust close selector to the new single header close in drawer host.
  - `live_portraits_test.py`: ensure close selector matches the Species close button that still exists.
- Add new acceptance test: `tests/ops_deck_native_test.py`:
  - Confirms: single header per drawer screen, no horizontal overflow/scrollbars in each screen in drawer mode.
  - Ledger: open in drawer, locate action navigates to creature, close works.
  - Legacy: ledger portal still opens and closes; no Ops Dock present.
  - Confirms `.ops-drawer-host` no longer exists.
- Run full suite + testing agent; produce **iteration_26** report.

---

### Phase N — Polish / QA Pass ✅ COMPLETE & VERIFIED
**Status:** ✅ COMPLETE (iteration_26 = 100%). Findings fixed: HUD overflow at 1366–1700px (labels `hidden min-[1720px]:inline`, identity block `flex-auto min-w-0 overflow-hidden`, right cluster `shrink-0`, Menu never clipped); build-toolbar category tabs `px-1 whitespace-nowrap`; Species DB lock for held species (see Phase M). Smoke-tested: menu/seed picker → start, all drawers at 1366/1600/1920, dossier → species deep-link → ledger, photo mode, save → menu list, legacy HUD + legacy modals. New suites: `tests/ops_deck_native_test.py` (17), `tests/hud_responsiveness_test.py` (19, added by the testing agent).

**Original plan:**
**Goal:** A short, practical polish pass after Phase M to catch UI regressions and usability issues, without changing simulation determinism.

**Activities:**
- Fresh smoke test flows:
  - Main menu → seed picker → start game
  - HUD + dock/drawers open/close paths
  - Inspect panel flows (species open, ledger open)
  - Photo mode open/close
  - Save/load
  - Field Ops buy/claim flows
- Screenshot review at:
  - 1600×900
  - 1366×768
- Fix any findings:
  - Overflow, clipping, misaligned headers
  - Focus/keyboard traps, Esc semantics
  - Any strict-mode Playwright issues (duplicate testids, element count changes)
- Run:
  - `yarn build`
  - Playwright suites (including new tests)
  - Testing Agent iteration **26**
- Update docs:
  - `memory/PRD.md` with Phase M/N notes
  - Update this `plan.md` with final status + acceptance.

---

## 3) Next Actions (backlog — pick with the user)
1. **Photo Album (P1)** — persist captured photos + in-game gallery with re-download.
2. **Pairing Planner (P1)** — projected inbreeding for two picked creatures; recommended pairings in the ledger (now a native drawer — natural home).
3. **Ambient Mix sliders / Keeper Voices (P2)**.
4. **Legacy HUD retirement (P2)** — once the deck has soaked, drop the `OPS_DECK` flag + GameModals path (ScreenFrame's modal host + the DOM baseline test become removable).

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

**Phase J (ART_V2) acceptance:**
- ART_V2 off: creature sheet hashes match baseline; terrain textures match baseline.
- ART_V2 on: `sheet.v2:true`, hashes differ, `bounds` unchanged; no recolor of eye rects; halo does not affect bounds.
- Toggling `localStorage['aetherion.artV2']` and reload switches look without console errors.

**Phase K (OPS_DECK Step 1) acceptance:**
- Default ON: OpsDock opens a single drawer at a time; close/toggle/Esc works; existing screens mount inside.
- Deck mode: `GameModals` absent; legacy modal writers route into the drawer.
- Flag off / `?legacyHud=1`: legacy HUD/modals render; DOM matches main baseline.
- Canvas remains interactive at x=400 while drawer open; dock+drawer cover ≤376px.

**Phase L acceptance:**
- Juveniles: derived cub/young sheets render; adult sheets unchanged; eye rects remap correctly.
- Seed Picker: typed seeds replay identical worlds; HUD seed chip copies; save/load preserves.
- Live Portraits: idle/blink animation with shared ticker; pauses off-screen; reduced-motion supported.
- Creature Voices: synthesised voices on threat/lunge; distance-attenuated; rate-limited; mute supported; sim untouched.

**Phase M/N acceptance (verified, iteration_26):**
- Every drawer screen: `data-host=drawer`, one header + one close, no horizontal overflow, no `.ops-drawer-host`; legacy DOM baseline unchanged.
- Species DB: roster strip + detail; dossier deep-link lands on the species with its row in view; held species catalogued.
- Ledger: contextual `ledger` drawer (no dock button), cards outlook, locate/Esc/close; legacy portal modal unchanged.
- HUD fits 1366→1920 with nothing clipped.

**Next verification to produce:**
- **iteration_27**: whichever P1 roadmap item is selected next (plus regressions).