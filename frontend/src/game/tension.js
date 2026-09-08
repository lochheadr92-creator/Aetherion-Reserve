// ---- Creature tension: aggression between residents + stress-driven containment breaches ----
// Deterministic (state rnd only). Builds on the existing creature stats (stress / health /
// needs), enclosure regions, fence hp, security posts and keeper radio. Needs degradation and
// death live in creatures.js (updateWelfare / killCreature); this module covers what happens
// BETWEEN organisms and between an organism and its barrier.
import { MAP_SIZE, FENCES } from './constants';
import { idx, inMap, rnd, pushAlert, logCause, emit } from './state';
import { speciesById } from './data/species';
import { computeEnclosures } from './enclosures';
import { buildOccupancy, edgeKey, walkableForCreature, findPath } from './pathfind';
import { destroyFence } from './construction';
import { recordEvidence } from './knowledge';
import { emitParkEvent } from './events';
import { killCreature } from './creatures';
import { radioEvent } from './staff';
import { tensionProfile, nearestPost, STRESS, RESPONSE_RADIUS } from './tensionProfile';

// ---------- tuning ----------
export const CONFLICT = {
  encCooldown: 300,       // ticks between incidents in one pen
  aggressorCooldown: 600, // ticks before the same organism starts another fight
  alertThrottle: 600,     // minor-conflict alert spacing per pen
  minorStress: { aggressor: 0.08, victim: 0.15 },
  seriousStress: { aggressor: 0.1, victim: 0.3 },
  seriousDamage: 0.22,    // + 0.1 * dangerFactor
};
export const BREACH = {
  baseChance: 0.04,       // per eligible 150-tick check, × (0.5 + danger*0.25) × degradation
  postDeterrent: 0.5,     // response post inside RESPONSE_RADIUS.breach halves the chance
};

const dangerFactor = (sp) => sp.danger / 5; // 0.2 … 1

// ---------- helpers ----------
const byEnclosure = (state) => {
  const groups = new Map();
  for (const c of state.creatures) {
    if (c.enclosureId == null || c.escaped || c._dead) continue;
    if (!groups.has(c.enclosureId)) groups.set(c.enclosureId, []);
    groups.get(c.enclosureId).push(c);
  }
  return groups;
};

const preys = (sp, osp) => (sp.compat.prey || []).includes(osp.id) || (osp.compat.preyOf || []).includes(sp.id);
const hostile = (sp, osp) => (sp.compat.hostile || []).includes(osp.id) || (osp.compat.hostile || []).includes(sp.id);

// what the sim learns from an incident (knowledge stays gated to real observation)
function confirmHostility(state, sp, osp) {
  const k = state.knowledge[sp.id]; if (k) { if (!k.compat) k.compat = {}; k.compat[osp.id] = 'hostile'; }
  const ok = state.knowledge[osp.id]; if (ok) { if (!ok.compat) ok.compat = {}; ok.compat[sp.id] = 'hostile'; }
  recordEvidence(state, sp.id, 'social', 0.6);
}

// Send the victim to the far side of the pen (temporary separation behaviour).
export function fleeWithin(state, victim, from, enc) {
  const sp = speciesById(victim.speciesId);
  const swims = sp.env.water.aquaticMin > 0;
  const occ = buildOccupancy(state);
  let best = null, bd = -1;
  const tiles = enc.tiles;
  const step = Math.max(1, Math.floor(tiles.length / 24));
  for (let i = 0; i < tiles.length; i += step) {
    const t = tiles[i];
    const x = t % MAP_SIZE, y = Math.floor(t / MAP_SIZE);
    if (occ[idx(x, y)] || !walkableForCreature(state, x, y, swims)) continue;
    const d = Math.hypot(x + 0.5 - from.x, y + 0.5 - from.y);
    if (d > bd) { bd = d; best = { x, y }; }
  }
  if (!best) return false;
  const p = findPath(state, Math.floor(victim.x), Math.floor(victim.y), best.x, best.y, { swims });
  if (!p) return false;
  victim.path = p; victim.state = 'flee'; victim.actionTicks = 0;
  return true;
}

// ---------- aggression ----------
// Ordered pair (a → b) trigger probability for one 90-tick pass, or 0.
export function aggressionChance(state, a, b, group) {
  if (a.juvenile || a._dead || b._dead) return 0;
  if (a._aggrCd && state.tick < a._aggrCd) return 0;
  const sp = speciesById(a.speciesId), osp = speciesById(b.speciesId);
  let p = 0, reason = null;
  if (sp.id !== osp.id) {
    if (preys(sp, osp)) { p = 0.35 * (0.6 + dangerFactor(sp)); reason = 'predation'; }
    else if (hostile(sp, osp)) { p = 0.18; reason = 'hostility'; }
    else if (sp.danger - osp.danger >= 3 && a.stress > 0.35) { p = 0.08; reason = 'dominance'; } // apex housed with small stock
  } else {
    const same = group.filter((c) => c.speciesId === sp.id).length;
    const excess = same - sp.social.max;
    if (excess > 0 && a.stress > 0.4 && b.stress > 0.4) { p = Math.min(0.3, 0.08 * excess); reason = 'overcrowding'; }
    else if (sp.tier >= 3 && !b.juvenile) { p = 0.02 * (a.stress > 0.5 || b.stress > 0.5 ? 2 : 1); reason = 'dominance'; }
  }
  // a predator always hunts; every other quarrel is damped by calm (0.4×) and fuelled by stress (1.4×)
  if (p > 0 && reason !== 'predation') p *= 0.4 + a.stress;
  // any organism this stressed lashes out regardless of the mix
  if (a.stress >= STRESS.aggressionAny) { const q = 0.10 * (0.5 + dangerFactor(sp)); if (q > p) { p = q; reason = reason || 'stress'; } }
  return p > 0 ? { p, reason } : 0;
}

function severity(state, a, b, reason) {
  const sp = speciesById(a.speciesId);
  const predation = reason === 'predation';
  let lethality = dangerFactor(sp) * (predation ? 1 : 0.45);
  if (b.health < 0.5) lethality *= 1.5;
  if (b.juvenile) lethality *= 1.4;
  const fatalAllowed = b.health < 0.75 || (predation && sp.danger >= 4);
  const r = rnd();
  if (fatalAllowed && r < 0.18 * lethality) return 'fatal';
  if (r < 0.18 * lethality + 0.42) return 'serious';
  return 'minor';
}

function conflictAlert(state, enc, kind, title, msg, target) {
  const key = `${kind}:${enc.id}`;
  const last = state.tension.alertAt[key] || -Infinity;
  if (kind === 'minor' && state.tick - last < CONFLICT.alertThrottle) return;
  state.tension.alertAt[key] = state.tick;
  pushAlert(state, { type: kind === 'minor' ? 'warning' : 'danger', title, msg, target });
}

export function resolveConflict(state, a, b, enc, reason) {
  const sp = speciesById(a.speciesId), osp = speciesById(b.speciesId);
  const sev = severity(state, a, b, reason);
  if (!state.stats.conflicts) state.stats.conflicts = { minor: 0, serious: 0, fatal: 0 };
  state.stats.conflicts[sev]++;
  state.tension.encCooldown[enc.id] = state.tick + CONFLICT.encCooldown;
  a._aggrCd = state.tick + CONFLICT.aggressorCooldown;
  if (sp.id !== osp.id && (reason === 'predation' || reason === 'hostility')) confirmHostility(state, sp, osp);
  const pen = `Pen #${enc.id}`;
  const cause = { predation: 'predator and prey share a pen', hostility: 'these species cannot cohabit', overcrowding: 'the group is overcrowded', dominance: 'a dominance dispute', stress: 'extreme stress' }[reason];
  a.stress = Math.min(1, a.stress + (sev === 'minor' ? CONFLICT.minorStress.aggressor : CONFLICT.seriousStress.aggressor));
  emitParkEvent(state, { type: 'conflict', name: `${sp.name} Aggression`, x: a.x, y: a.y, radius: 9, magnitude: sev === 'minor' ? 0.5 : 0.75, duration: 500, subject: a.id, speciesId: sp.id });
  radioEvent(state, enc.id, 'conflict', b);
  if (sev === 'fatal') {
    if (reason === 'predation') a.needs.hunger = 1; // it fed
    state.stats.fatalConflicts = (state.stats.fatalConflicts || 0) + 1;
    logCause(state, a.name, `killed ${b.name} (${cause})`);
    killCreature(state, b, cause, { by: a });
    return sev;
  }
  b.stress = Math.min(1, b.stress + (sev === 'minor' ? CONFLICT.minorStress.victim : CONFLICT.seriousStress.victim));
  fleeWithin(state, b, a, enc);
  if (sev === 'serious') {
    b.health = Math.max(0.02, b.health - (CONFLICT.seriousDamage + 0.1 * dangerFactor(sp)));
    b.injured = state.tick;
    b.distressed = true;
    state.tension.incidents.push({ id: state.nextId++, encId: enc.id, aggressorId: a.id, victimId: b.id, x: a.x, y: a.y, tick: state.tick });
    conflictAlert(state, enc, 'serious', 'SERIOUS CONFLICT',
      `${b.name} (${osp.name}) was injured by ${a.name} (${sp.name}) in ${pen} — ${cause}. Biomedical staff and a Rapid Response Post in range will intervene.`,
      { kind: 'creature', id: b.id });
    logCause(state, a.name, `injured ${b.name} (${cause})`);
  } else {
    conflictAlert(state, enc, 'minor', 'CONFLICT',
      `${a.name} (${sp.name}) went for ${b.name} (${osp.name}) in ${pen} — ${cause}. Stress is rising; separate them before it escalates.`,
      { kind: 'creature', id: a.id });
    logCause(state, a.name, `threatened ${b.name} (${cause})`);
  }
  return sev;
}

// Every 90 ticks: at most one incident park-wide, in the pen whose pair rolls first.
export function conflictTick(state) {
  if (!state.tension) state.tension = { incidents: [], encCooldown: {}, alertAt: {} };
  scrubGaps(state);
  state.tension.incidents = state.tension.incidents.filter((i) => state.tick - i.tick < 1500 && state.creatures.some((c) => c.id === i.victimId));
  const encData = computeEnclosures(state);
  for (const [encId, group] of byEnclosure(state)) {
    if (group.length < 2) continue;
    if ((state.tension.encCooldown[encId] || 0) > state.tick) continue;
    const enc = encData.enclosures.find((e) => e.id === encId);
    if (!enc) continue;
    for (const a of group) {
      for (const b of group) {
        if (a === b) continue;
        const t = aggressionChance(state, a, b, group);
        if (!t) continue;
        if (rnd() < t.p) { resolveConflict(state, a, b, enc, t.reason); return true; }
      }
    }
  }
  return false;
}

// ---------- breaches ----------
// Weakest boundary segment of the pen and how degraded the containment is for this species.
export function containmentWeakness(state, c, enc) {
  const sp = speciesById(c.speciesId);
  const tset = enc.tileSet || new Set(enc.tiles);
  let worst = null, worstScore = 0;
  for (const ti of enc.tiles) {
    const x = ti % MAP_SIZE, y = Math.floor(ti / MAP_SIZE);
    for (const [key, nx, ny] of [[edgeKey(x, y, 'E'), x + 1, y], [edgeKey(x, y, 'S'), x, y + 1], [edgeKey(x - 1, y, 'E'), x - 1, y], [edgeKey(x, y - 1, 'S'), x, y - 1]]) {
      const f = state.fences[key];
      if (!f || f.gate) continue;
      if (inMap(nx, ny) && tset.has(idx(nx, ny))) continue; // interior segment
      const hpRatio = f.hp / FENCES[f.tier].hp;
      const underTier = f.tier < sp.containment.tier ? 0.5 : 0;
      const score = (1 - hpRatio) + underTier;
      if (score > worstScore) { worstScore = score; worst = { key, x, y, nx, ny, hpRatio, underTier: underTier > 0, tier: f.tier }; }
    }
  }
  return worst ? { ...worst, score: worstScore } : null;
}

export function breachEligible(state, c, enc) {
  if (c.stress < STRESS.breach || c.escaped || c.juvenile || c.held) return null;
  const weak = containmentWeakness(state, c, enc);
  if (!weak) return null;
  const sp = speciesById(c.speciesId);
  // a D5 needs almost any damage; a D1 needs the segment half gone (or an under-spec barrier)
  const threshold = Math.min(0.95, 0.5 + 0.1 * (sp.danger - 1));
  return weak.hpRatio < threshold || weak.underTier ? weak : null;
}

// where the organism lands: the tile across the broken segment (or the nearest open tile beyond)
function tileOutside(state, weak, swims) {
  const occ = buildOccupancy(state);
  const ok = (x, y) => inMap(x, y) && !occ[idx(x, y)] && (swims || state.water[idx(x, y)] !== 2);
  if (ok(weak.nx, weak.ny)) return { x: weak.nx, y: weak.ny };
  for (let r = 1; r <= 3; r++) {
    for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) {
      if (ok(weak.nx + dx, weak.ny + dy)) return { x: weak.nx + dx, y: weak.ny + dy };
    }
  }
  return null;
}

export function performBreach(state, c, enc, weak) {
  const sp = speciesById(c.speciesId);
  const out = tileOutside(state, weak, sp.env.water.aquaticMin > 0);
  if (!out) return false;
  destroyFence(state, weak.key, c.name);
  c.x = out.x + 0.5; c.y = out.y + 0.5;
  c.path = []; c.state = 'idle'; c.actionTicks = 0;
  c.escaped = true;
  c.stress = Math.min(1, c.stress + 0.05);
  c._breachWarned = false;
  state.stats.breachEvents = (state.stats.breachEvents || 0) + 1;
  recordEvidence(state, sp.id, 'containment', 2);
  pushAlert(state, {
    type: 'danger', title: 'CONTAINMENT BREACH',
    msg: `${c.name} (${sp.name}, Danger ${sp.danger}) has broken out of Pen #${enc.id} at (${out.x}, ${out.y}) — the barrier segment is destroyed. ${sp.danger >= 3 ? 'DANGEROUS ASSET: guests are evacuating.' : 'Guests nearby are fleeing.'} Rebuild the segment and recover the animal.`,
    target: { kind: 'creature', id: c.id },
  });
  emit('breach', { id: c.id, x: out.x, y: out.y, danger: sp.danger }); // audio siren + screen shake hook
  radioEvent(state, enc.id, 'breach', c);
  logCause(state, c.name, `broke through a ${FENCES[weak.tier].name} segment and escaped Pen #${enc.id}`);
  return true;
}

// Every 150 ticks per organism (alongside fencePressure): warn early, then breach.
export function breachTick(state, c) {
  if (c._dead || c.escaped || c.enclosureId == null) return false;
  const encData = computeEnclosures(state);
  const enc = encData.enclosures.find((e) => e.id === c.enclosureId);
  if (!enc) return false;
  const weak = breachEligible(state, c, enc);
  if (!weak) { if (c.stress < 0.5) c._breachWarned = false; return false; }
  const sp = speciesById(c.speciesId);
  if (!c._breachWarned) {
    c._breachWarned = true;
    pushAlert(state, {
      type: 'warning', title: 'BREACH RISK',
      msg: `${c.name} (${sp.name}) is stressed and testing a ${weak.underTier ? 'barrier below its containment rating' : 'weakened barrier'} in Pen #${c.enclosureId} (${weak.x}, ${weak.y}). Repair or upgrade the segment and calm the animal before it breaks out.`,
      target: { kind: 'tile', x: weak.x, y: weak.y },
    });
    logCause(state, c.name, 'is testing a weakened barrier');
    return false; // the warning always comes first
  }
  const cx = enc.tiles.reduce((s, t) => s + (t % MAP_SIZE), 0) / enc.tiles.length;
  const cy = enc.tiles.reduce((s, t) => s + Math.floor(t / MAP_SIZE), 0) / enc.tiles.length;
  const covered = nearestPost(state, cx, cy).dist <= RESPONSE_RADIUS.breach;
  const { volatility } = tensionProfile(sp);
  let p = BREACH.baseChance * (0.5 + sp.danger * 0.25) * Math.min(1.5, weak.score + 0.25) * (volatility / 1.08);
  if (covered) p *= BREACH.postDeterrent;
  if (rnd() < p) return performBreach(state, c, enc, weak);
  return false;
}

// Gaps whose fence line has been demolished entirely are retired (nothing left to rebuild into).
export function scrubGaps(state) {
  if (!state.gaps) return;
  for (const key of Object.keys(state.gaps)) {
    if (state.fences[key]) { delete state.gaps[key]; continue; }
    const [xs, ys, d] = key.split(',');
    const x = Number(xs), y = Number(ys);
    const neighbours = d === 'E'
      ? [edgeKey(x, y - 1, 'E'), edgeKey(x, y + 1, 'E'), edgeKey(x, y, 'S'), edgeKey(x, y - 1, 'S'), edgeKey(x + 1, y, 'S'), edgeKey(x + 1, y - 1, 'S')]
      : [edgeKey(x - 1, y, 'S'), edgeKey(x + 1, y, 'S'), edgeKey(x, y, 'E'), edgeKey(x - 1, y, 'E'), edgeKey(x, y + 1, 'E'), edgeKey(x - 1, y + 1, 'E')];
    if (!neighbours.some((k) => state.fences[k])) delete state.gaps[key];
  }
}
