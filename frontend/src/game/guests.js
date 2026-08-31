// ---- Guests: arrival, path movement, needs, viewing visibility, spending, opinions ----
import { MAP_SIZE, VEG } from './constants';
import { idx, inMap, rnd, hasResearch, logCause } from './state';
import { BUILDINGS } from './data/buildings';
import { speciesById } from './data/species';
import { getSpeciesView } from './knowledge';
import { earn } from './economy';
import { visibilityWeatherMult, spawnWeatherMult, getDayPhase, isStorm } from './weather';
import { wasteNear } from './staff';
import { synergyScore } from './attractions';
import { activeEvents, hottestEvent } from './events';
import { geneAppealMult } from './genetics';

// 7 visitor archetypes with distinct interests: what they seek, what they pay
const ARCHETYPES = [
  { key: 'family', name: 'Family', color: '#e0c080', spendMult: 1.0, wantsSafety: true, eventAff: 0.35, dangerAff: 0.1, rarityAff: 0.3, luxAff: 0.15, lovesJuveniles: true },
  { key: 'researcher', name: 'Researcher', color: '#6ef3c5', spendMult: 0.8, lovesUnknown: true, eventAff: 0.4, dangerAff: 0.3, rarityAff: 0.6, luxAff: 0.1 },
  { key: 'thrill', name: 'Thrill Seeker', color: '#ff8a7a', spendMult: 1.1, lovesDanger: true, eventAff: 0.8, dangerAff: 0.95, rarityAff: 0.4, luxAff: 0.2 },
  { key: 'nature', name: 'Conservationist', color: '#8fd0b0', spendMult: 0.9, lovesWelfare: true, eventAff: 0.4, dangerAff: 0.15, rarityAff: 0.5, luxAff: 0.15 },
  { key: 'photographer', name: 'Photographer', color: '#8AA4FF', spendMult: 1.0, lovesMorphs: true, eventAff: 0.65, dangerAff: 0.4, rarityAff: 0.8, luxAff: 0.2 },
  { key: 'luxury', name: 'Luxury Tourist', color: '#F2C14E', spendMult: 1.6, lovesLuxury: true, eventAff: 0.4, dangerAff: 0.3, rarityAff: 0.6, luxAff: 0.95 },
  { key: 'enthusiast', name: 'Creature Enthusiast', color: '#b98ae0', spendMult: 1.15, lovesRarity: true, eventAff: 0.6, dangerAff: 0.5, rarityAff: 0.95, luxAff: 0.25 },
];
const archOf = (g) => ARCHETYPES.find((a) => a.key === g.archetype) || ARCHETYPES[0];

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function pathBFS(state, sx, sy, targetSet, maxNodes = 2500) {
  // BFS across path tiles from (sx,sy) to any tile in targetSet (Set of idx)
  const start = idx(sx, sy);
  if (targetSet.has(start)) return [];
  const prev = new Map([[start, null]]);
  const q = [[sx, sy]];
  let nodes = 0;
  while (q.length && nodes++ < maxNodes) {
    const [x, y] = q.shift();
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy;
      if (!inMap(nx, ny)) continue;
      const ni = idx(nx, ny);
      if (prev.has(ni) || !state.paths[ni]) continue;
      prev.set(ni, idx(x, y));
      if (targetSet.has(ni)) {
        const path = [];
        let cur = ni;
        while (cur !== null && cur !== start) { path.unshift({ x: cur % MAP_SIZE, y: Math.floor(cur / MAP_SIZE) }); cur = prev.get(cur); }
        return path;
      }
      q.push([nx, ny]);
    }
  }
  return null;
}

function pathTilesAdjacentTo(state, b) {
  const set = new Set();
  for (let dy = -1; dy <= b.h; dy++) for (let dx = -1; dx <= b.w; dx++) {
    const tx = b.x + dx, ty = b.y + dy;
    if (inMap(tx, ty) && state.paths[idx(tx, ty)]) set.add(idx(tx, ty));
  }
  return set;
}

export function spawnGuests(state) {
  const hasAdmin = state.buildings.some((b) => b.type === 'admin');
  if (!hasAdmin || state.creatures.length === 0) return;
  // emergencies close the gates — nobody walks into a containment breach
  if (state.creatures.some((c) => c.escaped)) return;
  const cap = 110;
  if (state.guests.length >= cap) return;
  const appealSum = state.creatures.reduce((s, c) => {
    const base = speciesById(c.speciesId).appeal;
    return s + (c.juvenile ? base * 1.4 : base);
  }, 0);
  let rate = 0.25 + Math.min(1.2, appealSum / 150) + state.rating.overall * 0.8;
  if (hasResearch(state, 'fac_marketing')) rate *= 1.4;
  // park buzz: recent dramatic events spread by word of mouth
  rate *= 1 + (state.stats.buzz || 0) * 0.6;
  // weather and time of day govern arrivals (storms nearly stop them)
  let wm = spawnWeatherMult(state);
  const night = getDayPhase(state.tick).phase === 'night';
  const nightTour = night && state.policies?.nightTours && !isStorm(state);
  if (nightTour) wm = Math.max(wm, 0.85); // tours keep the gate busy after dark
  rate *= wm;
  const price = nightTour ? Math.round(state.ticketPrice * 1.75) : state.ticketPrice;
  // ticket price sensitivity (night crowds accept the premium)
  rate *= Math.max(0.3, 1.4 - state.ticketPrice / 60);
  const n = Math.floor(rate) + (rnd() < rate % 1 ? 1 : 0);
  for (let k = 0; k < n && state.guests.length < cap; k++) {
    const arch = ARCHETYPES[Math.floor(rnd() * ARCHETYPES.length)];
    earn(state, price, nightTour ? 'tours' : 'tickets', null);
    state.stats.guestsTotal++;
    state.guests.push({
      id: state.nextId++, x: state.entrance.x + 0.5, y: state.entrance.y + 0.5,
      path: [], target: null, dwell: 0, archetype: arch.key, nightTour: !!nightTour,
      needs: { hunger: 0.6 + rnd() * 0.4, thirst: 0.6 + rnd() * 0.4, restroom: 0.7 + rnd() * 0.3, fun: 0.2 },
      satisfaction: 0.6, opinions: [], ticksInPark: 0, leaving: false, seen: 0,
    });
  }
}

export function tickGuestMovement(state, g) {
  g.ticksInPark++;
  if (g.riding) return; // aboard a transport car — position managed by transport.js
  if (g.path && g.path.length) {
    const t = g.path[0];
    const dx = t.x + 0.5 - g.x, dy = t.y + 0.5 - g.y;
    const d = Math.hypot(dx, dy);
    const spd = g.panic ? 0.11 : 0.06; // stampede speed during emergencies
    if (d < spd) { g.x = t.x + 0.5; g.y = t.y + 0.5; g.path.shift(); }
    else { g.x += (dx / d) * spd; g.y += (dy / d) * spd; }
  } else if (g.dwell > 0) {
    g.dwell--;
    if (g.dwell === 0 && g.target) arriveAtTarget(state, g);
  }
}

function addOpinion(state, g, text, positive) {
  g.opinions.unshift(text);
  if (g.opinions.length > 4) g.opinions.length = 4;
  g.satisfaction = Math.max(0, Math.min(1, g.satisfaction + (positive ? 0.08 : -0.1)));
  // sample opinions into a park-wide feed
  state._guestFeed = state._guestFeed || [];
  state._guestFeed.unshift({ id: state.nextId++, text, positive, arch: g.archetype, tick: state.tick });
  if (state._guestFeed.length > 12) state._guestFeed.length = 12;
}

function visibilityFrom(state, b, def) {
  // returns [{creature, vis}] for creatures within radius, occlusion by vegetation cover along the line
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  const R = def.viewRadius;
  const out = [];
  for (const c of state.creatures) {
    // cloaked organisms are invisible to guests without thermal optics
    if (c.cloaked && !hasResearch(state, 'sec_thermal')) continue;
    const d = Math.hypot(c.x - cx, c.y - cy);
    if (d > R) continue;
    let block = 0;
    const steps = 5;
    for (let s = 1; s < steps; s++) {
      const px = Math.floor(cx + (c.x - cx) * (s / steps));
      const py = Math.floor(cy + (c.y - cy) * (s / steps));
      if (!inMap(px, py)) continue;
      const v = VEG[state.veg[idx(px, py)]];
      if (v) block += v.cover * 0.35;
      // creatures behind high terrain relative to platform
      if (state.heights[idx(px, py)] >= state.heights[idx(Math.floor(cx), Math.floor(cy))] + 3) block += 0.3;
    }
    let vis = Math.max(0, (1 - d / R)) * Math.max(0.05, 1 - block);
    if (def.id === 'tower' || def.elevated) vis = Math.max(vis, (1 - d / R) * 0.5); // elevation sees over cover
    const ct = idx(Math.floor(c.x), Math.floor(c.y));
    if (state.water[ct] === 2) vis *= def.aquaBonus ? 1.3 : 0.55; // domes turn submersion into the show
    // weather + day-night: storms/darkness reduce visibility, but at night
    // bioluminescent species glow through the dark
    let wm = visibilityWeatherMult(state);
    const csp = speciesById(c.speciesId);
    const night = getDayPhase(state.tick).phase === 'night';
    if (night && csp.colors.glow && !isStorm(state)) wm = Math.max(wm, 1.2);
    if (night && def.nightBonus) wm = Math.max(wm, csp.activity === 'nocturnal' || csp.colors.glow ? 1.45 : 1.1);
    if (def.closeup && d <= R * 0.6) vis = Math.min(1, vis * def.closeup); // glass tunnels: intimate range
    vis *= wm;
    if (vis > 0.08) out.push({ creature: c, vis });
  }
  return out;
}

export function platformVisibilityReport(state, b) {
  const def = BUILDINGS[b.type];
  if (!def.viewRadius) return null;
  return visibilityFrom(state, b, def);
}

function arriveAtTarget(state, g) {
  const t = g.target;
  g.target = null;
  if (!t) return;
  const b = state.buildings.find((bb) => bb.id === t.id);
  if (!b) return;
  const def = BUILDINGS[b.type];
  const arch = archOf(g);

  // transport stations: wait on the platform for the next car
  if (def.transport) {
    g.waitStation = b.id;
    g._waitTicks = 0;
    return;
  }

  if (def.viewRadius) {
    const seen = visibilityFrom(state, b, def);
    const score = seen.reduce((s, e) => {
      const sp = speciesById(e.creature.speciesId);
      let base = sp.appeal * geneAppealMult(e.creature);
      if (e.creature.juvenile) base *= def.juvenileBonus ? 1.9 : 1.4;
      if (def.dangerBonus && sp.danger >= 4) base *= 1.5;
      return s + base * e.vis;
    }, 0);
    const night = getDayPhase(state.tick).phase === 'night';
    if (score > 12) {
      g.needs.fun = Math.min(1, g.needs.fun + 0.35 + score / 300);
      g.seen += seen.length;
      const best = seen.sort((a, b2) => b2.vis - a.vis)[0];
      const sp = speciesById(best.creature.speciesId);
      const view = getSpeciesView(state, sp.id);
      const glowSeen = seen.some((e) => speciesById(e.creature.speciesId).colors.glow || e.creature.genes?.morph);
      const juvSeen = seen.find((e) => e.creature.juvenile);
      const morphSeen = seen.find((e) => e.creature.genes?.morph);
      const dangerSeen = seen.find((e) => speciesById(e.creature.speciesId).danger >= 4);
      // live event at this exhibit? front-row drama
      const nearbyEvent = activeEvents(state).find((e) => Math.hypot(e.x - (b.x + b.w / 2), e.y - (b.y + b.h / 2)) <= e.radius + def.viewRadius);
      if (nearbyEvent) {
        g.needs.fun = Math.min(1, g.needs.fun + 0.2 + nearbyEvent.magnitude * 0.2);
        g.satisfaction = Math.min(1, g.satisfaction + 0.08 + nearbyEvent.magnitude * 0.06);
        addOpinion(state, g, nearbyEvent.type === 'rivalry'
          ? `Two apex titans facing off RIGHT THERE. Unbelievable.`
          : `I was here for the ${nearbyEvent.name.toLowerCase()} — what a moment!`, true);
      } else if (morphSeen && arch.lovesMorphs) {
        const msp = speciesById(morphSeen.creature.speciesId);
        addOpinion(state, g, `I photographed the rare ${msp.name} morph — worth the whole trip alone.`, true);
        g.satisfaction = Math.min(1, g.satisfaction + 0.14);
        state.stats.buzz = Math.min(1, (state.stats.buzz || 0) + 0.08); // photos travel fast
      } else if (morphSeen) {
        addOpinion(state, g, `That ${speciesById(morphSeen.creature.speciesId).name} has colours I have never seen anywhere.`, true);
        g.satisfaction = Math.min(1, g.satisfaction + 0.07);
      } else if (night && glowSeen) {
        addOpinion(state, g, `The ${sp.name} glowing in the dark is unforgettable.`, true);
        g.satisfaction = Math.min(1, g.satisfaction + (g.nightTour ? 0.09 : 0.05));
      } else if (g.nightTour && !glowSeen) {
        addOpinion(state, g, 'I paid a night tour premium and nothing here even glows...', false);
      } else if (juvSeen && arch.lovesJuveniles) {
        addOpinion(state, g, `The baby ${speciesById(juvSeen.creature.speciesId).name} is adorable!`, true);
        g.satisfaction = Math.min(1, g.satisfaction + 0.08);
      } else if (dangerSeen && arch.lovesDanger) {
        addOpinion(state, g, `The ${speciesById(dangerSeen.creature.speciesId).name} looked right at me. Worth every credit.`, true);
        g.satisfaction = Math.min(1, g.satisfaction + 0.07);
      } else if (arch.lovesUnknown && view.unknown.length) {
        addOpinion(state, g, `I observed an unclassified organism — ${sp.name}. Incredible.`, true);
        g.satisfaction = Math.min(1, g.satisfaction + 0.06);
      } else if (arch.lovesWelfare && best.creature.welfare >= 0.75) {
        addOpinion(state, g, `You can tell the ${sp.name} is genuinely thriving here. This place cares.`, true);
        g.satisfaction = Math.min(1, g.satisfaction + 0.06);
      } else if (arch.lovesRarity && sp.tier >= 3) {
        addOpinion(state, g, `A ${sp.name} in captivity — tier ${sp.tier}! My checklist is complete.`, true);
        g.satisfaction = Math.min(1, g.satisfaction + 0.07);
      } else {
        addOpinion(state, g, `Amazing view of the ${sp.name} habitat!`, true);
      }
      // dirty exhibits sour the experience — keepers should clear biowaste
      if (wasteNear(state, best.creature.x, best.creature.y, 7) >= 3 && rnd() < 0.5) {
        addOpinion(state, g, 'That exhibit really needs cleaning.', false);
      }
    } else if (seen.length > 0) {
      addOpinion(state, g, 'I could barely glimpse anything through the cover.', false);
      g.needs.fun = Math.min(1, g.needs.fun + 0.08);
    } else if (g.nightTour) {
      addOpinion(state, g, `A premium night tour and the ${def.name} shows nothing glowing. Refund, please.`, false);
    } else {
      addOpinion(state, g, `Couldn't see a single creature from the ${def.name}.`, false);
    }
    // premium venues with a view also sell (lounge / sky dining handled below)
    if (!def.sells) return;
  }

  const syn = def.sells && ['attraction', 'show', 'tour', 'lounge', 'food', 'gift'].includes(def.sells) ? synergyScore(state, b) : 1;
  switch (def.sells) {
    case 'food':
      g.needs.hunger = 1;
      earn(state, def.price * archMult(g) * (def.luxury ? syn : 1), 'food', null);
      if (def.luxury && arch.lovesLuxury) { addOpinion(state, g, `${def.name} — finally, standards worthy of the ticket price.`, true); }
      else if (def.scenic && syn > 1.2) { addOpinion(state, g, 'Lunch with a view of the exhibits. Perfect.', true); }
      break;
    case 'drink': g.needs.thirst = 1; earn(state, def.price * archMult(g), 'drink', null); break;
    case 'restroom': g.needs.restroom = 1; break;
    case 'gift': {
      earn(state, def.price * archMult(g) * syn * 0.9, 'gift', null);
      g.needs.fun = Math.min(1, g.needs.fun + 0.1);
      if (syn > 1.25 && rnd() < 0.4) addOpinion(state, g, 'They sell plushes of the creature RIGHT THERE. Took three.', true);
      else if (rnd() < 0.25) addOpinion(state, g, 'The curio shop is delightful.', true);
      break;
    }
    case 'attraction':
    case 'show':
    case 'tour': {
      if (def.needsStaff && !(state.staff || []).length) { addOpinion(state, g, `${def.name} is closed — no staff to run it.`, false); break; }
      const night = getDayPhase(state.tick).phase === 'night';
      if (def.nightBonus && !night) { g.needs.fun = Math.min(1, g.needs.fun + 0.05); break; } // day visit to a night venue is a dud
      earn(state, def.price * archMult(g) * syn, def.sells === 'tour' ? 'tours' : 'attractions', null);
      g.needs.fun = Math.min(1, g.needs.fun + 0.25 + (syn - 1) * 0.3);
      g.satisfaction = Math.min(1, g.satisfaction + 0.03 + Math.max(0, syn - 1) * 0.08);
      if (syn >= 1.4 && rnd() < 0.5) addOpinion(state, g, `${def.name} is world-class. Everyone should see this.`, true);
      else if (syn <= 0.7 && rnd() < 0.5) addOpinion(state, g, `${def.name} felt empty. It needs something alive around it.`, false);
      break;
    }
    case 'lounge': {
      earn(state, def.price * archMult(g) * syn, 'attractions', null);
      g.needs.fun = Math.min(1, g.needs.fun + 0.3);
      g.needs.hunger = Math.min(1, g.needs.hunger + 0.4);
      if (arch.lovesLuxury) { g.satisfaction = Math.min(1, g.satisfaction + 0.12); addOpinion(state, g, 'A private lounge above the habitat. THIS is how you watch titans.', true); }
      break;
    }
    case 'lodging': {
      if (!g._lodged) {
        g._lodged = true;
        earn(state, def.price * archMult(g), 'lodging', null);
        g.ticksInPark = Math.max(0, g.ticksInPark - 3000); // checked in — the visit continues
        g.needs.restroom = 1;
        g.satisfaction = Math.min(1, g.satisfaction + 0.06);
        if (rnd() < 0.4) addOpinion(state, g, 'We booked a room — staying for the night safari!', true);
      }
      break;
    }
    case 'rest': {
      g.needs.restroom = Math.min(1, g.needs.restroom + 0.6);
      g.needs.fun = Math.min(1, g.needs.fun + 0.08);
      g.satisfaction = Math.min(1, g.satisfaction + 0.03);
      break;
    }
    case 'info': {
      if (!g._informed) {
        g._informed = true;
        g._noRoute = true; // guided guests stop complaining about wayfinding
        g.satisfaction = Math.min(1, g.satisfaction + 0.04);
      }
      break;
    }
    default: break;
  }
}

function archMult(g) { return ARCHETYPES.find((a) => a.key === g.archetype)?.spendMult || 1; }

export function decideGuest(state, g) {
  if (g.riding || g.waitStation) return; // on the platform or aboard a car
  // panic check runs even mid-route: dangerous escapes trigger an immediate stampede
  if (!g.panic) {
    const parkWide = state.creatures.some((c) => c.escaped && speciesById(c.speciesId).danger >= 3);
    const nearby = !parkWide && state.creatures.some((c) => c.escaped && Math.hypot(c.x - g.x, c.y - g.y) <= 14);
    if (parkWide || nearby) {
      g.panic = true; g.fleeing = true; g.leaving = true;
      g.path = []; g.dwell = 0; g.target = null;
      addOpinion(state, g, parkWide
        ? 'RUN! Something dangerous is loose in the park!'
        : 'There is something loose out here! This place is not safe!', false);
      g.satisfaction = Math.max(0, g.satisfaction - 0.25);
    }
  }
  if (g.path.length || g.dwell > 0) return;
  const { x, y } = { x: Math.floor(g.x), y: Math.floor(g.y) };
  // storms send guests home
  if (isStorm(state) && !g.leaving && rnd() < 0.3) {
    g.leaving = true;
    addOpinion(state, g, 'This storm is miserable \u2014 we are heading home.', false);
  }
  if (g.leaving) {
    const exitSet = new Set([idx(state.entrance.x, state.entrance.y)]);
    const p = pathBFS(state, x, y, exitSet);
    if (p) { g.path = p; g.exiting = true; return; }
    g.despawn = true; return;
  }
  // needs decay handled in needs tick; choose most pressing
  const arch = archOf(g);
  const wants = [];
  if (g.needs.hunger < 0.35) wants.push(['food', 'hunger']);
  if (g.needs.thirst < 0.35) wants.push(['drink', 'thirst']);
  if (g.needs.restroom < 0.3) wants.push(['restroom', 'restroom']);
  let targetB = null;
  if (wants.length) {
    const [sell, needKey] = wants[0];
    const options = state.buildings.filter((b) => BUILDINGS[b.type].sells === sell);
    if (!options.length) {
      if (!g[`_c_${needKey}`]) {
        g[`_c_${needKey}`] = true;
        addOpinion(state, g, sell === 'restroom' ? 'There are no restrooms anywhere!' : `Nowhere to get ${sell === 'food' ? 'a meal' : 'a drink'}...`, false);
      }
      if (g.needs[needKey] < 0.1) { g.leaving = true; return; }
    } else {
      // luxury tourists seek premium venues; families favour affordable ones
      const weight = (b) => {
        const d = BUILDINGS[b.type];
        let w = 1;
        if (arch.lovesLuxury) w += (d.luxury || 0) * 2;
        else if (arch.key === 'family' && (d.price || 0) <= 16) w += 0.8;
        return w + rnd();
      };
      targetB = options.sort((a, b) => weight(b) - weight(a))[0];
    }
  }
  if (!targetB) {
    // LIVE EVENT CHASE: dramatic moments pull guests across the whole park
    const hot = hottestEvent(state);
    if (hot && hot.magnitude >= 0.45 && rnd() < arch.eventAff && !g._chasedEvent) {
      const viewers = state.buildings.filter((b) => BUILDINGS[b.type].viewRadius);
      let best = null, bestD = Infinity;
      for (const b of viewers) {
        const d = Math.hypot(b.x + b.w / 2 - hot.x, b.y + b.h / 2 - hot.y);
        if (d <= hot.radius + BUILDINGS[b.type].viewRadius && d < bestD) { bestD = d; best = b; }
      }
      if (best) { targetB = best; g._chasedEvent = true; }
    }
  }
  if (!targetB && g.needs.fun < 0.85) {
    // interest-driven destination: platforms, attractions, transport — weighted by archetype
    const night = getDayPhase(state.tick).phase === 'night';
    const options = state.buildings.filter((b) => {
      const d = BUILDINGS[b.type];
      return d.viewRadius || ['attraction', 'show', 'tour', 'lounge', 'lodging'].includes(d.sells) || d.transport;
    });
    if (options.length) {
      const weight = (b) => {
        const d = BUILDINGS[b.type];
        let w = 1;
        if (d.viewRadius) w += 0.6;
        if (d.dangerBonus) w += arch.dangerAff * 1.4;
        if (d.juvenileBonus && arch.lovesJuveniles) w += 1.2;
        if (d.nightBonus) w += night ? 1.2 : -0.8;
        if (d.sells === 'lounge' || (d.luxury || 0) >= 2) w += arch.luxAff * 2;
        if (['attraction', 'show', 'tour'].includes(d.sells)) w += 0.5 + arch.rarityAff * 0.4;
        if (d.sells === 'lodging') w += g.ticksInPark > 2500 && !g._lodged ? 1.0 : -1.2;
        if (d.transport) w += 0.7; // rides are broadly popular
        if (arch.lovesMorphs && d.viewRadius) {
          // photographers hunt rare morphs specifically
          const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
          if (state.creatures.some((c) => c.genes?.morph && !c.escaped && Math.hypot(c.x - cx, c.y - cy) <= d.viewRadius)) w += 2.2;
        }
        return w + rnd() * 0.8;
      };
      targetB = options.sort((a, b) => weight(b) - weight(a))[0];
    } else if (g.ticksInPark > 1500 || g.needs.fun >= 0.85) {
      g.leaving = true;
      return;
    }
  } else if (!targetB && (g.ticksInPark > 1500 || g.needs.fun >= 0.85)) {
    g.leaving = true;
    return;
  }
  if (targetB) {
    const set = pathTilesAdjacentTo(state, targetB);
    if (set.size) {
      const p = pathBFS(state, x, y, set);
      if (p) { g.path = p; g.target = { id: targetB.id }; g.dwell = 0; g._dwellNext = true; return; }
    }
    if (!g._noRoute) { g._noRoute = true; addOpinion(state, g, 'Half this facility is not even connected by paths.', false); }
  }
  // idle wander on paths
  const neigh = DIRS.map(([dx, dy]) => ({ x: x + dx, y: y + dy })).filter((t) => inMap(t.x, t.y) && state.paths[idx(t.x, t.y)]);
  if (neigh.length) g.path = [neigh[Math.floor(rnd() * neigh.length)]];
}

export function guestNeedsTick(state, g) {
  g.needs.hunger = Math.max(0, g.needs.hunger - 0.006);
  g.needs.thirst = Math.max(0, g.needs.thirst - 0.008);
  g.needs.restroom = Math.max(0, g.needs.restroom - 0.005);
  g.needs.fun = Math.max(0, g.needs.fun - 0.003);
  // arriving at a target sets dwell
  if (g._dwellNext && !g.path.length && g.target) { g.dwell = 25; g._dwellNext = false; }
  // rolling satisfaction pressure from unmet needs
  const unmet = Math.min(g.needs.hunger, g.needs.thirst, g.needs.restroom);
  if (unmet < 0.15) g.satisfaction = Math.max(0, g.satisfaction - 0.01);
  // ready to chase the next dramatic event once the park quiets down
  if (g._chasedEvent && !activeEvents(state).length) g._chasedEvent = false;
}

export function cullGuests(state) {
  const before = state.guests.length;
  state.guests = state.guests.filter((g) => {
    if (g.riding) return true; // never cull mid-ride
    const atExit = g.exiting && !g.path.length;
    if (atExit || g.despawn || g.ticksInPark > 6000) {
      // record satisfaction
      state.stats.guestSat = state.stats.guestSat * 0.9 + g.satisfaction * 0.1;
      return false;
    }
    return true;
  });
  return before - state.guests.length;
}
