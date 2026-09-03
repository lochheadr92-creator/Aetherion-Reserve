// ---- Shared anatomy rig for the Phase G creature painters ----
// Reusable, resolution-independent builders: articulated legs with a 6-phase
// gait, tails, spine ridges, jaws with fangs. Every builder writes crisp whole
// pixels through the Px toolkit so silhouettes stay sharp at any zoom.
import { tone, mixc, stride } from './pixel';

// Articulated legs. `hips` = [[x, y], ...] from back to front. Legs in the
// first half are the far side (drawn darker); call once with far:true before
// the torso and once with far:false after it for correct layering.
export function legs(P, {
  hips, ground, f, mode, color, thick = 2, amp = 2, lift = 2, order,
  kneeBias = 0, foot = null, claws = null, clawColor = '#e6e2d8', far = false,
  crouch = 0, shinThick = null,
}) {
  hips.forEach(([hx, hy], i) => {
    const g = mode === 'walk' ? stride(f, i, { amp, lift, order }) : { dx: 0, dy: 0 };
    const fx = hx + g.dx;
    const fy = ground + g.dy;
    const shade = far ? -0.3 : 0;
    const kx = Math.round(hx + (fx - hx) * 0.5 + kneeBias);
    const ky = Math.round(hy + crouch + (fy - hy - crouch) * 0.5);
    P.line(hx, hy, kx, ky, tone(color, shade), thick);
    P.line(kx, ky, fx, fy - 1, tone(color, shade - 0.1), shinThick ?? Math.max(1, thick - 1));
    P.r(kx, ky, thick, 1, tone(color, shade + 0.14)); // knee cap
    P.r(fx - 1, fy - 1, thick + 2, 1, foot || tone(color, shade - 0.4)); // foot pad
    if (claws) for (let k = 0; k < claws; k++) P.p(fx + thick + 1 + k, fy - 1 + (k % 2), k === 0 ? clawColor : tone(clawColor, -0.2));
  });
}

// Tapering tail from (x, y) sweeping to (tx, ty); `sway` shifts the tip.
export function tail(P, x, y, tx, ty, color, { thick = 3, sway = 0, tip = null, segs = 8 } = {}) {
  for (let s = 0; s <= segs; s++) {
    const t = s / segs;
    const px = Math.round(x + (tx - x) * t + sway * t * t);
    const py = Math.round(y + (ty - y) * t + Math.sin(t * Math.PI) * -1.5);
    const w = Math.max(1, Math.round(thick * (1 - t * 0.75)));
    P.r(px, py, w, w, tone(color, -0.05 - t * 0.2));
    if (w > 1) P.p(px, py, tone(color, 0.14));
  }
  if (tip) {
    const px = Math.round(tx + sway), py = Math.round(ty);
    P.r(px - 1, py, 2, 2, tip);
    P.p(px, py - 1, tone(tip, 0.3));
  }
}

// Dorsal ridge / hackles along the back: points [[x,y],...] with spike heights
export function ridge(P, pts, color, { h = 3, lean = 0.4, raised = 0 } = {}) {
  pts.forEach(([x, y], i) => P.spike(x, y, h + (i % 2) + raised, color, lean, 2));
}

// Predator jaw: upper skull block + lower jaw that swings open by `open` px,
// fangs on both rows. Draws facing right from muzzle origin (x = back of skull).
export function jaw(P, { x, y, w, h, color, open = 0, fangs = 3, fangLen = 3, gum = '#3a0f18', tongue = null, lip = null }) {
  const lipC = lip || tone(color, -0.35);
  // upper jaw
  P.slab(x, y, w, h, tone(color, 0.06));
  P.hl(x, y + h - 1, w, lipC);
  // mouth cavity when open
  if (open > 0) {
    P.r(x + Math.round(w * 0.35), y + h, Math.round(w * 0.65), open, gum);
    if (tongue) P.r(x + Math.round(w * 0.55), y + h + Math.max(1, open - 2), Math.round(w * 0.3), 1, tongue);
  }
  // lower jaw
  const ly = y + h + open;
  P.slab(x + Math.round(w * 0.3), ly, Math.round(w * 0.7), Math.max(2, h - 2), tone(color, -0.16));
  P.hl(x + Math.round(w * 0.3), ly, Math.round(w * 0.7), lipC);
  // fangs: upper row hangs down, lower row points up
  for (let k = 0; k < fangs; k++) {
    const fx = x + w - 2 - k * 3;
    P.fang(fx, y + h, fangLen);
    if (open > 1) { P.p(fx + 1, ly - 1, '#f1ede4'); P.p(fx + 1, ly - 2, '#fbfaf6'); }
  }
}

// Blocky flank plate rows (armour) inside a region
export function plates(P, x, y, w, h, color, cell = 5) {
  for (let yy = 0; yy < h; yy += cell) for (let xx = (yy / cell) % 2 ? cell / 2 : 0; xx < w; xx += cell) {
    const cw = Math.min(cell - 1, w - xx), ch = Math.min(cell - 1, h - yy);
    if (cw <= 0 || ch <= 0) continue;
    P.r(x + xx, y + yy, cw, ch, tone(color, 0.04));
    P.hl(x + xx, y + yy, cw, tone(color, 0.18));
    P.vl(x + xx + cw - 1, y + yy, ch, tone(color, -0.2));
  }
}

// Hard-edged stripe pattern across a body region (war stripes / camouflage)
export function stripes(P, x, y, w, h, color, gap = 4, slant = 1) {
  for (let xx = 0; xx < w; xx += gap) for (let yy = 0; yy < h; yy++) {
    const sx = x + xx + Math.round(yy * slant * 0.5);
    if (sx < x + w) P.p(sx, y + yy, color);
  }
}

export { mixc };
