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
