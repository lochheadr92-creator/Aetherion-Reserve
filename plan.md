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
- **Phase U — Immersion + Meta Tools (Album, Pairing Planner, Vocals, Night Lighting)**
  - Add player-facing “meta” tools that increase retention and readability **without altering the deterministic sim**.
  - **Now focus:** stabilization + UX polish + regression (testing agent sweep across all four features).

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
All four new requirements are complete.

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
The user picked 4 new features; all are now complete.

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

### U0) Prep ✅ done
- Ops Dock supports adding new drawer screens.

### U1) Photo Album ✅ complete
1. Backend: `photos` CRUD + owner scoping + size limits.
2. Frontend: PhotoMode saves JPEG+thumb; AlbumScreen in drawer.
3. Test: `tests/photo_album_test.py`.
4. Fix: add `album` to `DRAWER_IDS`.

### U2) Pairing Planner ✅ complete
1. Create `frontend/src/game/pairing.js` (deterministic projections; no mutation).
2. Add `PairingPlanner` UI + integrate into Bloodline Ledger.
3. Expose projection helpers via `window.__gameDebug`.
4. Add `tests/pairing_planner_test.py`.
5. Confirm phase21 ledger suite remains green.

### U3) Creature Vocals ✅ complete
1. Add `game/vocals.js` scheduler and run it from renderer every frame (classic + 3D).
2. Upgrade `audio.js` for positional calls and new event types (idle/feed/alarm).
3. Add/extend tests (`creature_vocals_test.py`, keep `creature_voices_test.py` green).

### U4) Night Lighting Pass ✅ complete
1. Implement `three/lamps3d.js` (instanced lamps + floods + dusk switch + pooled real lights).
2. Wire into `EntityLayers`.
3. Extend `tests/render3d_test.py` (lamp assertions; SwiftShader robustness).

### U5) Final verification sweep (NOW)
1. **Automated tests**
   - `tests/photo_album_test.py`
   - `tests/pairing_planner_test.py`
   - `tests/creature_voices_test.py`
   - `tests/creature_vocals_test.py`
   - `tests/render3d_test.py`
   - key smoke/regression: `tests/ops_deck_native_test.py`, `tests/smoke_game.py`, `tests/gamefeel_test.py`
2. **Testing agent sweep**
   - Album: dock open, tile browse, detail download/delete
   - Planner: pick A/B, swap, recommendations, best pairs
   - Vocals: verify unobtrusive rate limiting + mute/unmute + no UI lag
   - Night lighting: verify dusk ramp + pools, no flicker artifacts
3. Fix any regressions found; rerun the suite.

---

## 6) Next Actions (updated backlog)
1. **Stabilization & QA (P0)**
   - Run the testing agent sweep across Album + Pairing Planner + Vocals + Night Lighting.
   - Address any UX/timing issues, performance spikes, or Playwright flakes.
2. **Final regression sweep (P0)**
   - Classic + forced 3D + backend API suites.
3. **Polish (P1)**
   - Minor UI spacing/accessibility improvements, help text/tooltips, and performance tuning if needed.

---

## 7) Success Criteria
- All Phase R/S acceptance criteria remain true.
- **Album** works end-to-end and respects per-player ownership; automated album suite stays green.
- **Pairing Planner** projections match existing inbreeding + readiness semantics and remain deterministic/read-only.
- **Creature vocals** add life without spamming, are 3D-positioned, and remain render-only (no sim mutation).
- **Night lighting** improves dusk/night readability while maintaining the diorama composition; pooled lights behave by quality tier.
- Full automated regression stays green (classic and forced 3D).