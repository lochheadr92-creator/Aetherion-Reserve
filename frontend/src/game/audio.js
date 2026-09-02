// ---- Ambient audio layer (UI/render side; never touches the sim) ----
// Everything is synthesised with the Web Audio API so the game ships no audio
// assets. The manager reads authoritative state (weather, day phase, glowing
// exhibits, breaches) to steer two ambience beds and plays short one-shots for
// UI clicks, tool results and alert stingers. Browser autoplay policy means the
// context only starts after the first user gesture; until then calls are no-ops.
import { on } from './state';
import { getDayPhase } from './weather';
import { speciesById } from './data/species';

const LS_ENABLED = 'aetherion_audio_enabled';
const LS_VOLUME = 'aetherion_audio_volume';
const STINGER_GAP_MS = 380;     // minimum spacing between stingers
const UPDATE_EVERY = 20;        // frames between ambience re-targeting
const LOG_MAX = 24;             // one-shot history kept for debugging/tests

const readLS = (k, fallback) => {
  try { const v = localStorage.getItem(k); return v == null ? fallback : v; } catch (e) { return fallback; }
};
const writeLS = (k, v) => { try { localStorage.setItem(k, String(v)); } catch (e) { /* storage unavailable */ } };

// looping brown-ish noise buffer (2s) — the wind bed source
function makeNoiseBuffer(ctx, seconds = 2) {
  const n = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < n; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02; // leaky integrator → brown noise
    d[i] = last * 3.5;
  }
  return buf;
}

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = readLS(LS_ENABLED, 'true') !== 'false';
    this.volume = Math.max(0, Math.min(1, parseFloat(readLS(LS_VOLUME, '0.6')) || 0));
    this.log = [];                 // recent one-shots: { kind, t }
    this.lastStingerAt = 0;
    this.frame = 0;
    this._lastBreaches = null;
    this._lastState = null;
    this._beds = null;             // { wind, rain, hum } gain nodes
    this._unlockBound = false;
    this._listeners = [];
  }

  // ---------- lifecycle ----------
  // Bind once from the app shell: unlock on first gesture + UI click sounds + alert stingers.
  install() {
    if (typeof window === 'undefined' || this._unlockBound) return;
    this._unlockBound = true;
    const unlock = () => this.unlock();
    window.addEventListener('pointerdown', unlock, { capture: true, passive: true });
    window.addEventListener('keydown', unlock, { capture: true, passive: true });
    // UI click layer: any button-like control anywhere in the app
    window.addEventListener('pointerdown', (e) => {
      const el = e.target instanceof Element ? e.target.closest('button, [role="button"], [role="option"], [role="tab"], [role="switch"], [role="menuitem"], [role="combobox"], a[href]') : null;
      if (el && !el.hasAttribute('data-audio-silent')) this.click();
    }, { capture: true, passive: true });
    this._listeners.push(on('alert', (a) => this.stinger(a?.type || 'info')));
    window.__audio = this; // debug/testing access
  }

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
    } catch (e) { this.ctx = null; return; }
    this.master = this.ctx.createGain();
    this.master.gain.value = this.enabled ? this.volume : 0;
    this.master.connect(this.ctx.destination);
    this._buildBeds();
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  get ready() { return !!this.ctx && this.ctx.state === 'running'; }

  // ---------- settings (persisted) ----------
  setEnabled(v) {
    this.enabled = !!v;
    writeLS(LS_ENABLED, this.enabled);
    this._applyMaster();
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, Number(v) || 0));
    writeLS(LS_VOLUME, this.volume.toFixed(2));
    this._applyMaster();
  }

  _applyMaster() {
    if (!this.master) return;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(this.enabled ? this.volume : 0, t, 0.05);
  }

  // ---------- ambience beds ----------
  _buildBeds() {
    const ctx = this.ctx;
    // wind: brown noise → wandering low-pass → gain
    const src = ctx.createBufferSource();
    src.buffer = makeNoiseBuffer(ctx);
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 420; lp.Q.value = 0.6;
    const lfo = ctx.createOscillator();
    lfo.type = 'sine'; lfo.frequency.value = 0.11;
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 180;
    lfo.connect(lfoGain).connect(lp.frequency);
    const wind = ctx.createGain(); wind.gain.value = 0;
    src.connect(lp).connect(wind).connect(this.master);
    src.start(); lfo.start();
    // rain: same noise through a band-pass hiss, only audible in storms
    const src2 = ctx.createBufferSource();
    src2.buffer = src.buffer; src2.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'highpass'; bp.frequency.value = 1800;
    const rain = ctx.createGain(); rain.gain.value = 0;
    src2.connect(bp).connect(rain).connect(this.master);
    src2.start();
    // night hum: two detuned sines + a soft upper partial, slow beating
    const hum = ctx.createGain(); hum.gain.value = 0;
    for (const [f, g] of [[55, 0.5], [55.35, 0.5], [110.2, 0.18]]) {
      const o = ctx.createOscillator();
      o.type = 'sine'; o.frequency.value = f;
      const og = ctx.createGain(); og.gain.value = g;
      o.connect(og).connect(hum);
      o.start();
    }
    hum.connect(this.master);
    this._beds = { wind, rain, hum };
  }

  // Called every render frame with the live state (null when no game is open).
  update(state) {
    this.frame++;
    if (!state) {
      this._lastState = null;
      this._lastBreaches = null;
      this._setBeds(this.bedTargets(null));
      return;
    }
    if (state !== this._lastState) {
      this._lastState = state;
      this._lastBreaches = state.stats?.breaches || 0; // adopt silently on new game/load
    }
    const b = state.stats?.breaches || 0;
    if (b > this._lastBreaches) this.impact();
    this._lastBreaches = b;
    if (this.frame % UPDATE_EVERY !== 0) return;
    this._setBeds(this.bedTargets(state));
  }

  _setBeds(targets) {
    this.lastTargets = targets;
    if (!this._beds) return;
    const t = this.ctx.currentTime;
    for (const k of Object.keys(targets)) this._beds[k].gain.setTargetAtTime(targets[k], t, 0.6);
  }

  // Pure function of state → bed levels (exposed for tests).
  bedTargets(state) {
    if (!state) return { wind: 0, rain: 0, hum: 0 };
    const w = state.weather?.type || 'clear';
    const phase = getDayPhase(state.tick).phase;
    let wind = w === 'storm' ? 0.34 : w === 'overcast' ? 0.16 : 0.09;
    if (phase === 'night') wind *= 0.8;
    const rain = w === 'storm' ? 0.12 : 0;
    let hum = 0;
    if (phase === 'night') {
      const glowing = state.creatures.filter((c) => !c.escaped && speciesById(c.speciesId)?.colors?.glow).length;
      if (glowing > 0) hum = Math.min(0.12, 0.05 + glowing * 0.012);
    }
    return { wind, rain, hum };
  }

  // ---------- one-shots ----------
  _note(kind) {
    this.log.push({ kind, t: Date.now() });
    if (this.log.length > LOG_MAX) this.log.shift();
  }

  _can() { return this.enabled && this.ctx && this.ctx.state === 'running'; }

  // generic enveloped oscillator voice
  _tone({ type = 'sine', freq = 440, to = null, dur = 0.12, gain = 0.2, attack = 0.004, when = 0, lp = null }) {
    const ctx = this.ctx;
    const t0 = ctx.currentTime + when;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (to) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let node = o;
    if (lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; o.connect(f); node = f; }
    node.connect(g).connect(this.master);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }

  _noiseBurst({ dur = 0.08, gain = 0.12, hp = 800, when = 0 }) {
    const ctx = this.ctx;
    const t0 = ctx.currentTime + when;
    const src = ctx.createBufferSource();
    src.buffer = this._burst || (this._burst = makeNoiseBuffer(ctx, 0.3));
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t0); src.stop(t0 + dur + 0.02);
  }

  click() {
    this._note('click');
    if (!this._can()) return;
    this._tone({ type: 'triangle', freq: 1150, to: 720, dur: 0.045, gain: 0.07 });
  }

  place() {
    this._note('place');
    if (!this._can()) return;
    this._tone({ type: 'sine', freq: 220, to: 120, dur: 0.16, gain: 0.22 });
    this._noiseBurst({ dur: 0.07, gain: 0.05, hp: 600 });
  }

  deny() {
    this._note('deny');
    if (!this._can()) return;
    this._tone({ type: 'square', freq: 210, dur: 0.09, gain: 0.05, lp: 900 });
    this._tone({ type: 'square', freq: 168, dur: 0.12, gain: 0.05, lp: 900, when: 0.09 });
  }

  // containment breach: low thud + hiss (paired with the screen shake)
  impact() {
    this._note('impact');
    if (!this._can()) return;
    this._tone({ type: 'sine', freq: 90, to: 38, dur: 0.42, gain: 0.34 });
    this._noiseBurst({ dur: 0.3, gain: 0.08, hp: 300 });
  }

  toolResult(res) {
    if (!res) return;
    if (res.ok) this.place();
    else if (res.reason) this.deny();
  }

  // alert stingers keyed by alert type; throttled so bursts do not stack
  stinger(type) {
    const now = Date.now();
    if (now - this.lastStingerAt < STINGER_GAP_MS) return;
    this.lastStingerAt = now;
    this._note(`stinger:${type}`);
    if (!this._can()) return;
    switch (type) {
      case 'danger':
        this._tone({ type: 'sawtooth', freq: 660, to: 440, dur: 0.16, gain: 0.09, lp: 2200 });
        this._tone({ type: 'sawtooth', freq: 494, to: 330, dur: 0.24, gain: 0.09, lp: 2200, when: 0.15 });
        break;
      case 'warning':
        this._tone({ type: 'triangle', freq: 523, dur: 0.11, gain: 0.1 });
        this._tone({ type: 'triangle', freq: 523, dur: 0.16, gain: 0.1, when: 0.14 });
        break;
      case 'success':
        this._tone({ type: 'sine', freq: 659, dur: 0.1, gain: 0.11 });
        this._tone({ type: 'sine', freq: 988, dur: 0.18, gain: 0.11, when: 0.1 });
        break;
      case 'breakthrough':
        this._tone({ type: 'sine', freq: 523, dur: 0.1, gain: 0.1 });
        this._tone({ type: 'sine', freq: 659, dur: 0.1, gain: 0.1, when: 0.09 });
        this._tone({ type: 'sine', freq: 784, dur: 0.1, gain: 0.1, when: 0.18 });
        this._tone({ type: 'sine', freq: 1046, dur: 0.26, gain: 0.11, when: 0.27 });
        break;
      case 'radio':
        // keeper call-in: two quick band-limited chirps, quiet and unobtrusive
        this._tone({ type: 'square', freq: 1320, to: 1180, dur: 0.035, gain: 0.03, lp: 2600 });
        this._tone({ type: 'square', freq: 1320, to: 1180, dur: 0.035, gain: 0.03, lp: 2600, when: 0.07 });
        this._noiseBurst({ dur: 0.05, gain: 0.015, hp: 2400, when: 0.1 });
        break;
      default:
        this._tone({ type: 'sine', freq: 880, dur: 0.07, gain: 0.07 });
    }
  }
}

export const audio = new AudioManager();
