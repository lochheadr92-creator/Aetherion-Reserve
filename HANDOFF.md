# Aetherion Reserve — Technical & Product Handoff

_Last updated after Phase F (Phase 21). Verified state: testing_agent iteration_19 = 100%._

Preview: https://discovery-bio.preview.emergentagent.com

---

## 1. What this is

A desktop **creature-containment / park-management game** ("Night-Lab Containment OS" visual identity).
Players build a reserve for 19 fictional species whose biology is **unknown at first** and must be discovered by observation. Systems include terrain sculpting, fences/enclosures, creature AI with needs and welfare, guests and economy, research, staff, genetics and breeding, weather/day-night, scenarios, and a polish layer (audio, game-feel, photo mode).

**Stack**
- Frontend: React 19 (CRA / react-scripts), Tailwind + Shadcn/UI, `lucide-react`, `sonner`. Rendering is a **hand-written isometric Canvas 2D engine** with procedurally baked pixel-art sprites (no image assets, no audio assets).
- Backend: FastAPI (`/app/backend/server.py`) — only a **save-slot CRUD service** over MongoDB (motor).
- DB: MongoDB, single collection `saves`.
- All simulation runs **client-side**, deterministic, fixed-timestep (100 ms tick), decoupled from rendering.

---

## 2. Running / operating

| Thing | How |
|---|---|
| Services | `supervisorctl status` (backend :8001, frontend :3000, mongodb) |
| Restart | `supervisorctl restart backend` / `frontend` (hot reload is on; restart only after dep/.env changes) |
| Logs | `tail -n 50 /var/log/supervisor/backend.*.log /var/log/supervisor/frontend.*.log` |
| Frontend compile check | `cd /app/frontend && esbuild src/ --loader:.js=jsx --bundle --outfile=/dev/null` |
| Env (never edit) | `backend/.env`: `MONGO_URL`, `DB_NAME`, `CORS_ORIGINS` · `frontend/.env`: `REACT_APP_BACKEND_URL` |
| Package mgmt | `yarn add …` (never npm); `pip install … && pip freeze > requirements.txt` |
| Browser tests | `cd /app/tests && python <test>.py` — **run one at a time** (parallel browsers make frame-based tests flaky). If chromium is missing: `playwright install chromium` |

Backend API (all under `/api`):
```
GET    /api/                 health
GET    /api/saves            list SaveMeta
GET    /api/saves/{id}       full save (meta + state)
POST   /api/saves            create {name, park_name, mode, day, cash, rating, creatures, state}
PUT    /api/saves/{id}       overwrite
DELETE /api/saves/{id}
```
Saves use UUID ids; `state` is the full serialized game state (JSON). `SaveMeta` uses `extra="ignore"`.

---

## 3. Code map

### Frontend — `/app/frontend/src`
```
App.js                         shell: menu <-> game screen, Sonner toaster, audio.install()
components/game/
  MainMenu.jsx                 mode picker (Management / Sandbox / Scenarios), save slots
  GameScreen.jsx               composes HUD, canvas, toolbar, inspect panel, modals, trackers, photo mode
  GameCanvas.jsx               rAF loop: input.frame() -> renderer.render() -> audio.update(state)
  HudBar.jsx                   cash/day/clock/weather, pause/speed, alerts feed, settings popover (audio + edge scroll), photo, save, exit
  BuildToolbar.jsx             terrain/paint/water/veg/path/fence/gate/buildings/creature-release tools
  InspectPanel.jsx + panels/   CreaturePanel, EnclosurePanel, BuildingPanel, FencePanel
  BloodlineLedger.jsx          family tree + pairing outlook dialog (portal)
  StaffScreen.jsx              hire/fire, keeper assignment, report card, radio-chatter switch
  ScenarioTracker.jsx          goals/fails/mastery, progress chips, victory/defeat dialogs
  ResearchScreen / FinanceScreen / AcquisitionScreen (+fieldops/) / SpeciesDatabase / ObjectivesPanel
  PhotoMode.jsx                letterbox capture -> PNG download
  TutorialOverlay.jsx, EmergencyBanner.jsx, OverlayToggles.jsx (habitat/power/view)
  hooks/                       useGameScreenActions (tool + result toasts + audio), useGameAlerts (alert->toast routing),
                               useHotkeys, useNavigateTarget (alert/ledger click -> camera + selection)
game/                          PURE simulation + rendering (no React)
  state.js                     createNewGame, serialize/deserialize (+ additive backfills), pushAlert, logCause, seeded rnd, event bus (on/emit)
  controller.js                GameController singleton `game`: newGame/loadGame/saveGame, loop, setPaused/setSpeed, stepTicks(n) [test helper]
  sim.js                       tickOnce(state): ordered subsystem ticks (see §4)
  terrain.js, construction.js, enclosures.js, pathfind.js
  creatures.js                 needs, state machine, welfare, fence pressure, cohab, abilities, breeding, waste
  genetics.js, lineage.js      heritable genes/morphs/inbreeding · permanent bloodline registry + tree/pairing queries
  guests.js, economy.js, attractions.js, transport.js
  knowledge.js                 unknown-biology gating: discovered/evidence/hypotheses
  staff.js                     keepers: roles, task selection (assigned pen first), report card, radio chatter
  security.js, events.js, rivalry.js, expeditions.js, contracts.js, weather.js, scenarios.js
  input.js                     mouse/wheel tools, drag-pan, right-click cancel, edge scrolling
  renderer.js                  isometric draw pipeline, overlays, keeper pins, idle life, selection/hover
  fx.js                        render-only: zoom easing, pan inertia, screen shake, placement pops, dust, footprints
  audio.js                     Web Audio synth: ambience beds + one-shots + stingers, settings
  data/                        species.js (19), buildings.js (46), research.js (19), scenarios.js (6), staffRoles.js, expeditions.js
  art/                         pixel.js painter core, creatures_a/b/c.js, creatures.js (sheet cache + blink derivation), buildings.js, flora.js, staff.js, guests.js, terrain_tex.js
```

### Backend — `/app/backend`
- `server.py` — FastAPI app, Mongo via motor, CORS from env, router prefix `/api`.
- `backend_test.py` — pytest-style API tests (also a copy at `/app/backend_test.py` created by the testing agent).

### Tests — `/app/tests` (Playwright, Python, async)
`smoke_game.py`, `scenario_discovery.py`, `fence_drag_test.py`, `phase5_test.py`, `phase6a/6b_test.py`, `phase7_*`, `phase8_staff_test.py`, `phase9_scenarios_test.py`, `phase16_visual.py`, `phase17_sovereign_test.py`, `phase19_photo_test.py`, `keeper_priorities_test.py`, `input_ux_test.py`, `gamefeel_test.py`, `phase20_features_test.py`, `phase21_features_test.py`, `weather_detailed_test.py`, `placement_alignment_test.py`, backend/determinism tests. Helpers in `phase6_helpers.py` (`click_tile`, `tile_screen`, boot helpers). Reports: `/app/test_reports/iteration_1..19.json`.

---

## 4. Simulation architecture (key concepts)

- **Authoritative state object** (`game.state`) — plain JSON-able data; UI reads it, sim mutates it. UI refresh via `emit('uiRefresh')` every ~400 ms (`useGameTick`).
- **Fixed timestep**: 100 ms/tick; speed 1x/3x; `TICKS_PER_DAY = 1800` (3 min/cycle). Day phases from `weather.getDayPhase(tick)` (dawn/day/dusk/night).
- **Determinism**: seeded LCG `rnd()` in `state.js`; render-only effects use `Math.random`. `game.stepTicks(n)` advances synchronously for tests.
- **Tick order** (`sim.js`): creatures (needs/decide every 20, welfare 40, fence pressure 150, cohab 100, abilities 120, breeding 200, waste 400 — staggered by id) → staff → guests (spawn/cull every 25) → weather (25) + storm fence damage → security → expeditions (10) / contracts (60) → events (30) / rivalry (45) → transport → research (10) → objectives (50) / rating (100) / **scenario (T%100===30)** → daily rollover (1800).
- **Map**: 72×72 tiles, flat arrays `heights/materials/water/veg/paths`, `idx(x,y)=y*72+x`. Iso projection: `worldPx = ((x-y)*32, (x+y)*16 - h*10)`. Fences are edge-keyed (`"x,y,E|S"`) with tiers/hp. Enclosures = flood-fill regions bounded by fences (cached; `state._encDirty`).
- **Unknown biology**: species have `hiddenAttrs`; `knowledge[speciesId].discovered` gates both UI text and habitat cause explanations. Evidence accumulates from behaviour → hypothesis alert → dynamic Field Study research → breakthrough + grant.
- **Genetics**: `genes {size, hue, glow, fertility, hardiness, gen, parents{mId,mName,fId,fName}, ancestors[], inbreed, morph, carrier}`. Inbreeding = shared members of {self ∪ ancestors} / 3 (≥0.25 = "inbred"). Breeding requires research `bio_breeding`, welfare ≥ 0.72, stress ≤ 0.45, kin in same enclosure; **capacity counts adults only** (blocked when adults > `social.max` or ≥ space cap). Gestation 1000 ticks, cooldown 3600, juveniles mature in ~2350 ticks.
- **Lineage registry** (`state.lineage`, additive): every organism ever in the park; statuses `park | transferred | unknown` (stub). Backfilled on load.
- **Staff**: roles warden/biomedical/xenobiologist; two-pass task selection (assigned enclosure first via `assignedAnchor` → global). Per-cycle `report` tallies. Radio chatter batching state on `st.radio`.
- **Alerts**: `pushAlert(state, {type, title, msg, target})`; types `danger|warning|success|breakthrough|info|radio`. `useGameAlerts` toasts all except `radio`; `useNavigateTarget` handles targets `creature|tile|enclosure|species|research|finances`.
- **Save format**: `state.version = 1`; all new fields are **additive with backfill in `deserialize`/`ensureX()`** (`policies.keeperRadio`, `lineage`, `stats.*BySpecies`, staff `assignedAnchor/report/radio`). Never remove fields.

---

## 5. Feature inventory (all COMPLETE and verified)

**Core (Phases 1–3)** — iso engine, camera, terrain sculpt/paint/water/veg with undo + costs, paths, 46 buildings incl. power radius, fences/gates + enclosure detection, creature AI/pathfinding, habitat evaluation with explainable factors, unknown-biology discovery loop, guests + viewing occlusion, research tree (19) + dynamic field studies, acquisition, park rating, objectives/tutorial, alerts + cause log, save/load.

**Construction UX (4–5A)** — drag-to-line fences with live cost preview, rectangle mode, drag-remove.

**Drama & progression (5B–5C, 6)** — escapes/breaches, security response units, guest panic, expeditions board, contracts, night tours policy, breeding, creature abilities (burrow/camouflage/surge).

**Visual (7, 11, 16)** — pixel-art cohesion pass, high-end asset redesign, ~30 attractions/amenities, elevated transport car that arcs over fences.

**Systems (8, 9, 12–15, 17)** — keeper staff, 6 scenarios (`first_light`, `skitter_bloom`, `containment_crisis`, `night_bloom`, `sovereign_containment`, `sovereign_bloodline`) with goals/fails/mastery, apex Tier-4 species, genetics & morphs, park events + rival rumbles, guest interest system.

**Photo Mode (19)** — letterbox, thirds grid, freeze, PNG capture with watermark/caption, download.

**Post-19 polish**
- **A** Code-quality remediation (hooks deps, memoization, complexity, art API config objects).
- **B** Keeper Priorities (assign keeper → enclosure; flexible fallback).
- **C** Staff Report Card + Input UX (left-drag pan, right-click cancel, wheel zoom, toolbar sync).
- **D** Game-feel (eased zoom to cursor, pan inertia, breach shake, placement pop + dust; reduced-motion aware).
- **E (20)** Ambient Audio (synth wind/rain/night hum, clicks, place/deny/impact, per-type stingers, mute+volume), **Sovereign Bloodline** scenario (BRUTAL, breeding under a Cycle-16 deadline; nyxarr now "Solitary · Pair-Tolerant" max 2), Creature Idle Life (auto-derived blink frames, breathing, tail-flick, fading footprints), Keeper Markers (role-tinted pins over assigned pens).
- **F (21)** Edge Scrolling (canvas-only band, arming delay, map clamp, toggle), Bloodline Ledger (registry + tree + pairing outlook), Keeper Radio Chatter (batched feed-only pings, policy switch, chirp).

---

## 6. Controls & UX reference

- Left click select · left-drag pan (Select mode) · right-click cancel tool / clear selection · right-drag pan · wheel zoom to cursor · **edge glide** when pointer rests within 28 px of the canvas edge (toggle in HUD speaker popover).
- Hotkeys: `Space` pause · `1`/`3` speed · `Esc` cancel to Select · `Ctrl/Cmd+Z` undo terrain · Photo mode: `Space` capture, `Esc` exit.
- localStorage keys: `aetherion_tutorial_done`, `aetherion_scenarios_done`, `aetherion_audio_enabled`, `aetherion_audio_volume`, `aetherion_edge_scroll`.
- Debug/test hooks on `window`: `__game` (controller: `.state`, `.stepTicks(n)`), `__gameRenderer` (`.cam`, `.selection`, `.centerOn(x,y)`, `.fx`, `._keeperPins`, `.sheetFor(id)`, `.idleLife()`), `__gameInput` (`.edge`, `.pointer`), `__audio` (`.log`, `.bedTargets(state)`, `.stinger(type)`).

## 7. Design system

Dark "Night-Lab" palette (CSS variables in `index.css`): bg `#070A0E/#0B1018`, panels `#0C121B/#101A26`, text `#E7EEF8/#B7C4D6/#7F93AD`, lines `#1B2A3D`, accents cyan `#2DE2E6`, seaglass `#6EF3C5`, violet `#8AA4FF`, amber `#F2C14E`, rose `#FF5C7A`; semantic success/warning/danger/info. Fonts: **Space Grotesk** (UI) + **IBM Plex Mono** (data). Utility classes `nl-panel`, `nl-panel-header`, `nl-tool`, `nl-scroll`. Full spec: `/app/design_guidelines.md` (JSON). Every interactive/critical element has a kebab-case `data-testid`.

---

## 8. Testing status & baselines

| Iteration | Scope | Result |
|---|---|---|
| 17 | Game-feel pass | 100% |
| 18 | Phase E (audio, bloodline scenario, idle life, markers) | 100% (backend 6/6, frontend 39/39) |
| 19 | Phase F (edge scroll, ledger, radio) | 100% (backend 19/19, frontend 28/28) |

Local suites last run green (sequentially): `smoke_game`, `input_ux_test`, `keeper_priorities_test`, `gamefeel_test`, `phase8_staff_test`, `phase6b_test`, `phase9_scenarios_test`, `phase17_sovereign_test`, `phase20_features_test` (39/39), `phase21_features_test` (28/28).

---

## 9. Known issues, caveats & gotchas

**No open bugs.** Items below are caveats to be aware of:

1. **Flaky-by-design test checks** — `smoke_game.py` TEST F ("creature panel", labelled SOFT-FAIL on click precision) clicks a moving creature; `comprehensive_test.py`/`focused_test.py` have SOFT-FAIL toast checks. `gamefeel_test.py` inertia/settle checks and `phase17` TEST 6a (at-large timer race) fail only under CPU contention (parallel browsers). Run suites one at a time.
2. **Headless rAF is ~30 fps** — frame-based TTLs (footprints 210 frames, pops 22 frames) take longer in wall-clock than at 60 fps; tests poll instead of fixed sleeps.
3. **Playwright chromium binary** occasionally disappears after the testing agent updates Playwright → `playwright install chromium`.
4. **Blink frames** are auto-derived from pale eye highlights; 11/19 species get blink frames (species with saturated glowing eyes or none — hollowcrest, mosswarden, vantha, umbra, voltari, emberoot, skitter, rhoak — intentionally don't blink; they still breathe/flick).
5. **Audio autoplay** — the AudioContext is created on the first pointerdown/keydown (browser policy). Before that, one-shots are logged but silent.
6. **Sovereign Bloodline balance** — organic pairing can happen within the first cycle if welfare starts high; pressure comes from water/terrain needs, dual apex fence testing, adult-capacity (must transfer matured offspring), the Cycle-16 deadline and the inbred-birth fail. Not yet play-balanced with real players.
7. **Nyxarr social change is global** — `social.max` 1→2 and "adults-only capacity" in `breedingTick` apply to all species (loosens breeding by at most one birth at exactly max group size). Existing scenario tests still pass.
8. **Radio chatter** counts only feeds/cleans/treats/repairs completed **inside the keeper's assigned pen**; observation tasks don't ping. Batches: 30-tick gather, 300-tick quiet.
9. **Popovers** (alerts, settings) don't close on outside click — consistent with existing pattern.
10. **Backend is a thin save service** — no auth; saves are public to anyone with the URL. Fine for a demo; add auth before any multi-user deployment.
11. **Deprecation warnings** in frontend logs (`DEP_WEBPACK_COMPILATION_ASSETS`) come from react-scripts/webpack; harmless.

---

## 10. What's next (prioritised backlog)

**P1 – Player-facing**
- **Photo Album** — persist captured photos (IndexedDB or backend) and add an in-game gallery with re-download.
- **Pairing Planner** — pick two creatures on the map to see projected inbreeding before moving them; "recommended pairings" sort in the ledger.
- **Sovereign Bloodline balance pass** — tune deadline/damage/cash after playtesting; consider a Cycle-16 "extension" contract.

**P2 – Polish**
- **Ambient Mix** — separate sliders for UI / ambience / stingers; optional reverb bus.
- **Keeper Voices** — call signs + per-keeper phrase pools for radio chatter.
- **Popover dismissal** on outside click / Esc for alerts + settings.

**P3 – Platform**
- Save-slot ownership/auth if the app is ever multi-user.
- Bundle-size review (framer-motion, recharts, react-query, swr are installed but lightly/unused).
- Optional: offscreen-canvas caching for footprints/pins if creature counts grow beyond ~100.

---

## 11. How to add things safely (conventions)

- New sim state → add default in `createNewGame` **and** a backfill in `deserialize`/`ensureX()`; never rename/remove fields.
- New alert type → add colour in `HudBar.ALERT_COLORS`, decide toast routing in `useGameAlerts.routeAlert`, add a stinger case in `audio.stinger`.
- New building/species/research/scenario → data files under `game/data/`; painters in `game/art/`; scenario goals may expose `progress(s)` for tracker chips; setup supports `research, discovered, policies, starterEnclosure, buildings, creatures, staff, cash`.
- Render-only effects belong in `fx.js`/`renderer.js` and must never touch `game.state`.
- Every new interactive element gets a unique kebab-case `data-testid`; add a `tests/phaseNN_*.py` suite and run `testing_agent_v3` for an `iteration_NN.json` before declaring a phase complete.
- Keep `/app/plan.md` current (phases, decisions, verification baselines).
