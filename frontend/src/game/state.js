// ---- Authoritative game state. The renderer reads this; it never defines it. ----
import { MAP_SIZE, MAX_H } from './constants';
import { SPECIES_LIST } from './data/species';

export const idx = (x, y) => y * MAP_SIZE + x;
export const inMap = (x, y) => x >= 0 && y >= 0 && x < MAP_SIZE && y < MAP_SIZE;

// Simple event bus so React UI can subscribe to sim events without owning state
const listeners = {};
export const on = (evt, fn) => { (listeners[evt] = listeners[evt] || []).push(fn); return () => { listeners[evt] = listeners[evt].filter((f) => f !== fn); }; };
export const emit = (evt, data) => { (listeners[evt] || []).forEach((fn) => { try { fn(data); } catch (e) { console.error(e); } }); };

let seedCounter = 12345;
export const rnd = () => { seedCounter = (seedCounter * 1103515245 + 12345) % 2147483648; return seedCounter / 2147483648; };

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

export function createNewGame({ parkName = 'Aetherion Reserve', mode = 'management' } = {}) {
  const S = MAP_SIZE;
  const state = {
    version: 1, mode, parkName,
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
    stats: { guestsTotal: 0, discoveries: 0, breaches: 0, guestSat: 0.7 },
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
    state.research.completed = ['bio_obs1', 'bio_obs2', 'bio_stress', 'env_flora', 'env_hydro', 'cont_reinforced', 'cont_heavy', 'cont_insulated', 'fac_tower', 'fac_gift', 'fac_marketing', 'ops_field2', 'ops_field3'];
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
  return JSON.parse(JSON.stringify(clean));
}

export function deserialize(data) {
  const state = data;
  if (!state.weather) state.weather = { type: 'clear', ticksLeft: 900 };
  state._terrainDirty = true;
  state._encDirty = true;
  state._occDirty = true;
  return state;
}

export function hasResearch(state, id) { return !id || state.research.completed.includes(id); }
