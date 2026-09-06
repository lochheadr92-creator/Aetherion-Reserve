// ---- Authoritative game state. The renderer reads this; it never defines it. ----
import { MAP_SIZE, MAX_H } from './constants';
import { SPECIES_LIST } from './data/species';
import { RESEARCH } from './data/research';
import { BUILDINGS } from './data/buildings';

export const idx = (x, y) => y * MAP_SIZE + x;
export const inMap = (x, y) => x >= 0 && y >= 0 && x < MAP_SIZE && y < MAP_SIZE;

// Simple event bus so React UI can subscribe to sim events without owning state
const listeners = {};
export const on = (evt, fn) => { (listeners[evt] = listeners[evt] || []).push(fn); return () => { listeners[evt] = listeners[evt].filter((f) => f !== fn); }; };
export const emit = (evt, data) => { (listeners[evt] || []).forEach((fn) => { try { fn(data); } catch (e) { console.error(e); } }); };

// ---- Deterministic RNG (H4) ----
// Every sim-side random draw goes through rnd(), a 31-bit LCG. The live cursor is
// module-level (98 call sites take no state argument) but it is OWNED by the state:
// createNewGame seeds it from state.seed, serialize() snapshots it into state.rngState and
// deserialize() restores it, so a loaded save replays identically every time.
const RNG_MOD = 2147483648;
let seedCounter = 12345;
export const rnd = () => { seedCounter = (seedCounter * 1103515245 + 12345) % RNG_MOD; return seedCounter / RNG_MOD; };
export const getRngState = () => seedCounter;
export const setRngState = (v) => { seedCounter = Number.isFinite(v) ? Math.floor(Math.abs(v)) % RNG_MOD : 12345; };
// aliases kept for the debug hook / older tests
export const getRngCursor = getRngState;
export const setRngCursor = setRngState;

export function pushAlert(state, { type = 'info', title, msg, target = null }) {
  const a = { id: state.nextId++, tick: state.tick, type, title, msg, target, read: false };
  state.alerts.unshift(a);
  if (state.alerts.length > 60) state.alerts.length = 60;
  emit('alert', a);
  return a;
}

export function logCause(state, subject, msg) {
  state.causeLog.unshift({ tick: state.tick, subject, msg });
  if (state.causeLog.length > 120) state.causeLog.length = 120;
}

function genTerrain(state) {
  const S = MAP_SIZE;
  const H = state.heights, M = state.materials, W = state.water, V = state.veg;
  H.fill(1); M.fill(0); W.fill(0); V.fill(0);
  // Gentle rolling ground via layered value noise (deterministic-ish w/ rnd)
  const bumps = [];
  for (let i = 0; i < 10; i++) bumps.push({ x: rnd() * S, y: rnd() * S, r: 6 + rnd() * 10, h: rnd() < 0.6 ? 1 : 2 });
  // A rocky rise in the NE, a wet basin SW
  bumps.push({ x: S * 0.75, y: S * 0.22, r: 12, h: 3 });
  bumps.push({ x: S * 0.8, y: S * 0.3, r: 8, h: 2 });
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let h = 1;
    for (const b of bumps) {
      const d = Math.hypot(x - b.x, y - b.y);
      if (d < b.r) h += b.h * (1 - d / b.r);
    }
    H[idx(x, y)] = Math.max(0, Math.min(MAX_H, Math.round(h)));
  }
  // materials: grass base; rock on high; sand/soil patches; wetland near pond
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = idx(x, y);
    if (H[i] >= 4) M[i] = 4; else if (H[i] === 3) M[i] = rnd() < 0.5 ? 5 : 0;
    else if (rnd() < 0.06) M[i] = 2; else if (rnd() < 0.03) M[i] = 1;
  }
  // SW pond
  const px = S * 0.22, py = S * 0.72;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const d = Math.hypot(x - px, y - py);
    const i = idx(x, y);
    if (d < 4.5) { W[i] = d < 2.5 ? 2 : 1; H[i] = 0; M[i] = 6; }
    else if (d < 7) { M[i] = 7; H[i] = Math.min(H[i], 1); }
  }
  // scattered vegetation
  for (let y = 2; y < S - 2; y++) for (let x = 2; x < S - 2; x++) {
    const i = idx(x, y);
    if (W[i] || M[i] === 4) continue;
    const r = rnd();
    if (M[i] === 7) { if (r < 0.18) V[i] = 5; }
    else if (r < 0.02) V[i] = 4; else if (r < 0.05) V[i] = 3; else if (r < 0.09) V[i] = 2; else if (r < 0.14) V[i] = 1;
  }
  // small forest cluster NW
  for (let i = 0; i < 60; i++) {
    const x = Math.floor(S * 0.15 + rnd() * S * 0.18), y = Math.floor(S * 0.15 + rnd() * S * 0.2);
    const t = idx(x, y);
    if (!W[t] && M[t] !== 4) V[t] = rnd() < 0.5 ? 4 : 3;
  }
}

export function createNewGame({ parkName = 'Aetherion Reserve', mode = 'management', seed = null, seedLabel = null } = {}) {
  const S = MAP_SIZE;
  // world seed: derived from the clock when the caller passes none, so every new park differs;
  // an explicit finite integer seed replays exactly (tests / sharing). Anything that is not a
  // finite integer falls back to the clock-derived value — never to a fixed constant.
  const derivedSeed = (Date.now() % 2147483647) || 1;
  const worldSeed = Number.isInteger(seed) ? Math.floor(Math.abs(seed)) % RNG_MOD : derivedSeed;
  setRngState(worldSeed);
  const state = {
    version: 1, mode, parkName,
    seed: worldSeed, rngState: worldSeed,
    seedLabel: typeof seedLabel === 'string' && seedLabel ? seedLabel.slice(0, 40) : null, // what the player typed (seed picker); null = clock-derived
    tick: 0, day: 1, speed: 1, paused: false,
    cash: mode === 'sandbox' ? 9999999 : 150000,
    ticketPrice: 25,
    size: S,
    heights: new Array(S * S), materials: new Array(S * S), water: new Array(S * S), veg: new Array(S * S),
    paths: new Array(S * S).fill(0),
    fences: {},
    buildings: [],
    creatures: [],
    guests: [],
    knowledge: {},
    research: { completed: [], active: null, dynamicProjects: [] },
    finances: {
      today: emptyDay(),
      history: [],
    },
    alerts: [], causeLog: [],
    objectives: [], // filled by sim
    rating: { overall: 0.5, comp: {} },
    entrance: { x: Math.floor(S / 2), y: S - 1 },
    weather: { type: 'clear', ticksLeft: 900 },
    stats: { guestsTotal: 0, discoveries: 0, breaches: 0, guestSat: 0.7, captures: 0, buzz: 0 },
    security: { units: [] },
    expeditions: [],
    contracts: { available: [], active: [], completed: 0, nextRefreshDay: 0 },
    policies: { nightTours: false, keeperRadio: true },
    staff: [],
    waste: [],
    events: [],
    rivalries: [],
    transport: { cars: [] },
    nextId: 1,
  };
  genTerrain(state);
  // entrance path stub
  for (let d = 0; d < 5; d++) {
    const i = idx(state.entrance.x, S - 1 - d);
    state.paths[i] = 1; state.water[i] = 0; state.veg[i] = 0; state.heights[i] = 1; state.materials[i] = 2;
  }
  // init knowledge
  for (const sp of SPECIES_LIST) {
    state.knowledge[sp.id] = { discovered: {}, evidence: {}, hypothesized: {} };
    if (mode === 'sandbox') sp.hiddenAttrs.forEach((a) => { state.knowledge[sp.id].discovered[a] = true; });
  }
  // skitterling is pre-documented
  if (mode !== 'sandbox') {
    SPECIES_LIST.filter((s) => s.hiddenAttrs.length === 0).forEach((s) => { /* nothing hidden */ });
  }
  if (mode === 'sandbox') {
    state.research.completed = ['bio_obs1', 'bio_obs2', 'bio_stress', 'env_flora', 'env_hydro', 'cont_reinforced', 'cont_heavy', 'cont_insulated', 'fac_tower', 'fac_gift', 'fac_marketing', 'ops_field2', 'ops_field3', 'ops_field4'];
  }
  return state;
}

export function emptyDay() {
  return {
    income: { tickets: 0, food: 0, drink: 0, gift: 0, grants: 0 },
    expenses: { upkeep: 0, feed: 0, construction: 0, terrain: 0, acquisition: 0, research: 0, response: 0 },
  };
}

// ---------- serialization ----------
export function serialize(state) {
  const clean = { ...state };
  // strip derived/transient keys (start with _)
  Object.keys(clean).forEach((k) => { if (k.startsWith('_')) delete clean[k]; });
  // snapshot the RNG cursor so a load replays identically (also refreshed on the live
  // state, so a continued game and its reloaded save carry the same value)
  state.rngState = getRngState();
  clean.rngState = state.rngState;
  delete clean.rng; // pre-stabilisation key name (read on load, never written again)
  return JSON.parse(JSON.stringify(clean));
}

const freshKnowledge = () => ({ discovered: {}, evidence: {}, hypothesized: {} });

export function deserialize(data) {
  const state = data;
  const warn = (msg) => { if (typeof console !== 'undefined') console.warn(`[load] ${msg}`); };
  // every scrub is counted here and surfaced to the player as ONE 'SAVE REPAIRED' alert
  // (in addition to the console warning), so silent data loss on load is impossible
  const removed = [];
  let removedCount = 0;
  const scrubbed = (n, what) => { if (n > 0) { removed.push(`${n} ${what}`); removedCount += n; warn(`dropped ${n} ${what}`); } };
  if (!state.weather) state.weather = { type: 'clear', ticksLeft: 900 };
  if (!state.security) state.security = { units: [] };
  if (!state.expeditions) state.expeditions = [];
  if (!state.contracts) state.contracts = { available: [], active: [], completed: 0, nextRefreshDay: 0 };
  if (!state.policies) state.policies = { nightTours: false, keeperRadio: true };
  if (state.policies.keeperRadio === undefined) state.policies.keeperRadio = true; // pre-Phase-21 saves
  if (!state.staff) state.staff = [];
  if (!state.waste) state.waste = [];
  if (!state.events) state.events = [];
  if (!state.rivalries) state.rivalries = [];
  if (!state.transport) state.transport = { cars: [] };
  if (!Array.isArray(state.objectives)) state.objectives = [];
  if (state.stats && state.stats.buzz === undefined) state.stats.buzz = 0;
  // ---- H2: defensive backfills for saves written by an older build ----
  // species added after the save was written need a knowledge slot (every accessor assumes one)
  if (!state.knowledge) state.knowledge = {};
  for (const sp of SPECIES_LIST) {
    const k = state.knowledge[sp.id];
    if (!k) { state.knowledge[sp.id] = freshKnowledge(); if (state.mode === 'sandbox') sp.hiddenAttrs.forEach((a) => { state.knowledge[sp.id].discovered[a] = true; }); continue; }
    if (!k.discovered) k.discovered = {};
    if (!k.evidence) k.evidence = {};
    if (!k.hypothesized) k.hypothesized = {};
  }
  const knownSpecies = (id) => SPECIES_LIST.some((sp) => sp.id === id);
  // research ids that no longer exist (renamed/removed projects) are dropped; dynamic projects keep
  // their generated ids unless they study a species that no longer exists
  if (!state.research) state.research = { completed: [], active: null, dynamicProjects: [] };
  if (!Array.isArray(state.research.dynamicProjects)) state.research.dynamicProjects = [];
  const nd = state.research.dynamicProjects.length;
  state.research.dynamicProjects = state.research.dynamicProjects.filter((p) => !!p && knownSpecies(p.speciesId));
  scrubbed(nd - state.research.dynamicProjects.length, 'field study project(s) of unknown species');
  const dynIds = new Set(state.research.dynamicProjects.map((p) => p.id));
  const knownResearch = (id) => !!RESEARCH[id] || dynIds.has(id);
  const before = (state.research.completed || []).length;
  state.research.completed = (state.research.completed || []).filter(knownResearch);
  scrubbed(before - state.research.completed.length, 'unknown research id(s)');
  if (state.research.active && !knownResearch(state.research.active.id)) {
    removed.push(`active research '${state.research.active.id}'`); removedCount += 1;
    warn(`cleared unknown active research '${state.research.active.id}'`);
    state.research.active = null;
  }
  // buildings / creatures of unknown types would crash the sim and renderer — drop them (and their footprint)
  const nb = (state.buildings || []).length;
  state.buildings = (state.buildings || []).filter((b) => !!BUILDINGS[b.type]);
  scrubbed(nb - state.buildings.length, 'building(s) of unknown type');
  const nc = (state.creatures || []).length;
  state.creatures = (state.creatures || []).filter((c) => knownSpecies(c.speciesId));
  scrubbed(nc - state.creatures.length, 'creature(s) of unknown species');
  // expedition specimens of an unknown species could never be claimed and would crash the claim UI
  let ns = 0;
  for (const e of state.expeditions) {
    const n0 = (e.specimens || []).length;
    e.specimens = (e.specimens || []).filter((sp) => !!sp && knownSpecies(sp.speciesId));
    ns += n0 - e.specimens.length;
  }
  scrubbed(ns, 'expedition specimen(s) of unknown species');
  if (removedCount > 0) {
    if (!Array.isArray(state.alerts)) state.alerts = [];
    pushAlert(state, { type: 'warning', title: 'SAVE REPAIRED', msg: `${removedCount} item(s) removed because they no longer exist: ${removed.join(', ')}` });
  }
  // saves that predate the seed carry seed = null and start from the default cursor
  if (!Number.isFinite(state.seed)) state.seed = null;
  if (typeof state.seedLabel !== 'string' || !state.seedLabel) state.seedLabel = null; // additive (older saves)
  const cursor = typeof state.rngState === 'number' ? state.rngState : (typeof state.rng === 'number' ? state.rng : null);
  if (cursor !== null) state.rngState = cursor;
  delete state.rng;
  state._terrainDirty = true;
  state._encDirty = true;
  state._occDirty = true;
  // restore the RNG cursor LAST: if anything above throws, the live cursor (and the game that
  // may still be running) is left exactly as it was
  if (cursor !== null) setRngState(cursor); else setRngState(Number.isFinite(state.seed) ? state.seed : 12345);
  return state;
}

export function hasResearch(state, id) { return !id || state.research.completed.includes(id); }

// ---------- controlled state mutators ----------
// All out-of-sim writes to the authoritative state go through these functions
// (never mutate state fields directly from UI/bridge code).
export function setTimeControls(state, { paused, speed } = {}) {
  if (typeof paused === 'boolean') state.paused = paused;
  if (typeof speed === 'number' && speed > 0) {
    state.speed = speed;
    state.paused = false;
  }
}

export function setTicketPrice(state, price) {
  const p = Number(price);
  if (!Number.isFinite(p)) return;
  state.ticketPrice = Math.max(10, Math.min(60, p));
}

// park policies toggled from the UI (additive: new keys default in deserialize)
const POLICY_KEYS = ['nightTours', 'keeperRadio'];

export function setPolicy(state, key, value) {
  if (!state.policies) state.policies = { nightTours: false, keeperRadio: true };
  if (!POLICY_KEYS.includes(key)) return;
  state.policies[key] = !!value;
}
