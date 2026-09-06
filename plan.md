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
- Ops Deck Step 1 is landed and verified.
- Phase G continuation backlog (render/UI-only) is now landed and verified:
  1) **Juveniles** → 2) **Seed Picker** → 3) **Live Portraits** → 4) **Creature Voices**
- Next: pick the next roadmap item (see **Next Actions**).

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

**Ops Deck Step-1 constraints (hard):**
- ART_V2 and OPS_DECK are **behind flags** and must be removable.
- **Flag off must match main byte-for-byte / DOM-identical** (as applicable).
- No drive-by refactors; keep diffs in the scoped files only.

**Status (high-level):**
- **Phase 1–21 COMPLETE & VERIFIED**.
- **Phase G (Creature Art Rework): ✅ COMPLETE & VERIFIED (iteration_20 = 100%)**.
- **Phase H (Assessment Fixes): ✅ COMPLETE & VERIFIED (iteration_21 = 100%)**.
- **Stabilisation + Remediation passes:** ✅ COMPLETE & VERIFIED (iteration_22 and iteration_23 = 100%).
- **Phase J (ART_V2 post-passes): ✅ COMPLETE & VERIFIED (iteration_24 = 100%)**.
- **Phase K (Ops Deck shell): ✅ COMPLETE & VERIFIED (iteration_24 = 100%)**.
- **Phase L (Phase G continuation: juveniles/seed picker/live portraits/voices): ✅ COMPLETE & VERIFIED (iteration_25 = 100%)**.

**Testing baselines:**
- iteration_5–19: all green milestones as recorded.
- iteration_20: Phase G verified.
- iteration_21: Phase H verified.
- iteration_22: stabilisation pass verified.
- iteration_23: remediation pass verified.
- **iteration_24: Ops Deck Step 1 verified (Phase J + K) — 100%**.
- **iteration_25: Phase L verified (L1–L4) + regressions — 100% (109/109)**.

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
- Regression suites all green with Ops Deck on.
- Note (pre-existing): `focused_test.py` and `comprehensive_test.py` are stale (do not dismiss tutorial overlay) and are ignored.
- `ui_integration_test.py` screenshot call updated for Playwright 1.62 (PNG + quality unsupported).
- Playwright 1.62 required `chromium_headless_shell-1234` under `/pw-browsers`.

**Commit:**
- `9996f97 hud: Ops Deck dock + drawer shell behind OPS_DECK flag`

---

### Phase L — Phase G continuation backlog (render/UI only): Juveniles → Seed Picker → Live Portraits → Creature Voices ✅ COMPLETE & VERIFIED
**Status:** ✅ COMPLETE & VERIFIED (**iteration_25 = 100% (109/109)**)

#### L1) Juveniles (distinct proportions) — ✅ COMPLETE
**Goal:** Newborns read as distinct: **big head, stubby legs**, while preserving silhouette legibility and determinism.

**Landed decisions (implementation):**
- `frontend/src/game/art/juvenile.js`: deterministic image-space transform derived from the adult bake:
  - `cub`: head 1.4 / legs 0.6 / torso 0.9
  - `young`: head 1.18 / legs 0.8 / torso 0.95
  - Uses recorded eye rects to anchor the head region.
  - Remaps eye rects so blink derivation + night eye-glow remain exact.
  - Uses INK outline-gap repair.
- `frontend/src/game/art/creatures.js`: `getCreatureSheet(id, stage='adult')` keeps **adult path byte-identical**, and caches derived `cub`/`young` sheets.
- `frontend/src/game/renderer.js`: stage chosen via `juvenileStage(c)`.
- `frontend/src/components/game/Portrait.jsx`: adds a `stage` prop; juveniles show `data-stage='cub'|'young'`.

**Verification:**
- `tests/juvenile_art_test.py` passes (14/14).
- In-game juvenile renders; inspect panel portrait uses the cub sheet.

**Commit:**
- `f14171a art: juvenile proportions (big head, stubby legs) derived from adult sheets`

#### L2) Seed Picker — ✅ COMPLETE
**Goal:** Let players type/paste/share seeds for world generation.

**Landed decisions (implementation):**
- `frontend/src/game/seed.js`:
  - `parseSeed(text)`:
    - blank → `seed=null` (clock-derived in `createNewGame`)
    - digits → `Number % 2^31`
    - phrase → deterministic FNV-1a hash of lowercase phrase
  - Clipboard helper `copyText` (Clipboard API with textarea fallback).
- `frontend/src/game/state.js`: additive `seedLabel` stored in state (defaults to null on deserialize).
- `frontend/src/components/game/MainMenu.jsx`: SeedField UI:
  - `seed-input`, `seed-random-button`, `seed-copy-button`, `seed-hint`
- `frontend/src/components/game/HudBar.jsx`: `hud-seed` chip (click copies)
- **Note:** `tests/ops_deck_dom_baseline.json` was re-recorded because `hud-seed` now exists in both HUD modes.

**Verification:**
- `tests/seed_picker_test.py` passes (13/13).
- Determinism confirmed: same seed → same terrain hash; blank → fresh worlds.
- Save/load retains `seed` + `seedLabel`.

**Commit:**
- `9b2f788 menu: world seed picker (type/paste/random/copy) + HUD seed chip`

#### L3) Live Portraits — ✅ COMPLETE
**Goal:** UI portraits animate with idle/blink (render-only), without harming performance.

**Landed decisions (implementation):**
- `frontend/src/components/game/Portrait.jsx`:
  - One shared rAF ticker drives all portraits (≈25Hz), `window.__portraitLive` holds the count.
  - Repaint-on-change only (idle frame index + blink boolean).
  - Pauses off-screen via IntersectionObserver and pauses when `document.hidden`.
  - `prefers-reduced-motion: reduce` → `data-live='off'` + still frame.
- `frontend/src/game/renderer.js`:
  - `renderPortrait(canvas, speciesId, stage, {frame, blink})`
  - `portraitPose(sheet, now, phase)`

**Verification:**
- `tests/live_portraits_test.py` passes (9/9).

**Commit:**
- `bf1282b ui: live portraits (idle/blink loop, shared ticker, reduced-motion + visibility aware)`

#### L4) Creature Voices — ✅ COMPLETE
**Goal:** Synthesized snarls/bellows to make threat/lunge/breach events feel alive.

**Landed decisions (implementation):**
- `frontend/src/game/audio.js`:
  - `audio.creatureVoice(c, event, {sheet, proximity, juvenile})` synthesises the voice and returns:
    - `played` / `muted` / `silent` / `limited-self` / `limited-global`
  - `voiceProfile(sheet)` derived from the baked art:
    - `snarl` for predators (`sheet.menace`)
    - `keen` for bob/hover
    - `bellow` for heavy/slow bodies
    - `chirp` default
  - Pitch based on silhouette height; juveniles ×1.6 pitch.
  - Rate limits: 2.6s per animal / 320ms global / 3 per 2s rolling window.
  - `limited-global` keeps the edge pending so a chorus staggers rather than disappearing.
  - Debug counters: `window.__audio.voices` (attempted/played/limited/muted).
- `frontend/src/game/renderer.js`: `voiceCue` called on rising edges of threat/lunge, distance attenuated from viewport centre.

**Verification:**
- `tests/creature_voices_test.py` passes (12/12).
- Regression audio suite remains green (`phase20_features_test.py`).

**Commit:**
- `662b0e5 audio: creature voices (synthesised snarl/bellow/keen/chirp on threat + lunge, rate-limited, distance-attenuated)`

#### Phase L documentation / artifacts
- `memory/PRD.md` updated with a Phase L section.

**Commit:**
- `a122eea docs: Phase L memory + refreshed art artifacts (iteration_25 = 100%)`

---

## 3) Next Actions (backlog — pick with the user)
1. **Ops Deck Step 2 (P1)** — adapt the five management screens natively to the 320px drawer (instead of relying on generic narrow-host reflow CSS).
2. **Photo Album (P1)** — persist captured photos + in-game gallery with re-download.
3. **Pairing Planner (P1)** — projected inbreeding for two picked creatures; recommended pairings in the ledger.
4. **Ambient Mix sliders / Keeper Voices (P2)**.

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

**Phase K (OPS_DECK) acceptance:**
- Default ON: OpsDock opens a single drawer at a time; close/toggle/Esc works; existing screens mount inside.
- Deck mode: `GameModals` absent; legacy modal writers route into the drawer.
- Flag off / `?legacyHud=1`: legacy HUD/modals render; DOM matches main baseline.
- Canvas remains interactive at x=400 while drawer open; dock+drawer cover ≤376px.

**Phase L acceptance (new):**
- Juveniles: derived cub/young sheets render; adult sheets unchanged; eye rects remap correctly.
- Seed Picker: typed seeds replay identical worlds; HUD seed chip copies; save/load preserves.
- Live Portraits: idle/blink animation with shared ticker; pauses off-screen; reduced-motion supported.
- Creature Voices: synthesised voices on threat/lunge; distance-attenuated; rate-limited; mute supported; sim untouched.

**Next verification to produce:**
- **iteration_26**: whichever P1 roadmap item is selected next (plus regressions).
