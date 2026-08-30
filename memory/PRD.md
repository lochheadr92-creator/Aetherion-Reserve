# Aetherion Reserve — PRD & Implementation Memory

## Product
Original creature-containment & park-management game (dark sci-fi "Night-Lab" identity).
Player builds habitats for partially-understood organisms, learns their biology by OBSERVING
behaviour, contains them, attracts guests, and runs the economy. React + custom Canvas-2D
isometric engine (frontend simulation), FastAPI + MongoDB for save slots only.

## User choices (locked)
- HTML5 Canvas isometric engine; dark sci-fi bioluminescent identity (design_guidelines.md)
- Backend+MongoDB save slots; Management + Sandbox modes; desktop-first
- Deterministic fixed-timestep sim (100ms ticks, speeds pause/1x/3x) decoupled from render
- Unknown biology ENFORCED at data layer (knowledge.js getSpeciesView + masked habitat causes)

## Architecture
- /app/backend/server.py — /api/saves CRUD (list/get/create/update/delete), full state JSON in Mongo
- /app/frontend/src/game/ — engine modules:
  - constants.js (palette/tiles/materials/veg/fences/costs), state.js (authoritative state, serialize, events, rnd)
  - data/species.js (15 data-driven species w/ hiddenAttrs), data/buildings.js, data/research.js
  - terrain.js (raise/lower/flatten/smooth/paint/water/veg/path + costs + undo stack)
  - construction.js (buildings/fences/gates/repair/demolish/power radius)
  - enclosures.js (flood-fill enclosure detection, composition, evaluateHabitat w/ explainable factors + unknown masking)
  - pathfind.js (A* w/ fence-edge blocking), creatures.js (needs, AI state machine, evidence, fence pressure, cohab, recall)
  - knowledge.js (evidence→hypothesis→discovery, dynamic field-study research, gated getSpeciesView)
  - guests.js (spawn/path BFS/needs/viewing visibility/opinions/spending), economy.js, sim.js (tick orchestrator, objectives, rating, research)
  - renderer.js (offscreen terrain cache, depth-sorted entities, procedural creature bodies, overlays, previews)
  - input.js (tools, edge snapping, selection), controller.js (loop + save/load; window.__game debug handle)
- /app/frontend/src/components/game/ — GameScreen, HudBar, BuildToolbar, InspectPanel, SpeciesDatabase,
  ResearchScreen, FinanceScreen, AcquisitionScreen, ObjectivesPanel, OverlayToggles, MainMenu, Portrait
- window.__game (controller) and window.__gameRenderer exposed for testing.

## Key mechanics working (verified via /app/tests/smoke_game.py + scenario_discovery.py)
- Terrain sculpt/paint/water/veg with costs + undo; blocked edits explained
- Fences (4 tiers) + gates; enclosure flood-fill detection; feeders/shelters
- Creature release only inside enclosures; A* movement respects fences/water/cliffs
- Needs/welfare/stress; habitat factor breakdown with causes; masked causes for undiscovered attrs
- Discovery loop: behaviour → evidence → hypothesis alert → dynamic field study → BREAKTHROUGH toast + grant
- Guests: spawn at entrance w/ admin+creatures, walk paths, view platforms (visibility calc), buy at stalls, opinions feed
- Economy: tickets/stalls income, construction/terrain/feed/upkeep expenses, daily rollover, finances screen w/ chart, ticket price slider
- Research: static tree + observation-driven dynamic projects; lab required; insulated containment gated on Voltari evidence
- Objectives (12 tutorial directives), park rating, alerts w/ click-to-navigate, save/load roundtrip verified

## 15 species (id: management question)
veyra (herd space), skitter (starter, fully documented), thornback (canopy), hollowcrest (high rock vs viewing),
mirefin (deep hunting water), silttitan (wetland pair), shardling (mineral diet), mosswarden (symbiosis w/ shardling),
rhoak (territorial solitary), vantha (pack, tests fences → containment discovery), karrgan (apex T3 containment),
lumen (filter feeder, feeds from water), umbra (shade/canopy), voltari (drains fences, needs insulated T4 + energy conduit),
emberoot (fungal ground terraforming)

## Conventions
- Currency symbol ◈ (fmtMoney); day = "Cycle"; TICKS_PER_DAY=1800 (3min @1x)
- Fence edges keyed `x,y,E|S` (E = boundary with x+1, S = with y+1)
- UI reads species biology ONLY via getSpeciesView (unknown enforcement)
- Tests in /app/tests (playwright, python3, uses localhost:3000 + window.__game)

## Feature additions (v1.1)
- WEATHER & DAY-NIGHT (game/weather.js): state.weather {type: clear|overcast|storm, ticksLeft}; day phases day/dusk/night from tick.
  Effects: storms → creatures seek shelter + stress if exposed, random fence storm damage, guest arrivals ×0.15 + guests leave, visibility ×0.5;
  night → arrivals ×0.5, visibility ×0.65 EXCEPT bioluminescent (colors.glow) species get ×1.2 + special guest opinion;
  nocturnal species (umbra, activity:'nocturnal') hide by day (shelter/canopy) and relax at night. Renderer: night/dusk tints, rain streaks, lightning; HUD chip (hud-weather-chip/label/clock). Weather serialized; deserialize defaults it for old saves.
- TUTORIAL (TutorialOverlay.jsx): 6-step first-run orientation, pauses game, localStorage 'aetherion_tutorial_done', Help button (hud-help-button) reopens. Tests must set the localStorage flag before starting a game to bypass.
- BUG FIX: terrain tiles were drawn centred on grid corners (worldPx(x,y)) while previews/fences used tile centres (worldPx(x+0.5,y+0.5)) → half-tile placement misalignment. drawTileOff now centres on (x+0.5,y+0.5); everything aligned.

## Known scope (post-v1 backlog)
- Expedition timers/map, contracts beyond tutorial directives, weather/incidents, staff entities,
  escape emergencies beyond recall (capture teams/drones), more overlays (guest heatmap), key rebinding

## Code Quality Pass (v1.2 — post-refactor)
- React UI refactor verified: GameScreen/InspectPanel/BuildToolbar split into components + hooks (components/game/hooks/), compiles clean, game boots.
- server.py: type hints on all 7 route/lifecycle functions (100% coverage).
- Controlled mutators in game/state.js: setTimeControls(state,{paused,speed}) and setTicketPrice(state,price) — controller.setPaused/setSpeed and FinanceScreen slider now route through them; no direct state mutation from UI/bridge code.
- Stable React keys: FinanceScreen chart Cell key=d.day, guest feed key=f.id (guests.js now assigns id: state.nextId++ to _guestFeed entries); TutorialOverlay STEPS have id fields, dots key=st.id.
- Regression: /app/tests/{visual_v2,scenario_discovery,smoke_game}.py all pass; testing agent iteration_3.json 100% backend + frontend. Testing-agent backend suite kept at /app/tests/backend_api_test.py.

## Fence UX rework (v1.3)
- Drag-to-line fence construction: mousedown anchors nearest lattice corner (renderer.vertexFromPointer), drag shows straight-line preview (renderer.fenceLinePreview: green=placeable, dim=blocked, red=remove) with live "N seg · ◈cost" label; mouseup commits. Diagonal drags snap to dominant axis. Plain click still places/removes one segment (edgeFromPointer).
- construction.js: canPlaceFenceSegment (validation only), fenceLineEdges(v0,v1) (lattice corners -> edge list; horizontal=S edges row vy-1, vertical=E edges col vx-1), placeFenceLine (single spend for all placeable segments), removeFenceLine (bulk salvage).
- input.js: lineStart anchor; fence/fenceRemove intercepted in onDown/onMove/onUp; gate remains click-only; applyTool fence cases removed.
- Toast on line commit ("Basic Barrier × 8 placed (−◈400)"); hint in Fences tab (fence-drag-hint testid); tutorial containment step updated.
- Test: /app/tests/fence_drag_test.py (8 assertions, all pass); smoke_game.py still green.

## Feature Expansion (v1.4 — Phase 5)
- RECTANGLE FENCE MODE: DRAW toggle (Line|Rectangle) in Fences tab (tool.fenceShape, testids fence-shape-line/rect). fenceRectEdges(v0,v1) in construction.js builds 4-wall perimeter; shared commitFenceEdges/removeFenceEdges for line+rect place/remove; degenerate rect falls back to line. Preview reuses fenceLinePreview.
- SECURITY RESPONSE: building 'security_post' (Rapid Response Post, operations cat, needsPath, ◈3000/45 upkeep). game/security.js: securityTick (T%40, dispatch nearest free post per escapee, ◈250 'response' expense) + tickSecurityUnits (every tick: toTarget→capturing(40t)→returning; resolveCapture escorts home or relocates to largest enclosure; NO CONTAINMENT alert + 600t cooldown if none). state.security={units:[]}. Renderer: drawSecurityUnit (rose armour, amber visor, strobe halo) in entity loop; escaped creatures already ring-flashed. EmergencyBanner.jsx top-center (testids emergency-banner/chip-{id}/status), chips navigate to creature. New objective 'security_post'; initObjectives merges missing ids into old saves. stats.captures counter.
- EXPEDITIONS: data/expeditions.js — 4 zones (mirefen/shardpeak/umbral/ember) with cost/duration/risk/speciesPool/artifact ranges; STAGES transit(0.2)/survey(0.35)/recovery(0.3)/return(0.15). game/expeditions.js: launchExpedition (max 2 active, 'acquisition' expense), expeditionTick (T%10; survey rolls wild evidence via recordEvidence + mishaps; recovery rolls 1-2 specimens + salvage cash + high-risk medevac), returned → earn 'grants' + alert; claim flow: UI CLAIM & RELEASE (claim-specimen-{id}) → GameScreen.claimSpecimen arms place_creature with tool.free+expeditionId+specimenId → input.js skips spend + markSpecimenPlaced; auto-clears fully-claimed expeditions.
- CONTRACTS: game/contracts.js — 5 serializable templates (welfare/guests/discovery/rating/tickets-best-cycle), params-based progress (contractProgress), baselines set at accept, 3 offers refresh every 2 cycles, max 3 active, 6-cycle expiry, payout via 'grants'. contractTick T%60. state.contracts={available,active,completed,nextRefreshDay}.
- FIELD OPS UI: AcquisitionScreen now tabbed ACQUIRE|EXPEDITIONS|CONTRACTS (fieldops-tab-*), attention dots; new components components/game/fieldops/{ExpeditionsTab,ContractsTab}.jsx. GameModals passes onClaimSpecimen.
- Persistence: serialize plain data; deserialize defaults for security/expeditions/contracts (old saves safe).
- Tests: /app/tests/phase5_test.py (18/18), fence_drag_test.py, smoke, scenario_discovery, visual_v2 all green; testing agent iteration_4.json 100%.
