// ---- Enclosure detection (flood fill bounded by fences) + habitat composition + suitability scoring ----
import { MAP_SIZE, MATERIALS, VEG, FENCES } from './constants';
import { idx, inMap } from './state';
import { edgeKey, buildOccupancy } from './pathfind';
import { speciesById } from './data/species';
import { isDiscovered } from './knowledge';

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function computeEnclosures(state) {
  if (!state._encDirty && state._enclosures) return state._enclosures;
  const S = MAP_SIZE;
  const region = new Int32Array(S * S).fill(-1);
  const regions = [];
  // Region 0 = outside: flood from all border tiles
  const flood = (sx, sy, rid) => {
    const q = [[sx, sy]];
    region[idx(sx, sy)] = rid;
    const tiles = [];
    while (q.length) {
      const [x, y] = q.pop();
      tiles.push(idx(x, y));
      for (const [dx, dy] of DIRS) {
        const nx = x + dx, ny = y + dy;
        if (!inMap(nx, ny)) continue;
        const ni = idx(nx, ny);
        if (region[ni] !== -1) continue;
        // fence (including gate) separates regions
        let f;
        if (dx === 1) f = state.fences[edgeKey(x, y, 'E')];
        else if (dx === -1) f = state.fences[edgeKey(nx, ny, 'E')];
        else if (dy === 1) f = state.fences[edgeKey(x, y, 'S')];
        else f = state.fences[edgeKey(nx, ny, 'S')];
        if (f) continue;
        region[ni] = rid;
        q.push([nx, ny]);
      }
    }
    return tiles;
  };
  // outside
  let outsideTiles = [];
  for (let x = 0; x < S; x++) {
    for (const y of [0, S - 1]) if (region[idx(x, y)] === -1) outsideTiles = outsideTiles.concat(flood(x, y, 0));
  }
  for (let y = 0; y < S; y++) {
    for (const x of [0, S - 1]) if (region[idx(x, y)] === -1) outsideTiles = outsideTiles.concat(flood(x, y, 0));
  }
  regions.push({ id: 0, outside: true, tiles: outsideTiles });
  let rid = 1;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    if (region[idx(x, y)] === -1) {
      const tiles = flood(x, y, rid);
      regions.push({ id: rid, outside: false, tiles });
      rid++;
    }
  }
  const occ = buildOccupancy(state);
  // composition per enclosure region
  const enclosures = [];
  for (const r of regions) {
    if (r.outside) continue;
    const comp = analyzeTiles(state, r.tiles, occ);
    // fence security: min tier along boundary + damaged segments
    let minTier = 99, damaged = 0, gates = 0, segs = 0;
    for (const ti of r.tiles) {
      const x = ti % S, y = Math.floor(ti / S);
      const checks = [
        [edgeKey(x, y, 'E'), x + 1, y], [edgeKey(x, y, 'S'), x, y + 1],
        [edgeKey(x - 1, y, 'E'), x - 1, y], [edgeKey(x, y - 1, 'S'), x, y - 1],
      ];
      for (const [key, nx, ny] of checks) {
        const f = state.fences[key];
        if (!f) continue;
        if (!inMap(nx, ny) || region[idx(nx, ny)] !== r.id) {
          segs++;
          if (f.gate) gates++;
          minTier = Math.min(minTier, f.tier);
          if (f.hp < FENCES[f.tier].hp * 0.4) damaged++;
        }
      }
    }
    enclosures.push({ id: r.id, tiles: r.tiles, tileSet: new Set(r.tiles), ...comp, minFenceTier: minTier === 99 ? 0 : minTier, damagedSegments: damaged, gates, fenceSegments: segs });
  }
  state._enclosures = { region, enclosures };
  state._encDirty = false;
  return state._enclosures;
}

export function analyzeTiles(state, tiles, occ) {
  const matPct = {}; let waterShallow = 0, waterDeep = 0, forest = 0, openArea = 0, elevSum = 0, elevMax = 0, elevHigh = 0, vegDensity = 0;
  let shelterIds = [], feeders = {}, usable = 0;
  occ = occ || buildOccupancy(state);
  const bMap = {};
  state.buildings.forEach((b) => { bMap[b.id] = b; });
  const seenB = new Set();
  for (const i of tiles) {
    const m = state.materials[i];
    matPct[m] = (matPct[m] || 0) + 1;
    if (state.water[i] === 1) waterShallow++;
    else if (state.water[i] === 2) waterDeep++;
    else usable++;
    const v = VEG[state.veg[i]];
    if (v) { forest += v.forest; vegDensity += v.cover; }
    const h = state.heights[i];
    elevSum += h; elevMax = Math.max(elevMax, h);
    if (h >= 4) elevHigh++;
    if (!state.veg[i] && !state.water[i] && !occ[i]) openArea++;
    if (occ[i] && !seenB.has(occ[i])) {
      seenB.add(occ[i]);
      const b = bMap[occ[i]];
      if (b) {
        if (b.shelter) shelterIds.push(b.id);
        if (b.station) feeders[b.station] = (feeders[b.station] || []).concat(b.id);
      }
    }
  }
  const n = Math.max(1, tiles.length);
  Object.keys(matPct).forEach((k) => { matPct[k] = matPct[k] / n; });
  const waterPct = (waterShallow + waterDeep) / n;
  // humidity from water + wetland/mud + veg; temperature from elevation + sand
  const humidity = Math.min(1, waterPct * 1.6 + (matPct[7] || 0) * 0.8 + (matPct[6] || 0) * 0.5 + vegDensity / n * 0.4);
  const temperature = 20 + (matPct[3] || 0) * 10 - (elevSum / n) * 2.2 - waterPct * 4;
  return {
    area: tiles.length, usable, matPct, waterShallowPct: waterShallow / n, waterDeepPct: waterDeep / n, waterPct,
    forestPct: forest / n, openPct: openArea / n, avgElev: elevSum / n, maxElev: elevMax, highGroundPct: elevHigh / n,
    humidity, temperature, shelters: shelterIds, feeders,
  };
}

export function enclosureAt(state, x, y) {
  const { region, enclosures } = computeEnclosures(state);
  if (!inMap(x, y)) return null;
  const rid = region[idx(x, y)];
  if (rid === 0) return null;
  return enclosures.find((e) => e.id === rid) || null;
}

// ---------- habitat suitability for a creature: array of factors with explanations ----------
const ramp = (v, lo, hi) => {
  if (v <= lo) return Math.max(0, v / Math.max(lo, 0.001));
  if (hi != null && v > hi) return Math.max(0.2, 1 - (v - hi) * 2);
  return 1;
};

export function evaluateHabitat(state, creature, enc) {
  const sp = speciesById(creature.speciesId);
  const factors = [];
  const add = (key, label, score, cause) => factors.push({ key, label, score: Math.max(0, Math.min(1, score)), cause });
  if (!enc) {
    add('containment', 'Containment', 0, 'NOT CONTAINED — creature is outside any enclosure');
    return { factors, overall: 0.15 };
  }
  const pop = state.creatures.filter((c) => c.enclosureId === enc.id);
  const sameSpecies = pop.filter((c) => c.speciesId === sp.id).length;

  // space
  const needed = sp.env.minArea + sp.env.spacePerHead * Math.max(0, sameSpecies - 1);
  const spaceScore = Math.min(1, enc.usable / Math.max(1, needed));
  add('space', 'Space', spaceScore, spaceScore < 0.85 ? `Enclosure has ${enc.usable} usable tiles; ${sp.name} group needs ~${needed}` : 'Sufficient roaming area');

  // terrain preference
  const prefPct = sp.env.terrain.prefer.reduce((s, m) => s + (enc.matPct[m] || 0), 0);
  const avoidPct = sp.env.terrain.avoid.reduce((s, m) => s + (enc.matPct[m] || 0), 0);
  let terrScore = ramp(prefPct, sp.env.terrain.preferMin) - avoidPct * 0.8;
  const prefNames = sp.env.terrain.prefer.map((m) => MATERIALS[m].name).join(', ');
  add('terrain', 'Terrain', terrScore, prefPct < sp.env.terrain.preferMin
    ? `Preferred ground (${prefNames}) is ${(prefPct * 100).toFixed(0)}% — needs ${(sp.env.terrain.preferMin * 100).toFixed(0)}%+`
    : avoidPct > 0.15 ? `Too much disliked substrate (${(avoidPct * 100).toFixed(0)}%)` : 'Ground composition suits this species');

  // forest
  const f = enc.forestPct;
  let forestScore = 1;
  let forestCause = 'Canopy coverage acceptable';
  if (f < sp.env.forest.min) { forestScore = Math.max(0.1, f / Math.max(0.01, sp.env.forest.min)); forestCause = `Canopy ${(f * 100).toFixed(0)}% — below required ${(sp.env.forest.min * 100).toFixed(0)}%`; }
  else if (f > sp.env.forest.max) { forestScore = Math.max(0.15, 1 - (f - sp.env.forest.max) * 1.8); forestCause = `Canopy ${(f * 100).toFixed(0)}% — too dense (max ${(sp.env.forest.max * 100).toFixed(0)}%)`; }
  add('forest', 'Canopy', forestScore, forestCause);

  // water: drinking vs aquatic habitat (distinct requirements)
  if (sp.env.water.drink) {
    const hasDrink = enc.waterPct > 0;
    add('drink', 'Drinking Water', hasDrink ? 1 : 0, hasDrink ? 'Drinking water available' : 'NO WATER ACCESS — add any water');
  }
  if (sp.env.water.aquaticMin > 0) {
    const wp = enc.waterPct;
    let ws = ramp(wp, sp.env.water.aquaticMin);
    let cause = ws >= 1 ? 'Aquatic habitat sufficient' : `Water coverage ${(wp * 100).toFixed(0)}% — this species needs ${(sp.env.water.aquaticMin * 100).toFixed(0)}%+ aquatic habitat (drinking access is not enough)`;
    if (sp.env.water.needsDeep && enc.waterDeepPct < 0.02) { ws = Math.min(ws, 0.4); cause = 'INSUFFICIENT DEEP WATER — requires deep hunting water'; }
    add('aquatic', 'Aquatic Habitat', ws, cause);
  }

  // elevation
  const e = enc.avgElev;
  let elevScore = 1; let elevCause = 'Elevation within comfort range';
  if (sp.env.elevation.min >= 4) {
    elevScore = ramp(enc.highGroundPct, 0.25);
    elevCause = elevScore < 1 ? `High ground (level 4+) is ${(enc.highGroundPct * 100).toFixed(0)}% — needs 25%+ elevated rocky terrain` : 'Sufficient high ground';
  } else if (e < sp.env.elevation.min) { elevScore = 0.5; elevCause = 'Ground too low for this species'; }
  else if (e > sp.env.elevation.max) { elevScore = Math.max(0.3, 1 - (e - sp.env.elevation.max) * 0.25); elevCause = `Average elevation ${e.toFixed(1)} above comfort max ${sp.env.elevation.max}`; }
  add('elevation', 'Elevation', elevScore, elevCause);

  // shelter
  if (sp.env.shelter) {
    const hasShelter = enc.shelters.length > 0;
    add('shelter', 'Shelter', hasShelter ? 1 : 0.25, hasShelter ? 'Shelter available' : 'NO SHELTER — this species requires a Habitat Shelter');
  }

  // social
  const soc = sp.social;
  let socScore = 1; let socCause = 'Group size comfortable';
  if (sameSpecies < soc.min) { socScore = Math.max(0.2, sameSpecies / soc.min * 0.7); socCause = `Only ${sameSpecies} ${sp.name}(s) — needs a group of ${soc.min}+`; }
  else if (sameSpecies > soc.max) { socScore = Math.max(0.2, 1 - (sameSpecies - soc.max) * 0.15); socCause = `Overcrowded: ${sameSpecies} exceeds max ${soc.max}`; }
  add('social', 'Social', socScore, socCause);

  // symbiosis
  if (sp.compat.requires) {
    const partner = pop.some((c) => c.speciesId === sp.compat.requires);
    const partnerName = isDiscovered(state, sp.id, 'social') ? speciesById(sp.compat.requires).name : 'an unidentified partner species';
    add('symbiosis', 'Symbiosis', partner ? 1 : 0.2, partner ? 'Symbiotic partner present' : `Requires ${partnerName} in the same enclosure`);
  }

  // cohabitation: hostiles & predators
  const others = pop.filter((c) => c.speciesId !== sp.id);
  let danger = 0; const dangerNames = new Set();
  for (const o of others) {
    const osp = speciesById(o.speciesId);
    if ((sp.compat.hostile || []).includes(o.speciesId) || (osp.compat.hostile || []).includes(sp.id)) { danger += 0.5; dangerNames.add(osp.name); }
    if ((osp.compat.prey || []).includes(sp.id)) { danger += 0.8; dangerNames.add(osp.name); }
  }
  if (others.length) {
    add('cohab', 'Cohabitation', Math.max(0, 1 - danger), danger > 0 ? `Threatened by: ${[...dangerNames].join(', ')}` : 'Cohabitants tolerated');
  }

  // temperature & humidity (broad ranges, informational)
  const t = enc.temperature;
  const tempScore = t >= 8 && t <= 30 ? 1 : 0.6;
  add('temp', 'Temperature', tempScore, tempScore < 1 ? `Enclosure temperature ${t.toFixed(0)}°C outside tolerance` : `Stable at ${t.toFixed(0)}°C`);

  const weights = { space: 1.2, terrain: 1.2, forest: 0.9, drink: 1.3, aquatic: 1.2, elevation: 1.0, shelter: 0.8, social: 1.1, symbiosis: 1.2, cohab: 1.4, temp: 0.4 };
  let sum = 0, wsum = 0;
  for (const f2 of factors) { const w = weights[f2.key] || 1; sum += f2.score * w; wsum += w; }

  // UNKNOWN BIOLOGY ENFORCEMENT: if the underlying attribute has not been
  // discovered, the UI must not learn the true requirement from cause text.
  // The welfare consequence stays real; the explanation stays a mystery.
  const gateMap = { terrain: 'terrain', forest: 'forest', aquatic: 'water', drink: 'water', elevation: 'elevation', social: 'social', symbiosis: 'social', shelter: 'shelter' };
  for (const f2 of factors) {
    const attr = gateMap[f2.key];
    if (attr && !isDiscovered(state, sp.id, attr) && f2.score < 0.99) {
      f2.cause = `Cause not yet understood \u2014 the ${f2.label.toLowerCase()} needs of this species are undocumented. Observe behaviour or run a field study.`;
      f2.masked = true;
    }
  }
  return { factors, overall: wsum ? sum / wsum : 0.5 };
}
