// ---- Creature vocals scheduler (render layer; never touches the sim) ----
// Once per frame, for every organism, decide whether it should call out and where that call sits in
// the listener's space. Three families of cue:
//   alarmed  rising edge of a threat display ('threat') or a lunge burst ('lunge') — same predicates the
//            2D sprite renderer uses for its threat/lunge frames, so sound and pose agree
//   feeding  rising edge of an eating / grazing / drinking / filter-feeding bout ('feed')
//   idle     a soft ambient call on a personal 9–26 s timer while calm and on screen ('idle')
// Positions are projected with the same iso maths as the overlay canvas (world px -> screen), then
// normalised so the audio manager can pan / attenuate / low-pass by where the animal is relative to
// the viewport centre. Works identically under the classic 2D renderer and the WebGL world because it
// reads sim state + camera only. Idle timing uses wall-clock Math.random — render-only, never the sim RNG.
import { TILE_W, TILE_H, H_STEP } from './constants';
import { idx } from './state';
import { audio } from './audio';

const LUNGE_CYCLE = 96;                    // render frames between lunge bursts (mirrors renderer.js)
const IDLE_MIN_MS = 9000, IDLE_MAX_MS = 26000;
const OFFSCREEN = 1.25;                    // normalised viewport radius beyond which animals stay quiet
export const FEED_STATES = new Set(['eating', 'grazing', 'drinking', 'filterFeeding']);
export const CALM_STATES = new Set(['idle', 'resting', 'socialising', 'swimming', 'settling', 'sheltering']);

const rand = (lo, hi) => lo + Math.random() * (hi - lo);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// pure: which cue (if any) an organism raises this frame given its previous edge memory
export function vocalEvent(c, sheet, mem, frame, now) {
  const moving = !!(c.path && c.path.length > 0);
  const stress = c.stress || 0;
  const agitated = !moving && !c.cloaked && (c.escaped || stress > 0.55);
  const threat = !!sheet.threat && agitated;
  const predator = !!sheet.menace;
  const lungeReady = !!sheet.lunge && !moving && !c.cloaked && (c.escaped || stress > 0.8 || (predator && c.state === 'eating'));
  const lungeCad = Math.max(3, Math.round(5 * (sheet.pace || 1)));
  const cyc = (frame + c.id * 17) % LUNGE_CYCLE;
  const lunging = lungeReady && cyc < (sheet.lunge ? sheet.lunge.length : 0) * lungeCad;
  const display = threat || lungeReady;
  const feeding = FEED_STATES.has(c.state) && !moving;
  let event = null;
  if (lunging && !mem.lunging) event = 'lunge';
  else if (display && !mem.display) event = 'threat';
  else if (feeding && !mem.feeding) event = 'feed';
  else if (!display && !feeding && !c.cloaked && !c.escaped && stress < 0.55 && CALM_STATES.has(c.state) && now >= mem.nextIdle) event = 'idle';
  return { event, display, lunging, feeding };
}

export class VocalScheduler {
  constructor() {
    this.mem = new Map();      // creature id -> { display, lunging, feeding, nextIdle }
    this.stats = { idle: 0, feed: 0, threat: 0, lunge: 0, offscreen: 0 };
    this._state = null;
    this.last = null;          // last cue placed: { id, event, pan, proximity } (tests/debug)
  }

  reset() { this.mem.clear(); }

  // screen-space placement of a world position under the current camera
  static place(state, c, cam, W, H, offX, offY) {
    const ti = idx(Math.floor(c.x), Math.floor(c.y));
    const h = (state.heights && state.heights[ti]) || 0;
    const px = (c.x - c.y) * (TILE_W / 2), py = (c.x + c.y) * (TILE_H / 2) - h * H_STEP;
    const sx = px * cam.zoom + cam.x + offX, sy = py * cam.zoom + cam.y + offY;
    const nx = (sx - W / 2) / (W / 2), ny = (sy - H / 2) / (H / 2);
    return { nx, ny, dist: Math.hypot(nx, ny) };
  }

  update({ state, cam, W, H, frame, offX = 0, offY = 0, sheetFor, stageFor, now = Date.now() }) {
    if (!state) { this._state = null; return; }
    if (state !== this._state) { this._state = state; this.mem.clear(); }
    for (const c of state.creatures) {
      const sheet = sheetFor(c.speciesId, stageFor ? stageFor(c) : 'adult');
      if (!sheet) continue;
      let m = this.mem.get(c.id);
      if (!m) { m = { display: false, lunging: false, feeding: false, nextIdle: now + rand(2000, IDLE_MAX_MS) }; this.mem.set(c.id, m); }
      const { event, display, lunging, feeding } = vocalEvent(c, sheet, m, frame, now);
      const prev = { display: m.display, lunging: m.lunging, feeding: m.feeding };
      m.display = display; m.lunging = lunging; m.feeding = feeding;
      if (!event) continue;
      const { nx, ny, dist } = VocalScheduler.place(state, c, cam, W, H, offX, offY);
      if (dist > OFFSCREEN) {
        // off-screen animals stay quiet; an idle call is simply rescheduled
        if (event === 'idle') m.nextIdle = now + rand(IDLE_MIN_MS, IDLE_MAX_MS);
        this.stats.offscreen++;
        continue;
      }
      const cue = { sheet, speciesId: c.speciesId, proximity: Math.max(0, 1 - dist), pan: clamp(nx, -1, 1), elevation: clamp(-ny, -1, 1), juvenile: !!c.juvenile };
      const res = audio.creatureVoice(c, event, cue);
      if (res === 'limited-global' || res === 'limited-self-retry') {
        // spacing / rolling cap / alarm-cut window: keep the edge pending so the cue lands a few frames later
        m.display = prev.display; m.lunging = prev.lunging; m.feeding = prev.feeding;
        continue;
      }
      if (event === 'idle') m.nextIdle = now + rand(IDLE_MIN_MS, IDLE_MAX_MS);
      if (res === 'limited-self') continue;
      this.stats[event]++;
      this.last = { id: c.id, event, pan: cue.pan, proximity: cue.proximity, res };
    }
  }
}

export const vocals = new VocalScheduler();
if (typeof window !== 'undefined') window.__vocals = vocals; // debug/testing access
