// ---- Pixel-art painter core ----
// One art pixel = SPRITE_SCALE device pixels (drawn with smoothing off for chunky consistency).
// Global light: upper-left. Shadows/AO: lower-right.

export const SPRITE_SCALE = 2;

// ---------- color helpers ----------
export function hexRgb(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function rgbHex([r, g, b]) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

// amt > 0 lighten toward white, amt < 0 darken toward black (-1..1)
export function tone(hex, amt) {
  const rgb = hexRgb(hex);
  const t = amt > 0
    ? rgb.map((v) => v + (255 - v) * amt)
    : rgb.map((v) => v * (1 + amt));
  return rgbHex(t);
}

export function mixc(hexA, hexB, t) {
  const a = hexRgb(hexA), b = hexRgb(hexB);
  return rgbHex([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
}

const OUTLINE = 'rgba(5,9,14,0.85)';

// ---------- painter ----------
export class Px {
  constructor(w, h) {
    this.w = w; this.h = h;
    this.cv = document.createElement('canvas');
    this.cv.width = w; this.cv.height = h;
    this.ctx = this.cv.getContext('2d', { willReadFrequently: true });
    this.ctx.imageSmoothingEnabled = false;
    // whole-pixel origin offset (bake padding + lunge kinematics); every
    // primitive goes through p()/r() so recorded eye rects stay exact
    this.ox = 0; this.oy = 0;
  }

  shift(dx, dy) { this.ox = Math.round(dx); this.oy = Math.round(dy); }

  p(x, y, c) {
    this.ctx.fillStyle = c;
    this.ctx.fillRect(Math.round(x) + this.ox, Math.round(y) + this.oy, 1, 1);
  }

  r(x, y, w, h, c) {
    this.ctx.fillStyle = c;
    this.ctx.fillRect(Math.round(x) + this.ox, Math.round(y) + this.oy, Math.round(w), Math.round(h));
  }

  hl(x, y, w, c) { this.r(x, y, w, 1, c); }
  vl(x, y, h, c) { this.r(x, y, 1, h, c); }

  // filled ellipse with top-left band lighting + bottom-right AO
  blob(cx, cy, rx, ry, base, { lite = 0.22, dark = 0.28, tex = 0 } = {}) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x - cx) / rx, dy = (y - cy) / ry;
        if (dx * dx + dy * dy > 1) continue;
        const l = (dx + dy) / 2; // -1 (upper-left) .. 1 (lower-right)
        let c = l < 0 ? tone(base, -l * lite) : tone(base, -l * dark);
        if (tex && ((x * 7 + y * 13) % 11 === 0)) c = tone(c, -0.09);
        this.p(x, y, c);
      }
    }
  }

  // shaded rect (vertical band lighting: top lighter, bottom darker)
  slab(x, y, w, h, base, { lite = 0.18, dark = 0.24, tex = 0 } = {}) {
    for (let yy = 0; yy < h; yy++) {
      const t = h <= 1 ? 0 : (yy / (h - 1)) * 2 - 1;
      let c = t < 0 ? tone(base, -t * lite) : tone(base, -t * dark);
      for (let xx = 0; xx < w; xx++) {
        let cc = c;
        if (tex && (((x + xx) * 5 + (y + yy) * 9) % 13 === 0)) cc = tone(c, -0.08);
        this.p(x + xx, y + yy, cc);
      }
    }
  }

  // sparse texture dots
  dither(x, y, w, h, c, density = 0.12, seed = 0) {
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
      const n = Math.abs(Math.sin((x + xx) * 12.9898 + (y + yy) * 78.233 + seed) * 43758.5) % 1;
      if (n < density) this.p(x + xx, y + yy, c);
    }
  }

  // bright pixel + faint cross (restrained bioluminescence)
  glow(x, y, c, halo = 0.28) {
    const rgb = hexRgb(c);
    const gx = Math.round(x) + this.ox, gy = Math.round(y) + this.oy;
    this.ctx.fillStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${halo})`;
    this.ctx.fillRect(gx - 1, gy, 3, 1);
    this.ctx.fillRect(gx, gy - 1, 1, 3);
    this.p(x, y, tone(c, 0.35));
  }

  // 1px silhouette outline around opaque pixels
  outline(color = OUTLINE) {
    const img = this.ctx.getImageData(0, 0, this.w, this.h);
    const a = img.data;
    const solid = (x, y) => x >= 0 && y >= 0 && x < this.w && y < this.h && a[(y * this.w + x) * 4 + 3] > 40;
    const edges = [];
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (solid(x, y)) continue;
      if (solid(x + 1, y) || solid(x - 1, y) || solid(x, y + 1) || solid(x, y - 1)) edges.push([x, y]);
    }
    this.ctx.fillStyle = color;
    for (const [x, y] of edges) this.ctx.fillRect(x, y, 1, 1);
  }

  canvas() { return this.cv; }

  // ---------- crisp toolkit (Phase G creature rework) ----------
  // Every primitive below writes whole pixels only (no canvas antialiasing) so
  // silhouettes stay razor-sharp when the renderer scales sprites.

  // Bresenham line, optional thickness (extends downward/rightward)
  line(x0, y0, x1, y1, c, thick = 1) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy, x = x0, y = y0;
    for (let guard = 0; guard < 4096; guard++) {
      this.r(x, y, thick, thick, c);
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x += sx; }
      if (e2 <= dx) { err += dx; y += sy; }
    }
  }

  // scanline-filled polygon (even-odd), sampled at pixel centres
  poly(pts, c) {
    const ys = pts.map((p) => p[1]);
    const y0 = Math.floor(Math.min(...ys)), y1 = Math.ceil(Math.max(...ys));
    for (let y = y0; y <= y1; y++) {
      const cy = y + 0.5;
      const xs = [];
      for (let i = 0; i < pts.length; i++) {
        const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length];
        if ((ay <= cy && by > cy) || (by <= cy && ay > cy)) xs.push(ax + ((cy - ay) / (by - ay)) * (bx - ax));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const xa = Math.round(xs[k]), xb = Math.round(xs[k + 1]);
        if (xb > xa) this.r(xa, y, xb - xa, 1, c);
        else this.p(xa, y, c);
      }
    }
  }

  // triangle helper: base at (x,y) width w, apex offset (ax, ay) relative to base centre
  wedge(x, y, w, ax, ay, c) {
    this.poly([[x, y], [x + w, y], [x + w / 2 + ax, y + ay]], c);
  }

  // cel-shaded ellipse: discrete tone bands (light upper-left, dark lower-right) + specular
  band(cx, cy, rx, ry, base, { steps = [0.26, 0.1, -0.12, -0.3], spec = true, tex = 0 } = {}) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x - cx) / rx, dy = (y - cy) / ry;
        const d = dx * dx + dy * dy;
        if (d > 1) continue;
        const l = (dx * 0.8 + dy) / 1.8; // -1 upper-left .. 1 lower-right
        const bandIdx = l < -0.45 ? 0 : l < 0.05 ? 1 : l < 0.5 ? 2 : 3;
        let c = tone(base, steps[bandIdx]);
        if (d > 0.82 && l > 0) c = tone(base, steps[3] - 0.08); // terminator edge
        if (tex && ((x * 7 + y * 13) % 11 === 0) && bandIdx >= 1) c = tone(c, -0.07);
        this.p(x, y, c);
      }
    }
    if (spec) {
      const sx = Math.round(cx - rx * 0.42), sy = Math.round(cy - ry * 0.5);
      this.p(sx, sy, tone(base, 0.5));
      if (rx > 5) this.p(sx + 1, sy, tone(base, 0.36));
    }
  }

  // eye with recorded rect (exact blink frames). style: 'round' | 'slit' | 'cluster'
  eye(x, y, w, h, iris, { glint = true, slit = false, sclera = null, pupil = '#05070b' } = {}) {
    x = Math.round(x); y = Math.round(y);
    this.r(x, y, w, h, sclera || iris);
    if (sclera) this.r(x + (w > 2 ? 1 : 0), y + (h > 2 ? 1 : 0), Math.max(1, w - (w > 2 ? 2 : 0)), Math.max(1, h - (h > 2 ? 2 : 0)), iris);
    if (slit) this.r(x + Math.floor(w / 2), y, 1, h, pupil);
    else if (w >= 3 && h >= 2) this.p(x + Math.floor(w / 2), y + Math.floor(h / 2), pupil);
    if (glint) this.p(x, y, '#ffffff');
    if (!this.eyes) this.eyes = [];
    this.eyes.push({ x: x + this.ox, y: y + this.oy, w, h });
  }

  // downward fang (predators): tapered tooth from (x, y) of length len
  fang(x, y, len, c = '#f1ede4') {
    for (let i = 0; i < len; i++) {
      const w = i < len - 1 ? Math.max(1, 2 - Math.floor(i / 2)) : 1;
      this.r(x, y + i, w, 1, i === 0 ? tone(c, -0.1) : c);
    }
    this.p(x, y + len - 1, tone(c, 0.2));
  }

  // hooked claw curving toward dir (+1 right / -1 left)
  claw(x, y, dir, c = '#e6e2d8', len = 2) {
    for (let i = 0; i < len; i++) this.p(x + dir * i, y + i, i === len - 1 ? tone(c, 0.25) : c);
  }

  // tapered spike/horn from base (x,y) of height h leaning `lean` px per step
  spike(x, y, h, c, lean = 0, base = 2) {
    for (let i = 0; i < h; i++) {
      const w = Math.max(1, Math.round(base * (1 - i / h)));
      const xx = Math.round(x + lean * i);
      this.r(xx, y - i, w, 1, i === h - 1 ? tone(c, 0.35) : i % 3 === 0 ? tone(c, 0.12) : c);
      if (w > 1) this.p(xx + w - 1, y - i, tone(c, -0.22)); // shaded right edge
    }
  }

  // 1px top-left edge light inside the silhouette (crisp readability at night)
  rim(color, alpha = 1) {
    const img = this.ctx.getImageData(0, 0, this.w, this.h);
    const a = img.data;
    const solid = (x, y) => x >= 0 && y >= 0 && x < this.w && y < this.h && a[(y * this.w + x) * 4 + 3] > 40;
    const pts = [];
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (!solid(x, y)) continue;
      if (!solid(x - 1, y) || !solid(x, y - 1)) pts.push([x, y]);
    }
    const rgb = hexRgb(color);
    this.ctx.fillStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`;
    for (const [x, y] of pts) this.ctx.fillRect(x, y, 1, 1);
  }
}

// ---------- animation constants (Phase G "rich" depth) ----------
export const IDLE_FRAMES = 6;
export const WALK_FRAMES = 8;
export const THREAT_FRAMES = 4;
export const LUNGE_FRAMES = 4;

// 8-phase gait: returns {dx, dy} stride offset for leg i. Legs cycle with a
// phase offset (quadruped walk = lateral sequence, trot = diagonal pairs).
// Swing legs lift (negative dy) while planted legs sweep backwards.
export function stride(f, i, { frames = WALK_FRAMES, amp = 2, lift = 2, order = [0, 0.5, 0.25, 0.75] } = {}) {
  const ph = ((f / frames) + (order[i % order.length] || 0)) % 1;
  const ang = ph * Math.PI * 2;
  const dx = Math.round(Math.cos(ang) * amp);
  const dy = ph < 0.5 ? -Math.round(Math.sin(ang) * lift) : 0;
  return { dx, dy };
}

// idle breathing curve for n frames (0..1..0)
export const breathe = (f, n = IDLE_FRAMES) => 0.5 - 0.5 * Math.cos((f / n) * Math.PI * 2);

// walk-cycle body bob: two footfalls per cycle, returns 0..-amp (whole px)
export const bobc = (f, amp = 2, n = WALK_FRAMES) => -Math.round(amp * Math.abs(Math.sin((f / n) * Math.PI * 2)));

// whole-body lunge kinematics per lunge frame: coil back → launch → full
// extension (airborne) → recoil. Applied by the baker through Px.shift().
export const LUNGE_KIN = [[-3, 0], [2, -1], [6, -2], [3, 0]];

// bake padding so raised hackles / spread wings / lunges never clip
export const PAD_X = 8, PAD_TOP = 6;

// crisp opaque outline colour used by the Phase G painters
export const INK = '#05090e';

// ---------- creature texture/anatomy helpers ----------
// overlaid scale arcs within an ellipse region (reptilian hide)
export function scales(P, cx, cy, rx, ry, base, seed = 0) {
  for (let ring = 0; ring < 3; ring++) {
    const rr = 0.35 + ring * 0.28;
    const n = 3 + ring * 2;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + ring * 0.4 + seed;
      const x = Math.round(cx + Math.cos(a) * rx * rr);
      const y = Math.round(cy + Math.sin(a) * ry * rr);
      P.p(x, y, tone(base, -0.16));
      P.p(x, y - 1, tone(base, 0.1));
    }
  }
}

// chitin striation bands across a region
export function striate(P, x, y, w, h, base, gap = 3) {
  for (let yy = 0; yy < h; yy += gap) {
    P.hl(x, y + yy, w, tone(base, -0.18));
    if (yy + 1 < h) P.hl(x, y + yy - 1, w, tone(base, 0.08));
  }
}

// fur / filament strokes rising from a baseline
export function filaments(P, x, y, w, base, hgt, phase = 0, tipColor = null) {
  for (let i = 0; i < w; i += 2) {
    const hh = hgt - 1 + ((i / 2 + phase) % 2);
    P.vl(x + i, y - hh, hh, i % 4 === 0 ? tone(base, 0.14) : base);
    if (tipColor && (i / 2 + phase) % 3 === 0) P.p(x + i, y - hh - 1, tipColor);
  }
}

// rim light along the top-left arc of an ellipse (readability at night)
export function rimlight(P, cx, cy, rx, ry, color) {
  for (let k = 0; k < 7; k++) {
    const a = Math.PI * (0.95 + k * 0.05);
    const x = Math.round(cx + Math.cos(a) * rx);
    const y = Math.round(cy + Math.sin(a) * ry);
    P.p(x, y, color);
  }
}

// 4-frame quadruped/multiped gait offsets for leg i
export function gait(f, i) {
  const ph = (f + (i % 2) * 2) % 4;
  return [
    { dx: 1, dy: 0 },
    { dx: 0, dy: -1 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: 0 },
  ][ph];
}

// articulated leg: hip → knee → foot with joint pixel
export function limb(P, hipX, hipY, footX, footY, color, kneeBias = 0.5, thick = 1) {
  const kx = Math.round(hipX + (footX - hipX) * 0.5 + kneeBias);
  const ky = Math.round(hipY + (footY - hipY) * 0.45);
  const seg = (x0, y0, x1, y1) => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let s = 0; s <= n; s++) {
      const x = Math.round(x0 + (x1 - x0) * (s / n || 0));
      const y = Math.round(y0 + (y1 - y0) * (s / n || 0));
      P.r(x, y, thick, 1, color);
    }
  };
  seg(hipX, hipY, kx, ky);
  seg(kx, ky, footX, footY);
  P.p(kx, ky, tone(color, 0.15)); // knee joint
  P.r(footX, footY, thick + 1, 1, tone(color, -0.3)); // foot
}

// ---------- iso helpers for buildings ----------
// tile in art px: half of device (TILE_W 64 -> 32, TILE_H 32 -> 16)
export const ISO_W = 32, ISO_H = 16;

// paint an iso box (footprint w×h tiles, wall height z art px) into painter P
// origin: top corner of footprint diamond at (ox, oy)
export function isoBox(P, ox, oy, w, h, z, top, right, left, opts = {}) {
  const hw = ISO_W / 2, hh = ISO_H / 2;
  const pt = (tx, ty) => [ox + (tx - ty) * hw, oy + (tx + ty) * hh];
  const [ax, ay] = pt(0, 0), [bx, by] = pt(w, 0), [cx, cy] = pt(w, h), [dx, dy] = pt(0, h);
  const ctx = P.ctx;
  const face = (pts, base, lite, dark, tex) => {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.clip();
    const minX = Math.min(...pts.map((p) => p[0])), maxX = Math.max(...pts.map((p) => p[0]));
    const minY = Math.min(...pts.map((p) => p[1])), maxY = Math.max(...pts.map((p) => p[1]));
    for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
      const t = (y - minY) / Math.max(1, maxY - minY);
      let c = t < 0.5 ? tone(base, (0.5 - t) * 2 * lite) : tone(base, -(t - 0.5) * 2 * dark);
      ctx.fillStyle = c;
      ctx.fillRect(Math.floor(minX), y, Math.ceil(maxX - minX) + 1, 1);
      if (tex) {
        ctx.fillStyle = tone(c, -0.09);
        for (let x = Math.floor(minX); x <= maxX; x++) if ((x * 7 + y * 13) % 17 === 0) ctx.fillRect(x, y, 1, 1);
      }
    }
    ctx.restore();
  };
  // left face (SW): between D and C
  face([[dx, dy - z], [cx, cy - z], [cx, cy], [dx, dy]], left, 0.1, 0.2, opts.tex);
  // right face (SE): between C and B
  face([[cx, cy - z], [bx, by - z], [bx, by], [cx, cy]], right, 0.06, 0.26, opts.tex);
  // top face
  face([[ax, ay - z], [bx, by - z], [cx, cy - z], [dx, dy - z]], top, 0.2, 0.12, opts.tex);
  // edge highlights (top-left lit)
  ctx.strokeStyle = tone(top, 0.3);
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(ax, ay - z); ctx.lineTo(dx, dy - z); ctx.stroke();
  ctx.strokeStyle = 'rgba(5,9,14,0.55)';
  ctx.beginPath(); ctx.moveTo(dx, dy); ctx.lineTo(cx, cy); ctx.lineTo(bx, by); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx, cy - z); ctx.stroke();
  return { pt, z };
}
