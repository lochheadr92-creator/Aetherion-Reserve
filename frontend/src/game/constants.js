// ---- Aetherion Reserve: core constants & palette (shared by renderer + UI) ----

export const MAP_SIZE = 72;
export const TILE_W = 64;
export const TILE_H = 32;
export const H_STEP = 10; // px per height level
export const MAX_H = 8;
export const TICK_MS = 100; // fixed sim timestep
export const TICKS_PER_DAY = 1800; // 3 min @1x

export const MATERIALS = {
  0: { id: 0, key: 'grass', name: 'Grassland', color: '#22352a', hi: '#2e4636', cost: 15, open: true },
  1: { id: 1, key: 'denseGrass', name: 'Dense Grass', color: '#1d3d2b', hi: '#28503a', cost: 18, open: true },
  2: { id: 2, key: 'soil', name: 'Soil', color: '#33291f', hi: '#413528', cost: 12, open: true },
  3: { id: 3, key: 'sand', name: 'Sand', color: '#4a4130', hi: '#5a5040', cost: 15, open: true },
  4: { id: 4, key: 'rock', name: 'Rock', color: '#333a46', hi: '#434f60', cost: 22, open: false },
  5: { id: 5, key: 'gravel', name: 'Gravel', color: '#2c3138', hi: '#3a4149', cost: 18, open: false },
  6: { id: 6, key: 'mud', name: 'Mud', color: '#2f2620', hi: '#3d3129', cost: 15, open: true },
  7: { id: 7, key: 'wetland', name: 'Wetland', color: '#1a3436', hi: '#234548', cost: 25, open: true },
  8: { id: 8, key: 'moss', name: 'Mossbed', color: '#213a2e', hi: '#2b4c3c', cost: 25, open: true },
  9: { id: 9, key: 'fungal', name: 'Fungal Ground', color: '#332440', hi: '#443156', cost: 40, open: true, locked: 'env_flora' },
  10: { id: 10, key: 'alien', name: 'Aetheric Soil', color: '#20304a', hi: '#2c4066', cost: 45, open: true, locked: 'env_flora' },
};

export const VEG = {
  0: null,
  1: { id: 1, key: 'tallGrass', name: 'Tall Grass', cost: 20, color: '#2a5a3c', h: 8, forest: 0, cover: 0.15 },
  2: { id: 2, key: 'shrub', name: 'Shrub Cluster', cost: 35, color: '#1e4a35', h: 12, forest: 0.3, cover: 0.35 },
  3: { id: 3, key: 'smallTree', name: 'Small Tree', cost: 60, color: '#2a6a4a', h: 26, forest: 0.7, cover: 0.6 },
  4: { id: 4, key: 'largeTree', name: 'Canopy Tree', cost: 110, color: '#1f5c40', h: 38, forest: 1.0, cover: 0.85 },
  5: { id: 5, key: 'wetlandPlant', name: 'Reed Bloom', cost: 40, color: '#2a6a5c', h: 14, forest: 0.15, cover: 0.3 },
  6: { id: 6, key: 'fungalGrowth', name: 'Spore Pillar', cost: 80, color: '#7a4a9a', h: 22, forest: 0.4, cover: 0.4, glow: '#b98ae0', locked: 'env_flora' },
  7: { id: 7, key: 'alienFlora', name: 'Aether Frond', cost: 120, color: '#3a6aa0', h: 28, forest: 0.5, cover: 0.5, glow: '#6ef3c5', locked: 'env_flora' },
};

export const FENCES = {
  1: { tier: 1, key: 'basic', name: 'Basic Barrier', cost: 50, hp: 100, security: 1, color: '#4a5a70' },
  2: { tier: 2, key: 'reinforced', name: 'Reinforced Barrier', cost: 130, hp: 220, security: 2, color: '#6a7f9c', locked: 'cont_reinforced' },
  3: { tier: 3, key: 'heavy', name: 'Heavy Containment', cost: 280, hp: 400, security: 3, color: '#8a9cb8', locked: 'cont_heavy' },
  4: { tier: 4, key: 'insulated', name: 'Insulated Containment', cost: 450, hp: 420, security: 4, color: '#6ef3c5', locked: 'cont_insulated' },
};

export const COSTS = {
  raise: 40, lower: 40, flatten: 30, smooth: 25,
  waterShallow: 60, waterDeep: 110, waterRemove: 30,
  path: 25, pathRemove: 5, gate: 150, vegRemove: 5,
};

export const PALETTE = {
  void: '#05070B',
  waterShallow: '#0e3a46', waterDeep: '#072030', waterEdge: '#2DE2E6',
  path: '#232e3c', pathEdge: '#31435c',
  gridLine: 'rgba(36,56,79,0.4)',
  hover: '#8AA4FF', selected: '#2DE2E6',
  valid: '#3EE28A', validFill: 'rgba(62,226,138,0.18)',
  invalid: '#FF4D6D', invalidFill: 'rgba(255,77,109,0.2)',
  blueprint: '#4DB6FF', blueprintFill: 'rgba(77,182,255,0.14)',
  building: '#121A24', buildingEdge: '#2a3c55', buildingLight: '#8AA4FF',
  guest: '#b7c4d6',
};

export const dayName = (day) => `Cycle ${day}`;
export const fmtMoney = (n) => `${n < 0 ? '-' : ''}\u25C8${Math.abs(Math.round(n)).toLocaleString()}`;
