// ---- Building iso pixel sprites (all existing types; footprints/function untouched) ----
import { Px, tone, mixc, isoBox } from './pixel';
import { BUILDINGS } from '../data/buildings';

// wall heights in ART px (device = 2x)
const Z = {
  admin: 22, lab: 19, power: 21, security_post: 18, tower: 36, viewing: 12,
  food_stall: 15, drink_stall: 13, restroom: 12, gift_shop: 16, shelter: 11,
  feeder_forage: 6, feeder_meat: 6, feeder_mineral: 6, feeder_fungal: 7, feeder_energy: 11,
};
const TOP_PAD = { admin: 14, lab: 8, power: 9, security_post: 10, tower: 12, viewing: 8, gift_shop: 6, food_stall: 6, drink_stall: 6, feeder_energy: 6 };

// small helpers -------------------------------------------------------------
function doorOnLeft(P, g, z, lit) {
  // left face runs D(0,h)->C(w,h)
  const [dx, dy] = g.pt(0, g.h), [cx, cy] = g.pt(g.w, g.h);
  const mx = Math.round((dx + cx) / 2), my = Math.round((dy + cy) / 2);
  P.r(mx - 2, my - 7, 4, 7, '#0d141c');
  P.hl(mx - 2, my - 7, 4, tone('#22303e', 0.15));
  if (lit) P.p(mx + 3, my - 6, lit);
}

function beacon(P, x, y, color, on) {
  P.vl(x, y - 3, 3, '#3a4a60');
  if (on) P.glow(x, y - 4, color, 0.35);
  else P.p(x, y - 4, tone(color, -0.35));
}

function awningFront(P, g, z, colA, colB) {
  // stripes along left face top edge
  const [dx, dy] = g.pt(0, g.h), [cx, cy] = g.pt(g.w, g.h);
  const n = Math.max(4, Math.round((cx - dx) / 4));
  for (let i = 0; i < n; i++) {
    const t = i / n, t2 = (i + 1) / n;
    const x0 = dx + (cx - dx) * t, x1 = dx + (cx - dx) * t2;
    const y0 = dy + (cy - dy) * t - z;
    P.r(Math.round(x0), Math.round(y0) + 1, Math.max(1, Math.round(x1 - x0)), 2, i % 2 ? colA : colB);
  }
}

function roofCenter(g, z) {
  const [ax, ay] = g.pt(g.w / 2, g.h / 2);
  return [Math.round(ax), Math.round(ay - z)];
}

// per-type detailing --------------------------------------------------------
const DETAIL = {
  admin(P, g, z, f, def) {
    doorOnLeft(P, g, z, def.light);
    const [rx, ry] = roofCenter(g, z);
    // comms mast + dish
    P.vl(rx + 6, ry - 12, 12, '#4a5a70');
    P.hl(rx + 4, ry - 12, 5, '#4a5a70');
    P.blob(rx + 2, ry - 10, 2.4, 1.6, '#7a8ba0', { lite: 0.25 });
    beacon(P, rx + 6, ry - 12, def.light, f === 0);
    // roof vents + light strip
    P.r(rx - 8, ry - 2, 4, 3, '#22303e'); P.hl(rx - 8, ry - 2, 4, tone('#22303e', 0.3));
    const [lx, ly] = g.pt(0, g.h);
    P.hl(lx + 2, ly - z + 3, 8, def.light);
    // wall panel seams
    P.p(rx - 4, ry + 6, tone('#22303e', 0.2));
  },
  lab(P, g, z, f, def) {
    doorOnLeft(P, g, z, def.light);
    // glass scan band around both faces
    const [dx0, dy0] = g.pt(0, g.h), [cx0, cy0] = g.pt(g.w, g.h), [bx0, by0] = g.pt(g.w, 0);
    const band = (x0, y0, x1, y1) => {
      const n = Math.round(Math.hypot(x1 - x0, y1 - y0) / 2);
      for (let i = 0; i <= n; i++) {
        const x = Math.round(x0 + (x1 - x0) * (i / n)), y = Math.round(y0 + (y1 - y0) * (i / n)) - Math.round(z * 0.55);
        const sweep = (i + f * 3) % 8 === 0;
        P.r(x, y, 2, 2, sweep ? tone(def.light, 0.3) : mixc('#16323a', def.light, 0.35));
      }
    };
    band(dx0, dy0, cx0, cy0); band(cx0, cy0, bx0, by0);
    // roof sensor pods
    const [rx, ry] = roofCenter(g, z);
    P.blob(rx - 5, ry - 1, 2.2, 1.4, '#3b4c5e', { lite: 0.25 });
    P.blob(rx + 4, ry - 2, 1.8, 1.2, '#3b4c5e', { lite: 0.25 });
    P.p(rx + 4, ry - 3, f === 0 ? def.light : tone(def.light, -0.3));
    P.vl(rx, ry - 7, 6, '#4a5a70'); P.p(rx, ry - 8, tone(def.light, 0.2));
  },
  power(P, g, z, f, def) {
    const [rx, ry] = roofCenter(g, z);
    // relay core cylinder + coil rings
    P.slab(rx - 3, ry - 9, 6, 9, '#3a4453', { tex: 1 });
    P.hl(rx - 3, ry - 9, 6, tone('#3a4453', 0.3));
    for (let k = 0; k < 3; k++) {
      const on = (k + f) % 2 === 0;
      P.hl(rx - 4, ry - 7 + k * 3, 8, on ? def.light : tone(def.light, -0.45));
    }
    P.glow(rx, ry - 10, def.light, f === 0 ? 0.4 : 0.2);
    // ground conduits to corners
    const [dx0, dy0] = g.pt(0, g.h);
    P.hl(dx0 + 3, dy0 - z + 4, 6, tone(def.light, -0.2));
    // vents
    P.r(rx + 5, ry + 4, 3, 2, '#20293a');
  },
  security_post(P, g, z, f, def) {
    doorOnLeft(P, g, z, def.light);
    // warning stripe on right face
    const [cx0, cy0] = g.pt(g.w, g.h), [bx0, by0] = g.pt(g.w, 0);
    const n = Math.round(Math.hypot(bx0 - cx0, by0 - cy0) / 3);
    for (let i = 0; i < n; i++) {
      const x = Math.round(cx0 + (bx0 - cx0) * (i / n)), y = Math.round(cy0 + (by0 - cy0) * (i / n)) - 4;
      P.r(x, y, 2, 2, i % 2 ? '#f2c14e' : '#1a1216');
    }
    // emitter mast + rotating strobe
    const [rx, ry] = roofCenter(g, z);
    P.slab(rx - 2, ry - 6, 4, 6, '#2e2228');
    P.hl(rx - 2, ry - 6, 4, tone('#2e2228', 0.3));
    beacon(P, rx, ry - 6, def.light, f === 0);
    // reinforcement plating
    P.r(rx - 7, ry + 2, 4, 2, '#1f181c'); P.hl(rx - 7, ry + 2, 4, tone('#1f181c', 0.3));
  },
  tower(P, g, z, f, def) {
    // observation cab on top of lattice
    const [rx, ry] = roofCenter(g, z);
    P.slab(rx - 6, ry - 8, 12, 8, '#2c3547', { tex: 1 });
    P.hl(rx - 6, ry - 8, 12, tone('#2c3547', 0.35));
    // window band
    P.hl(rx - 5, ry - 5, 10, f === 0 ? tone(def.light, 0.05) : mixc('#16323a', def.light, 0.5));
    beacon(P, rx, ry - 8, def.light, f === 0);
    // lattice cross-braces on faces
    const [dx0, dy0] = g.pt(0, g.h), [cx0, cy0] = g.pt(g.w, g.h);
    for (let k = 1; k < 4; k++) {
      const y = dy0 - (z * k) / 4;
      P.hl(Math.round(dx0), Math.round(y), Math.round(cx0 - dx0), tone('#3a4a60', -0.1));
    }
  },
  viewing(P, g, z, f, def) {
    // open deck: railing posts along roof edge + canopy strut
    const corners = [[0, 0], [g.w, 0], [g.w, g.h], [0, g.h]];
    corners.forEach(([tx, ty]) => {
      const [x, y] = g.pt(tx, ty);
      P.vl(Math.round(x), Math.round(y - z - 4), 4, '#4a5a70');
      P.p(Math.round(x), Math.round(y - z - 5), tone(def.light, -0.1));
    });
    // rail lines
    const [ax, ay] = g.pt(0, 0), [bx, by] = g.pt(g.w, 0), [cx0, cy0] = g.pt(g.w, g.h), [dx0, dy0] = g.pt(0, g.h);
    P.ctx.strokeStyle = tone('#4a5a70', 0.2); P.ctx.lineWidth = 1;
    P.ctx.beginPath();
    P.ctx.moveTo(ax, ay - z - 4); P.ctx.lineTo(bx, by - z - 4); P.ctx.lineTo(cx0, cy0 - z - 4); P.ctx.lineTo(dx0, dy0 - z - 4); P.ctx.closePath(); P.ctx.stroke();
    // scope on deck (orientated outward = right/enclosure side)
    const [rx, ry] = roofCenter(g, z);
    P.vl(rx + 3, ry - 3, 3, '#3a4a60'); P.r(rx + 3, ry - 5, 3, 2, '#22303e');
    P.p(rx + 5, ry - 5, f === 0 ? def.light : tone(def.light, -0.3));
  },
  gift_shop(P, g, z, f, def) {
    doorOnLeft(P, g, z, def.light);
    // storefront display window (lit)
    const [dx0, dy0] = g.pt(0, g.h), [cx0, cy0] = g.pt(g.w, g.h);
    const mx = Math.round((dx0 + cx0) / 2), my = Math.round((dy0 + cy0) / 2);
    P.r(mx + 4, my - 9, 6, 5, mixc('#16323a', def.light, f === 0 ? 0.45 : 0.3));
    P.hl(mx + 4, my - 9, 6, tone(def.light, 0.1));
    // curio silhouettes in window
    P.p(mx + 5, my - 6, '#0d141c'); P.p(mx + 8, my - 7, '#0d141c');
    // hanging sign
    const [rx, ry] = roofCenter(g, z);
    P.r(rx - 2, ry - 4, 5, 3, '#22303e'); P.p(rx, ry - 3, def.light);
  },
  restroom(P, g, z, f, def) {
    doorOnLeft(P, g, z, '#9adfe8');
    const [rx, ry] = roofCenter(g, z);
    P.r(rx - 2, ry - 1, 4, 2, '#22303e'); // vent
    P.p(rx + 4, ry + 3, f === 0 ? '#9adfe8' : tone('#9adfe8', -0.35));
  },
  shelter(P, g, z, f, def) {
    // creature-scale arched opening on right face
    const [cx0, cy0] = g.pt(g.w, g.h), [bx0, by0] = g.pt(g.w, 0);
    const mx = Math.round((cx0 + bx0) / 2), my = Math.round((cy0 + by0) / 2);
    P.blob(mx, my - 3, 4, 4, '#0b1016', { lite: 0, dark: 0 });
    P.r(mx - 4, my, 8, 3, '#0b1016');
    P.hl(mx - 4, my - 6, 8, tone('#4b4234', 0.25)); // arch lip
    // rocky roof texture
    const [rx, ry] = roofCenter(g, z);
    P.dither(rx - 8, ry - 3, 16, 6, tone('#4b4234', -0.15), 0.2, 5);
    P.blob(rx - 4, ry, 3, 1.6, tone('#4b4234', 0.12));
  },
};

function stallDetail(glyph) {
  return (P, g, z, f, def) => {
    doorOnLeft(P, g, z, null);
    awningFront(P, g, z, tone(def.light, -0.15), '#1a222e');
    // counter shelf + sign
    const [rx, ry] = roofCenter(g, z);
    P.r(rx - 2, ry - 5, 6, 4, '#22303e');
    P.hl(rx - 2, ry - 5, 6, tone(def.light, f === 0 ? 0.2 : -0.15));
    glyph(P, rx, ry, def);
  };
}
DETAIL.food_stall = stallDetail((P, x, y) => { P.p(x, y - 3, '#e0a060'); P.p(x + 1, y - 3, '#c97a4a'); P.p(x, y - 2, '#8a5a3a'); });
DETAIL.drink_stall = stallDetail((P, x, y) => { P.r(x, y - 4, 2, 3, '#4ac0a8'); P.p(x, y - 5, '#9adfe8'); });

function feederDetail(fill, glowing) {
  return (P, g, z, f, def) => {
    // open trough: dark cavity + content fill
    const [rx, ry] = roofCenter(g, z);
    const rw = (g.w + g.h) * 4;
    P.blob(rx, ry + 1, rw, rw / 2.4, '#10161e', { lite: 0, dark: 0 });
    P.blob(rx, ry + 1, rw - 2, rw / 2.9, fill, { tex: 1 });
    if (glowing) P.glow(rx, ry, fill, f === 0 ? 0.35 : 0.18);
    P.p(rx - rw + 1, ry, tone('#3a4a60', 0.2)); // rim bolt
    P.p(rx + rw - 1, ry, tone('#3a4a60', -0.1));
  };
}
DETAIL.feeder_forage = feederDetail('#6a9a4e');
DETAIL.feeder_meat = feederDetail('#a84848');
DETAIL.feeder_mineral = feederDetail('#7d94ad');
DETAIL.feeder_fungal = feederDetail('#8a5a9e');
DETAIL.feeder_energy = (P, g, z, f, def) => {
  const [rx, ry] = roofCenter(g, z);
  // conduit coil pillar
  P.slab(rx - 2, ry - 6, 4, 6, '#2c3547');
  for (let k = 0; k < 2; k++) P.hl(rx - 3, ry - 4 + k * 3, 6, (k + f) % 2 ? '#2DE2E6' : tone('#2DE2E6', -0.4));
  P.glow(rx, ry - 7, '#2DE2E6', f === 0 ? 0.4 : 0.2);
};

// sprite baking ---------------------------------------------------------------
const cache = new Map();

export function getBuildingSprite(type, w, h) {
  const key = `${type}:${w}x${h}`;
  if (cache.has(key)) return cache.get(key);
  const def = BUILDINGS[type] || { color: '#22303e', light: '#2DE2E6' };
  const z = Z[type] ?? 14;
  const topPad = (TOP_PAD[type] ?? 6) + 2;
  const W = (w + h) * 16 + 2, H = (w + h) * 8 + z + topPad + 2;
  const ox = h * 16 + 1, oy = z + topPad;
  const frames = [0, 1].map((f) => {
    const P = new Px(W, H);
    const base = def.color;
    isoBox(P, ox, oy, w, h, z, tone(base, 0.32), tone(base, -0.12), tone(base, 0.08),
      { tex: 1 });
    const g = { w, h, pt: (tx, ty) => [ox + (tx - ty) * 16, oy + (tx + ty) * 8] };
    (DETAIL[type] || DETAIL.restroom)(P, g, z, f, def);
    return P.canvas();
  });
  const spr = { frames, W, H, ox, oy };
  cache.set(key, spr);
  return spr;
}
