// ---- Elevated guest transport ----
// Same-type stations pair up automatically. A shuttle car ping-pongs between the
// pair on an elevated guideway that rises safely OVER fences and enclosures
// mid-route and lowers to the platform at each station. Guests board at a
// station, are hidden from the walking sim while riding, pay a fee, and gain
// satisfaction from every habitat the route soars over.
import { idx, inMap, rnd, logCause } from './state';
import { BUILDINGS } from './data/buildings';
import { speciesById } from './data/species';
import { earn } from './economy';

const CAR_SPEED = { tram: 0.008, gondola: 0.005, rail: 0.012 };
const CAR_COLOR = { tram: '#2DE2E6', gondola: '#b98ae0', rail: '#F2C14E' };
const CAR_CAP = { tram: 6, gondola: 4, rail: 10 };
const STATION_DWELL = 45; // ticks the car waits at a platform

function stationCenter(b) { return { x: b.x + Math.floor(b.w / 2), y: b.y + Math.floor(b.h / 2) }; }

// pair each station with its nearest same-type partner (dedup by unordered key)
function computePairs(state) {
  const stations = state.buildings.filter((b) => BUILDINGS[b.type]?.transport);
  const pairs = new Map();
  for (const s0 of stations) {
    const type = BUILDINGS[s0.type].transport;
    let best = null, bestD = Infinity;
    for (const s1 of stations) {
      if (s1.id === s0.id || BUILDINGS[s1.type].transport !== type) continue;
      const d = Math.hypot(s1.x - s0.x, s1.y - s0.y);
      if (d < bestD) { bestD = d; best = s1; }
    }
    if (best && bestD >= 6) {
      const key = `${Math.min(s0.id, best.id)}:${Math.max(s0.id, best.id)}`;
      if (!pairs.has(key)) pairs.set(key, { key, type, s0, s1: best });
    }
  }
  return pairs;
}

function ensureCars(state) {
  if (!state.transport) state.transport = { cars: [] };
  const pairs = computePairs(state);
  // drop cars whose stations no longer exist / unpaired
  state.transport.cars = state.transport.cars.filter((car) => {
    if (pairs.has(car.key)) return true;
    // strand riders gracefully back at their boarding station
    for (const gid of car.riders || []) {
      const g = state.guests.find((q) => q.id === gid);
      if (g) g.riding = null;
    }
    return false;
  });
  for (const [key, p] of pairs) {
    if (state.transport.cars.some((c) => c.key === key)) continue;
    const a = stationCenter(p.s0), b = stationCenter(p.s1);
    state.transport.cars.push({
      id: state.nextId++, key, type: p.type,
      aId: p.s0.id, bId: p.s1.id, a, b,
      t: 0, dir: 1, dwell: STATION_DWELL, riders: [],
      color: CAR_COLOR[p.type], fee: BUILDINGS[p.s0.type].fee || 10,
    });
  }
}

// creatures visible along the route — the whole point of a scenic ride
function routeSights(state, car) {
  const seen = new Set();
  let appeal = 0;
  let bestName = null, bestAppeal = 0;
  for (let s = 0; s <= 5; s++) {
    const px = car.a.x + (car.b.x - car.a.x) * (s / 5);
    const py = car.a.y + (car.b.y - car.a.y) * (s / 5);
    for (const c of state.creatures) {
      if (seen.has(c.id) || c.cloaked) continue;
      if (Math.hypot(c.x - px, c.y - py) <= 7) {
        seen.add(c.id);
        const sp = speciesById(c.speciesId);
        appeal += sp.appeal;
        if (sp.appeal > bestAppeal) { bestAppeal = sp.appeal; bestName = sp.name; }
      }
    }
  }
  return { count: seen.size, appeal, bestName };
}

function boardGuests(state, car, stationId) {
  const cap = CAR_CAP[car.type];
  for (const g of state.guests) {
    if (car.riders.length >= cap) break;
    if (g.riding || g.waitStation !== stationId || g.panic) continue;
    g.riding = car.id;
    g.waitStation = null;
    g.path = []; g.target = null; g.dwell = 0;
    car.riders.push(g.id);
    earn(state, car.fee, 'transport', null);
  }
}

function disembark(state, car, at) {
  if (!car.riders.length) return;
  const sights = routeSights(state, car);
  // find a path tile near the destination station to set guests down on
  let spot = { x: at.x, y: at.y };
  outer:
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    const tx = at.x + dx, ty = at.y + dy;
    if (inMap(tx, ty) && state.paths[idx(tx, ty)]) { spot = { x: tx, y: ty }; break outer; }
  }
  for (const gid of car.riders) {
    const g = state.guests.find((q) => q.id === gid);
    if (!g) continue;
    g.riding = null;
    g.x = spot.x + 0.5; g.y = spot.y + 0.5;
    g.path = [];
    // ride reward: fun scales with what the route soared over
    const fun = Math.min(0.5, 0.18 + sights.appeal / 250);
    g.needs.fun = Math.min(1, g.needs.fun + fun);
    g.seen += sights.count;
    if (sights.count > 0 && rnd() < 0.5) {
      g.opinions.unshift(sights.bestName
        ? `The ${car.type} soared right over the ${sights.bestName} habitat!`
        : 'What a view from up there!');
      if (g.opinions.length > 4) g.opinions.length = 4;
      g.satisfaction = Math.min(1, g.satisfaction + 0.08);
    } else if (sights.count === 0 && rnd() < 0.4) {
      g.opinions.unshift(`A ${car.type} ride over... nothing. Route it over the exhibits!`);
      if (g.opinions.length > 4) g.opinions.length = 4;
      g.satisfaction = Math.max(0, g.satisfaction - 0.04);
    }
  }
  state.stats.riders = (state.stats.riders || 0) + car.riders.length;
  car.riders = [];
}

export function transportTick(state) {
  if (!state.transport) state.transport = { cars: [] };
  if (state.tick % 50 === 0 || state._occDirty) ensureCars(state);
  for (const car of state.transport.cars) {
    if (car.dwell > 0) {
      car.dwell--;
      if (car.dwell === 20) {
        // pick up waiting guests just before departure
        const stationId = car.t < 0.5 ? car.aId : car.bId;
        boardGuests(state, car, stationId);
      }
      continue;
    }
    car.t += CAR_SPEED[car.type] * car.dir;
    if (car.t >= 1) { car.t = 1; car.dir = -1; car.dwell = STATION_DWELL; disembark(state, car, car.b); }
    else if (car.t <= 0) { car.t = 0; car.dir = 1; car.dwell = STATION_DWELL; disembark(state, car, car.a); }
  }
  // waiting timeout: guests give up if no car shows up
  for (const g of state.guests) {
    if (!g.waitStation) continue;
    g._waitTicks = (g._waitTicks || 0) + 1;
    if (g._waitTicks > 900) {
      g.waitStation = null; g._waitTicks = 0;
      g.opinions.unshift('I waited forever at that station and no car ever came.');
      if (g.opinions.length > 4) g.opinions.length = 4;
      g.satisfaction = Math.max(0, g.satisfaction - 0.08);
    }
  }
}

export function hasTransportNetwork(state) {
  return (state.transport?.cars || []).length > 0;
}

export function stationHasCar(state, buildingId) {
  return (state.transport?.cars || []).some((c) => c.aId === buildingId || c.bId === buildingId);
}
