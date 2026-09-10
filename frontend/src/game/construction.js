// ---- Construction: buildings, fences, gates, demolition ----
import { MAP_SIZE, FENCES, COSTS } from './constants';
import { idx, inMap, hasResearch, pushAlert } from './state';
import { BUILDINGS } from './data/buildings';
import { buildOccupancy, edgeKey } from './pathfind';
import { spend, earn } from './economy';

export function canPlaceBuilding(state, typeId, x, y) {
  const def = BUILDINGS[typeId];
  if (!def) return { ok: false, reason: 'Unknown building' };
  if (def.locked && !hasResearch(state, def.locked)) return { ok: false, reason: 'Requires research' };
  if (def.unique && state.buildings.some((b) => b.type === typeId)) return { ok: false, reason: 'Only one may be built' };
  const occ = buildOccupancy(state);
  let h0 = null;
  for (let dy = 0; dy < def.h; dy++) for (let dx = 0; dx < def.w; dx++) {
    const tx = x + dx, ty = y + dy;
    if (!inMap(tx, ty)) return { ok: false, reason: 'Out of bounds' };
    const i = idx(tx, ty);
    if (occ[i]) return { ok: false, reason: 'Overlaps existing structure' };
    if (state.water[i]) return { ok: false, reason: 'Cannot build on water' };
    if (state.paths[i]) return { ok: false, reason: 'Blocked by path' };
    if (h0 === null) h0 = state.heights[i];
    else if (state.heights[i] !== h0) return { ok: false, reason: 'Terrain must be flat — use Flatten tool' };
    // internal fence check
    if (dx < def.w - 1 && state.fences[edgeKey(tx, ty, 'E')]) return { ok: false, reason: 'Fence crosses footprint' };
    if (dy < def.h - 1 && state.fences[edgeKey(tx, ty, 'S')]) return { ok: false, reason: 'Fence crosses footprint' };
  }
  if (def.needsPath) {
    let adj = false;
    for (let dy = -1; dy <= def.h; dy++) for (let dx = -1; dx <= def.w; dx++) {
      const tx = x + dx, ty = y + dy;
      if (inMap(tx, ty) && state.paths[idx(tx, ty)]) adj = true;
    }
    if (!adj) return { ok: false, reason: 'Must be adjacent to a path' };
  }
  if (def.needsPower && !isPowered(state, x, y)) return { ok: false, reason: 'Requires Power Relay coverage' };
  if (def.needsBuilding && !adjacentBuilding(state, x, y, def.w, def.h)) return { ok: false, reason: 'Must stand next to a building' };
  return { ok: true };
}

// Any real building (lamps themselves do not count) touching the footprint's 8-neighbourhood.
export function adjacentBuilding(state, x, y, w = 1, h = 1) {
  return state.buildings.some((b) => {
    if (BUILDINGS[b.type]?.lamp) return false;
    const bw = b.w || 1, bh = b.h || 1;
    return b.x <= x + w && b.x + bw >= x && b.y <= y + h && b.y + bh >= y;
  });
}

// The building a floodlight faces: nearest non-lamp building centre (for aiming its throw).
export function lampTarget(state, lamp) {
  let best = null, bd = Infinity;
  for (const b of state.buildings) {
    if (BUILDINGS[b.type]?.lamp) continue;
    const bw = b.w || 1, bh = b.h || 1;
    const cx = b.x + bw / 2, cy = b.y + bh / 2;
    const d = Math.hypot(cx - (lamp.x + 0.5), cy - (lamp.y + 0.5));
    if (d < bd) { bd = d; best = { x: cx, y: cy, b }; }
  }
  return best;
}

export function placeBuilding(state, typeId, x, y) {
  const chk = canPlaceBuilding(state, typeId, x, y);
  if (!chk.ok) return chk;
  const def = BUILDINGS[typeId];
  const pay = spend(state, def.cost, 'construction', def.name);
  if (!pay.ok) return pay;
  const b = { id: state.nextId++, type: typeId, x, y, w: def.w, h: def.h, shelter: !!def.shelter, station: def.station || null };
  state.buildings.push(b);
  // clear veg under footprint
  for (let dy = 0; dy < def.h; dy++) for (let dx = 0; dx < def.w; dx++) state.veg[idx(x + dx, y + dy)] = 0;
  state._occDirty = true; state._encDirty = true; state._terrainDirty = true;
  return { ok: true, building: b };
}

export function demolishBuilding(state, id) {
  const bi = state.buildings.findIndex((b) => b.id === id);
  if (bi < 0) return { ok: false, reason: 'Not found' };
  const def = BUILDINGS[state.buildings[bi].type];
  earn(state, def.cost * 0.5, 'grants', `Demolition salvage: ${def.name}`);
  state.buildings.splice(bi, 1);
  state._occDirty = true; state._encDirty = true; state._terrainDirty = true;
  return { ok: true };
}

export function isPowered(state, x, y) {
  for (const b of state.buildings) {
    if (b.type !== 'power') continue;
    if (b.offlineUntil && state.tick < b.offlineUntil) continue; // surge-damaged relay
    const def = BUILDINGS.power;
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    if (Math.hypot(x - cx, y - cy) <= def.powerRadius) return true;
  }
  return false;
}

// ---------- fences ----------

// Per-segment validation (no funds/research check — those are done once per action)
export function canPlaceFenceSegment(state, x, y, d, tier) {
  if (!inMap(x, y)) return { ok: false, reason: 'Out of bounds' };
  const nx = d === 'E' ? x + 1 : x, ny = d === 'S' ? y + 1 : y;
  if (!inMap(nx, ny)) return { ok: false, reason: 'Map boundary already contains' };
  const existing = state.fences[edgeKey(x, y, d)];
  if (existing && existing.tier === tier && !existing.gate) return { ok: false, reason: 'Fence already here' };
  const occ = buildOccupancy(state);
  if (occ[idx(x, y)] && occ[idx(nx, ny)] && occ[idx(x, y)] === occ[idx(nx, ny)]) return { ok: false, reason: 'Inside a structure' };
  return { ok: true };
}

export function placeFence(state, x, y, d, tier) {
  const def = FENCES[tier];
  if (!def) return { ok: false, reason: 'Unknown fence tier' };
  if (def.locked && !hasResearch(state, def.locked)) return { ok: false, reason: `Requires research: ${def.name}` };
  const chk = canPlaceFenceSegment(state, x, y, d, tier);
  if (!chk.ok) return chk;
  const pay = spend(state, def.cost, 'construction', `${def.name} segment`);
  if (!pay.ok) return pay;
  const key = edgeKey(x, y, d);
  const existing = state.fences[key];
  if (existing) earn(state, FENCES[existing.tier].cost * 0.5, 'grants', 'Fence replacement salvage');
  state.fences[key] = { tier, hp: def.hp, gate: false };
  if (state.gaps && state.gaps[key]) delete state.gaps[key]; // the player closed a breach gap
  state._encDirty = true;
  return { ok: true };
}

// Straight fence line between two lattice corners (vertices are tile corners, 0..MAP_SIZE).
// Constrained to the dominant drag axis so a drag always yields one clean straight wall.
export function fenceLineEdges(v0, v1) {
  if (!v0 || !v1) return [];
  const dx = v1.vx - v0.vx, dy = v1.vy - v0.vy;
  const edges = [];
  if (Math.abs(dx) >= Math.abs(dy)) {
    // horizontal wall: S edges of tile row (vy - 1)
    const vy = Math.max(1, Math.min(MAP_SIZE - 1, v0.vy));
    const a = Math.min(v0.vx, v1.vx), b = Math.max(v0.vx, v1.vx);
    for (let vx = a; vx < b; vx++) {
      if (vx >= 0 && vx <= MAP_SIZE - 1) edges.push({ x: vx, y: vy - 1, d: 'S' });
    }
  } else {
    // vertical wall: E edges of tile column (vx - 1)
    const vx = Math.max(1, Math.min(MAP_SIZE - 1, v0.vx));
    const a = Math.min(v0.vy, v1.vy), b = Math.max(v0.vy, v1.vy);
    for (let vy = a; vy < b; vy++) {
      if (vy >= 0 && vy <= MAP_SIZE - 1) edges.push({ x: vx - 1, y: vy, d: 'E' });
    }
  }
  return edges;
}

// Rectangle perimeter between two lattice corners: all four walls in one action.
// Degenerate rectangles (zero width or height) fall back to a straight line.
export function fenceRectEdges(v0, v1) {
  if (!v0 || !v1) return [];
  const x0 = Math.max(0, Math.min(MAP_SIZE, Math.min(v0.vx, v1.vx)));
  const x1 = Math.max(0, Math.min(MAP_SIZE, Math.max(v0.vx, v1.vx)));
  const y0 = Math.max(1, Math.min(MAP_SIZE - 1, Math.min(v0.vy, v1.vy)));
  const y1 = Math.max(1, Math.min(MAP_SIZE - 1, Math.max(v0.vy, v1.vy)));
  if (x1 - x0 === 0 || y1 - y0 === 0) return fenceLineEdges(v0, v1);
  const edges = [];
  const cx0 = Math.max(1, x0), cx1 = Math.min(MAP_SIZE - 1, x1);
  // top + bottom walls (S edges of tile rows y0-1 and y1-1)
  for (let vx = x0; vx < x1; vx++) {
    if (vx >= 0 && vx <= MAP_SIZE - 1) {
      edges.push({ x: vx, y: y0 - 1, d: 'S' });
      edges.push({ x: vx, y: y1 - 1, d: 'S' });
    }
  }
  // left + right walls (E edges of tile columns cx0-1 and cx1-1)
  for (let vy = y0; vy < y1; vy++) {
    if (vy >= 0 && vy <= MAP_SIZE - 1) {
      edges.push({ x: cx0 - 1, y: vy, d: 'E' });
      edges.push({ x: cx1 - 1, y: vy, d: 'E' });
    }
  }
  return edges;
}

function commitFenceEdges(state, edges, tier) {
  const def = FENCES[tier];
  if (!def) return { ok: false, reason: 'Unknown fence tier' };
  if (def.locked && !hasResearch(state, def.locked)) return { ok: false, reason: `Requires research: ${def.name}` };
  const placeable = edges.filter((e) => canPlaceFenceSegment(state, e.x, e.y, e.d, tier).ok);
  if (!placeable.length) return { ok: false, reason: 'No placeable segments there' };
  const total = def.cost * placeable.length;
  const pay = spend(state, total, 'construction', `${def.name} × ${placeable.length}`);
  if (!pay.ok) return pay;
  for (const e of placeable) {
    const key = edgeKey(e.x, e.y, e.d);
    const existing = state.fences[key];
    if (existing) earn(state, FENCES[existing.tier].cost * 0.5, 'grants', 'Fence replacement salvage');
    state.fences[key] = { tier, hp: def.hp, gate: false };
    if (state.gaps && state.gaps[key]) delete state.gaps[key]; // closes a breach gap
  }
  state._encDirty = true;
  return { ok: true, msg: `${def.name} × ${placeable.length} placed (−◈${total})` };
}

export function placeFenceLine(state, v0, v1, tier) {
  return commitFenceEdges(state, fenceLineEdges(v0, v1), tier);
}

export function placeFenceRect(state, v0, v1, tier) {
  return commitFenceEdges(state, fenceRectEdges(v0, v1), tier);
}

function removeFenceEdges(state, edges) {
  let count = 0, refund = 0;
  for (const e of edges) {
    const key = edgeKey(e.x, e.y, e.d);
    if (state.gaps && state.gaps[key]) delete state.gaps[key]; // demolishing the line retires its gaps
    const f = state.fences[key];
    if (!f) continue;
    refund += FENCES[f.tier].cost * 0.5;
    delete state.fences[key];
    count++;
  }
  if (!count) return { ok: false, reason: 'No fence segments there' };
  earn(state, refund, 'grants', `Fence salvage × ${count}`);
  state._encDirty = true;
  return { ok: true, msg: `Removed ${count} segment${count > 1 ? 's' : ''} (+◈${Math.round(refund)} salvage)` };
}

export function removeFenceLine(state, v0, v1) {
  return removeFenceEdges(state, fenceLineEdges(v0, v1));
}

export function removeFenceRect(state, v0, v1) {
  return removeFenceEdges(state, fenceRectEdges(v0, v1));
}

export function removeFence(state, x, y, d) {
  const key = edgeKey(x, y, d);
  const f = state.fences[key];
  if (!f) return { ok: false, reason: 'No fence here' };
  earn(state, FENCES[f.tier].cost * 0.5, 'grants', 'Fence salvage');
  delete state.fences[key];
  state._encDirty = true;
  return { ok: true };
}

export function toggleGate(state, x, y, d) {
  const key = edgeKey(x, y, d);
  const f = state.fences[key];
  if (!f) return { ok: false, reason: 'Place a fence segment first' };
  if (!f.gate) {
    const pay = spend(state, COSTS.gate, 'construction', 'Access gate');
    if (!pay.ok) return pay;
    f.gate = true;
  } else {
    f.gate = false;
    earn(state, COSTS.gate * 0.5, 'grants', 'Gate salvage');
  }
  state._encDirty = true;
  return { ok: true };
}

export function repairFence(state, x, y, d) {
  const key = edgeKey(x, y, d);
  const f = state.fences[key];
  if (!f) return { ok: false, reason: 'No fence here' };
  const def = FENCES[f.tier];
  const missing = def.hp - f.hp;
  if (missing <= 0) return { ok: false, reason: 'Fence at full integrity' };
  const cost = Math.ceil(missing * 0.5);
  const pay = spend(state, cost, 'construction', 'Fence repair');
  if (!pay.ok) return pay;
  f.hp = def.hp;
  return { ok: true };
}

export function damageFence(state, key, amount, causeMsg) {
  const f = state.fences[key];
  if (!f) return false;
  f.hp -= amount;
  if (f.hp <= 60 && f.hp + amount > 60) {
    const [x, y] = key.split(',');
    pushAlert(state, { type: 'warning', title: 'FENCE DAMAGED', msg: causeMsg || 'A containment barrier is failing.', target: { kind: 'tile', x: +x, y: +y } });
  }
  if (f.hp <= 0) {
    destroyFence(state, key, 'collapse');
    const [x, y] = key.split(',');
    pushAlert(state, { type: 'danger', title: 'CONTAINMENT BREACH', msg: 'A barrier segment has collapsed. Check the enclosure immediately.', target: { kind: 'tile', x: +x, y: +y } });
    return true;
  }
  return false;
}

// ---------- breach gaps: a destroyed segment stays on record until it is rebuilt ----------
// `state.gaps[key] = { tier, tick, encId, by }` marks the enclosure as physically open ("damaged
// state"). The player closes it by placing a fence on the key; wardens rebuild it as a task.

// which enclosure region a fence edge belonged to (cached regions from before the collapse)
export function fenceEnclosureId(state, key) {
  const region = state._enclosures?.region;
  if (!region) return null;
  const [xs, ys, d] = key.split(',');
  const x = Number(xs), y = Number(ys);
  const a = inMap(x, y) ? region[idx(x, y)] : 0;
  const nx = d === 'E' ? x + 1 : x, ny = d === 'E' ? y : y + 1;
  const b = inMap(nx, ny) ? region[idx(nx, ny)] : 0;
  const encs = state._enclosures.enclosures;
  const isEnc = (rid) => rid > 0 && encs.some((e) => e.id === rid);
  return isEnc(a) ? a : isEnc(b) ? b : null;
}

// Remove a segment and register the gap (`by` = 'collapse' | 'breach' | creature name).
export function destroyFence(state, key, by = 'collapse') {
  const f = state.fences[key];
  if (!f) return null;
  const encId = fenceEnclosureId(state, key);
  delete state.fences[key];
  state._encDirty = true;
  state.stats.breaches++;
  if (!state.gaps) state.gaps = {};
  state.gaps[key] = { tier: f.tier, tick: state.tick, encId, by };
  return state.gaps[key];
}

// The two tiles a fence edge separates.
const gapSides = (key) => {
  const [xs, ys, d] = key.split(',');
  const x = Number(xs), y = Number(ys);
  return [[x, y], d === 'E' ? [x + 1, y] : [x, y + 1]];
};

// Live association: does this gap currently border region `rid`? Flood-fill regions renumber after
// every fence edit, so the encId stored at destruction time is history (alert text), not identity.
export function gapBordersRegion(state, key, rid) {
  const region = state._enclosures?.region;
  if (!region) return state.gaps?.[key]?.encId === rid;
  return gapSides(key).some(([x, y]) => inMap(x, y) && region[idx(x, y)] === rid);
}

const gapList = (state, pred) => Object.entries(state.gaps || {}).filter(([key]) => pred(key)).map(([key, g]) => ({ key, ...g }));

// Gaps bordering one (still closed) enclosure region — e.g. a broken divider shared with a neighbour.
export const gapsFor = (state, encId) => gapList(state, (key) => gapBordersRegion(state, key, encId));

// Gaps that leave a perimeter open: neither side sits inside a closed enclosure any more.
export function openGaps(state) {
  const region = state._enclosures?.region;
  return gapList(state, (key) => !region || gapSides(key).every(([x, y]) => !inMap(x, y) || region[idx(x, y)] === 0));
}

// Warden rebuild: re-erect the segment at its previous tier (paid from park funds).
export function rebuildGap(state, key, who = 'Warden') {
  const g = state.gaps?.[key];
  if (!g) return { ok: false, reason: 'No gap here' };
  if (state.fences[key]) { delete state.gaps[key]; return { ok: true, already: true }; }
  const def = FENCES[g.tier] || FENCES[1];
  const pay = spend(state, def.cost, 'construction', `${who} rebuilt a ${def.name} segment`);
  if (!pay.ok) return pay;
  state.fences[key] = { tier: def.tier, hp: def.hp, gate: false };
  delete state.gaps[key];
  state._encDirty = true;
  return { ok: true };
}
