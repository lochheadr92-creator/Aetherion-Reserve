// ---- Data-driven species definitions. Adding a species = adding an entry here. ----
// hiddenAttrs are enforced at the data layer via knowledge.js accessors: the UI can
// never read a hidden value until the simulation has actually discovered it.

export const ATTR_LABELS = {
  diet: 'Diet', terrain: 'Terrain Preference', water: 'Water Requirement',
  elevation: 'Elevation Preference', forest: 'Canopy Preference', social: 'Social Structure',
  shelter: 'Shelter Need', containment: 'Containment Requirement',
};

export const DIET_STATIONS = {
  forage: { key: 'forage', name: 'Forage Dispenser' },
  meat: { key: 'meat', name: 'Carcass Feeder' },
  mineral: { key: 'mineral', name: 'Mineral Trough' },
  fungal: { key: 'fungal', name: 'Spore Silo' },
  energy: { key: 'energy', name: 'Energy Conduit' },
};

const S = {};

S.veyra = {
  id: 'veyra', name: 'Veyra Strider', code: 'AR-001 "LONGSTRIDE"', family: 'Plains Walker', tier: 1,
  rarity: 'Common', cost: 3200, appeal: 22, danger: 1, size: 1.35, bodyType: 'tall',
  colors: { body: '#4a6a5c', accent: '#8fd0b0', glow: null },
  diet: { type: 'Grazer', station: 'forage' },
  social: { type: 'Herd', min: 3, ideal: 5, max: 9 },
  env: {
    spacePerHead: 26, minArea: 80,
    terrain: { prefer: [0, 1], avoid: [4, 9], preferMin: 0.45 },
    forest: { min: 0, max: 0.3 }, water: { drink: true, aquaticMin: 0.08 },
    elevation: { min: 0, max: 3 }, shelter: false,
  },
  compat: { likes: ['skitter', 'thornback'], hostile: [], preyOf: ['vantha', 'karrgan'] },
  containment: { tier: 1, estimate: 1 },
  hiddenAttrs: ['water', 'social'],
  traits: ['Skittish', 'Roamer'],
  lore: 'Recovered from the tallgrass rifts of Survey Zone Theta. Moves in slow, deliberate columns and watches the horizon with all four eyes.',
  question: 'How much open roaming space can I afford?',
};

S.skitter = {
  id: 'skitter', name: 'Skitterling', code: 'AR-002 "MOTE"', family: 'Scuttler', tier: 1,
  rarity: 'Common', cost: 900, appeal: 8, danger: 1, size: 0.55, bodyType: 'insect',
  colors: { body: '#7a6a4a', accent: '#e0c080', glow: null },
  diet: { type: 'Scavenger', station: 'forage' },
  social: { type: 'Colony', min: 4, ideal: 8, max: 16 },
  env: {
    spacePerHead: 4, minArea: 30,
    terrain: { prefer: [0, 2, 3], avoid: [7], preferMin: 0.4 },
    forest: { min: 0, max: 0.6 }, water: { drink: true, aquaticMin: 0 },
    elevation: { min: 0, max: 5 }, shelter: false,
  },
  compat: { likes: ['veyra', 'silttitan'], hostile: [], preyOf: ['mirefin', 'vantha'] },
  containment: { tier: 1, estimate: 1 },
  hiddenAttrs: [],
  traits: ['Curious', 'Food-Motivated'],
  lore: 'The first species successfully contained by the Aetherion program. Fully documented. A dependable, cheerful starter organism.',
  question: 'A safe first resident \u2014 fully documented biology.',
};

S.thornback = {
  id: 'thornback', name: 'Thornback Bramblen', code: 'AR-003 "HEDGE"', family: 'Browser', tier: 1,
  rarity: 'Common', cost: 2600, appeal: 16, danger: 1, size: 1.0, bodyType: 'quad',
  colors: { body: '#5c4a33', accent: '#a08a50', glow: null },
  diet: { type: 'Browser', station: 'forage' },
  social: { type: 'Small Group', min: 2, ideal: 3, max: 6 },
  env: {
    spacePerHead: 14, minArea: 50,
    terrain: { prefer: [0, 1, 8], avoid: [3], preferMin: 0.35 },
    forest: { min: 0.25, max: 0.8 }, water: { drink: true, aquaticMin: 0 },
    elevation: { min: 0, max: 4 }, shelter: false,
  },
  compat: { likes: ['veyra'], hostile: [], preyOf: ['karrgan'] },
  containment: { tier: 1, estimate: 1 },
  hiddenAttrs: ['forest'],
  traits: ['Placid', 'Grazes Vegetation'],
  lore: 'Armoured in interlocking bark-like plates. Field teams report it vanishes among trees despite its bulk.',
  question: 'How much canopy does it actually need?',
};

S.hollowcrest = {
  id: 'hollowcrest', name: 'Hollowcrest', code: 'AR-011 "SPIRE"', family: 'Crag Dweller', tier: 2,
  rarity: 'Uncommon', cost: 7800, appeal: 38, danger: 2, size: 1.2, bodyType: 'winged',
  colors: { body: '#4a5568', accent: '#9ab0d0', glow: null },
  diet: { type: 'Mineral Feeder', station: 'mineral' },
  social: { type: 'Solitary', min: 1, ideal: 1, max: 2 },
  env: {
    spacePerHead: 30, minArea: 60,
    terrain: { prefer: [4, 5], avoid: [7, 6], preferMin: 0.45 },
    forest: { min: 0, max: 0.15 }, water: { drink: true, aquaticMin: 0 },
    elevation: { min: 4, max: 8 }, shelter: true,
  },
  compat: { likes: [], hostile: ['rhoak'], preyOf: [] },
  containment: { tier: 2, estimate: 1 },
  hiddenAttrs: ['elevation', 'terrain', 'diet', 'containment'],
  traits: ['Aloof', 'Climber'],
  lore: 'Signals from Zone Sigma led survey drones to a wind-carved mesa. Something up there was singing through hollow bone crests.',
  question: 'How do I build enough elevation while keeping guests able to see it?',
};

S.mirefin = {
  id: 'mirefin', name: 'Mirefin Lurker', code: 'AR-012 "UNDERTOW"', family: 'Ambush Predator', tier: 2,
  rarity: 'Uncommon', cost: 9500, appeal: 44, danger: 3, size: 1.3, bodyType: 'amphib',
  colors: { body: '#2a4a44', accent: '#4ac0a8', glow: null },
  diet: { type: 'Predator', station: 'meat' },
  social: { type: 'Solitary', min: 1, ideal: 1, max: 3 },
  env: {
    spacePerHead: 22, minArea: 60,
    terrain: { prefer: [7, 6], avoid: [3, 4], preferMin: 0.3 },
    forest: { min: 0.1, max: 0.7 }, water: { drink: true, aquaticMin: 0.25, needsDeep: true },
    elevation: { min: 0, max: 2 }, shelter: false,
  },
  compat: { likes: [], hostile: ['karrgan'], prey: ['skitter'], preyOf: [] },
  containment: { tier: 2, estimate: 2 },
  hiddenAttrs: ['water', 'terrain'],
  traits: ['Patient', 'Ambusher'],
  lore: 'Only its eyes break the waterline. Recovery teams lost two drones learning that the mud itself was watching.',
  question: 'How do I give it hunting water without destroying guest visibility?',
};

S.silttitan = {
  id: 'silttitan', name: 'Bulwark Silt Titan', code: 'AR-013 "RAMPART"', family: 'Wetland Giant', tier: 2,
  rarity: 'Uncommon', cost: 11000, appeal: 52, danger: 2, size: 2.0, bodyType: 'quad',
  colors: { body: '#4a4238', accent: '#8a7a5a', glow: null },
  diet: { type: 'Grazer', station: 'forage' },
  social: { type: 'Pair Bonded', min: 2, ideal: 2, max: 4 },
  env: {
    spacePerHead: 40, minArea: 100,
    terrain: { prefer: [6, 7], avoid: [4, 5], preferMin: 0.4 },
    forest: { min: 0, max: 0.4 }, water: { drink: true, aquaticMin: 0.18 },
    elevation: { min: 0, max: 2 }, shelter: false,
  },
  compat: { likes: ['skitter', 'lumen'], hostile: [], preyOf: [] },
  containment: { tier: 2, estimate: 2 },
  hiddenAttrs: ['terrain', 'social'],
  traits: ['Gentle', 'Wallower'],
  lore: 'A walking levee. Wetland ecosystems in Zone Theta appear to have been engineered by generations of Titans compacting silt.',
  question: 'Can I afford the wetland it needs to wallow?',
};

S.shardling = {
  id: 'shardling', name: 'Prisma Shardling', code: 'AR-014 "FACET"', family: 'Lithomorph', tier: 2,
  rarity: 'Uncommon', cost: 6400, appeal: 30, danger: 1, size: 0.7, bodyType: 'crystal',
  colors: { body: '#5a7a9c', accent: '#a0d8f0', glow: '#8AA4FF' },
  diet: { type: 'Mineral Feeder', station: 'mineral' },
  social: { type: 'Small Group', min: 2, ideal: 4, max: 8 },
  env: {
    spacePerHead: 8, minArea: 40,
    terrain: { prefer: [4, 5, 10], avoid: [7, 6], preferMin: 0.5 },
    forest: { min: 0, max: 0.3 }, water: { drink: false, aquaticMin: 0 },
    elevation: { min: 1, max: 8 }, shelter: false,
  },
  compat: { likes: ['mosswarden'], hostile: [], preyOf: [] },
  containment: { tier: 1, estimate: 1 },
  hiddenAttrs: ['diet'],
  traits: ['Resonant', 'Slow'],
  lore: 'It hums at 47Hz when content. Lab staff have started calling the containment wing "the choir".',
  question: 'What does a creature made of crystal actually eat?',
};

S.mosswarden = {
  id: 'mosswarden', name: 'Moss Warden', code: 'AR-015 "KEEPER"', family: 'Symbiote Colossus', tier: 2,
  rarity: 'Rare', cost: 13500, appeal: 58, danger: 2, size: 1.8, bodyType: 'blob',
  colors: { body: '#3a5a40', accent: '#6ef3c5', glow: '#6EF3C5' },
  diet: { type: 'Fungal Feeder', station: 'fungal' },
  social: { type: 'Solitary', min: 1, ideal: 1, max: 2 },
  env: {
    spacePerHead: 35, minArea: 80,
    terrain: { prefer: [8, 9, 1], avoid: [3], preferMin: 0.35 },
    forest: { min: 0.3, max: 0.9 }, water: { drink: true, aquaticMin: 0 },
    elevation: { min: 0, max: 4 }, shelter: false,
  },
  compat: { likes: [], hostile: [], requires: 'shardling', preyOf: [] },
  containment: { tier: 2, estimate: 2 },
  hiddenAttrs: ['diet', 'social'],
  traits: ['Symbiotic', 'Ancient'],
  lore: 'Refuses to thrive in isolation. Something in its biology is waiting for a partner we have not identified.',
  question: 'Which second species does it need to survive?',
};

S.rhoak = {
  id: 'rhoak', name: 'Ashmane Rhoak', code: 'AR-016 "WARDEN"', family: 'Territorial Strider', tier: 2,
  rarity: 'Uncommon', cost: 8200, appeal: 34, danger: 3, size: 1.4, bodyType: 'quad',
  colors: { body: '#5c3a33', accent: '#e08a5a', glow: null },
  diet: { type: 'Browser', station: 'forage' },
  social: { type: 'Solitary Territorial', min: 1, ideal: 1, max: 1 },
  env: {
    spacePerHead: 50, minArea: 90,
    terrain: { prefer: [2, 3, 0], avoid: [7], preferMin: 0.35 },
    forest: { min: 0.1, max: 0.5 }, water: { drink: true, aquaticMin: 0 },
    elevation: { min: 0, max: 5 }, shelter: false,
  },
  compat: { likes: ['veyra'], hostile: ['karrgan', 'vantha', 'hollowcrest'], preyOf: [] },
  containment: { tier: 2, estimate: 2 },
  hiddenAttrs: ['social', 'terrain'],
  traits: ['Territorial', 'Dominant'],
  lore: 'Marks its claim by scorching bark with abrasive mane quills. Two Rhoak in one valley means one Rhoak by morning.',
  question: 'How do I divide usable territory?',
};

S.vantha = {
  id: 'vantha', name: 'Vantha Duskrunner', code: 'AR-021 "CHORUS"', family: 'Pack Hunter', tier: 3,
  rarity: 'Rare', cost: 16500, appeal: 62, danger: 4, size: 1.1, bodyType: 'quad',
  colors: { body: '#3a3a4a', accent: '#8a6adf', glow: null },
  diet: { type: 'Pack Hunter', station: 'meat' },
  social: { type: 'Pack', min: 3, ideal: 5, max: 8 },
  env: {
    spacePerHead: 20, minArea: 90,
    terrain: { prefer: [0, 2, 5], avoid: [7], preferMin: 0.35 },
    forest: { min: 0.15, max: 0.6 }, water: { drink: true, aquaticMin: 0 },
    elevation: { min: 0, max: 6 }, shelter: false,
  },
  compat: { likes: [], hostile: ['rhoak'], prey: ['veyra', 'skitter'], preyOf: [] },
  containment: { tier: 3, estimate: 2 },
  hiddenAttrs: ['containment', 'social', 'diet'],
  traits: ['Coordinated', 'Tests Barriers'],
  specials: ['testsFences'],
  lore: 'They take turns pressing the fence line \u2014 never the same spot twice. Security suspects they are mapping it.',
  question: 'Is the containment I estimated actually enough?',
};

S.karrgan = {
  id: 'karrgan', name: 'Karrgan Maw', code: 'AR-022 "BULWARK-EATER"', family: 'Apex Predator', tier: 3,
  rarity: 'Rare', cost: 24000, appeal: 85, danger: 5, size: 1.9, bodyType: 'quad',
  colors: { body: '#4a3038', accent: '#e05a6a', glow: null },
  diet: { type: 'Predator', station: 'meat' },
  social: { type: 'Solitary', min: 1, ideal: 1, max: 1 },
  env: {
    spacePerHead: 60, minArea: 120,
    terrain: { prefer: [2, 4, 5], avoid: [], preferMin: 0.3 },
    forest: { min: 0, max: 0.5 }, water: { drink: true, aquaticMin: 0 },
    elevation: { min: 0, max: 6 }, shelter: true,
  },
  compat: { likes: [], hostile: ['rhoak', 'mirefin', 'vantha'], prey: ['veyra', 'thornback'], preyOf: [] },
  containment: { tier: 3, estimate: 3 },
  hiddenAttrs: ['shelter'],
  traits: ['Apex', 'Armoured'],
  lore: 'The recovery convoy carrying AR-022 required three escort vehicles. Two came back.',
  question: 'The flagship attraction \u2014 can I keep everyone safe?',
};

S.lumen = {
  id: 'lumen', name: 'Lumen Drifter', code: 'AR-023 "LANTERN"', family: 'Aerial Filter Feeder', tier: 3,
  rarity: 'Rare', cost: 14000, appeal: 70, danger: 1, size: 1.0, bodyType: 'float',
  colors: { body: '#3a5a7a', accent: '#2DE2E6', glow: '#2DE2E6' },
  diet: { type: 'Filter Feeder', station: null, feedsFromWater: true },
  social: { type: 'Herd', min: 3, ideal: 6, max: 12 },
  env: {
    spacePerHead: 12, minArea: 60,
    terrain: { prefer: [7, 8, 10], avoid: [3], preferMin: 0.3 },
    forest: { min: 0, max: 0.4 }, water: { drink: false, aquaticMin: 0.15 },
    elevation: { min: 0, max: 3 }, shelter: false,
  },
  compat: { likes: ['silttitan'], hostile: [], preyOf: [] },
  containment: { tier: 1, estimate: 1 },
  hiddenAttrs: ['diet', 'water'],
  traits: ['Fragile', 'Bioluminescent'],
  lore: 'They drift like slow lanterns over still water, sieving something from the air we cannot yet measure.',
  question: 'It refuses every feeder we install \u2014 what sustains it?',
};

S.umbra = {
  id: 'umbra', name: 'Umbra Veilwing', code: 'AR-024 "ECLIPSE"', family: 'Shade Stalker', tier: 3,
  rarity: 'Rare', cost: 17500, appeal: 66, danger: 3, size: 1.15, bodyType: 'winged',
  colors: { body: '#2a2438', accent: '#8AA4FF', glow: '#8AA4FF' },
  diet: { type: 'Predator', station: 'meat' },
  social: { type: 'Pair Bonded', min: 2, ideal: 2, max: 3 },
  env: {
    spacePerHead: 25, minArea: 70,
    terrain: { prefer: [8, 9, 1], avoid: [3], preferMin: 0.3 },
    forest: { min: 0.45, max: 1.0 }, water: { drink: true, aquaticMin: 0 },
    elevation: { min: 0, max: 5 }, shelter: true,
  },
  compat: { likes: [], hostile: [], prey: ['skitter'], preyOf: [] },
  containment: { tier: 2, estimate: 2 },
  hiddenAttrs: ['forest', 'shelter'],
  traits: ['Light-Averse', 'Silent'],
  lore: 'Cameras in its recovery crate recorded nothing. Not darkness \u2014 nothing. It dislikes being seen.',
  question: 'Can I build a shaded exhibit guests can still enjoy?',
};

S.voltari = {
  id: 'voltari', name: 'Voltari Archling', code: 'AR-025 "CAPACITOR"', family: 'Anomalous Energivore', tier: 3,
  rarity: 'Anomalous', cost: 21000, appeal: 78, danger: 4, size: 0.9, bodyType: 'serpent',
  colors: { body: '#2a3a55', accent: '#2DE2E6', glow: '#2DE2E6' },
  diet: { type: 'Energy Feeder', station: 'energy' },
  social: { type: 'Solitary', min: 1, ideal: 1, max: 2 },
  env: {
    spacePerHead: 20, minArea: 60,
    terrain: { prefer: [10, 4, 5], avoid: [7, 6], preferMin: 0.35 },
    forest: { min: 0, max: 0.3 }, water: { drink: false, aquaticMin: 0 },
    elevation: { min: 0, max: 8 }, shelter: false,
  },
  compat: { likes: ['shardling'], hostile: [], preyOf: [] },
  containment: { tier: 4, estimate: 2 },
  hiddenAttrs: ['diet', 'containment', 'terrain'],
  traits: ['Anomalous', 'Power Interference'],
  specials: ['powerInterference'],
  lore: 'Every instrument within thirty metres of AR-025 reads wrong. It is not hostile. It is hungry.',
  question: 'How do I contain something that eats the fence current?',
};

S.emberoot = {
  id: 'emberoot', name: 'Emberoot Gorger', code: 'AR-026 "TILLER"', family: 'Fungal Colossus', tier: 3,
  rarity: 'Rare', cost: 15500, appeal: 60, danger: 2, size: 1.7, bodyType: 'blob',
  colors: { body: '#4a2a35', accent: '#e0785a', glow: '#b98ae0' },
  diet: { type: 'Fungal Feeder', station: 'fungal' },
  social: { type: 'Small Group', min: 2, ideal: 3, max: 5 },
  env: {
    spacePerHead: 30, minArea: 80,
    terrain: { prefer: [9, 8, 6], avoid: [3, 4], preferMin: 0.4 },
    forest: { min: 0.2, max: 0.8 }, water: { drink: true, aquaticMin: 0 },
    elevation: { min: 0, max: 3 }, shelter: false,
  },
  compat: { likes: ['mosswarden'], hostile: [], preyOf: [] },
  containment: { tier: 2, estimate: 2 },
  hiddenAttrs: ['terrain', 'diet'],
  traits: ['Terraformer', 'Slow'],
  lore: 'Wherever it settles, the soil changes. Whether that is digestion or gardening is an open research question.',
  question: 'Do I paint the world it wants, or let it repaint mine?',
};

export const SPECIES = S;
export const SPECIES_LIST = Object.values(S);
export const speciesById = (id) => S[id];
