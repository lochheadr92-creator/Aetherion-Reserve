// ---- Night lighting model (sim side) ----
// Player-placed lamps (path lamps / floodlight masts) light the tiles around them after dark. Guests
// walking lit paths at night feel safe (small comfort bonus); guests in the dark lose comfort and
// complain. The share of lit night visits feeds a small "safety" carrot in the park rating.
//
// Deterministic: everything here derives from state.buildings + state.tick, and the only randomness
// (occasional one-off opinions) goes through rnd(). The light map is cached under a non-serialized
// `state._light` key and rebuilt only when the lamp layout changes.
import { MAP_SIZE } from './constants';
import { idx, inMap, rnd } from './state';
import { BUILDINGS } from './data/buildings';
import { getDayPhase } from './weather';

// tile-distance each lamp type reaches (measured from the lamp tile centre)
export const LAMP_RADIUS = { path: 2.5, flood: 4.0 };

// per guest check (guests tick needs every 20 sim ticks)
export const NIGHT_LIT_BONUS = 0.006;      // satisfaction gain per check on a lit path tile
export const NIGHT_DARK_PENALTY = 0.012;   // satisfaction loss per check on an unlit path tile
export const SAFETY_CARROT = 0.05;         // max rating-safety bonus at 100% lit night visits
export const OPINION_CHANCE = 0.25;        // one-off praise / gripe odds per guest per night

export const LIT_PATH = 1;
export const LIT_FLOOD = 2;

/** Lamps are switched on from dusk through the night (matches the renderers' dusk switch). */
export function lampsOn(state) {
  const { phase } = getDayPhase(state.tick);
  return phase === 'dusk' || phase === 'night';
}

/** Night proper — when darkness actually affects guests (dusk is a grace period). */
export function isNight(state) {
  return getDayPhase(state.tick).phase === 'night';
}

export function playerLamps(state) {
  return state.buildings.filter((b) => !!BUILDINGS[b.type]?.lamp);
}

function lampKey(lamps) {
  let k = '';
  for (const b of lamps) k += `${b.type}:${b.x},${b.y};`;
  return k;
}

/**
 * Uint8Array over the map: 0 dark, LIT_PATH under a path lamp, LIT_FLOOD under a floodlight (flood
 * wins where both overlap). Independent of the time of day — callers gate on lampsOn().
 */
export function lightMap(state) {
  const lamps = playerLamps(state);
  const key = lampKey(lamps);
  if (state._light && state._light.key === key) return state._light.map;
  const map = new Uint8Array(MAP_SIZE * MAP_SIZE);
  for (const b of lamps) {
    const kind = BUILDINGS[b.type].lamp;
    const r = LAMP_RADIUS[kind] || 2;
    const cx = b.x + 0.5, cy = b.y + 0.5;
    const level = kind === 'flood' ? LIT_FLOOD : LIT_PATH;
    const R = Math.ceil(r);
    for (let dy = -R; dy <= R; dy++) {
      for (let dx = -R; dx <= R; dx++) {
        const x = b.x + dx, y = b.y + dy;
        if (!inMap(x, y)) continue;
        if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) > r) continue;
        const i = idx(x, y);
        if (map[i] < level) map[i] = level;
      }
    }
  }
  state._light = { key, map };
  return map;
}

/** Light level of a tile when the lamps are on (0 = dark). */
export function lightAt(state, x, y) {
  if (!inMap(x, y)) return 0;
  return lightMap(state)[idx(x, y)];
}

export function isLit(state, x, y) {
  return lampsOn(state) && lightAt(state, x, y) > 0;
}

// ---- per-guest night comfort ----
function ensureStats(state) {
  const st = state.stats;
  if (!st.lighting) st.lighting = { lit: 0, dark: 0, lastLit: 0, lastDark: 0 };
  if (st.nightSafety === undefined) st.nightSafety = 0;
  return st;
}

const PRAISE = [
  'The lamps make the night walk feel safe. Lovely.',
  'Lit paths after dark — someone thought about us.',
  'Night stroll under the lamp posts. This place is classy.',
];
const GRIPE = [
  "Can't see a thing on these paths after dark.",
  'Pitch black out here. Where are the lights?',
  'I nearly walked into a fence in the dark. Put some lamps up!',
];

/**
 * Called from guestNeedsTick. Applies the lit bonus / dark penalty when the guest stands on a path
 * tile at night. Returns 'lit' | 'dark' | null (also stored on g.lit for the renderer / inspect UI).
 */
export function guestLightingTick(state, g) {
  if (!isNight(state) || g.riding || g.exiting) { g.lit = null; return null; }
  const x = Math.floor(g.x), y = Math.floor(g.y);
  if (!inMap(x, y) || !state.paths[idx(x, y)]) { g.lit = null; return null; }
  const st = ensureStats(state);
  const lit = lightAt(state, x, y) > 0;
  if (lit) {
    g.satisfaction = Math.min(1, g.satisfaction + NIGHT_LIT_BONUS);
    st.lighting.lit++;
    if (!g._nightPraised && rnd() < OPINION_CHANCE) {
      g._nightPraised = true;
      addOpinionLite(state, g, PRAISE[Math.floor(rnd() * PRAISE.length)], true);
    }
    g.lit = 'lit';
    return 'lit';
  }
  g.satisfaction = Math.max(0, g.satisfaction - NIGHT_DARK_PENALTY);
  st.lighting.dark++;
  if (!g._nightGriped && rnd() < OPINION_CHANCE) {
    g._nightGriped = true;
    addOpinionLite(state, g, GRIPE[Math.floor(rnd() * GRIPE.length)], false);
  }
  g.lit = 'dark';
  return 'dark';
}

// Mirrors guests.addOpinion (kept local to avoid a circular import): the opinion itself carries a
// satisfaction swing and is sampled into the park-wide feed.
function addOpinionLite(state, g, text, positive) {
  g.opinions.unshift(text);
  if (g.opinions.length > 4) g.opinions.length = 4;
  g.satisfaction = Math.max(0, Math.min(1, g.satisfaction + (positive ? 0.08 : -0.1)));
  state._guestFeed = state._guestFeed || [];
  state._guestFeed.unshift({ id: state.nextId++, text, positive, arch: g.archetype, tick: state.tick });
  if (state._guestFeed.length > 12) state._guestFeed.length = 12;
}

/**
 * Dawn rollover (called from dailyRollover): freeze last night's tallies and fold the lit share into
 * the nightSafety EMA that the park rating reads. Nights with no path visits leave the EMA untouched.
 */
export function lightingRollover(state) {
  const st = ensureStats(state);
  const { lit, dark } = st.lighting;
  st.lighting.lastLit = lit;
  st.lighting.lastDark = dark;
  const visits = lit + dark;
  if (visits > 0) {
    const share = lit / visits;
    st.nightSafety = st.nightSafety * 0.6 + share * 0.4;
  }
  st.lighting.lit = 0;
  st.lighting.dark = 0;
}

/** Rating-safety bonus contributed by night lighting (0 .. SAFETY_CARROT). */
export function safetyCarrot(state) {
  return SAFETY_CARROT * (state.stats?.nightSafety || 0);
}

// ---- reports (UI / tests) ----
/** Park-wide lighting summary for the finance drawer and tests. */
export function lightingReport(state) {
  const lamps = playerLamps(state);
  const map = lightMap(state);
  let pathTiles = 0, litPathTiles = 0;
  for (let i = 0; i < map.length; i++) {
    if (!state.paths[i]) continue;
    pathTiles++;
    if (map[i] > 0) litPathTiles++;
  }
  const st = ensureStats(state);
  const guestsLit = state.guests.filter((g) => g.lit === 'lit').length;
  const guestsDark = state.guests.filter((g) => g.lit === 'dark').length;
  const upkeep = lamps.reduce((s, b) => s + (BUILDINGS[b.type].upkeep || 0), 0);
  return {
    on: lampsOn(state),
    night: isNight(state),
    lamps: lamps.length,
    pathLamps: lamps.filter((b) => BUILDINGS[b.type].lamp === 'path').length,
    floodlights: lamps.filter((b) => BUILDINGS[b.type].lamp === 'flood').length,
    upkeep,
    pathTiles,
    litPathTiles,
    coverage: pathTiles ? litPathTiles / pathTiles : 0,
    tonight: { lit: st.lighting.lit, dark: st.lighting.dark },
    lastNight: { lit: st.lighting.lastLit, dark: st.lighting.lastDark },
    guestsLit,
    guestsDark,
    nightSafety: st.nightSafety,
    safetyBonus: safetyCarrot(state),
  };
}

/** Per-lamp summary for the inspect panel: tiles it lights and the guests under it right now. */
export function lampReport(state, b) {
  const def = BUILDINGS[b.type];
  const r = LAMP_RADIUS[def?.lamp] || 2;
  const cx = b.x + 0.5, cy = b.y + 0.5;
  let tiles = 0, pathTiles = 0;
  const R = Math.ceil(r);
  for (let dy = -R; dy <= R; dy++) {
    for (let dx = -R; dx <= R; dx++) {
      const x = b.x + dx, y = b.y + dy;
      if (!inMap(x, y) || Math.hypot(x + 0.5 - cx, y + 0.5 - cy) > r) continue;
      tiles++;
      if (state.paths[idx(x, y)]) pathTiles++;
    }
  }
  const guests = state.guests.filter((g) => Math.hypot(g.x - cx, g.y - cy) <= r).length;
  return { kind: def?.lamp || 'path', radius: r, tiles, pathTiles, guests, on: lampsOn(state), night: isNight(state), upkeep: def?.upkeep || 0 };
}
