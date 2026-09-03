// ---- Creature sprite sheet registry (lazy-baked, cached) ----
import { Px, SPRITE_SCALE, INK, LUNGE_KIN, PAD_X, PAD_TOP } from './pixel';
import { CREATURES_A } from './creatures_a';
import { CREATURES_B } from './creatures_b';
import { CREATURES_C } from './creatures_c';

export const CREATURE_ART = { ...CREATURES_A, ...CREATURES_B, ...CREATURES_C };

const cache = new Map();

// ---------- idle life: blink frames ----------
// Preferred path: painters register eyes through P.eye(), so the closed-eye
// frame is exact (eye rects shaded with the darkest neighbouring body tone).
// Fallback path (legacy painters): detect pale, low-saturation highlight
// clusters in the upper body and shade them the same way.
const EYE_MIN_BRIGHT = 196;
const EYE_MAX_CHROMA = 70;
const EYE_MAX_CLUSTER = 6;

function isEyeColor(d, i) {
  const r = d[i], g = d[i + 1], b = d[i + 2], a = d[i + 3];
  if (a < 200) return false;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  return mx >= EYE_MIN_BRIGHT && mx - mn <= EYE_MAX_CHROMA;
}

function eyeCluster(d, w, h, start, seen) {
  const stack = [start];
  const out = [];
  seen[start] = 1;
  while (stack.length) {
    const p = stack.pop();
    out.push(p);
    if (out.length > EYE_MAX_CLUSTER) return null;
    const x = p % w, y = Math.floor(p / w);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const q = ny * w + nx;
      if (seen[q] || !isEyeColor(d, q * 4)) continue;
      seen[q] = 1;
      stack.push(q);
    }
  }
  return out;
}

// darkest opaque neighbour within `reach` px that is not itself an eye pixel — the lid colour
function lidColor(d, w, h, p, eyeSet, reach = 3) {
  const x = p % w, y = Math.floor(p / w);
  let best = null, bestL = Infinity;
  for (let dy = -reach; dy <= reach; dy++) for (let dx = -reach; dx <= reach; dx++) {
    const nx = x + dx, ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
    const q = ny * w + nx;
    if (eyeSet.has(q)) continue;
    const i = q * 4;
    if (d[i + 3] < 200) continue;
    const l = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11;
    if (l < 12) continue; // skip ink outline
    if (l < bestL) { bestL = l; best = [d[i], d[i + 1], d[i + 2]]; }
  }
  return best;
}

function shadeEyes(src, eyePixels) {
  const w = src.width, h = src.height;
  const ctx = src.getContext('2d', { willReadFrequently: true });
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const out = document.createElement('canvas');
  out.width = w; out.height = h;
  const octx = out.getContext('2d');
  octx.imageSmoothingEnabled = false;
  const copy = octx.createImageData(w, h);
  copy.data.set(d);
  const eyeSet = new Set(eyePixels);
  for (const p of eyePixels) {
    const lid = lidColor(d, w, h, p, eyeSet);
    if (!lid) continue;
    const i = p * 4;
    copy.data[i] = lid[0]; copy.data[i + 1] = lid[1]; copy.data[i + 2] = lid[2]; copy.data[i + 3] = 255;
  }
  octx.putImageData(copy, 0, 0);
  return out;
}

// Legacy heuristic (no recorded eyes): returns { canvas, eyes }
export function deriveBlinkFrame(src) {
  const w = src.width, h = src.height;
  const ctx = src.getContext('2d', { willReadFrequently: true });
  const d = ctx.getImageData(0, 0, w, h).data;
  const seen = new Uint8Array(w * h);
  const eyes = [];
  const topLimit = Math.ceil(h * 0.85);
  for (let y = 0; y < topLimit; y++) for (let x = 0; x < w; x++) {
    const p = y * w + x;
    if (seen[p] || !isEyeColor(d, p * 4)) continue;
    const cluster = eyeCluster(d, w, h, p, seen);
    if (cluster) eyes.push(...cluster);
  }
  if (!eyes.length) return { canvas: null, eyes: 0 };
  return { canvas: shadeEyes(src, eyes), eyes: eyes.length };
}

// Opaque bounding box of a baked frame (trims bake padding for UI fitting)
function opaqueBounds(cv) {
  const w = cv.width, h = cv.height;
  const d = cv.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (d[(y * w + x) * 4 + 3] <= 40) continue;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  if (x1 < 0) return { x: 0, y: 0, w, h };
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

// Exact blink frame from recorded eye rects
function blinkFromRects(src, rects) {
  const w = src.width;
  const px = [];
  for (const r of rects) for (let yy = 0; yy < r.h; yy++) for (let xx = 0; xx < r.w; xx++) {
    const x = r.x + xx, y = r.y + yy;
    if (x >= 0 && y >= 0 && x < src.width && y < src.height) px.push(y * w + x);
  }
  if (!px.length) return { canvas: null, eyes: 0 };
  return { canvas: shadeEyes(src, px), eyes: px.length };
}

export function getCreatureSheet(id) {
  if (cache.has(id)) return cache.get(id);
  const def = CREATURE_ART[id];
  if (!def) return null;
  const hires = def.scale === 1; // Phase G painters: 1 art px = 1 device px
  const outlineColor = hires ? INK : undefined; // hi-res painters get a fully opaque ink line
  // bake padding keeps raised hackles / spread wings / lunges inside the canvas;
  // symmetric x-padding preserves the sprite centre, top padding keeps the ground row at the bottom
  const padX = hires ? PAD_X : 0, padTop = hires ? PAD_TOP : 0;
  const W = def.w + padX * 2, H = def.h + padTop;
  const bake = (mode, n) => {
    const frames = [], eyes = [];
    for (let f = 0; f < n; f++) {
      const P = new Px(W, H);
      // lunge: whole-body coil → launch → extension → recoil, applied as a whole-pixel origin shift
      const kin = mode === 'lunge' ? LUNGE_KIN[f % LUNGE_KIN.length] : [0, 0];
      P.shift(padX + kin[0], padTop + kin[1]);
      def.paint(P, f, mode);
      P.shift(0, 0);
      P.outline(outlineColor);
      frames.push(P.canvas());
      eyes.push(P.eyes || []);
    }
    return { frames, eyes };
  };
  const idle = bake('idle', def.idleFrames || 3);
  const walk = def.walkFrames ? bake('walk', def.walkFrames) : null;
  const threat = def.threatFrames ? bake('threat', def.threatFrames) : null;
  const lunge = def.lungeFrames ? bake('lunge', def.lungeFrames) : null;
  // blink variants aligned 1:1 with idle frames (exact when eyes were recorded)
  const blinks = idle.frames.map((cv, i) => (idle.eyes[i] && idle.eyes[i].length ? blinkFromRects(cv, idle.eyes[i]) : deriveBlinkFrame(cv)));
  const hasEyes = blinks.some((b) => b.canvas);
  const sheet = {
    idle: idle.frames,
    walk: walk ? walk.frames : null,
    threat: threat ? threat.frames : null,
    lunge: lunge ? lunge.frames : null,
    blink: hasEyes ? blinks.map((b, i) => b.canvas || idle.frames[i]) : null,
    eyes: idle.eyes[0] || null,
    // exact eye rects per mode/frame (drives night eye-glow that tracks the animation)
    eyesBy: { idle: idle.eyes, walk: walk ? walk.eyes : null, threat: threat ? threat.eyes : null, lunge: lunge ? lunge.eyes : null },
    w: W, h: H,
    bounds: opaqueBounds(idle.frames[0]), // trimmed silhouette box (portraits / UI fitting)
    scale: def.scale ?? SPRITE_SCALE,
    shadow: def.shadow || { rx: 8, ry: 3, alpha: 0.3 },
    bob: !!def.bob,
    hover: def.hover || 0,
    aura: def.aura || null,
    menace: def.menace || null, // predator eye-glow colour (night / threat / lunge)
    pace: def.pace || 1,        // animation cadence multiplier (heavier bodies move slower)
  };
  cache.set(id, sheet);
  return sheet;
}
