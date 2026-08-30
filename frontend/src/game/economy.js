// ---- Economy: spending, income, daily rollover, park value ----
import { logCause, emptyDay, pushAlert } from './state';
import { BUILDINGS } from './data/buildings';
import { FENCES } from './constants';
import { speciesById } from './data/species';
import { STAFF_ROLES } from './data/staffRoles';

export function spend(state, amount, cat, label) {
  amount = Math.round(amount);
  if (state.mode !== 'sandbox' && state.cash < amount && cat !== 'upkeep' && cat !== 'feed' && cat !== 'wages') {
    return { ok: false, reason: `Insufficient funds (need ◈${amount.toLocaleString()})` };
  }
  state.cash -= amount;
  const ex = state.finances.today.expenses;
  ex[cat] = (ex[cat] || 0) + amount;
  logCause(state, 'Finance', `-◈${amount} ${label}`);
  return { ok: true };
}

export function earn(state, amount, cat, label) {
  amount = Math.round(amount);
  state.cash += amount;
  const inc = state.finances.today.income;
  inc[cat] = (inc[cat] || 0) + amount;
  if (label) logCause(state, 'Finance', `+◈${amount} ${label}`);
}

export function dailyRollover(state) {
  // upkeep
  let upkeep = 0;
  for (const b of state.buildings) upkeep += (BUILDINGS[b.type]?.upkeep || 0);
  let fenceMaint = 0;
  for (const key of Object.keys(state.fences)) fenceMaint += FENCES[state.fences[key].tier].cost * 0.005;
  upkeep += Math.round(fenceMaint);
  if (upkeep > 0) spend(state, upkeep, 'upkeep', `Daily facility upkeep`);

  // staff payroll
  const wages = (state.staff || []).reduce((sum, st) => sum + (STAFF_ROLES[st.role]?.wage || 0), 0);
  if (wages > 0) spend(state, wages, 'wages', 'Staff wages');

  const t = state.finances.today;
  const incomeSum = Object.values(t.income).reduce((a, b) => a + b, 0);
  const expenseSum = Object.values(t.expenses).reduce((a, b) => a + b, 0);
  state.finances.history.push({ day: state.day, income: { ...t.income }, expenses: { ...t.expenses }, net: incomeSum - expenseSum });
  if (state.finances.history.length > 30) state.finances.history.shift();
  const h = state.finances.history;
  if (state.mode !== 'sandbox' && h.length >= 3 && h.slice(-3).every((d) => d.net < 0)) {
    pushAlert(state, { type: 'warning', title: 'FINANCIAL WARNING', msg: `The facility has run at a loss for 3 consecutive cycles. Review Finances.`, target: { kind: 'finances' } });
  }
  state.finances.today = emptyDay();
  state.day++;
}

export function parkValue(state) {
  let v = 0;
  for (const b of state.buildings) v += (BUILDINGS[b.type]?.cost || 0);
  for (const c of state.creatures) v += (speciesById(c.speciesId)?.cost || 0);
  for (const key of Object.keys(state.fences)) v += FENCES[state.fences[key].tier].cost;
  return Math.round(v + Math.max(0, state.cash));
}
