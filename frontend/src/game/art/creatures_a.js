// ---- Creature pixel painters A (redesigned production pass) ----
// veyra, skitter, thornback, hollowcrest, mirefin, silttitan, shardling, mosswarden
// All painted FACING RIGHT; renderer flips for direction. Ground = bottom row.
// Light: upper-left key + lower-right AO. 4-frame walk gaits, layered anatomy,
// material-differentiated surfaces, restrained bioluminescence.
import { tone, mixc, scales, striate, filaments, rimlight, gait, limb } from './pixel';

export const CREATURES_A = {
  // 1) VEYRA STRIDER — tall elegant plains walker; articulated legs, sensory neck
  veyra: {
    w: 30, h: 38, idleFrames: 4, walkFrames: 4,
    shadow: { rx: 10, ry: 3.6, alpha: 0.32 },
    paint(P, f, mode) {
      const body = '#4a6a5c', belly = '#5f8371', acc = '#8fd0b0', hoof = '#2c4038';
      const br = mode === 'idle' ? [0, 0.5, 0.8, 0.4][f] : 0;
      const bob = mode === 'walk' ? (f % 2) : 0;
      // articulated legs (hip→knee→foot)
      const hips = [[9, 22], [12, 23], [17, 23], [20, 22]];
      hips.forEach(([hx, hy], i) => {
        const g = mode === 'walk' ? gait(f, i) : { dx: 0, dy: 0 };
        limb(P, hx, hy - bob, hx + g.dx, 36 + g.dy, i < 2 ? tone(body, -0.28) : tone(body, -0.2), i < 2 ? -1 : 1);
        P.p(hx + g.dx, 37 + g.dy, hoof);
      });
      // haunch + chest (layered masses)
      P.blob(11, 19 - bob, 5.4, 4.4 + br * 0.4, tone(body, -0.06), { tex: 1 });
      P.blob(17, 18.5 - bob, 6, 4.6 + br * 0.5, body, { tex: 1 });
      // belly gradient
      P.blob(14, 21 - bob, 6.5, 2.2, belly, { lite: 0.24, dark: 0.1 });
      // shoulder marking + spine rim
      P.hl(14, 15 - bob, 6, tone(acc, -0.3));
      rimlight(P, 15, 17 - bob, 7, 4, tone(body, 0.26));
      // neck: tapered, mane filaments along the back edge
      const nx = mode === 'idle' ? (f >= 2 ? 1 : 0) : 0;
      for (let i = 0; i < 11; i++) {
        const x = 20 + Math.round(i * 0.5) + nx, y = 15 - i - bob;
        P.r(x, y, 2, 2, i % 3 ? body : tone(body, 0.08));
        if (i % 2 === 0) P.p(x - 1, y, tone(acc, -0.45)); // mane wisp
      }
      // head + muzzle
      P.blob(27 + nx, 4 - bob, 3, 2.2, tone(body, 0.12));
      P.r(29 + nx, 4 - bob, 2, 1, tone(belly, 0.08));
      P.p(30 + nx, 5 - bob, tone(body, -0.25)); // jaw
      // four-eye cluster
      P.p(26 + nx, 3 - bob, '#dffcf4'); P.p(27 + nx, 3 - bob, '#bfeee0');
      P.p(26 + nx, 4 - bob, '#bfeee0'); P.p(27 + nx, 4 - bob, '#dffcf4');
      // sensor stalk with bud
      P.vl(25 + nx, 1 - bob, 2, tone(acc, -0.1)); P.p(25 + nx, 0 - bob, acc);
      // tail plume
      P.r(5, 16 - bob, 3, 1, body); P.r(3, 17 - bob, 2, 1, tone(body, -0.12));
      P.p(2, 18 - bob, tone(acc, -0.35));
    },
  },

  // 2) SKITTERLING — chitin scuttler; segmented shell bands, articulated legs
  skitter: {
    w: 16, h: 10, idleFrames: 3, walkFrames: 4,
    shadow: { rx: 6, ry: 1.8, alpha: 0.3 },
    paint(P, f, mode) {
      const body = '#7a6a4a', shell = '#8d7c58', acc = '#e0c080';
      // six legs with gait
      [3, 5, 7, 9, 11].forEach((x, i) => {
        const g = mode === 'walk' ? gait(f, i) : { dx: 0, dy: 0 };
        P.vl(x + g.dx, 7 + g.dy, 2 - g.dy, tone(body, -0.32));
        P.p(x + g.dx, 9, tone(body, -0.45));
      });
      // abdomen with chitin bands
      P.blob(5.5, 5, 4.4, 2.8, body, { tex: 1 });
      striate(P, 2, 4, 7, 4, shell, 2);
      rimlight(P, 5, 5, 4, 2.5, tone(shell, 0.3));
      // thorax + head
      P.blob(10.5, 4.4, 2.6, 2, tone(shell, 0.1));
      P.blob(13, 4.6, 1.8, 1.5, tone(shell, 0.16));
      // mandibles
      P.p(15, 5, tone(body, -0.2)); P.p(15, 4, tone(acc, -0.3));
      // sensory points along flank
      P.p(3, 4, tone(acc, -0.2)); P.p(12, 3, acc); P.p(13, 4, tone(acc, 0.2));
      // antennae (wiggle)
      const aw = mode === 'idle' ? (f === 1 ? 1 : 0) : (f % 2);
      P.p(13, 2 - aw, tone(body, -0.15)); P.p(14, 1 - aw, acc);
      P.p(12, 1, tone(body, -0.15)); P.p(13, 0, tone(acc, -0.15));
    },
  },

  // 3) THORNBACK BRAMBLER — armoured browser fused with living vegetation
  thornback: {
    w: 26, h: 18, idleFrames: 3, walkFrames: 4,
    shadow: { rx: 10, ry: 3, alpha: 0.34 },
    paint(P, f, mode) {
      const body = '#5c4a33', moss = '#4c6136', thorn = '#a08a50', beak = '#e8e0c8';
      // heavy legs
      [[6, 12], [9, 13], [15, 13], [18, 12]].forEach(([hx, hy], i) => {
        const g = mode === 'walk' ? gait(f, i) : { dx: 0, dy: 0 };
        limb(P, hx, hy, hx + g.dx, 16 + g.dy, tone(body, -0.28), 0, 2);
      });
      // wide low body
      P.blob(12, 9.5, 9, 4.6, body, { tex: 1 });
      P.blob(11, 12, 7, 2, tone(body, 0.12), { lite: 0.2 });
      scales(P, 12, 10, 8, 4, body, 2);
      // layered mossy shell
      P.blob(11, 6.4, 8, 2.8, moss, { tex: 1 });
      P.blob(9, 5, 5, 1.8, tone(moss, 0.12), { tex: 1 });
      P.dither(5, 4, 13, 4, tone(moss, 0.28), 0.12, 4);
      // shell rim AO
      P.hl(4, 8, 15, tone(body, -0.3));
      // thorn spikes with catch-light (one twitches)
      const tw = mode === 'idle' && f === 2 ? 1 : 0;
      [[5, 4], [8, 2], [12, 1], [16, 2], [19, 4]].forEach(([x, y], i) => {
        P.vl(x, y - (i === 2 ? tw : 0), 3, thorn);
        P.p(x, y - 1 - (i === 2 ? tw : 0), tone(thorn, 0.3));
        P.p(x + 1, y + 1, tone(thorn, -0.25));
      });
      // browsing head with beak
      const hd = mode === 'idle' && f === 1 ? 1 : 0;
      P.blob(22, 11 + hd, 3, 2.4, tone(body, 0.1));
      P.p(24, 10 + hd, beak); P.p(25, 11 + hd, tone(beak, -0.25));
      P.p(22, 10 + hd, '#f5efdc'); // eye
      P.r(23, 13 + hd, 3, 1, tone(body, -0.25)); // jaw
      // tail nub
      P.r(2, 9, 3, 2, tone(moss, -0.1)); P.p(1, 10, tone(moss, -0.25));
    },
  },

  // 4) HOLLOWCREST — angular crag dweller with resonant hollow crest
  hollowcrest: {
    w: 24, h: 26, idleFrames: 4, walkFrames: 4,
    shadow: { rx: 7, ry: 2.6, alpha: 0.3 },
    paint(P, f, mode) {
      const body = '#4a5568', acc = '#9ab0d0', cy = '#7ccfd8';
      // splayed climbing limbs with claw tips
      [[7, 16], [12, 17]].forEach(([hx, hy], i) => {
        const g = mode === 'walk' ? gait(f, i) : { dx: 0, dy: 0 };
        limb(P, hx, hy, hx - 2 + g.dx, 24 + g.dy, tone(body, -0.25), -1);
        limb(P, hx + 2, hy, hx + 4 + g.dx, 24 + g.dy, tone(body, -0.3), 1);
        P.p(hx - 2 + g.dx, 25, tone(acc, -0.35)); P.p(hx + 4 + g.dx, 25, tone(acc, -0.4));
      });
      // angular faceted body
      P.blob(10.5, 13.5, 5, 3.8, body, { tex: 1 });
      P.r(7, 10.5, 8, 1, tone(body, 0.16)); // spine facet
      P.r(6, 12, 3, 3, tone(body, 0.06)); // shoulder facet plane
      P.r(13, 14, 3, 3, tone(body, -0.18)); // shaded flank facet
      rimlight(P, 10, 13, 5, 3.5, tone(acc, -0.1));
      // neck + alert head (scans on idle)
      const scan = mode === 'idle' ? [0, 0, 1, 1][f] : 0;
      P.r(13, 8, 2, 5, body);
      P.blob(16 + scan, 6.5, 2.6, 2, tone(body, 0.12));
      P.p(17 + scan, 5.5, '#e8f2ff'); // bright eye
      P.p(19 + scan, 7, tone(body, -0.2)); // beak tip
      // resonant crest: crescent with hollow void + cyan rim
      P.r(11 + scan, 2, 7, 1, acc);
      P.r(10 + scan, 3, 2, 2, acc); P.r(17 + scan, 3, 1, 3, acc);
      P.p(13 + scan, 1, tone(acc, 0.25)); P.p(14 + scan, 1, tone(acc, 0.3));
      P.r(13 + scan, 3, 3, 1, '#101823'); // hollow void
      P.p(12 + scan, 3, cy); P.p(16 + scan, 3, tone(cy, -0.25)); // resonant rim
      // balance tail
      P.r(4, 12, 3, 1, tone(body, -0.12)); P.r(2, 13, 2, 1, tone(body, -0.2));
      P.p(1, 14, tone(acc, -0.4));
    },
  },

  // 5) MIREFIN LURKER — glossy ambush amphibian; membrane dorsal fin
  mirefin: {
    w: 30, h: 14, idleFrames: 4, walkFrames: 4,
    shadow: { rx: 12, ry: 2.4, alpha: 0.22, soft: true },
    paint(P, f, mode) {
      const body = '#2a4a44', acc = '#4ac0a8', deep = '#1d3833', wet = '#9adfe8';
      // low glossy body
      P.blob(14, 9, 11.5, 3.6, body, { tex: 1 });
      P.blob(14, 10.8, 9, 1.8, deep, { lite: 0.06, dark: 0.1 });
      // wet specular streak
      P.hl(8, 6, 7, tone(wet, -0.45)); P.p(16, 6, tone(wet, -0.3));
      // dorsal fin: membrane web between ray spines (ripples)
      const fh = mode === 'idle' ? [0, 1, 1, 0][f] : (f % 2);
      for (let i = 0; i < 6; i++) {
        const x = 7 + i * 3, hgt = 3 + ((i + fh) % 2);
        P.vl(x, 6 - hgt, hgt, mixc(body, acc, 0.5)); // ray spine
        if (i < 5) { // membrane fill between spines
          P.r(x + 1, 6 - Math.min(3, hgt) + 1, 2, 2, mixc(body, acc, 0.22));
        }
        P.p(x, 5 - hgt, tone(acc, 0.05));
      }
      // head: periscope eyes + jaw
      P.blob(23, 8.2, 4.6, 2.6, tone(body, 0.1));
      P.vl(24, 4, 2, tone(body, 0.05)); P.p(24, 4, tone(acc, 0.3)); // eye stalk L
      P.vl(26, 3, 2, tone(body, 0.08)); P.p(26, 3, '#eafff8'); // eye stalk R
      P.r(26, 9, 4, 1, tone(deep, -0.05)); // jaw seam
      P.p(29, 10, tone(deep, -0.2));
      // gill slits
      P.vl(20, 8, 2, tone(deep, -0.15)); P.vl(22, 8, 2, tone(deep, -0.1));
      // lateral bioluminescent line (chase cycle)
      for (let i = 0; i < 5; i++) P.p(7 + i * 4, 9, i === f % 5 ? tone(acc, 0.35) : tone(acc, -0.2));
      // tail with fin flag
      const ts = mode === 'walk' ? (f % 2 ? 1 : -1) : 0;
      P.r(1, 8 + ts, 4, 2, body);
      P.vl(1, 6 + ts, 2, mixc(body, acc, 0.4)); P.p(0, 9 + ts, tone(body, -0.2));
    },
  },

  // 6) BULWARK SILT TITAN — colossal wetland giant; folded hide, wet sheen
  silttitan: {
    w: 42, h: 30, idleFrames: 4, walkFrames: 4,
    shadow: { rx: 17, ry: 5, alpha: 0.4 },
    paint(P, f, mode) {
      const body = '#4a4238', hide = '#5b5244', wet = '#7d8a92', mud = '#3a3028';
      // columnar legs with mud staining
      [[8, 0], [15, 1], [25, 1], [32, 0]].forEach(([x, ph], i) => {
        const g = mode === 'walk' ? gait(f, i) : { dx: 0, dy: 0 };
        P.slab(x + g.dx, 20 + g.dy, 5, 9 - g.dy, tone(body, -0.18), { tex: 1 });
        P.r(x + g.dx, 26, 5, 3, mud); // mud stain
        P.r(x + g.dx, 28, 5, 1, tone(mud, -0.3));
        P.p(x + g.dx, 20, tone(body, 0.05)); // hip
      });
      // massive layered body with breathing
      const br = mode === 'idle' ? [0, 0.5, 0.9, 0.5][f] : 0;
      P.blob(20, 14 - br * 0.4, 15, 7.4 + br, hide, { tex: 1 });
      P.blob(19, 18, 12, 3, tone(body, -0.05), { lite: 0.1 });
      // hide fold creases
      P.hl(10, 13, 8, tone(body, -0.25)); P.hl(14, 16, 10, tone(body, -0.2));
      P.hl(24, 12, 8, tone(body, -0.22));
      // wet sheen highlights along back
      P.hl(10, 8, 7, tone(wet, 0.05)); P.hl(20, 7, 9, tone(wet, 0.14));
      P.dither(9, 9, 22, 5, tone(hide, -0.12), 0.1, 3);
      rimlight(P, 19, 13, 14, 6.5, tone(wet, 0.1));
      // back ridge plates
      for (let i = 0; i < 5; i++) {
        P.r(11 + i * 5, 6 - (i % 2), 3, 2, tone(hide, -0.15));
        P.p(12 + i * 5, 5 - (i % 2), tone(wet, -0.05));
      }
      // low heavy head with slow sway
      const hs = mode === 'idle' ? [0, 0, 1, 1][f] : 0;
      P.blob(35, 15 + hs, 5, 4, tone(hide, 0.08), { tex: 1 });
      P.slab(38, 17 + hs, 4, 3, tone(body, -0.08)); // muzzle
      P.p(36, 13 + hs, '#e8e4d8'); // small calm eye
      P.p(37, 14 + hs, tone(body, -0.3)); // eye crease
      // silt tusks (wet gleam)
      P.vl(40, 19 + hs, 2, tone(wet, 0.2)); P.p(40, 21 + hs, tone(wet, 0.35));
      P.vl(38, 20 + hs, 2, tone(wet, 0.02));
      // tail stump
      P.r(3, 13, 4, 4, tone(body, -0.1)); P.p(2, 15, tone(body, -0.25));
    },
  },

  // 7) PRISMA SHARDLING — living crystal; facet planes + refracted core
  shardling: {
    w: 18, h: 20, idleFrames: 4, walkFrames: 4,
    shadow: { rx: 6, ry: 2.2, alpha: 0.28 },
    paint(P, f, mode) {
      const base = '#5a7a9c', lite = '#a0d8f0', glow = '#8AA4FF', deepc = '#3a5470';
      // angular leg shards
      [[6, 0], [10, 1]].forEach(([x, i]) => {
        const g = mode === 'walk' ? gait(f, i) : { dx: 0, dy: 0 };
        P.vl(x + g.dx, 15 + g.dy, 4 - g.dy, tone(base, -0.2));
        P.p(x + g.dx - 1, 18, tone(deepc, -0.2)); P.p(x + g.dx, 19, tone(base, -0.45));
      });
      // central prism (row-built taper) with distinct facet planes
      for (let y = 0; y < 12; y++) {
        const w2 = y < 5 ? 2 + y : 13 - y;
        P.r(9 - Math.ceil(w2 / 2), 3 + y, w2 + 1, 1, y % 2 ? base : tone(base, 0.08));
      }
      // lit facet (upper-left plane)
      for (let y = 0; y < 6; y++) P.r(6, 6 + y, 2, 1, y % 2 ? tone(lite, -0.08) : tone(lite, -0.18));
      // dark facet (lower-right plane)
      for (let y = 0; y < 6; y++) P.r(10, 7 + y, 2, 1, tone(deepc, -(0.06 + y * 0.02)));
      // fracture seam
      P.vl(9, 5, 8, tone(deepc, 0.06));
      // apex
      P.p(9, 2, tone(lite, 0.3)); P.p(9, 1, '#eaf6ff'); P.p(8, 3, tone(lite, 0.12));
      // twin satellite shards (orbit by frame)
      const o1 = [[13, 5], [14, 6], [13, 7], [12, 6]][f % 4];
      const o2 = [[3, 9], [2, 8], [3, 7], [4, 8]][f % 4];
      P.r(o1[0], o1[1], 2, 3, mixc(base, lite, 0.45)); P.p(o1[0], o1[1] - 1, tone(lite, 0.25));
      P.r(o2[0], o2[1], 2, 2, mixc(base, deepc, 0.5)); P.p(o2[0], o2[1] - 1, tone(lite, 0.05));
      // internal refracted pulse
      const px = [[8, 7], [9, 9], [10, 6], [8, 11]][f % 4];
      P.glow(px[0], px[1], glow, 0.38);
      P.p(9, 7, mixc(base, glow, 0.5)); P.p(8, 9, mixc(base, glow, 0.3));
    },
  },

  // 8) MOSS WARDEN — walking ecosystem; bark limbs, moss canopy, spore lights
  mosswarden: {
    w: 38, h: 32, idleFrames: 4, walkFrames: 4,
    shadow: { rx: 15, ry: 4.8, alpha: 0.4 },
    paint(P, f, mode) {
      const hide = '#3a5a40', moss = '#5a7a46', glow = '#6EF3C5', bark = '#4b4234';
      // bark limbs with root toes
      [[9, 0], [16, 1], [24, 1], [29, 0]].forEach(([x], i) => {
        const g = mode === 'walk' ? gait(f, i) : { dx: 0, dy: 0 };
        P.slab(x + g.dx, 23 + g.dy, 5, 8 - g.dy, tone(bark, -0.1), { tex: 1 });
        P.vl(x + g.dx, 23, 5, tone(bark, 0.12)); // bark ridge
        P.p(x - 1 + g.dx, 30, tone(bark, -0.3)); P.p(x + 5 + g.dx, 30, tone(bark, -0.35)); // toes
      });
      // colossal body with growth pulse
      const gp = mode === 'idle' ? [0, 0.4, 0.7, 0.4][f] : 0;
      P.blob(19, 16 - gp * 0.3, 15, 8 + gp, hide, { tex: 1 });
      // moss canopy layers (integrated ecosystem)
      P.blob(16, 10, 11, 4, moss, { tex: 1 });
      P.blob(24, 8.6, 7, 3, tone(moss, 0.1), { tex: 1 });
      P.blob(11, 8, 5, 2.4, tone(moss, -0.06), { tex: 1 });
      P.dither(8, 6, 22, 5, tone(moss, 0.3), 0.1, 6);
      // vegetation tufts (sway)
      const vs = mode === 'idle' ? (f % 2) : 0;
      filaments(P, 10, 6, 6, tone(moss, 0.2), 3, vs, tone(glow, -0.35));
      filaments(P, 20, 5, 8, tone(moss, 0.24), 3, vs + 1);
      // rooted bark shelf plates on flank
      P.hl(10, 15, 6, bark); P.hl(12, 18, 7, tone(bark, -0.1));
      P.r(9, 16, 3, 2, tone(bark, 0.06));
      rimlight(P, 18, 14, 14, 7, tone(moss, 0.3));
      // symbiotic spore lights (pulse cycle)
      [[12, 13], [19, 18], [26, 13], [30, 17], [15, 20]].forEach(([x, y], i) => {
        if ((i + f) % 3 !== 0) P.p(x, y, tone(glow, -0.32));
        else P.glow(x, y, glow, 0.3);
      });
      // low head ridge with luminous eyes
      const hd = mode === 'idle' && f >= 2 ? 1 : 0;
      P.blob(32, 16 + hd, 3.8, 3, tone(hide, 0.08), { tex: 1 });
      P.p(33, 15 + hd, glow); P.p(35, 16 + hd, tone(glow, -0.15));
      P.r(34, 18 + hd, 3, 1, tone(hide, -0.2)); // mouth seam
      // dragging root tail
      P.r(3, 18, 4, 2, tone(bark, -0.05)); P.p(2, 20, tone(bark, -0.25));
      P.dither(2, 21, 6, 2, tone(moss, -0.2), 0.3, 8);
    },
  },
};
