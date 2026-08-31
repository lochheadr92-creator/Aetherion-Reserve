// ---- Baked vegetation sprites (visual-only) ----
// Shrubs, trees, spore pillars, aether fronds redesigned as layered pixel
// sprites with trunk/branch structure, canopy depth and restrained glow.
// Grass and reeds remain procedural (cheap swaying strokes) in the renderer.
import { Px, tone, mixc } from './pixel';
import { h2 } from './terrain_tex';

// canopy mass: clustered leaf blob with dark under-canopy + lit crown
function canopy(P, cx, cy, rx, ry, base, seed) {
  // under-canopy (shadow mass, slightly offset lower-right)
  P.blob(cx + 1, cy + 1, rx, ry, tone(base, -0.35), { lite: 0.02, dark: 0.12 });
  // main mass
  P.blob(cx, cy, rx, ry, base, { lite: 0.14, dark: 0.3, tex: 1 });
  // lit crown clusters (upper-left)
  for (let k = 0; k < Math.max(3, Math.floor(rx)); k++) {
    const a = h2(k, seed, 1) * Math.PI - Math.PI * 0.75;
    const d = h2(k, seed, 2) * 0.55 + 0.25;
    const x = cx + Math.cos(a) * rx * d, y = cy + Math.sin(a) * ry * d;
    P.blob(x, y, 1.6 + h2(k, seed, 3), 1.1 + h2(k, seed, 4) * 0.6, tone(base, 0.22), { lite: 0.15, dark: 0.05 });
  }
  // leaf noise
  P.dither(cx - rx, cy - ry, rx * 2, ry * 2, tone(base, -0.2), 0.1, seed);
  P.dither(cx - rx, cy - ry, rx * 2, ry * 1.2, tone(base, 0.3), 0.06, seed + 9);
}

function trunk(P, x0, y0, x1, y1, w, bark) {
  const n = Math.max(2, Math.round(Math.abs(y1 - y0)));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = Math.round(x0 + (x1 - x0) * t), y = Math.round(y0 + (y1 - y0) * t);
    P.r(x, y, w, 1, i % 3 === 0 ? tone(bark, 0.1) : bark);
    P.p(x + w, y, tone(bark, -0.3)); // shaded right edge
  }
}

const FLORA = {
  // 2) SHRUB CLUSTER — layered rounded masses w/ woody core
  2: {
    w: 16, h: 11,
    paint(P, v, f) {
      const base = mixc('#1e4a35', '#2a5a40', v * 0.5);
      const sway = f ? 1 : 0;
      // woody stems
      P.vl(5, 7, 3, '#3a2e22'); P.vl(10, 8, 2, '#31271d');
      canopy(P, 5 + sway * 0.5, 5.5, 4.4, 3, base, v * 7 + 1);
      canopy(P, 10, 6.5, 3.6, 2.6, tone(base, -0.06), v * 7 + 2);
      canopy(P, 8 + sway, 3.8, 3, 2, tone(base, 0.05), v * 7 + 3);
      // berry accents
      P.p(4, 4, '#4a8a68'); P.p(11, 5, '#4a8a68');
    },
  },
  // 3) SMALL TREE — visible fork trunk + asymmetric two-mass canopy
  3: {
    w: 18, h: 18,
    paint(P, v, f) {
      const base = mixc('#2a6a4a', '#245c3f', v * 0.6);
      const bark = '#3a2e22';
      const sway = f ? 1 : 0;
      trunk(P, 8, 17, 8 + sway * 0.4, 9, 2, bark);
      // fork branches
      trunk(P, 8, 10, 5, 7, 1, tone(bark, -0.06));
      trunk(P, 9, 10, 12, 7, 1, tone(bark, -0.1));
      // root flare
      P.p(6, 17, tone(bark, -0.15)); P.p(11, 17, tone(bark, -0.2));
      canopy(P, 6 + sway * 0.6, 5.5, 4.6, 3.4, base, v * 11 + 4);
      canopy(P, 12 + sway, 6, 4, 3, tone(base, -0.08), v * 11 + 5);
      canopy(P, 9 + sway * 0.8, 3, 3.4, 2.2, tone(base, 0.08), v * 11 + 6);
    },
  },
  // 4) CANOPY TREE — heavy trunk w/ root flare, twin-tier asymmetric crown
  4: {
    w: 26, h: 25,
    paint(P, v, f) {
      const base = mixc('#1f5c40', '#25543a', v * 0.6);
      const bark = '#3a2e22';
      const sway = f ? 1 : 0;
      trunk(P, 12, 24, 12 + sway * 0.5, 12, 3, bark);
      // buttress roots
      P.r(9, 23, 2, 2, tone(bark, -0.12)); P.r(16, 23, 2, 2, tone(bark, -0.2));
      P.p(8, 24, tone(bark, -0.25)); P.p(18, 24, tone(bark, -0.3));
      // major limbs
      trunk(P, 12, 13, 6, 9, 1, tone(bark, -0.05));
      trunk(P, 14, 13, 20, 8, 1, tone(bark, -0.1));
      // lower tier
      canopy(P, 8 + sway * 0.5, 8.5, 6.4, 4, tone(base, -0.05), v * 13 + 7);
      canopy(P, 18 + sway, 8, 6, 3.8, tone(base, -0.1), v * 13 + 8);
      // upper crown
      canopy(P, 13 + sway * 0.8, 4.2, 6.6, 3.4, tone(base, 0.06), v * 13 + 9);
      // hanging frond wisps
      P.vl(5, 11, 3, tone(base, -0.18)); P.vl(22, 10, 3, tone(base, -0.22));
      P.p(5, 14, tone(base, -0.3)); P.p(22, 13, tone(base, -0.35));
    },
  },
  // 6) SPORE PILLAR — fungal stalks w/ ring bands and glowing pores
  6: {
    w: 16, h: 15,
    paint(P, v, f) {
      const stem = '#5c4468', cap = '#7a4a9a', glow = '#b98ae0';
      // main stalk
      P.slab(6, 5, 3, 10, stem, { tex: 1 });
      P.hl(6, 5, 3, tone(stem, 0.2));
      // ring bands
      P.hl(6, 8, 3, tone(stem, -0.25)); P.hl(6, 11, 3, tone(stem, -0.2));
      // side stalk
      P.slab(11, 8, 2, 7, tone(stem, -0.1), { tex: 1 });
      // caps (gill underside dark)
      P.blob(7.5, 3.6, 4.4, 2.2, cap, { lite: 0.2, dark: 0.3, tex: 1 });
      P.hl(4, 5, 7, tone(cap, -0.4));
      P.blob(12, 7, 2.6, 1.5, tone(cap, -0.06), { lite: 0.2, dark: 0.3 });
      // glowing pores (pulse by frame)
      const g = f ? 0.42 : 0.26;
      P.glow(6, 3, glow, g); P.glow(9, 4, glow, g * 0.8);
      P.p(12, 6, mixc(cap, glow, 0.6));
      // spore motes
      P.p(3, 1 + f, tone(glow, -0.25)); P.p(13, 2 - f, tone(glow, -0.4));
      // base flare
      P.r(5, 14, 5, 1, tone(stem, -0.3));
    },
  },
  // 7) AETHER FROND — crystalline base + fan of curved emissive fronds
  7: {
    w: 18, h: 17,
    paint(P, v, f) {
      const frond = '#3a6aa0', glow = '#6ef3c5', crys = '#4a5a7c';
      // crystalline base cluster
      P.r(7, 13, 4, 3, crys); P.p(7, 12, tone(crys, 0.25));
      P.r(6, 14, 1, 2, tone(crys, -0.2)); P.r(11, 14, 2, 2, tone(crys, -0.15));
      P.p(12, 13, tone(crys, 0.15));
      // fan of curved fronds
      for (let k = 0; k < 5; k++) {
        const bend = (k - 2) * 0.55;
        let x = 8.5 + (k - 2) * 0.6, y = 13;
        for (let s = 0; s < 10 - Math.abs(k - 2); s++) {
          x += bend * 0.35 + (k - 2) * 0.08; y -= 1;
          const c = s > 6 ? mixc(frond, glow, 0.4) : s % 3 ? frond : tone(frond, 0.12);
          P.p(Math.round(x), Math.round(y), c);
          if (s === 9 - Math.abs(k - 2) - 0) P.p(Math.round(x), Math.round(y) - 1, c);
        }
        // emissive tips (pulse)
        const tipY = 13 - (10 - Math.abs(k - 2));
        if ((k + f) % 2 === 0) P.glow(Math.round(8.5 + (k - 2) * 0.6 + bend * 3.2), tipY, glow, 0.35);
        else P.p(Math.round(8.5 + (k - 2) * 0.6 + bend * 3.2), tipY, tone(glow, -0.2));
      }
    },
  },
};

const cache = new Map();

// getFloraSprite(vId, x, y, frame) → baked canvas (2 variants × 2 frames)
export function getFloraSprite(vId, x, y, frame) {
  const def = FLORA[vId];
  if (!def) return null;
  const v = Math.floor(h2(x, y, 31) * 2);
  const f = frame % 2;
  const key = `${vId}:${v}:${f}`;
  if (!cache.has(key)) {
    const P = new Px(def.w, def.h);
    def.paint(P, v, f);
    P.outline('rgba(5,9,14,0.7)');
    cache.set(key, { cv: P.canvas(), w: def.w, h: def.h });
  }
  return cache.get(key);
}
