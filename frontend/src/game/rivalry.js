// ---- Rival Rumbles: apex territorial interactions across shared fence lines ----
// Apex predators (danger >= 4) housed in NEIGHBOURING enclosures detect each other
// across the shared boundary, stalk it, perform threat displays and can escalate
// to charging the barrier. Rivalries are dramatic guest magnets but damage fences,
// raise stress and risk injuries. Players design around it with reinforced shared
// barriers, vegetation blockers, spacing (double fencing) and warden patrols.
import { MAP_SIZE, VEG, FENCES } from './constants';
import { idx, rnd, pushAlert, logCause } from './state';
import { speciesById } from './data/species';
import { computeEnclosures } from './enclosures';
import { findPath } from './pathfind';
import { damageFence } from './construction';
import { emitParkEvent } from './events';

const APPROACH_TIMEOUT = 420;
const DISPLAY_TICKS = 6; // rivalry ticks (each ~45 sim ticks)
const CLASH_TICKS = 3;

// find shared fence boundaries between two different enclosures.
// returns [{a: encId, b: encId, ax, ay, bx, by, key}]
function sharedBoundaries(state, encData) {
  const owner = new Map();
  for (const e of encData.enclosures) {
    const tiles = e.tiles || [];
    for (const t of tiles) owner.set(t, e.id);
  }
  const out = [];
  for (const [t, encId] of owner) {
    const x = t % MAP_SIZE, y = Math.floor(t / MAP_SIZE);
    // east edge
    const eKey = `${x},${y},E`;
    if (state.fences[eKey]) {
      const nb = owner.get(idx(x + 1, y));
      if (nb && nb !== encId) out.push({ a: encId, b: nb, ax: x, ay: y, bx: x + 1, by: y, key: eKey });
    }
    // south edge
    const sKey = `${x},${y},S`;
    if (state.fences[sKey]) {
      const nb = owner.get(idx(x, y + 1));
      if (nb && nb !== encId) out.push({ a: encId, b: nb, ax: x, ay: y, bx: x, by: y + 1, key: sKey });
    }
  }
  return out;
}

// vegetation blockers along the boundary break line of sight (player mitigation)
function lineOfSight(state, ax, ay, bx, by) {
  let cover = 0;
  for (const [x, y] of [[ax, ay], [bx, by]]) {
    const v = VEG[state.veg[idx(x, y)]];
    if (v) cover += v.cover;
  }
  return cover < 0.7;
}

function wardenNear(state, x, y, r = 9) {
  return (state.staff || []).some((st) => st.role === 'warden' && Math.hypot(st.x - x, st.y - y) <= r);
}

function apexCandidates(state) {
  return state.creatures.filter((c) => {
    if (c.juvenile || c.escaped || !c.enclosureId) return false;
    const sp = speciesById(c.speciesId);
    return sp.danger >= 4;
  });
}

function startRivalry(state, a, b, boundary) {
  const swimsA = speciesById(a.speciesId).env.water.aquaticMin > 0;
  const swimsB = speciesById(b.speciesId).env.water.aquaticMin > 0;
  const pA = findPath(state, Math.floor(a.x), Math.floor(a.y), boundary.ax, boundary.ay, { swims: swimsA, maxNodes: 1500 });
  const pB = findPath(state, Math.floor(b.x), Math.floor(b.y), boundary.bx, boundary.by, { swims: swimsB, maxNodes: 1500 });
  if (!pA || !pB) return false;
  a.path = pA; a.state = 'rivalApproach'; a.actionTicks = 0;
  b.path = pB; b.state = 'rivalApproach'; b.actionTicks = 0;
  state.rivalries.push({
    id: state.nextId++, aId: a.id, bId: b.id, phase: 'approach', ticks: 0,
    spot: { ax: boundary.ax, ay: boundary.ay, bx: boundary.bx, by: boundary.by },
    keys: [boundary.key], mag: 0.7,
  });
  logCause(state, speciesById(a.speciesId).name, `has spotted a rival across the boundary line`);
  return true;
}

function resolveRivalry(state, rv, a, b, aborted) {
  for (const c of [a, b]) {
    if (!c) continue;
    if (c.state && c.state.startsWith('rival')) { c.state = 'idle'; c.actionTicks = 20; c.path = []; }
    c._rivalCd = state.tick + 3500;
  }
  if (a && b && !aborted) {
    // dominance contest: mass + boldness (+ genetics) decides who backs off
    const power = (c) => (c.genes?.size || 1) * (0.5 + (c.genes?.bold ?? 0.5)) * (0.7 + (c.genes?.agg ?? 0.5) * 0.6) + rnd() * 0.4;
    const winner = power(a) >= power(b) ? a : b;
    const loser = winner === a ? b : a;
    winner.stress = Math.max(0, winner.stress - 0.06);
    winner._rivalWins = (winner._rivalWins || 0) + 1;
    loser.stress = Math.min(1, loser.stress + 0.1);
    logCause(state, winner.name, `won the dominance contest — ${loser.name} retreated`);
  }
  state.rivalries = state.rivalries.filter((r) => r.id !== rv.id);
}

function progressRivalry(state, rv) {
  const a = state.creatures.find((c) => c.id === rv.aId);
  const b = state.creatures.find((c) => c.id === rv.bId);
  if (!a || !b || a.escaped || b.escaped) { resolveRivalry(state, rv, a, b, true); return; }
  rv.ticks++;
  const midX = (rv.spot.ax + rv.spot.bx) / 2, midY = (rv.spot.ay + rv.spot.by) / 2;

  if (rv.phase === 'approach') {
    const aThere = Math.hypot(a.x - rv.spot.ax - 0.5, a.y - rv.spot.ay - 0.5) < 2.2 && !a.path.length;
    const bThere = Math.hypot(b.x - rv.spot.bx - 0.5, b.y - rv.spot.by - 0.5) < 2.2 && !b.path.length;
    if (aThere && bThere) {
      rv.phase = 'display'; rv.ticks = 0;
      a.state = 'rivalDisplay'; b.state = 'rivalDisplay';
      const spA = speciesById(a.speciesId), spB = speciesById(b.speciesId);
      rv.mag = 0.65 + Math.max(spA.danger, spB.danger) * 0.06;
      emitParkEvent(state, {
        type: 'rivalry', name: `${spA.name} vs ${spB.name}`, x: midX, y: midY,
        radius: 13, magnitude: rv.mag, duration: 1400, subject: a.id, speciesId: a.speciesId,
      });
      pushAlert(state, {
        type: 'warning', title: 'RIVAL RUMBLE',
        msg: `${a.name} and ${b.name} are facing off at the boundary. Guests are flocking — but the shared barrier is under threat.`,
        target: { kind: 'creature', id: a.id },
      });
    } else if (rv.ticks * 45 > APPROACH_TIMEOUT || (!a.path.length && !aThere) || (!b.path.length && !bThere)) {
      resolveRivalry(state, rv, a, b, true);
    }
    return;
  }

  // display + clash phases keep both locked at the line
  a.actionTicks = 60; b.actionTicks = 60;
  a.dir = rv.spot.bx >= rv.spot.ax ? 1 : -1;
  b.dir = -a.dir;
  a.stress = Math.min(1, a.stress + 0.015);
  b.stress = Math.min(1, b.stress + 0.015);

  if (rv.phase === 'display') {
    if (rv.ticks >= DISPLAY_TICKS) {
      // escalate? aggression drives a barrier charge; wardens deter it
      const aggAvg = ((a.genes?.agg ?? 0.5) + (b.genes?.agg ?? 0.5)) / 2;
      let pClash = 0.25 + aggAvg * 0.45;
      if (wardenNear(state, midX, midY)) pClash *= 0.35;
      if (rnd() < pClash) {
        rv.phase = 'clash'; rv.ticks = 0;
        a.state = 'rivalClash'; b.state = 'rivalClash';
        emitParkEvent(state, {
          type: 'rivalry', name: 'Barrier Clash', x: midX, y: midY,
          radius: 13, magnitude: Math.min(1, rv.mag + 0.2), duration: 900, subject: a.id, speciesId: a.speciesId,
        });
      } else {
        resolveRivalry(state, rv, a, b, false);
      }
    }
    return;
  }

  if (rv.phase === 'clash') {
    // both slam the shared barrier: tier-scaled damage + injury risk
    for (const key of rv.keys) {
      const f = state.fences[key];
      if (!f) continue;
      const need = Math.max(speciesById(a.speciesId).containment.tier, speciesById(b.speciesId).containment.tier);
      const dmg = f.tier >= need ? 5 : 16 + Math.max(0, need - f.tier) * 8;
      damageFence(state, key, dmg, `${a.name} and ${b.name} are slamming the shared ${FENCES[f.tier].name}`);
    }
    for (const c of [a, b]) {
      if (rnd() < 0.15) {
        c.health = Math.max(0.15, c.health - 0.08);
        state.stats.rivalInjuries = (state.stats.rivalInjuries || 0) + 1;
        pushAlert(state, {
          type: 'warning', title: 'RIVALRY INJURY',
          msg: `${c.name} was injured clashing at the boundary. A Biomedical Officer should treat it.`,
          target: { kind: 'creature', id: c.id },
        });
      }
    }
    state.stats.rivalClashes = (state.stats.rivalClashes || 0) + 1;
    if (rv.ticks >= CLASH_TICKS) resolveRivalry(state, rv, a, b, false);
  }
}

export function rivalryTick(state) {
  if (!state.rivalries) state.rivalries = [];
  // progress active rivalries
  for (const rv of [...state.rivalries]) progressRivalry(state, rv);
  if (state.rivalries.length >= 2) return;

  // detect new rivalries between apexes in adjacent enclosures
  const apexes = apexCandidates(state).filter((c) =>
    (!c._rivalCd || state.tick > c._rivalCd) &&
    !state.rivalries.some((r) => r.aId === c.id || r.bId === c.id));
  if (apexes.length < 2) return;
  const encData = computeEnclosures(state);
  const bounds = sharedBoundaries(state, encData);
  if (!bounds.length) return;

  const byEnc = {};
  for (const c of apexes) (byEnc[c.enclosureId] = byEnc[c.enclosureId] || []).push(c);

  for (const bd of bounds) {
    const as = byEnc[bd.a], bs = byEnc[bd.b];
    if (!as || !bs) continue;
    const a = as[0], b = bs[0];
    if (a.id === b.id) continue;
    const spA = speciesById(a.speciesId), spB = speciesById(b.speciesId);
    // trigger score: temperament + condition + species hostility + territorial nature
    let score = 0.15 + (a.genes?.agg ?? 0.5) * 0.3 + (b.genes?.agg ?? 0.5) * 0.15;
    score += (a.stress + b.stress) * 0.1;
    score += (1 - Math.min(a.needs.hunger, b.needs.hunger)) * 0.12;
    if ((spA.compat.hostile || []).includes(spB.id) || (spB.compat.hostile || []).includes(spA.id)) score += 0.25;
    if (spA.social.type.includes('Territorial') || spB.social.type.includes('Territorial')) score += 0.12;
    if (!lineOfSight(state, bd.ax, bd.ay, bd.bx, bd.by)) continue; // blockers work
    if (rnd() < score * 0.45) {
      if (startRivalry(state, a, b, bd)) return; // one new rivalry per tick
    }
  }
}
