// ---- Guests: arrival, path movement, needs, viewing visibility, spending, opinions ----
import { MAP_SIZE, VEG } from './constants';
import { idx, inMap, rnd, hasResearch, logCause } from './state';
import { BUILDINGS } from './data/buildings';
import { speciesById } from './data/species';
import { getSpeciesView } from './knowledge';
import { earn } from './economy';

const ARCHETYPES = [
  { key: 'family', name: 'Family', color: '#e0c080', spendMult: 1.0, wantsSafety: true },
  { key: 'researcher', name: 'Researcher', color: '#6ef3c5', spendMult: 0.8, lovesUnknown: true },
  { key: 'thrill', name: 'Thrill Seeker', color: '#ff8a7a', spendMult: 1.1, lovesDanger: true },
  { key: 'nature', name: 'Nature Lover', color: '#8fd0b0', spendMult: 0.9, lovesWelfare: true },
];

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function pathBFS(state, sx, sy, targetSet, maxNodes = 2500) {
  // BFS across path tiles from (sx,sy) to any tile in targetSet (Set of idx)
  const start = idx(sx, sy);
  if (targetSet.has(start)) return [];
  const prev = new Map([[start, null]]);
  const q = [[sx, sy]];
  let nodes = 0;
  while (q.length && nodes++ < maxNodes) {
    const [x, y] = q.shift();
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy;
      if (!inMap(nx, ny)) continue;
      const ni = idx(nx, ny);
      if (prev.has(ni) || !state.paths[ni]) continue;
      prev.set(ni, idx(x, y));
      if (targetSet.has(ni)) {
        const path = [];
        let cur = ni;
        while (cur !== null && cur !== start) { path.unshift({ x: cur % MAP_SIZE, y: Math.floor(cur / MAP_SIZE) }); cur = prev.get(cur); }
        return path;
      }
      q.push([nx, ny]);
    }
  }
  return null;
}

function pathTilesAdjacentTo(state, b) {
  const set = new Set();
  for (let dy = -1; dy <= b.h; dy++) for (let dx = -1; dx <= b.w; dx++) {
    const tx = b.x + dx, ty = b.y + dy;
    if (inMap(tx, ty) && state.paths[idx(tx, ty)]) set.add(idx(tx, ty));
  }
  return set;
}

export function spawnGuests(state) {
  const hasAdmin = state.buildings.some((b) => b.type === 'admin');
  if (!hasAdmin || state.creatures.length === 0) return;
  const cap = 110;
  if (state.guests.length >= cap) return;
  const appealSum = state.creatures.reduce((s, c) => s + speciesById(c.speciesId).appeal, 0);
  let rate = 0.25 + Math.min(1.2, appealSum / 150) + state.rating.overall * 0.8;
  if (hasResearch(state, 'fac_marketing')) rate *= 1.4;
  // ticket price sensitivity
  rate *= Math.max(0.3, 1.4 - state.ticketPrice / 60);
  const n = Math.floor(rate) + (rnd() < rate % 1 ? 1 : 0);
  for (let k = 0; k < n && state.guests.length < cap; k++) {
    const arch = ARCHETYPES[Math.floor(rnd() * ARCHETYPES.length)];
    earn(state, state.ticketPrice, 'tickets', null);
    state.stats.guestsTotal++;
    state.guests.push({
      id: state.nextId++, x: state.entrance.x + 0.5, y: state.entrance.y + 0.5,
      path: [], target: null, dwell: 0, archetype: arch.key,
      needs: { hunger: 0.6 + rnd() * 0.4, thirst: 0.6 + rnd() * 0.4, restroom: 0.7 + rnd() * 0.3, fun: 0.2 },
      satisfaction: 0.6, opinions: [], ticksInPark: 0, leaving: false, seen: 0,
    });
  }
}

export function tickGuestMovement(state, g) {
  g.ticksInPark++;
  if (g.path && g.path.length) {
    const t = g.path[0];
    const dx = t.x + 0.5 - g.x, dy = t.y + 0.5 - g.y;
    const d = Math.hypot(dx, dy);
    const spd = 0.06;
    if (d < spd) { g.x = t.x + 0.5; g.y = t.y + 0.5; g.path.shift(); }
    else { g.x += (dx / d) * spd; g.y += (dy / d) * spd; }
  } else if (g.dwell > 0) {
    g.dwell--;
    if (g.dwell === 0 && g.target) arriveAtTarget(state, g);
  }
}

function addOpinion(state, g, text, positive) {
  g.opinions.unshift(text);
  if (g.opinions.length > 4) g.opinions.length = 4;
  g.satisfaction = Math.max(0, Math.min(1, g.satisfaction + (positive ? 0.08 : -0.1)));
  // sample opinions into a park-wide feed
  state._guestFeed = state._guestFeed || [];
  state._guestFeed.unshift({ text, positive, arch: g.archetype, tick: state.tick });
  if (state._guestFeed.length > 12) state._guestFeed.length = 12;
}

function visibilityFrom(state, b, def) {
  // returns [{creature, vis}] for creatures within radius, occlusion by vegetation cover along the line
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  const R = def.viewRadius;
  const out = [];
  for (const c of state.creatures) {
    const d = Math.hypot(c.x - cx, c.y - cy);
    if (d > R) continue;
    let block = 0;
    const steps = 5;
    for (let s = 1; s < steps; s++) {
      const px = Math.floor(cx + (c.x - cx) * (s / steps));
      const py = Math.floor(cy + (c.y - cy) * (s / steps));
      if (!inMap(px, py)) continue;
      const v = VEG[state.veg[idx(px, py)]];
      if (v) block += v.cover * 0.35;
      // creatures behind high terrain relative to platform
      if (state.heights[idx(px, py)] >= state.heights[idx(Math.floor(cx), Math.floor(cy))] + 3) block += 0.3;
    }
    let vis = Math.max(0, (1 - d / R)) * Math.max(0.05, 1 - block);
    if (def.id === 'tower') vis = Math.max(vis, (1 - d / R) * 0.5); // elevation sees over cover
    const ct = idx(Math.floor(c.x), Math.floor(c.y));
    if (state.water[ct] === 2) vis *= 0.55; // submerged
    if (vis > 0.08) out.push({ creature: c, vis });
  }
  return out;
}

export function platformVisibilityReport(state, b) {
  const def = BUILDINGS[b.type];
  if (!def.viewRadius) return null;
  return visibilityFrom(state, b, def);
}

function arriveAtTarget(state, g) {
  const t = g.target;
  g.target = null;
  if (!t) return;
  const b = state.buildings.find((bb) => bb.id === t.id);
  if (!b) return;
  const def = BUILDINGS[b.type];
  if (def.viewRadius) {
    const seen = visibilityFrom(state, b, def);
    const score = seen.reduce((s, e) => s + speciesById(e.creature.speciesId).appeal * e.vis, 0);
    if (score > 12) {
      g.needs.fun = Math.min(1, g.needs.fun + 0.35 + score / 300);
      g.seen += seen.length;
      const best = seen.sort((a, b2) => b2.vis - a.vis)[0];
      const sp = speciesById(best.creature.speciesId);
      const view = getSpeciesView(state, sp.id);
      if (g.archetype === 'researcher' && view.unknown.length) {
        addOpinion(state, g, `I observed an unclassified organism — ${sp.name}. Incredible.`, true);
        g.satisfaction = Math.min(1, g.satisfaction + 0.06);
      } else if (g.archetype === 'thrill' && sp.danger >= 3) {
        addOpinion(state, g, `The ${sp.name} looked right at me. Worth every credit.`, true);
      } else {
        addOpinion(state, g, `Amazing view of the ${sp.name} habitat!`, true);
      }
    } else if (seen.length > 0) {
      addOpinion(state, g, 'I could barely glimpse anything through the cover.', false);
      g.needs.fun = Math.min(1, g.needs.fun + 0.08);
    } else {
      addOpinion(state, g, `Couldn't see a single creature from the ${def.name}.`, false);
    }
  } else if (def.sells === 'food') { g.needs.hunger = 1; earn(state, def.price * archMult(g), 'food', null); }
  else if (def.sells === 'drink') { g.needs.thirst = 1; earn(state, def.price * archMult(g), 'drink', null); }
  else if (def.sells === 'restroom') { g.needs.restroom = 1; }
  else if (def.sells === 'gift') { earn(state, def.price * archMult(g), 'gift', null); g.needs.fun = Math.min(1, g.needs.fun + 0.1); addOpinion(state, g, 'The curio shop is delightful.', true); }
}

function archMult(g) { return ARCHETYPES.find((a) => a.key === g.archetype)?.spendMult || 1; }

export function decideGuest(state, g) {
  if (g.path.length || g.dwell > 0) return;
  const { x, y } = { x: Math.floor(g.x), y: Math.floor(g.y) };
  // safety: dangerous escaped creature nearby → flee to exit
  const danger = state.creatures.some((c) => c.escaped && speciesById(c.speciesId).danger >= 3);
  if (danger && !g.fleeing) {
    g.fleeing = true; g.leaving = true;
    addOpinion(state, g, 'There is something loose out here! This place is not safe!', false);
    g.satisfaction = Math.max(0, g.satisfaction - 0.25);
  }
  if (g.leaving) {
    const exitSet = new Set([idx(state.entrance.x, state.entrance.y)]);
    const p = pathBFS(state, x, y, exitSet);
    if (p) { g.path = p; g.exiting = true; return; }
    g.despawn = true; return;
  }
  // needs decay handled in needs tick; choose most pressing
  const wants = [];
  if (g.needs.hunger < 0.35) wants.push(['food', 'hunger']);
  if (g.needs.thirst < 0.35) wants.push(['drink', 'thirst']);
  if (g.needs.restroom < 0.3) wants.push(['restroom', 'restroom']);
  let targetB = null;
  if (wants.length) {
    const [sell, needKey] = wants[0];
    const options = state.buildings.filter((b) => BUILDINGS[b.type].sells === sell);
    if (!options.length) {
      if (!g[`_c_${needKey}`]) {
        g[`_c_${needKey}`] = true;
        addOpinion(state, g, sell === 'restroom' ? 'There are no restrooms anywhere!' : `Nowhere to get ${sell === 'food' ? 'a meal' : 'a drink'}...`, false);
      }
      if (g.needs[needKey] < 0.1) { g.leaving = true; return; }
    } else targetB = options[Math.floor(rnd() * options.length)];
  }
  if (!targetB) {
    // entertainment: viewing platforms
    const platforms = state.buildings.filter((b) => BUILDINGS[b.type].viewRadius);
    if (platforms.length && g.needs.fun < 0.85) {
      targetB = platforms[Math.floor(rnd() * platforms.length)];
    } else if (g.ticksInPark > 1500 || g.needs.fun >= 0.85) {
      g.leaving = true;
      return;
    }
  }
  if (targetB) {
    const set = pathTilesAdjacentTo(state, targetB);
    if (set.size) {
      const p = pathBFS(state, x, y, set);
      if (p) { g.path = p; g.target = { id: targetB.id }; g.dwell = 0; g._dwellNext = true; return; }
    }
    if (!g._noRoute) { g._noRoute = true; addOpinion(state, g, 'Half this facility is not even connected by paths.', false); }
  }
  // idle wander on paths
  const neigh = DIRS.map(([dx, dy]) => ({ x: x + dx, y: y + dy })).filter((t) => inMap(t.x, t.y) && state.paths[idx(t.x, t.y)]);
  if (neigh.length) g.path = [neigh[Math.floor(rnd() * neigh.length)]];
}

export function guestNeedsTick(state, g) {
  g.needs.hunger = Math.max(0, g.needs.hunger - 0.006);
  g.needs.thirst = Math.max(0, g.needs.thirst - 0.008);
  g.needs.restroom = Math.max(0, g.needs.restroom - 0.005);
  g.needs.fun = Math.max(0, g.needs.fun - 0.003);
  // arriving at a target sets dwell
  if (g._dwellNext && !g.path.length && g.target) { g.dwell = 25; g._dwellNext = false; }
  // rolling satisfaction pressure from unmet needs
  const unmet = Math.min(g.needs.hunger, g.needs.thirst, g.needs.restroom);
  if (unmet < 0.15) g.satisfaction = Math.max(0, g.satisfaction - 0.01);
}

export function cullGuests(state) {
  const before = state.guests.length;
  state.guests = state.guests.filter((g) => {
    const atExit = g.exiting && !g.path.length;
    if (atExit || g.despawn || g.ticksInPark > 6000) {
      // record satisfaction
      state.stats.guestSat = state.stats.guestSat * 0.9 + g.satisfaction * 0.1;
      return false;
    }
    return true;
  });
  return before - state.guests.length;
}
