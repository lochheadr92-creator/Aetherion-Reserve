// ---- Unknown Biology: knowledge, evidence, hypotheses, discoveries. ----
// THE ONLY way the UI may read species attributes is getSpeciesView(). Hidden
// attributes return UNKNOWN until the simulation has actually discovered them.
import { speciesById } from './data/species';
import { MATERIALS, FENCES } from './constants';
import { pushAlert, emit, hasResearch } from './state';

export const EVIDENCE_THRESHOLD = 8;
export const HYPOTHESIS_AT = 4;

export function evidenceMult(state) {
  if (hasResearch(state, 'bio_obs2')) return 2.0;
  if (hasResearch(state, 'bio_obs1')) return 1.5;
  return 1.0;
}

export function isDiscovered(state, speciesId, attr) {
  const sp = speciesById(speciesId);
  if (!sp.hiddenAttrs.includes(attr)) return true;
  return !!state.knowledge[speciesId]?.discovered[attr];
}

export function recordEvidence(state, speciesId, attr, amount = 1) {
  const sp = speciesById(speciesId);
  if (!sp || !sp.hiddenAttrs.includes(attr)) return;
  const k = state.knowledge[speciesId];
  if (k.discovered[attr]) return;
  k.evidence[attr] = (k.evidence[attr] || 0) + amount * evidenceMult(state);
  if (!k.hypothesized[attr] && k.evidence[attr] >= HYPOTHESIS_AT) {
    k.hypothesized[attr] = true;
    pushAlert(state, {
      type: 'info', title: 'FIELD HYPOTHESIS',
      msg: `Researchers suspect something about the ${attrLabel(attr)} of ${sp.name}. Continue observation to confirm.`,
      target: { kind: 'species', id: speciesId },
    });
  }
  if (k.evidence[attr] >= EVIDENCE_THRESHOLD) discover(state, speciesId, attr);
}

export function discover(state, speciesId, attr, viaResearch = false) {
  const sp = speciesById(speciesId);
  const k = state.knowledge[speciesId];
  if (k.discovered[attr]) return;
  k.discovered[attr] = true;
  state.stats.discoveries++;
  const grant = 400 + sp.tier * 300;
  state.cash += grant;
  state.finances.today.income.grants += grant;
  pushAlert(state, {
    type: 'breakthrough', title: 'BIOLOGICAL BREAKTHROUGH',
    msg: `${sp.name}: ${discoveryText(sp, attr)} (+◈${grant} research grant)`,
    target: { kind: 'species', id: speciesId },
  });
  emit('discovery', { speciesId, attr });
}

export function attrLabel(attr) {
  const map = { diet: 'diet', terrain: 'terrain preference', water: 'water requirement', elevation: 'elevation preference', forest: 'canopy preference', social: 'social structure', shelter: 'shelter needs', containment: 'containment requirement' };
  return map[attr] || attr;
}

export function discoveryText(sp, attr) {
  switch (attr) {
    case 'diet': return `DIET CONFIRMED — ${sp.diet.type}${sp.diet.feedsFromWater ? ' (feeds directly from water surfaces)' : sp.diet.station ? ` (use a ${stationName(sp.diet.station)})` : ''}`;
    case 'terrain': return `TERRAIN PREFERENCE CONFIRMED — favours ${sp.env.terrain.prefer.map((m) => MATERIALS[m].name).join(', ')} (${Math.round(sp.env.terrain.preferMin * 100)}%+ coverage)`;
    case 'water': return sp.env.water.aquaticMin > 0 ? `AQUATIC REQUIREMENT CONFIRMED — needs ${Math.round(sp.env.water.aquaticMin * 100)}%+ water habitat${sp.env.water.needsDeep ? ' including deep water' : ''}` : 'WATER REQUIREMENT CONFIRMED — drinking access only';
    case 'elevation': return sp.env.elevation.min >= 4 ? 'HIGH-ELEVATION PREFERENCE CONFIRMED — requires elevated rocky ground (25%+ high terrain)' : `ELEVATION RANGE CONFIRMED — comfortable between levels ${sp.env.elevation.min} and ${sp.env.elevation.max}`;
    case 'forest': return `CANOPY PREFERENCE CONFIRMED — ${Math.round(sp.env.forest.min * 100)}%–${Math.round(sp.env.forest.max * 100)}% tree coverage`;
    case 'social': return sp.compat.requires ? `SYMBIOSIS IDENTIFIED — requires ${speciesById(sp.compat.requires).name} in its enclosure` : `SOCIAL STRUCTURE IDENTIFIED — ${sp.social.type} (${sp.social.min}–${sp.social.max})`;
    case 'shelter': return 'SHELTER REQUIREMENT CONFIRMED — requires an enclosed refuge';
    case 'containment': return `CONTAINMENT REQUIREMENT REVISED — requires ${FENCES[sp.containment.tier].name} (Tier ${sp.containment.tier})`;
    default: return `${attr} documented`;
  }
}

function stationName(st) {
  return { forage: 'Forage Dispenser', meat: 'Carcass Feeder', mineral: 'Mineral Trough', fungal: 'Spore Silo', energy: 'Energy Conduit' }[st] || st;
}

export function knowledgeLevel(state, speciesId) {
  const sp = speciesById(speciesId);
  const total = sp.hiddenAttrs.length;
  if (total === 0) return { label: 'Fully Documented', pct: 1 };
  const found = sp.hiddenAttrs.filter((a) => state.knowledge[speciesId]?.discovered[a]).length;
  const pct = found / total;
  const label = pct === 1 ? 'Fully Documented' : pct >= 0.75 ? 'Well Studied' : pct >= 0.4 ? 'Partially Understood' : found > 0 ? 'Basic Observation' : 'Unclassified';
  return { label, pct };
}

// The gated view — the ONLY accessor the UI should use for species biology.
export function getSpeciesView(state, speciesId) {
  const sp = speciesById(speciesId);
  const k = state.knowledge[speciesId] || { discovered: {}, evidence: {}, hypothesized: {} };
  const known = {};
  const unknown = [];
  const hypotheses = [];
  const fields = {
    diet: () => sp.diet.feedsFromWater ? `${sp.diet.type} — feeds from water surfaces` : `${sp.diet.type}${sp.diet.station ? ` — use ${stationName(sp.diet.station)}` : ''}`,
    terrain: () => `Favours ${sp.env.terrain.prefer.map((m) => MATERIALS[m].name).join(', ')} (${Math.round(sp.env.terrain.preferMin * 100)}%+)${sp.env.terrain.avoid.length ? `; avoids ${sp.env.terrain.avoid.map((m) => MATERIALS[m].name).join(', ')}` : ''}`,
    water: () => sp.env.water.aquaticMin > 0 ? `Aquatic habitat ${Math.round(sp.env.water.aquaticMin * 100)}%+${sp.env.water.needsDeep ? ' incl. deep water' : ''}` : sp.env.water.drink ? 'Drinking access only' : 'Does not drink',
    elevation: () => sp.env.elevation.min >= 4 ? 'Requires high rocky ground (25%+ elevated)' : `Levels ${sp.env.elevation.min}–${sp.env.elevation.max}`,
    forest: () => `${Math.round(sp.env.forest.min * 100)}%–${Math.round(sp.env.forest.max * 100)}% canopy`,
    social: () => sp.compat.requires ? `${sp.social.type}; requires ${speciesById(sp.compat.requires).name} (symbiosis)` : `${sp.social.type} (${sp.social.min}–${sp.social.max}, ideal ${sp.social.ideal})`,
    shelter: () => sp.env.shelter ? 'Requires shelter' : 'No shelter needed',
    containment: () => `${FENCES[sp.containment.tier].name} (Tier ${sp.containment.tier})`,
  };
  for (const [attr, fn] of Object.entries(fields)) {
    if (!sp.hiddenAttrs.includes(attr) || k.discovered[attr]) known[attr] = fn();
    else {
      unknown.push(attr);
      if (k.hypothesized[attr]) hypotheses.push(attr);
      if (attr === 'containment') known._containmentEstimate = `Estimated: ${FENCES[sp.containment.estimate].name} (Tier ${sp.containment.estimate}) — UNCONFIRMED`;
    }
  }
  return { species: sp, known, unknown, hypotheses, evidence: k.evidence, level: knowledgeLevel(state, speciesId) };
}

// dynamic research projects from partial evidence: OBSERVATION → QUESTION → RESEARCH → KNOWLEDGE
export function refreshDynamicProjects(state) {
  const existing = new Set(state.research.dynamicProjects.map((p) => p.key));
  const ownedSpecies = new Set(state.creatures.map((c) => c.speciesId));
  for (const sid of ownedSpecies) {
    const sp = speciesById(sid);
    const k = state.knowledge[sid];
    for (const attr of sp.hiddenAttrs) {
      if (k.discovered[attr]) continue;
      if ((k.evidence[attr] || 0) >= HYPOTHESIS_AT) {
        const key = `dyn:${sid}:${attr}`;
        if (!existing.has(key)) {
          state.research.dynamicProjects.push({
            key, id: key, cat: 'Field Studies', speciesId: sid, attr,
            name: `Field Study: ${attrLabel(attr)} of ${sp.name}`,
            cost: 500 + sp.tier * 250, time: 25,
            desc: `Behavioural evidence suggests a pattern in the ${attrLabel(attr)} of ${sp.name}. A focused study will confirm it.`,
          });
          pushAlert(state, { type: 'info', title: 'RESEARCH QUESTION', msg: `New field study available: ${attrLabel(attr)} of ${sp.name}`, target: { kind: 'research' } });
        }
      }
    }
  }
  // prune completed
  state.research.dynamicProjects = state.research.dynamicProjects.filter((p) => !state.knowledge[p.speciesId]?.discovered[p.attr]);
}
