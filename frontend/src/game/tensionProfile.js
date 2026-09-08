// ---- Creature tension: shared thresholds + species volatility (pure helpers, no sim imports) ----
// Used by creatures.js (needs degradation → stress → health), tension.js (aggression, breaches),
// staff.js (keeper relevance) and the UI panels, so every consumer reads the same numbers.

// How fast neglect turns into danger for a species. Danger rating drives it, tier nudges it:
// a T1 common grazer (D1) sits at ~0.65×, a T4 apex predator (D5) at ~1.6×.
export function tensionProfile(sp) {
  const volatility = 0.6 + sp.danger * 0.16;      // D1 0.76 … D5 1.40
  const tierFactor = 0.85 + (sp.tier - 1) * 0.1;  // T1 0.85 … T4 1.15
  return { volatility, tierFactor, degradeMult: volatility * tierFactor };
}

// Needs below these levels start feeding stress (the same points the AI uses to seek food/water).
export const NEED_LOW = { hunger: 0.45, thirst: 0.4 };

export const STRESS = {
  radio: 0.6,        // assigned keepers call in an agitated resident
  aggressionAny: 0.75, // any organism this stressed becomes aggression-eligible regardless of species mix
  breach: 0.7,       // breach eligibility floor
  healthLoss: 0.8,   // chronic stress drains health above this
  recover: 0.6,      // health only regenerates below this
};

export const HEALTH = { warn: 0.6, critical: 0.3, injuredUntil: 0.8 };

// Keepers assigned to an enclosure (any role) — their presence halves escalation of neglect.
export const assignedKeepers = (state, encId) =>
  encId == null ? 0 : (state.staff || []).filter((st) => st.assignedEnclosureId === encId).length;
export const KEEPER_CARE_MULT = 0.55;
export const keeperMult = (state, encId) => (assignedKeepers(state, encId) > 0 ? KEEPER_CARE_MULT : 1);

// Rapid Response coverage: nearest post distance (Infinity when none) and whether one is in radius.
export const RESPONSE_RADIUS = { breach: 18, incident: 22 };
export function nearestPost(state, x, y) {
  let best = null, bd = Infinity;
  for (const b of state.buildings) {
    if (b.type !== 'security_post') continue;
    const d = Math.hypot(b.x + b.w / 2 - x, b.y + b.h / 2 - y);
    if (d < bd) { bd = d; best = b; }
  }
  return { post: best, dist: bd };
}

// Aggregate tension of one enclosure's residents (UI + renderer tint).
export function enclosureTension(state, encId) {
  const residents = state.creatures.filter((c) => c.enclosureId === encId);
  if (!residents.length) return { residents, mean: 0, max: 0, distressed: 0, injured: 0, breachRisk: 0 };
  let sum = 0, max = 0, distressed = 0, injured = 0, breachRisk = 0;
  for (const c of residents) {
    sum += c.stress; max = Math.max(max, c.stress);
    if (c.distressed) distressed++;
    if (c.injured) injured++;
    if (c._breachWarned) breachRisk++;
  }
  return { residents, mean: sum / residents.length, max, distressed, injured, breachRisk };
}
