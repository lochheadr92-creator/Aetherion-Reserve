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
- **Phase V — Quality-of-life + Immersion Extensions (Planner Shortcut, Album Captions, Vocal Subtitles, Lamp Placement)** ✅ COMPLETED + ✅ VERIFIED
  - All four features implemented without compromising deterministic simulation.
  - Independent testing sweep (`test_reports/iteration_31.json`): backend 36/36, frontend 19/19, zero bugs.
  - **Next:** await user feedback / new feature picks (see §6 backlog).

---

## 2) Constraints (binding)

### Render / determinism (hard)
- **Visuals only** for Three.js systems (no sim mutation, no RNG bleed). Sim logic must continue using `rnd()` only.
- Isometric camera remains **2:1 dimetric**: yaw 45°, pitch 30°, **orthographic**. Zoom/pan unchanged.
- Picking math unchanged (`renderer.screenToTile/edgeFromPointer/vertexFromPointer`, `worldPx`).
- 2D overlay remains authoritative for selection rings / hover / HUD markers.

### HUD / Ops Deck constraints (updated, hard)
- **Ops Deck is the only HUD**.
- Retired (must remain removed):
  - `OPS_DECK` flag
  - `?legacyHud=1`
  - `localStorage['aetherion.opsDeck']='off'`
  - legacy full-screen management modals (`GameModals.jsx`, ScreenFrame modal host)
- Keep **Ops Deck geometry unchanged**: **56px dock + 320px drawer** (≤376px total coverage).

### Backend / storage constraints (hard)
- Save schema can be extended **only additively** (backward-compatible defaults).
- Owner scoping: new collections must follow the **X-Player-Token** ownership model used for `saves`.

### Test constraints (hard)
- Default headless Playwright must remain fast/stable by falling back to classic 2D when software GL is detected.
- Forced 3D tests must use SwiftShader (`?render3d=1&gfx=low` + chromium args) and **poll frames**.

---

## 3) Status Summary (what is done)

### Phase R — CINEMATIC 3D WORLD ✅ IMPLEMENTED + ✅ VERIFIED
- R1 foundation: Three.js pipeline + camera lock + terrain splat PBR + water + lighting + post + quality tiers.
- R2 world completeness: flora / fences / buildings / props / transport / entrance / terrain skirt.
- R3 creatures: procedural rigs per body plan, skin PBR, genes/morph tint, state animation.
- R4 people: instanced guests/staff/security with walk cycles.
- R5 verification: `tests/render3d_test.py` green; classic regression suites remain green.

### Phase S — Follow-ups (shoreline, HUD retirement, living weather, species filters) ✅ IMPLEMENTED + ✅ VERIFIED
- S1 Shoreline softening: BFS beach profile + sand/mud bed + wet shoreline band + water depth from `aBed`.
- S2 Legacy HUD retirement: deck-only; modal host removed; ledger is drawer-only.
- S3 Living weather: smoothed storm + gusts; water chop + rain rings; terrain wetness; rain splash rings on hard surfaces.
- S4 Species filters: search + family-class + tier chips; locked species never leak.

### Phase U — Immersion + Meta Tools ✅ IMPLEMENTED + ✅ VERIFIED
All four original new requirements are complete and independently validated.

#### U1 — Photo Album ✅ COMPLETE + ✅ VERIFIED
- Backend: `/api/photos` CRUD, owner scoping via `X-Player-Token`, listing returns meta (thumb only), `GET /photos/{id}` returns full image.
- Frontend:
  - `PhotoMode` auto-saves JPEG+thumb best-effort + status indicator (saved/failed/retry).
  - `AlbumScreen` Ops Deck drawer supports browse/detail/download/delete.
  - Ops Dock includes Album button.
- Fix: `album` was missing from `DRAWER_IDS` in `useDrawer.js` → added.
- Tests: `tests/photo_album_test.py` passes **9/9**.

#### U2 — Pairing Planner ✅ COMPLETE + ✅ VERIFIED
- New pure projection module: `frontend/src/game/pairing.js`
  - `riskTier`: CLEAN / ELEVATED / SEVERE / CRITICAL
  - `pairingChecklist`: mirrors `breedingTick` gates (research, same species, enclosure, juvenile/gestation/cooldown, welfare/stress, etc.)
  - `morphOdds`: carrier model with spontaneous chance
  - `projectPairing`: expected means + ±0.08 spread; inbreeding depression on fertility/resilience
  - `recommendPartners`: scored list with reasons; `bestPairs`; `plannerRoster`
- New UI: `frontend/src/components/game/PairingPlanner.jsx`
  - two Radix Select slots (A/B), swap button
  - risk banner + relation + inbreeding %
  - readiness checklist + courtship odds
  - morph outlook
  - trait bars with parent ticks + expected range + depression badges
  - likely-trait chips
  - recommended partners (click sets B)
  - best pairings (click sets A+B)
- Integrated into `BloodlineLedger.jsx` between family tree and pairing outlook (also shown when ledger has no subject).
- Debug/testing hooks exposed via `window.__gameDebug.projectPairing/recommendPartners/bestPairs`.
- Tests:
  - `tests/pairing_planner_test.py` passes **13/13**
  - `tests/phase21_features_test.py` ledger regression remains green (**28/28**)

#### U3 — Creature Vocals ✅ COMPLETE + ✅ VERIFIED
- New scheduler: `frontend/src/game/vocals.js`
  - Runs from `GameRenderer.render()` for **both classic and 3D branches**
  - Cues:
    - alarmed: rising-edge threat/lunge
    - feeding: rising-edge of eating/grazing/drinking/filterFeeding
    - idle: ambient calls on 9–26s per-creature timers
  - Off-screen animals stay quiet.
  - Supports retry on global rate-limit and on the alarm-cut window.
- Audio upgrades (`frontend/src/game/audio.js`):
  - `voiceProfile(sheet, speciesId)` adds per-species signature (detune/syllables/rasp)
  - `_spatialBus`: low-pass by proximity → PannerNode (or StereoPanner fallback) using normalized screen offsets
  - `_tone`/`_noiseBurst` accept custom output
  - `creatureVoice` supports events: `idle`, `feed`, `threat`, `lunge`
  - Alarm cut-through: 400ms window returns `limited-self-retry`
  - Call designs split into `_alarmCall`, `_idleCall`, `_feedCall`
- Removed old 2D-only voice edge tracking (`renderer.voiceCue/_vox`) in favor of the scheduler.
- Tests:
  - `tests/creature_voices_test.py` passes **12/12** (legacy alarmed cues)
  - `tests/creature_vocals_test.py` passes **15/15** (idle/feed/positional + forced 3D path)

#### U4 — Night Lighting Pass ✅ COMPLETE + ✅ VERIFIED
- New `frontend/src/game/three/lamps3d.js`:
  - Deterministic path lamps along walkway edges (stride=4, offset to open side, capped)
  - Building floodlights mounted on camera-facing roof corners
  - Roof height resolved via downward Raycaster against merged building meshes (skips open platforms)
  - Instanced geometry: posts/heads/bulbs + warm pools; flood masts/heads/lenses + cool oval pools
  - Dusk curve: `lampSwitch = smoothstep(night, 0.12, 0.7)` + subtle hum flicker
  - Pooled real PointLights by quality: low=0, medium=4, high=8 reassigned near camera focus
- Wired into `EntityLayers` (`sync/invalidate/setQuality/dispose`).
- Tests:
  - `tests/render3d_test.py` extended with B22–B26 lamp assertions → **30/30 passed**
  - SwiftShader robustness: STAGE evaluate budget increased to 180s; storm ease-in uses more frame polling.

**Tooling note (local runs):**
- Playwright expected `chromium_headless_shell v1234`; locally resolved by symlink:
  - `/pw-browsers/chromium_headless_shell-1234 -> chromium_headless_shell-1208`

---

## 4) Phase U — New User Picks (DONE)
The user picked 4 features; all are now complete.

### U1) Photo Album (gallery + persistence) ✅ DONE
- Captures auto-save and are browsable/downloadable/deletable in a dedicated drawer.

### U2) Pairing Planner (projection + UI) ✅ DONE
- Two-slot pairing planner with projected inbreeding risk, readiness gates, morph odds, trait outlook, recommendations.

### U3) Creature Vocals (ambient life) ✅ DONE
- Positioned calls for idle/alarmed/feeding; works in classic and 3D renderers; rate limited; no sim mutation.

### U4) Night Lighting Pass (lamps + floodlights) ✅ DONE
- Warm path lamps + building floodlights, dusk/night switching; pooled real lights by quality.

---

## 5) Implementation Steps (revised sequence)

### U0–U5 ✅ complete
- Phase U is completed and verified (see Status Summary).

### V0) Phase V Prep (NEW)
- Add a small navigation payload mechanism for opening drawers with context.
  - **New requirement**: Bloodline Ledger currently keys on `creatureId` selection; Phase V requires opening it with a **species focus**.
  - Introduce `ledgerFocus: { creatureId?: number, speciesId?: string }` or equivalent in the drawer host state.

### V1) Planner Shortcut (P0)
**Goal:** Species Database species cards get a **“Plan pairing”** button.
- Enabled when **≥ 1 resident** of that species exists in the park.
- Click action:
  - Open Bloodline Ledger drawer
  - Set ledger focus to `{ speciesId }`
  - Planner prefill:
    - A = first resident creature id for that species (stable ordering)
    - B = top recommendation for A
- Files likely touched:
  - `frontend/src/components/game/SpeciesDatabase.jsx`
  - `frontend/src/components/game/Drawer.jsx` / drawer host state
  - `frontend/src/components/game/BloodlineLedger.jsx` (accept species focus)
- Tests:
  - Extend a ledger/species UI test or add `tests/planner_shortcut_test.py`.

### V4) Album Captions (P0)
**Goal:** caption editing + stamped downloads.
- Backend:
  - Add `PATCH /api/photos/{photo_id}` with body `{ caption }` (owner-scoped), or equivalent additive update route.
  - Validate caption length (e.g., 0–120 chars) and sanitize.
- Frontend:
  - Album detail view adds inline caption editor (Input + Save; Enter to save; Esc to cancel).
  - Download action composes a **JPEG with a caption bar** (park name · day/clock · caption) via an offscreen `<canvas>`.
- Tests:
  - Extend `tests/photo_album_test.py` to:
    - set caption, reload album, caption persists
    - verify downloaded image differs from original (height includes caption bar)

### V2) Vocal Subtitles (P1)
**Decision:** subtitles **ON by default**, with a toggle.
- Data flow:
  - `vocals.js` records recent call events: `{ creatureId, speciesId, kind, event, t }`.
  - `renderer.js` overlay draws a fading caption near the creature for ~1.6s.
- Text generation:
  - Verb table by `voice kind × event` (e.g., snarl: growls/snaps; keen: chirps/keens; bellow: bellows/booms).
- Toggle:
  - UI toggle in audio/settings menu.
  - Stored in `localStorage['aetherion_subtitles']` (default **true**).
- Tests:
  - Add `tests/vocal_subtitles_test.py` or extend `tests/creature_vocals_test.py`:
    - force a cue → caption list non-empty
    - toggle off → captions not drawn/returned

### V3) Lamp Placement Tool (P1)
**Goal:** player-placeable lamps with running power cost.
- UI:
  - Facilities tab add placeables:
    - **Path Lamp**: build ~$40, upkeep ~$0.5/day
    - **Floodlight**: build ~$120, upkeep ~$2/day, must be adjacent to a building
- Simulation (deterministic, saved additively):
  - Add `state.lamps[]` (or similar) with `{ id, type, x, y, rot? }`.
  - Costs:
    - build cost at placement
    - daily upkeep included in finances/power cost pass
- Rendering:
  - 2D: sprite/icon for lamps and night glow.
  - 3D: `LampLayer` merges player lamps with auto-placed lamps and uses the same dusk switch.
- Optional gameplay effect (default):
  - **Cosmetic + cost only** (no guest comfort bonus unless a clean hook already exists and is requested later).
- Tests:
  - placement rules (floodlight adjacency), build cost deducted
  - upkeep applied at day rollover
  - save/load preserves lamps
  - 3D smoke: lamp counts increase and lamps switch on at night

### V5) Final verification sweep (for Phase V) ✅ COMPLETED
1. **Automated tests** (all run sequentially, in isolation — SwiftShader suites starve each other if run concurrently):
   - `tests/photo_album_test.py` **15/15** (captions persist; stamped download adds ≥44px caption bar; re-stamps on edit)
   - `tests/pairing_planner_test.py` **15/15**
   - `tests/creature_vocals_test.py` **19/19** (incl. subtitles SUB 1–4 + forced-3D Part B)
   - `tests/render3d_test.py` **31/31** (incl. B23 lamp placement rules: path adjacency, floodlight adjacency rejection, costs, night switch)
   - `tests/phase_v_test.py` **19/19** (added by testing agent: planner shortcut, subtitles toggle persistence, lighting group, save)
2. **Testing agent sweep** → `test_reports/iteration_31.json`: backend **36/36**, frontend **19/19**, no bugs.
3. **Test hardening (no product changes):**
   - `ALARM 1` accepted only `threat`; when the lunge frame-cycle window is already open the scheduler correctly voices `lunge` first (both are alarms sharing the 400 ms cut-through in `audio.creatureVoice`). Test now accepts either.
   - `SUB 3` read `caps[0]`, which could be another animal's idle caption. Test now waits for and checks the karrgan caption specifically.

## Phase V — Status: ✅ COMPLETED

---

## 6) Next Actions (updated backlog)
1. **Phase V** ✅ done and verified.
2. **Polish (P1)** — candidates for the next user pick:
   - Small UX refinements (tooltips, keyboard shortcuts, minor layout improvements).
   - Lamp gameplay hook (optional): guest comfort / safety bonus near lit paths at night.
   - Album: share/export whole album as a contact sheet.
   - Subtitles: per-species caption colour or icon glyph.

---

## 7) Success Criteria
- All Phase R/S/U acceptance criteria remain true.
- **Planner Shortcut:** users can open the Pairing Planner from the Species Database without selecting a creature first.
- **Album Captions:** captions persist server-side and are stamped into downloaded images.
- **Vocal Subtitles:** captions appear by default, fade cleanly, toggle off/on reliably, and never affect sim determinism.
- **Lamp Placement Tool:** player lamps are deterministic sim entities with correct build/upkeep costs, save/load stability, and dusk/night switching in 3D.
- Full automated regression stays green (classic and forced 3D).
