// ---- Terrain sculpting, painting, water, vegetation, paths — with costs, validation and undo ----
import { MAP_SIZE, MAX_H, COSTS, MATERIALS, VEG } from './constants';
import { idx, inMap, hasResearch, logCause } from './state';
import { buildOccupancy } from './pathfind';
import { spend } from './economy';

const undoStack = [];
export const getUndoCount = () => undoStack.length;

function snapshotTiles(state, tiles) {
  return tiles.map((i) => ({ i, h: state.heights[i], m: state.materials[i], w: state.water[i], v: state.veg[i], p: state.paths[i] }));
}

function pushUndo(state, changes, cost) {
  undoStack.push({ changes, cost });
  if (undoStack.length > 25) undoStack.shift();
}

export function undoTerrain(state) {
  const op = undoStack.pop();
  if (!op) return { ok: false, reason: 'Nothing to undo' };
  for (const c of op.changes) {
    state.heights[c.i] = c.h; state.materials[c.i] = c.m; state.water[c.i] = c.w; state.veg[c.i] = c.v; state.paths[c.i] = c.p;
  }
  state.cash += op.cost;
  state.finances.today.expenses.terrain -= op.cost;
  state._terrainDirty = true; state._encDirty = true;
  logCause(state, 'Terrain', `Undo restored ${op.changes.length} tiles, refunded ${op.cost}`);
  return { ok: true };
}
export function clearUndo() { undoStack.length = 0; }

function brushTiles(cx, cy, size) {
  const tiles = [];
  const r = size - 1;
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const x = cx + dx, y = cy + dy;
    if (inMap(x, y) && Math.abs(dx) + Math.abs(dy) <= r + (size > 1 ? 1 : 0)) tiles.push(idx(x, y));
  }
  return tiles;
}

function tileBlockReason(state, i) {
  const occ = buildOccupancy(state);
  if (occ[i]) return 'Occupied by structure';
  if (state.paths[i]) return 'Remove path first';
  return null;
}

// ---------- height tools ----------
export function applyHeightTool(state, tool, cx, cy, size) {
  const tiles = brushTiles(cx, cy, size).filter((i) => inMap(i % MAP_SIZE, Math.floor(i / MAP_SIZE)));
  const editable = [];
  let blocked = null;
  for (const i of tiles) {
    const reason = tileBlockReason(state, i);
    if (reason) { blocked = reason; continue; }
    if (state.water[i] && tool !== 'lower') { blocked = 'Drain water first'; continue; }
    editable.push(i);
  }
  if (!editable.length) return { ok: false, reason: blocked || 'No editable tiles' };
  const snap = snapshotTiles(state, editable);
  let changed = 0;
  const centerH = state.heights[idx(cx, cy)];
  for (const i of editable) {
    const h = state.heights[i];
    let nh = h;
    if (tool === 'raise') nh = Math.min(MAX_H, h + 1);
    else if (tool === 'lower') nh = Math.max(0, h - 1);
    else if (tool === 'flatten') nh = centerH;
    else if (tool === 'smooth') {
      const x = i % MAP_SIZE, y = Math.floor(i / MAP_SIZE);
      let sum = h, n = 1;
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => { if (inMap(x + dx, y + dy)) { sum += state.heights[idx(x + dx, y + dy)]; n++; } });
      nh = Math.round(sum / n);
    }
    if (nh !== h) { state.heights[i] = nh; changed++; if (tool === 'lower' && state.water[i] && nh === 0) { /* water stays */ } }
  }
  if (!changed) return { ok: false, reason: 'No change' };
  const cost = changed * COSTS[tool === 'raise' ? 'raise' : tool === 'lower' ? 'lower' : tool === 'flatten' ? 'flatten' : 'smooth'];
  const pay = spend(state, cost, 'terrain', `Terrain ${tool} x${changed}`);
  if (!pay.ok) { // rollback
    for (const c of snapshotTiles(state, editable)) { /* noop */ }
    for (const c of snap) { state.heights[c.i] = c.h; }
    return pay;
  }
  pushUndo(state, snap, cost);
  state.stats.terrainEdits = (state.stats.terrainEdits || 0) + changed;
  state._terrainDirty = true; state._encDirty = true;
  return { ok: true, cost, changed };
}

// ---------- material painting ----------
export function applyPaint(state, matId, cx, cy, size) {
  const mat = MATERIALS[matId];
  if (!mat) return { ok: false, reason: 'Unknown material' };
  if (mat.locked && !hasResearch(state, mat.locked)) return { ok: false, reason: 'Requires research: Exotic Flora Cultivation' };
  const tiles = brushTiles(cx, cy, size);
  const editable = tiles.filter((i) => {
    const occ = buildOccupancy(state);
    return !occ[i] && !state.paths[i] && state.materials[i] !== matId;
  });
  if (!editable.length) return { ok: false, reason: 'No paintable tiles here' };
  const snap = snapshotTiles(state, editable);
  const cost = editable.length * mat.cost;
  const pay = spend(state, cost, 'terrain', `Paint ${mat.name} x${editable.length}`);
  if (!pay.ok) return pay;
  editable.forEach((i) => { state.materials[i] = matId; });
  pushUndo(state, snap, cost);
  state._terrainDirty = true; state._encDirty = true;
  return { ok: true, cost };
}

// ---------- water ----------
export function applyWater(state, mode, cx, cy, size) {
  // mode: 1 shallow, 2 deep, 0 remove
  if (mode === 2 && !hasResearch(state, 'env_hydro')) return { ok: false, reason: 'Deep water requires Hydro-Engineering research' };
  const occ = buildOccupancy(state);
  const tiles = brushTiles(cx, cy, size).filter((i) => !occ[i] && !state.paths[i]);
  const editable = tiles.filter((i) => state.water[i] !== mode);
  if (!editable.length) return { ok: false, reason: 'No valid tiles (structures/paths block water)' };
  const snap = snapshotTiles(state, editable);
  const mult = hasResearch(state, 'env_hydro') ? 0.5 : 1;
  const unit = mode === 0 ? COSTS.waterRemove : mode === 1 ? COSTS.waterShallow * mult : COSTS.waterDeep * mult;
  const cost = Math.round(editable.length * unit);
  const pay = spend(state, cost, 'terrain', `${mode === 0 ? 'Drain' : mode === 1 ? 'Shallow water' : 'Deep water'} x${editable.length}`);
  if (!pay.ok) return pay;
  editable.forEach((i) => {
    state.water[i] = mode;
    if (mode > 0) { state.veg[i] = 0; }
  });
  if (mode > 0) state.stats.waterPlaced = (state.stats.waterPlaced || 0) + editable.length;
  pushUndo(state, snap, cost);
  state._terrainDirty = true; state._encDirty = true;
  return { ok: true, cost };
}

// ---------- vegetation ----------
export function applyVeg(state, vegId, cx, cy, size) {
  const occ = buildOccupancy(state);
  if (vegId === 0) {
    const tiles = brushTiles(cx, cy, size).filter((i) => state.veg[i] !== 0);
    if (!tiles.length) return { ok: false, reason: 'No vegetation here' };
    const snap = snapshotTiles(state, tiles);
    const cost = tiles.length * COSTS.vegRemove;
    const pay = spend(state, cost, 'terrain', `Clear vegetation x${tiles.length}`);
    if (!pay.ok) return pay;
    tiles.forEach((i) => { state.veg[i] = 0; });
    pushUndo(state, snap, cost);
    state._terrainDirty = true; state._encDirty = true;
    return { ok: true, cost };
  }
  const v = VEG[vegId];
  if (!v) return { ok: false, reason: 'Unknown flora' };
  if (v.locked && !hasResearch(state, v.locked)) return { ok: false, reason: 'Requires research: Exotic Flora Cultivation' };
  const tiles = brushTiles(cx, cy, size).filter((i) => !occ[i] && !state.paths[i] && !state.water[i] && state.veg[i] !== vegId);
  if (!tiles.length) return { ok: false, reason: 'No plantable tiles (needs dry, open ground)' };
  const snap = snapshotTiles(state, tiles);
  const cost = tiles.length * v.cost;
  const pay = spend(state, cost, 'terrain', `Plant ${v.name} x${tiles.length}`);
  if (!pay.ok) return pay;
  tiles.forEach((i) => { state.veg[i] = vegId; });
  pushUndo(state, snap, cost);
  state._terrainDirty = true; state._encDirty = true;
  return { ok: true, cost };
}

// ---------- paths ----------
export function applyPath(state, add, cx, cy) {
  if (!inMap(cx, cy)) return { ok: false, reason: 'Out of bounds' };
  const i = idx(cx, cy);
  const occ = buildOccupancy(state);
  if (add) {
    if (state.paths[i]) return { ok: false, reason: 'Already path' };
    if (occ[i]) return { ok: false, reason: 'Occupied by structure' };
    if (state.water[i]) return { ok: false, reason: 'Cannot path over water' };
    const pay = spend(state, COSTS.path, 'construction', 'Path segment');
    if (!pay.ok) return pay;
    const snap = snapshotTiles(state, [i]);
    state.paths[i] = 1; state.veg[i] = 0;
    pushUndo(state, snap, COSTS.path);
  } else {
    if (!state.paths[i]) return { ok: false, reason: 'No path here' };
    const snap = snapshotTiles(state, [i]);
    state.paths[i] = 0;
    state.cash += Math.round(COSTS.path * 0.5);
    pushUndo(state, snap, -Math.round(COSTS.path * 0.5));
  }
  state._terrainDirty = true; state._encDirty = true;
  return { ok: true };
}
