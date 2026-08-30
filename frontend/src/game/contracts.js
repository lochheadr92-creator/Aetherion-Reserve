// ---- Contracts: Oversight directives with serializable progress tracking ----
import { pushAlert, rnd } from './state';
import { earn } from './economy';
import { speciesById, SPECIES_LIST } from './data/species';

const MAX_ACTIVE = 3;
const REFRESH_EVERY_DAYS = 2;
const CONTRACT_LIFETIME = 6; // cycles once accepted

function pickWelfareSpecies(state) {
  const owned = [...new Set(state.creatures.map((c) => c.speciesId))];
  if (owned.length && rnd() < 0.7) return owned[Math.floor(rnd() * owned.length)];
  const commons = SPECIES_LIST.filter((sp) => sp.tier === 1);
  return commons[Math.floor(rnd() * commons.length)].id;
}

const GENERATORS = [
  (state) => {
    const sid = pickWelfareSpecies(state);
    const sp = speciesById(sid);
    const count = 2 + Math.floor(rnd() * 2);
    return {
      type: 'welfare', name: `Exhibit Standard: ${sp.name}`,
      desc: `House ${count} ${sp.name}${count > 1 ? 's' : ''} at 70%+ welfare simultaneously.`,
      reward: 3500 + count * 1500, params: { speciesId: sid, count },
    };
  },
  (state) => {
    const amount = 30 + Math.floor(rnd() * 4) * 10;
    return {
      type: 'guests', name: 'Public Confidence',
      desc: `Welcome ${amount} new guests to the facility.`,
      reward: 3000, params: { amount },
    };
  },
  (state) => {
    const amount = 1 + Math.floor(rnd() * 2);
    return {
      type: 'discovery', name: 'Field Science Mandate',
      desc: `Confirm ${amount} new piece${amount > 1 ? 's' : ''} of unknown biology.`,
      reward: 4000 + amount * 2000, params: { amount },
    };
  },
  (state) => {
    const target = Math.min(4.5, Math.round((state.rating.overall * 5 + 0.5) * 10) / 10);
    return {
      type: 'rating', name: 'Oversight Review',
      desc: `Raise the facility rating to ${target.toFixed(1)} stars.`,
      reward: 5000, params: { target: target / 5 },
    };
  },
  (state) => {
    const amount = 800 + Math.floor(rnd() * 5) * 200;
    return {
      type: 'tickets', name: 'Gate Revenue Drive',
      desc: `Earn \u25C8${amount.toLocaleString()} in entry tickets within a single cycle.`,
      reward: 3800, params: { amount, best: 0 },
    };
  },
];

function generateOne(state, excludeTypes) {
  for (let tries = 0; tries < 10; tries++) {
    const gen = GENERATORS[Math.floor(rnd() * GENERATORS.length)];
    const c = gen(state);
    if (!excludeTypes.has(c.type)) {
      excludeTypes.add(c.type);
      return { id: state.nextId++, ...c };
    }
  }
  return null;
}

export function refreshContracts(state) {
  const cs = state.contracts;
  const used = new Set([...cs.active.map((c) => c.type), ...cs.available.map((c) => c.type)]);
  while (cs.available.length < 3) {
    const c = generateOne(state, used);
    if (!c) break;
    cs.available.push(c);
  }
  cs.nextRefreshDay = state.day + REFRESH_EVERY_DAYS;
}

export function acceptContract(state, contractId) {
  const cs = state.contracts;
  if (cs.active.length >= MAX_ACTIVE) return { ok: false, reason: `Maximum ${MAX_ACTIVE} active directives` };
  const i = cs.available.findIndex((c) => c.id === contractId);
  if (i < 0) return { ok: false, reason: 'Directive no longer offered' };
  const c = cs.available.splice(i, 1)[0];
  c.acceptedDay = state.day;
  c.expiresDay = state.day + CONTRACT_LIFETIME;
  // baselines captured at accept time
  if (c.type === 'guests') c.params.baseline = state.stats.guestsTotal;
  if (c.type === 'discovery') c.params.baseline = state.stats.discoveries;
  if (c.type === 'tickets') c.params.best = 0;
  cs.active.push(c);
  pushAlert(state, { type: 'info', title: 'DIRECTIVE ACCEPTED', msg: `${c.name} — due by Cycle ${c.expiresDay}.`, target: null });
  return { ok: true };
}

export function declineContract(state, contractId) {
  const cs = state.contracts;
  cs.available = cs.available.filter((c) => c.id !== contractId);
  return { ok: true };
}

export function contractProgress(state, c) {
  switch (c.type) {
    case 'welfare': {
      const cur = state.creatures.filter((q) => q.speciesId === c.params.speciesId && q.welfare >= 0.7).length;
      return { cur, target: c.params.count, done: cur >= c.params.count, label: `${cur}/${c.params.count} at 70%+ welfare` };
    }
    case 'guests': {
      const cur = Math.max(0, state.stats.guestsTotal - (c.params.baseline ?? state.stats.guestsTotal));
      return { cur, target: c.params.amount, done: cur >= c.params.amount, label: `${cur}/${c.params.amount} guests` };
    }
    case 'discovery': {
      const cur = Math.max(0, state.stats.discoveries - (c.params.baseline ?? state.stats.discoveries));
      return { cur, target: c.params.amount, done: cur >= c.params.amount, label: `${cur}/${c.params.amount} discoveries` };
    }
    case 'rating': {
      const cur = state.rating.overall;
      return { cur, target: c.params.target, done: cur >= c.params.target, label: `${(cur * 5).toFixed(1)}/${(c.params.target * 5).toFixed(1)} stars` };
    }
    case 'tickets': {
      const cur = Math.max(c.params.best || 0, state.finances.today.income.tickets || 0);
      return { cur, target: c.params.amount, done: cur >= c.params.amount, label: `\u25C8${Math.round(cur).toLocaleString()}/\u25C8${c.params.amount.toLocaleString()} best cycle` };
    }
    default:
      return { cur: 0, target: 1, done: false, label: '' };
  }
}

export function contractTick(state) {
  const cs = state.contracts;
  if (!cs) return;
  if (state.day >= (cs.nextRefreshDay || 0)) {
    cs.available = [];
    refreshContracts(state);
  }
  const still = [];
  for (const c of cs.active) {
    if (c.type === 'tickets') c.params.best = Math.max(c.params.best || 0, state.finances.today.income.tickets || 0);
    const p = contractProgress(state, c);
    if (p.done) {
      earn(state, c.reward, 'grants', `Directive complete: ${c.name}`);
      cs.completed = (cs.completed || 0) + 1;
      pushAlert(state, { type: 'success', title: 'DIRECTIVE COMPLETE', msg: `${c.name} — +\u25C8${c.reward.toLocaleString()} Oversight grant.`, target: null });
      continue;
    }
    if (state.day > c.expiresDay) {
      pushAlert(state, { type: 'warning', title: 'DIRECTIVE EXPIRED', msg: `${c.name} lapsed without completion.`, target: null });
      continue;
    }
    still.push(c);
  }
  cs.active = still;
}
