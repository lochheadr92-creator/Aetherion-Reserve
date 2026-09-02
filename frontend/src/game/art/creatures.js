// ---- Creature sprite sheet registry (lazy-baked, cached) ----
import { Px } from './pixel';
import { CREATURES_A } from './creatures_a';
import { CREATURES_B } from './creatures_b';
import { CREATURES_C } from './creatures_c';

export const CREATURE_ART = { ...CREATURES_A, ...CREATURES_B, ...CREATURES_C };

const cache = new Map();

// ---------- idle life: auto-derived blink frames ----------
// Every painter draws eyes as small pale, low-saturation highlights. Rather than
// hand-authoring closed-eye art for 20+ species, we detect those pixels in the
// upper body of each baked idle frame and shade them with a neighbouring body
// tone. The result is a matching "eyes shut" frame the renderer flashes for a
// few frames on a per-creature cadence.
const EYE_MIN_BRIGHT = 196;   // channel max above this ...
const EYE_MAX_CHROMA = 70;    // ... with little colour spread reads as an eye highlight
const EYE_MAX_CLUSTER = 6;    // larger pale areas are markings/bellies, not eyes

function isEyeColor(d, i) {
  const r = d[i], g = d[i + 1], b = d[i + 2], a = d[i + 3];
  if (a < 200) return false;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  return mx >= EYE_MIN_BRIGHT && mx - mn <= EYE_MAX_CHROMA;
}

// flood-fill connected pale pixels; returns cluster indices (or null if too big)
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

// darkest opaque, non-pale neighbour within 2px — the lid colour
function lidColor(d, w, h, p) {
  const x = p % w, y = Math.floor(p / w);
  let best = null, bestL = Infinity;
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    const nx = x + dx, ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
    const i = (ny * w + nx) * 4;
    if (d[i + 3] < 200 || isEyeColor(d, i)) continue;
    const l = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11;
    if (l < bestL) { bestL = l; best = [d[i], d[i + 1], d[i + 2]]; }
  }
  return best;
}

// returns { canvas, eyes } — canvas is null when no eye pixels were found
export function deriveBlinkFrame(src) {
  const w = src.width, h = src.height;
  const ctx = src.getContext('2d', { willReadFrequently: true });
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const seen = new Uint8Array(w * h);
  const eyes = [];
  const topLimit = Math.ceil(h * 0.85); // eyes live above the feet/ground row
  for (let y = 0; y < topLimit; y++) for (let x = 0; x < w; x++) {
    const p = y * w + x;
    if (seen[p] || !isEyeColor(d, p * 4)) continue;
    const cluster = eyeCluster(d, w, h, p, seen);
    if (cluster) eyes.push(...cluster);
  }
  if (!eyes.length) return { canvas: null, eyes: 0 };
  const out = document.createElement('canvas');
  out.width = w; out.height = h;
  const octx = out.getContext('2d');
  octx.imageSmoothingEnabled = false;
  const copy = octx.createImageData(w, h);
  copy.data.set(d);
  for (const p of eyes) {
    const lid = lidColor(d, w, h, p);
    if (!lid) continue;
    const i = p * 4;
    copy.data[i] = lid[0]; copy.data[i + 1] = lid[1]; copy.data[i + 2] = lid[2];
  }
  octx.putImageData(copy, 0, 0);
  return { canvas: out, eyes: eyes.length };
}

export function getCreatureSheet(id) {
  if (cache.has(id)) return cache.get(id);
  const def = CREATURE_ART[id];
  if (!def) return null;
  const bake = (mode, n) => {
    const frames = [];
    for (let f = 0; f < n; f++) {
      const P = new Px(def.w, def.h);
      def.paint(P, f, mode);
      P.outline();
      frames.push(P.canvas());
    }
    return frames;
  };
  const idle = bake('idle', def.idleFrames || 3);
  // blink variants aligned 1:1 with idle frames (null entries fall back to open eyes)
  const blinks = idle.map((cv) => deriveBlinkFrame(cv));
  const hasEyes = blinks.some((b) => b.canvas);
  const sheet = {
    idle,
    walk: def.walkFrames ? bake('walk', def.walkFrames) : null,
    blink: hasEyes ? blinks.map((b, i) => b.canvas || idle[i]) : null,
    w: def.w, h: def.h,
    shadow: def.shadow || { rx: 8, ry: 3, alpha: 0.3 },
    bob: !!def.bob,
    hover: def.hover || 0,
  };
  cache.set(id, sheet);
  return sheet;
}
