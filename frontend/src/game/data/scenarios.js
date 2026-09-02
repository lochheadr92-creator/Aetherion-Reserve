// ---- Scenario mission definitions ----
// Each scenario defines: setup mutations (applied to a fresh management game),
// win goals (ALL must pass) and fail conditions (ANY ends the mission).
// Optional mastery objectives are graded at the moment of victory.
// Check functions read authoritative state only — no side effects.
import { speciesById } from './species';
import { computeEnclosures } from '../enclosures';

const toursTotal = (s) => {
  let sum = s.finances.today.income.tours || 0;
  for (const h of s.finances.history) sum += h.income?.tours || 0;
  return sum;
};

// the enclosure currently holding the (single) creature of a species, or null
const holdingEnclosure = (s, speciesId) => {
  const c = s.creatures.find((q) => q.speciesId === speciesId);
  if (!c || c.escaped || !c.enclosureId) return null;
  const { enclosures } = computeEnclosures(s);
  return enclosures.find((e) => e.id === c.enclosureId) || null;
};

// bloodline helpers (Sovereign Bloodline)
const nyx = (s) => s.creatures.filter((c) => c.speciesId === 'nyxarr');
const nyxBirths = (s) => s.stats.birthsBySpecies?.nyxarr || 0;
const scenarioDay = (s) => s.day - (s.scenario?.startDay || 1) + 1; // 1-based mission cycle
const BLOODLINE_DEADLINE = 16; // mission cycle at which funding closes
const bloodlineHealthy = (c) => !c.escaped && c.welfare >= 0.65 && (c.genes?.inbreed || 0) < 0.25;

export const SCENARIOS = {
  first_light: {
    id: 'first_light', name: 'First Light', difficulty: 'EASY', reward: 8000,
    tagline: 'Prove the Aetherion Initiative can go public.',
    desc: 'A fresh site, a modest budget and a skeptical Board. Open the reserve, welcome your first visitors and confirm one piece of unknown biology.',
    setup: { cash: 60000 },
    goals: [
      { id: 'rating', label: 'Reach a 2.5★ park rating', check: (s) => s.rating.overall >= 0.5 },
      { id: 'guests', label: 'Welcome 30 total guests', check: (s) => s.stats.guestsTotal >= 30 },
      { id: 'discovery', label: 'Confirm 1 biology discovery', check: (s) => s.stats.discoveries >= 1 },
    ],
    fails: [
      { id: 'bankrupt', label: 'Debt exceeds ◈8,000', check: (s) => s.cash < -8000 },
    ],
  },

  skitter_bloom: {
    id: 'skitter_bloom', name: 'The Skitter Bloom', difficulty: 'MEDIUM', reward: 12000,
    tagline: 'Breed a self-sustaining Skitterling colony.',
    desc: 'You inherit a small documented Skitterling exhibit and an approved Husbandry Program. Grow the colony to eight thriving individuals through breeding — welfare drives pairing.',
    setup: {
      cash: 40000,
      research: ['bio_obs1', 'bio_breeding'],
      starterEnclosure: { x0: 40, y0: 30, x1: 48, y1: 38, tier: 1, feeder: 'feeder_forage', shelter: true },
      creatures: [
        { speciesId: 'skitter', x: 42, y: 33 }, { speciesId: 'skitter', x: 44, y: 33 },
        { speciesId: 'skitter', x: 43, y: 35 }, { speciesId: 'skitter', x: 45, y: 35 },
      ],
    },
    goals: [
      { id: 'births', label: 'Raise 4 offspring', check: (s) => (s.stats.births || 0) >= 4 },
      { id: 'pop', label: 'Colony of 8+ Skitterlings', check: (s) => s.creatures.filter((c) => c.speciesId === 'skitter').length >= 8 },
      { id: 'welfare', label: 'Average colony welfare 65%+', check: (s) => {
        const ks = s.creatures.filter((c) => c.speciesId === 'skitter');
        return ks.length >= 8 && ks.reduce((a, c) => a + c.welfare, 0) / ks.length >= 0.65;
      } },
    ],
    fails: [
      { id: 'bankrupt', label: 'Debt exceeds ◈8,000', check: (s) => s.cash < -8000 },
      { id: 'breaches', label: '5 containment breaches', check: (s) => (s.stats.breaches || 0) >= 5 },
    ],
  },

  containment_crisis: {
    id: 'containment_crisis', name: 'Containment Crisis', difficulty: 'HARD', reward: 18000,
    tagline: 'A Karrgan Maw is already on site. It digs.',
    desc: 'The previous administrator left behind an apex burrower in a bare tier-1 pen. It WILL tunnel out. Build response capacity, recapture it when it runs, and research your way to real containment.',
    setup: {
      cash: 35000,
      research: ['cont_reinforced'],
      starterEnclosure: { x0: 46, y0: 28, x1: 54, y1: 36, tier: 1, feeder: 'feeder_meat', shelter: false },
      creatures: [{ speciesId: 'karrgan', x: 50, y: 32 }],
    },
    goals: [
      { id: 'security', label: 'Build a Rapid Response Post', check: (s) => s.buildings.some((b) => b.type === 'security_post') },
      { id: 'captures', label: 'Recapture 2 escaped organisms', check: (s) => (s.stats.captures || 0) >= 2 },
      { id: 'research', label: 'Complete 2 research projects', check: (s) => (s.stats.researchCompleted || 0) >= 2 },
      { id: 'secure', label: 'No organisms outside containment', check: (s) => s.creatures.length > 0 && !s.creatures.some((c) => c.escaped) },
    ],
    fails: [
      { id: 'bankrupt', label: 'Debt exceeds ◈8,000', check: (s) => s.cash < -8000 },
      { id: 'breaches', label: '8 containment breaches', check: (s) => (s.stats.breaches || 0) >= 8 },
    ],
  },

  night_bloom: {
    id: 'night_bloom', name: 'Night Bloom Gala', difficulty: 'EXPERT', reward: 25000,
    tagline: 'Make the dark profitable.',
    desc: 'The Board wants a luxury after-dark experience. House glowing species, keep them thriving, and bank ◈6,000 in night tour premiums. Guests who see nothing glow will want refunds.',
    setup: { cash: 55000, policies: { nightTours: true } },
    goals: [
      { id: 'glow2', label: 'House 2 bioluminescent species (60%+ welfare)', check: (s) => {
        const glow = new Map();
        for (const c of s.creatures) {
          const sp = speciesById(c.speciesId);
          if (sp.colors.glow && !c.escaped) glow.set(sp.id, Math.max(glow.get(sp.id) || 0, c.welfare));
        }
        return [...glow.values()].filter((w) => w >= 0.6).length >= 2;
      } },
      { id: 'tours', label: 'Earn ◈6,000 in night tour premiums', check: (s) => toursTotal(s) >= 6000 },
    ],
    fails: [
      { id: 'bankrupt', label: 'Debt exceeds ◈8,000', check: (s) => s.cash < -8000 },
    ],
  },

  sovereign_containment: {
    id: 'sovereign_containment', name: 'Sovereign Containment', difficulty: 'BRUTAL', reward: 40000,
    tagline: 'AR-031 is already in the pen. The pen is failing.',
    desc: 'A decommissioned research annex holds a Nyxarr Sovereign behind a storm-battered perimeter — tier-1 patch jobs, segments at 15% integrity, and a budget that will not cover mistakes. Rebuild a full Insulated (Tier 4) wall before it walks out, keep the apex thriving, and turn the most dangerous organism on record into the reserve\u2019s crown exhibit.',
    setup: {
      cash: 30000,
      research: ['bio_obs1', 'cont_reinforced', 'cont_heavy', 'cont_insulated'],
      starterEnclosure: {
        x0: 44, y0: 26, x1: 57, y1: 39, tier: 4, feeder: 'feeder_meat', shelter: true,
        damage: { patchTier: 1, patchEvery: 9, weakenEvery: 7, weakenTo: 0.15 },
      },
      buildings: [
        { type: 'admin', x: 37, y: 42 },
        { type: 'lab', x: 41, y: 42 },
      ],
      creatures: [{ speciesId: 'nyxarr', x: 50, y: 32 }],
    },
    goals: [
      { id: 'perimeter', label: 'Contain the Sovereign behind a full Insulated (Tier 4) perimeter, no damaged segments', check: (s) => {
        const enc = holdingEnclosure(s, 'nyxarr');
        return !!enc && enc.minFenceTier >= 4 && enc.damagedSegments === 0;
      } },
      { id: 'welfare', label: 'Sovereign welfare 65%+', check: (s) => {
        const c = s.creatures.find((q) => q.speciesId === 'nyxarr');
        return !!c && !c.escaped && c.welfare >= 0.65;
      } },
      { id: 'guests', label: 'Welcome 60 total guests', check: (s) => s.stats.guestsTotal >= 60 },
      { id: 'rating', label: 'Reach a 3.0★ park rating', check: (s) => s.rating.overall >= 0.6 },
    ],
    fails: [
      { id: 'bankrupt', label: 'Debt exceeds ◈5,000', check: (s) => s.cash < -5000 },
      { id: 'breaches', label: '4 containment breaches', check: (s) => (s.stats.breaches || 0) >= 4 },
      { id: 'loose', label: 'Organisms at large for 5+ cumulative minutes', check: (s) => (s.scenario?.escapeTicks || 0) >= 3000 },
    ],
    mastery: [
      { id: 'ironwall', label: 'Iron Wall — zero containment breaches', check: (s) => (s.stats.breaches || 0) === 0 },
      { id: 'solvent', label: 'Solvent — never dipped into debt', check: (s) => (s.scenario?.minCash ?? 0) >= 0 },
      { id: 'court', label: 'Sovereign Court — apex welfare 85%+ at victory', check: (s) => {
        const c = s.creatures.find((q) => q.speciesId === 'nyxarr');
        return !!c && c.welfare >= 0.85;
      } },
      { id: 'spectacle', label: 'Spectacle — 120+ total guests welcomed', check: (s) => s.stats.guestsTotal >= 120 },
    ],
  },

  sovereign_bloodline: {
    id: 'sovereign_bloodline', name: 'Sovereign Bloodline', difficulty: 'BRUTAL', reward: 50000,
    tagline: 'Two Sovereigns. One pen. Sixteen cycles to found a dynasty.',
    desc: 'The Board has approved the most dangerous husbandry program on record: pair-bond two wild-caught Nyxarr Sovereigns and raise three healthy offspring before the funding window closes at Cycle 16. The pair tolerates each other — barely. Every juvenile that matures crowds the pen, so transfer surplus adults to partner reserves to keep the pair breeding and the books balanced. A single inbred birth voids the program.',
    setup: {
      cash: 45000,
      research: ['bio_obs1', 'bio_breeding', 'cont_reinforced', 'cont_heavy', 'cont_insulated'],
      discovered: { nyxarr: ['social'] },
      starterEnclosure: {
        x0: 42, y0: 24, x1: 58, y1: 40, tier: 4, feeder: 'feeder_meat', shelter: true,
        damage: { patchTier: 3, patchEvery: 11, weakenEvery: 8, weakenTo: 0.35 },
      },
      buildings: [
        { type: 'admin', x: 36, y: 43 },
        { type: 'lab', x: 40, y: 43 },
      ],
      staff: [{ role: 'xenobiologist', assign: 'starter' }],
      creatures: [{ speciesId: 'nyxarr', x: 47, y: 30 }, { speciesId: 'nyxarr', x: 53, y: 34 }],
    },
    goals: [
      { id: 'bond', label: 'Pair-bond the Sovereigns (courtship observed)', check: (s) => (s.stats.courtships || 0) >= 1 },
      { id: 'offspring', label: 'Raise 3 Nyxarr offspring', progress: (s) => `${Math.min(3, nyxBirths(s))}/3`, check: (s) => nyxBirths(s) >= 3 },
      { id: 'matured', label: 'A park-bred Sovereign reaches maturity', check: (s) => (s.stats.maturedBySpecies?.nyxarr || 0) >= 1 },
      { id: 'healthy', label: 'Bloodline healthy — every living Sovereign 65%+ welfare, none inbred',
        progress: (s) => { const ns = nyx(s); return `${ns.filter(bloodlineHealthy).length}/${ns.length}`; },
        check: (s) => { const ns = nyx(s); return nyxBirths(s) >= 1 && ns.length >= 2 && ns.every(bloodlineHealthy); } },
    ],
    fails: [
      { id: 'deadline', label: `Funding window closes at Cycle ${BLOODLINE_DEADLINE}`, progress: (s) => `Cycle ${Math.min(BLOODLINE_DEADLINE, scenarioDay(s))}/${BLOODLINE_DEADLINE}`,
        check: (s) => scenarioDay(s) >= BLOODLINE_DEADLINE },
      { id: 'inbred', label: 'An inbred Sovereign is born', check: (s) => (s.stats.inbredBySpecies?.nyxarr || 0) >= 1 },
      { id: 'bankrupt', label: 'Debt exceeds ◈5,000', check: (s) => s.cash < -5000 },
      { id: 'breaches', label: '4 containment breaches', check: (s) => (s.stats.breaches || 0) >= 4 },
      { id: 'loose', label: 'Organisms at large for 5+ cumulative minutes', check: (s) => (s.scenario?.escapeTicks || 0) >= 3000 },
    ],
    mastery: [
      { id: 'dynasty', label: 'Dynasty — a rare morph Sovereign born into the line', check: (s) => nyx(s).some((c) => c.genes?.morph && (c.genes?.gen || 0) >= 1) },
      { id: 'swift', label: 'Swift — program completed before Cycle 10', check: (s) => scenarioDay(s) < 10 },
      { id: 'ironwall', label: 'Iron Wall — zero containment breaches', check: (s) => (s.stats.breaches || 0) === 0 },
      { id: 'solvent', label: 'Solvent — never dipped into debt', check: (s) => (s.scenario?.minCash ?? 0) >= 0 },
    ],
  },
};

export const SCENARIO_LIST = Object.values(SCENARIOS);
