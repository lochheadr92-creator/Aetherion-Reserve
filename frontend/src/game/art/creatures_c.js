// ---- Creature pixel painters C (Tier 4 Apex-class production pass) ----
// nyxarr, zephyrmaw, aurox, sylvarr
// All painted FACING RIGHT; renderer flips for direction. Ground = bottom row.
// Light: upper-left key + lower-right AO. 4-frame gaits, layered anatomy,
// material-differentiated surfaces, restrained bioluminescence.
import { tone, mixc, scales, striate, filaments, rimlight, gait, limb } from './pixel';

export const CREATURES_C = {
  // 16) NYXARR SOVEREIGN — titan apex predator; horn crown, blade spine, crimson war-stripes
  nyxarr: {
    w: 44, h: 32, idleFrames: 4, walkFrames: 4,
    shadow: { rx: 17, ry: 5, alpha: 0.44 },
    paint(P, f, mode) {
      const body = '#3a2640', plate = '#251a2e', acc = '#ff5c7a', glow = '#b98ae0', claw = '#171019';
      // massive clawed legs
      [[11, 19], [16, 20], [25, 20], [30, 19]].forEach(([hx, hy], i) => {
        const g = mode === 'walk' ? gait(f, i) : { dx: 0, dy: 0 };
        limb(P, hx, hy, hx + g.dx, 29 + g.dy, tone(body, -0.22), i < 2 ? -1 : 1, 2);
        P.p(hx + g.dx, 30 + g.dy, claw); P.p(hx + g.dx + 2, 30 + g.dy, tone(claw, 0.15));
      });
      // heavy layered body (slow predator breath)
      const br = mode === 'idle' ? [0, 0.4, 0.8, 0.4][f] : 0;
      P.blob(20, 15 - br * 0.4, 13.5, 6.4 + br, body, { tex: 1 });
      P.blob(19, 18.5, 10, 2.6, tone(body, -0.1), { lite: 0.08 });
      P.blob(26, 13.5, 5.5, 4.4, tone(body, 0.05)); // shoulder mass
      scales(P, 19, 15, 12, 5.5, body, 7);
      rimlight(P, 19, 14, 12.5, 5.8, tone(body, 0.28));
      // dorsal blade spines with faint violet tips
      for (let i = 0; i < 6; i++) {
        const x = 10 + i * 4, hgt = 3 + (i % 2);
        P.vl(x, 9 - hgt - (i % 2), hgt, plate);
        P.p(x, 8 - hgt - (i % 2), (i + f) % 3 === 0 ? tone(glow, -0.2) : tone(plate, 0.25));
        P.p(x + 1, 10 - (i % 2), tone(plate, -0.25)); // spine root
      }
      // crimson war-stripes along flank
      P.hl(12, 13, 4, tone(acc, -0.42)); P.hl(15, 16, 5, tone(acc, -0.48));
      P.hl(22, 12, 4, tone(acc, -0.45)); P.p(18, 14, tone(acc, -0.4));
      // thick neck + regal skull
      const jaw = mode === 'idle' && f >= 2 ? 1 : 0;
      P.r(29, 8, 4, 6, tone(body, 0.02));
      P.blob(35, 9.5, 6, 4.2, tone(body, 0.08), { tex: 1 });
      // crown of swept horns (back-curving, catch-lit)
      [[33, 4, 4], [35, 3, 5], [37, 3, 4]].forEach(([hx, hy, len], i) => {
        for (let k = 0; k < len; k++) P.p(hx - k, hy + Math.floor(k * 0.5) - i, k === len - 1 ? tone(plate, 0.35) : plate);
        P.p(hx, hy, tone(plate, 0.28)); // horn base gleam
      });
      // heavy brow plate
      P.r(33, 6, 6, 2, plate); P.hl(33, 6, 6, tone(plate, 0.3));
      // twin crimson eyes (hunting glint cycles)
      P.p(35, 8, f % 2 ? acc : tone(acc, 0.35));
      P.p(37, 8, f % 2 ? tone(acc, 0.35) : acc);
      // muzzle + hinged jaw with fangs
      P.r(39, 9, 4, 2, tone(body, 0.02)); P.p(42, 10, tone(claw, 0.2)); // nostril
      P.slab(36, 12 + jaw, 8, 3 - jaw, tone(body, -0.16), { tex: 1 });
      P.p(35, 12 + jaw, tone(plate, 0.2)); // jaw hinge
      for (let i = 0; i < 4; i++) P.p(37 + i * 2, 12 + jaw, '#e8ddd0'); // teeth
      if (jaw) for (let i = 0; i < 3; i++) P.p(38 + i * 2, 11, tone('#e8ddd0', -0.2)); // upper fangs
      // throat glow bud (nocturnal signal, restrained)
      if ((f + 1) % 4 === 0) P.glow(33, 12, glow, 0.26); else P.p(33, 12, tone(glow, -0.35));
      // armoured tail with blade tip
      const ts = mode === 'walk' ? (f % 2) : 0;
      P.r(3, 12 + ts, 5, 2, tone(body, -0.08)); P.r(1, 11 + ts, 3, 2, plate);
      P.p(0, 10 + ts, tone(plate, 0.3)); P.p(2, 13 + ts, tone(body, -0.25));
    },
  },

  // 17) ZEPHYRMAW SKYRENDER — aerial apex; ray-finger wings, spear beak, storm crest
  zephyrmaw: {
    w: 40, h: 30, idleFrames: 4, walkFrames: 4,
    shadow: { rx: 12, ry: 3.4, alpha: 0.3 },
    paint(P, f, mode) {
      const body = '#31404f', memb = '#22303c', acc = '#8AA4FF', talon = '#151d26';
      // wing beat cycle: folded on idle, raised sweep on walk
      const wb = mode === 'walk' ? [0, 2, 3, 2][f] : [0, 0, 1, 0][f];
      // taloned legs
      [[17, 19], [22, 19]].forEach(([hx, hy], i) => {
        const g = mode === 'walk' ? gait(f, i) : { dx: 0, dy: 0 };
        limb(P, hx, hy, hx + g.dx, 27 + g.dy, tone(body, -0.26), i === 0 ? -1 : 1);
        P.p(hx + g.dx - 1, 28 + g.dy, talon); P.p(hx + g.dx + 1, 28 + g.dy, talon);
      });
      // far wing (behind body, darker)
      for (let i = 0; i < 5; i++) {
        const x = 8 + i * 3, hgt = 4 + i - wb;
        P.vl(x, 14 - hgt, hgt, tone(memb, -0.15));
        if (i < 4) P.r(x + 1, 14 - Math.max(1, hgt - 2), 2, Math.max(1, hgt - 2), tone(memb, -0.28));
      }
      // streamlined raptor body
      P.blob(19, 15.5, 9, 4.2, body, { tex: 1 });
      P.blob(18, 17.5, 6.5, 1.8, tone(body, 0.08), { lite: 0.2 });
      P.blob(24, 14.5, 4, 3, tone(body, 0.05)); // chest keel
      rimlight(P, 19, 14.5, 8.5, 4, tone(acc, -0.15));
      // near wing: ray-finger spines with membrane webbing (lifts on beat)
      for (let i = 0; i < 6; i++) {
        const x = 7 + i * 3.4, hgt = 5 + i + wb * 2;
        P.vl(Math.round(x), 13 - hgt, hgt, mixc(body, acc, 0.35)); // wing finger
        if (i < 5) P.r(Math.round(x) + 1, 13 - Math.max(2, hgt - 2), 2, Math.max(2, hgt - 3), memb); // membrane
        P.p(Math.round(x), 12 - hgt, (i + f) % 3 === 0 ? tone(acc, 0.1) : tone(acc, -0.3)); // fingertip light
      }
      P.hl(7, 13, 18, tone(memb, -0.2)); // wing root shadow line
      // long neck + spear-beak head
      const hd = mode === 'idle' && f >= 2 ? 1 : 0;
      P.r(26, 9 - hd, 3, 6, body);
      P.blob(31, 7.5 - hd, 3.4, 2.4, tone(body, 0.1));
      // hooked spear beak
      P.r(34, 7 - hd, 5, 1, tone(acc, -0.5)); P.p(38, 8 - hd, tone(acc, -0.6)); // hook tip
      P.hl(34, 6 - hd, 4, tone(acc, -0.35)); // beak ridge gleam
      P.p(31, 6 - hd, '#eaf2ff'); P.p(32, 6 - hd, tone('#eaf2ff', -0.35)); // sharp eye + glint
      // storm crest fin
      P.vl(29, 3 - hd, 3, mixc(body, acc, 0.5)); P.p(29, 2 - hd, tone(acc, 0.15));
      P.p(28, 4 - hd, tone(acc, -0.25));
      // rudder tail with membrane flag
      const ts = mode === 'walk' ? (f % 2) : 0;
      P.r(3, 14 + ts, 6, 1, tone(body, -0.1));
      P.vl(3, 11 + ts, 3, mixc(body, acc, 0.4)); P.r(1, 12 + ts, 2, 2, memb);
      P.p(0, 12 + ts, tone(acc, -0.2));
    },
  },

  // 18) AUROX TITANHORN — colossal armoured grazer; crescent horns, plated hump, amber pips
  aurox: {
    w: 46, h: 34, idleFrames: 4, walkFrames: 4,
    shadow: { rx: 18, ry: 5.4, alpha: 0.42 },
    paint(P, f, mode) {
      const body = '#4f463b', armor = '#66594a', horn = '#e2d6c2', glow = '#f2c14e', mud = '#3a3129';
      // columnar legs with dust staining
      [[9, 0], [16, 1], [28, 1], [35, 0]].forEach(([x, ph], i) => {
        const g = mode === 'walk' ? gait(f, i) : { dx: 0, dy: 0 };
        P.slab(x + g.dx, 24 + g.dy, 5, 9 - g.dy, tone(body, -0.16), { tex: 1 });
        P.r(x + g.dx, 30, 5, 3, mud);
        P.r(x + g.dx, 32, 5, 1, tone(mud, -0.3));
        P.p(x + g.dx + 1, 24, tone(body, 0.06)); // hip light
      });
      // colossal body (deep breath)
      const br = mode === 'idle' ? [0, 0.5, 0.9, 0.5][f] : 0;
      P.blob(22, 17 - br * 0.4, 16, 7.8 + br, body, { tex: 1 });
      P.blob(21, 21, 12, 2.8, tone(body, -0.06), { lite: 0.08 });
      // hide creases
      P.hl(12, 17, 8, tone(body, -0.24)); P.hl(20, 20, 10, tone(body, -0.2));
      rimlight(P, 21, 16, 15, 7, tone(armor, 0.22));
      // armoured hump: layered plates with striation
      P.blob(17, 10, 10, 3.8, armor, { tex: 1 });
      P.blob(24, 8.8, 6, 2.8, tone(armor, 0.08), { tex: 1 });
      striate(P, 10, 8, 16, 5, armor, 3);
      P.hl(8, 12, 18, tone(body, -0.3)); // hump rim AO
      // back ridge scutes
      for (let i = 0; i < 5; i++) {
        P.r(11 + i * 4, 6 - (i % 2), 3, 2, tone(armor, -0.12));
        P.p(12 + i * 4, 5 - (i % 2), tone(horn, -0.35));
      }
      // amber signal pips along flank (slow pulse)
      [[13, 19], [19, 16], [26, 18], [31, 15]].forEach(([x, y], i) => {
        if ((i + f) % 4 === 0) P.glow(x, y, glow, 0.24); else P.p(x, y, tone(glow, -0.45));
      });
      // heavy head with slow graze sway
      const hs = mode === 'idle' ? [0, 0, 1, 1][f] : 0;
      P.blob(38, 17 + hs, 5.4, 4.4, tone(body, 0.06), { tex: 1 });
      P.slab(41, 20 + hs, 4, 3, tone(body, -0.1)); // broad muzzle
      P.p(44, 21 + hs, tone(mud, -0.1)); // nostril
      P.p(39, 15 + hs, '#e8e4d8'); P.p(40, 16 + hs, tone(body, -0.3)); // calm eye + crease
      // massive crescent horns (forward-sweeping, catch-lit)
      [[36, 12, 0], [38, 11, 1]].forEach(([hx, hy, k]) => {
        for (let s = 0; s < 6; s++) {
          const x = hx + s, y = hy + hs - Math.floor(s * s * 0.14);
          P.r(x, y, 2, 2 - (s > 3 ? 1 : 0), s > 3 ? tone(horn, 0.15) : tone(horn, -0.1 - k * 0.08));
        }
        P.p(hx + 6, hy + hs - 4, tone(horn, 0.35)); // horn tip gleam
      });
      P.hl(36, 13 + hs, 3, tone(horn, -0.4)); // horn boss shadow
      // dewlap
      P.blob(34, 21 + hs, 3, 2, tone(body, -0.12), { lite: 0.06 });
      // tufted tail
      const tw = mode === 'idle' && f === 1 ? 1 : 0;
      P.r(3, 15, 4, 2, tone(body, -0.08)); P.r(1, 17 + tw, 2, 2, mud);
      P.p(1, 19 + tw, tone(glow, -0.5));
    },
  },

  // 19) SYLVARR CROWNSPIRE — bioluminescent canopy colossus; spire neck, frond crown
  sylvarr: {
    w: 34, h: 48, idleFrames: 4, walkFrames: 4,
    shadow: { rx: 12, ry: 4.2, alpha: 0.36 },
    paint(P, f, mode) {
      const body = '#3c5548', belly = '#517263', glow = '#6EF3C5', bark = '#4b4234';
      const bob = mode === 'walk' ? (f % 2) : 0;
      // tall columnar legs
      [[8, 32], [12, 33], [18, 33], [22, 32]].forEach(([hx, hy], i) => {
        const g = mode === 'walk' ? gait(f, i) : { dx: 0, dy: 0 };
        limb(P, hx, hy - bob, hx + g.dx, 45 + g.dy, i < 2 ? tone(body, -0.28) : tone(body, -0.18), i < 2 ? -1 : 1, 2);
        P.r(hx + g.dx, 46 + g.dy, 3, 1, tone(bark, -0.2)); // broad foot pad
      });
      // barrel body
      P.blob(15, 28 - bob, 9.5, 5.6, body, { tex: 1 });
      P.blob(14, 31 - bob, 7, 2.4, belly, { lite: 0.22, dark: 0.1 });
      P.blob(19, 26 - bob, 5, 4, tone(body, 0.05)); // shoulder mass
      rimlight(P, 14, 26.5 - bob, 9, 5.2, tone(body, 0.28));
      // bark saddle plates on back
      P.hl(9, 23 - bob, 8, bark); P.r(11, 24 - bob, 5, 2, tone(bark, 0.08));
      P.hl(9, 26 - bob, 5, tone(bark, -0.15));
      // spire neck: long taper rising right (graze dip on idle)
      const dip = mode === 'idle' && f >= 2 ? 2 : 0;
      for (let i = 0; i < 17; i++) {
        const x = 21 + Math.round(i * 0.55), y = 22 - i - bob + Math.floor(dip * (i / 17));
        P.r(x, y, 3 - (i > 11 ? 1 : 0), 2, i % 3 ? body : tone(body, 0.07));
        if (i % 2 === 0) P.p(x - 1, y + 1, tone(belly, -0.1)); // throat edge
      }
      // luminous signal spots down the neck (slow sequence pulse)
      for (let i = 0; i < 5; i++) {
        const x = 23 + Math.round(i * 1.7), y = 18 - i * 3 - bob + Math.floor(dip * (i / 5));
        if ((i + f) % 4 === 0) P.glow(x, y, glow, 0.3); else P.p(x, y, tone(glow, -0.35));
      }
      // gentle head at the spire top
      const hx = 30, hy = 5 - bob + dip;
      P.blob(hx, hy, 2.8, 2, tone(body, 0.12));
      P.r(hx + 2, hy, 2, 1, tone(belly, 0.05)); // soft muzzle
      P.p(hx + 3, hy + 1, tone(body, -0.25)); // lip
      P.p(hx, hy - 1, '#e9fff6'); // serene eye
      // frond crown (sways)
      const sw = mode === 'idle' ? (f % 2) : (f % 2);
      filaments(P, hx - 2, hy - 2, 6, tone(body, 0.2), 3, sw, tone(glow, -0.2));
      P.p(hx - 3, hy - 3 - sw, tone(glow, -0.1)); // crown bud
      // counterbalance tail sweeping down-left
      for (let i = 0; i < 8; i++) {
        const x = 6 - Math.round(i * 0.7), y = 26 + Math.round(i * 0.9) - bob;
        P.r(x, y, 3 - (i > 4 ? 1 : 0), 2, i % 2 ? tone(body, -0.1) : tone(body, -0.02));
      }
      P.p(0, 34 - bob, tone(glow, -0.4)); // tail tip light
    },
  },
};
