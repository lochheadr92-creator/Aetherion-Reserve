// ---- Data-driven building definitions ----

export const BUILDINGS = {
  admin: {
    id: 'admin', name: 'Administration Nexus', cat: 'operations', w: 3, h: 3, cost: 5000, upkeep: 40,
    color: '#16202e', light: '#8AA4FF', desc: 'Core facility command. Required to operate the park.',
    needsPath: true, unique: true,
  },
  lab: {
    id: 'lab', name: 'Research Laboratory', cat: 'operations', w: 2, h: 2, cost: 3500, upkeep: 60,
    color: '#14242a', light: '#2DE2E6', desc: 'Enables research projects. Additional labs speed research by 40%.',
    needsPath: true,
  },
  power: {
    id: 'power', name: 'Power Relay', cat: 'operations', w: 2, h: 2, cost: 2000, upkeep: 50,
    color: '#1d1d28', light: '#F2C14E', desc: 'Provides power within a 14-tile radius. Electrified systems require coverage.',
    powerRadius: 14,
  },
  feeder_forage: {
    id: 'feeder_forage', name: 'Forage Dispenser', cat: 'habitat', w: 1, h: 1, cost: 450, upkeep: 12,
    color: '#1e2a1e', light: '#3EE28A', desc: 'Dispenses plant matter for grazers, browsers and scavengers.', station: 'forage', inEnclosure: true,
  },
  feeder_meat: {
    id: 'feeder_meat', name: 'Carcass Feeder', cat: 'habitat', w: 1, h: 1, cost: 700, upkeep: 30,
    color: '#2a1e20', light: '#FF5C7A', desc: 'Restocked protein for predators and pack hunters.', station: 'meat', inEnclosure: true,
  },
  feeder_mineral: {
    id: 'feeder_mineral', name: 'Mineral Trough', cat: 'habitat', w: 1, h: 1, cost: 600, upkeep: 15,
    color: '#20242e', light: '#9ab0d0', desc: 'Crushed crystalline feed for lithovores.', station: 'mineral', inEnclosure: true,
  },
  feeder_fungal: {
    id: 'feeder_fungal', name: 'Spore Silo', cat: 'habitat', w: 1, h: 1, cost: 650, upkeep: 18,
    color: '#261e2e', light: '#b98ae0', desc: 'Cultivated fungal biomass feed.', station: 'fungal', inEnclosure: true,
  },
  feeder_energy: {
    id: 'feeder_energy', name: 'Energy Conduit', cat: 'habitat', w: 1, h: 1, cost: 1200, upkeep: 45,
    color: '#1a2432', light: '#2DE2E6', desc: 'A sacrificial charge column for energivorous organisms. Requires power.', station: 'energy', inEnclosure: true, needsPower: true, locked: 'cont_insulated',
  },
  shelter: {
    id: 'shelter', name: 'Habitat Shelter', cat: 'habitat', w: 2, h: 2, cost: 800, upkeep: 8,
    color: '#242a24', light: '#6EF3C5', desc: 'Weather-proof refuge. Some species require shelter to rest.', shelter: true, inEnclosure: true,
  },
  viewing: {
    id: 'viewing', name: 'Viewing Platform', cat: 'guest', w: 2, h: 2, cost: 1200, upkeep: 10,
    color: '#1c2432', light: '#4DB6FF', desc: 'Guests observe nearby creatures. Visibility depends on distance and cover.',
    viewRadius: 9, needsPath: true,
  },
  tower: {
    id: 'tower', name: 'Observation Tower', cat: 'guest', w: 2, h: 2, cost: 2800, upkeep: 25,
    color: '#1c2836', light: '#4DB6FF', desc: 'Elevated observation with a much larger viewing radius.',
    viewRadius: 15, needsPath: true, locked: 'fac_tower',
  },
  food_stall: {
    id: 'food_stall', name: 'Ration Kiosk', cat: 'guest', w: 2, h: 2, cost: 1500, upkeep: 20,
    color: '#2a2418', light: '#F2C14E', desc: 'Sells meals to guests.', sells: 'food', price: 14, needsPath: true,
  },
  drink_stall: {
    id: 'drink_stall', name: 'Hydration Point', cat: 'guest', w: 1, h: 1, cost: 900, upkeep: 12,
    color: '#182430', light: '#4DB6FF', desc: 'Sells drinks to guests.', sells: 'drink', price: 8, needsPath: true,
  },
  restroom: {
    id: 'restroom', name: 'Comfort Unit', cat: 'guest', w: 1, h: 1, cost: 800, upkeep: 10,
    color: '#222630', light: '#B7C4D6', desc: 'Guest restroom facilities.', sells: 'restroom', price: 0, needsPath: true,
  },
  gift_shop: {
    id: 'gift_shop', name: 'Curio Emporium', cat: 'guest', w: 2, h: 2, cost: 2200, upkeep: 25,
    color: '#282030', light: '#8AA4FF', desc: 'High-margin creature-themed merchandise.', sells: 'gift', price: 26, needsPath: true, locked: 'fac_gift',
  },
};

export const BUILDING_LIST = Object.values(BUILDINGS);
