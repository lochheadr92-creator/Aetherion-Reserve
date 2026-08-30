// ---- Static research tree. Observation-driven projects are generated at runtime
// by knowledge.js when the simulation gathers real behavioural evidence. ----

export const RESEARCH = {
  bio_obs1: {
    id: 'bio_obs1', cat: 'Biology', name: 'Observation Protocols I', cost: 800, time: 45,
    desc: 'Standardised field journals. Behavioural evidence accumulates 50% faster.',
    effect: { evidenceMult: 1.5 },
  },
  bio_obs2: {
    id: 'bio_obs2', cat: 'Biology', name: 'Observation Protocols II', cost: 2000, time: 90, requires: ['bio_obs1'],
    desc: 'Drone-assisted continuous monitoring. Evidence accumulates twice as fast.',
    effect: { evidenceMult: 2.0 },
  },
  bio_stress: {
    id: 'bio_stress', cat: 'Biology', name: 'Stress Mitigation Techniques', cost: 1600, time: 75, requires: ['bio_obs1'],
    desc: 'Keeper handling standards reduce creature stress accumulation by 30%.',
    effect: { stressMult: 0.7 },
  },
  bio_scan: {
    id: 'bio_scan', cat: 'Biology', name: 'Deep Bio-Scan', cost: 4500, time: 150, requires: ['bio_obs2'],
    desc: 'Reveals one unknown attribute for every species currently in the park.',
    effect: { revealOnComplete: true },
  },
  env_flora: {
    id: 'env_flora', cat: 'Environment', name: 'Exotic Flora Cultivation', cost: 1500, time: 60,
    desc: 'Unlocks Fungal Ground and Aetheric Soil substrates, Spore Pillars and Aether Fronds.',
    effect: { unlockTerrain: true },
  },
  env_hydro: {
    id: 'env_hydro', cat: 'Environment', name: 'Hydro-Engineering', cost: 1200, time: 50,
    desc: 'Deep-water excavation techniques. Unlocks deep water and halves water placement costs.',
    effect: { waterCostMult: 0.5, unlockDeepWater: true },
  },
  cont_reinforced: {
    id: 'cont_reinforced', cat: 'Containment', name: 'Reinforced Barriers', cost: 1400, time: 60,
    desc: 'Unlocks Tier 2 Reinforced Barrier fencing.',
  },
  cont_heavy: {
    id: 'cont_heavy', cat: 'Containment', name: 'Heavy Containment', cost: 3200, time: 110, requires: ['cont_reinforced'],
    desc: 'Unlocks Tier 3 Heavy Containment fencing for dangerous assets.',
  },
  cont_insulated: {
    id: 'cont_insulated', cat: 'Containment', name: 'Insulated Containment', cost: 5200, time: 140, requires: ['cont_heavy'],
    requiresEvidence: { speciesId: 'voltari', note: 'Requires observed electrical interference (house a Voltari Archling).' },
    desc: 'Non-conductive lattice barriers immune to energivore interference. Unlocks Tier 4 fencing and Energy Conduits.',
  },
  fac_tower: {
    id: 'fac_tower', cat: 'Facilities', name: 'Observation Tower', cost: 1800, time: 70,
    desc: 'Unlocks the Observation Tower with a greatly extended viewing radius.',
  },
  fac_gift: {
    id: 'fac_gift', cat: 'Facilities', name: 'Curio Licensing', cost: 1600, time: 60,
    desc: 'Unlocks the Curio Emporium gift shop.',
  },
  fac_marketing: {
    id: 'fac_marketing', cat: 'Facilities', name: 'Outreach Campaign', cost: 2400, time: 90,
    desc: 'Regional publicity. Guest arrival rate increases by 40%.',
    effect: { guestMult: 1.4 },
  },
  ops_field2: {
    id: 'ops_field2', cat: 'Field Operations', name: 'Field Operations II', cost: 2500, time: 100,
    desc: 'Extended survey range. Unlocks acquisition of Tier 2 species.',
  },
  ops_field3: {
    id: 'ops_field3', cat: 'Field Operations', name: 'Field Operations III', cost: 6000, time: 160, requires: ['ops_field2'],
    desc: 'Deep-zone recovery teams. Unlocks acquisition of Tier 3 and Anomalous species.',
  },
};

export const RESEARCH_LIST = Object.values(RESEARCH);
export const RESEARCH_CATS = ['Biology', 'Environment', 'Containment', 'Facilities', 'Field Operations'];
