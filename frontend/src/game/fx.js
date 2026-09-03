// ---- Render-layer game feel: camera zoom easing, pan inertia, screen shake,
// building placement pops, dust particles and creature footprints.
// Reads the authoritative state but NEVER mutates gameplay. All effect state
// lives on this manager (render-only), so sim determinism and save files are
// untouched. Honors prefers-reduced-motion by degrading to instant/no motion.
import { TILE_W, TILE_H, H_STEP } from './constants';
import { idx } from './state';
import { speciesById } from './data/species';
import { hexRgb } from './art/pixel';

const px = (x, y, h = 0) => ({ x: (x - y) * (TILE_W / 2), y: (x + y) * (TILE_H / 2) - h * H_STEP });

export const REDUCED_MOTION = typeof window !== 'undefined' && window.matchMedia
  ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
  : false;

const ZOOM_MIN = 0.35, ZOOM_MAX = 2.2;
const ZOOM_EASE = 0.28;        // per-frame lerp toward the zoom target
const INERTIA_DECAY = 0.88;    // per-frame velocity retention after pan release
const INERTIA_MIN = 0.4;       // px/frame — below this the glide stops
const SHAKE_DECAY = 0.86;      // per-frame shake falloff
const POP_FRAMES = 22;         // building entrance pop duration (~0.37s @60fps)
const TRACK_TTL = 210;         // frames a footprint stays visible (~3.5s)
const TRACK_STEP = 0.55;       // tiles travelled between prints
const TRACK_MAX = 320;         // decal cap (oldest dropped first)
const NO_TRACKS = new Set(['float', 'winged']); // airborne bodies leave no prints

// ---- species auras (Phase G): render-only ambience emitted around creatures ----
const AURA_MAX = 360;        // aura particles alive at once (dust is budgeted separately)
const AURA_GAIN = 1.8;       // global emission multiplier over the per-species descriptor rate
const AURA_DAY_DIM = 0.45;   // always-on auras thin out in daylight
const AURA_KINDS = {
  // rising, flickering cinders (emberoot, rhoak)
  ember: { ttl: [28, 48], size: [1.5, 2.6], vx: [-0.25, 0.25], vy: [-0.9, -0.5], drag: 0.97, grav: -0.012, wob: 0.6, shape: 'dot', alpha: 0.85, flicker: true },
  // slow drifting motes that meander (mosswarden, sylvarr)
  spore: { ttl: [70, 110], size: [1.3, 2.2], vx: [-0.2, 0.2], vy: [-0.35, -0.12], drag: 0.995, grav: -0.002, wob: 1.2, shape: 'dot', alpha: 0.7 },
  // fast, short-lived arcs (voltari, zephyrmaw)
  spark: { ttl: [5, 10], size: [1, 1.5], vx: [-1.6, 1.6], vy: [-1.6, 1.0], drag: 0.9, grav: 0, wob: 0, shape: 'spark', alpha: 0.95 },
  // hovering points of light (vantha, lumen)
  mote: { ttl: [50, 90], size: [1.3, 2], vx: [-0.15, 0.15], vy: [-0.2, 0.1], drag: 0.995, grav: -0.001, wob: 1.6, shape: 'dot', alpha: 0.65 },
  // smoky trails that curl upward (umbra, nyxarr)
  wisp: { ttl: [36, 60], size: [1.8, 3], vx: [-0.3, 0.3], vy: [-0.5, -0.25], drag: 0.98, grav: -0.004, wob: 1.4, shape: 'wisp', alpha: 0.35 },
  // stationary twinkles on crystal facets (shardling)
  glint: { ttl: [10, 18], size: [1.5, 2.5], vx: [0, 0], vy: [0, 0], drag: 1, grav: 0, wob: 0, shape: 'cross', alpha: 0.9 },
};
const rr = (lo, hi) => lo + Math.random() * (hi - lo);

// easeOutBack: 0→1 with a small overshoot for a satisfying "pop"
function easeOutBack(t) {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

export class FxManager {
  constructor(renderer) {
    this.r = renderer;
    this.zoomTarget = null;      // { zoom, sx, sy } — eased toward each frame
    this.panVel = null;          // { x, y } px/frame camera glide after release
    this.shakeMag = 0;
    this.offset = { x: 0, y: 0 }; // current shake offset applied to the camera transform
    this.particles = [];          // world-px dust motes { x, y, vx, vy, life, ttl, size, col }
    this.pops = new Map();        // building id -> frame the entrance pop started
    this.tracks = [];             // world-px footprint decals { x, y, rx, ry, ang, life, ttl }
    this._lastPos = new Map();    // creature id -> { x, y, side } last print position
    this._seen = null;            // Set of known building ids (null until first state sync)
    this._lastBreaches = 0;
    this._lastState = null;
  }

  // ---------- external triggers (called from the input layer / renderer) ----------
  requestZoom(factor, sx, sy) {
    const cur = this.zoomTarget ? this.zoomTarget.zoom : this.r.cam.zoom;
    const zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, cur * factor));
    if (REDUCED_MOTION) { this._applyZoomStep(zoom, sx, sy); return; }
    this.zoomTarget = { zoom, sx, sy };
  }

  beginPanInertia(vx, vy) {
    if (REDUCED_MOTION) return;
    if (Math.hypot(vx, vy) < 3) return; // ignore slow releases
    const cap = 42; // px/frame safety cap
    this.panVel = { x: Math.max(-cap, Math.min(cap, vx)), y: Math.max(-cap, Math.min(cap, vy)) };
  }

  cancelMotion() {
    this.panVel = null;
    this.zoomTarget = null;
  }

  shake(mag) {
    if (REDUCED_MOTION) return;
    this.shakeMag = Math.max(this.shakeMag, mag);
  }

  // ---------- per-frame update (called at the top of renderer.render) ----------
  update(state) {
    this._syncState(state);
    this._stepZoom();
    this._stepInertia();
    this._stepShake();
    this._stepParticles();
    this._stepFootprints(state);
  }

  _syncState(s) {
    if (s !== this._lastState) {
      // new game / loaded save: adopt existing world silently (no pops, no shake)
      this._lastState = s;
      this._seen = new Set(s.buildings.map((b) => b.id));
      this.pops.clear();
      this.particles = [];
      this.tracks = [];
      this._lastPos.clear();
      this._lastBreaches = s.stats?.breaches || 0;
      this.cancelMotion();
      this.shakeMag = 0;
      return;
    }
    // newly placed buildings → entrance pop + dust puff at the base
    for (const b of s.buildings) {
      if (this._seen.has(b.id)) continue;
      this._seen.add(b.id);
      if (REDUCED_MOTION) continue;
      this.pops.set(b.id, this.r.frame);
      const h = s.heights[idx(b.x, b.y)] || 0;
      const pc = px(b.x + b.w / 2, b.y + b.h / 2, h);
      this._spawnDust(pc.x, pc.y, (b.w + b.h) * 11);
    }
    // containment breach → screen shake
    const breaches = s.stats?.breaches || 0;
    if (breaches > this._lastBreaches) this.shake(9);
    this._lastBreaches = breaches;
  }

  _applyZoomStep(zoom, sx, sy) {
    const r = this.r;
    const bx = (sx - r.cam.x) / r.cam.zoom, by = (sy - r.cam.y) / r.cam.zoom;
    r.cam.zoom = zoom;
    r.cam.x = sx - bx * zoom;
    r.cam.y = sy - by * zoom;
  }

  _stepZoom() {
    if (!this.zoomTarget) return;
    const { zoom, sx, sy } = this.zoomTarget;
    const cur = this.r.cam.zoom;
    if (Math.abs(zoom - cur) < 0.002) {
      this._applyZoomStep(zoom, sx, sy);
      this.zoomTarget = null;
      return;
    }
    this._applyZoomStep(cur + (zoom - cur) * ZOOM_EASE, sx, sy);
  }

  _stepInertia() {
    if (!this.panVel) return;
    this.r.cam.x += this.panVel.x;
    this.r.cam.y += this.panVel.y;
    this.panVel.x *= INERTIA_DECAY;
    this.panVel.y *= INERTIA_DECAY;
    if (Math.hypot(this.panVel.x, this.panVel.y) < INERTIA_MIN) this.panVel = null;
  }

  _stepShake() {
    if (this.shakeMag < 0.3) {
      this.shakeMag = 0;
      this.offset.x = 0; this.offset.y = 0;
      return;
    }
    // Math.random is safe here: render-only, never feeds the deterministic sim
    this.offset.x = (Math.random() * 2 - 1) * this.shakeMag;
    this.offset.y = (Math.random() * 2 - 1) * this.shakeMag * 0.7;
    this.shakeMag *= SHAKE_DECAY;
  }

  // ---------- building entrance pop ----------
  popScale(id) {
    const start = this.pops.get(id);
    if (start === undefined) return 1;
    const t = (this.r.frame - start) / POP_FRAMES;
    if (t >= 1) { this.pops.delete(id); return 1; }
    return 0.62 + 0.38 * easeOutBack(Math.max(0, t));
  }

  // ---------- dust particles (world-px space) ----------
  _spawnDust(cx, cy, radius) {
    const n = Math.min(18, 8 + Math.round(radius / 6));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = radius * (0.4 + Math.random() * 0.7);
      this.particles.push({
        x: cx + Math.cos(a) * d,
        y: cy + Math.sin(a) * d * 0.5,
        vx: Math.cos(a) * (0.5 + Math.random() * 0.9),
        vy: -0.35 - Math.random() * 0.5,
        life: 0,
        ttl: 26 + Math.random() * 18,
        size: 1.5 + Math.random() * 2,
        col: Math.random() < 0.5 ? '154,140,120' : '120,112,100',
      });
    }
  }

  _stepParticles() {
    if (!this.particles.length) { this._auraCount = 0; return; }
    const alive = [];
    let auras = 0;
    for (const p of this.particles) {
      p.life++;
      if (p.life >= p.ttl) continue;
      p.x += p.vx + (p.wob ? Math.sin(p.life * 0.15 + p.ph) * p.wob * 0.25 : 0);
      p.y += p.vy;
      p.vx *= p.drag ?? 0.94;
      p.vy = p.vy * (p.drag ?? 0.92) + (p.grav ?? -0.01); // default: gentle upward drift
      if (p.aura) auras++;
      alive.push(p);
    }
    this.particles = alive;
    this._auraCount = auras;
  }

  // ---------- species auras (world-px space; called by the renderer per drawn creature) ----------
  // `sheet.aura` = { kind, color, rate, night }. `night: true` gates the effect to
  // dusk/night; always-on auras are dimmed by day. Agitated animals emit harder.
  emitAura(c, sheet, x, y, dw, dh, phase) {
    if (REDUCED_MOTION) return;
    const a = sheet.aura;
    if (!a) return;
    const night = phase === 'night' || phase === 'dusk';
    if (a.night && !night) return;
    if ((this._auraCount || 0) >= AURA_MAX) return;
    const agitated = c.escaped || (c.stress || 0) > 0.55;
    const rate = a.rate * AURA_GAIN * (night ? 1 : AURA_DAY_DIM) * (agitated ? 1.6 : 1);
    if (Math.random() > rate) return;
    const k = AURA_KINDS[a.kind] || AURA_KINDS.mote;
    const rgb = hexRgb(a.color);
    this.particles.push({
      // spawn inside the body mass (sprite is bottom-anchored at y)
      x: x + rr(-dw * 0.3, dw * 0.3),
      y: y - rr(dh * 0.2, dh * 0.8),
      vx: rr(k.vx[0], k.vx[1]), vy: rr(k.vy[0], k.vy[1]),
      life: 0, ttl: rr(k.ttl[0], k.ttl[1]), size: rr(k.size[0], k.size[1]),
      col: `${rgb[0]},${rgb[1]},${rgb[2]}`,
      drag: k.drag, grav: k.grav, wob: k.wob, shape: k.shape, alpha: k.alpha, flicker: !!k.flicker,
      ph: Math.random() * Math.PI * 2, aura: true,
    });
    this._auraCount = (this._auraCount || 0) + 1;
  }

  drawParticles(ctx) {
    for (const p of this.particles) {
      const t = p.life / p.ttl;
      let a = p.aura ? (p.alpha ?? 0.6) * Math.sin(t * Math.PI) : 0.5 * (1 - t); // auras ease in and out
      if (p.flicker) a *= 0.7 + 0.3 * Math.sin(p.life * 0.9 + p.ph);
      ctx.fillStyle = `rgba(${p.col},${a.toFixed(3)})`;
      switch (p.shape) {
        case 'cross': // twinkle
          ctx.fillRect(p.x - p.size * 1.5, p.y - 0.5, p.size * 3, 1);
          ctx.fillRect(p.x - 0.5, p.y - p.size * 1.5, 1, p.size * 3);
          break;
        case 'spark': // hot core with a white leading pixel
          ctx.fillRect(p.x, p.y, p.size, p.size);
          ctx.fillStyle = `rgba(255,255,255,${(a * 0.8).toFixed(3)})`;
          ctx.fillRect(p.x + p.vx * 0.6, p.y + p.vy * 0.6, 1, 1);
          break;
        case 'wisp': // soft smoky puff
          ctx.beginPath(); ctx.ellipse(p.x, p.y, p.size, p.size * 0.6, 0, 0, Math.PI * 2); ctx.fill();
          break;
        default:
          ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
    }
  }

  // ---------- creature footprints (ground decals, drawn under entities) ----------
  // Land walkers leave a faint alternating left/right print every ~half tile
  // while travelling; prints fade over TRACK_TTL frames. Airborne bodies,
  // cloaked organisms and anything in water leave nothing.
  _stepFootprints(s) {
    // age existing decals first so a burst of new prints starts at full alpha
    if (this.tracks.length) {
      const alive = [];
      for (const t of this.tracks) { t.life++; if (t.life < t.ttl) alive.push(t); }
      this.tracks = alive;
    }
    if (REDUCED_MOTION) return;
    const seen = new Set();
    for (const c of s.creatures) {
      seen.add(c.id);
      const last = this._lastPos.get(c.id);
      if (!last) { this._lastPos.set(c.id, { x: c.x, y: c.y, side: 1 }); continue; }
      const moving = c.path && c.path.length > 0;
      const dx = c.x - last.x, dy = c.y - last.y;
      const d = Math.hypot(dx, dy);
      if (!moving || d < TRACK_STEP) {
        if (!moving) { last.x = c.x; last.y = c.y; } // stationary: keep the anchor fresh
        continue;
      }
      last.x = c.x; last.y = c.y;
      const sp = speciesById(c.speciesId);
      const ti = idx(Math.floor(c.x), Math.floor(c.y));
      if (NO_TRACKS.has(sp.bodyType) || c.cloaked || s.water[ti]) continue;
      last.side = -last.side;
      // alternate prints either side of the travel line
      const nx = -dy / d, ny = dx / d;
      const off = 0.13 * last.side;
      const p = px(c.x + nx * off, c.y + ny * off, s.heights[ti] || 0);
      const scale = (0.9 + (sp.size || 1) * 0.9) * (c.juvenile ? 0.6 : 1) * (c.genes?.size || 1);
      this.tracks.push({
        x: p.x, y: p.y + 1, rx: 2.2 * scale, ry: 1.1 * scale,
        ang: Math.atan2((dx + dy) * (TILE_H / 2), (dx - dy) * (TILE_W / 2)),
        life: 0, ttl: TRACK_TTL,
      });
      if (this.tracks.length > TRACK_MAX) this.tracks.shift();
    }
    for (const id of this._lastPos.keys()) if (!seen.has(id)) this._lastPos.delete(id);
  }

  drawFootprints(ctx) {
    if (!this.tracks.length) return;
    ctx.save();
    ctx.lineWidth = 0.7;
    for (const t of this.tracks) {
      const fade = 1 - t.life / t.ttl;
      // pressed-ground depression: dark core with a faint lit rim so prints read on dark turf
      ctx.fillStyle = `rgba(4,7,10,${(0.55 * fade).toFixed(3)})`;
      ctx.beginPath(); ctx.ellipse(t.x, t.y, t.rx, t.ry, t.ang, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = `rgba(150,170,160,${(0.22 * fade).toFixed(3)})`;
      ctx.beginPath(); ctx.ellipse(t.x - 0.4, t.y - 0.4, t.rx, t.ry, t.ang, Math.PI * 0.9, Math.PI * 1.9); ctx.stroke();
    }
    ctx.restore();
  }
}
