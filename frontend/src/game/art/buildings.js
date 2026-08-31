// ---- Building iso pixel sprites: production construction kit ----
// Buildings are CONSTRUCTED objects: foundation plinth, framed walls with
// panel seams and weathering, roof slabs with thickness, inset doors with
// steps, glazed emissive windows, pipes/vents/masts. Footprints, anchors and
// gameplay data untouched.
import { Px, tone, mixc, isoBox } from './pixel';
import { BUILDINGS } from '../data/buildings';

// wall heights in ART px (device = 2x)
const Z = {
  admin: 24, lab: 20, power: 21, security_post: 18, tower: 38, viewing: 12,
  food_stall: 15, drink_stall: 14, restroom: 12, gift_shop: 16, shelter: 11,
  feeder_forage: 6, feeder_meat: 6, feeder_mineral: 6, feeder_fungal: 7, feeder_energy: 12,
  // attractions expansion
  obs_deck: 30, glass_tunnel: 10, underwater_dome: 14, nocturnal_house: 16, predator_gallery: 18,
  nursery_view: 14, safari_post: 34, encounter_stage: 10, keeper_tour: 13, hatchery_view: 15,
  holo_theatre: 20, xeno_dome: 18, evo_museum: 19, relic_gallery: 17, vr_pavilion: 16, night_lodge: 18,
  restaurant: 15, food_court: 14, sky_dining: 32, megastore: 18, merch_stall: 9, hotel: 30,
  rest_area: 6, medical_station: 13, info_center: 12, picnic_area: 5, premium_lounge: 16,
  tram_station: 12, gondola_station: 12, rail_station: 13,
};
const TOP_PAD = {
  admin: 20, lab: 12, power: 12, security_post: 12, tower: 14, viewing: 10,
  gift_shop: 8, food_stall: 8, drink_stall: 8, feeder_energy: 8, restroom: 6, shelter: 6,
  obs_deck: 14, safari_post: 16, sky_dining: 14, underwater_dome: 16, xeno_dome: 18, holo_theatre: 16,
  vr_pavilion: 12, nocturnal_house: 12, night_lodge: 12, hotel: 16, encounter_stage: 12,
  tram_station: 18, gondola_station: 18, rail_station: 18, megastore: 10, evo_museum: 12, relic_gallery: 10,
  restaurant: 8, food_court: 8, medical_station: 8, info_center: 8, premium_lounge: 10, merch_stall: 8,
  keeper_tour: 8, hatchery_view: 8, nursery_view: 10, predator_gallery: 10, glass_tunnel: 8, picnic_area: 8, rest_area: 8,
};

const CONCRETE = '#3b414c';
const STEEL = '#4a5a70';
const DARKMETAL = '#22303e';
const GLASS = '#16323a';

// ---------- construction kit ----------
const mkPt = (ox, oy) => (tx, ty) => [ox + (tx - ty) * 16, oy + (tx + ty) * 8];

// concrete foundation plinth: expanded ground diamond ring + 3px riser
function plinth(P, ox, oy, w, h, e = 2, fh = 3) {
  const pt = mkPt(ox, oy);
  const [ax, ay] = pt(0, 0), [bx, by] = pt(w, 0), [cx, cy] = pt(w, h), [dx, dy] = pt(0, h);
  const A = [ax, ay - e], B = [bx + e * 2, by], C = [cx, cy + e], D = [dx - e * 2, dy];
  const ctx = P.ctx;
  // riser sides
  ctx.fillStyle = tone(CONCRETE, -0.35);
  ctx.beginPath(); ctx.moveTo(D[0], D[1] - fh); ctx.lineTo(C[0], C[1] - fh); ctx.lineTo(C[0], C[1]); ctx.lineTo(D[0], D[1]); ctx.closePath(); ctx.fill();
  ctx.fillStyle = tone(CONCRETE, -0.5);
  ctx.beginPath(); ctx.moveTo(C[0], C[1] - fh); ctx.lineTo(B[0], B[1] - fh); ctx.lineTo(B[0], B[1]); ctx.lineTo(C[0], C[1]); ctx.closePath(); ctx.fill();
  // top slab
  ctx.fillStyle = CONCRETE;
  ctx.beginPath(); ctx.moveTo(A[0], A[1] - fh); ctx.lineTo(B[0], B[1] - fh); ctx.lineTo(C[0], C[1] - fh); ctx.lineTo(D[0], D[1] - fh); ctx.closePath(); ctx.fill();
  // lit rim + wear specks
  ctx.strokeStyle = tone(CONCRETE, 0.28); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(D[0], D[1] - fh); ctx.lineTo(A[0], A[1] - fh); ctx.lineTo(B[0], B[1] - fh); ctx.stroke();
  P.dither(Math.min(D[0], A[0]), A[1] - fh, Math.abs(B[0] - D[0]), 6, tone(CONCRETE, -0.22), 0.1, 3);
  return fh;
}

// framed wall detailing over an isoBox face
// side: 'L' (D->C, lit) or 'R' (C->B, shaded)
function wallDetail(P, pt, w, h, z, base, side, opts = {}) {
  const ctx = P.ctx;
  const [x0, y0] = side === 'L' ? pt(0, h) : pt(w, h);
  const [x1, y1] = side === 'L' ? pt(w, h) : pt(w, 0);
  const n = Math.round(Math.hypot(x1 - x0, y1 - y0));
  const col = side === 'L' ? tone(base, -0.02) : tone(base, -0.2);
  // horizontal panel seams
  for (let k = 1; k <= 2; k++) {
    const sy = z * (k / 3);
    ctx.strokeStyle = 'rgba(8,12,18,0.4)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x0, y0 - sy); ctx.lineTo(x1, y1 - sy); ctx.stroke();
  }
  // vertical framing columns (corners + midpoint)
  const posts = [0, 0.5, 1];
  for (const t of posts) {
    const px = x0 + (x1 - x0) * t, py = y0 + (y1 - y0) * t;
    ctx.fillStyle = t === 0 || t === 1 ? tone(col, 0.16) : tone(col, 0.09);
    ctx.fillRect(Math.round(px) - (t === 1 ? 1 : 0), Math.round(py) - z, 1, z);
  }
  // grime accumulation at wall base
  P.dither(Math.min(x0, x1), Math.max(y0, y1) - 4, Math.abs(x1 - x0), 4, 'rgba(6,10,14,0.5)', opts.dirty ? 0.3 : 0.16, 7);
  // ground AO band
  ctx.fillStyle = 'rgba(4,7,11,0.35)';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.lineTo(x1, y1 + 1.6); ctx.lineTo(x0, y0 + 1.6); ctx.closePath(); ctx.fill();
}

// roof slab: parapet lip with thickness + inner deck
function roofSlab(P, pt, w, h, z, roofCol) {
  const ctx = P.ctx;
  const [ax, ay] = pt(0, 0), [bx, by] = pt(w, 0), [cx, cy] = pt(w, h), [dx, dy] = pt(0, h);
  // parapet thickness (2px drop on the two visible rims)
  ctx.fillStyle = tone(roofCol, -0.3);
  ctx.beginPath(); ctx.moveTo(dx, dy - z); ctx.lineTo(cx, cy - z); ctx.lineTo(cx, cy - z + 2); ctx.lineTo(dx, dy - z + 2); ctx.closePath(); ctx.fill();
  ctx.fillStyle = tone(roofCol, -0.42);
  ctx.beginPath(); ctx.moveTo(cx, cy - z); ctx.lineTo(bx, by - z); ctx.lineTo(bx, by - z + 2); ctx.lineTo(cx, cy - z + 2); ctx.closePath(); ctx.fill();
  // inner recessed deck
  const in8 = 0.16;
  const ipt = (tx, ty) => {
    const cxm = (tx + (w / 2 - tx) * in8), cym = (ty + (h / 2 - ty) * in8);
    return pt(cxm, cym);
  };
  const [iax, iay] = ipt(0, 0), [ibx, iby] = ipt(w, 0), [icx, icy] = ipt(w, h), [idx2, idy2] = ipt(0, h);
  ctx.fillStyle = tone(roofCol, -0.12);
  ctx.beginPath(); ctx.moveTo(iax, iay - z + 1); ctx.lineTo(ibx, iby - z + 1); ctx.lineTo(icx, icy - z + 1); ctx.lineTo(idx2, idy2 - z + 1); ctx.closePath(); ctx.fill();
  // deck texture + drainage stains
  P.dither(Math.min(idx2, iax), iay - z, Math.abs(ibx - idx2), (icy - iay), tone(roofCol, -0.24), 0.12, 11);
  // lit parapet rim (key light upper-left)
  ctx.strokeStyle = tone(roofCol, 0.3); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(dx, dy - z); ctx.lineTo(ax, ay - z); ctx.lineTo(bx, by - z); ctx.stroke();
}

// inset doorway with frame, steps and interior glow, on left face
function doorway(P, pt, w, h, z, lit) {
  const ctx = P.ctx;
  const [dx, dy] = pt(0, h), [cx, cy] = pt(w, h);
  const mx = Math.round((dx + cx) / 2), my = Math.round((dy + cy) / 2);
  // frame
  ctx.fillStyle = tone(DARKMETAL, 0.25); ctx.fillRect(mx - 3, my - 9, 6, 9);
  // recessed opening
  ctx.fillStyle = '#0a1016'; ctx.fillRect(mx - 2, my - 8, 4, 8);
  // interior glow spill
  if (lit) {
    ctx.fillStyle = lit; ctx.globalAlpha = 0.55; ctx.fillRect(mx - 2, my - 8, 4, 1); ctx.globalAlpha = 1;
    P.p(mx + 4, my - 7, lit); // door status lamp
  }
  // slide seam
  ctx.fillStyle = 'rgba(90,110,135,0.5)'; ctx.fillRect(mx, my - 8, 1, 8);
  // steps
  ctx.fillStyle = tone(CONCRETE, 0.08); ctx.fillRect(mx - 3, my, 6, 1);
  ctx.fillStyle = tone(CONCRETE, -0.18); ctx.fillRect(mx - 4, my + 1, 8, 1);
}

// glazed window band with emissive interior
function windowBand(P, x0, y0, x1, y1, liftZ, lit, f, seg = 2) {
  const ctx = P.ctx;
  const n = Math.round(Math.hypot(x1 - x0, y1 - y0) / (seg + 3));
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const x = Math.round(x0 + (x1 - x0) * t), y = Math.round(y0 + (y1 - y0) * t) - liftZ;
    const on = (i + f) % 4 !== 0;
    P.r(x, y, seg, 3, on ? mixc(GLASS, lit, 0.4) : GLASS);
    P.hl(x, y, seg, on ? tone(lit, 0.05) : tone(GLASS, 0.25));
  }
}

function beacon(P, x, y, color, on) {
  P.vl(x, y - 4, 4, STEEL);
  P.p(x - 1, y - 1, tone(STEEL, -0.25));
  if (on) P.glow(x, y - 5, color, 0.4);
  else P.p(x, y - 5, tone(color, -0.35));
}

function roofVent(P, x, y, wd = 4) {
  P.slab(x, y - 2, wd, 3, DARKMETAL);
  P.hl(x, y - 2, wd, tone(DARKMETAL, 0.3));
  P.hl(x, y, wd, tone(DARKMETAL, -0.3));
}

function pipeRun(P, x0, y0, len, vertical, col = STEEL) {
  if (vertical) {
    P.vl(x0, y0, len, col); P.vl(x0 + 1, y0, len, tone(col, -0.3));
    P.p(x0, y0, tone(col, 0.2)); P.p(x0, y0 + len - 1, tone(col, -0.15));
  } else {
    P.hl(x0, y0, len, col); P.hl(x0, y0 + 1, len, tone(col, -0.3));
  }
}

// striped industrial awning with thickness + support struts
function awning(P, pt, w, h, z, colA, colB) {
  const ctx = P.ctx;
  const [dx, dy] = pt(0, h), [cx, cy] = pt(w, h);
  const n = Math.max(5, Math.round((cx - dx) / 4));
  for (let i = 0; i < n; i++) {
    const t = i / n, t2 = (i + 1) / n;
    const x0 = dx + (cx - dx) * t, x1 = dx + (cx - dx) * t2;
    const y0 = dy + (cy - dy) * t - z;
    ctx.fillStyle = i % 2 ? colA : colB;
    ctx.fillRect(Math.round(x0) - 1, Math.round(y0) + 1, Math.max(1, Math.round(x1 - x0)) + 1, 3);
    ctx.fillStyle = 'rgba(8,12,18,0.5)';
    ctx.fillRect(Math.round(x0) - 1, Math.round(y0) + 4, Math.max(1, Math.round(x1 - x0)) + 1, 1);
  }
  // struts
  P.vl(Math.round(dx), Math.round(dy) - z + 5, 3, tone(STEEL, -0.1));
  P.vl(Math.round(cx) - 1, Math.round(cy) - z + 5, 3, tone(STEEL, -0.2));
}

function roofCenter(pt, w, h, z) {
  const [ax, ay] = pt(w / 2, h / 2);
  return [Math.round(ax), Math.round(ay - z)];
}

// ---------- per-type architecture ----------
const DETAIL = {
  admin(P, g, z, f, def) {
    const { pt, w, h } = g;
    roofSlab(P, pt, w, h, z, tone(def.color, -0.05));
    // upper command block (second storey massing)
    const [rx, ry] = roofCenter(pt, w, h, z);
    P.slab(rx - 8, ry - 8, 14, 8, tone(def.color, 0.1), { tex: 1 });
    P.hl(rx - 8, ry - 8, 14, tone(def.color, 0.34));
    P.r(rx - 7, ry - 6, 10, 2, mixc(GLASS, def.light, 0.45)); // command glazing
    P.hl(rx - 7, ry - 6, 10, tone(def.light, 0.1));
    // comms mast + dish + beacon
    P.vl(rx + 9, ry - 16, 16, STEEL);
    P.p(rx + 9, ry - 16, tone(STEEL, 0.3));
    P.hl(rx + 7, ry - 13, 5, STEEL);
    P.blob(rx + 5, ry - 11, 2.4, 1.7, '#7a8ba0', { lite: 0.3 });
    beacon(P, rx + 9, ry - 16, def.light, f === 0);
    roofVent(P, rx - 12, ry + 3);
    // windows both faces + door
    const [dx0, dy0] = pt(0, h), [cx0, cy0] = pt(w, h), [bx0, by0] = pt(w, 0);
    windowBand(P, dx0, dy0, cx0, cy0, Math.round(z * 0.62), def.light, f, 3);
    windowBand(P, cx0, cy0, bx0, by0, Math.round(z * 0.62), def.light, f + 1, 2);
    doorway(P, pt, w, h, z, def.light);
    // identity stripe
    const [lx, ly] = pt(0, h);
    P.hl(lx + 2, ly - z + 4, 9, def.light);
    P.hl(lx + 2, ly - z + 5, 9, tone(def.light, -0.4));
  },
  lab(P, g, z, f, def) {
    const { pt, w, h } = g;
    roofSlab(P, pt, w, h, z, tone(def.color, -0.04));
    // glazed atrium wing on right face
    const [cx0, cy0] = pt(w, h), [bx0, by0] = pt(w, 0);
    const gx = Math.round((cx0 + bx0) / 2), gy = Math.round((cy0 + by0) / 2);
    for (let k = 0; k < 3; k++) {
      P.r(gx - 5 + k * 4, gy - 10 + k, 3, 9, mixc(GLASS, def.light, (k + f) % 3 === 0 ? 0.5 : 0.3));
      P.vl(gx - 6 + k * 4, gy - 10 + k, 10, tone(DARKMETAL, 0.3)); // mullion
    }
    // roof: sensor pods + sample tanks + antenna
    const [rx, ry] = roofCenter(pt, w, h, z);
    P.blob(rx - 6, ry - 1, 2.6, 1.8, '#3b4c5e', { lite: 0.3 });
    P.blob(rx + 1, ry - 2, 2, 1.4, '#3b4c5e', { lite: 0.3 });
    P.p(rx + 1, ry - 4, f === 0 ? def.light : tone(def.light, -0.3));
    P.slab(rx + 6, ry - 4, 4, 5, mixc(DARKMETAL, def.light, 0.2));
    P.hl(rx + 6, ry - 4, 4, tone(def.light, -0.1));
    P.vl(rx - 10, ry - 8, 8, STEEL); P.p(rx - 10, ry - 9, tone(def.light, 0.2));
    pipeRun(P, rx + 10, ry - 2, 6, true);
    // scan band on left face (animated) + door
    const [dx0, dy0] = pt(0, h);
    const [cx1, cy1] = pt(w, h);
    const n = Math.round(Math.hypot(cx1 - dx0, cy1 - dy0) / 5);
    for (let i = 1; i < n; i++) {
      const t = i / n;
      const x = Math.round(dx0 + (cx1 - dx0) * t), y = Math.round(dy0 + (cy1 - dy0) * t) - Math.round(z * 0.58);
      const sweep = (i + f * 2) % 6 === 0;
      P.r(x, y, 3, 3, sweep ? tone(def.light, 0.3) : mixc(GLASS, def.light, 0.32));
    }
    doorway(P, pt, w, h, z, def.light);
  },
  power(P, g, z, f, def) {
    const { pt, w, h } = g;
    roofSlab(P, pt, w, h, z, tone(def.color, -0.08));
    const [rx, ry] = roofCenter(pt, w, h, z);
    // relay core: heavy coil stack
    P.slab(rx - 4, ry - 12, 8, 12, '#3a4453', { tex: 1 });
    P.hl(rx - 4, ry - 12, 8, tone('#3a4453', 0.35));
    for (let k = 0; k < 4; k++) {
      const on = (k + f) % 2 === 0;
      P.hl(rx - 5, ry - 10 + k * 3, 10, on ? def.light : tone(def.light, -0.45));
      P.p(rx - 6, ry - 10 + k * 3, tone('#3a4453', -0.2));
      P.p(rx + 5, ry - 10 + k * 3, tone('#3a4453', -0.35));
    }
    P.glow(rx, ry - 13, def.light, f === 0 ? 0.45 : 0.22);
    // transformer box + vents
    P.slab(rx + 7, ry - 3, 5, 4, DARKMETAL); P.hl(rx + 7, ry - 3, 5, tone(DARKMETAL, 0.3));
    roofVent(P, rx - 12, ry + 2, 4);
    // cable drapes to ground corners
    const ctx = P.ctx;
    const [dx0, dy0] = pt(0, h);
    ctx.strokeStyle = tone(STEEL, -0.15); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(rx - 3, ry - 1); ctx.quadraticCurveTo(dx0 + 8, dy0 - 4, dx0 + 4, dy0 - 1); ctx.stroke();
    // hazard chevrons on left face base
    for (let i = 0; i < 5; i++) {
      P.r(dx0 + 4 + i * 4, dy0 - 4, 2, 2, i % 2 ? '#f2c14e' : '#1a1216');
    }
  },
  security_post(P, g, z, f, def) {
    const { pt, w, h } = g;
    roofSlab(P, pt, w, h, z, tone(def.color, -0.06));
    doorway(P, pt, w, h, z, def.light);
    // armour plating overlay on left face
    const [dx0, dy0] = pt(0, h), [cx0, cy0] = pt(w, h), [bx0, by0] = pt(w, 0);
    P.r(Math.round((dx0 + cx0) / 2) + 5, Math.round((dy0 + cy0) / 2) - 10, 6, 7, tone('#2e2228', 0.05));
    P.hl(Math.round((dx0 + cx0) / 2) + 5, Math.round((dy0 + cy0) / 2) - 10, 6, tone('#2e2228', 0.3));
    // warning chevrons on right face
    const n = Math.round(Math.hypot(bx0 - cx0, by0 - cy0) / 4);
    for (let i = 0; i < n; i++) {
      const x = Math.round(cx0 + (bx0 - cx0) * (i / n)), y = Math.round(cy0 + (by0 - cy0) * (i / n)) - 5;
      P.r(x, y, 3, 2, i % 2 ? '#f2c14e' : '#1a1216');
    }
    // roof: strobe mast + spotlight + antenna
    const [rx, ry] = roofCenter(pt, w, h, z);
    P.slab(rx - 2, ry - 7, 4, 7, '#2e2228'); P.hl(rx - 2, ry - 7, 4, tone('#2e2228', 0.35));
    beacon(P, rx, ry - 7, def.light, f === 0);
    P.r(rx + 5, ry - 3, 3, 2, DARKMETAL); P.p(rx + 7, ry - 3, f === 0 ? '#fff1c9' : tone('#fff1c9', -0.4));
    P.vl(rx - 8, ry - 6, 6, STEEL);
  },
  tower(P, g, z, f, def) {
    const { pt, w, h } = g;
    const ctx = P.ctx;
    // lattice truss on both faces (over base shading)
    const [ax, ay] = pt(0, 0), [bx, by] = pt(w, 0), [cx0, cy0] = pt(w, h), [dx0, dy0] = pt(0, h);
    ctx.strokeStyle = tone(STEEL, -0.05); ctx.lineWidth = 1;
    for (let k = 0; k < 4; k++) {
      const yTop = (z * (k + 1)) / 4, yBot = (z * k) / 4;
      // left face X brace
      ctx.beginPath();
      ctx.moveTo(dx0, dy0 - yBot); ctx.lineTo(cx0, cy0 - yTop);
      ctx.moveTo(dx0, dy0 - yTop); ctx.lineTo(cx0, cy0 - yBot);
      ctx.stroke();
      // ring
      ctx.strokeStyle = tone(STEEL, 0.12);
      ctx.beginPath(); ctx.moveTo(dx0, dy0 - yTop); ctx.lineTo(cx0, cy0 - yTop); ctx.lineTo(bx, by - yTop); ctx.stroke();
      ctx.strokeStyle = tone(STEEL, -0.05);
    }
    // observation cab
    const [rx, ry] = roofCenter(pt, w, h, z);
    P.slab(rx - 8, ry - 10, 16, 10, '#2c3547', { tex: 1 });
    P.hl(rx - 8, ry - 10, 16, tone('#2c3547', 0.4));
    // 360 window band
    P.r(rx - 7, ry - 7, 14, 3, mixc(GLASS, def.light, f === 0 ? 0.5 : 0.35));
    P.hl(rx - 7, ry - 7, 14, tone(def.light, 0.15));
    // roof overhang + beacon
    P.hl(rx - 9, ry - 10, 18, tone('#2c3547', -0.3));
    beacon(P, rx, ry - 10, def.light, f === 0);
    // ladder on left leg
    P.vl(Math.round(dx0) + 3, Math.round(dy0) - z + 4, z - 6, tone(STEEL, 0.15));
  },
  viewing(P, g, z, f, def) {
    const { pt, w, h } = g;
    const ctx = P.ctx;
    // deck plating
    roofSlab(P, pt, w, h, z, tone(def.color, 0.02));
    // perimeter railing with posts
    const corners = [[0, 0], [w, 0], [w, h], [0, h]];
    const railPts = corners.map(([tx, ty]) => pt(tx, ty));
    for (const [x, y] of railPts) {
      P.vl(Math.round(x), Math.round(y - z - 5), 5, STEEL);
      P.p(Math.round(x), Math.round(y - z - 6), tone(def.light, -0.05));
    }
    ctx.strokeStyle = tone(STEEL, 0.22); ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(railPts[0][0], railPts[0][1] - z - 5);
    for (let i = 1; i < 4; i++) ctx.lineTo(railPts[i][0], railPts[i][1] - z - 5);
    ctx.closePath(); ctx.stroke();
    ctx.strokeStyle = 'rgba(74,90,112,0.5)';
    ctx.beginPath();
    ctx.moveTo(railPts[0][0], railPts[0][1] - z - 2);
    for (let i = 1; i < 4; i++) ctx.lineTo(railPts[i][0], railPts[i][1] - z - 2);
    ctx.closePath(); ctx.stroke();
    // observation scope aimed outward + bench
    const [rx, ry] = roofCenter(pt, w, h, z);
    P.vl(rx + 4, ry - 3, 3, STEEL);
    P.r(rx + 3, ry - 6, 4, 3, DARKMETAL); P.hl(rx + 3, ry - 6, 4, tone(DARKMETAL, 0.35));
    P.p(rx + 6, ry - 5, f === 0 ? def.light : tone(def.light, -0.3));
    P.r(rx - 7, ry + 1, 6, 2, '#4b4234'); P.hl(rx - 7, ry + 1, 6, tone('#4b4234', 0.25));
    // access steps at left corner
    const [dx0, dy0] = pt(0, h);
    P.r(Math.round(dx0) - 1, Math.round(dy0) - 2, 5, 1, tone(CONCRETE, 0.1));
    P.r(Math.round(dx0) - 2, Math.round(dy0) - 1, 7, 1, tone(CONCRETE, -0.12));
  },
  restroom(P, g, z, f, def) {
    const { pt, w, h } = g;
    roofSlab(P, pt, w, h, z, tone(def.color, -0.05));
    doorway(P, pt, w, h, z, '#9adfe8');
    const [rx, ry] = roofCenter(pt, w, h, z);
    roofVent(P, rx - 3, ry, 4);
    pipeRun(P, rx + 5, ry - 4, 5, true);
    // pictogram sign
    const [cx0, cy0] = pt(w, h), [bx0, by0] = pt(w, 0);
    const sx = Math.round((cx0 + bx0) / 2), sy = Math.round((cy0 + by0) / 2);
    P.r(sx - 2, sy - 9, 5, 5, DARKMETAL);
    P.p(sx, sy - 8, '#9adfe8'); P.r(sx - 1, sy - 6, 3, 1, '#9adfe8');
    // moisture stain
    P.dither(sx - 4, sy - 4, 8, 4, 'rgba(10,20,26,0.5)', 0.25, 5);
  },
  gift_shop(P, g, z, f, def) {
    const { pt, w, h } = g;
    roofSlab(P, pt, w, h, z, tone(def.color, -0.04));
    doorway(P, pt, w, h, z, def.light);
    // large lit display window with curio silhouettes
    const [dx0, dy0] = pt(0, h), [cx0, cy0] = pt(w, h);
    const mx = Math.round((dx0 + cx0) / 2), my = Math.round((dy0 + cy0) / 2);
    P.r(mx + 4, my - 10, 9, 6, mixc(GLASS, def.light, f === 0 ? 0.5 : 0.35));
    P.hl(mx + 4, my - 10, 9, tone(def.light, 0.15));
    P.r(mx + 3, my - 10, 1, 7, tone(DARKMETAL, 0.3)); P.r(mx + 13, my - 10, 1, 7, tone(DARKMETAL, 0.2));
    // curio silhouettes
    P.r(mx + 6, my - 6, 2, 2, '#0d141c'); P.p(mx + 10, my - 7, '#0d141c'); P.r(mx + 10, my - 6, 1, 2, '#0d141c');
    // projecting sign + roof AC unit
    const [rx, ry] = roofCenter(pt, w, h, z);
    P.r(rx - 3, ry - 6, 6, 4, DARKMETAL); P.hl(rx - 3, ry - 6, 6, tone(DARKMETAL, 0.3));
    P.p(rx - 1, ry - 5, def.light); P.p(rx + 1, ry - 5, tone(def.light, 0.25));
    P.slab(rx + 6, ry - 1, 5, 3, '#3a4453'); P.hl(rx + 6, ry - 1, 5, tone('#3a4453', 0.3));
  },
  shelter(P, g, z, f, def) {
    // organic rock den — not a box: layered stone mound with arched den mouth
    const { pt, w, h } = g;
    const [rx, ry] = roofCenter(pt, w, h, z * 0.4);
    const rock = '#4b4234';
    // base mound layers
    P.blob(rx, ry + 4, (w + h) * 7.4, (w + h) * 3.6, tone(rock, -0.15), { lite: 0.1, dark: 0.3, tex: 1 });
    P.blob(rx - 2, ry + 1, (w + h) * 6, (w + h) * 3, rock, { lite: 0.18, dark: 0.28, tex: 1 });
    P.blob(rx - 4, ry - 2, (w + h) * 4, (w + h) * 2, tone(rock, 0.1), { lite: 0.22, dark: 0.2, tex: 1 });
    // moss dressing
    P.dither(rx - 14, ry - 6, 18, 6, '#2b4c3c', 0.22, 9);
    P.blob(rx - 6, ry - 5, 3, 1.4, '#2b4c3c', { lite: 0.2, dark: 0.1 });
    // den mouth on right face (creature-scale arch)
    const [cx0, cy0] = pt(w, h), [bx0, by0] = pt(w, 0);
    const mx = Math.round((cx0 + bx0) / 2), my = Math.round((cy0 + by0) / 2);
    P.blob(mx, my - 3, 4.6, 4, '#0b1016', { lite: 0, dark: 0 });
    P.r(mx - 5, my - 1, 10, 3, '#0b1016');
    P.hl(mx - 5, my - 7, 10, tone(rock, 0.3)); // arch lip catch-light
    // scattered boulders at base
    P.r(mx - 12, my + 1, 3, 2, tone(rock, -0.05)); P.hl(mx - 12, my + 1, 2, tone(rock, 0.2));
    P.r(mx + 8, my + 2, 2, 1, tone(rock, -0.2));
  },
};

// stalls share kiosk anatomy with distinct goods + palette
function stallDetail(glyph) {
  return (P, g, z, f, def) => {
    const { pt, w, h } = g;
    roofSlab(P, pt, w, h, z, tone(def.color, -0.05));
    // counter opening on left face with shelf + goods
    const [dx0, dy0] = pt(0, h), [cx0, cy0] = pt(w, h);
    const mx = Math.round((dx0 + cx0) / 2), my = Math.round((dy0 + cy0) / 2);
    P.r(mx - 5, my - 9, 11, 6, '#0d141c');
    P.hl(mx - 5, my - 3, 11, tone(STEEL, 0.15)); // counter lip
    P.hl(mx - 5, my - 9, 11, tone(DARKMETAL, 0.35));
    glyph(P, mx, my - 5, def);
    // thick striped awning + struts
    awning(P, pt, w, h, z, tone(def.light, -0.12), '#1a222e');
    // roof signage + vent
    const [rx, ry] = roofCenter(pt, w, h, z);
    P.r(rx - 3, ry - 6, 7, 5, DARKMETAL);
    P.hl(rx - 3, ry - 6, 7, tone(def.light, f === 0 ? 0.25 : -0.1));
    P.p(rx, ry - 4, f === 0 ? def.light : tone(def.light, -0.25));
    roofVent(P, rx + 6, ry + 1, 3);
  };
}
DETAIL.food_stall = stallDetail((P, x, y) => {
  P.r(x - 3, y, 2, 2, '#e0a060'); P.p(x - 3, y - 1, '#f2c58a');
  P.r(x, y, 2, 2, '#c97a4a'); P.p(x + 3, y + 1, '#8a5a3a');
});
DETAIL.drink_stall = stallDetail((P, x, y) => {
  P.r(x - 3, y - 1, 2, 3, '#4ac0a8'); P.p(x - 3, y - 2, '#9adfe8');
  P.r(x + 1, y, 2, 2, '#3a8ac0'); P.p(x + 1, y - 1, '#9adfe8');
});

// engineered feed trough: framed basin + content + supply pod
function feederDetail(fill, glowing) {
  return (P, g, z, f, def) => {
    const { pt, w, h } = g;
    const [rx, ry] = roofCenter(pt, w, h, z);
    const rw = (w + h) * 4;
    // basin frame
    P.blob(rx, ry + 1, rw + 1, rw / 2.2, tone(STEEL, -0.25), { lite: 0.12, dark: 0.3 });
    P.blob(rx, ry, rw, rw / 2.4, '#10161e', { lite: 0, dark: 0 });
    // content
    P.blob(rx, ry + 1, rw - 2, rw / 3, fill, { tex: 1, lite: 0.18, dark: 0.3 });
    if (glowing) P.glow(rx, ry, fill, f === 0 ? 0.35 : 0.18);
    // rim bolts + legs
    P.p(rx - rw, ry, tone(STEEL, 0.25)); P.p(rx + rw, ry, tone(STEEL, -0.1));
    P.p(rx, ry - rw / 2.2, tone(STEEL, 0.3));
    P.vl(rx - rw + 1, ry + 2, 3, tone(STEEL, -0.3)); P.vl(rx + rw - 2, ry + 2, 3, tone(STEEL, -0.35));
    // supply pod at end
    P.slab(rx + rw - 3, ry - 5, 4, 4, DARKMETAL); P.hl(rx + rw - 3, ry - 5, 4, tone(DARKMETAL, 0.3));
    P.p(rx + rw - 2, ry - 4, f === 0 ? tone(fill, 0.2) : tone(fill, -0.2));
    // spill scatter
    P.dither(rx - rw, ry + 3, rw * 2, 3, tone(fill, -0.25), 0.1, 13);
  };
}
DETAIL.feeder_forage = feederDetail('#6a9a4e');
DETAIL.feeder_meat = feederDetail('#a84848');
DETAIL.feeder_mineral = feederDetail('#7d94ad');
DETAIL.feeder_fungal = feederDetail('#8a5a9e', true);
DETAIL.feeder_energy = (P, g, z, f, def) => {
  const { pt, w, h } = g;
  const [rx, ry] = roofCenter(pt, w, h, z);
  // charging pylon: base plate + column + coil rings
  P.blob(rx, ry + 3, (w + h) * 4, (w + h) * 2, tone(STEEL, -0.3), { lite: 0.1, dark: 0.3 });
  P.slab(rx - 2, ry - 8, 5, 11, '#2c3547', { tex: 1 });
  P.hl(rx - 2, ry - 8, 5, tone('#2c3547', 0.35));
  for (let k = 0; k < 3; k++) {
    P.hl(rx - 3, ry - 6 + k * 3, 7, (k + f) % 2 ? '#2DE2E6' : tone('#2DE2E6', -0.45));
  }
  P.glow(rx, ry - 9, '#2DE2E6', f === 0 ? 0.45 : 0.22);
  // feed cable to battery box
  P.ctx.strokeStyle = tone(STEEL, -0.1); P.ctx.lineWidth = 1;
  P.ctx.beginPath(); P.ctx.moveTo(rx + 2, ry - 2); P.ctx.quadraticCurveTo(rx + 8, ry + 4, rx + 10, ry + 2); P.ctx.stroke();
  P.slab(rx + 9, ry - 1, 4, 3, DARKMETAL); P.p(rx + 10, ry, f === 0 ? '#2DE2E6' : tone('#2DE2E6', -0.4));
};

// ---------- attractions expansion painters ----------
// dome venues: roof slab + translucent observation dome with glow meridian
function domeDetail(glowT = 0.4) {
  return (P, g, z, f, def) => {
    const { pt, w, h } = g;
    roofSlab(P, pt, w, h, z, tone(def.color, -0.05));
    const [rx, ry] = roofCenter(pt, w, h, z);
    const r = (w + h) * 3.2;
    P.blob(rx, ry - 2, r, r * 0.62, mixc(GLASS, def.light, 0.18), { lite: 0.3, dark: 0.2 });
    P.blob(rx - r * 0.25, ry - r * 0.4, r * 0.3, r * 0.16, mixc(GLASS, '#ffffff', 0.25), { lite: 0.2, dark: 0 });
    // glow meridian band
    for (let k = -2; k <= 2; k++) {
      P.p(rx + k * 3, Math.round(ry - 2 - r * 0.55 + Math.abs(k)), (k + f) % 2 ? def.light : tone(def.light, -0.35));
    }
    P.glow(rx, ry - 2 - r * 0.6, def.light, f === 0 ? glowT : glowT * 0.5);
    const [dx0, dy0] = pt(0, h), [cx0, cy0] = pt(w, h);
    windowBand(P, dx0, dy0, cx0, cy0, Math.round(z * 0.55), def.light, f, 3);
    doorway(P, pt, w, h, z, def.light);
  };
}

// exhibition halls: banner facade + skylight strip + roof gear
function museumDetail(P, g, z, f, def) {
  const { pt, w, h } = g;
  roofSlab(P, pt, w, h, z, tone(def.color, -0.04));
  const [rx, ry] = roofCenter(pt, w, h, z);
  // skylight strip
  for (let k = 0; k < 3; k++) P.r(rx - 6 + k * 5, ry - 2 + k, 4, 2, mixc(GLASS, def.light, (k + f) % 3 === 0 ? 0.5 : 0.3));
  roofVent(P, rx + 8, ry + 2);
  // hanging banner on left face
  const [dx0, dy0] = pt(0, h), [cx0, cy0] = pt(w, h);
  const bx = Math.round(dx0 + (cx0 - dx0) * 0.3), by = Math.round(dy0 + (cy0 - dy0) * 0.3);
  P.r(bx - 2, by - z + 3, 5, Math.round(z * 0.6), tone(def.light, -0.35));
  P.hl(bx - 2, by - z + 3, 5, tone(def.light, 0.1));
  P.p(bx, by - z + 5, tone(def.light, 0.3));
  windowBand(P, dx0, dy0, cx0, cy0, Math.round(z * 0.5), def.light, f, 2);
  doorway(P, pt, w, h, z, def.light);
}

// dining venues: awning + rooftop condensers + menu sign
function dinerDetail(P, g, z, f, def) {
  const { pt, w, h } = g;
  roofSlab(P, pt, w, h, z, tone(def.color, -0.06));
  awning(P, pt, w, h, z, tone(def.light, -0.25), tone(def.color, 0.25));
  const [rx, ry] = roofCenter(pt, w, h, z);
  roofVent(P, rx - 6, ry, 5); roofVent(P, rx + 3, ry + 2, 4);
  P.vl(rx + 9, ry - 5, 5, STEEL);
  P.p(rx + 9, ry - 6, f === 0 ? def.light : tone(def.light, -0.4)); // sign lamp
  const [cx0, cy0] = pt(w, h), [bx0, by0] = pt(w, 0);
  windowBand(P, cx0, cy0, bx0, by0, Math.round(z * 0.5), def.light, f, 3);
  doorway(P, pt, w, h, z, def.light);
}

// hotel: upper storey + dense window grid + entry canopy
function hotelDetail(P, g, z, f, def) {
  const { pt, w, h } = g;
  roofSlab(P, pt, w, h, z, tone(def.color, -0.05));
  const [rx, ry] = roofCenter(pt, w, h, z);
  P.slab(rx - 9, ry - 10, 17, 10, tone(def.color, 0.12), { tex: 1 });
  P.hl(rx - 9, ry - 10, 17, tone(def.color, 0.35));
  for (let k = 0; k < 5; k++) P.p(rx - 7 + k * 3, ry - 7, (k + f) % 3 ? mixc(GLASS, def.light, 0.5) : GLASS);
  for (let k = 0; k < 5; k++) P.p(rx - 7 + k * 3, ry - 4, (k + f) % 4 ? mixc(GLASS, def.light, 0.4) : GLASS);
  beacon(P, rx + 8, ry - 10, def.light, f === 0);
  const [dx0, dy0] = pt(0, h), [cx0, cy0] = pt(w, h), [bx0, by0] = pt(w, 0);
  windowBand(P, dx0, dy0, cx0, cy0, Math.round(z * 0.6), def.light, f, 3);
  windowBand(P, dx0, dy0, cx0, cy0, Math.round(z * 0.32), def.light, f + 2, 3);
  windowBand(P, cx0, cy0, bx0, by0, Math.round(z * 0.6), def.light, f + 1, 2);
  doorway(P, pt, w, h, z, def.light);
}

// transport stations: platform canopy + guideway pylon with cable arm
function stationDetail(P, g, z, f, def) {
  const { pt, w, h } = g;
  roofSlab(P, pt, w, h, z, tone(def.color, -0.02));
  const [rx, ry] = roofCenter(pt, w, h, z);
  // guideway pylon rising above the roof — the line anchors here
  P.slab(rx - 1, ry - 16, 3, 16, tone(STEEL, -0.05));
  P.vl(rx - 1, ry - 16, 16, tone(STEEL, 0.2));
  // cantilever cable arm
  P.hl(rx - 7, ry - 15, 14, tone(STEEL, 0.1));
  P.p(rx - 7, ry - 14, tone(def.light, -0.2)); P.p(rx + 6, ry - 14, tone(def.light, -0.2));
  P.glow(rx, ry - 17, def.light, f === 0 ? 0.45 : 0.2); // line-status beacon
  // platform edge lights
  const [dx0, dy0] = pt(0, h), [cx0, cy0] = pt(w, h);
  for (let k = 1; k < 4; k++) {
    const t = k / 4;
    P.p(Math.round(dx0 + (cx0 - dx0) * t), Math.round(dy0 + (cy0 - dy0) * t) + 1, (k + f) % 2 ? def.light : tone(def.light, -0.4));
  }
  windowBand(P, dx0, dy0, cx0, cy0, Math.round(z * 0.5), def.light, f, 3);
  doorway(P, pt, w, h, z, def.light);
}

// open-air grounds: planters, parasols and benches on a plinth (no walls)
function groundsDetail(parasol) {
  return (P, g, z, f, def) => {
    const { pt, w, h } = g;
    const [rx, ry] = roofCenter(pt, w, h, 0);
    // ground pad
    P.blob(rx, ry, (w + h) * 5, (w + h) * 2.6, tone(def.color, 0.06), { tex: 1, lite: 0.12, dark: 0.18 });
    // benches
    P.slab(rx - 8, ry - 2, 6, 2, tone('#6a5a44', 0.05)); P.hl(rx - 8, ry - 2, 6, tone('#6a5a44', 0.3));
    P.slab(rx + 3, ry + 2, 6, 2, tone('#6a5a44', -0.05)); P.hl(rx + 3, ry + 2, 6, tone('#6a5a44', 0.25));
    // planters
    P.blob(rx - 10, ry + 4, 2.4, 1.6, '#2a4a34', { tex: 1 }); P.p(rx - 10, ry + 2, '#3e6a4a');
    P.blob(rx + 11, ry - 3, 2.2, 1.5, '#2a4a34', { tex: 1 }); P.p(rx + 11, ry - 5, '#3e6a4a');
    if (parasol) {
      // parasols with pole + canopy
      for (const [px, py] of [[rx - 3, ry - 4], [rx + 7, ry - 1]]) {
        P.vl(px, py - 6, 6, STEEL);
        P.blob(px, py - 7, 4.4, 1.8, tone(def.light, -0.25), { lite: 0.25, dark: 0.3 });
        P.p(px, py - 8, tone(def.light, 0.1));
      }
    }
    // path lamps
    P.vl(rx - 13, ry - 3, 4, STEEL); P.p(rx - 13, ry - 4, f === 0 ? def.light : tone(def.light, -0.4));
  };
}

// glass habitat tunnel: repeating glazed arches along the long axis (no walls)
function tunnelDetail(P, g, z, f, def) {
  const { pt, w, h } = g;
  const [x0, y0] = pt(0, h / 2), [x1, y1] = pt(w, h / 2);
  const n = Math.max(4, Math.round(Math.hypot(x1 - x0, y1 - y0) / 9));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = Math.round(x0 + (x1 - x0) * t), y = Math.round(y0 + (y1 - y0) * t);
    // arch rib
    P.vl(x - 4, y - 8, 8, tone(STEEL, 0.05));
    P.vl(x + 4, y - 8, 8, tone(STEEL, -0.15));
    P.hl(x - 4, y - 9, 9, tone(STEEL, 0.2));
    // glass fill between ribs
    if (i < n) {
      const nx = Math.round(x0 + (x1 - x0) * ((i + 1) / n));
      P.r(x - 3, y - 8, nx - x + 6, 7, mixc(GLASS, def.light, (i + f) % 3 === 0 ? 0.35 : 0.2));
    }
  }
  P.glow(Math.round((x0 + x1) / 2), Math.round((y0 + y1) / 2) - 10, def.light, 0.25);
}

// encounter stage: apron deck + backdrop screen + spotlights
function stageDetail(P, g, z, f, def) {
  const { pt, w, h } = g;
  // deck on stub piers
  for (const [tx, ty] of [[0, 0], [w, 0], [w, h], [0, h]]) {
    const [x, y] = pt(tx, ty);
    P.r(Math.round(x) - 1, Math.round(y) - z + 2, 2, z - 2, tone(STEEL, -0.15));
  }
  isoBox(P, g.pt === pt ? 0 : 0, 0, 0, 0, 0, '#000', '#000', '#000'); // no-op guard
  const [rx, ry] = roofCenter(pt, w, h, z - 4);
  // stage floor
  P.blob(rx, ry + 3, (w + h) * 4.4, (w + h) * 2.2, tone(def.color, 0.12), { tex: 1, lite: 0.15, dark: 0.2 });
  // backdrop screen (upstage, NE side)
  P.slab(rx + 2, ry - 9, 12, 9, tone(def.color, -0.1), { tex: 1 });
  P.r(rx + 3, ry - 8, 10, 6, mixc(GLASS, def.light, f === 0 ? 0.55 : 0.35));
  P.hl(rx + 3, ry - 8, 10, tone(def.light, 0.2));
  // spotlight rig
  P.vl(rx - 10, ry - 10, 10, STEEL);
  P.hl(rx - 10, ry - 10, 8, tone(STEEL, 0.15));
  P.p(rx - 6, ry - 9, f === 0 ? '#fff2cc' : tone('#fff2cc', -0.4));
  P.p(rx - 3, ry - 9, f === 1 ? '#fff2cc' : tone('#fff2cc', -0.45));
}

// raised deck venues (obs deck / safari post / sky dining): canopy + rail + optics
function deckDetail(scoped) {
  return (P, g, z, f, def) => {
    const { pt, w, h } = g;
    // deck slab at top of piers
    isoBox(P, g.ox ?? 0, 0, 0, 0, 0, '#000', '#000', '#000'); // no-op guard
    const [rx, ry] = roofCenter(pt, w, h, z);
    P.blob(rx, ry + 2, (w + h) * 4.2, (w + h) * 2.1, tone(def.color, 0.15), { lite: 0.2, dark: 0.15, tex: 1 });
    // guard rail
    for (let k = -3; k <= 3; k++) {
      P.vl(rx + k * 4, ry - 3 + Math.abs(k), 3, tone(STEEL, 0.1));
    }
    P.hl(rx - 12, ry - 4, 24, tone(STEEL, 0.25));
    // canopy
    P.blob(rx + 2, ry - 8, (w + h) * 2.4, (w + h) * 1.1, tone(def.color, -0.1), { lite: 0.25, dark: 0.3 });
    P.hl(rx - 3, ry - 10, 8, tone(def.light, -0.2));
    if (scoped) {
      // long-range scope
      P.vl(rx - 6, ry - 6, 4, STEEL);
      P.hl(rx - 8, ry - 7, 5, tone(STEEL, 0.2));
      P.p(rx - 8, ry - 7, tone(def.light, 0.2));
    } else {
      // dining glazing + table lamps
      P.r(rx - 6, ry - 6, 10, 3, mixc(GLASS, def.light, 0.4));
      P.p(rx - 3, ry - 2, f === 0 ? '#ffe9b0' : tone('#ffe9b0', -0.4));
      P.p(rx + 4, ry, f === 1 ? '#ffe9b0' : tone('#ffe9b0', -0.4));
    }
    beacon(P, rx + 11, ry - 4, def.light, f === 0);
  };
}

DETAIL.obs_deck = deckDetail(true);
DETAIL.safari_post = deckDetail(true);
DETAIL.sky_dining = deckDetail(false);
DETAIL.glass_tunnel = tunnelDetail;
DETAIL.underwater_dome = domeDetail(0.45);
DETAIL.nocturnal_house = domeDetail(0.5);
DETAIL.xeno_dome = domeDetail(0.5);
DETAIL.holo_theatre = domeDetail(0.55);
DETAIL.vr_pavilion = domeDetail(0.4);
DETAIL.night_lodge = domeDetail(0.5);
DETAIL.predator_gallery = museumDetail;
DETAIL.nursery_view = domeDetail(0.3);
DETAIL.evo_museum = museumDetail;
DETAIL.relic_gallery = museumDetail;
DETAIL.megastore = museumDetail;
DETAIL.keeper_tour = museumDetail;
DETAIL.hatchery_view = domeDetail(0.3);
DETAIL.restaurant = dinerDetail;
DETAIL.food_court = dinerDetail;
DETAIL.merch_stall = dinerDetail;
DETAIL.premium_lounge = hotelDetail;
DETAIL.hotel = hotelDetail;
DETAIL.medical_station = museumDetail;
DETAIL.info_center = museumDetail;
DETAIL.encounter_stage = stageDetail;
DETAIL.rest_area = groundsDetail(false);
DETAIL.picnic_area = groundsDetail(true);
DETAIL.tram_station = stationDetail;
DETAIL.gondola_station = stationDetail;
DETAIL.rail_station = stationDetail;

// types that keep the boxy massing (everything except shelter + open feeders)
const BOXY = new Set(['admin', 'lab', 'power', 'security_post', 'tower', 'restroom', 'gift_shop', 'food_stall', 'drink_stall', 'viewing',
  'underwater_dome', 'nocturnal_house', 'predator_gallery', 'nursery_view', 'keeper_tour', 'hatchery_view',
  'holo_theatre', 'xeno_dome', 'evo_museum', 'relic_gallery', 'vr_pavilion', 'night_lodge',
  'restaurant', 'food_court', 'megastore', 'merch_stall', 'hotel', 'medical_station', 'info_center', 'premium_lounge',
  'tram_station', 'gondola_station', 'rail_station',
  'obs_deck', 'safari_post', 'sky_dining', 'encounter_stage']);
// tall open-lattice piers instead of solid walls
const LATTICE = new Set(['tower', 'obs_deck', 'safari_post', 'sky_dining', 'encounter_stage']);

// sprite baking ---------------------------------------------------------------
const cache = new Map();

export function getBuildingSprite(type, w, h) {
  const key = `${type}:${w}x${h}`;
  if (cache.has(key)) return cache.get(key);
  const def = BUILDINGS[type] || { color: '#22303e', light: '#2DE2E6' };
  const z = Z[type] ?? 14;
  const topPad = (TOP_PAD[type] ?? 6) + 4;
  const W = (w + h) * 16 + 8, H = (w + h) * 8 + z + topPad + 6;
  const ox = h * 16 + 4, oy = z + topPad;
  const frames = [0, 1].map((f) => {
    const P = new Px(W, H);
    const base = def.color;
    const g = { w, h, pt: mkPt(ox, oy) };
    if (BOXY.has(type)) {
      plinth(P, ox, oy, w, h, 2, 3);
      if (type === 'tower') {
        // open lattice: slender legs instead of solid walls
        const ptf = g.pt;
        for (const [tx, ty] of [[0, 0], [w, 0], [w, h], [0, h]]) {
          const [x, y] = ptf(tx, ty);
          P.r(Math.round(x) - 1, Math.round(y) - z, 2, z, tone(STEEL, ty === 0 ? 0.05 : -0.12));
        }
      } else if (type === 'viewing') {
        // open deck on stub piers
        const ptf = g.pt;
        for (const [tx, ty] of [[0, 0], [w, 0], [w, h], [0, h], [w / 2, h / 2]]) {
          const [x, y] = ptf(tx, ty);
          P.r(Math.round(x) - 1, Math.round(y) - z + 2, 2, z - 2, tone(STEEL, -0.15));
        }
        isoBox(P, ox, oy - z + 4, w, h, 4, tone(base, 0.26), tone(base, -0.14), tone(base, 0.05), { tex: 1 });
      } else {
        isoBox(P, ox, oy - 3, w, h, z - 3, tone(base, 0.3), tone(base, -0.12), tone(base, 0.07), { tex: 1 });
        wallDetail(P, g.pt, w, h, z, base, 'L', { dirty: type === 'power' });
        wallDetail(P, g.pt, w, h, z, base, 'R', { dirty: type === 'power' });
      }
    }
    (DETAIL[type] || DETAIL.restroom)(P, g, z, f, def);
    return P.canvas();
  });
  const spr = { frames, W, H, ox, oy };
  cache.set(key, spr);
  return spr;
}
