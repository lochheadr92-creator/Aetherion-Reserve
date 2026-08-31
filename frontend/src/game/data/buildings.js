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
  security_post: {
    id: 'security_post', name: 'Rapid Response Post', cat: 'operations', w: 2, h: 2, cost: 3000, upkeep: 45,
    color: '#241c22', light: '#FF5C7A', desc: 'Houses a rapid-response team that automatically recaptures escaped organisms. One active recovery per post; ◈250 per dispatch.',
    needsPath: true, security: true,
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

  // ---- Creature experiences (cat: experience) ----
  obs_deck: {
    id: 'obs_deck', name: 'Elevated Observation Deck', cat: 'experience', w: 2, h: 2, cost: 3600, upkeep: 28,
    color: '#1c2a3a', light: '#4DB6FF', desc: 'A raised deck that sees over vegetation and terrain. Great sightlines into deep habitats.',
    viewRadius: 13, elevated: true, needsPath: true,
  },
  glass_tunnel: {
    id: 'glass_tunnel', name: 'Glass Habitat Tunnel', cat: 'experience', w: 3, h: 1, cost: 4200, upkeep: 35,
    color: '#182e34', light: '#2DE2E6', desc: 'A reinforced glass passage skirting an enclosure. Short range but breathtaking close-up encounters.',
    viewRadius: 6, closeup: 1.6, needsPath: true,
  },
  underwater_dome: {
    id: 'underwater_dome', name: 'Underwater Viewing Dome', cat: 'experience', w: 2, h: 2, cost: 5200, upkeep: 40,
    color: '#122836', light: '#4DB6FF', desc: 'A submerged dome. Swimming and submerged organisms become the star of the show instead of invisible.',
    viewRadius: 9, aquaBonus: true, needsPath: true,
  },
  nocturnal_house: {
    id: 'nocturnal_house', name: 'Nocturnal Viewing House', cat: 'experience', w: 2, h: 2, cost: 4400, upkeep: 38,
    color: '#1e1a30', light: '#b98ae0', desc: 'Light-controlled viewing hall. At night — and for glowing or nocturnal species — visibility is outstanding.',
    viewRadius: 9, nightBonus: true, needsPath: true,
  },
  predator_gallery: {
    id: 'predator_gallery', name: 'Apex Predator Gallery', cat: 'experience', w: 3, h: 2, cost: 6800, upkeep: 55,
    color: '#2a1a22', light: '#FF5C7A', desc: 'Armoured viewing complex built for dangerous assets. Thrill seekers pay attention when danger is close.',
    viewRadius: 11, dangerBonus: true, needsPath: true,
  },
  nursery_view: {
    id: 'nursery_view', name: 'Nursery Viewing Centre', cat: 'experience', w: 2, h: 2, cost: 3400, upkeep: 26,
    color: '#1a2c26', light: '#6EF3C5', desc: 'Soft-glass gallery tuned for juveniles. Families melt when the young are playing.',
    viewRadius: 9, juvenileBonus: true, needsPath: true,
  },
  safari_post: {
    id: 'safari_post', name: 'Ranger Safari Post', cat: 'experience', w: 2, h: 2, cost: 5600, upkeep: 45,
    color: '#2a2618', light: '#F2C14E', desc: 'Guided ranger overlooks with long-range optics. Sells guided tour slots.',
    viewRadius: 15, elevated: true, sells: 'tour', price: 22, needsPath: true,
  },
  encounter_stage: {
    id: 'encounter_stage', name: 'Creature Encounter Stage', cat: 'experience', w: 3, h: 2, cost: 5000, upkeep: 42,
    color: '#241f30', light: '#8AA4FF', desc: 'Scheduled keeper presentations. Value scales with the creatures living nearby.',
    sells: 'show', price: 18, needsPath: true,
  },
  keeper_tour: {
    id: 'keeper_tour', name: 'Keeper Tour Office', cat: 'experience', w: 2, h: 1, cost: 2600, upkeep: 20,
    color: '#20261e', light: '#3EE28A', desc: 'Behind-the-scenes tours led by your field staff. Requires at least one staff member.',
    sells: 'tour', price: 20, needsStaff: true, needsPath: true,
  },
  hatchery_view: {
    id: 'hatchery_view', name: 'Hatchery Tour Annex', cat: 'experience', w: 2, h: 2, cost: 3800, upkeep: 30,
    color: '#1c2a2e', light: '#6EF3C5', desc: 'Guests tour the husbandry wing. Far more valuable once your breeding program produces offspring.',
    sells: 'tour', price: 16, scaling: 'births', needsPath: true,
  },

  // ---- Major attractions (cat: major) ----
  holo_theatre: {
    id: 'holo_theatre', name: 'Holographic Creature Theatre', cat: 'major', w: 3, h: 3, cost: 9500, upkeep: 90,
    color: '#1c1c34', light: '#8AA4FF', desc: 'Life-size holographic recreations of your living collection. Value scales with species diversity.',
    sells: 'attraction', price: 30, scaling: 'diversity', needsPath: true, needsPower: true,
  },
  xeno_dome: {
    id: 'xeno_dome', name: 'Xenobiology Planetarium', cat: 'major', w: 3, h: 3, cost: 11000, upkeep: 105,
    color: '#141c30', light: '#4DB6FF', desc: 'An immersive dome about the recovery zones. Value scales with confirmed discoveries.',
    sells: 'attraction', price: 34, scaling: 'discoveries', needsPath: true, needsPower: true,
  },
  evo_museum: {
    id: 'evo_museum', name: 'Creature Evolution Museum', cat: 'major', w: 3, h: 2, cost: 8200, upkeep: 70,
    color: '#242030', light: '#b98ae0', desc: 'Exhibits built from your research archive. Value scales with confirmed discoveries.',
    sells: 'attraction', price: 26, scaling: 'discoveries', needsPath: true,
  },
  relic_gallery: {
    id: 'relic_gallery', name: 'Expedition Relic Gallery', cat: 'major', w: 2, h: 2, cost: 6400, upkeep: 55,
    color: '#2a2418', light: '#F2C14E', desc: 'Artifacts recovered by your survey teams. Value scales with completed expeditions.',
    sells: 'attraction', price: 22, scaling: 'expeditions', needsPath: true,
  },
  vr_pavilion: {
    id: 'vr_pavilion', name: 'VR Creature Experience', cat: 'major', w: 2, h: 2, cost: 7800, upkeep: 75,
    color: '#161f2e', light: '#2DE2E6', desc: 'Full-immersion recreations of your habitats. Value scales with species diversity.',
    sells: 'attraction', price: 28, scaling: 'diversity', needsPath: true, needsPower: true,
  },
  night_lodge: {
    id: 'night_lodge', name: 'Night Safari Lodge', cat: 'major', w: 3, h: 2, cost: 8800, upkeep: 80,
    color: '#1a1830', light: '#b98ae0', desc: 'A luxury after-dark viewing lodge. Comes alive at night, when nocturnal and glowing species are active.',
    sells: 'tour', price: 30, viewRadius: 12, nightBonus: true, needsPath: true,
  },

  // ---- Guest amenities (cat: amenity) ----
  restaurant: {
    id: 'restaurant', name: 'Verdant Table Restaurant', cat: 'amenity', w: 3, h: 2, cost: 5200, upkeep: 48,
    color: '#26301e', light: '#3EE28A', desc: 'A full-service themed restaurant. Premium meals; guests linger and spend.',
    sells: 'food', price: 32, luxury: 1, needsPath: true,
  },
  food_court: {
    id: 'food_court', name: 'Quick-Service Food Hub', cat: 'amenity', w: 3, h: 2, cost: 3800, upkeep: 40,
    color: '#2a2418', light: '#F2C14E', desc: 'High-throughput dining that keeps queues short across a busy park.',
    sells: 'food', price: 16, needsPath: true,
  },
  sky_dining: {
    id: 'sky_dining', name: 'Skyline Dining Observatory', cat: 'amenity', w: 2, h: 2, cost: 8600, upkeep: 85,
    color: '#1c2434', light: '#4DB6FF', desc: 'Fine dining above the canopy with habitat views. Luxury tourists expect nothing less.',
    sells: 'food', price: 55, luxury: 2, viewRadius: 10, elevated: true, needsPath: true,
  },
  megastore: {
    id: 'megastore', name: 'Souvenir Megastore', cat: 'amenity', w: 3, h: 2, cost: 5600, upkeep: 50,
    color: '#282034', light: '#8AA4FF', desc: 'The flagship merchandise hall. Bigger baskets, bigger margins.',
    sells: 'gift', price: 42, luxury: 1, needsPath: true,
  },
  merch_stall: {
    id: 'merch_stall', name: 'Creature Merch Stall', cat: 'amenity', w: 1, h: 1, cost: 1400, upkeep: 14,
    color: '#262030', light: '#b98ae0', desc: 'A themed cart selling plushes of whatever lives nearby. Cheap to scatter across the park.',
    sells: 'gift', price: 15, needsPath: true,
  },
  hotel: {
    id: 'hotel', name: 'Aetherion Resort Hotel', cat: 'amenity', w: 3, h: 3, cost: 12000, upkeep: 110,
    color: '#202634', light: '#8AA4FF', desc: 'On-site lodging. Guests who check in stay far longer — and keep spending.',
    sells: 'lodging', price: 60, needsPath: true,
  },
  rest_area: {
    id: 'rest_area', name: 'Family Rest Area', cat: 'amenity', w: 2, h: 2, cost: 1600, upkeep: 12,
    color: '#222a22', light: '#6EF3C5', desc: 'Shaded seating, water fountains and calm. Restores tired guests for free.',
    sells: 'rest', price: 0, needsPath: true,
  },
  medical_station: {
    id: 'medical_station', name: 'Guest Medical Station', cat: 'amenity', w: 2, h: 1, cost: 2400, upkeep: 25,
    color: '#2a2026', light: '#FF5C7A', desc: 'First aid and calm-down care. Guests feel safer, and panicked guests recover faster nearby.',
    medical: true, needsPath: true,
  },
  info_center: {
    id: 'info_center', name: 'Information Centre', cat: 'amenity', w: 2, h: 1, cost: 1800, upkeep: 15,
    color: '#1e2630', light: '#4DB6FF', desc: 'Maps, schedules and guidance. Guests waste less time and complain less about wayfinding.',
    sells: 'info', price: 0, needsPath: true,
  },
  picnic_area: {
    id: 'picnic_area', name: 'Scenic Picnic Grove', cat: 'amenity', w: 2, h: 2, cost: 1500, upkeep: 10,
    color: '#242e1e', light: '#3EE28A', desc: 'Budget dining in a pleasant spot. Far more popular with a great view of the exhibits.',
    sells: 'food', price: 8, scenic: true, needsPath: true,
  },
  premium_lounge: {
    id: 'premium_lounge', name: 'Premium Viewing Lounge', cat: 'amenity', w: 2, h: 2, cost: 7200, upkeep: 68,
    color: '#2a2430', light: '#F2C14E', desc: 'Members-only glass lounge over a habitat. Luxury tourists pay handsomely for privacy and a view.',
    sells: 'lounge', price: 45, luxury: 2, viewRadius: 9, needsPath: true,
  },

  // ---- Transport (cat: transport) — stations pair up; an elevated car shuttles
  // guests between them, rising safely over fences/enclosures mid-route ----
  tram_station: {
    id: 'tram_station', name: 'Aether Tram Station', cat: 'transport', w: 2, h: 2, cost: 4800, upkeep: 45,
    color: '#16262e', light: '#2DE2E6', desc: 'Build two or more: an elevated tram shuttles guests between stations, soaring safely over enclosures.',
    transport: 'tram', fee: 12, needsPath: true,
  },
  gondola_station: {
    id: 'gondola_station', name: 'Observation Gondola Station', cat: 'transport', w: 2, h: 2, cost: 6200, upkeep: 55,
    color: '#221e30', light: '#b98ae0', desc: 'A slow scenic gondola. Riders get spectacular views of every habitat along the route.',
    transport: 'gondola', fee: 20, needsPath: true,
  },
  rail_station: {
    id: 'rail_station', name: 'Magnetic Rail Terminus', cat: 'transport', w: 3, h: 2, cost: 7500, upkeep: 70,
    color: '#1e2418', light: '#F2C14E', desc: 'High-speed park rail. Moves crowds fast across large parks. Requires power.',
    transport: 'rail', fee: 15, needsPath: true, needsPower: true,
  },
};

export const BUILDING_LIST = Object.values(BUILDINGS);
