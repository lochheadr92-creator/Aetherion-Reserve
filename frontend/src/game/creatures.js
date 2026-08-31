// ---- Creature simulation: needs, behaviour state machine, evidence generation ----
import { MAP_SIZE, MATERIALS, VEG, FENCES } from './constants';
import { idx, inMap, rnd, pushAlert, logCause, hasResearch } from './state';
import { speciesById } from './data/species';
import { computeEnclosures, enclosureAt, evaluateHabitat } from './enclosures';
import { findPath, reachableTiles, buildOccupancy, edgeKey } from './pathfind';
import { recordEvidence, discover } from './knowledge';
import { spend } from './economy';
import { damageFence, isPowered } from './construction';
import { isStorm, getDayPhase } from './weather';
import { rollWildGenes, inheritGenes, offspringName } from './genetics';
import { emitParkEvent } from './events';

let nameCounter = {};

export function addCreature(state, speciesId, x, y, opts = {}) {
  const sp = speciesById(speciesId);
  nameCounter[speciesId] = (nameCounter[speciesId] || 0) + 1;
  const c = {
    id: state.nextId++, speciesId, name: `${sp.name} ${String.fromCharCode(64 + Math.min(26, state.creatures.filter((q) => q.speciesId === speciesId).length + 1))}`,
    x: x + 0.5, y: y + 0.5, path: [], state: 'idle', stateTicks: 0, actionTicks: 0,
    needs: { hunger: 0.85, thirst: 0.85, energy: 0.95 },
    welfare: 0.7, comfort: 0.7, stress: 0.1, health: 1,
    factors: [], enclosureId: null, homeTile: { x, y }, escaped: false, dir: 1,
    trait: ['Calm', 'Curious', 'Restless', 'Bold', 'Timid'][Math.floor(rnd() * 5)],
    genes: opts.genes || rollWildGenes(),
  };
  if (opts.juvenile) { c.juvenile = true; c.growth = 0; }
  const enc = enclosureAt(state, x, y);
  c.enclosureId = enc ? enc.id : null;
  state.creatures.push(c);
  state._encDirty = true;
  return c;
}

export function removeCreature(state, id) {
  const i = state.creatures.findIndex((c) => c.id === id);
  if (i >= 0) state.creatures.splice(i, 1);
}

const SPEED = 0.045; // tiles per tick

export function tickCreatureMovement(state, c) {
  if (c.path && c.path.length) {
    const t = c.path[0];
    const dx = t.x + 0.5 - c.x, dy = t.y + 0.5 - c.y;
    const d = Math.hypot(dx, dy);
    const sp = speciesById(c.speciesId);
    const spd = SPEED * (sp.bodyType === 'float' ? 0.8 : 1) * (c.state === 'flee' ? 1.8 : 1);
    if (d < spd) { c.x = t.x + 0.5; c.y = t.y + 0.5; c.path.shift(); }
    else { c.x += (dx / d) * spd; c.y += (dy / d) * spd; c.dir = dx - dy >= 0 ? 1 : -1; }
  }
  c.stateTicks++;
}

function curTile(c) { return { x: Math.floor(c.x), y: Math.floor(c.y) }; }

function findFeeder(state, enc, station) {
  if (!enc || !station) return null;
  const ids = enc.feeders[station];
  if (!ids || !ids.length) return null;
  const b = state.buildings.find((bb) => bb.id === ids[0]);
  return b || null;
}

function adjacentWalkable(state, b, swims) {
  const opts = [];
  for (let dy = -1; dy <= b.h; dy++) for (let dx = -1; dx <= b.w; dx++) {
    if (dx >= 0 && dx < b.w && dy >= 0 && dy < b.h) continue;
    const tx = b.x + dx, ty = b.y + dy;
    if (inMap(tx, ty) && !buildOccupancy(state)[idx(tx, ty)] && (state.water[idx(tx, ty)] !== 2 || swims)) opts.push({ x: tx, y: ty });
  }
  return opts;
}

function scoreTileForSpecies(state, sp, i) {
  let s = 0;
  const m = state.materials[i];
  if (sp.env.terrain.prefer.includes(m)) s += 2;
  if (sp.env.terrain.avoid.includes(m)) s -= 2;
  const h = state.heights[i];
  if (sp.env.elevation.min >= 4) s += h >= 4 ? 3 : -1;
  else if (h >= sp.env.elevation.min && h <= sp.env.elevation.max) s += 0.5;
  const v = VEG[state.veg[i]];
  const cover = v ? v.forest : 0;
  if (sp.env.forest.min > 0.3) s += cover > 0.5 ? 2 : 0;
  if (sp.env.forest.max < 0.3 && cover > 0.5) s -= 1.5;
  if (state.water[i]) s += sp.env.water.aquaticMin > 0 ? 2 : -1.5;
  return s + rnd() * 1.2; // noise keeps behaviour organic
}

export function decideCreature(state, c) {
  const sp = speciesById(c.speciesId);
  const swims = sp.env.water.aquaticMin > 0;
  const { x, y } = curTile(c);
  const enc = enclosureAt(state, x, y);
  c.enclosureId = enc ? enc.id : null;
  if (!enc && !c.escaped) {
    c.escaped = true;
    pushAlert(state, {
      type: sp.danger >= 3 ? 'danger' : 'warning', title: 'CREATURE OUTSIDE CONTAINMENT',
      msg: `${c.name} (${sp.name}) is loose${sp.danger >= 3 ? ' — DANGEROUS ASSET. Dispatch a recall team.' : '. Dispatch a recall team.'}`,
      target: { kind: 'creature', id: c.id },
    });
  } else if (enc && c.escaped) {
    c.escaped = false;
  }

  if (c.path.length) return; // still travelling

  // finish current action first
  if (c.actionTicks > 0) { c.actionTicks--; performAction(state, c, sp, enc); return; }

  const reach = () => reachableTiles(state, x, y, swims, 500);

  // priority: thirst → hunger → energy → aquatic urge → social → preferred terrain → wander
  if (sp.env.water.drink && c.needs.thirst < 0.4) {
    const tiles = reach().filter((t) => state.water[idx(t.x, t.y)] > 0);
    if (tiles.length) {
      const t = tiles[Math.floor(rnd() * tiles.length)];
      const p = findPath(state, x, y, t.x, t.y, { swims });
      if (p) { c.path = p; c.state = 'seekWater'; return; }
    }
    c.state = 'thirsty'; // no water reachable — welfare factor already explains
  }
  if (c.needs.hunger < 0.45) {
    if (sp.diet.feedsFromWater) {
      const tiles = reach().filter((t) => state.water[idx(t.x, t.y)] > 0);
      if (tiles.length) {
        const t = tiles[Math.floor(rnd() * tiles.length)];
        const p = findPath(state, x, y, t.x, t.y, { swims });
        if (p) { c.path = p; c.state = 'seekFilterFeed'; return; }
      }
    } else {
      const feeder = findFeeder(state, enc, sp.diet.station);
      if (feeder) {
        const adj = adjacentWalkable(state, feeder, swims);
        for (const a of adj) {
          const p = findPath(state, x, y, a.x, a.y, { swims });
          if (p) { c.path = p; c.state = 'seekFood'; c.targetFeeder = feeder.id; return; }
        }
      }
      // graze fallback for herbivorous types
      if (['Grazer', 'Browser', 'Scavenger'].includes(sp.diet.type)) {
        const tiles = reach().filter((t) => {
          const i = idx(t.x, t.y);
          return [0, 1, 8].includes(state.materials[i]) || state.veg[i] > 0;
        });
        if (tiles.length) {
          const t = tiles[Math.floor(rnd() * tiles.length)];
          const p = findPath(state, x, y, t.x, t.y, { swims });
          if (p) { c.path = p; c.state = 'seekGraze'; return; }
        }
      }
      c.state = 'hungry';
    }
  }
  if (c.needs.energy < 0.3) {
    // shelter if required & available, else best tile
    if (sp.env.shelter && enc && enc.shelters.length) {
      const sb = state.buildings.find((b) => b.id === enc.shelters[0]);
      if (sb) {
        const adj = adjacentWalkable(state, sb, swims);
        for (const a of adj) {
          const p = findPath(state, x, y, a.x, a.y, { swims });
          if (p) { c.path = p; c.state = 'seekShelter'; return; }
        }
      }
    }
    c.state = 'resting'; c.actionTicks = 60; return;
  }
  // storm instinct: seek shelter (or hunker down) while a storm is overhead
  if (isStorm(state) && enc && rnd() < 0.5) {
    if (enc.shelters.length) {
      const sb = state.buildings.find((b) => b.id === enc.shelters[0]);
      if (sb) {
        const adj = adjacentWalkable(state, sb, swims);
        for (const a of adj) {
          const p = findPath(state, x, y, a.x, a.y, { swims });
          if (p) { c.path = p; c.state = 'seekShelter'; return; }
        }
      }
    }
    c.state = 'resting'; c.actionTicks = 50; return;
  }
  // nocturnal species hide from daylight: seek shelter or dense canopy by day
  if (sp.activity === 'nocturnal' && getDayPhase(state.tick).phase === 'day' && enc && rnd() < 0.45) {
    if (enc.shelters.length) {
      const sb = state.buildings.find((b) => b.id === enc.shelters[0]);
      if (sb) {
        const adj = adjacentWalkable(state, sb, swims);
        for (const a of adj) {
          const p = findPath(state, x, y, a.x, a.y, { swims });
          if (p) { c.path = p; c.state = 'seekShelter'; return; }
        }
      }
    }
    const shady = reach().filter((t) => { const v = VEG[state.veg[idx(t.x, t.y)]]; return v && v.forest > 0.4; });
    if (shady.length) {
      const t = shady[Math.floor(rnd() * shady.length)];
      const p = findPath(state, x, y, t.x, t.y, { swims });
      if (p) { c.path = p; c.state = 'seekTerrain'; return; }
    }
  }
  // aquatic urge
  if (swims && rnd() < 0.35) {
    const tiles = reach().filter((t) => state.water[idx(t.x, t.y)] > 0);
    if (tiles.length) {
      const t = tiles[Math.floor(rnd() * tiles.length)];
      const p = findPath(state, x, y, t.x, t.y, { swims });
      if (p) { c.path = p; c.state = 'seekSwim'; return; }
    }
  }
  // social pull
  const flock = state.creatures.filter((o) => o.id !== c.id && o.speciesId === c.speciesId && o.enclosureId === c.enclosureId);
  if (sp.social.min > 1 && flock.length && rnd() < 0.4) {
    const buddy = flock[Math.floor(rnd() * flock.length)];
    const bt = curTile(buddy);
    const p = findPath(state, x, y, bt.x, bt.y, { swims, maxNodes: 1200 });
    if (p && p.length > 1) { c.path = p.slice(0, -1); c.state = 'seekSocial'; return; }
    // already adjacent to kin — socialise in place
    c.state = 'socialising'; c.actionTicks = 30;
    recordEvidence(state, sp.id, 'social', 1);
    return;
  }
  // seek preferred terrain (the readable-evidence behaviour)
  const tiles = reach();
  if (tiles.length) {
    let best = null, bestS = -99;
    for (let k = 0; k < Math.min(24, tiles.length); k++) {
      const t = tiles[Math.floor(rnd() * tiles.length)];
      const s = scoreTileForSpecies(state, sp, idx(t.x, t.y));
      if (s > bestS) { bestS = s; best = t; }
    }
    if (best) {
      const p = findPath(state, x, y, best.x, best.y, { swims });
      if (p) { c.path = p; c.state = bestS > 2 ? 'seekTerrain' : 'wander'; return; }
    }
  }
  c.state = 'idle'; c.actionTicks = 20;
}

function performAction(state, c, sp, enc) {
  const { x, y } = curTile(c);
  const i = idx(x, y);
  switch (c.state) {
    case 'resting': {
      c.needs.energy = Math.min(1, c.needs.energy + 0.02);
      if (c.actionTicks % 20 === 0) {
        // resting location generates habitat evidence
        if (sp.env.terrain.prefer.includes(state.materials[i])) recordEvidence(state, sp.id, 'terrain', 1);
        if (sp.env.elevation.min >= 4 && state.heights[i] >= 4) recordEvidence(state, sp.id, 'elevation', 1.5);
        const v = VEG[state.veg[i]];
        if (sp.env.forest.min > 0.3 && v && v.forest > 0.4) recordEvidence(state, sp.id, 'forest', 1);
      }
      break;
    }
    default: break;
  }
}

// called when a creature arrives (path empty) with an intent state
export function onArrive(state, c) {
  const sp = speciesById(c.speciesId);
  const { x, y } = curTile(c);
  const i = idx(x, y);
  switch (c.state) {
    case 'seekWater':
      if (state.water[i] > 0) { c.state = 'drinking'; c.actionTicks = 25; c.needs.thirst = 1; logCause(state, c.name, 'drank'); }
      else c.state = 'idle';
      break;
    case 'seekSwim':
      if (state.water[i] > 0) {
        c.state = 'swimming'; c.actionTicks = 50;
        recordEvidence(state, sp.id, 'water', state.water[i] === 2 ? 1.6 : 1);
      } else c.state = 'idle';
      break;
    case 'seekFilterFeed':
      if (state.water[i] > 0) {
        c.state = 'filterFeeding'; c.actionTicks = 40; c.needs.hunger = 1;
        recordEvidence(state, sp.id, 'diet', 1.4);
        recordEvidence(state, sp.id, 'water', 1);
      } else c.state = 'idle';
      break;
    case 'seekFood': {
      c.state = 'eating'; c.actionTicks = 30; c.needs.hunger = 1;
      const cost = { forage: 8, meat: 26, mineral: 14, fungal: 16, energy: 30 }[sp.diet.station] || 10;
      spend(state, cost, 'feed', `${sp.name} feeding`);
      recordEvidence(state, sp.id, 'diet', 1.2);
      break;
    }
    case 'seekGraze':
      c.state = 'grazing'; c.actionTicks = 45; c.needs.hunger = Math.min(1, c.needs.hunger + 0.5);
      recordEvidence(state, sp.id, 'diet', 0.6);
      // grazers slowly consume vegetation
      if (state.veg[i] && rnd() < 0.3) { state.veg[i] = Math.max(0, state.veg[i] === 4 ? 3 : 0); state._terrainDirty = true; state._encDirty = true; }
      break;
    case 'seekShelter':
      c.state = 'sheltering'; c.actionTicks = 60; c.needs.energy = Math.min(1, c.needs.energy + 0.6);
      recordEvidence(state, sp.id, 'shelter', 1.5);
      break;
    case 'seekTerrain':
      c.state = 'settling'; c.actionTicks = 40;
      if (sp.env.terrain.prefer.includes(state.materials[i])) recordEvidence(state, sp.id, 'terrain', 1);
      if (sp.env.elevation.min >= 4 && state.heights[i] >= 4) recordEvidence(state, sp.id, 'elevation', 1.5);
      { const v = VEG[state.veg[i]]; if (sp.env.forest.min > 0.3 && v && v.forest > 0.4) recordEvidence(state, sp.id, 'forest', 1); }
      break;
    case 'seekSocial':
      c.state = 'socialising'; c.actionTicks = 35;
      recordEvidence(state, sp.id, 'social', 1);
      break;
    default:
      c.state = 'idle'; c.actionTicks = 10;
  }
}

export function updateNeeds(state, c) {
  const sp = speciesById(c.speciesId);
  // metabolism gene: voracious lines get hungry faster (0.5 baseline -> x1.0)
  c.needs.hunger = Math.max(0, c.needs.hunger - 0.0085 * (0.8 + (c.genes?.metabolism ?? 0.5) * 0.4));
  if (sp.env.water.drink) c.needs.thirst = Math.max(0, c.needs.thirst - 0.011);
  else c.needs.thirst = 1;
  const restoring = ['resting', 'sheltering', 'settling', 'drinking', 'eating', 'grazing'].includes(c.state);
  c.needs.energy = Math.max(0, Math.min(1, c.needs.energy + (restoring ? 0.12 : -0.006)));
  // resting on preferred ground is readable evidence
  if (c.state === 'resting' || c.state === 'settling') {
    const i = idx(Math.floor(c.x), Math.floor(c.y));
    if (sp.env.terrain.prefer.includes(state.materials[i])) recordEvidence(state, sp.id, 'terrain', 0.5);
    if (sp.env.elevation.min >= 4 && state.heights[i] >= 4) recordEvidence(state, sp.id, 'elevation', 0.8);
    const v = VEG[state.veg[i]];
    if (sp.env.forest.min > 0.3 && v && v.forest > 0.4) recordEvidence(state, sp.id, 'forest', 0.5);
  }
}

export function updateWelfare(state, c) {
  const sp = speciesById(c.speciesId);
  const { x, y } = curTile(c);
  const enc = enclosureAt(state, x, y);
  const habitat = evaluateHabitat(state, c, enc);
  c.factors = habitat.factors;
  c.comfort = habitat.overall;
  const needsAvg = (c.needs.hunger + c.needs.thirst + c.needs.energy) / 3;
  c.welfare = 0.5 * c.comfort + 0.5 * needsAvg;
  // genetic stress tolerance scales all stress accumulation (0.5 baseline -> x1.0)
  const stressMult = (hasResearch(state, 'bio_stress') ? 0.7 : 1) * (1.3 - (c.genes?.stressTol ?? 0.5) * 0.6);
  if (c.welfare < 0.5) c.stress = Math.min(1, c.stress + (0.5 - c.welfare) * 0.05 * stressMult);
  else c.stress = Math.max(0, c.stress - 0.02);
  // weather & day-night pressure
  const sheltered = ['sheltering', 'seekShelter'].includes(c.state);
  if (isStorm(state) && !sheltered) c.stress = Math.min(1, c.stress + 0.015 * stressMult);
  if (sp.activity === 'nocturnal') {
    const { phase } = getDayPhase(state.tick);
    const { x: cx2, y: cy2 } = curTile(c);
    const v = VEG[state.veg[idx(cx2, cy2)]];
    const covered = sheltered || (v && v.forest > 0.4);
    if (phase === 'day' && !covered) c.stress = Math.min(1, c.stress + 0.012 * stressMult);
    else if (phase === 'night') c.stress = Math.max(0, c.stress - 0.012);
  }
  if (c.stress > 0.85) c.health = Math.max(0.1, c.health - 0.004);
  else if (c.health < 1) c.health = Math.min(1, c.health + 0.002 * (0.6 + (c.genes?.resilience ?? 0.5) * 0.8));
  // low welfare alert (throttled via flag)
  if (c.welfare < 0.35 && !c._lowWelfareAlerted) {
    c._lowWelfareAlerted = true;
    const worst = [...habitat.factors].sort((a, b) => a.score - b.score)[0];
    pushAlert(state, { type: 'warning', title: 'LOW WELFARE', msg: `${c.name}: ${worst ? worst.cause : 'multiple unmet needs'}`, target: { kind: 'creature', id: c.id } });
  } else if (c.welfare > 0.5) c._lowWelfareAlerted = false;
}

// stress + special abilities drive containment pressure
export function fencePressure(state, c) {
  const sp = speciesById(c.speciesId);
  const tests = sp.specials?.includes('testsFences');
  const interferes = sp.specials?.includes('powerInterference');
  if (!tests && !interferes && c.stress < 0.55) return;
  if (rnd() > 0.3) return;
  const encData = computeEnclosures(state);
  const enc = encData.enclosures.find((e) => e.id === c.enclosureId);
  if (!enc) return;
  // find a boundary fence segment
  const keys = Object.keys(state.fences);
  const candidates = [];
  const tset = enc.tileSet || new Set(enc.tiles);
  for (const key of keys) {
    const [fx, fy] = key.split(',').map(Number);
    if (tset.has(idx(fx, fy))) candidates.push(key);
  }
  if (!candidates.length) return;
  const key = candidates[Math.floor(rnd() * candidates.length)];
  const f = state.fences[key];
  const fdef = FENCES[f.tier];
  const required = sp.containment.tier;
  let dmg = 0;
  if (tests) {
    dmg = f.tier < required ? 22 + sp.danger * 4 : 3;
    recordEvidence(state, sp.id, 'containment', f.tier < required ? 1.5 : 0.5);
    if (f.tier < required) logCause(state, c.name, `tested a Tier ${f.tier} barrier — it is not holding well`);
  } else if (interferes) {
    if (f.tier < 4) {
      dmg = 14;
      recordEvidence(state, sp.id, 'containment', 1.2);
      recordEvidence(state, sp.id, 'diet', 0.5);
      logCause(state, c.name, 'is draining charge from nearby barriers');
    }
  } else if (c.stress >= 0.55) {
    dmg = f.tier < required ? 16 + sp.danger * 3 : 4;
    if (f.tier < required) recordEvidence(state, sp.id, 'containment', 1);
  }
  if (dmg > 0) damageFence(state, key, dmg, `${c.name} is damaging a ${fdef.name} segment`);
}

// cohabitation evidence + hostility stress
export function cohabTick(state, c) {
  const sp = speciesById(c.speciesId);
  const others = state.creatures.filter((o) => o.id !== c.id && o.enclosureId === c.enclosureId && o.speciesId !== c.speciesId);
  const k = state.knowledge[c.speciesId];
  if (!k.compat) k.compat = {};
  for (const o of others) {
    const osp = speciesById(o.speciesId);
    const hostile = (sp.compat.hostile || []).includes(o.speciesId) || (osp.compat.hostile || []).includes(sp.id) || (osp.compat.prey || []).includes(sp.id) || (sp.compat.prey || []).includes(o.speciesId);
    const pairKey = o.speciesId;
    if (hostile) {
      c.stress = Math.min(1, c.stress + 0.03);
      if (k.compat[pairKey] !== 'hostile') {
        k.compat[pairKey] = 'hostile';
        const ok = state.knowledge[o.speciesId]; if (!ok.compat) ok.compat = {}; ok.compat[c.speciesId] = 'hostile';
        pushAlert(state, { type: 'warning', title: 'HOSTILITY CONFIRMED', msg: `${sp.name} and ${osp.name} cannot safely cohabit — stress and aggression rising.`, target: { kind: 'creature', id: c.id } });
      }
    } else {
      k.compatTicks = k.compatTicks || {};
      k.compatTicks[pairKey] = (k.compatTicks[pairKey] || 0) + 1;
      if (k.compatTicks[pairKey] >= 6 && k.compat[pairKey] !== 'compatible') {
        k.compat[pairKey] = 'compatible';
        const ok = state.knowledge[o.speciesId]; if (!ok.compat) ok.compat = {}; ok.compat[c.speciesId] = 'compatible';
        pushAlert(state, { type: 'breakthrough', title: 'COMPATIBILITY CONFIRMED', msg: `${sp.name} and ${osp.name} cohabit peacefully. Mixed exhibits are viable.`, target: { kind: 'creature', id: c.id } });
        if ((sp.compat.likes || []).includes(o.speciesId)) { /* positive pairing already rewarded via welfare */ }
      }
    }
  }
  // symbiosis discovery: partner present
  if (sp.compat.requires && others.some((o) => o.speciesId === sp.compat.requires)) {
    recordEvidence(state, sp.id, 'social', 1.5);
  }
}

export function recallCreature(state, id) {
  const c = state.creatures.find((q) => q.id === id);
  if (!c) return { ok: false, reason: 'Not found' };
  const pay = spend(state, 500, 'response', 'Recall team dispatch');
  if (!pay.ok) return pay;
  const enc = enclosureAt(state, c.homeTile.x, c.homeTile.y);
  c.x = c.homeTile.x + 0.5; c.y = c.homeTile.y + 0.5;
  c.path = []; c.state = 'idle'; c.escaped = !enc;
  c.stress = Math.min(1, c.stress + 0.1);
  pushAlert(state, { type: 'info', title: 'ASSET RECOVERED', msg: `${c.name} returned to its habitat by the recall team.`, target: { kind: 'creature', id } });
  return { ok: true };
}

// ---------- breeding: thriving compatible pairs produce offspring ----------
const GESTATION_TICKS = 1000;
const GROWTH_PER_CHECK = 0.085; // checks every ~200 ticks -> adult in ~1.3 cycles
const BREED_COOLDOWN = 3600;

export function breedingTick(state, c) {
  if (!hasResearch(state, 'bio_breeding')) return;
  const sp = speciesById(c.speciesId);

  // juveniles grow up
  if (c.juvenile) {
    c.growth = Math.min(1, (c.growth || 0) + GROWTH_PER_CHECK);
    if (c.growth >= 1) {
      c.juvenile = false;
      logCause(state, c.name, 'has reached maturity');
    }
    return;
  }

  if (c.breedCd > 0) c.breedCd = Math.max(0, c.breedCd - 200);

  // gestation countdown -> birth
  if (c.gestation > 0) {
    c.gestation -= 200;
    if (c.gestation <= 0) {
      c.gestation = 0;
      const { x, y } = curTile(c);
      const spot = adjacentOpenTile(state, x, y, sp.env.water.aquaticMin > 0) || { x, y };
      const mate = state.creatures.find((o) => o.id === c._mateId) || null;
      const genes = inheritGenes(state, c, mate);
      const baby = addCreature(state, c.speciesId, spot.x, spot.y, { juvenile: true, genes });
      baby.name = offspringName(state);
      c.breedCd = BREED_COOLDOWN;
      c._mateId = null;
      state.stats.births = (state.stats.births || 0) + 1;
      if (genes.morph) {
        state.stats.morphBirths = (state.stats.morphBirths || 0) + 1;
        pushAlert(state, {
          type: 'breakthrough', title: 'RARE MORPH BORN',
          msg: `${baby.name} — a ${sp.name} carrying an exceptionally rare genetic morph — has been born. Collectors and photographers will travel for this.`,
          target: { kind: 'creature', id: baby.id },
        });
      } else {
        pushAlert(state, {
          type: 'success', title: 'NEW OFFSPRING',
          msg: `${baby.name}, a Generation ${genes.gen} ${sp.name}, has been born to ${c.name}.`,
          target: { kind: 'creature', id: baby.id },
        });
      }
      if (genes.inbreed >= 0.25) {
        pushAlert(state, {
          type: 'warning', title: 'INBREEDING DETECTED',
          msg: `${baby.name}'s parents share close blood. Fertility and hardiness suffer — introduce new bloodlines.`,
          target: { kind: 'creature', id: baby.id },
        });
      }
      emitParkEvent(state, {
        type: 'birth', name: genes.morph ? 'Rare Morph Birth' : 'New Birth', x: spot.x, y: spot.y,
        radius: 12, magnitude: genes.morph ? 0.9 : 0.55, duration: 1200, subject: baby.id, speciesId: sp.id,
      });
      logCause(state, 'Husbandry', `${sp.name} offspring born (Gen ${genes.gen})`);
    }
    return;
  }

  // attempt pairing
  if (c.welfare < 0.72 || c.stress > 0.45 || c.escaped || !c.enclosureId) return;
  const kin = state.creatures.filter((o) =>
    o.id !== c.id && o.speciesId === c.speciesId && o.enclosureId === c.enclosureId &&
    !o.juvenile && !o.gestation && (o.breedCd || 0) <= 0 && o.welfare >= 0.72 && o.stress <= 0.45);
  if (!kin.length) return;
  // capacity: respect space and social group limits
  const encData = computeEnclosures(state);
  const enc = encData.enclosures.find((e) => e.id === c.enclosureId);
  if (!enc) return;
  const sameHere = state.creatures.filter((o) => o.speciesId === c.speciesId && o.enclosureId === c.enclosureId).length;
  const maxBySpace = Math.floor(enc.area / sp.env.spacePerHead);
  if (sameHere >= maxBySpace || sameHere >= sp.social.max) return;
  const partner = kin[0];
  // fertility genes govern pairing odds (inbreeding depression already baked into fertility)
  const fert = (((c.genes?.fertility ?? 0.5) + (partner.genes?.fertility ?? 0.5)) / 2);
  if (rnd() > 0.15 + fert * 0.4) return;
  c.gestation = GESTATION_TICKS;
  c._mateId = partner.id;
  partner.breedCd = BREED_COOLDOWN;
  emitParkEvent(state, {
    type: 'courtship', name: 'Courtship Display', x: c.x, y: c.y,
    radius: 9, magnitude: 0.4, duration: 700, subject: c.id, speciesId: sp.id,
  });
  logCause(state, c.name, `pair bonding observed with ${partner.name}`);
}

function adjacentOpenTile(state, x, y, swims) {
  const occ = buildOccupancy(state);
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const tx = x + dx, ty = y + dy;
    if (inMap(tx, ty) && !occ[idx(tx, ty)] && (state.water[idx(tx, ty)] !== 2 || swims)) return { x: tx, y: ty };
  }
  return null;
}

// ---------- anomalous abilities: camouflage, burrowing, electrical surges ----------
export function abilityTick(state, c) {
  const sp = speciesById(c.speciesId);
  if (!sp.ability) return;
  const phase = getDayPhase(state.tick).phase;

  if (sp.ability === 'camouflage') {
    const sheltered = ['sheltering', 'seekShelter'].includes(c.state);
    const shouldCloak = (phase === 'day' && !sheltered && rnd() < 0.65) || c.stress > 0.5;
    if (shouldCloak && !c.cloaked) {
      c.cloaked = true;
      if (!c._cloakSeen) {
        c._cloakSeen = true;
        pushAlert(state, {
          type: 'warning', title: 'CLOAKING OBSERVED',
          msg: `${c.name} has optically vanished. Guests cannot see it — research Thermal Optics to keep exhibits visible.`,
          target: { kind: 'creature', id: c.id },
        });
      }
      recordEvidence(state, sp.id, 'shelter', 0.8);
    } else if (!shouldCloak && c.cloaked) {
      c.cloaked = false;
    }
    return;
  }

  if (sp.ability === 'burrow') {
    if (c.escaped || c.juvenile || c.welfare >= 0.5 || rnd() > 0.22) return;
    if (hasResearch(state, 'cont_foundations')) {
      logCause(state, c.name, 'attempted to burrow out — subterranean foundations held');
      recordEvidence(state, sp.id, 'containment', 1);
      return;
    }
    // tunnel under the fence: relocate just outside the enclosure
    const encData = computeEnclosures(state);
    const enc = encData.enclosures.find((e) => e.id === c.enclosureId);
    if (!enc) return;
    const tset = enc.tileSet || new Set(enc.tiles);
    const occ = buildOccupancy(state);
    let out = null;
    for (const ti of enc.tiles) {
      const tx = ti % MAP_SIZE, ty = Math.floor(ti / MAP_SIZE);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = tx + dx, ny = ty + dy;
        if (inMap(nx, ny) && !tset.has(idx(nx, ny)) && !occ[idx(nx, ny)] && state.water[idx(nx, ny)] !== 2) {
          out = { x: nx, y: ny }; break;
        }
      }
      if (out) break;
    }
    if (!out) return;
    c.x = out.x + 0.5; c.y = out.y + 0.5;
    c.path = []; c.state = 'idle'; c.actionTicks = 0;
    state.stats.breaches = (state.stats.breaches || 0) + 1;
    recordEvidence(state, sp.id, 'containment', 2);
    pushAlert(state, {
      type: 'danger', title: 'BURROW BREACH',
      msg: `${c.name} dug UNDER the barrier — fences alone cannot hold it. Research Subterranean Foundations.`,
      target: { kind: 'creature', id: c.id },
    });
    logCause(state, c.name, 'burrowed under the perimeter');
    return;
  }

  if (sp.ability === 'surge') {
    if (c.stress <= 0.45 || rnd() > 0.4) return;
    c._surgeUntil = state.tick + 80;
    if (hasResearch(state, 'sec_surge')) {
      logCause(state, c.name, 'discharged a surge — dampeners absorbed it');
      return;
    }
    let hit = 0;
    for (const b of state.buildings) {
      if (b.type !== 'power') continue;
      const d = Math.hypot(b.x + b.w / 2 - c.x, b.y + b.h / 2 - c.y);
      if (d <= 12 && (!b.offlineUntil || state.tick >= b.offlineUntil)) {
        b.offlineUntil = state.tick + 500;
        hit++;
      }
    }
    if (hit) {
      recordEvidence(state, sp.id, 'diet', 1);
      pushAlert(state, {
        type: 'danger', title: 'POWER SURGE',
        msg: `${c.name} discharged — ${hit} Power Relay${hit > 1 ? 's' : ''} knocked offline. Electrified systems in the area are down.`,
        target: { kind: 'creature', id: c.id },
      });
      logCause(state, c.name, 'surged and blacked out nearby relays');
    }
  }
}
