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

## Immersion & Late Game (v1.5 — Phase 6)
- GUEST PANIC: decideGuest top-of-function panic detection (park-wide if escaped danger>=3, else proximity r14) clears path/dwell, g.panic+leaving, panic sprint 0.11 (2x), spawnGuests blocked while any escape, renderer flashing red "!" + bounce/lean, EmergencyBanner 'N GUESTS STAMPEDING TO THE EXIT' (emergency-evacuating).
- NIGHT TOURS: state.policies={nightTours} + setPolicy mutator + deserialize default; night+clear spawns floor 0.85 mult, admission ticketPrice*1.75 -> income 'tours' ('Night tour premiums' label, income-tours testid), g.nightTour; glow-species night viewing bonus (+0.09 tour sat), no-glow tour guests complain/refund opinions; FinanceScreen Night Tours Switch card (night-tours-toggle).
- BREEDING: research bio_breeding (Husbandry Program); creatures.js breedingTick (T%200): adults same enclosure welfare>=0.72 stress<=0.45 breedCd 3600, capacity (area/spacePerHead & social.max), 35% -> gestation 1000t -> juvenile '<Species> Cub' (growth 0->1 over ~2400t, renderer scale 0.5+0.5*growth), NEW OFFSPRING alert, stats.births, JUVENILE badge (creature-juvenile-badge), juvenile appeal x1.4 + 'adorable' opinions.
- ABILITIES (species.ability): umbra 'camouflage' (abilityTick T%120: cloaks day/stress; c.cloaked excluded from visibilityFrom unless sec_thermal; renderer alpha shimmer 0.1/thermal 0.55 + heat outline; CLOAKING OBSERVED alert; CLOAKED badge creature-cloaked-badge), karrgan 'burrow' (welfare<0.5, 22%/check tunnels outside enclosure -> BURROW BREACH + stats.breaches; cont_foundations blocks), voltari 'surge' (stress>0.45, 40%/check: relays r12 offlineUntil tick+500 -> POWER SURGE alert; sec_surge immunizes; isPowered + power overlay show dashed red OFFLINE; renderer cyan lightning arcs while _surgeUntil).
- New research: bio_breeding (Biology), sec_thermal/cont_foundations/sec_surge (Containment, all require cont_reinforced).
- Tests: /app/tests/phase6a_test.py (8/8), phase6b_test.py (13/13), phase6_helpers.py; full regression green; testing agent iteration_5.json 100% (46 assertions incl. phase5 regression 17/17).

## Ops Deck Step 1 (Phase J + K) — iteration_24 = 100%
- FLAGS (game/art/flags.js): ART_V2 (localStorage 'aetherion.artV2', default on) and OPS_DECK (localStorage 'aetherion.opsDeck', default on; URL ?legacyHud=1 forces off). Read once at module load — set + reload.
- ART_V2 (Spec 01): pixel.js celRamp/rimLight2/haloGlow post-passes (eye rects masked), creatures.js bake runs cel+rim after def.paint and before outline, halo after outline (bounds from pre-halo frames, sheet.v2=true); terrain_tex.js celRamp(steps=4); rig.js groundAO/contactShadow wired into renderer.drawCreature shadow site. Flag off = byte-identical (tests/art_v2_test.py 9/9 vs art_v2_baseline.json).
- OPS_DECK (Spec 02): OpsDock.jsx (56px left dock, `dock-` prefixed testids), Drawer.jsx (320px, data-testid ops-drawer/data-drawer, drawer-title, drawer-close, drawer-body=.ops-drawer-host), hooks/useDrawer.js (single drawer, same-id toggles closed, {toggle:false} for legacy writers). GameScreen: HudBar onOpenModal→openDrawer, GameModals NOT mounted, legacy setModal writers (alerts/inspect openSpecies) routed into the drawer via effect, buy/claim close the drawer; left overlays (directives + build toolbar) wrapper `ops-left-shift` sits at left-14 (closed) / left-[376px] (drawer open). index.css `.ops-drawer-host` neutralises modal chrome (backdrop/fixed width/z-index) + generic narrow-host reflow (grids→1 column, Species list stacks above detail, header wraps). Screen files untouched. Flag off = DOM identical to main (tests/ops_deck_dom_baseline.json recorded from main; re-record with tests/ops_deck_record_baseline.py after stashing GameScreen changes).
- Tests: tests/ops_deck_test.py (26/26), tests/art_v2_test.py (9/9); regression suites phase5/6a/6b/8/9/17/19/20/21, determinism, input_ux, keeper_priorities, assessment_fixes, creature_art, smoke all green with the deck ON. Playwright 1.62 needs chromium_headless_shell-1234 (installed to /pw-browsers).

## Phase L — Phase G continuation (Juveniles, Seed Picker, Live Portraits, Creature Voices) — iteration_25 = 100% (109/109)
- L1 JUVENILES (art/juvenile.js): derived sheets — deterministic image-space transform of the ADULT bake (legs bottom 35% squashed, torso squashed, elliptical head region around the recorded eye rects enlarged, INK outline-gap repair, eye rects remapped so blink + night eye-glow track). Stages: cub (growth<0.5: head 1.4/legs 0.6/torso 0.9), young (head 1.18/legs 0.8/torso 0.95). getCreatureSheet(id, stage='adult') — adult path byte-identical; renderer picks stage via juvenileStage(c); renderPortrait(canvas, id, stage, {frame, blink}); Portrait `stage` prop (data-stage) used by CreaturePanel. tests/juvenile_art_test.py 14/14, tests/juvenile_gallery.py → artifacts/juveniles_{a,b,c}.png.
- L2 SEED PICKER (game/seed.js, MainMenu SeedField, HudBar SeedChip): parseSeed(text) — blank→null (clock-derived), digits→Number % 2^31, phrase→FNV-1a(lowercase); state.seedLabel (additive, deserialize default null); testids seed-input / seed-random-button / seed-copy-button / seed-hint / hud-seed (click copies via clipboard with textarea fallback). tests/seed_picker_test.py 13/13. NOTE: hud-seed lives in both HUD modes → tests/ops_deck_dom_baseline.json re-recorded.
- L3 LIVE PORTRAITS (Portrait.jsx): one shared rAF ticker (~25Hz, window.__portraitLive count) drives every mounted portrait; repaint only on idle-frame/blink change (portraitPose in renderer.js: 240ms/frame, 2.6–4.1s blink cycle, per-species phase); IntersectionObserver skips off-screen rows; document.hidden pauses; REDUCED_MOTION → data-live='off' still frame 0. tests/live_portraits_test.py 9/9.
- L4 CREATURE VOICES (audio.js creatureVoice + voiceProfile; renderer.voiceCue): rising edge of threat display / lunge burst → synthesised snarl (menace) / keen (bob|hover) / bellow (pace>=1.25 or h>=50) / chirp; pitch = 44/silhouette height; juveniles ×1.6 pitch; proximity gain from viewport centre (>1.25 off-screen = silent); limits 2.6s per animal, 320ms global, 3 per 2s window — 'limited-global' keeps the edge pending so a chorus staggers; counters window.__audio.voices, log 'voice:<kind>:<event>'. tests/creature_voices_test.py 12/12.
- Commits: f14171a (juveniles), 9b2f788 (seed picker), bf1282b (live portraits), 662b0e5 (voices).

## Phase M — Ops Deck Step 2: native drawer panels (Species DB + Bloodline Ledger focus) — commits 47cbb00, 3bfff50
- ScreenFrame.jsx: ScreenHostContext {host:'modal'|'drawer', title} + useScreenHost() + ScreenFrame(testId, closeTestId, onClose, eyebrow, subtitle, actions, toolbar, size, bodyClassName, scroll, layer). Modal host = the pre-deck full-screen chrome (identical [data-testid] order — ops_deck_dom_baseline.json still matches unchanged). Drawer host = ONE header (`drawer-title` + the screen's own `*-close-button`), optional subtitle/actions strip, toolbar, body. Root keeps the `*-modal` testid in both hosts + data-host attr.
- Tailwind variant `drawer:` = `[data-host="drawer"] &` (tailwind.config.js plugin, no new dep). Screens declare narrow layouts (`grid-cols-3 drawer:grid-cols-1`, etc.). index.css `.ops-drawer-host` override block DELETED; `drawer-close` testid no longer exists (the header close IS the screen close).
- Drawer.jsx = shell only (geometry, Esc, context provider, `drawer-body` wrapper); DRAWER_TITLES.ledger. useDrawer: openDrawer(id, {toggle, params}) → {drawer, drawerParams}; DRAWER_IDS + 'ledger'.
- SpeciesDatabase (native): roster strip w-full max-h-38% (rows compact, 36px portraits, data-selected + cyan left rule, selected row scrollIntoView) above the detail pane; header grid (110px portrait / name+code+knowledge chip `LABEL · NN%` / chips row spans full width in drawer); biology 1 col; unknown rows wrap. `catalogued(s, species)` = tier researched OR park holds/held the species (lineage) — fixes scenario-granted Sovereigns showing as locked "SIGNAL DETECTED" (AcquisitionScreen lock unchanged).
- BloodlineLedger (native): ScreenFrame, createPortal ONLY in modal host; drawer host: 128px nodes (subject 220px), pairing outlook as cards (same `ledger-candidate-*` testids/data-safe/text; table in modal), `ledger-empty` state. Opened via CreaturePanel `onOpenLedger` (threaded GameScreen → InspectPanel → CreaturePanel): deck → openDrawer('ledger', {toggle:false, params:{creatureId}}) (no dock button lit, left overlays shift to 376px); legacy → local portal modal as before. Locate = onClose + navigate.
- Research/Finance/Acquisition(+Expeditions/Contracts tabs)/Staff converted to ScreenFrame + `drawer:` layouts; StaffScreen RosterRow has a stacked card variant in the drawer host (AssignSelect w-full).
- QA fixes: HudBar labels `hidden min-[1720px]:inline` (icon-only below), identity block flex-auto/min-w-0/overflow-hidden (never spills under the time controls), right cluster shrink-0 → Menu never clipped at 1366; BuildToolbar category tabs px-1 whitespace-nowrap.
- Tests: tests/ops_deck_native_test.py (17/17: data-host, single header/close, no overflow in every drawer incl. Field Ops tabs, staff card, Species roster/detail geometry + dossier deep-link + catalogued species, ledger drawer open/locate/Esc/close, legacy modal + portal ledger). ops_deck_test.py 27/27 (ON 5b native chrome; ON 14 uses the header close). live_portraits_test.py closes via species-db-close-button. Regressions green: phase21 (28/28), phase8_staff, phase20 (39/39), keeper_priorities, input_ux, seed_picker, determinism, ui_integration.
- Escape remains the global "cancel everything" hotkey (tool → select, clear selection, close drawer); the screens' close buttons keep the dossier open.

## Phase O — Creature Tension Pass: aggression, needs degradation & escape (iteration_27)
- DESIGN: one deterministic danger loop built on the EXISTING creature substrate (stress/health/welfare, fence hp, security posts, staff radio). No species data / art changes; all state additive with safe deserialize defaults (state.gaps, state.tension, stats.deaths/deathsBySpecies/conflicts/fatalConflicts/breachEvents/interventions/holdings/staffRebuilds; creature health floor REMOVED).
- tensionProfile.js (pure): volatility = 0.6 + danger*0.16, tierFactor = 0.85 + (tier-1)*0.1, degradeMult = product (D1/T1 ≈0.65 … D5/T4 ≈1.6). Thresholds STRESS {radio .6, aggressionAny .75, breach .7, healthLoss .8, recover .6}, HEALTH {warn .6, critical .3, injuredUntil .8}. assignedKeepers/keeperMult (0.55 with any assigned staff), nearestPost/RESPONSE_RADIUS {breach 18, incident 22}, enclosureTension(state, encId) for UI/renderer.
- creatures.js updateWelfare: fast channel = hunger/thirst deficit below NEED_LOW, slow channel = habitat comfort deficit; × genetics × research × degradeMult × keeperMult; assigned keepers also relieve 0.004/keeper (cap 2). Health: −0.012/check above stress .8 (−0.006 when loose), −0.01 when starving (need ≤0.02), × degradeMult; regenerates only below stress .6. healthWarnings() → HEALTH DECLINING (<.6) / CRITICAL CONDITION (<.3) once per episode. killCreature(state, c, cause, {by}) → removeCreature(...,'deceased'), stats, ORGANISM LOST / FATALITY alert, buzz −0.2, units stand down, staff drop tasks, c._dead (sim loop snapshots creatures). Stress ≥.6 → radioEvent 'stress' from assigned keepers once per episode.
- tension.js: conflictTick (T%90, ≤1 incident park-wide, pen cooldown 300, aggressor cooldown 600). aggressionChance: predation .35×(0.6+danger/5) (not stress-damped), hostility .18, dominance (danger gap ≥3 or same-species T3+), overcrowding (>social.max, both stressed), stress ≥.75 → any organism; juveniles never aggressors. severity: fatal only if victim health <.75 or apex predation (D≥4); serious = injury (−0.22−0.1·danger/5 health, injured flag, distressed, incident record), minor = stress spike + fleeWithin. Incidents confirm hostility in knowledge (both species) + social evidence; conflict park event is a hazard (no "guests gathering" headline). breachTick (T%150 with fencePressure): eligible when stress ≥.7 and weakest boundary segment hp ratio < 0.5+0.1·(danger−1) OR barrier tier below containment tier; first eligibility → BREACH RISK warning (always before a breach); chance .04×(0.5+danger·.25)×min(1.5, score+.25)×volatility/1.08, halved when a post is within 18. performBreach → destroyFence (segment deleted, gap registered), creature placed across the gap, escaped, CONTAINMENT BREACH alert, emit('breach') (siren stinger + screen shake), radio 'breach', containment evidence. scrubGaps retires gaps whose whole fence line was demolished.
- construction.js: destroyFence(state, key, by) (also used by damageFence collapse) registers state.gaps[key] = {tier, tick, encId, by}; placing a fence on the key (line/rect/single) or demolishing the line clears it; rebuildGap(state, key, who) re-erects at the old tier (paid). gapsFor(state, encId) is GEOMETRIC (gap borders live region — region ids renumber after every fence edit; encId is history for alert text); openGaps(state) = gaps with no closed enclosure on either side.
- security.js: escapes captured as before; secureHome = home tile inside a closed, gap-free region, otherwise the animal goes to HOLDING at the post (c.held=postId, state 'held', escaped false, enclosureId null; IN HOLDING alert; stats.holdings); releaseHeld returns it once the pen is closed (RELEASED FROM HOLDING). Serious incidents dispatch a unit from a post within 22 (◈150): toIncident → separating (25t) → resolveIncident (−0.15 stress both, aggressor cooldown ×1.5, victim flees, pen cooldown ×2, ANIMALS SEPARATED, stats.interventions).
- staff.js: biomedical prioritises injured; wardens take 'rebuild' tasks for gaps before patch repairs (WORK_TICKS 160, stats.staffRebuilds, radio 'rebuilds'); radioEvent(state, encId, kind, creature) — assigned keepers batch 'stress' callouts, 'conflict'/'breach' flush immediately; summaries say "Situation developing."
- RENDERER (render-only): enclosure rose tint when mean stress >.6 (renderer._tensionHot), dashed red gap markers (renderer._gapMarkers), pulsing chevron over distressed/injured organisms (renderer._distressMarkers); 'breach' event → camera shake + siren stinger (audio.stinger('breach', {force:true})).
- UI: CreaturePanel CONDITION badge (creature-condition: STABLE/AGITATED/DISTRESSED/INJURED/CRITICAL/IN HOLDING) + Health bar (creature-health). EnclosurePanel TENSION section (enclosure-tension-section/-status CALM|UNSETTLED|TENSE|CRITICAL/-mean/-agitated/-distressed/-injured/-breach-risk/-conflicts/-keepers) with warnings enclosure-incompatible-warning (knowledge-confirmed hostility, recorded conflict, or public danger gap ≥3 — never raw compat data), enclosure-overcrowding-warning (only once 'social' is documented), enclosure-breach-risk-warning, enclosure-no-keeper-warning; BREACHED banner (enclosure-breached, enclosure-gap-row, enclosure-gap-locate-button) for gaps bordering the region, and a CONTAINMENT LOST view listing open gaps when the region no longer exists. EmergencyBanner: gap chips (emergency-gaps / emergency-gap-chip) and a gaps-only PERIMETER OPEN variant (perimeter-banner / perimeter-title / perimeter-status / perimeter-held) when nothing is loose but a pen stands open. BloodlineLedger STATUS_META.deceased → DECEASED (node status pill `${testId}-status` with data-status; chips ' · deceased').
- DEV HARNESS (window.__game.dev, never used by gameplay): fenceRect, addCreature, offspring(motherId, fatherId, x, y, juvenile), kill, spawnBuilding, hireStaff, assignStaff, enclosureAt, enclosures, damageFence, grant, flatten, watchAlerts/alerts/clearAlerts (unbounded alert log; state.alerts caps at 60).
- Tests: tests/tension_test.py (48 checks: degradation rates D1 vs D5, keeper slows, stress radio, warnings → death → ledger DECEASED + dossier health/condition; conflicts, knowledge confirmation, park event, graduated outcomes, staged serious incident → response separation, injured badge + canvas marker, overcrowding, juveniles never aggressors; BREACH RISK → gap → escape → banner chips → save round-trip → holding → warden rebuild → release → banners clear; fence placement closes gaps, demolition retires them; determinism: identical seeded runs identical, different seed diverges). Seeded worlds via g.newGame({mode:'sandbox', seed}) while paused + g.stepTicks(n).
- VERIFIED iteration_27: tension_test 48/48, backend 22/22, manual browser checks 5/5, all regression suites green. Test-hygiene fixes: phase5_test now uses seed 424242 + wider flatten (vertex snapping was seed-flaky); legacy comprehensive_test (54/54) and focused_test (19/19) updated to current testids/behaviour (tutorial flag, paint-rock, tool-undo, park-name-input, flatten-to-centre, disabled research button).
- Upcoming backlog (unchanged): Species Roster filters (search + family/tier chips) — P1; Retire legacy HUD (?legacyHud=1 paths) — P1.
