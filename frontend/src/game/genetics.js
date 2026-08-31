// ---- Genetics: heritable traits, lineage, morphs, inbreeding ----
// Every creature carries a `genes` object. Wild-caught animals are generation 0.
// Offspring blend parent stats with jitter + rare mutations. Rare colour morphs
// follow a carrier (recessive-style) model so bloodline planning matters.
import { rnd } from './state';

// behavioural + biological stats, all 0..1 with ~0.5 as species baseline
export const GENE_KEYS = ['agg', 'curio', 'social', 'intel', 'bold', 'stressTol', 'fertility', 'longevity', 'resilience', 'metabolism'];

// rare colour morphs: hue rotation + saturation + glow override, weighted rarity
export const MORPHS = [
  { id: 'violet', name: 'Violet Bioluminescence', hue: 55, sat: 1.15, glow: '#b98ae0', weight: 3 },
  { id: 'ember', name: 'Ember Morph', hue: -70, sat: 1.2, glow: '#ff9a5c', weight: 3 },
  { id: 'azure', name: 'Azure Morph', hue: 120, sat: 1.15, glow: '#4db6ff', weight: 3 },
  { id: 'gilded', name: 'Gilded Morph', hue: -35, sat: 1.35, glow: '#f2c14e', weight: 2 },
  { id: 'phantom', name: 'Phantom Pale', hue: 0, sat: 0.25, glow: '#e8f2ff', weight: 1 },
];

const morphById = (id) => MORPHS.find((m) => m.id === id) || null;

function rollMorph() {
  const total = MORPHS.reduce((s, m) => s + m.weight, 0);
  let r = rnd() * total;
  for (const m of MORPHS) { r -= m.weight; if (r <= 0) return m.id; }
  return MORPHS[0].id;
}

const OFFSPRING_NAMES = [
  'Varkesh', 'Selara', 'Nyrra', 'Oskan', 'Thale', 'Vexa', 'Auren', 'Kessri', 'Dravon', 'Ilyth',
  'Morrek', 'Sylvi', 'Kaelen', 'Ondra', 'Rhazk', 'Teyva', 'Ulmar', 'Vessk', 'Weyra', 'Xanthe',
  'Yorvan', 'Zephra', 'Ashkan', 'Brenna', 'Corvyn', 'Delya', 'Ereth', 'Fenna', 'Ghorak', 'Halix',
  'Irissa', 'Jorund', 'Kyrra', 'Lorcan', 'Maeva', 'Nashor', 'Ophira', 'Pyrran', 'Quessa', 'Ryvek',
];

export function offspringName(state) {
  const used = new Set(state.creatures.map((c) => c.name));
  for (let k = 0; k < OFFSPRING_NAMES.length; k++) {
    const n = OFFSPRING_NAMES[Math.floor(rnd() * OFFSPRING_NAMES.length)];
    if (!used.has(n)) return n;
  }
  return `${OFFSPRING_NAMES[Math.floor(rnd() * OFFSPRING_NAMES.length)]}-${Math.floor(rnd() * 90) + 10}`;
}

const clamp01 = (v) => Math.max(0.05, Math.min(0.98, v));

// generation-0 genes for wild-caught / purchased organisms
export function rollWildGenes() {
  const g = { gen: 0, parents: null, ancestors: [], inbreed: 0 };
  for (const k of GENE_KEYS) g[k] = clamp01(0.35 + rnd() * 0.3);
  g.size = 0.92 + rnd() * 0.16;
  g.hue = Math.round((rnd() - 0.5) * 20); // subtle natural variation
  g.sat = 0.95 + rnd() * 0.1;
  g.morph = rnd() < 0.012 ? rollMorph() : null; // rare wild morph
  g.carrier = g.morph ? g.morph : (rnd() < 0.06 ? rollMorph() : null);
  return g;
}

// blend + jitter + mutation; morphs use a carrier model
export function inheritGenes(state, mother, father) {
  const a = mother.genes || rollWildGenes();
  const b = (father && father.genes) || rollWildGenes();
  const g = { gen: Math.max(a.gen || 0, b.gen || 0) + 1 };

  // lineage & inbreeding: shared blood between the two parent lines
  const aLine = new Set([mother.id, ...(a.ancestors || [])]);
  const bLine = new Set([father ? father.id : -1, ...(b.ancestors || [])]);
  let shared = 0;
  for (const id of aLine) if (bLine.has(id)) shared++;
  const inbreed = Math.min(1, shared / 3);
  g.inbreed = Math.round(inbreed * 100) / 100;
  g.ancestors = [mother.id, father ? father.id : -1, ...(a.ancestors || []).slice(0, 3), ...(b.ancestors || []).slice(0, 3)].slice(0, 8);
  g.parents = {
    mId: mother.id, mName: mother.name,
    fId: father ? father.id : null, fName: father ? father.name : 'Unknown',
  };

  // stat blending with jitter + rare mutation spikes
  for (const k of GENE_KEYS) {
    let v = ((a[k] ?? 0.5) + (b[k] ?? 0.5)) / 2 + (rnd() - 0.5) * 0.16;
    if (rnd() < 0.06) v += (rnd() - 0.5) * 0.4; // mutation
    g[k] = clamp01(v);
  }
  // inbreeding depression hits fertility + resilience hard
  if (inbreed > 0) {
    g.fertility = clamp01(g.fertility * (1 - inbreed * 0.6));
    g.resilience = clamp01(g.resilience * (1 - inbreed * 0.5));
  }

  // appearance
  g.size = Math.max(0.8, Math.min(1.32, ((a.size || 1) + (b.size || 1)) / 2 + (rnd() - 0.5) * 0.08 + (rnd() < 0.05 ? (rnd() - 0.4) * 0.2 : 0)));
  g.hue = Math.round(((a.hue || 0) + (b.hue || 0)) / 2 + (rnd() - 0.5) * 10);
  g.sat = Math.max(0.85, Math.min(1.15, ((a.sat || 1) + (b.sat || 1)) / 2 + (rnd() - 0.5) * 0.06));

  // morph inheritance (carrier model)
  g.morph = null;
  g.carrier = null;
  const am = a.morph, bm = b.morph, ac = a.carrier, bc = b.carrier;
  if (am && bm && am === bm) { if (rnd() < 0.7) g.morph = am; }
  else if (am || bm) { if (rnd() < 0.35) g.morph = am || bm; }
  else if (ac && bc && ac === bc) { if (rnd() < 0.25) g.morph = ac; }
  if (!g.morph && rnd() < 0.02) g.morph = rollMorph(); // spontaneous mutation
  if (!g.morph) {
    // pass a hidden carrier down the line
    const pool = [am, bm, ac, bc].filter(Boolean);
    if (pool.length && rnd() < 0.5) g.carrier = pool[Math.floor(rnd() * pool.length)];
  } else g.carrier = g.morph;
  return g;
}

export function morphOf(c) {
  return c && c.genes && c.genes.morph ? morphById(c.genes.morph) : null;
}

// derive readable trait chips from a gene set
export function traitLabels(genes) {
  if (!genes) return [];
  const t = [];
  const m = genes.morph ? morphById(genes.morph) : null;
  if (m) t.push({ label: m.name, kind: 'morph', color: m.glow });
  if (genes.intel > 0.72) t.push({ label: 'High Intelligence', kind: 'behaviour' });
  if (genes.agg > 0.72) t.push({ label: 'Aggressive', kind: 'warning' });
  else if (genes.agg < 0.28) t.push({ label: 'Docile', kind: 'behaviour' });
  if (genes.bold > 0.72) t.push({ label: 'Fearless', kind: 'behaviour' });
  else if (genes.bold < 0.28) t.push({ label: 'Skittish', kind: 'behaviour' });
  if (genes.stressTol > 0.72) t.push({ label: 'Unshakeable', kind: 'bio' });
  if (genes.social > 0.72) t.push({ label: 'Gregarious', kind: 'behaviour' });
  if (genes.curio > 0.72) t.push({ label: 'Inquisitive', kind: 'behaviour' });
  if (genes.fertility > 0.75) t.push({ label: 'Prolific', kind: 'bio' });
  if (genes.resilience > 0.75) t.push({ label: 'Hardy', kind: 'bio' });
  if (genes.longevity > 0.75) t.push({ label: 'Long-Lived', kind: 'bio' });
  if (genes.metabolism > 0.72) t.push({ label: 'Voracious', kind: 'bio' });
  else if (genes.metabolism < 0.28) t.push({ label: 'Efficient Metabolism', kind: 'bio' });
  if (genes.size >= 1.12) t.push({ label: `+${Math.round((genes.size - 1) * 100)}% Size`, kind: 'bio' });
  else if (genes.size <= 0.88) t.push({ label: `${Math.round((genes.size - 1) * 100)}% Size`, kind: 'bio' });
  if (genes.inbreed >= 0.25) t.push({ label: 'Inbred Line', kind: 'danger' });
  return t;
}

// guest-facing appeal bonus for exceptional genetics
export function geneAppealMult(c) {
  if (!c.genes) return 1;
  let m = 1;
  if (c.genes.morph) m += 0.5;
  if (c.genes.size >= 1.15) m += 0.15;
  if ((c.genes.gen || 0) >= 3) m += 0.1; // established bloodline
  return m;
}

// backfill for saves created before the genetics system existed
export function ensureGenes(state) {
  if (!state || !state.creatures) return;
  for (const c of state.creatures) {
    if (!c.genes) c.genes = rollWildGenes();
  }
}
