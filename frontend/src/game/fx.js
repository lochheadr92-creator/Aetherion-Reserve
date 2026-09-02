// ---- Render-layer game feel: camera zoom easing, pan inertia, screen shake,
// building placement pops and dust particles.
// Reads the authoritative state but NEVER mutates gameplay. All effect state
// lives on this manager (render-only), so sim determinism and save files are
// untouched. Honors prefers-reduced-motion by degrading to instant/no motion.
import { TILE_W, TILE_H, H_STEP } from './constants';
import { idx } from './state';

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
  }

  _syncState(s) {
    if (s !== this._lastState) {
      // new game / loaded save: adopt existing world silently (no pops, no shake)
      this._lastState = s;
      this._seen = new Set(s.buildings.map((b) => b.id));
      this.pops.clear();
      this.particles = [];
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
    if (!this.particles.length) return;
    const alive = [];
    for (const p of this.particles) {
      p.life++;
      if (p.life >= p.ttl) continue;
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.94;
      p.vy = p.vy * 0.92 - 0.01; // gentle upward drift
      alive.push(p);
    }
    this.particles = alive;
  }

  drawParticles(ctx) {
    for (const p of this.particles) {
      const a = 0.5 * (1 - p.life / p.ttl);
      ctx.fillStyle = `rgba(${p.col},${a.toFixed(3)})`;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
  }
}
