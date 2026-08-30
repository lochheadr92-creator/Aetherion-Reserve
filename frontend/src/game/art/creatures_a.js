// ---- Creature pixel painters A: veyra, skitter, thornback, hollowcrest, mirefin, silttitan, shardling, mosswarden ----
// All painted FACING RIGHT; renderer flips for direction. Ground = bottom row. Light: upper-left.
import { tone, mixc } from './pixel';

// legs helper: thin vertical legs with walk offsets
function legs(P, xs, yTop, yBot, w, color, f, mode) {
  xs.forEach((x, i) => {
    const off = mode === 'walk' ? ((i % 2 === f % 2) ? 1 : -1) : 0;
    P.r(x + (off > 0 ? 1 : 0), yTop, w, yBot - yTop - (off < 0 ? 1 : 0), color);
    P.r(x + (off > 0 ? 1 : 0), yBot - 1, w, 1, tone(color, -0.3)); // foot
  });
}

export const CREATURES_A = {
  // 1) VEYRA STRIDER — tall elegant plains walker, elongated sensory neck, four-eye cluster
  veyra: {
    w: 26, h: 34, idleFrames: 3, walkFrames: 2,
    shadow: { rx: 9, ry: 3.4, alpha: 0.32 },
    paint(P, f, mode) {
      const body = '#4a6a5c', belly = '#5f8371', acc = '#8fd0b0';
      const br = mode === 'idle' ? (f === 1 ? 0.6 : 0) : 0; // breathing
      // long legs
      legs(P, [8, 11, 15, 18], 21, 33, 1, tone(body, -0.25), f, mode);
      // haunch joints
      P.p(8, 24, tone(body, -0.1)); P.p(18, 24, tone(body, -0.1));
      // body
      P.blob(13, 18 - br * 0.5, 7, 4 + br, body, { tex: 1 });
      P.blob(12, 20, 5, 2.4, belly, { lite: 0.25 });
      // shoulder marking
      P.hl(10, 15, 5, tone(acc, -0.25));
      // neck (sways with idle frames)
      const nx = mode === 'idle' ? (f === 2 ? 1 : 0) : 0;
      for (let i = 0; i < 10; i++) {
        const x = 18 + Math.round(i * 0.42) + nx, y = 15 - i;
        P.r(x, y, 2, 1, i % 3 ? body : tone(body, 0.08));
      }
      // head
      P.blob(23 + nx, 4, 2.6, 1.9, tone(body, 0.12));
      P.r(25 + nx, 4, 2, 1, tone(belly, 0.05)); // muzzle
      // four-eye cluster
      P.p(23 + nx, 3, '#dffcf4'); P.p(24 + nx, 3, '#bfeee0');
      P.p(23 + nx, 4, '#bfeee0'); P.p(24 + nx, 4, '#dffcf4');
      // sensory stalk
      P.vl(22 + nx, 1, 2, tone(acc, -0.1)); P.p(22 + nx, 0, acc);
      // tail wisp
      P.r(5, 16, 2, 1, body); P.p(4, 17, tone(body, -0.15));
    },
  },

  // 2) SKITTERLING — tiny nervous scuttler, many legs, bright sensory points
  skitter: {
    w: 12, h: 8, idleFrames: 3, walkFrames: 2,
    shadow: { rx: 5, ry: 1.6, alpha: 0.3 },
    paint(P, f, mode) {
      const body = '#7a6a4a', acc = '#e0c080';
      // six legs
      const lo = mode === 'walk' ? (f % 2 ? 1 : 0) : 0;
      [2, 4, 6, 8].forEach((x, i) => {
        P.vl(x + ((i + lo) % 2), 5, 2, tone(body, -0.3));
      });
      P.vl(1, 6, 1, tone(body, -0.3)); P.vl(10, 6, 1, tone(body, -0.3));
      // abdomen + thorax
      P.blob(4, 4, 3.4, 2.2, body, { tex: 1 });
      P.blob(8, 3.6, 2.2, 1.7, tone(body, 0.14));
      // sensory points
      P.p(9, 3, acc); P.p(10, 4, tone(acc, 0.2));
      // antennae (wiggle on idle)
      const aw = mode === 'idle' ? (f === 1 ? 1 : 0) : (f % 2);
      P.p(10, 2 - aw, tone(body, -0.15)); P.p(11, 1 - aw, acc);
      P.p(9, 1, tone(body, -0.15)); P.p(10, 0, tone(acc, -0.15));
    },
  },

  // 3) THORNBACK BRAMBLER — low armoured browser fused with vegetation
  thornback: {
    w: 22, h: 16, idleFrames: 3, walkFrames: 2,
    shadow: { rx: 9, ry: 2.8, alpha: 0.34 },
    paint(P, f, mode) {
      const body = '#5c4a33', moss = '#4c6136', thorn = '#a08a50';
      legs(P, [5, 8, 13, 16], 11, 15, 2, tone(body, -0.28), f, mode);
      // heavy body
      P.blob(11, 8.5, 8, 4.4, body, { tex: 1 });
      P.blob(10, 11, 6, 2, tone(body, 0.12), { lite: 0.2 });
      // mossy armour shell
      P.blob(10, 6, 7, 2.6, moss, { tex: 1 });
      // thorn/branch spikes (one twitches on idle f2)
      const tw = mode === 'idle' && f === 2 ? 1 : 0;
      [[4, 5], [7, 3], [10, 2], [13, 3], [16, 5]].forEach(([x, y], i) => {
        P.vl(x, y - (i === 2 ? tw : 0), 2, thorn);
        P.p(x, y - 1 - (i === 2 ? tw : 0), tone(thorn, 0.2));
      });
      // browsing head, low
      const hd = mode === 'idle' && f === 1 ? 1 : 0;
      P.blob(19, 10 + hd, 2.6, 2, tone(body, 0.1));
      P.p(20, 9 + hd, '#e8e0c8');
      P.p(21, 11 + hd, tone(body, -0.2)); // jaw
      // tail nub
      P.r(2, 8, 2, 2, tone(moss, -0.1));
    },
  },

  // 4) HOLLOWCREST — angular crag dweller with resonant hollow crest
  hollowcrest: {
    w: 20, h: 22, idleFrames: 3, walkFrames: 2,
    shadow: { rx: 6, ry: 2.4, alpha: 0.3 },
    paint(P, f, mode) {
      const body = '#4a5568', acc = '#9ab0d0', cy = '#7ccfd8';
      // precise climbing legs (splayed stance)
      const lo = mode === 'walk' ? (f % 2 ? 1 : 0) : 0;
      P.vl(6 + lo, 15, 6, tone(body, -0.25)); P.p(5 + lo, 21, tone(body, -0.35));
      P.vl(12 - lo, 15, 6, tone(body, -0.25)); P.p(13 - lo, 21, tone(body, -0.35));
      P.vl(9, 16, 5, tone(body, -0.3));
      // narrow angular body
      P.blob(9, 12.5, 4.6, 3.4, body, { tex: 1 });
      P.r(6, 10, 7, 1, tone(body, 0.14)); // spine light
      // neck up to head
      P.r(11, 8, 2, 4, body);
      // head + hollow crest (crescent with gap)
      const scan = mode === 'idle' ? (f === 2 ? 1 : 0) : 0;
      P.blob(13 + scan, 6, 2.4, 1.8, tone(body, 0.12));
      P.p(14 + scan, 5, '#e8f2ff');
      // crest arc
      P.r(9 + scan, 2, 6, 1, acc);
      P.r(8 + scan, 3, 2, 1, acc); P.r(14 + scan, 3, 1, 2, acc);
      P.p(11 + scan, 1, tone(acc, 0.2)); P.p(12 + scan, 1, tone(acc, 0.2));
      // resonant hollow (dark void with cyan rim)
      P.p(11 + scan, 3, '#101823'); P.p(12 + scan, 3, '#101823');
      P.p(10 + scan, 3, cy);
      // balance tail
      P.r(3, 11, 3, 1, tone(body, -0.12)); P.p(2, 12, tone(body, -0.2));
    },
  },

  // 5) MIREFIN LURKER — low ambush amphibian, broad dorsal fin, wetland glow
  mirefin: {
    w: 26, h: 12, idleFrames: 3, walkFrames: 2,
    shadow: { rx: 11, ry: 2.2, alpha: 0.22, soft: true },
    paint(P, f, mode) {
      const body = '#2a4a44', acc = '#4ac0a8', deep = '#1d3833';
      // low slung body
      P.blob(12, 8, 10, 3.2, body, { tex: 1 });
      P.blob(12, 9.5, 8, 1.6, deep, { lite: 0.06, dark: 0.1 });
      // dorsal fin ridge (ripples with idle frames)
      const fh = mode === 'idle' ? [0, 1, 0][f] : (f % 2);
      for (let i = 0; i < 5; i++) {
        const x = 7 + i * 3, hgt = 2 + ((i + fh) % 2);
        P.vl(x, 5 - hgt, hgt, mixc(body, acc, 0.4));
        P.p(x, 4 - hgt, tone(acc, -0.05));
      }
      // head w/ raised eyes
      P.blob(20, 7.4, 4, 2.2, tone(body, 0.1));
      P.p(21, 4, tone(acc, 0.25)); P.p(22, 5, '#eafff8');
      P.r(23, 8, 3, 1, tone(deep, -0.05)); // jaw line
      // lateral bioluminescent line
      for (let i = 0; i < 4; i++) P.p(6 + i * 4, 8, i === f % 4 ? tone(acc, 0.3) : tone(acc, -0.2));
      // tail
      const ts = mode === 'walk' ? (f % 2 ? 1 : -1) : 0;
      P.r(1, 7 + ts, 3, 2, body); P.p(0, 8 + ts, tone(body, -0.2));
    },
  },

  // 6) BULWARK SILT TITAN — enormous peaceful wetland giant
  silttitan: {
    w: 36, h: 26, idleFrames: 3, walkFrames: 2,
    shadow: { rx: 15, ry: 4.6, alpha: 0.4 },
    paint(P, f, mode) {
      const body = '#4a4238', hide = '#5b5244', wet = '#7d8a92';
      // columnar legs
      const lo = mode === 'walk' ? (f % 2 ? 1 : 0) : 0;
      [[7, lo], [13, -lo], [21, -lo], [27, lo]].forEach(([x, o]) => {
        P.slab(x + (o > 0 ? 1 : 0), 17, 4, 8, tone(body, -0.18), { tex: 1 });
        P.r(x + (o > 0 ? 1 : 0), 24, 4, 1, tone(body, -0.4));
      });
      // massive body (deep breathing)
      const br = mode === 'idle' ? [0, 0.7, 0.3][f] : 0;
      P.blob(17, 12 - br * 0.4, 13, 6.4 + br, hide, { tex: 1 });
      P.blob(16, 15, 10, 2.8, tone(body, -0.05), { lite: 0.1 });
      // wet-surface highlights along back
      P.hl(9, 7, 6, tone(wet, 0.05)); P.hl(17, 6, 8, tone(wet, 0.12));
      P.dither(8, 8, 18, 4, tone(hide, -0.12), 0.1, 3);
      // low heavy head (slow sway)
      const hs = mode === 'idle' ? [0, 0, 1][f] : 0;
      P.blob(30, 13 + hs, 4.4, 3.4, tone(hide, 0.08), { tex: 1 });
      P.r(33, 15 + hs, 3, 2, tone(body, -0.08)); // muzzle
      P.p(31, 11 + hs, '#e8e4d8'); // small calm eye
      // silt tusks
      P.p(34, 17 + hs, tone(wet, 0.2)); P.p(33, 18 + hs, tone(wet, 0.05));
      // tail stump
      P.r(3, 12, 3, 3, tone(body, -0.1));
    },
  },

  // 7) PRISMA SHARDLING — living crystalline lithomorph, refracted internal glow
  shardling: {
    w: 14, h: 16, idleFrames: 4, walkFrames: 2,
    shadow: { rx: 5, ry: 2, alpha: 0.28 },
    paint(P, f, mode) {
      const base = '#5a7a9c', lite = '#a0d8f0', glow = '#8AA4FF';
      // faceted leg shards
      const lo = mode === 'walk' ? (f % 2) : 0;
      P.vl(4 + lo, 12, 4, tone(base, -0.2)); P.vl(9 - lo, 12, 4, tone(base, -0.25));
      P.p(4 + lo, 15, tone(base, -0.4)); P.p(9 - lo, 15, tone(base, -0.4));
      // main crystal trunk (angular stack, one shard repositions on idle)
      const sh = mode === 'idle' && f >= 2 ? 1 : 0;
      // central prism
      for (let y = 0; y < 9; y++) {
        const w2 = y < 4 ? 1 + y : 9 - y + 1;
        P.r(7 - Math.ceil(w2 / 2), 3 + y, w2 + 1, 1, y % 2 ? base : tone(base, 0.1));
      }
      // left facet (light side)
      P.r(4, 6, 2, 4, tone(lite, -0.05));
      // right facet (dark side)
      P.r(8, 6, 2, 5, tone(base, -0.22));
      // satellite shard (repositions)
      P.r(11 - sh, 5 + sh, 2, 3, mixc(base, lite, 0.4));
      P.p(11 - sh, 4 + sh, tone(lite, 0.2));
      // apex tip
      P.p(7, 2, tone(lite, 0.3)); P.p(7, 1, '#eaf6ff');
      // internal refracted pulse (frame-cycled)
      const px = [[6, 7], [7, 9], [8, 6], [6, 10]][f % 4];
      P.glow(px[0], px[1], glow, 0.35);
      P.p(7, 6, mixc(base, glow, 0.5));
    },
  },

  // 8) MOSS WARDEN — symbiotic colossus, walking ecosystem
  mosswarden: {
    w: 34, h: 30, idleFrames: 3, walkFrames: 2,
    shadow: { rx: 14, ry: 4.4, alpha: 0.4 },
    paint(P, f, mode) {
      const hide = '#3a5a40', moss = '#5a7a46', glow = '#6EF3C5', bark = '#4b4234';
      // heavy limbs
      const lo = mode === 'walk' ? (f % 2 ? 1 : 0) : 0;
      [[8, lo], [14, -lo], [21, -lo], [26, lo]].forEach(([x, o]) => {
        P.slab(x + (o > 0 ? 1 : 0), 21, 4, 8, tone(bark, -0.1), { tex: 1 });
      });
      // colossal body (growth pulse)
      const gp = mode === 'idle' ? [0, 0.6, 0.2][f] : 0;
      P.blob(17, 15 - gp * 0.3, 13, 7.4 + gp, hide, { tex: 1 });
      // integrated moss canopy layers
      P.blob(15, 9.5, 10, 3.6, moss, { tex: 1 });
      P.blob(21, 8, 6, 2.6, tone(moss, 0.1), { tex: 1 });
      // vegetation tufts (sway)
      const vs = mode === 'idle' ? (f === 1 ? 1 : 0) : 0;
      [[9, 6], [14, 4], [20, 4], [25, 6]].forEach(([x, y], i) => {
        P.vl(x + (i % 2 ? vs : 0), y, 3, tone(moss, 0.22));
        P.p(x + (i % 2 ? vs : 0), y - 1, tone(moss, 0.35));
      });
      // rooted shelf plates on flank
      P.hl(9, 14, 5, bark); P.hl(11, 17, 6, tone(bark, -0.1));
      // symbiotic spore lights (pulse cycle)
      [[11, 12], [17, 16], [23, 12], [26, 15]].forEach(([x, y], i) => {
        if ((i + f) % 3 !== 0) P.p(x, y, tone(glow, -0.3));
        else P.glow(x, y, glow, 0.3);
      });
      // small luminous eyes on low head ridge
      const hd = mode === 'idle' && f === 2 ? 1 : 0;
      P.blob(28, 14 + hd, 3.4, 2.6, tone(hide, 0.08), { tex: 1 });
      P.p(29, 13 + hd, glow); P.p(31, 14 + hd, tone(glow, -0.15));
    },
  },
};
