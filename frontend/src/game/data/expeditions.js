// ---- Data-driven expedition survey zones ----
// duration in ticks (1800 ticks = 1 cycle). Stages: transit -> survey -> recovery -> return.

export const EXPEDITION_ZONES = {
  mirefen: {
    id: 'mirefen', name: 'Mirefen Delta', code: 'ZONE M-2',
    desc: 'A drowned river delta of reed islands and black water. Aquatic and filter-feeding signatures detected.',
    cost: 4000, duration: 1400, risk: 1,
    color: '#4DB6FF',
    speciesPool: ['mirefin', 'silttitan', 'lumen', 'veyra'],
    doubleFindChance: 0.35, artifactChance: 0.5, artifact: [600, 1600],
  },
  shardpeak: {
    id: 'shardpeak', name: 'Shardpeak Ascent', code: 'ZONE S-7',
    desc: 'Fractured crystalline highlands. Thin air, mineral outcrops, and climbing organisms that avoid the lowlands.',
    cost: 6000, duration: 1800, risk: 2,
    color: '#8AA4FF',
    speciesPool: ['shardling', 'hollowcrest', 'karrgan'],
    doubleFindChance: 0.3, artifactChance: 0.6, artifact: [900, 2200],
  },
  umbral: {
    id: 'umbral', name: 'Umbral Grove', code: 'ZONE U-4',
    desc: 'Old-growth canopy so dense it is night at noon. Nocturnal and shade-bound signatures everywhere.',
    cost: 5000, duration: 1600, risk: 2,
    color: '#6EF3C5',
    speciesPool: ['umbra', 'vantha', 'mosswarden', 'thornback', 'skitter'],
    doubleFindChance: 0.4, artifactChance: 0.45, artifact: [700, 1800],
  },
  ember: {
    id: 'ember', name: 'Ember Wastes', code: 'ZONE E-9',
    desc: 'A scorched basin of ash dunes and charge storms. High-risk recovery: anomalous and energivorous assets.',
    cost: 8000, duration: 2200, risk: 3,
    color: '#FF5C7A',
    speciesPool: ['emberoot', 'rhoak', 'voltari'],
    doubleFindChance: 0.25, artifactChance: 0.7, artifact: [1500, 3400],
  },
};

export const ZONE_LIST = Object.values(EXPEDITION_ZONES);

// stage fractions of total duration
export const STAGES = [
  { key: 'transit', name: 'Transit', frac: 0.2 },
  { key: 'survey', name: 'Survey', frac: 0.35 },
  { key: 'recovery', name: 'Recovery', frac: 0.3 },
  { key: 'return', name: 'Return', frac: 0.15 },
];
