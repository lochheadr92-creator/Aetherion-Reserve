// ---- A* pathfinding on the tile grid; fences (incl. gates) block creatures. ----
import { MAP_SIZE } from './constants';
import { idx, inMap } from './state';

export function edgeKey(x, y, d) { return `${x},${y},${d}`; }

// blocked edge between (x,y) and (nx,ny) — 4-neighbour only
export function fenceBetween(state, x, y, nx, ny) {
  if (nx === x + 1 && ny === y) return state.fences[edgeKey(x, y, 'E')];
  if (nx === x - 1 && ny === y) return state.fences[edgeKey(nx, ny, 'E')];
  if (ny === y + 1 && nx === x) return state.fences[edgeKey(x, y, 'S')];
  if (ny === y - 1 && nx === x) return state.fences[edgeKey(nx, ny, 'S')];
  return undefined;
}

export function buildOccupancy(state) {
  if (!state._occDirty && state._occ) return state._occ;
  const occ = new Array(MAP_SIZE * MAP_SIZE).fill(0);
  for (const b of state.buildings) {
    for (let dy = 0; dy < b.h; dy++) for (let dx = 0; dx < b.w; dx++) {
      if (inMap(b.x + dx, b.y + dy)) occ[idx(b.x + dx, b.y + dy)] = b.id;
    }
  }
  state._occ = occ; state._occDirty = false;
  return occ;
}

export function walkableForCreature(state, x, y, swims) {
  if (!inMap(x, y)) return false;
  const i = idx(x, y);
  const occ = buildOccupancy(state);
  const b = occ[i];
  if (b) {
    // creatures can stand next to but not on buildings, except feeders/shelters footprint edges are fine to target adjacently
    return false;
  }
  if (state.water[i] === 2 && !swims) return false;
  return true;
}

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// A* limited search. crossFences=false for creatures. Returns array of {x,y} or null.
export function findPath(state, sx, sy, tx, ty, opts = {}) {
  const { swims = false, crossFences = false, maxNodes = 2600, walkFn = null } = opts;
  if (sx === tx && sy === ty) return [];
  const walk = walkFn || ((x, y) => walkableForCreature(state, x, y, swims));
  if (!walk(tx, ty)) return null;
  const open = [{ x: sx, y: sy, g: 0, f: 0, parent: null }];
  const seen = new Map();
  seen.set(idx(sx, sy), 0);
  let nodes = 0;
  while (open.length && nodes < maxNodes) {
    nodes++;
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
    const cur = open.splice(bi, 1)[0];
    if (cur.x === tx && cur.y === ty) {
      const path = [];
      let n = cur;
      while (n.parent) { path.unshift({ x: n.x, y: n.y }); n = n.parent; }
      return path;
    }
    for (const [dx, dy] of DIRS) {
      const nx = cur.x + dx, ny = cur.y + dy;
      if (!walk(nx, ny)) continue;
      if (!crossFences && fenceBetween(state, cur.x, cur.y, nx, ny)) continue;
      const i = idx(nx, ny);
      const wCost = state.water[i] ? 1.8 : 1;
      const hDiff = Math.abs(state.heights[i] - state.heights[idx(cur.x, cur.y)]);
      if (hDiff > 2) continue; // cliffs block
      const g = cur.g + wCost + hDiff * 0.6;
      if (seen.has(i) && seen.get(i) <= g) continue;
      seen.set(i, g);
      open.push({ x: nx, y: ny, g, f: g + Math.abs(nx - tx) + Math.abs(ny - ty), parent: cur });
    }
  }
  return null;
}

// BFS reachable set within an enclosure (used by creature target picking)
export function reachableTiles(state, sx, sy, swims, limit = 900) {
  const out = [];
  const q = [[sx, sy]];
  const seen = new Set([idx(sx, sy)]);
  while (q.length && out.length < limit) {
    const [x, y] = q.shift();
    out.push({ x, y });
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy;
      const i = idx(nx, ny);
      if (seen.has(i)) continue;
      if (!walkableForCreature(state, nx, ny, swims)) continue;
      if (fenceBetween(state, x, y, nx, ny)) continue;
      if (Math.abs(state.heights[i] - state.heights[idx(x, y)]) > 2) continue;
      seen.add(i);
      q.push([nx, ny]);
    }
  }
  return out;
}
