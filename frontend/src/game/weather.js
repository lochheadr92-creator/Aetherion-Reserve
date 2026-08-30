// ---- Weather & day-night cycle: affects creature behaviour, guest arrivals and visibility ----
import { TICKS_PER_DAY } from './constants';
import { rnd, pushAlert } from './state';

export function getDayPhase(tick) {
  const t = ((tick % TICKS_PER_DAY) + TICKS_PER_DAY) % TICKS_PER_DAY / TICKS_PER_DAY;
  if (t < 0.62) return { phase: 'day', t };
  if (t < 0.72) return { phase: 'dusk', t };
  return { phase: 'night', t };
}

export function clockLabel(tick) {
  const t = ((tick % TICKS_PER_DAY) + TICKS_PER_DAY) % TICKS_PER_DAY / TICKS_PER_DAY;
  const mins = Math.floor(t * 24 * 60);
  const h = Math.floor(mins / 60), m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(Math.floor(m / 15) * 15).padStart(2, '0')}`;
}

export function ensureWeather(state) {
  if (!state.weather) state.weather = { type: 'clear', ticksLeft: 900 };
  return state.weather;
}

export function isStorm(state) { return state.weather?.type === 'storm'; }

// called every 25 ticks from sim
export function weatherTick(state) {
  const w = ensureWeather(state);
  w.ticksLeft -= 25;
  if (w.ticksLeft > 0) return;
  const prev = w.type;
  const r = rnd();
  if (r < 0.55) { w.type = 'clear'; w.ticksLeft = Math.round(700 + rnd() * 900); }
  else if (r < 0.82) { w.type = 'overcast'; w.ticksLeft = Math.round(400 + rnd() * 600); }
  else { w.type = 'storm'; w.ticksLeft = Math.round(250 + rnd() * 350); }
  if (w.type === 'storm' && prev !== 'storm') {
    pushAlert(state, {
      type: 'warning', title: 'STORM WARNING',
      msg: 'A storm front is crossing the reserve. Creatures will seek shelter, exposed barriers may take damage and guests will take cover.',
    });
  } else if (prev === 'storm' && w.type !== 'storm') {
    pushAlert(state, { type: 'info', title: 'STORM CLEARED', msg: 'The storm has passed. Operations returning to normal.' });
  }
}

// guest viewing multiplier from weather + time of day
export function visibilityWeatherMult(state) {
  const { phase } = getDayPhase(state.tick);
  let m = 1;
  if (state.weather?.type === 'storm') m *= 0.5;
  else if (state.weather?.type === 'overcast') m *= 0.85;
  if (phase === 'night') m *= 0.65;
  else if (phase === 'dusk') m *= 0.85;
  return m;
}

// guest arrival multiplier
export function spawnWeatherMult(state) {
  const { phase } = getDayPhase(state.tick);
  let m = 1;
  if (state.weather?.type === 'storm') m *= 0.15;
  else if (state.weather?.type === 'overcast') m *= 0.8;
  if (phase === 'night') m *= 0.5;
  else if (phase === 'dusk') m *= 0.8;
  return m;
}
