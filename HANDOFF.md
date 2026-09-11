# Aetherion Reserve — Complete Technical & Product Handoff

_Last updated after **Phase Y** (Night Mood Icons · Lamp Auto-Suggest · Floodlight Power Link · Contact Sheet Filters)._
_Verified state: `testing_agent_v3` iteration_33 = **117/117 (100%)**; re-verified on a fresh container today: backend suite ✅, `determinism_test` 8/8, `lighting_test` 19/19._

Preview: https://discovery-bio.preview.emergentagent.com

---

## 0. TL;DR for the next engineer

| | |
|---|---|
| **What** | Desktop creature-containment / park-management game. 19 fictional species with **unknown biology** discovered by observation. Terrain, fences/enclosures, creature AI, guests/economy, research, staff, genetics/breeding, weather/day-night, tension/escapes, scenarios, photo album, night lighting. |
| **Stack** | React 19 (CRA + craco) · Tailwind + Shadcn/UI · **Three.js 0.185 WebGL world** with a **Canvas-2D pixel-art fallback** · Web Audio synth · FastAPI + Motor · MongoDB (2 collections). **All simulation runs client-side**, deterministic, 100 ms fixed timestep. |
| **Backend** | Thin persistence only: `/api/saves` CRUD + `/api/photos` CRUD, scoped per browser by `X-Player-Token`. |
| **State of play** | **Zero open bugs. Zero pending tasks.** Every user-requested phase (1–21, A–H, J–O, R, S, U, V, W, X, Y) is shipped and independently verified. Awaiting the user's next feature pick. |
| **Hard rules** | UI/renderer **never** mutates sim state · sim RNG only via `rnd()` · save schema changes are **additive only** · Ops Deck is the only HUD (56 px dock + 320 px drawer) · every interactive element has a kebab-case `data-testid` · run browser suites **one at a time**. |
| **Fresh-container checklist** | (1) `playwright install chromium` if suites say the binary is missing. (2) If the frontend crash-loops with `ENOSPC … file watchers`, the polling env vars in `frontend/.env` (added today, see §2.3) fix it. |

---

## 1. Product overview

Players run a research reserve ("Night-Lab Containment OS" identity) for organisms humanity does not understand. They sculpt terrain, fence enclosures, release creatures, and **learn each species' hidden biology by watching behaviour** (evidence → hypothesis → field-study research → breakthrough + grant). Guests arrive when there is something to see; the economy, research tree, staff, security, expeditions, contracts, genetics/breeding and a tension/escape loop layer on top. Three modes: **Management** (◈150 000 budget, progression, unknown biology), **Sandbox** (everything unlocked), **Scenarios** (6 hand-crafted missions with goals/fail states/mastery).

Content counts: **19 species** (`veyra skitter thornback hollowcrest mirefin silttitan shardling mosswarden rhoak vantha karrgan lumen umbra voltari emberoot` + Tier-4 apex `nyxarr zephyrmaw aurox sylvarr`), **~48 buildings** (incl. `path_lamp` and `floodlight` lamps), **26 research projects**, **6 scenarios** (`first_light skitter_bloom containment_crisis night_bloom sovereign_containment sovereign_bloodline`), 4 expedition zones, 5 contract templates, 3 staff roles.

---

## 2. Running / operating

### 2.1 Services & commands

| Thing | How |
|---|---|
| Services | `supervisorctl status` → `backend` (:8001, uvicorn --reload), `frontend` (:3000, craco/CRA), `mongodb` |
| Restart | `supervisorctl restart backend` / `frontend` — hot reload is on; restart only after dependency or `.env` changes |
| Logs | `tail -n 50 /var/log/supervisor/backend.*.log /var/log/supervisor/frontend.*.log` |
| Frontend compile check | `cd /app/frontend && npx esbuild src/ --loader:.js=jsx --bundle --outfile=/dev/null` (clean as of today) |
| Package mgmt | `yarn add …` (never npm) · `pip install … && pip freeze > requirements.txt` |
| Health | `curl $REACT_APP_BACKEND_URL/api/` → `{"status":"ok"}` |
| Local dev outside the container | See `README.md` (docker mongo + uvicorn + yarn start); `backend/.env.example` documents variables |

### 2.2 Environment variables (never rewrite the files; only append)

- `backend/.env`: `MONGO_URL`, `DB_NAME`, `CORS_ORIGINS`, `EMERGENT_LLM_KEY` (used **only** by the offline texture tool `backend/tools/gen_textures.py`, not by the running server).
- `frontend/.env`: `REACT_APP_BACKEND_URL` (**never modify**), `WDS_SOCKET_PORT`, `ENABLE_HEALTH_CHECK`, plus (added today) `CHOKIDAR_USEPOLLING=true`, `WATCHPACK_POLLING=1000`.
- `.env` files are gitignored; nothing secret is committed.

### 2.3 Fresh-container fixes applied today (environment, not code)

1. **Frontend crash-loop `ENOSPC: System limit for number of file watchers reached`.** Root cause: the kernel's per-UID inotify budget (`fs.inotify.max_user_watches = 12288`) is shared node-wide and was exhausted by other tenants — only 4 watches were in use inside this container, and `sysctl` is read-only here. Fix: CRA's chokidar (public/ watcher) and webpack's watchpack now poll (`CHOKIDAR_USEPOLLING=true`, `WATCHPACK_POLLING=1000` in `frontend/.env`). Hot reload still works (~1 s latency). If a future container has a healthy inotify budget these two lines can simply be removed.
2. **Playwright chromium binary missing** (`/pw-browsers/chromium_headless_shell-1234`) → `python3 -m playwright install chromium`. Recurs whenever Playwright is upgraded by the testing agent.

### 2.4 Tests (Playwright / requests, Python 3.11, async)

```bash
cd /app
python3 tests/backend_regression_test.py       # save service CRUD (fast)
python3 tests/backend_comprehensive_test.py    # saves + photos + token validation
python3 tests/determinism_test.py              # seeded replay + save/continue equality (8 checks)
python3 tests/lighting_test.py                 # Phase X/Y night lighting (19 checks)
python3 tests/photo_album_test.py              # album, captions, contact sheet + filters (20 checks)
python3 tests/render3d_test.py                 # forced-3D under SwiftShader (31 checks) — SLOW, run alone
```

- All suites read `AETHERION_URL` (`tests/config.py`; default = hosted preview). Backend suites append `/api`.
- **Run browser suites one at a time** — they count rendered frames; concurrency starves the headless renderer and produces timing flakes. SwiftShader 3D suites especially.
- Every save-creating suite deletes its saves in `finally` (`tests/save_cleanup.py`). Use a separate `DB_NAME` when pointing at a real DB.
- Testing-agent reports: `/app/test_reports/iteration_{1..33}.json` (+ `pytest/`, `local/`, `phase_mn_testing_report.md`).

---

## 3. Backend — `/app/backend/server.py` (360 lines)

FastAPI + Motor. Router prefix `/api`. CORS from `CORS_ORIGINS`. Indexes created at startup (each independently, failures logged, never blocking): `saves.id` unique, `saves.updated_at`, `saves.(owner, updated_at)`, `photos.id` unique, `photos.(owner, created_at)`.

### 3.1 Ownership model (`X-Player-Token`)
The browser mints a UUID once (`localStorage.aetherion_player_token`) and an axios interceptor in `game/controller.js` sends it on every request. Token must be ≤64 chars of `[A-Za-z0-9-]` (else **400**). Documents store it as `owner`. Callers see their own docs **plus legacy ownerless docs**; a legacy save is *adopted* by the first player who `PUT`s it. Photos are always written with an owner (unscoped callers see only ownerless photos). This is a stopgap, **not authentication** — clearing localStorage orphans saves.

### 3.2 Endpoints

| Method | Path | Notes |
|---|---|---|
| GET | `/api/` | health |
| GET | `/api/saves?limit=1..200&skip=0..10000` | `List[SaveMeta]` (no `state`), newest first |
| GET | `/api/saves/{id}` | full save (meta + `state`) — 404 if not owned |
| POST | `/api/saves` | body `SaveCreate {name, park_name, mode, day, cash, rating, creatures, state}` → `SaveMeta` |
| PUT | `/api/saves/{id}` | overwrite; adopts ownerless legacy saves |
| DELETE | `/api/saves/{id}` | `{deleted}` |
| GET | `/api/photos?limit=1..200&skip` | `List[PhotoMeta]` (thumb only, never the full image) |
| GET | `/api/photos/{id}` | `PhotoFull` incl. `image` data URL |
| POST | `/api/photos` | `PhotoCreate {park_name, mode, day, clock, caption, width, height, image, thumb}`; image ≤ 6 MB, thumb ≤ 400 KB, must match `^data:image/(jpeg|png|webp);base64,…` (**413 / 400**) |
| PATCH | `/api/photos/{id}` | `{caption}` → sanitised (single line, no control chars, ≤140) |
| DELETE | `/api/photos/{id}` | |

### 3.3 Collections

```
saves : { id (uuid), name, park_name, mode, day, cash, rating, creatures, state (full serialized game), updated_at (ISO UTC), owner }
photos: { id (uuid), park_name, mode, day, clock, caption, width, height, image (data URL), thumb (data URL), created_at, owner }
```
All ids are UUID strings; `_id` is always projected out. Datetimes are `datetime.now(timezone.utc).isoformat()`.

### 3.4 Offline tooling
`backend/tools/gen_textures.py` — one-off PBR texture pipeline (Gemini image model via `emergentintegrations`, then Pillow/numpy seamless-ify + normal/roughness derivation) writing `frontend/public/textures/<key>_{albedo,normal,rough}.jpg` + `manifest.json`. Idempotent (reuses `texture_src/`). Not part of the runtime.

---

## 4. Frontend code map — `/app/frontend/src`

### 4.1 Shell & React layer (`components/`)
```
App.js                          menu <-> game; Sonner toaster (dark theme); audio.install(); load-error toast
components/ErrorBoundary.jsx    render-crash panel (retry / back to menu) around GameScreen
components/game/
  MainMenu.jsx                  park name, world-seed picker (SeedField), mode cards, save slots (list/load/delete)
  GameScreen.jsx                composes HUD, canvas, toolbar, inspect panel, Ops Deck, banners, trackers, photo mode
  GameCanvas.jsx                two stacked canvases (WebGL world under, 2D overlay on top); rAF loop; 3D fallback logic
  HudBar.jsx                    identity, pause/1x/3x, day/clock/weather chip, cash/guests/rating, drawer buttons,
                                alerts popover, audio popover (volume, edge scroll, subtitles), Photo, Save, Help, Menu
  OpsDock.jsx + Drawer.jsx      the ONLY HUD: 56px left dock (Field Ops, Staff, Species, Research, Finances, Photo Album)
                                + 320px drawer; DRAWER_IDS = fieldops|staff|db|research|finances|ledger|album
  ScreenFrame.jsx               host-aware chrome (drawer host = single header + screen's own close button)
  BuildToolbar.jsx              Select/Pan/Demolish/Undo, brush 1-3, tabs Terrain|Ground|Water|Flora|Paths|Fences|
                                Habitat|Facilities|Attractions; Facilities lighting group has "Light the gaps" (Y2)
  InspectPanel.jsx + panels/    CreaturePanel (condition, health, genes, ledger link), EnclosurePanel (habitat factors,
                                TENSION section, breach banners), BuildingPanel (LampReport w/ power state), FencePanel, Bar
  SpeciesDatabase.jsx           roster (search + family/tier chips) + dossier gated by knowledge; "Plan pairing" shortcut
  BloodlineLedger.jsx           registry + family tree + PairingPlanner.jsx (projected inbreeding, recommendations)
  ResearchScreen / FinanceScreen (chart, ticket slider, Night Tours switch, Night Lighting panel) / StaffScreen /
  AcquisitionScreen (+fieldops/ExpeditionsTab, ContractsTab) / ObjectivesPanel / ScenarioTracker
  AlbumScreen.jsx               grid/detail, captions, download, delete, contact sheet export + From/To cycle & captioned filters (Y4)
  PhotoMode.jsx                 letterbox capture -> JPEG + thumb auto-saved to /api/photos (status: saved/failed/retry)
  OverlayToggles.jsx            habitat | power | view | lighting
  EmergencyBanner.jsx           escapes, stampede, BARRIER DOWN gap chips, PERIMETER OPEN variant
  TutorialOverlay.jsx, Portrait.jsx (live portraits, shared ticker), tone.js (shared colour-tone helpers)
  hooks/                        useGame (uiRefresh subscription), useDrawer, useGameScreenActions, useGameAlerts,
                                useHotkeys, useNavigateTarget
components/ui/                  Shadcn primitives (always prefer these over raw HTML)
```

### 4.2 Simulation core (`game/`, pure JS, no React) — ~9.6k lines
```
constants.js     MAP_SIZE 72, TICK_MS 100, TICKS_PER_DAY 1800, palette/tiles/materials/veg/fences/costs
state.js         createNewGame({parkName, mode, seed, seedLabel}), serialize/deserialize (+ additive backfills),
                 seeded LCG rnd()/getRngState/setRngState, pushAlert, event bus on/emit, setTimeControls, setTicketPrice, setPolicy
controller.js    GameController singleton `game`: newGame/loadGame/saveGame/listSaves/deleteSave, fixed-step loop,
                 stepTicks(n) [tests], window.__game + window.__gameDebug + game.dev harness
sim.js           tickOnce(state) — ordered subsystem ticks (see §5.2), OBJECTIVES (13), research, computeRating
terrain.js       raise/lower/flatten/smooth/paint/water/veg/path + costs + undo stack
construction.js  buildings/fences/gates/repair/demolish, power radius (isPowered), destroyFence/gaps/rebuildGap,
                 fenceLineEdges/fenceRectEdges, placeFenceLine/Rect
enclosures.js    flood-fill enclosure detection (cached, _encDirty), evaluateHabitat w/ explainable + masked causes
pathfind.js      A* with fence-edge blocking
creatures.js     needs, AI state machine, welfare (fast/slow channels), fence pressure, cohab, abilities
                 (camouflage/burrow/surge), breeding, killCreature, adjacentOpenTile (fence-aware births)
genetics.js / lineage.js / pairing.js   heritable genes+morphs+inbreeding · permanent bloodline registry · pure pairing projections
knowledge.js     unknown-biology gating: evidence -> hypothesis -> discovery; getSpeciesView is the ONLY UI read path
guests.js        spawn/BFS paths/needs/viewing visibility/opinions/spending/panic; footfall bump (Y2)
economy.js       spend/income, dailyRollover (lightingRollover + footfallDecay at dawn), parkValue
lighting.js      night lighting model (§6.6): lightMap cache, guestLightingTick, lightingRollover, safetyCarrot,
                 relayPowered/lampPowered (Y3), reports, footfall + suggestLampSpots (Y2), guestMoodCounts (Y1)
staff.js         wardens/biomedical/xenobiologists: two-pass task selection, report card, radio chatter, gap rebuilds
security.js      response posts: dispatch/capture/holding/release, incident separation
tension.js + tensionProfile.js   conflicts (aggression, severity), breach risk -> breach, degradation multipliers
events.js / rivalry.js / expeditions.js / contracts.js / scenarios.js / weather.js / transport.js / attractions.js
vocals.js        creature call scheduler + species voice signatures + subtitle captions (captionTint/captionSwatch)
audio.js         Web Audio synth: ambience beds, one-shots, stingers, PannerNode positional voices, settings
album.js         client-only: buildContactSheet/sheetLayout/sheetOrder/sheetFileName, filterPhotos/photoDays (Y4)
renderer.js      (1740 lines) 2D isometric pipeline + the authoritative overlay: selection/hover/previews, overlays
                 (habitat/power/view/lighting), tension markers, gap markers, keeper pins, vocal captions,
                 guest mood glyphs (Y1), lamp suggestion markers (Y2), unpowered flood rings (Y3)
input.js         tools, edge snapping, drag-to-line/rect fences, drag-pan, right-click cancel, edge scrolling
fx.js            render-only: zoom easing, pan inertia, shake, pops, dust, footprints, species auras
seed.js          parseSeed(text): blank->null, digits->int, phrase->FNV-1a
data/            species.js (19), buildings.js (~48), research.js (26), scenarios.js (6), expeditions.js (4), staffRoles.js (3)
art/             procedural pixel painters: pixel.js toolkit, rig.js, creatures_a/b/c.js (19 painters), creatures.js (sheet
                 baker), juvenile.js (derived cub/young sheets), buildings.js, flora.js, guests.js, staff.js, terrain_tex.js,
                 flags.js (ART_V2, RENDER_3D, RENDER_3D_FORCED)
```

### 4.3 3D world (`game/three/`, ~3.2k lines, **visuals only**)
```
world.js        World3D: WebGL2 renderer, orthographic 2:1 dimetric camera (yaw 45°, pitch 30°) locked to the 2D cam,
                quality tiers low|medium|high (?gfx=, localStorage aetherion.gfx, adaptive drop when avg frame > 34 ms),
                webglAvailable()/softwareRenderer() detection
iso.js          projection helpers matching renderer.worldPx exactly (picking stays in 2D)
terrain.js      heightfield + splat PBR (textures from /public/textures), shoreline beach profile, wetness
water.js        depth from bed, chop, rain rings          lighting.js  LightRig: sun/moon/hemi, day-phase curves
materials.js / textures.js   PBR material registry + generated/loaded texture sets, studio env map
flora3d.js / fences3d.js / buildings3d.js / props3d.js   instanced procedural kits (shader wind, energy-field fences, lit windows)
creatures3d.js  rigs for 9 body plans, skin PBR, gene/morph tints, state animation
people3d.js     instanced guests/staff/security with walk cycles
lamps3d.js      automatic path lamps + roof-corner floodlights + PLAYER lamps gated by power (Y3); dusk->night switch; 0/4/8 real point lights by tier
weather3d.js / post.js   storm gusts, rain splashes / post stack
entities.js     EntityLayers orchestrator
```

---

## 5. Simulation architecture

### 5.1 Core invariants
- **Authoritative state object** `game.state` — plain JSON-able data. UI reads it; **only sim code mutates it** (UI goes through controlled mutators: `setTimeControls`, `setTicketPrice`, `setPolicy`, construction/terrain functions, `input.js` tool application). Renderer/three/fx **never** write to state or call `rnd()`.
- **Fixed timestep**: `TICK_MS = 100`; speeds pause/1x/3x; `TICKS_PER_DAY = 1800` (3 min per "Cycle" at 1x). Loop: `setInterval(TICK_MS/2)` accumulator, max 8 steps per interval, spiral-of-death guard. UI refresh via `emit('uiRefresh')` every 400 ms.
- **Determinism**: single seeded LCG `rnd()` in `state.js`. `createNewGame({seed})` seeds it (clock-derived when blank; `seedLabel` keeps what the player typed). `serialize()` snapshots the cursor into `state.rngState`; `deserialize()` restores it → *continue-to-N equals load-then-run-to-N* (`determinism_test.py`). Render-only randomness uses `Math.random`. Transient caches are `_`-prefixed (`_light`, `_footfall`, `_encDirty`, `_guestFeed`, …) and are stripped on save.
- **Save format**: `state.version = 1`. **Every** new field must have a default in `createNewGame` **and** a backfill in `deserialize`/`ensureX()`. Never rename or remove fields. Load hardening drops unknown species/buildings/research with `console.warn('[load] …')`.

### 5.2 Tick order (`sim.js tickOnce`)
1. Enclosure cache refresh when dirty (T%5)
2. Creatures (snapshot loop; `c._dead` skip): movement every tick; needs+decide T%20; welfare T%40; fence pressure + breachTick T%150; cohab T%100; abilities T%120; breeding T%200; waste T%400 — all staggered by `id`
3. `conflictTick` T%90===45 (≤1 incident park-wide)
4. `staffTick`
5. Guests: movement every tick (bumps footfall); needs (incl. `guestLightingTick`) + decide T%20; spawn/cull T%25
6. Weather T%25; storm fence damage T%200 (50 %)
7. Security units every tick; `securityTick` T%40
8. Expeditions T%10; contracts T%60
9. Events T%30; rivalry T%45===15
10. Transport every tick
11. Research T%10; dynamic projects refresh T%60
12. Objectives T%50; rating T%100; scenario T%100===30
13. `dailyRollover` at T%1800 (finances, lightingRollover, footfallDecay, contract refresh, etc.)

### 5.3 World & geometry
- 72×72 tiles; flat arrays `heights/materials/water/veg/paths`, `idx(x,y) = y*72+x`.
- Iso projection: `worldPx = ((x-y)*32, (x+y)*16 - h*10)`; tiles centred on `(x+0.5, y+0.5)`.
- Fences are **edge-keyed** `"x,y,E|S"` (E = boundary with x+1, S = with y+1) with tier (1–4) and hp. Gates are edges too. Enclosures = flood-fill regions bounded by fences (region ids renumber on every fence edit — never persist them; `gaps` are matched geometrically).
- Power: `power` relays with `powerRadius`; `offlineUntil` when surge-damaged (Voltari).

### 5.4 Unknown biology
Species define `hiddenAttrs`. `knowledge[speciesId].discovered` gates both UI text (via `getSpeciesView`) and habitat-cause explanations (masked causes). Evidence accrues from behaviour → hypothesis alert → dynamic Field Study research → `discover()` → BREAKTHROUGH toast + grant. Sandbox starts fully discovered.

### 5.5 Tension / escape loop (Phase O)
Degradation multiplier = volatility(danger) × tierFactor, halved-ish by assigned keepers. Stress ≥.6 radio callout; ≥.75 aggression possible; ≥.7 + weak/undersized fence → BREACH RISK warning → breach (`destroyFence` → `state.gaps[key]`) → escaped → security capture → HOLDING if the pen is still open → warden rebuild → release. Deaths are permanent (`stats.deaths`, ledger DECEASED). All UI feedback lives in EnclosurePanel TENSION, EmergencyBanner and CreaturePanel CONDITION.

### 5.6 Night lighting model (Phases X + Y)
- `lampsOn` = dusk|night; `isNight` = night only. `lightMap(state)` is a `Uint8Array` cache keyed by lamp placements **and floodlight power state** (`:p`/`:x`) — `LIT_PATH=1` (r 2.5), `LIT_FLOOD=2` (r 4.0). **Unpowered floodlights contribute nothing** (`relayPowered` mirrors `construction.isPowered` incl. `offlineUntil`, kept local to avoid an import cycle).
- `guestLightingTick`: on a path tile at night → lit `+0.006` satisfaction / dark `−0.012`, tallies `stats.lighting.{lit,dark}`, one-off praise/gripe opinions (25 %), sets `g.lit = 'lit'|'dark'|null` (renderer reads this for Y1 glyphs).
- Dawn: `lightingRollover` folds the lit share into `stats.nightSafety` EMA (0.6/0.4); `safetyCarrot = 0.05 × nightSafety` added to rating safety.
- Y2: `state._footfall` (Float32Array, transient) bumped per guest step, ×0.7 at dawn; `suggestLampSpots(state,{max})` scores unlit path tiles (footfall ×0.02 dominant, +entrance proximity, +attraction approaches), spaces picks by path-lamp radius.
- Reports: `lightingReport` (coverage, floodsOffline, tonight/lastNight, guestsLit/Dark, safetyBonus), `lampReport(b)` (`needsPower/powered/lit`).

### 5.7 Alerts & navigation
`pushAlert(state, {type, title, msg, target})`; types `danger|warning|success|breakthrough|info|radio` (state caps at 60; `game.dev.watchAlerts()` keeps an unbounded log). `useGameAlerts` toasts everything except `radio`; `useNavigateTarget` handles `creature|tile|enclosure|species|research|finances|objectives`.

---

## 6. Rendering architecture

- **Two stacked canvases** (`GameCanvas.jsx`): WebGL `World3D` underneath; the classic 2D canvas on top as a transparent **authoritative overlay** (input, picking `screenToTile/edgeFromPointer/vertexFromPointer`, selection rings, hover, tool previews, HUD markers, overlays, captions, mood glyphs). In classic mode the 2D canvas draws the whole pixel-art world.
- **Mode selection**: `RENDER_3D` (default on; off via `?classic=1` or `localStorage['aetherion.render3d']='off'`) **and** WebGL2 available **and** (not software GL **or** `?render3d=1`). Headless Chromium/SwiftShader therefore runs **classic** by default → fast, stable tests; `render3d_test.py` forces 3D with `?render3d=1&gfx=low` and polls frames. `window.__renderMode` reports `'3d'|'classic'`. A 3D init failure or dropped context falls back to classic at runtime (`onWorldDropped`).
- **Camera**: isometric 2:1 dimetric, yaw 45°, pitch 30°, orthographic; zoom/pan mirror the 2D cam exactly. Picking math is unchanged from the 2D engine.
- **Quality tiers** `low|medium|high` (`?gfx=`, persisted in `aetherion.gfx`, adaptive downgrade unless pinned). Point-light budget for lamps 0/4/8.
- **Classic art** (ART_V2 default on): 1 art px = 1 device px sprite sheets baked at load (idle 6 / walk 8 / threat 4 / lunge 4), cel/rim/halo post-passes, exact blink frames from recorded eye rects, juvenile sheets derived from adult bakes. Review: `python tests/art_gallery.py a|b|c [night]` → `artifacts/`.
- **Audio** (`audio.js`): AudioContext unlocks on first gesture; ambience beds by weather/phase; stingers per alert type; creature voices/vocals positioned with PannerNode; settings in localStorage.

---

## 7. Feature inventory (all COMPLETE and verified)

| Phase | Delivered |
|---|---|
| 1–3 Core | Iso engine, camera, terrain sculpt/paint/water/veg (+undo, costs), paths, buildings + power radius, fences/gates + enclosure detection, creature AI/A*, explainable habitat evaluation, unknown-biology loop, guests + viewing occlusion, research tree + dynamic field studies, acquisition, rating, 13 objectives, alerts + cause log, save/load |
| 4–5 | Drag-to-line + rectangle fences w/ live cost preview, security response posts, guest panic/stampede, expeditions board, contracts, Night Tours policy, breeding, abilities (burrow/camouflage/surge) |
| 6–9, 11–17 | Pixel-art cohesion + asset redesign, ~30 attractions/amenities, elevated transport, keeper staff (3 roles, priorities, report card, radio), 6 scenarios w/ mastery, Tier-4 apex species, genetics/morphs/inbreeding, park events + rival rumbles, guest interest |
| 19 Photo Mode | Letterbox, thirds grid, freeze, capture w/ watermark/caption |
| A–H | Code-quality remediation, keeper priorities, input UX (drag-pan, right-click cancel, wheel zoom), game-feel (eased zoom, inertia, shake, pops), ambient audio, Sovereign Bloodline scenario, idle life, keeper markers, edge scrolling, Bloodline Ledger, radio chatter, **creature art rework** (19 painters), assessment fixes (fence-aware births, load backfills, ErrorBoundary, RNG cursor in save, per-player save scoping, `.env.example`s, README) |
| J–K | ART_V2 post-passes; **Ops Deck** dock + drawer shell |
| L | Juvenile art, world-seed picker + HUD seed chip, live portraits, creature voices |
| M–N | Native drawer panels (ScreenFrame host-aware chrome, `drawer:` Tailwind variant), HUD fits 1366–1700, QA pass |
| O | **Creature tension pass**: needs degradation, aggression/conflicts, breach risk → breach → holding → rebuild, deaths, full UI feedback, dev harness |
| R | **Cinematic 3D world**: Three.js pipeline, PBR terrain/water/lighting/post, flora/fences/buildings/props/transport, 9 creature body-plan rigs, instanced people |
| S | Shoreline softening, legacy HUD retired (deck-only), living weather (gusts/chop/wetness/splashes), Species Database filters |
| U | **Photo Album** (backend `/api/photos`, auto-save, drawer gallery), **Pairing Planner**, **Creature Vocals** (3D-positioned, species signatures), **Night Lighting Pass** (`lamps3d.js`) |
| V | Planner shortcut in Species DB, vocal subtitles (toggle `aetherion_subtitles`), **Lamp placement tool** (`path_lamp`, `floodlight` in Facilities), album captions stamped on downloads |
| W | Code-review response (complexity refactors, logged catches, type hints, hardened forced-3D test) |
| X | **Lamp comfort bonus + Lighting overlay** (`lighting.js`, 4th overlay toggle, LampReport, Night Lighting finance panel), **Album contact sheet** (one tall 3-column JPEG), species caption colours, ternary cleanup (`tone.js`) |
| **Y (latest)** | **Y1 Guest Night Mood Icons** — warm lamp glyph over safe guests, cool crescent over guests in the dark (night only, skips panicked/riding; `drawGuestMoodIcons`, `__gameDebug.guestMoods()`). **Y2 Lamp Auto-Suggest** — Facilities `lamp-suggest-button` ("Light the gaps") arms pulsing on-map markers for the darkest busy walkway tiles and selects the Path Lamp tool; markers self-expire and drop the instant a lamp covers them (`renderer.setLampSuggestions/drawLampSuggestions`, `__gameDebug.suggestLampSpots(max)`). **Y3 Floodlight Power Link** — floodlights only shine while an online Power Relay covers them; surge-knocked relays black them out; red-dashed NO POWER ring in the 2D lighting overlay, `BuildingPanel` power state, 3D fixture keeps pole/head but loses lens glow/pool/light; placement rules unchanged. **Y4 Contact Sheet Filters** — From/To cycle Selects + Captioned-only Switch scope both the grid preview and the exported sheet, live `album-sheet-count` ("Exports X of N"); defaults = whole album. |

---

## 8. Controls, hotkeys, flags & debug surface

- **Mouse**: left click select · left-drag pan (Select mode) · right-click cancel tool / clear selection · right-drag pan · wheel zoom to cursor · edge glide within 28 px of the canvas edge (toggle in audio popover).
- **Hotkeys**: `Space` pause · `1`/`3` speed · `Esc` cancel-everything (tool → Select, clear selection, close drawer) · `Ctrl/Cmd+Z` undo terrain · Photo mode: `Space` capture, `Esc` exit.
- **URL params**: `?classic=1` (force 2D) · `?render3d=1` (force 3D even on software GL) · `?gfx=low|medium|high`.
- **localStorage**: `aetherion_player_token`, `aetherion_tutorial_done`, `aetherion_scenarios_done`, `aetherion_audio_enabled`, `aetherion_audio_volume`, `aetherion_edge_scroll`, `aetherion_subtitles`, `aetherion.gfx`, `aetherion.artV2`, `aetherion.render3d`. Tests set `aetherion_tutorial_done` before starting a game.
- **Window hooks** (tests/debug only): `__game` (controller: `.state`, `.stepTicks(n)`, `.newGame({mode, seed})`, `.dev.*` harness — `fenceRect, addCreature, offspring, kill, spawnBuilding, placeBuilding, canPlaceBuilding, demolishBuilding, hireStaff, assignStaff, enclosureAt, enclosures, damageFence, grant, flatten, spawnGuest, watchAlerts/alerts/clearAlerts`), `__gameDebug` (pure: `serialize/deserialize/getRngState/getRngCursor/playerToken/adjacentOpenTile/projectPairing/recommendPartners/bestPairs/lightingReport/lightAt/lampReport/guestLightingTick/suggestLampSpots/guestMoods`), `__gameRenderer` (`.cam .selection .centerOn .fx ._keeperPins .sheetFor .idleLife .setLampSuggestions`), `__gameInput` (`.setSelection .edge .pointer`), `__audio` (`.log .voices .stinger`), `__vocals`, `__albumDebug.lastSheet`, `__portraitLive`, `__renderMode`, `__world`.

---

## 9. Design system

Dark "Night-Lab" palette as CSS variables in `index.css`: bg `#070A0E / #0B1018 / #0F1724`, panels `#0C121B / #101A26 / #0A0F16`, text `#E7EEF8 / #B7C4D6 / #7F93AD`, lines `#1B2A3D / #24384F`, accents cyan `#2DE2E6`, seaglass `#6EF3C5`, violet `#8AA4FF`, amber `#F2C14E`, rose `#FF5C7A`; semantic success `#3EE28A`, warning `#F2C14E`, danger `#FF4D6D`, info `#4DB6FF`. Fonts **Space Grotesk** (UI) + **IBM Plex Mono** (data/labels). Utility classes `nl-panel`, `nl-panel-header`, `nl-tool`, `nl-scroll`; Tailwind variant `drawer:` = `[data-host="drawer"] &`. Icons: `lucide-react` only. Toasts: Sonner themed via `TOAST_OPTIONS`. Full specs: `/app/design_guidelines.md` (UI) and `/app/design_guidelines_3d.md` (3D materials/lighting/texture prompts). Ops Deck geometry is fixed: **56 px dock + 320 px drawer (≤376 px)**; left overlays shift to `left-[376px]` when a drawer is open.

---

## 10. Test suites (`/app/tests`, 60+ files)

**Backend**: `backend_api_test`, `backend_regression_test`, `backend_comprehensive_test`, `backend_ownerless_test`, `remediation_backend_test`, `determinism_backend_test`.
**Core/determinism**: `determinism_test`, `save_compat_test`, `birth_boundary_test`, `assessment_fixes_test`, `smoke_game`, `scenario_discovery`.
**Systems by phase**: `phase5_test` (rect fences, security, expeditions, contracts), `phase6a/6b_test` (panic, night tours, breeding, abilities), `phase8_staff_test`, `phase9_scenarios_test`, `phase17_sovereign_test`, `phase19_photo_test`, `phase20_features_test`, `phase21_features_test`, `keeper_priorities_test`, `fence_drag_test`, `input_ux_test`, `gamefeel_test`, `weather_detailed_test`, `placement_alignment_test`, `tension_test` (48 checks), `seed_picker_test`, `species_filters_test`, `pairing_planner_test`, `phase_v_test`, `lighting_test` (19), `photo_album_test` (20).
**Art/visual**: `creature_art_test`, `art_v2_test` (+`art_v2_baseline.json`), `juvenile_art_test`, `live_portraits_test`, `creature_voices_test`, `creature_vocals_test` (classic + forced 3D), `phase7_*`, `phase16_visual`, `visual_v2`, galleries (`art_gallery`, `juvenile_gallery`).
**HUD**: `ops_deck_test`, `ops_deck_native_test`, `hud_responsiveness_test`, `ui_integration_test`, `comprehensive_test`, `focused_test`, `phase_mn_manual_test`.
**3D**: `render3d_test` (31 checks, SwiftShader, run alone), `_dbg_3d.py/_dbg_quality.py/_dbg_shader.py` (debug helpers), `perf_probe`.
Helpers: `config.py` (URL), `save_cleanup.py`, `phase6_helpers.py` (`click_tile`, `tile_screen`, boot helpers).

**Baselines**: iteration_31 (Phase V) → 36/36 + 19/19 · iteration_32 (Phase X) → 11/11 + 52/52 · **iteration_33 (Phase Y) → 117/117**. Local Phase Y sweeps: lighting 19/19, photo_album 20/20, render3d 31/31, determinism 8/8, save_compat 6/6, phase_v 19/19.

---

## 11. Known caveats & gotchas (no open bugs)

1. **Headless = classic renderer.** 3D lighting/lamps can only be *seen* on hardware WebGL; screenshot tooling shows the 2D world. Use `?render3d=1&gfx=low` + frame polling for 3D assertions.
2. **Browser suites must run sequentially** (frame-counting; SwiftShader 3D suites especially). Headless rAF ≈ 30 fps — poll rather than sleep for frame-based TTLs.
3. **Playwright chromium** disappears when the testing agent bumps Playwright → `python3 -m playwright install chromium`.
4. **inotify budget** may be exhausted node-wide → keep the polling env vars in `frontend/.env` (§2.3). Symptom: `ENOSPC … file watchers` crash-loop, `supervisorctl status frontend` stuck at STARTING.
5. **Save scoping is not auth**: token in localStorage; legacy ownerless saves visible to all until adopted. Add real accounts before any public multi-user deployment.
6. **Audio autoplay**: AudioContext is created on the first pointerdown/keydown; before that one-shots are logged but silent.
7. **Soft-fail checks** by design: `smoke_game` TEST F (clicking a moving creature), toast checks in `comprehensive_test`/`focused_test`; `gamefeel_test` inertia and `phase17` 6a can fail only under CPU contention.
8. **Region ids renumber** after every fence edit — never persist an enclosure id as identity; `gaps` are matched geometrically.
9. **CRA dev overlay** iframe sits above the ErrorBoundary in dev builds; tests remove it before clicking. `DEP_WEBPACK_COMPILATION_ASSETS` warnings are harmless.
10. **Balance not human-playtested**: Sovereign Bloodline difficulty, breeding cooldown, tension rates, lighting deltas — all tuned by simulation only.
11. **Floodlight placement does not require power** (deliberate, keeps render3d B27 green); an unpowered flood simply stays dark and is reported as such.
12. `frontend/yarn.lock` shows as modified in `git status` — touched by the platform's install step; safe to commit or ignore.

---

## 12. Conventions — how to add things safely

- **New sim state** → default in `createNewGame` **and** backfill in `deserialize`/`ensureX()`; `_`-prefix transient caches so `serialize` strips them. Never rename/remove fields.
- **New alert type** → colour in `HudBar.ALERT_COLORS`, routing in `useGameAlerts.routeAlert`, stinger case in `audio.stinger`.
- **New building/species/research/scenario** → data files in `game/data/`; 2D painter in `game/art/`; 3D kit in `game/three/*3d.js`; scenario goals may expose `progress(s)`.
- **Render-only effects** belong in `renderer.js` / `fx.js` / `three/*` and must never touch `game.state` or `rnd()`. Cross-module lookups that would create import cycles (lighting ↔ construction ↔ economy) are mirrored locally with a comment.
- **UI** → Shadcn primitives, lucide icons, design tokens, `tone.js` helpers instead of nested ternaries, unique kebab-case `data-testid` on every interactive/critical element, `drawer:` variant for narrow layouts. Ops Deck is the only HUD — do not resurrect modals.
- **Testing** → add/extend a `tests/*_test.py` suite with the feature, run it in isolation, then run `testing_agent_v3` for an `iteration_NN.json` before marking a phase complete; add debug hooks under `window.__gameDebug`/`game.dev` (pure/read-only) rather than reaching into React.
- **Docs** → keep `/app/plan.md` (phases, decisions, verification) and `/app/memory/PRD.md` current; refresh this handoff at phase boundaries.

---

## 13. Backlog (nothing in progress — awaiting user pick)

**P1 — natural follow-ons to Phase Y**
- **Auto-Suggest Auto-Place**: click a suggested marker to build the lamp immediately (spend + placement through `construction.placeBuilding`).
- **Surge Alert UI**: flash a warning / banner chip when a relay goes offline so players know why floodlights went dark (`offlineUntil` edge → `pushAlert` + EmergencyBanner chip).
- **Contact Sheet Themes**: dark "night edition" layout for the exported sheet (`album.sheetLayout` theme param).

**P2 — polish**
- Ambient mix sliders (UI / ambience / stingers), keeper call-signs, popover dismissal on outside click, tooltips pass.
- Incident timeline per enclosure; "assign nearest idle keeper" one-click from the TENSION section.
- Balance pass after human playtests (Sovereign Bloodline, breeding cooldown, tension, lighting deltas).

**P3 — platform**
- Real accounts replacing token scoping; bundle-size review (framer-motion, recharts, react-query, swr lightly used); renderer culling / dirty-rect only after profiling on real hardware (`tests/perf_probe.py` baseline).
