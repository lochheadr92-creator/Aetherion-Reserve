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
  return { ok: true };
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

export function placeFenceLine(state, v0, v1, tier) {
  const def = FENCES[tier];
  if (!def) return { ok: false, reason: 'Unknown fence tier' };
  if (def.locked && !hasResearch(state, def.locked)) return { ok: false, reason: `Requires research: ${def.name}` };
  const edges = fenceLineEdges(v0, v1);
  const placeable = edges.filter((e) => canPlaceFenceSegment(state, e.x, e.y, e.d, tier).ok);
  if (!placeable.length) return { ok: false, reason: 'No placeable segments along that line' };
  const total = def.cost * placeable.length;
  const pay = spend(state, total, 'construction', `${def.name} × ${placeable.length}`);
  if (!pay.ok) return pay;
  for (const e of placeable) {
    const key = edgeKey(e.x, e.y, e.d);
    const existing = state.fences[key];
    if (existing) earn(state, FENCES[existing.tier].cost * 0.5, 'grants', 'Fence replacement salvage');
    state.fences[key] = { tier, hp: def.hp, gate: false };
  }
  state._encDirty = true;
  return { ok: true, msg: `${def.name} × ${placeable.length} placed (−◈${total})` };
}

export function removeFenceLine(state, v0, v1) {
  const edges = fenceLineEdges(v0, v1);
  let count = 0, refund = 0;
  for (const e of edges) {
    const key = edgeKey(e.x, e.y, e.d);
    const f = state.fences[key];
    if (!f) continue;
    refund += FENCES[f.tier].cost * 0.5;
    delete state.fences[key];
    count++;
  }
  if (!count) return { ok: false, reason: 'No fence segments along that line' };
  earn(state, refund, 'grants', `Fence salvage × ${count}`);
  state._encDirty = true;
  return { ok: true, msg: `Removed ${count} segment${count > 1 ? 's' : ''} (+◈${Math.round(refund)} salvage)` };
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
    delete state.fences[key];
    state._encDirty = true;
    const [x, y] = key.split(',');
    pushAlert(state, { type: 'danger', title: 'CONTAINMENT BREACH', msg: 'A barrier segment has collapsed. Check the enclosure immediately.', target: { kind: 'tile', x: +x, y: +y } });
    state.stats.breaches++;
    return true;
  }
  return false;
}
