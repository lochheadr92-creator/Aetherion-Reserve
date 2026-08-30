// ---- Scenario engine: apply mission templates to fresh games + evaluate win/lose ----
import { FENCES } from './constants';
import { idx, inMap, pushAlert, logCause } from './state';
import { edgeKey } from './pathfind';
import { fenceRectEdges } from './construction';
import { addCreature } from './creatures';
import { SCENARIOS } from './data/scenarios';
import { BUILDINGS } from './data/buildings';
import { computeEnclosures } from './enclosures';

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
  for (let dy = 0; dy < def.h; dy++) for (let dx = 0; dx < def.w; dx++) {
    if (!inMap(x + dx, y + dy)) return null;
    state.veg[idx(x + dx, y + dy)] = 0;
  }
  const b = { id: state.nextId++, type: typeId, x, y, w: def.w, h: def.h, shelter: !!def.shelter, station: def.station || null };
  state.buildings.push(b);
  state._occDirty = true; state._encDirty = true; state._terrainDirty = true;
  return b;
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
  if (spec.feeder) placeStarterBuilding(state, spec.feeder, x0 + 1, y0 + 1);
  if (spec.shelter) placeStarterBuilding(state, 'shelter', x1 - 3, y0 + 1);
  state._encDirty = true;
  computeEnclosures(state);
}

export function applyScenario(state, scenarioId) {
  const def = SCENARIOS[scenarioId];
  if (!def) return state;
  const su = def.setup || {};
  if (typeof su.cash === 'number') state.cash = su.cash;
  if (su.research) {
    for (const r of su.research) {
      if (!state.research.completed.includes(r)) state.research.completed.push(r);
    }
  }
  if (su.policies) Object.assign(state.policies, su.policies);
  if (su.starterEnclosure) buildStarterEnclosure(state, su.starterEnclosure);
  if (su.creatures) {
    for (const c of su.creatures) addCreature(state, c.speciesId, c.x, c.y);
  }
  state.scenario = { id: scenarioId, status: 'active', startDay: state.day, progress: {}, ack: false };
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
    state.cash += def.reward;
    state.finances.today.income.grants += def.reward;
    pushAlert(state, {
      type: 'success', title: 'SCENARIO COMPLETE',
      msg: `${def.name} accomplished — +◈${def.reward.toLocaleString()} commendation grant. The reserve is yours to keep building.`,
    });
  }
}
