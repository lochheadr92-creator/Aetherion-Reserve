// ---- Scenario mission definitions ----
// Each scenario defines: setup mutations (applied to a fresh management game),
// win goals (ALL must pass) and fail conditions (ANY ends the mission).
// Check functions read authoritative state only — no side effects.
import { speciesById } from './species';

const toursTotal = (s) => {
  let sum = s.finances.today.income.tours || 0;
  for (const h of s.finances.history) sum += h.income?.tours || 0;
  return sum;
};

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
};

export const SCENARIO_LIST = Object.values(SCENARIOS);
