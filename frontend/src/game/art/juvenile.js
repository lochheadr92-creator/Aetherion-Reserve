// ---- Juvenile proportions (render/art layer) ----
// Newborns read as "big head, stubby legs". Rather than hand-painting 19 more creatures,
// a juvenile sheet is DERIVED from the baked adult sheet by a deterministic image-space
// transform, one stage at a time:
//   cub    growth <  0.5   head x1.4, legs x0.6, torso x0.9
//   young  0.5 <= growth   head x1.18, legs x0.8, torso x0.95
// The transform is pure canvas geometry (no Math.random, no DOM beyond an offscreen canvas):
//   1. legs  — the bottom `legFrac` of the silhouette is squashed toward the ground row
//   2. torso — everything above the hip line is squashed toward the new hip line
//   3. head  — an elliptical region anchored on the frame's recorded eye rects is enlarged and
//              pasted back over the torso (nearest-neighbour: still pixel art)
//   4. gaps  — a 1px INK repair closes any outline row dropped by the down-scaling
// Eye rects are remapped through the same geometry so blink frames and the predator night
// eye-glow keep tracking the animation exactly. The ground row never moves, so the renderer's
// bottom-anchored draw needs no change. Adult sheets are untouched.
import { INK, hexRgb } from './pixel';

export const JUVENILE_STAGES = {
  cub: { head: 1.4, legs: 0.6, torso: 0.9, legFrac: 0.35 },
  young: { head: 1.18, legs: 0.8, torso: 0.95, legFrac: 0.35 },
};

// growth 0..1 -> stage key ('adult' when not a juvenile)
export function juvenileStage(c) {
  if (!c || !c.juvenile) return 'adult';
  return (c.growth || 0) < 0.5 ? 'cub' : 'young';
}

const SOLID_A = 200;      // fully painted pixel (excludes the ART_V2 halo, alpha <= 0.35)
const INK_LUMA = 12;
const [INK_R, INK_G, INK_B] = hexRgb(INK);

// Vertical geometry shared by every frame of a species/stage so the animation stays coherent.
export function juvenileGeometry(bounds, params) {
  const b = bounds;
  const gy = b.y + b.h;                                  // ground row (exclusive)
  const hipY = Math.round(gy - b.h * params.legFrac);    // hip line
  const legH = gy - hipY, legH2 = Math.max(1, Math.round(legH * params.legs));
  const hip2 = gy - legH2;                               // new hip line
  const mapY = (y) => (y < hipY ? hip2 - (hipY - y) * params.torso : gy - (gy - y) * params.legs);
  const rw = Math.max(3, Math.round(Math.min(b.w * 0.3, b.h * 0.34)));
  const rh = Math.max(3, Math.round(b.h * 0.22));
  return { bounds: b, gy, hipY, legH, legH2, hip2, mapY, rw, rh };
}

// Head anchor for one frame: centre of its recorded eye rects, else a species-relative guess.
export function headAnchor(eyes, bounds) {
  if (!eyes || !eyes.length) return { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h * 0.22 };
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const e of eyes) { x0 = Math.min(x0, e.x); y0 = Math.min(y0, e.y); x1 = Math.max(x1, e.x + e.w); y1 = Math.max(y1, e.y + e.h); }
  return { x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
}

function repairOutline(cv) {
  const w = cv.width, h = cv.height;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  const img = ctx.getImageData(0, 0, w, h), d = img.data;
  const solidBody = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return false;
    const i = (y * w + x) * 4;
    if (d[i + 3] < SOLID_A) return false;
    return d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11 >= INK_LUMA; // painted, not ink
  };
  const fix = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    if (d[i + 3] >= SOLID_A) continue;                   // already solid (body or ink)
    if (solidBody(x + 1, y) || solidBody(x - 1, y) || solidBody(x, y + 1) || solidBody(x, y - 1)) fix.push(i);
  }
  for (const i of fix) { d[i] = INK_R; d[i + 1] = INK_G; d[i + 2] = INK_B; d[i + 3] = 255; }
  ctx.putImageData(img, 0, 0);
  return cv;
}

// Trimmed silhouette box of fully painted pixels (halo excluded)
export function solidBounds(cv) {
  const w = cv.width, h = cv.height;
  const d = cv.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (d[(y * w + x) * 4 + 3] < SOLID_A) continue;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  if (x1 < 0) return { x: 0, y: 0, w, h };
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

// Transform one baked frame around this frame's head anchor.
export function juvenileFrame(src, geo, anchor, params) {
  const W = src.width, H = src.height;
  const out = document.createElement('canvas');
  out.width = W; out.height = H;
  const ctx = out.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = false;
  const { gy, hipY, legH, legH2, hip2, rw, rh } = geo;
  // 1. legs: rows [hipY, gy) squashed onto [hip2, gy)
  if (legH > 0) ctx.drawImage(src, 0, hipY, W, legH, 0, hip2, W, legH2);
  // 2. torso + head + top padding: rows [0, hipY) squashed toward the new hip line
  const topH = Math.max(1, Math.round(hipY * params.torso));
  ctx.drawImage(src, 0, 0, W, hipY, 0, hip2 - topH, W, topH);
  // rows below the ground line (normally empty) copy as-is
  if (gy < H) ctx.drawImage(src, 0, gy, W, H - gy, 0, gy, W, H - gy);
  // 3. head: enlarge an ellipse around the eye anchor and paste it over the torso
  let sx = Math.round(anchor.x - rw), sy = Math.round(anchor.y - rh), sw = rw * 2, sh = rh * 2;
  if (sx < 0) { sw += sx; sx = 0; }
  if (sy < 0) { sh += sy; sy = 0; }
  sw = Math.min(sw, W - sx); sh = Math.min(sh, H - sy);
  if (sw > 0 && sh > 0) {
    const cx2 = anchor.x, cy2 = geo.mapY(anchor.y);
    const dw = Math.round(sw * params.head), dh = Math.round(sh * params.head);
    const dx = Math.round(cx2 - dw / 2), dy = Math.round(cy2 - dh / 2);
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(dx + dw / 2, dy + dh / 2, dw / 2, dh / 2, 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(src, sx, sy, sw, sh, dx, dy, dw, dh);
    ctx.restore();
  }
  return repairOutline(out);
}

// Remap a frame's eye rects through the head enlargement.
export function juvenileEyes(eyes, geo, anchor, params) {
  if (!eyes || !eyes.length) return eyes || [];
  const cx2 = anchor.x, cy2 = geo.mapY(anchor.y), k = params.head;
  return eyes.map((e) => {
    const ecx = e.x + e.w / 2, ecy = e.y + e.h / 2;
    const w = Math.max(1, Math.round(e.w * k)), h = Math.max(1, Math.round(e.h * k));
    return { x: Math.round(cx2 + (ecx - anchor.x) * k - w / 2), y: Math.round(cy2 + (ecy - anchor.y) * k - h / 2), w, h };
  });
}

// Derive a whole sheet (idle/walk/threat/lunge/blink + eye rects) from an adult sheet.
export function deriveJuvenileSheet(adult, stage) {
  const params = JUVENILE_STAGES[stage];
  if (!params) return adult;
  const b = adult.bounds || { x: 0, y: 0, w: adult.w, h: adult.h };
  const geo = juvenileGeometry(b, params);
  const idleAnchor = headAnchor(adult.eyes, b);
  // per-frame anchors follow the recorded eyes (walk bob, lunge shift); fall back to idle
  const anchorFor = (rects) => (rects && rects.length ? headAnchor(rects, b) : idleAnchor);
  const frames = (list, eyesList) => (list ? list.map((cv, i) => juvenileFrame(cv, geo, anchorFor(eyesList && eyesList[i]), params)) : null);
  const eyesOf = (eyesList) => (eyesList ? eyesList.map((rects) => juvenileEyes(rects, geo, anchorFor(rects), params)) : null);
  const by = adult.eyesBy || {};
  const idle = frames(adult.idle, by.idle);
  return {
    ...adult,
    idle,
    walk: frames(adult.walk, by.walk),
    threat: frames(adult.threat, by.threat),
    lunge: frames(adult.lunge, by.lunge),
    blink: frames(adult.blink, by.idle), // blink frames are aligned 1:1 with idle frames
    eyes: juvenileEyes(adult.eyes || [], geo, idleAnchor, params),
    eyesBy: { idle: eyesOf(by.idle), walk: eyesOf(by.walk), threat: eyesOf(by.threat), lunge: eyesOf(by.lunge) },
    bounds: solidBounds(idle[0]),
    shadow: { ...adult.shadow, rx: adult.shadow.rx * 0.85 },
    stage,
  };
}
