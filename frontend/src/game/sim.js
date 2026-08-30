// ---- Sim orchestrator: fixed-timestep tick, research progress, objectives, rating, day cycle ----
import { TICKS_PER_DAY } from './constants';
import { idx, pushAlert, emit, hasResearch } from './state';
import { computeEnclosures, enclosureAt } from './enclosures';
import { tickCreatureMovement, decideCreature, onArrive, updateNeeds, updateWelfare, fencePressure, cohabTick } from './creatures';
import { spawnGuests, tickGuestMovement, decideGuest, guestNeedsTick, cullGuests } from './guests';
import { dailyRollover } from './economy';
import { RESEARCH } from './data/research';
import { refreshDynamicProjects, discover, EVIDENCE_THRESHOLD } from './knowledge';
import { speciesById, SPECIES_LIST } from './data/species';
import { spend } from './economy';
import { weatherTick, isStorm } from './weather';
import { damageFence } from './construction';
import { rnd } from './state';

export const OBJECTIVES = [
  { id: 'build_admin', name: 'Establish Command', desc: 'Build the Administration Nexus (Operations tab).', reward: 2000, check: (s) => s.buildings.some((b) => b.type === 'admin') },
  { id: 'build_paths', name: 'Lay Groundwork', desc: 'Place at least 12 path tiles from the entrance.', reward: 500, check: (s) => s.paths.reduce((a, b) => a + b, 0) >= 12 },
  { id: 'sculpt', name: 'Reshape the Land', desc: 'Sculpt terrain on 15+ tiles (raise, lower, flatten or smooth).', reward: 800, check: (s) => (s.stats.terrainEdits || 0) >= 15 },
  { id: 'water', name: 'Hydrology', desc: 'Create at least 5 tiles of water.', reward: 600, check: (s) => (s.stats.waterPlaced || 0) >= 5 },
  { id: 'enclosure', name: 'First Containment', desc: 'Fence an enclosure of 40+ tiles with an access gate.', reward: 1000, check: (s) => computeEnclosures(s).enclosures.some((e) => e.area >= 40 && e.gates >= 1) },
  { id: 'feeder', name: 'Provisioning', desc: 'Place a feeding station inside an enclosure.', reward: 500, check: (s) => computeEnclosures(s).enclosures.some((e) => Object.keys(e.feeders).length > 0) },
  { id: 'viewing', name: 'Public Access', desc: 'Build a Viewing Platform adjacent to a path.', reward: 800, check: (s) => s.buildings.some((b) => b.type === 'viewing' || b.type === 'tower') },
  { id: 'first_creature', name: 'First Resident', desc: 'Acquire a creature via Field Operations and release it into an enclosure.', reward: 1500, check: (s) => s.creatures.length >= 1 },
  { id: 'discovery', name: 'Learn Something True', desc: 'Confirm one piece of unknown biology through observation.', reward: 2000, check: (s) => s.stats.discoveries >= 1 },
  { id: 'guests20', name: 'Open the Gates', desc: 'Welcome 20 total guests.', reward: 1500, check: (s) => s.stats.guestsTotal >= 20 },
  { id: 'research1', name: 'Scientific Method', desc: 'Complete a research project (requires a Research Laboratory).', reward: 1200, check: (s) => (s.stats.researchCompleted || 0) >= 1 },
  { id: 'two_species', name: 'Shared World', desc: 'House two different species together, both above 60% welfare.', reward: 2500, check: (s) => {
    const byEnc = {};
    for (const c of s.creatures) {
      if (!c.enclosureId) continue;
      byEnc[c.enclosureId] = byEnc[c.enclosureId] || new Map();
      const m = byEnc[c.enclosureId];
      m.set(c.speciesId, Math.max(m.get(c.speciesId) || 0, c.welfare));
    }
    return Object.values(byEnc).some((m) => [...m.values()].filter((w) => w > 0.6).length >= 2 && m.size >= 2);
  } },
];

export function initObjectives(state) {
  if (!state.objectives.length) state.objectives = OBJECTIVES.map((o) => ({ id: o.id, done: false }));
}

function checkObjectives(state) {
  initObjectives(state);
  for (const os of state.objectives) {
    if (os.done) continue;
    const def = OBJECTIVES.find((o) => o.id === os.id);
    if (def && def.check(state)) {
      os.done = true;
      state.cash += def.reward;
      state.finances.today.income.grants += def.reward;
      pushAlert(state, { type: 'success', title: 'OBJECTIVE COMPLETE', msg: `${def.name} — +◈${def.reward.toLocaleString()} operations grant`, target: { kind: 'objectives' } });
    }
  }
}

// ---------- research ----------
export function startResearch(state, projectId) {
  if (state.research.active) return { ok: false, reason: 'A project is already active' };
  if (!state.buildings.some((b) => b.type === 'lab')) return { ok: false, reason: 'Requires a Research Laboratory' };
  const dyn = state.research.dynamicProjects.find((p) => p.id === projectId);
  const def = dyn || RESEARCH[projectId];
  if (!def) return { ok: false, reason: 'Unknown project' };
  if (!dyn) {
    if (state.research.completed.includes(projectId)) return { ok: false, reason: 'Already completed' };
    if (def.requires && !def.requires.every((r) => state.research.completed.includes(r))) return { ok: false, reason: 'Prerequisite research missing' };
    if (def.requiresEvidence) {
      const k = state.knowledge[def.requiresEvidence.speciesId];
      const hasEvidence = k && (Object.keys(k.evidence).length > 0 || Object.keys(k.discovered).length > 0);
      if (!hasEvidence) return { ok: false, reason: def.requiresEvidence.note };
    }
  }
  const pay = spend(state, def.cost, 'research', `Research: ${def.name}`);
  if (!pay.ok) return pay;
  state.research.active = { id: projectId, progress: 0, total: def.time * 10, dynamic: !!dyn };
  return { ok: true };
}

function researchTick(state) {
  const a = state.research.active;
  if (!a) return;
  const labs = state.buildings.filter((b) => b.type === 'lab').length;
  if (!labs) return;
  a.progress += 1 + (labs - 1) * 0.4;
  if (a.progress >= a.total) {
    state.research.active = null;
    state.stats.researchCompleted = (state.stats.researchCompleted || 0) + 1;
    if (a.dynamic) {
      const p = state.research.dynamicProjects.find((x) => x.id === a.id);
      if (p) discover(state, p.speciesId, p.attr, true);
      state.research.dynamicProjects = state.research.dynamicProjects.filter((x) => x.id !== a.id);
    } else {
      state.research.completed.push(a.id);
      const def = RESEARCH[a.id];
      pushAlert(state, { type: 'success', title: 'RESEARCH COMPLETE', msg: `${def.name} — ${def.desc}`, target: { kind: 'research' } });
      if (def.effect?.revealOnComplete) {
        const owned = [...new Set(state.creatures.map((c) => c.speciesId))];
        for (const sid of owned) {
          const sp = speciesById(sid);
          const k = state.knowledge[sid];
          const next = sp.hiddenAttrs.find((at) => !k.discovered[at]);
          if (next) discover(state, sid, next, true);
        }
      }
    }
    emit('researchDone', {});
  }
}

// ---------- park rating ----------
function computeRating(state) {
  const speciesSet = new Set(state.creatures.map((c) => c.speciesId));
  const diversity = Math.min(1, speciesSet.size / 8);
  const welfare = state.creatures.length ? state.creatures.reduce((s, c) => s + c.welfare, 0) / state.creatures.length : 0.5;
  const guestSat = state.stats.guestSat;
  const discoveries = Math.min(1, state.stats.discoveries / 12);
  const rarity = Math.min(1, state.creatures.reduce((s, c) => s + speciesById(c.speciesId).tier, 0) / 20);
  const safety = Math.max(0, 1 - state.creatures.filter((c) => c.escaped).length * 0.4 - Math.min(0.4, state.stats.breaches * 0.05));
  const comp = { diversity, welfare, guestSat, discoveries, rarity, safety };
  const overall = diversity * 0.18 + welfare * 0.22 + guestSat * 0.2 + discoveries * 0.15 + rarity * 0.1 + safety * 0.15;
  state.rating = { overall, comp };
}

// ---------- main tick ----------
export function tickOnce(state) {
  state.tick++;
  const T = state.tick;

  // enclosure cache refresh when dirty
  if (state._encDirty && T % 5 === 0) computeEnclosures(state);

  // creatures
  for (const c of state.creatures) {
    tickCreatureMovement(state, c);
    if (!c.path.length && c.actionTicks <= 0 && (c.state.startsWith('seek'))) onArrive(state, c);
    if (c.actionTicks > 0) c.actionTicks--;
    if (T % 20 === c.id % 20) {
      updateNeeds(state, c);
      if (!c.path.length && c.actionTicks <= 0) decideCreature(state, c);
    }
    if (T % 40 === c.id % 40) updateWelfare(state, c);
    if (T % 150 === c.id % 150) fencePressure(state, c);
    if (T % 100 === c.id % 100) cohabTick(state, c);
  }

  // guests
  for (const g of state.guests) {
    tickGuestMovement(state, g);
    if (T % 20 === g.id % 20) {
      guestNeedsTick(state, g);
      decideGuest(state, g);
    }
  }
  if (T % 25 === 0) { spawnGuests(state); cullGuests(state); }

  // weather & day-night
  if (T % 25 === 0) weatherTick(state);
  if (isStorm(state) && T % 200 === 0 && rnd() < 0.5) {
    const keys = Object.keys(state.fences);
    if (keys.length) {
      const key = keys[Math.floor(rnd() * keys.length)];
      damageFence(state, key, 8 + rnd() * 12, 'Storm winds are battering a barrier segment');
    }
  }

  // research
  if (T % 10 === 0) researchTick(state);
  if (T % 60 === 0) refreshDynamicProjects(state);

  // objectives + rating
  if (T % 50 === 0) checkObjectives(state);
  if (T % 100 === 0) computeRating(state);

  // day cycle
  if (T % TICKS_PER_DAY === 0) dailyRollover(state);
}
