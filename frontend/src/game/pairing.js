// ---- Pairing Planner: deterministic projection of a would-be pairing ----
// Pure, read-only helpers for the Bloodline Ledger. They mirror `inheritGenes` (genetics.js) and the
// pairing gates in `breedingTick` (creatures.js) WITHOUT consuming the sim RNG or touching state:
// expected values + spreads instead of rolls, exact carrier-model odds instead of dice.
import { GENE_KEYS, MORPHS, traitLabels } from './genetics';
import { projectedInbreeding, sharedBlood, relationLabel } from './lineage';
import { hasResearch } from './state';

const clamp01 = (v) => Math.max(0.05, Math.min(0.98, v));
const morphById = (id) => MORPHS.find((m) => m.id === id) || null;

// ---------- risk tiers (projected inbreeding coefficient buckets) ----------
// sharedBlood/3 yields 0, .33, .67, 1 — one tier per step, with the sim's INBRED threshold at .25.
export const RISK_TIERS = [
  { id: 'clean', label: 'CLEAN LINE', min: 0, color: 'var(--success)', blurb: 'No shared ancestry inside the tracked line. Offspring keep full fertility and hardiness.' },
  { id: 'elevated', label: 'ELEVATED RISK', min: 0.25, color: 'var(--warning)', blurb: 'One shared ancestor. Offspring are born INBRED: fertility −20%, hardiness −17%.' },
  { id: 'severe', label: 'SEVERE RISK', min: 0.6, color: 'var(--danger)', blurb: 'Two shared ancestors. Fertility −40%, hardiness −33% — the line is closing in on itself.' },
  { id: 'critical', label: 'CRITICAL', min: 0.95, color: 'var(--danger)', blurb: 'Fully closed line. Fertility −60%, hardiness −50%. Do not pair without fresh blood.' },
];

export function riskTier(inbreed) {
  let tier = RISK_TIERS[0];
  for (const t of RISK_TIERS) if (inbreed >= t.min) tier = t;
  return tier;
}

// ---------- readiness gates (same predicates as breedingTick) ----------
const WELFARE_MIN = 0.72;
const STRESS_MAX = 0.45;
const TICKS_PER_DAY = 2400;

function organismGates(c, who) {
  const cd = c.breedCd || 0;
  return [
    { id: `${who}-adult`, label: `${c.name} is mature`, ok: !c.juvenile, hard: true, why: 'juveniles cannot pair until they mature' },
    { id: `${who}-free`, label: `${c.name} is not gestating`, ok: !(c.gestation > 0), why: 'a birth must complete first' },
    { id: `${who}-cooldown`, label: `${c.name} is off breeding cooldown`, ok: cd <= 0, why: cd > 0 ? `~${Math.max(1, Math.ceil(cd / TICKS_PER_DAY * 10) / 10)} cycles remaining` : '' },
    { id: `${who}-welfare`, label: `${c.name} welfare ≥ ${Math.round(WELFARE_MIN * 100)}%`, ok: (c.welfare ?? 0) >= WELFARE_MIN, why: `currently ${Math.round((c.welfare ?? 0) * 100)}%` },
    { id: `${who}-stress`, label: `${c.name} stress ≤ ${Math.round(STRESS_MAX * 100)}%`, ok: (c.stress ?? 0) <= STRESS_MAX, why: `currently ${Math.round((c.stress ?? 0) * 100)}%` },
    { id: `${who}-contained`, label: `${c.name} is contained`, ok: !c.escaped && !c.held, hard: !!c.escaped, why: c.escaped ? 'escaped — recapture first' : c.held ? 'in a holding pen, not a habitat' : '' },
  ];
}

export function pairingChecklist(state, a, b) {
  const gates = [];
  gates.push({ id: 'distinct', label: 'Two different organisms', ok: a.id !== b.id, hard: true, why: 'an organism cannot pair with itself' });
  gates.push({ id: 'species', label: 'Same species', ok: a.speciesId === b.speciesId, hard: true, why: 'cross-species pairing is impossible' });
  gates.push({ id: 'research', label: 'Husbandry Program researched', ok: hasResearch(state, 'bio_breeding'), why: 'unlock it in Research → Biology' });
  gates.push({ id: 'housed', label: 'Housed in the same enclosure', ok: a.enclosureId != null && a.enclosureId === b.enclosureId, why: a.enclosureId == null || b.enclosureId == null ? 'one of them is outside any enclosure' : 'move one into the other\'s habitat' });
  gates.push(...organismGates(a, 'a'), ...organismGates(b, 'b'));
  return gates;
}

// ---------- morph odds (exact carrier-model probabilities from inheritGenes) ----------
export function morphOdds(ga, gb) {
  const am = ga.morph || null, bm = gb.morph || null, ac = ga.carrier || null, bc = gb.carrier || null;
  let p = 0, id = null, source = 'none';
  if (am && bm && am === bm) { p = 0.7; id = am; source = 'both parents express it'; }
  else if (am || bm) { p = 0.35; id = am || bm; source = am && bm ? 'each parent expresses a different morph' : 'one parent expresses it'; }
  else if (ac && bc && ac === bc) { p = 0.25; id = ac; source = 'both parents carry it silently'; }
  const pMorph = p + (1 - p) * 0.02; // spontaneous mutation on top
  const pool = [am, bm, ac, bc].filter(Boolean);
  const pCarrier = (1 - pMorph) * (pool.length ? 0.5 : 0);
  return { id, morph: id ? morphById(id) : null, pMorph: Math.round(pMorph * 1000) / 1000, pCarrier: Math.round(pCarrier * 1000) / 1000, source, pool: [...new Set(pool)] };
}

// ---------- the projection ----------
export const OUTLOOK_KEYS = ['fertility', 'resilience', 'longevity', 'stressTol', 'intel', 'social', 'agg', 'bold', 'curio', 'metabolism'];
export const GENE_LABELS = {
  agg: 'Aggression', curio: 'Curiosity', social: 'Sociability', intel: 'Intelligence', bold: 'Boldness',
  stressTol: 'Stress tolerance', fertility: 'Fertility', longevity: 'Longevity', resilience: 'Hardiness', metabolism: 'Metabolism',
};
// 'high is good' vs 'situational' — used only for colouring
export const GENE_GOOD_HIGH = new Set(['fertility', 'resilience', 'longevity', 'stressTol', 'intel', 'social']);

export function projectPairing(state, a, b) {
  if (!a || !b) return null;
  const ga = a.genes || {}, gb = b.genes || {};
  const inbreed = a.speciesId === b.speciesId && a.id !== b.id ? projectedInbreeding(a, b) : 0;
  const shared = a.id !== b.id ? sharedBlood(a, b) : 0;
  const risk = riskTier(inbreed);
  const relation = a.id === b.id ? 'Same organism' : relationLabel(state, a, b);

  // expected stats: parental mean, ±0.08 blend jitter (mutation spikes are too rare to plan around)
  const genes = {};
  const expected = { gen: Math.max(ga.gen || 0, gb.gen || 0) + 1, inbreed };
  for (const k of GENE_KEYS) {
    const va = ga[k] ?? 0.5, vb = gb[k] ?? 0.5;
    let mean = (va + vb) / 2, low = mean - 0.08, high = mean + 0.08;
    let depression = 0;
    if (inbreed > 0 && k === 'fertility') depression = inbreed * 0.6;
    if (inbreed > 0 && k === 'resilience') depression = inbreed * 0.5;
    if (depression) { mean *= 1 - depression; low *= 1 - depression; high *= 1 - depression; }
    genes[k] = { key: k, label: GENE_LABELS[k], a: va, b: vb, mean: clamp01(mean), low: clamp01(low), high: clamp01(high), depression: Math.round(depression * 100) };
    expected[k] = genes[k].mean;
  }
  expected.size = Math.max(0.8, Math.min(1.32, ((ga.size || 1) + (gb.size || 1)) / 2));
  expected.hue = Math.round(((ga.hue || 0) + (gb.hue || 0)) / 2);
  expected.sat = ((ga.sat || 1) + (gb.sat || 1)) / 2;

  const morph = morphOdds(ga, gb);
  // predicted chips: from the expected stat set; a morph chip only when it is the likelier outcome
  expected.morph = morph.pMorph >= 0.5 ? morph.id : null;
  const traits = traitLabels(expected);

  // per-check courtship odds once every gate is green (fertility already carries any depression of the parents)
  const fert = ((ga.fertility ?? 0.5) + (gb.fertility ?? 0.5)) / 2;
  const pairChance = Math.max(0, Math.min(1, 0.15 + fert * 0.4));

  const checklist = pairingChecklist(state, a, b);
  const blockers = checklist.filter((g) => !g.ok);
  return {
    a: { id: a.id, name: a.name, gen: ga.gen || 0 }, b: { id: b.id, name: b.name, gen: gb.gen || 0 },
    inbreed, shared, risk, relation, genes, expected, traits, morph, pairChance,
    checklist, blockers, viable: blockers.length === 0, impossible: blockers.some((g) => g.hard),
  };
}

// ---------- recommendations ----------
// Same-species park residents ranked for the subject. Score favours clean blood above all, then
// readiness/proximity, then what the pairing could yield (morph odds, strong fertility/hardiness).
function scoreCandidate(state, c, o) {
  const p = projectPairing(state, c, o);
  const reasons = [];
  let score = 0;
  if (p.inbreed === 0) { score += 100; reasons.push('unrelated'); }
  else { score -= 40 + p.inbreed * 100; reasons.push(`${Math.round(p.inbreed * 100)}% inbreeding`); }
  const ready = !o.juvenile && !(o.gestation > 0) && (o.breedCd || 0) <= 0;
  if (o.juvenile) { score -= 30; reasons.push('juvenile'); }
  else if (ready) { score += 20; reasons.push('ready'); }
  else reasons.push(o.gestation > 0 ? 'gestating' : 'on cooldown');
  const together = c.enclosureId != null && c.enclosureId === o.enclosureId;
  if (together) { score += 10; reasons.push('same enclosure'); }
  if (p.morph.pMorph >= 0.2) { score += p.morph.pMorph * 40; reasons.push(`${Math.round(p.morph.pMorph * 100)}% ${p.morph.morph?.name || 'morph'}`); }
  const vigour = (p.genes.fertility.mean + p.genes.resilience.mean) / 2;
  score += vigour * 20;
  if (vigour >= 0.6) reasons.push('vigorous offspring');
  return { id: o.id, name: o.name, gen: o.genes?.gen || 0, juvenile: !!o.juvenile, ready, together, inbreed: p.inbreed, risk: p.risk, pMorph: p.morph.pMorph, vigour: Math.round(vigour * 100), score: Math.round(score), reasons };
}

export function recommendPartners(state, c, limit = 5) {
  if (!state || !c) return [];
  const others = state.creatures.filter((o) => o.id !== c.id && o.speciesId === c.speciesId && !o.escaped);
  return others.map((o) => scoreCandidate(state, c, o)).sort((x, y) => y.score - x.score || x.id - y.id).slice(0, limit);
}

// Top pairs among every park resident of one species (n ≤ a few dozen → cheap).
export function bestPairs(state, speciesId, limit = 3) {
  if (!state) return [];
  const pool = state.creatures.filter((o) => o.speciesId === speciesId && !o.escaped && !o.juvenile);
  const out = [];
  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      const r = scoreCandidate(state, pool[i], pool[j]);
      out.push({ aId: pool[i].id, aName: pool[i].name, bId: pool[j].id, bName: pool[j].name, score: r.score, inbreed: r.inbreed, risk: r.risk, pMorph: r.pMorph, vigour: r.vigour, reasons: r.reasons });
    }
  }
  return out.sort((x, y) => y.score - x.score || x.aId - y.aId || x.bId - y.bId).slice(0, limit);
}

// candidates for the slot pickers: living park residents, optionally one species
export function plannerRoster(state, speciesId = null) {
  if (!state) return [];
  return state.creatures
    .filter((o) => !o.escaped && (speciesId == null || o.speciesId === speciesId))
    .slice()
    .sort((x, y) => x.speciesId.localeCompare(y.speciesId) || x.name.localeCompare(y.name));
}
