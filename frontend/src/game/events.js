// ---- Park live-event engine ----
// Creature behaviour generates park-wide events (births, rivalries, feeding,
// juvenile play, rare morph sightings). Guests respond to them: crowds form,
// spending spikes nearby, and park "buzz" raises attendance. Events are part of
// authoritative state and expire on their own.
import { pushAlert } from './state';
import { rnd } from './state';
import { speciesById } from './data/species';

export const EVENT_META = {
  rivalry: { label: 'RIVAL RUMBLE', color: '#FF5C7A', alert: true },
  birth: { label: 'BIRTH', color: '#6EF3C5', alert: false },
  courtship: { label: 'COURTSHIP', color: '#b98ae0', alert: false },
  feeding: { label: 'FEEDING', color: '#F2C14E', alert: false },
  play: { label: 'JUVENILE PLAY', color: '#4DB6FF', alert: false },
  morph: { label: 'RARE MORPH SIGHTING', color: '#e8f2ff', alert: false },
};

export function emitParkEvent(state, { type, name, x, y, radius = 10, magnitude = 0.5, duration = 800, subject = null, speciesId = null }) {
  if (!state.events) state.events = [];
  // merge with an existing nearby event of the same type instead of stacking
  const existing = state.events.find((e) => e.type === type && Math.hypot(e.x - x, e.y - y) < 7 && state.tick < e.expires);
  if (existing) {
    existing.expires = Math.max(existing.expires, state.tick + duration);
    existing.magnitude = Math.max(existing.magnitude, magnitude);
    return existing;
  }
  const evt = {
    id: state.nextId++, type, name: name || EVENT_META[type]?.label || type,
    x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10,
    radius, magnitude, start: state.tick, expires: state.tick + duration, subject, speciesId,
  };
  state.events.push(evt);
  if (state.events.length > 14) state.events.shift();
  // park buzz: word spreads about dramatic moments — attendance rises
  state.stats.buzz = Math.min(1, (state.stats.buzz || 0) + magnitude * 0.25);
  // throttled alerts for headline events only
  if (EVENT_META[type]?.alert || magnitude >= 0.85) {
    state._evtAlert = state._evtAlert || {};
    if (!state._evtAlert[type] || state.tick - state._evtAlert[type] > 1500) {
      state._evtAlert[type] = state.tick;
      pushAlert(state, {
        type: 'info', title: evt.name,
        msg: `${evt.name} in progress — guests are gathering. Nearby viewing areas and stalls will benefit.`,
        target: { kind: 'tile', x: Math.floor(x), y: Math.floor(y) },
      });
    }
  }
  return evt;
}

export function activeEvents(state) {
  return (state.events || []).filter((e) => state.tick < e.expires);
}

export function eventsNear(state, x, y, r = 14) {
  return activeEvents(state).filter((e) => Math.hypot(e.x - x, e.y - y) <= r + e.radius);
}

export function hottestEvent(state) {
  const evts = activeEvents(state);
  if (!evts.length) return null;
  return evts.reduce((a, b) => (b.magnitude > a.magnitude ? b : a));
}

// emergent detections: called every ~30 ticks from the sim
export function eventsTick(state) {
  if (!state.events) state.events = [];
  state.events = state.events.filter((e) => state.tick < e.expires);
  state.stats.buzz = Math.max(0, (state.stats.buzz || 0) - 0.0035);

  // predator feeding at a carcass feeder draws a crowd
  for (const c of state.creatures) {
    if (c.state !== 'eating') continue;
    const sp = speciesById(c.speciesId);
    if (sp.diet.station === 'meat' && sp.danger >= 3) {
      emitParkEvent(state, {
        type: 'feeding', name: `${sp.name} Feeding`, x: c.x, y: c.y,
        radius: 9, magnitude: 0.45 + sp.danger * 0.06, duration: 350, subject: c.id, speciesId: sp.id,
      });
    }
  }

  // juveniles playing together are irresistible to families
  const juvByEnc = {};
  for (const c of state.creatures) {
    if (!c.juvenile || !c.enclosureId) continue;
    (juvByEnc[c.enclosureId] = juvByEnc[c.enclosureId] || []).push(c);
  }
  for (const group of Object.values(juvByEnc)) {
    if (group.length >= 2 && rnd() < 0.25) {
      const cx = group.reduce((s, c) => s + c.x, 0) / group.length;
      const cy = group.reduce((s, c) => s + c.y, 0) / group.length;
      emitParkEvent(state, {
        type: 'play', name: 'Juveniles at Play', x: cx, y: cy,
        radius: 10, magnitude: 0.5, duration: 600, speciesId: group[0].speciesId,
      });
    }
  }

  // rare morphs stepping into the open get spotted
  for (const c of state.creatures) {
    if (!c.genes?.morph || c.cloaked || c.juvenile) continue;
    if (rnd() < 0.06) {
      const sp = speciesById(c.speciesId);
      emitParkEvent(state, {
        type: 'morph', name: `Rare ${sp.name} Morph Sighted`, x: c.x, y: c.y,
        radius: 11, magnitude: 0.65, duration: 800, subject: c.id, speciesId: sp.id,
      });
    }
  }
}
