// ---- Scenario engine: apply mission templates to fresh games + evaluate win/lose ----
import { FENCES } from './constants';
import { idx, inMap, pushAlert, logCause } from './state';
import { edgeKey } from './pathfind';
import { fenceRectEdges } from './construction';
import { addCreature } from './creatures';
import { hireStaff, assignStaffEnclosure } from './staff';
import { SCENARIOS } from './data/scenarios';
import { BUILDINGS } from './data/buildings';
import { computeEnclosures, enclosureAt } from './enclosures';

// flatten + clear a rectangular region so the starter exhibit is buildable/deterministic
function prepareGround(state, x0, y0, x1, y1) {
  for (let y = y0 - 1; y <= y1 + 1; y++) for (let x = x0 - 1; x <= x1 + 1; x++) {
    if (!inMap(x, y)) continue;
    const i = idx(x, y);
    state.heights[i] = 1;
    state.water[i] = 0;
    if (state.materials[i] === 4 || state.materials[i] === 6) state.materials[i] = 0;
  }
}

function placeStarterBuilding(state, typeId, x, y) {
  const def = BUILDINGS[typeId];
  if (!def) return null;
  prepareGround(state, x, y, x + def.w - 1, y + def.h - 1);
  for (let dy = 0; dy < def.h; dy++) for (let dx = 0; dx < def.w; dx++) {
    if (!inMap(x + dx, y + dy)) return null;
    state.veg[idx(x + dx, y + dy)] = 0;
  }
  const b = { id: state.nextId++, type: typeId, x, y, w: def.w, h: def.h, shelter: !!def.shelter, station: def.station || null };
  state.buildings.push(b);
  state._occDirty = true; state._encDirty = true; state._terrainDirty = true;
  return b;
}

// deterministic pre-damage for crisis scenarios: downgrade every Nth segment
// to a cheap patch tier and weaken every Mth to a fraction of its max HP
function applyFenceDamage(state, edges, spec, gateKey) {
  const { patchTier = 1, patchEvery = 0, weakenEvery = 0, weakenTo = 0.2 } = spec;
  let i = 0;
  for (const e of edges) {
    i++;
    const key = edgeKey(e.x, e.y, e.d);
    const f = state.fences[key];
    if (!f || key === gateKey || f.gate) continue;
    if (patchEvery && i % patchEvery === 0) {
      f.tier = patchTier;
      f.hp = Math.round(FENCES[patchTier].hp * 0.5);
    } else if (weakenEvery && i % weakenEvery === 0) {
      f.hp = Math.max(8, Math.round(FENCES[f.tier].hp * weakenTo));
    }
  }
}

function buildStarterEnclosure(state, spec) {
  const { x0, y0, x1, y1, tier = 1 } = spec;
  prepareGround(state, x0, y0, x1, y1);
  const edges = fenceRectEdges({ vx: x0, vy: y0 }, { vx: x1, vy: y1 });
  const def = FENCES[tier];
  for (const e of edges) {
    state.fences[edgeKey(e.x, e.y, e.d)] = { tier, hp: def.hp, gate: false };
  }
  // access gate at the middle of the south wall
  const gx = Math.floor((x0 + x1) / 2);
  const gateKey = edgeKey(gx, y1 - 1, 'S');
  if (state.fences[gateKey]) state.fences[gateKey].gate = true;
  if (spec.damage) applyFenceDamage(state, edges, spec.damage, gateKey);
  if (spec.feeder) placeStarterBuilding(state, spec.feeder, x0 + 1, y0 + 1);
  if (spec.shelter) placeStarterBuilding(state, 'shelter', x1 - 3, y0 + 1);
  state._encDirty = true;
  computeEnclosures(state);
}

// briefing knowledge: attributes the Board already documented for this mission
function applyDiscovered(state, discovered) {
  for (const [sid, attrs] of Object.entries(discovered)) {
    const k = state.knowledge[sid];
    if (!k) continue;
    for (const attr of attrs) k.discovered[attr] = true;
  }
}

// starting personnel; `assign: 'starter'` binds them to the starter enclosure
function applyStarterStaff(state, specs, starter) {
  for (const spec of specs) {
    const res = hireStaff(state, spec.role);
    if (!res.ok || spec.assign !== 'starter' || !starter) continue;
    const cx = Math.floor((starter.x0 + starter.x1) / 2), cy = Math.floor((starter.y0 + starter.y1) / 2);
    const enc = enclosureAt(state, cx, cy);
    if (enc) assignStaffEnclosure(state, res.staff.id, enc.id);
  }
}

export function applyScenario(state, scenarioId) {
  const def = SCENARIOS[scenarioId];
  if (!def) return state;
  const su = def.setup || {};
  if (su.research) {
    for (const r of su.research) {
      if (!state.research.completed.includes(r)) state.research.completed.push(r);
    }
  }
  if (su.discovered) applyDiscovered(state, su.discovered);
  if (su.policies) Object.assign(state.policies, su.policies);
  if (su.starterEnclosure) buildStarterEnclosure(state, su.starterEnclosure);
  if (su.buildings) {
    for (const b of su.buildings) placeStarterBuilding(state, b.type, b.x, b.y);
  }
  if (su.creatures) {
    for (const c of su.creatures) addCreature(state, c.speciesId, c.x, c.y);
  }
  if (su.staff) applyStarterStaff(state, su.staff, su.starterEnclosure || null);
  // mission budget is authoritative: applied last so starter hires never dent it
  if (typeof su.cash === 'number') state.cash = su.cash;
  state.scenario = {
    id: scenarioId, status: 'active', startDay: state.day, progress: {}, ack: false,
    escapeTicks: 0, minCash: state.cash, mastery: null,
  };
  logCause(state, 'Command', `Scenario briefing accepted: ${def.name}`);
  return state;
}

// controlled mutator: player acknowledged the end-of-mission dialog
export function ackScenario(state) {
  if (state.scenario) state.scenario.ack = true;
}

export function scenarioTick(state) {
  const sc = state.scenario;
  if (!sc || sc.status !== 'active') return;
  const def = SCENARIOS[sc.id];
  if (!def) return;
  // rolling trackers (used by fail conditions and mastery grading)
  // called every 100 ticks — accumulate cumulative time-at-large
  if (state.creatures.some((c) => c.escaped)) sc.escapeTicks = (sc.escapeTicks || 0) + 100;
  sc.minCash = Math.min(sc.minCash ?? state.cash, state.cash);
  // fail conditions first — any one ends the mission
  for (const f of def.fails) {
    if (f.check(state)) {
      sc.status = 'lost';
      sc.failedBy = f.id;
      pushAlert(state, {
        type: 'danger', title: 'SCENARIO FAILED',
        msg: `${def.name} — ${f.label}. The Board has suspended the operation. You may continue in freeplay.`,
      });
      return;
    }
  }
  // goals: record progress; all done => victory
  let allDone = true;
  for (const g of def.goals) {
    const done = !!g.check(state);
    sc.progress[g.id] = done;
    if (!done) allDone = false;
  }
  if (allDone) {
    sc.status = 'won';
    // grade optional mastery objectives at the moment of victory
    if (def.mastery) {
      sc.mastery = {};
      for (const m of def.mastery) sc.mastery[m.id] = !!m.check(state);
    }
    state.cash += def.reward;
    state.finances.today.income.grants += def.reward;
    pushAlert(state, {
      type: 'success', title: 'SCENARIO COMPLETE',
      msg: `${def.name} accomplished — +◈${def.reward.toLocaleString()} commendation grant. The reserve is yours to keep building.`,
    });
  }
}
