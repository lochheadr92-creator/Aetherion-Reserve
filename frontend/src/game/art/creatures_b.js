// ---- Creature pixel painters B (redesigned production pass) ----
// rhoak, vantha, karrgan, lumen, umbra, voltari, emberoot
// All painted FACING RIGHT; renderer flips for direction. Ground = bottom row.
// Light: upper-left key + lower-right AO. 4-frame gaits, layered anatomy.
import { tone, mixc, scales, striate, filaments, rimlight, gait, limb } from './pixel';

export const CREATURES_B = {
  // 9) ASHMANE RHOAK — fast territorial strider; ash-filament mane, ember tips
  rhoak: {
    w: 28, h: 22, idleFrames: 4, walkFrames: 4,
    shadow: { rx: 10, ry: 3.2, alpha: 0.33 },
    paint(P, f, mode) {
      const body = '#5c3a33', mane = '#332e2c', ember = '#e08a5a', claw = '#241a18';
      const bob = mode === 'walk' ? (f % 2) : 0;
      // long runner legs
      [[9, 14], [12, 15], [17, 15], [20, 14]].forEach(([hx, hy], i) => {
        const g = mode === 'walk' ? gait(f, i) : { dx: 0, dy: 0 };
        limb(P, hx, hy - bob, hx + g.dx * 2, 20 + g.dy, tone(body, -0.26), i < 2 ? -1 : 1);
        P.p(hx + g.dx * 2, 21 + g.dy, claw);
      });
      // lean muscular body
      P.blob(14, 11 - bob, 9, 4, body, { tex: 1 });
      P.blob(13, 13 - bob, 6.5, 2, tone(body, 0.1), { lite: 0.2 });
      P.blob(18.5, 10 - bob, 4.4, 3.4, tone(body, 0.04)); // chest mass
      scales(P, 13, 11 - bob, 8, 3.6, body, 5);
      rimlight(P, 14, 10 - bob, 8.5, 3.6, tone(body, 0.28));
      // ash mane: filament crest along neck + back, ember tips flicker
      const mv = mode === 'idle' ? [0, 1, 0, 1][f] : (f % 2);
      filaments(P, 9, 7 - bob, 12, mane, 3, mv, ember);
      P.hl(9, 7 - bob, 12, tone(mane, -0.2)); // mane root shadow
      // neck + fierce head
      const hm = mode === 'idle' && f >= 2 ? 1 : 0;
      P.r(20, 6 - bob, 3, 5, body);
      P.blob(24 + hm, 5 - bob, 3.4, 2.4, tone(body, 0.1));
      P.r(27 + hm, 5 - bob, 2, 1, tone(body, -0.12)); // snout
      P.p(28 + hm, 6 - bob, tone(claw, 0.2)); // nostril
      P.p(25 + hm, 4 - bob, '#ffd9b0'); P.p(26 + hm, 4 - bob, tone('#ffd9b0', -0.35)); // eye + glint
      // brow crest with ember bud
      P.hl(23 + hm, 2 - bob, 4, mane); P.p(24 + hm, 1 - bob, ember);
      // whip tail with plume
      P.r(4, 9 - bob, 4, 1, mane); P.r(2, 8 - bob, 3, 1, tone(mane, 0.12));
      P.p(1, 8 - bob, ember); P.p(2, 10 - bob, tone(mane, -0.15));
    },
  },

  // 10) VANTHA DUSKRUNNER — low-light pack hunter; sensor band, twin tail filaments
  vantha: {
    w: 24, h: 16, idleFrames: 4, walkFrames: 4,
    shadow: { rx: 9, ry: 2.6, alpha: 0.3 },
    paint(P, f, mode) {
      const body = '#3a3a4a', dark = '#2b2b3a', acc = '#8a6adf', cyb = '#63d8e8';
      // slim fast limbs
      [[6, 10], [9, 11], [14, 11], [17, 10]].forEach(([hx, hy], i) => {
        const g = mode === 'walk' ? gait(f, i) : { dx: 0, dy: 0 };
        limb(P, hx, hy, hx + g.dx * 2, 14 + g.dy, tone(dark, -0.12), i < 2 ? -1 : 1);
      });
      // streamlined body (tension crouch on idle)
      const cr = mode === 'idle' && f === 1 ? 1 : 0;
      P.blob(12, 7.5 + cr * 0.5, 8.4, 3, body, { tex: 1 });
      P.blob(11, 9, 5.5, 1.4, dark, { lite: 0.08 });
      P.blob(16, 7 + cr * 0.4, 3.6, 2.4, tone(body, 0.06)); // shoulder mass
      // dorsal streak + rim
      P.hl(6, 5 + cr, 10, tone(acc, -0.35));
      rimlight(P, 12, 7 + cr * 0.5, 8, 2.8, tone(body, 0.3));
      // wedge head with sensor band (no conventional eyes)
      const hs = mode === 'idle' && f >= 2 ? 1 : 0;
      P.blob(19 + hs, 6.2, 3.2, 2.2, tone(body, 0.1));
      P.r(18 + hs, 5.6, 5, 1, cyb); // sensor band
      P.p(22 + hs, 5.6, tone(cyb, 0.35)); // band hotspot
      P.p(21 + hs, 7.5, tone(dark, -0.2)); // jaw seam
      // twin balancing tail filaments (animated)
      const ts = mode === 'walk' ? (f % 2) : (f === 1 ? 1 : 0);
      P.r(1, 5 + ts, 5, 1, dark); P.p(0, 4 + ts, acc);
      P.r(2, 8 - ts, 4, 1, tone(dark, -0.1)); P.p(1, 8 - ts, tone(acc, -0.3));
    },
  },

  // 11) KARRGAN MAW — apex predator; jaw engine, armour plates, four eyes
  karrgan: {
    w: 36, h: 26, idleFrames: 4, walkFrames: 4,
    shadow: { rx: 14, ry: 4.4, alpha: 0.42 },
    paint(P, f, mode) {
      const body = '#4a3038', plate = '#2e2228', acc = '#e05a6a', amber = '#f2c14e';
      // thick powerful legs with claws
      [[9, 16], [14, 17], [21, 17], [26, 16]].forEach(([hx, hy], i) => {
        const g = mode === 'walk' ? gait(f, i) : { dx: 0, dy: 0 };
        limb(P, hx, hy, hx + g.dx, 24 + g.dy, tone(body, -0.22), i < 2 ? -1 : 1, 2);
        P.p(hx + g.dx, 25 + g.dy, tone(acc, -0.4)); P.p(hx + g.dx + 2, 25 + g.dy, tone(acc, -0.5));
      });
      // heavy body (slow breath)
      const br = mode === 'idle' ? [0, 0.4, 0.7, 0.4][f] : 0;
      P.blob(17, 13 - br * 0.4, 12, 5.8 + br, body, { tex: 1 });
      P.blob(16, 16, 9, 2.4, tone(body, -0.08), { lite: 0.08 });
      scales(P, 16, 13, 11, 5, body, 3);
      // interlocking dorsal armour plates
      for (let i = 0; i < 6; i++) {
        P.r(9 + i * 3, 7 - (i % 2), 3, 3, plate);
        P.hl(9 + i * 3, 7 - (i % 2), 3, tone(plate, 0.24));
        P.p(11 + i * 3, 9 - (i % 2), tone(plate, -0.25)); // joint pin
      }
      // scar streaks
      P.hl(12, 14, 5, tone(acc, -0.4)); P.p(14, 15, tone(acc, -0.5));
      rimlight(P, 16, 12, 11, 5, tone(body, 0.26));
      // MASSIVE head: skull + hinged jaw
      const jaw = mode === 'idle' && f >= 2 ? 1 : 0;
      P.blob(28, 10, 6, 4, tone(body, 0.06), { tex: 1 });
      // heavy brow plate
      P.r(25, 5, 7, 2, plate); P.hl(25, 5, 7, tone(plate, 0.3));
      // four amber eyes (tracking glint)
      const eyes = [[26, 8], [28, 8], [27, 9], [29, 9]];
      eyes.forEach(([x, y], i) => P.p(x, y, i === f % 4 ? tone(amber, 0.4) : amber));
      // lower jaw with hinge
      P.slab(28, 12 + jaw, 8, 3 - jaw, tone(body, -0.14), { tex: 1 });
      P.p(27, 12 + jaw, tone(plate, 0.15)); // hinge bolt
      // teeth rows
      for (let i = 0; i < 5; i++) P.p(27 + i * 2, 12 + jaw, '#e8ddd0');
      if (jaw) for (let i = 0; i < 3; i++) P.p(29 + i * 2, 11, tone('#e8ddd0', -0.2)); // upper fangs on open
      // snout ridge
      P.hl(30, 7, 4, tone(body, 0.15));
      // armoured tail with plate tip
      P.r(3, 11, 5, 2, tone(body, -0.1)); P.r(1, 12, 3, 1, plate);
      P.p(0, 12, tone(plate, 0.2));
    },
  },

  // 12) LUMEN DRIFTER — floating filter feeder; translucent bell, glow organs
  lumen: {
    w: 20, h: 30, idleFrames: 4, walkFrames: 0, bob: true,
    shadow: { rx: 5.5, ry: 2, alpha: 0.16, soft: true, detached: true },
    paint(P, f, mode) {
      const bell = '#3a5a7a', glow = '#2DE2E6', pale = '#9adfe8';
      const pulse = [0, 0.6, 1, 0.6][f];
      // internal light organs painted FIRST (read through translucent bell)
      P.glow(10, 6, glow, 0.3 + pulse * 0.15);
      P.p(7, 7, mixc(bell, glow, 0.6)); P.p(13, 7, mixc(bell, glow, 0.45));
      P.p(10, 8, mixc(bell, glow, 0.5));
      // translucent bell (alpha layered over organs)
      P.ctx.globalAlpha = 0.78;
      P.blob(10, 6, 6.6 + pulse * 0.8, 4.4 - pulse * 0.5, bell, { lite: 0.32, dark: 0.2 });
      P.ctx.globalAlpha = 1;
      P.blob(8.5, 4, 3.6, 1.9, tone(pale, -0.1), { lite: 0.3 }); // apex sheen
      rimlight(P, 10, 6, 6.4, 4, tone(pale, 0.1));
      // scalloped bell rim
      for (let k = 0; k < 6; k++) {
        P.p(5 + k * 2, 10 + (k % 2), tone(pale, -0.25));
      }
      // fine feeding tendrils (drift phase)
      for (let k = 0; k < 4; k++) {
        const x0 = 6 + k * 3;
        for (let y = 12; y < 24 - (k % 2) * 2; y++) {
          const sway = Math.round(Math.sin((y + f * 2 + k * 3) / 3) * 1.4);
          P.p(x0 + sway, y, y % 3 === k % 3 ? mixc(bell, glow, 0.4) : tone(bell, -0.12));
        }
        P.p(x0, 24 - (k % 2) * 2, tone(glow, -0.2)); // tendril bud
      }
      // inner membrane skirt
      P.hl(6, 11, 9, tone(bell, 0.12));
      P.hl(7, 12, 7, tone(bell, -0.1));
      // drifting plankton motes
      if (f % 2 === 0) { P.p(3, 15, tone(glow, -0.45)); P.p(17, 18, tone(glow, -0.5)); }
    },
  },

  // 13) UMBRA VEILWING — shade stalker; folded membranes, rim-lit silhouette
  umbra: {
    w: 26, h: 16, idleFrames: 4, walkFrames: 4,
    shadow: { rx: 9, ry: 2.4, alpha: 0.26 },
    paint(P, f, mode) {
      const body = '#232030', deep = '#191623', acc = '#8AA4FF';
      // silent limbs
      [[7, 11], [10, 12], [15, 12], [18, 11]].forEach(([hx, hy], i) => {
        const g = mode === 'walk' ? gait(f, i) : { dx: 0, dy: 0 };
        limb(P, hx, hy, hx + g.dx, 14 + g.dy, deep, i < 2 ? -1 : 1);
      });
      // sleek low body
      P.blob(13, 8.5, 9, 3.2, body, { lite: 0.12, dark: 0.3 });
      // folded membrane layers (planes with rim light)
      const mf = mode === 'idle' ? [0, 1, 1, 0][f] : 0;
      P.slab(6, 4 - mf, 11, 2, deep);
      P.hl(6, 3 - mf, 11, tone(body, 0.2)); // membrane rim
      P.slab(8, 6, 10, 2, tone(deep, -0.05));
      P.hl(8, 6, 10, tone(body, 0.08));
      P.p(16, 4 - mf, tone(acc, -0.5)); // membrane claw hook
      // narrow head
      const hs = mode === 'idle' && f >= 2 ? 1 : 0;
      P.blob(20 + hs, 7, 3, 1.9, tone(body, 0.08));
      P.p(23 + hs, 7, tone(deep, -0.15)); // muzzle tip
      // luminous markings (controlled pulse on f1/f3)
      if (f % 2 === 1) {
        P.glow(21 + hs, 6, acc, 0.32);
        P.p(14, 7, tone(acc, -0.1)); P.p(9, 8, tone(acc, -0.25)); P.p(11, 5, tone(acc, -0.35));
      } else {
        P.p(21 + hs, 6, tone(acc, -0.35)); P.p(14, 7, tone(acc, -0.5));
      }
      // membrane tail fold
      P.r(2, 7, 4, 1, deep); P.p(1, 8, tone(deep, -0.1)); P.hl(2, 6, 4, tone(body, 0.12));
      // spine rim light (silhouette readability)
      P.hl(9, 5, 9, tone(body, 0.24));
    },
  },

  // 14) VOLTARI ARCHLING — anomalous energivore; segmented arc serpent
  voltari: {
    w: 28, h: 18, idleFrames: 4, walkFrames: 4, hover: 2,
    shadow: { rx: 9, ry: 2.2, alpha: 0.2, soft: true },
    paint(P, f, mode) {
      const body = '#2a3a55', glow = '#2DE2E6', core = '#173048', plate = '#3d5170';
      const ph = mode === 'walk' ? f * 1.5 : f;
      // serpentine arc: segmented plates over energy core
      const spine = [];
      for (let i = 0; i < 22; i++) {
        const x = 2 + i;
        const y = 9 - Math.round(Math.sin((i + ph * 2) / 3.2) * 3.4);
        spine.push([x, y]);
        // segment plate every 2 px
        if (i % 2 === 0) {
          P.r(x, y - 2, 2, 4, plate);
          P.p(x, y - 2, tone(plate, 0.22)); // plate top light
          P.p(x + 1, y + 1, tone(plate, -0.25));
        } else {
          P.r(x, y - 1, 1, 3, body); // joint gap
        }
        P.p(x, y + 2, core); // ventral core line
      }
      // energy nodes along spine (pulse chase)
      spine.forEach(([x, y], i) => {
        if (i % 4 === 2) {
          if ((i / 4 + f) % 3 < 1) P.glow(x, y, glow, 0.32);
          else P.p(x, y, mixc(body, glow, 0.5));
        }
      });
      // arced head with fork sensors + crown node
      const [hx, hy] = spine[spine.length - 1];
      P.blob(hx + 2, hy, 2.6, 2, tone(body, 0.14));
      P.p(hx + 4, hy - 1, glow); P.p(hx + 4, hy + 1, tone(glow, -0.15)); // fork sensors
      P.p(hx + 2, hy - 2, tone(glow, 0.25)); // crown arc node
      P.p(hx + 3, hy, tone(body, -0.2)); // jaw seam
      // trailing charge wisps
      P.p(1, spine[0][1], tone(glow, -0.3));
      if (f % 2 === 0) P.p(0, spine[0][1] - 2, tone(glow, -0.45));
    },
  },

  // 15) EMBEROOT GORGER — fungal colossus; layered caps, ember spore cavities
  emberoot: {
    w: 30, h: 24, idleFrames: 4, walkFrames: 4,
    shadow: { rx: 12, ry: 3.8, alpha: 0.38 },
    paint(P, f, mode) {
      const cap = '#4a2a35', fungal = '#5c4038', ember = '#e0785a', spore = '#b98ae0';
      // root limbs with splayed toes
      [[7, 0], [13, 1], [20, 1], [25, 0]].forEach(([x], i) => {
        const g = mode === 'walk' ? gait(f, i) : { dx: 0, dy: 0 };
        P.slab(x + g.dx, 17 + g.dy, 3, 7 - g.dy, tone(fungal, -0.2), { tex: 1 });
        P.vl(x + g.dx, 17, 4, tone(fungal, 0.08)); // root ridge
        P.p(x - 1 + g.dx, 23, tone(fungal, -0.35)); P.p(x + 3 + g.dx, 23, tone(fungal, -0.4));
      });
      // thick fungal body (expansion pulse)
      const gp = mode === 'idle' ? [0, 0.4, 0.7, 0.4][f] : 0;
      P.blob(15, 13 - gp * 0.3, 10.4, 5 + gp, fungal, { tex: 1 });
      striate(P, 8, 12, 14, 5, fungal, 3);
      // layered cap plates with gill undersides
      P.blob(14, 7.4, 9.4, 3, cap, { tex: 1 });
      P.hl(6, 9, 16, tone(cap, -0.35)); // gill shadow line
      for (let i = 0; i < 7; i++) P.p(7 + i * 2, 10, tone(cap, -0.2)); // gill slits
      P.blob(17, 5, 6, 2, tone(cap, 0.12), { tex: 1 });
      P.hl(9, 6, 5, tone(cap, 0.22));
      rimlight(P, 14, 7, 9, 2.8, tone(cap, 0.3));
      // spore cavities (dark pores w/ ember pulse)
      [[10, 11], [16, 10], [22, 12]].forEach(([x, y], i) => {
        P.r(x, y, 3, 2, '#170f14');
        P.p(x, y, tone('#170f14', 0.3)); // pore rim
        if ((i + f) % 3 !== 2) P.p(x + 1, y + 1, tone(ember, -0.15));
        else P.glow(x + 1, y + 1, ember, 0.3);
      });
      // feeding tendrils at front (probing motion)
      const tm = mode === 'idle' ? (f % 2) : (f % 2);
      P.vl(26, 13 + tm, 5 - tm, tone(fungal, 0.05));
      P.vl(28, 14 - tm, 5 + tm, tone(fungal, -0.08));
      P.p(26, 12 + tm, ember); P.p(28, 13 - tm, tone(ember, -0.2));
      // spore puff (occasional)
      if (f === 2) { P.p(18, 2, tone(spore, -0.1)); P.p(20, 1, tone(spore, -0.35)); P.p(16, 1, tone(spore, -0.5)); }
      // drifting spore glints
      P.p(6, 4, tone(spore, -0.3)); P.p(24, 5, tone(spore, -0.45));
    },
  },
};
