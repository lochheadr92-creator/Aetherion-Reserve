// ---- Creature pixel painters B: rhoak, vantha, karrgan, lumen, umbra, voltari, emberoot ----
// All painted FACING RIGHT; renderer flips for direction. Ground = bottom row. Light: upper-left.
import { tone, mixc } from './pixel';

function legs(P, xs, yTop, yBot, w, color, f, mode) {
  xs.forEach((x, i) => {
    const off = mode === 'walk' ? ((i % 2 === f % 2) ? 1 : -1) : 0;
    P.r(x + (off > 0 ? 1 : 0), yTop, w, yBot - yTop - (off < 0 ? 1 : 0), color);
    P.r(x + (off > 0 ? 1 : 0), yBot - 1, w, 1, tone(color, -0.3));
  });
}

export const CREATURES_B = {
  // 9) ASHMANE RHOAK — fast territorial strider with ash-plume mane
  rhoak: {
    w: 24, h: 20, idleFrames: 3, walkFrames: 2,
    shadow: { rx: 9, ry: 3, alpha: 0.33 },
    paint(P, f, mode) {
      const body = '#5c3a33', mane = '#332e2c', ember = '#e08a5a';
      legs(P, [7, 10, 15, 18], 13, 19, 2, tone(body, -0.25), f, mode);
      // lean fast body
      P.blob(12, 10, 8, 3.8, body, { tex: 1 });
      P.blob(11, 12, 6, 1.8, tone(body, 0.1), { lite: 0.2 });
      // ash mane along neck + back (filament rows)
      const mv = mode === 'idle' ? [0, 1, 0][f] : (f % 2);
      for (let i = 0; i < 6; i++) {
        const x = 8 + i * 2, h = 2 + ((i + mv) % 2);
        P.vl(x, 7 - h, h, mane);
        // ember tips flicker
        if ((i + f) % 3 === 0) P.p(x, 6 - h, ember);
        else P.p(x, 6 - h, tone(mane, 0.2));
      }
      // neck + territorial head (motion on idle f2)
      const hm = mode === 'idle' && f === 2 ? 1 : 0;
      P.r(17, 6, 2, 4, body);
      P.blob(20 + hm, 5, 3, 2.2, tone(body, 0.1));
      P.p(23 + hm, 5, tone(body, -0.15)); // snout
      P.p(21 + hm, 4, '#ffd9b0'); // eye
      // brow crest
      P.hl(19 + hm, 2, 3, mane); P.p(20 + hm, 1, ember);
      // tail plume
      P.r(3, 8, 3, 1, mane); P.p(2, 7, tone(mane, 0.15)); P.p(1, 8, ember);
    },
  },

  // 10) VANTHA DUSKRUNNER — coordinated low-light pack hunter, sensory band
  vantha: {
    w: 20, h: 14, idleFrames: 3, walkFrames: 2,
    shadow: { rx: 8, ry: 2.4, alpha: 0.3 },
    paint(P, f, mode) {
      const body = '#3a3a4a', dark = '#2b2b3a', acc = '#8a6adf', cy = '#63d8e8';
      // four running limbs + rear balancing appendage
      legs(P, [5, 8, 12, 15], 9, 13, 1, tone(dark, -0.1), f, mode);
      // streamlined body (tension crouch on idle f1)
      const cr = mode === 'idle' && f === 1 ? 1 : 0;
      P.blob(10, 6.5 + cr * 0.5, 7.4, 2.8, body, { tex: 1 });
      P.blob(9, 8, 5, 1.4, dark, { lite: 0.08 });
      // dorsal streak
      P.hl(5, 4 + cr, 9, tone(acc, -0.35));
      // wedge head with sensory band (no conventional eyes)
      const hs = mode === 'idle' && f === 2 ? 1 : 0;
      P.blob(16 + hs, 5.4, 2.8, 2, tone(body, 0.1));
      P.r(15 + hs, 5, 4, 1, cy); // sensor band
      P.p(18 + hs, 5, tone(cy, 0.35));
      // twin balancing tail filaments
      const ts = mode === 'walk' ? (f % 2) : (f === 1 ? 1 : 0);
      P.r(1, 5 + ts, 4, 1, dark); P.p(0, 4 + ts, acc);
      P.r(2, 7 - ts, 3, 1, tone(dark, -0.1));
    },
  },

  // 11) KARRGAN MAW — apex predator: massive four-eyed jaw engine
  karrgan: {
    w: 32, h: 24, idleFrames: 3, walkFrames: 2,
    shadow: { rx: 13, ry: 4.2, alpha: 0.42 },
    paint(P, f, mode) {
      const body = '#4a3038', plate = '#2e2228', acc = '#e05a6a', amber = '#f2c14e';
      // thick powerful legs
      const lo = mode === 'walk' ? (f % 2 ? 1 : 0) : 0;
      [[7, lo], [12, -lo], [19, -lo], [24, lo]].forEach(([x, o]) => {
        P.slab(x + (o > 0 ? 1 : 0), 16, 3, 7, tone(body, -0.2), { tex: 1 });
        P.r(x + (o > 0 ? 1 : 0), 22, 3, 1, tone(plate, -0.2));
        P.p(x + (o > 0 ? 1 : 0), 21, tone(acc, -0.35)); // claw hint
      });
      // heavy body (slow breath)
      const br = mode === 'idle' ? [0, 0.6, 0.2][f] : 0;
      P.blob(15, 12 - br * 0.4, 11, 5.4 + br, body, { tex: 1 });
      // dorsal armour plates
      for (let i = 0; i < 5; i++) {
        P.r(8 + i * 3, 6 - (i % 2), 3, 2, plate);
        P.p(9 + i * 3, 5 - (i % 2), tone(plate, 0.22));
      }
      // flank scar streak
      P.hl(11, 13, 5, tone(acc, -0.4));
      // MASSIVE head + jaw (jaw parts on idle f2)
      const jaw = mode === 'idle' && f === 2 ? 1 : 0;
      P.blob(25, 9, 5.4, 3.6, tone(body, 0.06), { tex: 1 });
      P.slab(25, 11 + jaw, 7, 3 - jaw, tone(body, -0.12), { tex: 1 }); // lower jaw
      // teeth row
      for (let i = 0; i < 4; i++) P.p(25 + i * 2, 11 + jaw, '#e8ddd0');
      // heavy brow plate
      P.r(23, 5, 6, 2, plate); P.hl(23, 5, 6, tone(plate, 0.25));
      // four amber eyes (tracking glint by frame)
      const eyes = [[24, 7], [26, 7], [25, 8], [27, 8]];
      eyes.forEach(([x, y], i) => P.p(x, y, i === f % 4 ? tone(amber, 0.35) : amber));
      // tail
      P.r(2, 10, 4, 2, tone(body, -0.1)); P.r(0, 11, 2, 1, plate);
    },
  },

  // 12) LUMEN DRIFTER — floating aerial filter feeder, softly bioluminescent
  lumen: {
    w: 18, h: 26, idleFrames: 4, walkFrames: 0, bob: true,
    shadow: { rx: 5, ry: 1.8, alpha: 0.16, soft: true, detached: true },
    paint(P, f, mode) {
      const bell = '#3a5a7a', glow = '#2DE2E6', pale = '#9adfe8';
      const pulse = [0, 0.6, 1, 0.6][f]; // bell pulse cycle
      // translucent bell
      P.blob(9, 5.5, 6 + pulse * 0.7, 4 - pulse * 0.4, bell, { lite: 0.3, dark: 0.2 });
      P.blob(8, 4, 3.4, 1.8, tone(pale, -0.1), { lite: 0.3 });
      // internal light organs (glow cycle)
      P.glow(9, 5, glow, 0.3 + pulse * 0.12);
      P.p(7, 6, mixc(bell, glow, 0.55)); P.p(11, 6, mixc(bell, glow, 0.4));
      // bell rim
      P.hl(4, 9, 11, tone(pale, -0.2));
      // fine feeding tendrils (drift by frame)
      for (let k = 0; k < 4; k++) {
        const x0 = 5 + k * 3;
        for (let y = 10; y < 21 - k % 2; y++) {
          const sway = Math.round(Math.sin((y + f * 2 + k * 3) / 3) * 1.2);
          P.p(x0 + sway, y, y % 3 === k % 3 ? mixc(bell, glow, 0.35) : tone(bell, -0.12));
        }
        P.p(x0, 21 - k % 2, tone(glow, -0.25));
      }
      // membrane skirt
      P.hl(5, 10, 9, tone(bell, 0.1));
    },
  },

  // 13) UMBRA VEILWING — shade stalker, folded membranes, controlled luminous markings
  umbra: {
    w: 22, h: 14, idleFrames: 3, walkFrames: 2,
    shadow: { rx: 8, ry: 2.2, alpha: 0.26 },
    paint(P, f, mode) {
      const body = '#232030', deep = '#191623', acc = '#8AA4FF';
      // low silent limbs
      legs(P, [6, 9, 13, 16], 10, 13, 1, deep, f, mode);
      // sleek body
      P.blob(11, 7.5, 8, 3, body, { lite: 0.12, dark: 0.3 });
      // folded membrane layers (adjust on idle)
      const mf = mode === 'idle' ? [0, 1, 0][f] : 0;
      P.slab(5, 4 - mf, 9, 2, deep);
      P.hl(5, 3 - mf, 9, tone(body, 0.14)); // rim light for readability
      P.slab(7, 6, 8, 1, tone(deep, -0.05));
      // narrow head
      const hs = mode === 'idle' && f === 2 ? 1 : 0;
      P.blob(17 + hs, 6, 2.6, 1.7, tone(body, 0.08));
      // luminous markings (brief illumination on f1 only)
      if (f === 1) { P.glow(18 + hs, 5, acc, 0.3); P.p(12, 6, tone(acc, -0.1)); P.p(8, 7, tone(acc, -0.25)); }
      else { P.p(18 + hs, 5, tone(acc, -0.35)); P.p(12, 6, tone(acc, -0.5)); }
      // membrane tail fold
      P.r(2, 6, 3, 1, deep); P.p(1, 7, tone(deep, -0.1));
      // top rim light along spine
      P.hl(8, 5, 7, tone(body, 0.2));
    },
  },

  // 14) VOLTARI ARCHLING — anomalous energivore, arcing serpentine form
  voltari: {
    w: 24, h: 16, idleFrames: 4, walkFrames: 2, hover: 2,
    shadow: { rx: 8, ry: 2, alpha: 0.2, soft: true },
    paint(P, f, mode) {
      const body = '#2a3a55', glow = '#2DE2E6', core = '#173048';
      const ph = mode === 'walk' ? f * 2 : f; // wave phase
      // serpentine arc body (3px thick wave)
      const spine = [];
      for (let i = 0; i < 19; i++) {
        const x = 2 + i;
        const y = 8 - Math.round(Math.sin((i + ph * 2) / 3) * 3);
        spine.push([x, y]);
        P.r(x, y - 1, 1, 3, i % 4 === 0 ? tone(body, 0.1) : body);
        P.p(x, y + 2, core);
      }
      // top rim light
      spine.forEach(([x, y], i) => { if (i % 2 === 0) P.p(x, y - 1, tone(body, 0.24)); });
      // internal energy nodes along spine (pulse cycle)
      spine.forEach(([x, y], i) => {
        if (i % 4 === 2) {
          if ((i / 4 + f) % 3 < 1) P.glow(x, y, glow, 0.3);
          else P.p(x, y, mixc(body, glow, 0.5));
        }
      });
      // arced head w/ forked sensors
      const [hx, hy] = spine[spine.length - 1];
      P.blob(hx + 1, hy, 2.2, 1.8, tone(body, 0.14));
      P.p(hx + 3, hy - 1, glow); P.p(hx + 3, hy + 1, tone(glow, -0.15));
      P.p(hx + 1, hy - 2, tone(glow, 0.2)); // crown arc node
      // trailing charge wisps
      P.p(1, spine[0][1], tone(glow, -0.3));
    },
  },

  // 15) EMBEROOT GORGER — fungal colossus with spore cavities and root limbs
  emberoot: {
    w: 26, h: 22, idleFrames: 3, walkFrames: 2,
    shadow: { rx: 11, ry: 3.6, alpha: 0.38 },
    paint(P, f, mode) {
      const cap = '#4a2a35', fungal = '#5c4038', ember = '#e0785a', spore = '#b98ae0';
      // root-like limbs (heavy)
      const lo = mode === 'walk' ? (f % 2 ? 1 : 0) : 0;
      [[6, lo], [11, -lo], [17, -lo], [21, lo]].forEach(([x, o]) => {
        P.slab(x + (o > 0 ? 1 : 0), 15, 3, 7, tone(fungal, -0.2), { tex: 1 });
        P.p(x - 1 + (o > 0 ? 1 : 0), 21, tone(fungal, -0.35)); // splayed root toe
        P.p(x + 3 + (o > 0 ? 1 : 0), 21, tone(fungal, -0.35));
      });
      // thick fungal body (expansion pulse)
      const gp = mode === 'idle' ? [0, 0.6, 0.2][f] : 0;
      P.blob(13, 12 - gp * 0.3, 9.4, 4.6 + gp, fungal, { tex: 1 });
      // layered cap plates
      P.blob(12, 7, 8.4, 2.8, cap, { tex: 1 });
      P.blob(15, 5, 5.4, 1.8, tone(cap, 0.12), { tex: 1 });
      P.hl(8, 6, 4, tone(cap, 0.2));
      // spore cavities (dark pores w/ inner ember warmth pulse)
      [[9, 10], [14, 9], [19, 11]].forEach(([x, y], i) => {
        P.r(x, y, 2, 2, '#170f14');
        if ((i + f) % 3 !== 2) P.p(x + 1, y + 1, tone(ember, -0.15));
        else P.glow(x + 1, y + 1, ember, 0.28);
      });
      // feeding tendrils at front (movement)
      const tm = mode === 'idle' ? (f === 1 ? 1 : 0) : (f % 2);
      P.vl(22, 12 + tm, 4 - tm, tone(fungal, 0.05));
      P.vl(24, 13 - tm, 4 + tm, tone(fungal, -0.08));
      P.p(22, 11 + tm, ember); P.p(24, 12 - tm, tone(ember, -0.2));
      // spore puff (f2 only, tiny)
      if (f === 2) { P.p(16, 2, tone(spore, -0.1)); P.p(18, 1, tone(spore, -0.35)); }
      // drifting spore glints
      P.p(6, 4, tone(spore, -0.3)); P.p(21, 5, tone(spore, -0.45));
    },
  },
};
