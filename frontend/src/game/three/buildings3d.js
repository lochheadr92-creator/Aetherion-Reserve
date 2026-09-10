// ---- Buildings: procedural architecture kit merged into a handful of PBR meshes (bible 3 "buildings") ----
// Every building type is composed from concrete / dark steel / roofing / glass / emissive parts placed
// in world space, then all parts of all buildings are merged per material (5 draw calls for the whole
// park). Rebuilt only when the building set changes; emissive windows and signage ramp with night.
import * as THREE from 'three';
import { BUILDINGS } from '../data/buildings';
import { hash, scaleUV, place, merge, withColor, installVertexEmissive } from './materials';

const CONCRETE = '#d9dcdf', STEEL_LIGHT = '#c9ced4', GLASS = '#A7F3FF';

function trimTint(def) {
  const c = new THREE.Color(def.color || '#20304a');
  const hsl = { h: 0, s: 0, l: 0 }; c.getHSL(hsl);
  return c.setHSL(hsl.h, Math.min(0.45, hsl.s + 0.12), 0.58).getStyle();
}

/** Collects coloured geometries per material bucket. */
class Kit {
  constructor() { this.buckets = { concrete: [], steel: [], roof: [], glass: [], glow: [] }; this.roofs = []; this.footArea = 1; this.top = 0; }
  /** Start collecting the roof height of one building (largest-area tops win; masts / lamps are ignored). */
  beginBuilding(area) { this.footArea = area; this.top = 0; }
  noteTop(area, y) { if (area >= this.footArea * 0.22 && y > this.top) this.top = y; }
  add(bucket, geom, color = '#ffffff') { this.buckets[bucket].push(withColor(geom, color)); return geom; }
  box(bucket, cx, y0, cz, sx, sy, sz, { ry = 0, color = '#ffffff', uv = 1 } = {}) {
    const g = new THREE.BoxGeometry(sx, sy, sz);
    scaleUV(g, uv * Math.max(sx, sz), uv * sy);
    if (bucket !== 'glow') this.noteTop(sx * sz, y0 + sy);
    return this.add(bucket, place(g, cx, y0 + sy / 2, cz, { ry }), color);
  }
  cyl(bucket, cx, y0, cz, rt, rb, h, { seg = 14, color = '#ffffff' } = {}) {
    const g = new THREE.CylinderGeometry(rt, rb, h, seg);
    scaleUV(g, 3, h);
    this.noteTop(Math.PI * rt * rt, y0 + h);
    return this.add(bucket, place(g, cx, y0 + h / 2, cz), color);
  }
  dome(bucket, cx, y0, cz, r, { color = '#ffffff', sy = 1 } = {}) {
    const g = new THREE.SphereGeometry(r, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    this.noteTop(Math.PI * r * r, y0 + r * sy * 0.7);
    return this.add(bucket, place(g, cx, y0, cz, { sy }), color);
  }
  /** Gabled roof spanning sx (across) by sz (along the ridge). */
  gable(bucket, cx, y0, cz, sx, sz, h, { color = '#ffffff', ry = 0 } = {}) {
    const shape = new THREE.Shape();
    shape.moveTo(-sx / 2, 0); shape.lineTo(sx / 2, 0); shape.lineTo(0, h); shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, { depth: sz, bevelEnabled: false });
    g.translate(0, 0, -sz / 2);
    g.computeVertexNormals();
    scaleUV(g, 1.4, 1.4);
    this.noteTop(sx * sz, y0 + h * 0.5);
    return this.add(bucket, place(g, cx, y0, cz, { ry }), color);
  }
  /** Emissive window strips on the two camera-facing walls (+X and +Z). */
  windows(cx, y, cz, sx, sz, rows, color, { rowGap = 0.32, cols = null, h = 0.1 } = {}) {
    const nx = cols || Math.max(1, Math.round(sz / 0.42)), nz = cols || Math.max(1, Math.round(sx / 0.42));
    for (let r = 0; r < rows; r++) {
      const yy = y + r * rowGap;
      for (let i = 0; i < nx; i++) { const z = cz - sz / 2 + (i + 0.5) * (sz / nx); this.add('glow', place(new THREE.BoxGeometry(0.02, h, 0.22), cx + sx / 2 + 0.005, yy, z), color); }
      for (let i = 0; i < nz; i++) { const x = cx - sx / 2 + (i + 0.5) * (sx / nz); this.add('glow', place(new THREE.BoxGeometry(0.22, h, 0.02), x, yy, cz + sz / 2 + 0.005), color); }
    }
  }
  /** Signage strip along the top of the camera-facing walls. */
  sign(cx, y, cz, sx, sz, color, t = 0.05) {
    this.add('glow', place(new THREE.BoxGeometry(0.025, t, sz * 0.8), cx + sx / 2 + 0.01, y, cz), color);
    this.add('glow', place(new THREE.BoxGeometry(sx * 0.8, t, 0.025), cx, y, cz + sz / 2 + 0.01), color);
  }
  lamp(cx, y, cz, color, r = 0.06) { this.add('glow', place(new THREE.SphereGeometry(r, 10, 8), cx, y, cz), color); }
  ring(cx, y, cz, r, color, tube = 0.03) { this.add('glow', place(new THREE.TorusGeometry(r, tube, 6, 24), cx, y, cz, { rx: Math.PI / 2 }), color); }
  posts(bucket, cx, y0, cz, sx, sz, h, r = 0.05, color = '#ffffff') {
    for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) this.cyl(bucket, cx + dx * sx / 2, y0, cz + dz * sz / 2, r, r, h, { seg: 8, color });
  }
}

// ---------- type composers ----------
function kiosk(k, b, def, y, cx, cz, w, h, trim, light) {
  const sx = w - 0.3, sz = h - 0.3, H = w >= 2 ? 0.95 : 0.75;
  k.box('concrete', cx, y, cz, sx, H, sz, { color: CONCRETE });
  k.box('steel', cx, y + H, cz, sx + 0.1, 0.06, sz + 0.1, { color: trim });
  k.box('roof', cx + 0.12, y + H + 0.06, cz + 0.12, sx + 0.5, 0.05, sz + 0.5, { color: STEEL_LIGHT }); // awning
  k.box('steel', cx + sx / 2 + 0.12, y, cz - sz / 2 + 0.1, 0.05, H + 0.06, 0.05, { color: trim });
  k.box('steel', cx - sx / 2 + 0.1, y, cz + sz / 2 + 0.12, 0.05, H + 0.06, 0.05, { color: trim });
  k.windows(cx, y + H * 0.55, cz, sx, sz, 1, light, { h: 0.16 });
  k.sign(cx, y + H - 0.06, cz, sx, sz, light, 0.045);
}

function hall(k, b, def, y, cx, cz, w, h, trim, light, { H = 1.25, dome = null, glassFront = true, rows = 2, dark = false } = {}) {
  const sx = w - 0.24, sz = h - 0.24;
  k.box(dark ? 'steel' : 'concrete', cx, y, cz, sx, H, sz, { color: dark ? '#4a5058' : CONCRETE });
  k.box('steel', cx, y + H, cz, sx + 0.08, 0.08, sz + 0.08, { color: trim });
  k.box('roof', cx, y + H + 0.08, cz, sx - 0.2, 0.06, sz - 0.2, { color: '#c4c9ce' });
  if (glassFront) k.box('glass', cx + sx / 2 + 0.02, y + 0.12, cz, 0.03, H * 0.6, sz * 0.7, { color: GLASS });
  k.windows(cx, y + 0.35, cz, sx, sz, rows, light, { rowGap: (H - 0.5) / Math.max(1, rows - 1) });
  k.sign(cx, y + H - 0.1, cz, sx, sz, light);
  if (dome === 'glass') { k.dome('glass', cx, y + H + 0.1, cz, Math.min(sx, sz) * 0.42, { color: GLASS }); k.ring(cx, y + H + 0.12, cz, Math.min(sx, sz) * 0.42, light, 0.02); }
  else if (dome === 'solid') { k.dome('roof', cx, y + H + 0.1, cz, Math.min(sx, sz) * 0.42, { color: '#b9bec4' }); k.ring(cx, y + H + 0.16, cz, Math.min(sx, sz) * 0.36, light, 0.02); }
  // entrance canopy on the +X side
  k.box('steel', cx + sx / 2 + 0.2, y + 0.55, cz, 0.42, 0.04, 0.9, { color: trim });
}

function elevated(k, b, def, y, cx, cz, w, h, trim, light, H = 1.1) {
  const sx = w - 0.3, sz = h - 0.3;
  k.box('concrete', cx, y, cz, sx * 0.55, 0.12, sz * 0.55, { color: CONCRETE });
  k.posts('steel', cx, y, cz, sx * 0.7, sz * 0.7, H, 0.06, trim);
  k.box('steel', cx, y + H, cz, sx, 0.1, sz, { color: trim });                           // deck
  k.box('glass', cx + sx / 2, y + H + 0.1, cz, 0.03, 0.32, sz, { color: GLASS });           // balustrade
  k.box('glass', cx, y + H + 0.1, cz + sz / 2, sx, 0.32, 0.03, { color: GLASS });
  k.box('concrete', cx - sx * 0.15, y + H + 0.1, cz - sz * 0.15, sx * 0.55, 0.55, sz * 0.55, { color: CONCRETE }); // cabin
  k.box('roof', cx - sx * 0.15, y + H + 0.65, cz - sz * 0.15, sx * 0.75, 0.05, sz * 0.75, { color: '#c4c9ce' });
  k.windows(cx - sx * 0.15, y + H + 0.38, cz - sz * 0.15, sx * 0.55, sz * 0.55, 1, light, { h: 0.14 });
  k.sign(cx, y + H + 0.36, cz, sx, sz, light, 0.035);
}

function station(k, b, def, y, cx, cz, w, h, trim, light) {
  const sx = w - 0.2, sz = h - 0.2;
  k.box('concrete', cx, y, cz, sx, 0.22, sz, { color: CONCRETE });
  k.posts('steel', cx, y + 0.22, cz, sx * 0.6, sz * 0.6, 0.85, 0.05, trim);
  k.box('roof', cx, y + 1.07, cz, sx * 0.9, 0.06, sz * 0.9, { color: '#b9bec4' });
  k.box('steel', cx, y + 1.13, cz, sx * 0.92, 0.04, sz * 0.92, { color: trim });
  k.cyl('steel', cx - sx * 0.3, y, cz - sz * 0.3, 0.09, 0.12, 2.3, { color: trim });      // guideway pylon
  k.ring(cx - sx * 0.3, y + 2.25, cz - sz * 0.3, 0.2, light, 0.03);
  k.sign(cx, y + 1.0, cz, sx, sz, light);
  k.box('glow', cx, y + 0.22, cz + sz / 2 - 0.05, sx * 0.8, 0.02, 0.06, { color: light }); // platform edge light
}

const COMPOSERS = {
  // player lighting: only a concrete foot here — the post, head, bulb and pools are instanced by LampLayer
  path_lamp(k, b, def, y, cx, cz) { k.box('concrete', cx, y, cz, 0.34, 0.06, 0.34, { color: CONCRETE }); },
  floodlight(k, b, def, y, cx, cz) { k.box('concrete', cx, y, cz, 0.5, 0.08, 0.5, { color: CONCRETE }); },
  admin(k, b, def, y, cx, cz, w, h, trim, light) {
    k.box('concrete', cx, y, cz, 2.7, 1.1, 2.7, { color: CONCRETE });
    k.box('steel', cx, y + 1.1, cz, 2.78, 0.08, 2.78, { color: trim });
    k.box('concrete', cx - 0.35, y + 1.18, cz - 0.35, 1.6, 0.75, 1.6, { color: CONCRETE });
    k.box('roof', cx - 0.35, y + 1.93, cz - 0.35, 1.5, 0.06, 1.5, { color: '#b9bec4' });
    k.windows(cx, y + 0.4, cz, 2.7, 2.7, 2, light, { rowGap: 0.4 });
    k.windows(cx - 0.35, y + 1.55, cz - 0.35, 1.6, 1.6, 1, light);
    k.sign(cx, y + 1.02, cz, 2.7, 2.7, light);
    k.cyl('steel', cx - 0.9, y + 1.99, cz - 0.9, 0.025, 0.04, 1.0, { seg: 8, color: trim });
    k.lamp(cx - 0.9, y + 3.02, cz - 0.9, light, 0.05);
    k.box('steel', cx + 1.45, y + 0.6, cz, 0.5, 0.05, 1.1, { color: trim }); // entrance canopy
  },
  lab(k, b, def, y, cx, cz, w, h, trim, light) {
    k.box('concrete', cx, y, cz, 1.76, 0.85, 1.76, { color: CONCRETE });
    k.box('glass', cx, y + 0.85, cz, 1.6, 0.34, 1.6, { color: GLASS });
    k.box('steel', cx, y + 1.19, cz, 1.72, 0.07, 1.72, { color: trim });
    k.cyl('steel', cx - 0.45, y + 1.26, cz - 0.4, 0.12, 0.14, 0.22, { seg: 10, color: STEEL_LIGHT });
    k.cyl('steel', cx + 0.3, y + 1.26, cz - 0.5, 0.09, 0.11, 0.3, { seg: 10, color: STEEL_LIGHT });
    k.windows(cx, y + 0.45, cz, 1.76, 1.76, 1, light, { h: 0.14 });
    k.sign(cx, y + 0.78, cz, 1.76, 1.76, light);
    k.ring(cx, y + 1.02, cz, 0.35, light, 0.015);
  },
  power(k, b, def, y, cx, cz, w, h, trim, light) {
    k.box('concrete', cx, y, cz, 1.8, 0.15, 1.8, { color: '#b9bdc2' });
    k.cyl('steel', cx, y + 0.15, cz, 0.42, 0.5, 0.9, { color: '#5a6068' });
    k.cyl('steel', cx, y + 1.05, cz, 0.2, 0.42, 0.25, { color: trim });
    for (const [dx, dz] of [[-0.62, -0.62], [0.62, -0.62], [-0.62, 0.62]]) {
      k.cyl('steel', cx + dx, y + 0.15, cz + dz, 0.05, 0.07, 1.35, { seg: 8, color: STEEL_LIGHT });
      for (const fy of [0.7, 0.95, 1.2]) k.ring(cx + dx, y + 0.15 + fy, cz + dz, 0.09, light, 0.02);
      k.lamp(cx + dx, y + 1.55, cz + dz, light, 0.05);
    }
    k.box('steel', cx + 0.55, y + 0.15, cz + 0.55, 0.5, 0.45, 0.5, { color: trim });
    k.ring(cx, y + 1.31, cz, 0.22, light, 0.03);
  },
  security_post(k, b, def, y, cx, cz, w, h, trim, light) {
    k.box('steel', cx, y, cz, 1.7, 0.8, 1.7, { color: '#454b53' });
    k.box('steel', cx, y + 0.8, cz, 1.78, 0.07, 1.78, { color: trim });
    k.box('roof', cx, y + 0.87, cz, 1.5, 0.05, 1.5, { color: '#b9bec4' });
    k.cyl('steel', cx - 0.55, y + 0.92, cz - 0.55, 0.035, 0.05, 1.5, { seg: 8, color: STEEL_LIGHT });
    k.lamp(cx - 0.55, y + 2.45, cz - 0.55, light, 0.07);
    k.windows(cx, y + 0.45, cz, 1.7, 1.7, 1, light, { h: 0.1 });
    k.sign(cx, y + 0.72, cz, 1.7, 1.7, '#FFB86B', 0.04);
    k.box('steel', cx + 0.85, y + 0.5, cz, 0.35, 0.04, 1.2, { color: trim });
  },
  feeder_forage(k, b, def, y, cx, cz, w, h, trim, light) {
    k.box('steel', cx, y, cz, 0.72, 0.28, 0.42, { color: '#6b7278' });
    k.box('concrete', cx, y + 0.24, cz, 0.62, 0.12, 0.32, { color: '#8fa052' });
    k.box('steel', cx - 0.3, y, cz, 0.05, 0.6, 0.05, { color: trim });
    k.lamp(cx - 0.3, y + 0.62, cz, light, 0.035);
  },
  feeder_meat(k, b, def, y, cx, cz, w, h, trim, light) {
    k.box('steel', cx, y, cz, 0.6, 0.06, 0.6, { color: '#555b62' });
    for (const dx of [-0.26, 0.26]) k.box('steel', cx + dx, y, cz, 0.05, 0.75, 0.05, { color: trim });
    k.box('steel', cx, y + 0.72, cz, 0.6, 0.05, 0.05, { color: trim });
    k.box('concrete', cx, y + 0.3, cz, 0.28, 0.32, 0.2, { color: '#7a3a3c' });
    k.sign(cx, y + 0.1, cz, 0.6, 0.6, light, 0.02);
  },
  feeder_mineral(k, b, def, y, cx, cz, w, h, trim, light) {
    k.box('concrete', cx, y, cz, 0.7, 0.26, 0.5, { color: '#a8adb3' });
    for (let i = 0; i < 4; i++) { const g = new THREE.ConeGeometry(0.06, 0.28 + hash(i, 1) * 0.16, 5); k.add('glass', place(g, cx - 0.2 + i * 0.13, y + 0.36, cz + (hash(i, 2) - 0.5) * 0.2, { rz: (hash(i, 3) - 0.5) * 0.4 }), GLASS); }
    k.sign(cx, y + 0.22, cz, 0.7, 0.5, light, 0.02);
  },
  feeder_fungal(k, b, def, y, cx, cz, w, h, trim, light) {
    k.cyl('steel', cx, y, cz, 0.28, 0.3, 0.62, { color: '#5a5f68' });
    k.dome('roof', cx, y + 0.62, cz, 0.3, { color: '#9aa0a8', sy: 0.7 });
    k.ring(cx, y + 0.6, cz, 0.3, light, 0.02);
    k.box('steel', cx + 0.15, y + 0.15, cz + 0.28, 0.16, 0.16, 0.06, { color: trim });
  },
  feeder_energy(k, b, def, y, cx, cz, w, h, trim, light) {
    k.box('steel', cx, y, cz, 0.5, 0.08, 0.5, { color: '#555b62' });
    k.cyl('steel', cx, y + 0.08, cz, 0.13, 0.18, 0.9, { seg: 10, color: trim });
    for (const fy of [0.35, 0.6, 0.85]) k.ring(cx, y + fy, cz, 0.2, light, 0.02);
    k.lamp(cx, y + 1.02, cz, light, 0.06);
  },
  shelter(k, b, def, y, cx, cz, w, h, trim, light) {
    k.box('concrete', cx, y, cz, 1.7, 0.06, 1.7, { color: '#b9bdc2' });
    k.posts('steel', cx, y, cz, 1.4, 1.4, 0.75, 0.05, trim);
    k.box('steel', cx - 0.72, y, cz, 0.06, 0.75, 1.5, { color: '#5a6068' });
    k.gable('roof', cx, y + 0.75, cz, 1.9, 1.9, 0.5, { color: '#b9bec4' });
    k.lamp(cx, y + 0.7, cz, light, 0.035);
  },
  viewing: (k, b, def, y, cx, cz, w, h, trim, light) => elevated(k, b, def, y, cx, cz, w, h, trim, light, 0.45),
  obs_deck: (k, b, def, y, cx, cz, w, h, trim, light) => elevated(k, b, def, y, cx, cz, w, h, trim, light, 1.1),
  safari_post: (k, b, def, y, cx, cz, w, h, trim, light) => elevated(k, b, def, y, cx, cz, w, h, trim, light, 1.3),
  sky_dining: (k, b, def, y, cx, cz, w, h, trim, light) => elevated(k, b, def, y, cx, cz, w, h, trim, light, 1.6),
  tower(k, b, def, y, cx, cz, w, h, trim, light) {
    k.box('concrete', cx, y, cz, 1.2, 0.5, 1.2, { color: CONCRETE });
    k.cyl('steel', cx, y + 0.5, cz, 0.22, 0.3, 1.7, { color: trim });
    k.box('steel', cx, y + 2.2, cz, 1.5, 0.1, 1.5, { color: trim });
    k.box('glass', cx, y + 2.3, cz, 1.4, 0.5, 1.4, { color: GLASS });
    k.box('roof', cx, y + 2.8, cz, 1.55, 0.07, 1.55, { color: '#b9bec4' });
    k.lamp(cx, y + 2.95, cz, light, 0.06);
    k.sign(cx, y + 2.26, cz, 1.5, 1.5, light, 0.03);
  },
  glass_tunnel(k, b, def, y, cx, cz, w, h, trim, light) {
    const long = w >= h, L = (long ? w : h) - 0.2;
    const tube = new THREE.CylinderGeometry(0.42, 0.42, L, 20, 1, true, 0, Math.PI);
    k.add('glass', place(tube, cx, y + 0.1, cz, { rz: Math.PI / 2, ry: long ? 0 : Math.PI / 2 }), GLASS);
    for (let i = 0; i < 4; i++) {
      const t = -L / 2 + 0.1 + i * ((L - 0.2) / 3);
      const rib = new THREE.TorusGeometry(0.43, 0.03, 6, 16, Math.PI);
      k.add('steel', place(rib, cx + (long ? t : 0), y + 0.1, cz + (long ? 0 : t), { ry: long ? Math.PI / 2 : 0 }), trim);
    }
    k.box('concrete', cx, y, cz, long ? L : 0.9, 0.1, long ? 0.9 : L, { color: CONCRETE });
    k.box('glow', cx, y + 0.1, cz, long ? L * 0.9 : 0.04, 0.02, long ? 0.04 : L * 0.9, { color: light });
  },
  underwater_dome: (k, ...a) => hall(k, ...a, { H: 0.7, dome: 'glass', rows: 1 }),
  xeno_dome: (k, ...a) => hall(k, ...a, { H: 0.9, dome: 'glass', rows: 1 }),
  holo_theatre: (k, ...a) => hall(k, ...a, { H: 1.2, dome: 'solid', rows: 2 }),
  nocturnal_house: (k, ...a) => hall(k, ...a, { H: 1.1, glassFront: false, rows: 1, dark: true }),
  predator_gallery: (k, ...a) => hall(k, ...a, { H: 1.3, glassFront: false, rows: 1, dark: true }),
  night_lodge: (k, ...a) => hall(k, ...a, { H: 1.2, rows: 2, dark: true }),
  hotel: (k, ...a) => hall(k, ...a, { H: 2.4, rows: 5 }),
  megastore: (k, ...a) => hall(k, ...a, { H: 1.3, rows: 2 }),
  vr_pavilion: (k, ...a) => hall(k, ...a, { H: 1.2, dome: 'solid', rows: 1 }),
  rest_area(k, b, def, y, cx, cz, w, h, trim, light) {
    k.box('concrete', cx, y, cz, 1.7, 0.06, 1.7, { color: '#c5c9cd' });
    k.posts('steel', cx, y, cz, 1.3, 1.3, 0.8, 0.04, trim);
    k.box('roof', cx, y + 0.8, cz, 1.7, 0.05, 1.7, { color: '#c4c9ce' });
    for (const dx of [-0.45, 0.45]) k.box('steel', cx + dx, y + 0.06, cz, 0.2, 0.22, 0.9, { color: '#6b5a48' });
    k.lamp(cx, y + 0.76, cz, light, 0.035);
  },
  picnic_area(k, b, def, y, cx, cz, w, h, trim, light) {
    k.box('concrete', cx, y, cz, 1.7, 0.04, 1.7, { color: '#a9b08e' });
    for (const [dx, dz] of [[-0.4, -0.35], [0.4, 0.35]]) { k.box('steel', cx + dx, y + 0.04, cz + dz, 0.7, 0.28, 0.32, { color: '#6b5a48' }); k.box('steel', cx + dx, y + 0.32, cz + dz, 0.8, 0.04, 0.5, { color: '#7a6a55' }); }
    k.cyl('steel', cx, y, cz, 0.03, 0.03, 1.1, { seg: 6, color: trim });
    k.lamp(cx, y + 1.12, cz, light, 0.04);
  },
  tram_station: station, gondola_station: station, rail_station: station,
};

const KIOSKS = new Set(['food_stall', 'drink_stall', 'restroom', 'gift_shop', 'merch_stall', 'info_center', 'medical_station', 'keeper_tour']);

/** Ground height a building's slab sits at (highest footprint corner). */
export function buildingBaseY(b, heightAt) {
  const def = BUILDINGS[b.type];
  const w = b.w || (def && def.w) || 1, h = b.h || (def && def.h) || 1;
  let y = -Infinity;
  for (const [dx, dz] of [[0, 0], [w, 0], [0, h], [w, h], [w / 2, h / 2]]) y = Math.max(y, heightAt(b.x + dx, b.y + dz));
  return y;
}

/** World position of a transport station's guideway pylon top (matches the station composer). */
export function stationPylon(b, heightAt) {
  const def = BUILDINGS[b.type];
  const w = b.w || def.w, h = b.h || def.h;
  const cx = b.x + w / 2, cz = b.y + h / 2, sx = w - 0.2, sz = h - 0.2;
  return { x: cx - sx * 0.3, y: buildingBaseY(b, heightAt) + 0.04 + 2.28, z: cz - sz * 0.3 };
}

export function composeBuilding(k, b, y) {
  const def = BUILDINGS[b.type]; if (!def) return;
  const w = b.w || def.w, h = b.h || def.h;
  const cx = b.x + w / 2, cz = b.y + h / 2;
  const trim = trimTint(def), light = def.light || '#7FE7FF';
  k.beginBuilding(w * h);
  // slab under everything hides slope steps
  k.box('concrete', cx, y - 0.06, cz, w - 0.04, 0.1, h - 0.04, { color: '#b4b8bc' });
  const fn = COMPOSERS[b.type] || (KIOSKS.has(b.type) ? kiosk : hall);
  fn(k, b, def, y + 0.04, cx, cz, w, h, trim, light);
  // hard surfaces rain can splash on: the slab and the highest broad top
  k.roofs.push({ x0: b.x, z0: b.y, x1: b.x + w, z1: b.y + h, slab: y + 0.04, top: k.top });
}

export class BuildingLayer {
  constructor(group, kit) {
    this.group = group; this.kit = kit;
    this.materials = {
      concrete: kit.pbr('concrete', { roughness: 0.86, normalScale: 0.65, vertexColors: true }),
      steel: kit.pbr('darksteel', { boost: 2.3, roughness: 0.5, metalness: 0.5, normalScale: 0.55, vertexColors: true }),
      roof: kit.pbr('roofing', { boost: 1.7, roughness: 0.72, metalness: 0.2, normalScale: 0.6, vertexColors: true }),
      glass: kit.glass(),
      glow: installVertexEmissive(new THREE.MeshStandardMaterial({ color: '#0d0f12', roughness: 0.35, emissive: '#ffffff', emissiveIntensity: 0.5 })),
    };
    this.meshes = {};
    this.signature = null;
    this.roofs = [];
  }

  /** Highest hard surface under (x, z) if a building stands there (rain splash / prop grounding), else null. */
  roofAt(x, z) {
    for (const r of this.roofs) {
      if (x >= r.x0 && x < r.x1 && z >= r.z0 && z < r.z1) {
        // inset: the main mass is smaller than the footprint; edges get the slab
        const inset = 0.16;
        return (x > r.x0 + inset && x < r.x1 - inset && z > r.z0 + inset && z < r.z1 - inset) ? r.top : r.slab;
      }
    }
    return null;
  }

  signatureOf(state) {
    let sig = '';
    for (const b of state.buildings) sig += `${b.type}:${b.x},${b.y};`;
    return sig;
  }

  /** Rebuild the merged meshes when the building set changes (or terrain moved underneath). */
  sync(state, heightAt, force = false) {
    const sig = this.signatureOf(state);
    if (!force && sig === this.signature) return;
    this.signature = sig;
    for (const key of Object.keys(this.meshes)) { const m = this.meshes[key]; this.group.remove(m); m.geometry.dispose(); }
    this.meshes = {};
    const k = new Kit();
    for (const b of state.buildings) {
      const def = BUILDINGS[b.type]; if (!def) continue;
      composeBuilding(k, b, buildingBaseY(b, heightAt));
    }
    this.roofs = k.roofs;
    for (const bucket of Object.keys(k.buckets)) {
      const geom = merge(k.buckets[bucket]);
      if (!geom) continue;
      const mesh = new THREE.Mesh(geom, this.materials[bucket]);
      mesh.castShadow = bucket !== 'glass' && bucket !== 'glow';
      mesh.receiveShadow = bucket !== 'glass';
      mesh.frustumCulled = false;
      mesh.renderOrder = bucket === 'glass' ? 7 : 0;
      mesh.name = `buildings-${bucket}`;
      this.group.add(mesh);
      this.meshes[bucket] = mesh;
    }
  }

  update(light) {
    // windows / signage: faint by day, bright at night (bible 2 "night_emissives")
    this.materials.glow.emissiveIntensity = 0.35 + 1.25 * light.night;
  }

  dispose() { for (const key of Object.keys(this.meshes)) { this.group.remove(this.meshes[key]); this.meshes[key].geometry.dispose(); } }
}
