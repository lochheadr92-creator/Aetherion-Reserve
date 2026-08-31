// ---- Attraction quality & synergy ----
// An attraction's value depends on WHERE it stands: nearby creature rarity and
// appeal, live events, time of day, elevation and neighbouring amenities.
// Returns a multiplier (0.5 .. 2.0) applied to prices, fun gain and opinions,
// plus a breakdown for the Building panel.
import { idx } from './state';
import { BUILDINGS } from './data/buildings';
import { speciesById } from './data/species';
import { geneAppealMult } from './genetics';
import { getDayPhase } from './weather';
import { eventsNear } from './events';

// scaling drivers for museums/theatres etc.
function scalingValue(state, key) {
  switch (key) {
    case 'discoveries': return Math.min(1, (state.stats.discoveries || 0) / 8);
    case 'diversity': return Math.min(1, new Set(state.creatures.map((c) => c.speciesId)).size / 8);
    case 'expeditions': return Math.min(1, (state.stats.expeditionsDone || (state.expeditions || []).filter((e) => e.status === 'returned' || e.status === 'claimed').length) / 4);
    case 'births': return Math.min(1, (state.stats.births || 0) / 5);
    default: return 0.5;
  }
}

export function attractionReport(state, b) {
  const def = BUILDINGS[b.type];
  if (!def) return { score: 1, parts: [] };
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  const parts = [];
  let score = 1;

  // nearby living collection: appeal x tier x genetics within 12 tiles
  let appeal = 0;
  for (const c of state.creatures) {
    const d = Math.hypot(c.x - cx, c.y - cy);
    if (d > 12 || c.escaped) continue;
    const sp = speciesById(c.speciesId);
    appeal += sp.appeal * (0.6 + sp.tier * 0.15) * geneAppealMult(c) * (1 - d / 14);
  }
  const appealBoost = Math.min(0.5, appeal / 320);
  if (appealBoost > 0.05) { score += appealBoost; parts.push({ label: 'Nearby exhibits', value: appealBoost }); }
  else if (def.viewRadius || def.scenic || def.sells === 'show') { score -= 0.25; parts.push({ label: 'No creatures nearby', value: -0.25 }); }

  // live events pull crowds
  const evts = eventsNear(state, cx, cy, 8);
  if (evts.length) {
    const evBoost = Math.min(0.45, Math.max(...evts.map((e) => e.magnitude)) * 0.5);
    score += evBoost;
    parts.push({ label: 'Live event nearby', value: evBoost });
  }

  // time of day: night houses & lodges shine after dark
  const night = getDayPhase(state.tick).phase === 'night';
  if (def.nightBonus) {
    const v = night ? 0.3 : -0.15;
    score += v;
    parts.push({ label: night ? 'Night hours' : 'Waiting for nightfall', value: v });
  }

  // elevation advantage for elevated venues
  if (def.elevated) {
    const h = state.heights[idx(Math.floor(cx), Math.floor(cy))] || 0;
    if (h >= 3) { score += 0.15; parts.push({ label: 'Commanding elevation', value: 0.15 }); }
  }

  // amenity adjacency: food/drink near viewers keeps crowds longer (and vice versa)
  const nearAmenity = state.buildings.some((o) => o.id !== b.id &&
    ['food', 'drink'].includes(BUILDINGS[o.type]?.sells) &&
    Math.hypot(o.x - cx, o.y - cy) <= 8);
  if (def.viewRadius && nearAmenity) { score += 0.1; parts.push({ label: 'Food & drink nearby', value: 0.1 }); }

  // scaling attractions (museums, theatres) grow with park accomplishments
  if (def.scaling) {
    const sv = scalingValue(state, def.scaling);
    const v = (sv - 0.5) * 0.6;
    score += v;
    parts.push({ label: { discoveries: 'Research archive', diversity: 'Species diversity', expeditions: 'Expedition trophies', births: 'Breeding program' }[def.scaling], value: v });
  }

  score = Math.max(0.5, Math.min(2, score));
  return { score, parts };
}

export function synergyScore(state, b) {
  return attractionReport(state, b).score;
}
