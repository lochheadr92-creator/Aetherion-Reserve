// ---- Expeditions: multi-step field operations with staged progress, events and claims ----
import { pushAlert, logCause, rnd } from './state';
import { spend, earn } from './economy';
import { EXPEDITION_ZONES, STAGES } from './data/expeditions';
import { speciesById } from './data/species';
import { recordEvidence } from './knowledge';

const MAX_ACTIVE = 2;

function log(exp, state, msg, type = 'info') {
  exp.log.unshift({ tick: state.tick, msg, type });
  if (exp.log.length > 14) exp.log.length = 14;
}

export function launchExpedition(state, zoneId) {
  const zone = EXPEDITION_ZONES[zoneId];
  if (!zone) return { ok: false, reason: 'Unknown survey zone' };
  const active = state.expeditions.filter((e) => e.status === 'active').length;
  if (active >= MAX_ACTIVE) return { ok: false, reason: `Only ${MAX_ACTIVE} expeditions can be in the field at once` };
  const pay = spend(state, zone.cost, 'acquisition', `Expedition: ${zone.name}`);
  if (!pay.ok) return pay;
  const exp = {
    id: state.nextId++, zoneId, launchedTick: state.tick, launchedDay: state.day,
    stage: 0, stageTicks: Math.round(zone.duration * STAGES[0].frac),
    status: 'active', log: [], specimens: [], cash: 0,
  };
  log(exp, state, `Convoy departed for ${zone.name} (${zone.code}).`);
  state.expeditions.push(exp);
  pushAlert(state, { type: 'info', title: 'EXPEDITION LAUNCHED', msg: `A field team is en route to ${zone.name}.`, target: null });
  return { ok: true, expedition: exp };
}

function rollSurveyEvents(state, exp, zone) {
  // evidence finds: field notes on a pool species' hidden biology
  const candidates = zone.speciesPool
    .map((sid) => speciesById(sid))
    .filter((sp) => sp.hiddenAttrs.some((a) => !state.knowledge[sp.id]?.discovered[a]));
  if (candidates.length && rnd() < 0.75) {
    const sp = candidates[Math.floor(rnd() * candidates.length)];
    const attr = sp.hiddenAttrs.find((a) => !state.knowledge[sp.id]?.discovered[a]);
    recordEvidence(state, sp.id, attr, 2.5);
    log(exp, state, `Field notes recovered: ${sp.name} ${attr} behaviour observed in the wild.`, 'evidence');
  }
  if (rnd() < zone.risk * 0.18) {
    const delay = Math.round(120 + rnd() * 240);
    exp.stageTicks += delay;
    const cost = Math.round(200 + rnd() * 400);
    spend(state, cost, 'response', 'Expedition mishap repairs');
    log(exp, state, `Mishap: equipment damaged in rough terrain — repairs ◈${cost}, progress delayed.`, 'mishap');
  }
}

function rollRecoveryEvents(state, exp, zone) {
  // guaranteed find + chance of a second
  const finds = 1 + (rnd() < zone.doubleFindChance ? 1 : 0);
  for (let i = 0; i < finds; i++) {
    const sid = zone.speciesPool[Math.floor(rnd() * zone.speciesPool.length)];
    exp.specimens.push({ id: state.nextId++, speciesId: sid, placed: false });
    const sp = speciesById(sid);
    log(exp, state, `Specimen secured: ${sp.name} (${sp.code}).`, 'find');
  }
  if (rnd() < zone.artifactChance) {
    const [lo, hi] = zone.artifact;
    exp.cash += Math.round(lo + rnd() * (hi - lo));
    log(exp, state, `Salvage recovered: pre-collapse artifacts worth ◈${exp.cash}.`, 'find');
  }
  if (zone.risk >= 3 && rnd() < 0.25) {
    const cost = Math.round(400 + rnd() * 600);
    spend(state, cost, 'response', 'Expedition medical evac');
    log(exp, state, `A crew member was injured during recovery — medical costs ◈${cost}.`, 'mishap');
  }
}

export function expeditionTick(state) {
  if (!state.expeditions || !state.expeditions.length) return;
  for (const exp of state.expeditions) {
    if (exp.status !== 'active') continue;
    const zone = EXPEDITION_ZONES[exp.zoneId];
    exp.stageTicks -= 10;
    if (exp.stageTicks > 0) continue;
    exp.stage++;
    if (exp.stage >= STAGES.length) {
      exp.status = 'returned';
      if (exp.cash > 0) earn(state, exp.cash, 'grants', `Expedition salvage: ${zone.name}`);
      const n = exp.specimens.length;
      pushAlert(state, {
        type: 'success', title: 'EXPEDITION RETURNED',
        msg: `The ${zone.name} team is back: ${n} specimen${n === 1 ? '' : 's'} secured${exp.cash ? ` + \u25C8${exp.cash} salvage` : ''}. Claim specimens in Field Ops.`,
        target: null,
      });
      log(exp, state, 'Convoy returned to the facility.');
      logCause(state, 'Expeditions', `${zone.name} returned with ${n} specimen(s)`);
      continue;
    }
    exp.stageTicks = Math.round(zone.duration * STAGES[exp.stage].frac);
    const stageKey = STAGES[exp.stage].key;
    if (stageKey === 'survey') { log(exp, state, `Survey of ${zone.name} underway.`); rollSurveyEvents(state, exp, zone); }
    else if (stageKey === 'recovery') { log(exp, state, 'Recovery teams deployed.'); rollRecoveryEvents(state, exp, zone); }
    else if (stageKey === 'return') log(exp, state, 'Assets crated. Convoy heading home.');
  }
  // auto-clear returned expeditions with nothing left to claim
  state.expeditions = state.expeditions.filter((e) => e.status === 'active' || e.specimens.some((sp) => !sp.placed));
}

export function markSpecimenPlaced(state, expeditionId, specimenId) {
  const exp = state.expeditions.find((e) => e.id === expeditionId);
  if (!exp) return;
  const spec = exp.specimens.find((s) => s.id === specimenId);
  if (spec) spec.placed = true;
}

export function expeditionProgress(exp) {
  const zone = EXPEDITION_ZONES[exp.zoneId];
  if (exp.status === 'returned') return { pct: 1, stageName: 'Returned' };
  const done = STAGES.slice(0, exp.stage).reduce((a, s) => a + s.frac, 0);
  const cur = STAGES[exp.stage];
  const curDone = cur ? cur.frac * (1 - exp.stageTicks / Math.max(1, zone.duration * cur.frac)) : 0;
  return { pct: Math.min(1, done + curDone), stageName: cur ? cur.name : 'Returned' };
}
