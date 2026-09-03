// ---- Creature pixel painters A (Phase G rework: crisp, angular, expressive) ----
// veyra, skitter, thornback, hollowcrest, mirefin, silttitan, shardling, mosswarden
// Painted FACING RIGHT at 1 art px = 1 device px (scale: 1). Ground = bottom row.
// Key light upper-left, hard cel bands, opaque ink outline. Modes: idle (6),
// walk (6), threat (4). Eyes go through P.eye() so blink frames are exact.
import { tone, mixc, breathe, stride, bobc } from './pixel';
import { legs, tail, ridge, jaw, plates, stripes } from './rig';

const W = '#f4f1ea'; // bone / tooth white

export const CREATURES_A = {
  // 1) VEYRA STRIDER — powerful plains strider; blade crest, muscular haunches, hard hooves
  veyra: {
    w: 56, h: 72, scale: 1, idleFrames: 6, walkFrames: 8, threatFrames: 4, lungeFrames: 4,
    shadow: { rx: 20, ry: 7, alpha: 0.32 },
    paint(P, f, mode) {
      const body = '#4a6a5c', belly = '#6a8f7c', acc = '#8fd0b0', hoof = '#22302a', crest = '#c9f2dd';
      const br = mode === 'idle' ? breathe(f) : 0;
      const th = mode === 'threat' || mode === 'lunge', lu = mode === 'lunge';
      const bob = mode === 'walk' ? bobc(f, 2) : 0;
      const hipsFar = [[17, 44], [33, 44]], hipsNear = [[22, 46], [38, 46]];
      const gait = { amp: 3, lift: 3, order: [0, 0.5], foot: hoof };
      legs(P, { hips: hipsFar, ground: 71, f, mode, color: body, thick: 3, far: true, kneeBias: -2, ...gait });
      // haunch + chest (cel-banded muscle masses)
      P.band(19, 37 - bob, 10.5, 8.5 + br * 0.4, tone(body, -0.04), { tex: 1 });
      P.band(33, 35 - bob, 12, 9 + br * 0.5, body, { tex: 1 });
      P.band(27, 41 - bob, 13, 3.5, belly, { steps: [0.2, 0.08, -0.06, -0.18], spec: false });
      // muscle definition lines + flank stripe
      P.line(26, 31 - bob, 40, 29 - bob, tone(body, -0.28));
      P.line(12, 36 - bob, 22, 33 - bob, tone(body, -0.24));
      stripes(P, 28, 33 - bob, 10, 6, tone(acc, -0.5), 5, 1);
      legs(P, { hips: hipsNear, ground: 71, f: th ? 0 : f, mode: th ? 'idle' : mode, color: body, thick: 3, kneeBias: 2, ...gait });
      if (th) { // threat: front leg raised for a stomp
        P.r(38, 44, 3, 18, tone(body, 0.02)); P.r(41, 58, 4, 2, hoof); P.r(40, 61, 3, 1, tone(hoof, -0.2));
      }
      // neck: one thick tapered mass rising to an upright (or lowered, threat) head
      const hx = lu ? 57 : th ? 54 : 50, hy = lu ? 20 : th ? 16 : 6;
      P.poly([[36, 31 - bob], [46, 25 - bob], [hx - 1, hy + 4], [hx - 9, hy + 8]], tone(body, 0.02));
      P.poly([[39, 30 - bob], [46, 26 - bob], [hx - 3, hy + 5], [hx - 7, hy + 7]], tone(body, 0.14));
      P.line(38, 29 - bob, hx - 7, hy + 5, tone(acc, -0.42)); // mane seam
      for (let i = 0; i < 7; i++) P.spike(39 + i * 2, 29 - bob - i * 3 + (th ? i : 0), 3 + (i % 2), tone(acc, -0.2), -0.5, 1);
      // skull: large angular wedge with blade crest, heavy brow and jaw
      P.poly([[hx - 7, hy], [hx + 4, hy + 1], [hx + 7, hy + 6], [hx + 1, hy + 11], [hx - 7, hy + 8]], tone(body, 0.16));
      P.poly([[hx + 1, hy + 5], [hx + 7, hy + 6], [hx + 5, hy + 12], [hx - 1, hy + 11]], tone(belly, 0.08)); // muzzle
      P.line(hx, hy + 11, hx + 5, hy + 12, tone(body, -0.45)); // mouth line
      P.p(hx + 6, hy + 8, tone(body, -0.3)); // nostril
      P.spike(hx - 4, hy, 9 + (th ? 2 : 0), crest, -0.6, 3); // blade crest
      P.spike(hx, hy, 5, tone(crest, -0.2), -0.6, 2);
      P.line(hx - 5, hy + 3, hx + 2, hy + 3, tone(body, -0.4)); // brow shadow
      // twin stacked eyes (bright, alert)
      P.eye(hx, hy + 4, 3, 2, th ? '#eafff5' : acc, { glint: true, pupil: '#0b1a14' });
      P.eye(hx - 4, hy + 5, 2, 2, tone(acc, 0.2), { glint: false, pupil: '#0b1a14' });
      // tail plume
      tail(P, 10, 34 - bob, 2, 26, body, { thick: 3, sway: mode === 'idle' ? Math.round(Math.sin(f) * 1.5) : 0, tip: acc, segs: 7 });
      P.rim(tone(acc, 0.1), 0.35);
    },
  },

  // 2) SKITTERLING — armoured chitin scuttler; serrated mandibles, hard shell plates
  skitter: {
    w: 32, h: 20, scale: 1, idleFrames: 6, walkFrames: 8, threatFrames: 4, lungeFrames: 4, pace: 0.6,
    shadow: { rx: 12, ry: 3.6, alpha: 0.3 },
    paint(P, f, mode) {
      const body = '#6e5c3f', shell = '#94805a', acc = '#e8c877', ink = '#2c2418';
      const th = mode === 'threat' || mode === 'lunge', lu = mode === 'lunge';
      // six legs, alternating tripod gait
      [4, 9, 14, 19, 24].forEach((x, i) => {
        const g = mode === 'walk' ? stride(f, i, { amp: 2, lift: 2, order: [0, 0.5, 0, 0.5, 0] }) : { dx: 0, dy: 0 };
        P.line(x, 12, x + g.dx - 1, 18 + g.dy, tone(body, -0.25), 1);
        P.line(x, 12, x + g.dx + 1, 18 + g.dy, tone(body, -0.38), 1);
        P.p(x + g.dx - 1, 19 + g.dy, ink); P.p(x + g.dx + 1, 19 + g.dy, ink);
      });
      // abdomen: segmented shell plates (pulses as it breathes)
      const br = mode === 'idle' ? breathe(f) : 0;
      P.band(10, 10, 9 + br * 0.5, 5.5 + br * 0.5, body, { tex: 1 });
      for (let k = 0; k < 4; k++) { P.vl(4 + k * 4, 6 + (k === 0 || k === 3 ? 1 : 0), 8 - (k === 0 || k === 3 ? 2 : 0), tone(shell, -0.3)); P.vl(5 + k * 4, 6, 1, tone(shell, 0.25)); }
      P.hl(3, 7, 14, tone(shell, 0.28)); // shell rim highlight
      // thorax + head capsule
      P.band(20, 9.5, 4.5, 4, tone(shell, 0.08));
      P.band(25.5, 10, 3.5, 3.4, tone(shell, 0.16));
      // serrated mandibles (spread wide in threat; chew when idle)
      const md = lu ? 3 : th ? 2 : (mode === 'idle' ? [1, 0, 0, 1, 0, 0][f] : 0);
      P.line(28, 9 - md, 31, 7 - md, ink); P.line(28, 11 + md, 31, 13 + md, ink);
      P.p(31, 6 - md, tone(acc, 0.2)); P.p(31, 14 + md, tone(acc, 0.2));
      // compound eyes
      P.eye(26, 8, 2, 2, th ? '#ffd27a' : acc, { glint: true, pupil: ink });
      // antennae sweep
      const aw = mode === 'walk' ? f % 2 : (mode === 'idle' ? [0, 1, 2, 1, 0, -1][f] : (th ? 2 : 0));
      P.line(25, 6, 29, 2 - aw, tone(body, -0.1)); P.p(30, 1 - aw, acc);
      P.line(24, 6, 26, 1, tone(body, -0.1)); P.p(26, 0, tone(acc, -0.1));
      // flank sensory pips
      P.p(6, 9, tone(acc, -0.15)); P.p(14, 8, acc);
      P.rim(tone(acc, 0.2), 0.3);
    },
  },

  // 3) THORNBACK BRAMBLEN — living-bramble tank; thick thorn spines, beaked skull, plated flanks
  thornback: {
    w: 50, h: 34, scale: 1, idleFrames: 6, walkFrames: 8, threatFrames: 4, lungeFrames: 4,
    shadow: { rx: 20, ry: 6, alpha: 0.34 },
    paint(P, f, mode) {
      const body = '#5c4a33', moss = '#4c6136', thorn = '#c2a866', beak = '#ece4cc', ink = '#1c160e';
      const th = mode === 'threat' || mode === 'lunge', lu = mode === 'lunge';
      const br = mode === 'idle' ? breathe(f) : 0;
      const hips = [[12, 22], [19, 23], [30, 23], [37, 22]];
      const g = { amp: 2, lift: 2, order: [0, 0.5, 0.25, 0.75], thick: 3, claws: 2, clawColor: tone(beak, -0.2) };
      legs(P, { hips: hips.slice(0, 2), ground: 33, f, mode, color: body, far: true, ...g });
      // low wide armoured body
      P.band(24, 19, 17, 8.5 + br * 0.3, body, { tex: 1 });
      plates(P, 14, 16, 22, 8, tone(body, -0.06), 5);
      P.band(22, 24, 13, 3, tone(body, 0.14), { steps: [0.16, 0.06, -0.04, -0.14], spec: false });
      legs(P, { hips: hips.slice(2), ground: 33, f, mode, color: body, ...g });
      // bramble shell dome
      P.band(22, 12.5, 15, 5, moss, { tex: 1 });
      P.band(18, 10, 9, 3.2, tone(moss, 0.1), { spec: false });
      P.dither(10, 8, 24, 6, tone(moss, 0.32), 0.1, 4);
      P.hl(8, 16, 28, tone(body, -0.32)); // shell/hide seam
      // thorn spines (flare upward in threat)
      const rz = th ? 2 : (mode === 'idle' && f === 3 ? 1 : 0);
      [[9, 10, -0.4], [14, 7, -0.2], [20, 5, 0], [26, 5, 0.1], [32, 7, 0.3], [37, 10, 0.5]].forEach(([x, y, l], i) => {
        P.spike(x, y, 5 + (i % 2) + rz, thorn, l, 2);
        P.spike(x + 2, y + 4, 3, tone(thorn, -0.2), l * 0.5, 1);
      });
      // heavy beaked skull (lowered when browsing, raised in threat)
      const hd = lu ? -5 : th ? -3 : (mode === 'idle' && f >= 4 ? 2 : 0);
      P.poly([[38, 16 + hd], [46, 17 + hd], [48, 21 + hd], [44, 26 + hd], [37, 24 + hd]], tone(body, 0.12));
      P.poly([[45, 18 + hd], [50, 21 + hd], [47, 25 + hd], [44, 23 + hd]], beak); // hooked beak
      P.p(49, 22 + hd, tone(beak, -0.35)); P.line(44, 24 + hd, 47, 25 + hd, ink);
      P.spike(40, 16 + hd, 4 + rz, thorn, -0.6, 2); // brow thorn
      P.eye(42, 19 + hd, 3, 2, th ? '#ffe9a8' : '#f5efdc', { glint: true, pupil: ink });
      if (th) { P.r(45, 26 + hd, 3, 1, ink); P.p(46, 27 + hd, '#5a1c22'); } // hissing open beak
      // tail club
      tail(P, 8, 19, 2, 21, tone(moss, -0.05), { thick: 4, segs: 5, tip: tone(thorn, -0.1) });
      P.rim(tone(moss, 0.35), 0.3);
    },
  },

  // 4) HOLLOWCREST — hawk-faced crag dweller; angular plated body, resonant crest, talons
  hollowcrest: {
    w: 46, h: 50, scale: 1, idleFrames: 6, walkFrames: 8, threatFrames: 4, lungeFrames: 4,
    shadow: { rx: 14, ry: 5, alpha: 0.3 },
    paint(P, f, mode) {
      const body = '#4a5568', acc = '#a4bde0', cy = '#7ccfd8', ink = '#0d131c';
      const th = mode === 'threat' || mode === 'lunge', lu = mode === 'lunge';
      const hips = [[14, 32], [24, 34]];
      // splayed climbing limbs with talons
      hips.forEach(([hx, hy], i) => {
        const g = mode === 'walk' ? stride(f, i, { amp: 3, lift: 3, order: [0, 0.5] }) : { dx: 0, dy: 0 };
        P.line(hx, hy, hx - 5 + g.dx, 48 + g.dy, tone(body, -0.3), 2);
        P.line(hx + 3, hy, hx + 7 + g.dx, 48 + g.dy, tone(body, -0.18), 2);
        P.claw(hx - 6 + g.dx, 48 + g.dy, -1, acc, 2); P.claw(hx + 8 + g.dx, 48 + g.dy, 1, acc, 2);
        P.p(hx - 5 + g.dx, 49, ink); P.p(hx + 7 + g.dx, 49, ink);
      });
      // faceted torso: hard planes
      P.poly([[8, 26], [22, 20], [34, 24], [30, 38], [12, 38]], body);
      P.poly([[8, 26], [22, 20], [24, 28], [12, 32]], tone(body, 0.16)); // lit plane
      P.poly([[24, 28], [34, 24], [30, 38], [26, 38]], tone(body, -0.2)); // shaded plane
      P.line(22, 20, 24, 28, tone(acc, -0.1)); P.line(24, 28, 26, 38, tone(body, -0.35));
      // wing folds (membrane blades) — flare in threat
      const wf = th ? 6 : (mode === 'idle' ? [0, 1, 1, 0, 0, 0][f] : 0);
      P.poly([[10, 26], [4 - wf, 16 - wf], [16, 22]], tone(body, -0.22));
      P.poly([[12, 26], [6 - wf, 18 - wf], [16, 23]], tone(acc, -0.45));
      // neck + hawk head (scans when idle, lunges forward in threat)
      const sc = lu ? 7 : th ? 4 : (mode === 'idle' ? [0, 0, 1, 2, 1, 0][f] : 0);
      P.poly([[28, 22], [34, 18], [37 + sc, 12], [33 + sc, 12]], body);
      P.poly([[31 + sc, 8], [41 + sc, 9], [43 + sc, 13], [38 + sc, 17], [31 + sc, 15]], tone(body, 0.14));
      P.poly([[40 + sc, 11], [46 + sc, 14], [41 + sc, 16]], acc); // hooked beak
      P.p(45 + sc, 14, ink);
      if (th) { P.poly([[40 + sc, 15], [45 + sc, 16], [40 + sc, 18]], tone(acc, -0.3)); P.p(43 + sc, 16, '#4a1a26'); }
      P.eye(36 + sc, 11, 3, 2, th ? '#ffffff' : '#e8f2ff', { glint: true, pupil: ink });
      P.line(35 + sc, 10, 39 + sc, 10, tone(body, -0.4)); // angry brow
      // resonant crest: swept-back blades with a hollow resonating void (taller in threat)
      const ch = th ? 3 : 0;
      P.poly([[30 + sc, 9], [41 + sc, 8], [38 + sc, 4 - ch], [33 + sc, 3 - ch]], acc);
      P.spike(31 + sc, 9, 6 + ch, tone(acc, 0.1), -0.9, 3);
      P.spike(35 + sc, 8, 8 + ch, acc, -0.75, 3);
      P.spike(39 + sc, 8, 6 + ch, tone(acc, -0.12), -0.6, 2);
      P.r(34 + sc, 5 - ch, 4, 2, '#0e1620'); // hollow void
      P.p(33 + sc, 6 - ch, cy); P.p(38 + sc, 6 - ch, tone(cy, -0.2));
      // balance tail
      tail(P, 8, 34, 1, 40, body, { thick: 3, segs: 6, tip: tone(acc, -0.3) });
      P.rim(tone(acc, 0.05), 0.35);
    },
  },

  // 5) MIREFIN LURKER — needle-toothed ambush predator; bulging eyes, ray-spined fin, slick hide
  mirefin: {
    w: 58, h: 26, scale: 1, idleFrames: 6, walkFrames: 8, threatFrames: 4, lungeFrames: 4, menace: '#ffe08a', pace: 0.9,
    shadow: { rx: 24, ry: 4.6, alpha: 0.22, soft: true },
    paint(P, f, mode) {
      const body = '#2a4a44', acc = '#4ac0a8', deep = '#16302c', wet = '#a6ecf2', ink = '#08120f';
      const th = mode === 'threat' || mode === 'lunge', lu = mode === 'lunge';
      const open = lu ? 7 : th ? 5 : (mode === 'idle' && f === 4 ? 1 : 0);
      // stubby splayed legs
      [[12, 18], [24, 19], [36, 19]].forEach(([hx, hy], i) => {
        const g = mode === 'walk' ? stride(f, i, { amp: 2, lift: 1, order: [0, 0.5, 0.25] }) : { dx: 0, dy: 0 };
        P.line(hx, hy, hx - 3 + g.dx, 24 + g.dy, tone(body, -0.25), 2);
        P.line(hx + 2, hy, hx + 5 + g.dx, 24 + g.dy, tone(body, -0.35), 2);
        P.r(hx - 4 + g.dx, 24 + g.dy, 3, 1, deep); P.r(hx + 4 + g.dx, 24 + g.dy, 3, 1, deep);
      });
      // low slick body
      P.band(26, 16, 22, 6.5, body, { tex: 1, steps: [0.3, 0.1, -0.12, -0.32] });
      P.band(26, 19.5, 18, 3, deep, { spec: false, steps: [0.1, 0.02, -0.05, -0.12] });
      P.line(12, 11, 30, 10, tone(wet, -0.4)); P.p(32, 10, tone(wet, -0.2)); // wet specular streak
      // dorsal fin: ray spines + membrane (ripples; snaps erect in threat)
      const fh = th ? 3 : (mode === 'idle' ? [0, 1, 1, 0, 0, 1][f] : f % 2);
      for (let i = 0; i < 7; i++) {
        const x = 12 + i * 4, hgt = 5 + ((i + fh) % 2) + (th ? 2 : 0);
        if (i < 6) P.poly([[x, 11], [x + 4, 11], [x + 4, 11 - hgt + 2], [x, 11 - hgt]], mixc(body, acc, 0.22));
        P.spike(x, 11, hgt, mixc(body, acc, 0.6), 0, 1);
      }
      // head: wide flat skull, periscope eyes, needle jaw
      P.band(45, 15, 9, 4.5, tone(body, 0.1), { spec: false });
      jaw(P, { x: 42, y: 14, w: 14, h: 3, color: tone(body, 0.06), open, fangs: 4, fangLen: 2, gum: '#3a1018', tongue: open > 3 ? '#7a2a3a' : null });
      P.vl(47, 9, 3, tone(body, 0.05)); P.vl(50, 8, 3, tone(body, 0.08)); // eye stalks
      P.eye(46, 7, 3, 2, th ? '#fff8d8' : '#eafff8', { glint: true, pupil: ink, slit: true });
      P.eye(49, 6, 3, 2, th ? '#fff8d8' : '#eafff8', { glint: true, pupil: ink, slit: true });
      P.vl(40, 16, 3, tone(deep, -0.15)); P.vl(42, 16, 3, tone(deep, -0.1)); // gill slits
      // lateral bioluminescent line (chase)
      for (let i = 0; i < 6; i++) P.r(12 + i * 5, 17, 2, 1, i === f % 6 ? tone(acc, 0.4) : tone(acc, -0.25));
      // tail with fin flag
      const ts = mode === 'walk' ? (f % 2 ? 1 : -1) : 0;
      tail(P, 6, 15 + ts, 0, 14 + ts, body, { thick: 4, segs: 4 });
      P.poly([[2, 14 + ts], [6, 14 + ts], [1, 6 + ts]], mixc(body, acc, 0.4));
      P.rim(tone(wet, -0.1), 0.35);
    },
  },

  // 6) BULWARK SILT TITAN — armoured wetland colossus; scythe tusks, plated back, mud-caked pillars
  silttitan: {
    w: 80, h: 58, scale: 1, idleFrames: 6, walkFrames: 8, threatFrames: 4, lungeFrames: 4, pace: 1.6,
    shadow: { rx: 34, ry: 10, alpha: 0.4 },
    paint(P, f, mode) {
      const body = '#4a4238', hide = '#5f5647', wet = '#8b98a0', mud = '#33291f', tusk = '#e2dccc', ink = '#120e0a';
      const th = mode === 'threat' || mode === 'lunge', lu = mode === 'lunge';
      const br = mode === 'idle' ? breathe(f) : 0;
      // columnar legs (mud-stained)
      [[14, 40], [28, 42], [46, 42], [60, 40]].forEach(([x, y], i) => {
        const g = mode === 'walk' ? stride(f, i, { amp: 2, lift: 2, order: [0, 0.5, 0.25, 0.75] }) : { dx: 0, dy: 0 };
        const far = i === 0 || i === 2;
        P.slab(x + g.dx, y + g.dy, 9, 57 - y - g.dy, tone(body, far ? -0.3 : -0.12), { tex: 1 });
        P.vl(x + g.dx, y + g.dy, 57 - y - g.dy, tone(body, far ? -0.15 : 0.08)); // lit edge
        P.r(x + g.dx, 52, 9, 5, mud); P.hl(x + g.dx, 52, 9, tone(mud, 0.2));
        P.r(x - 1 + g.dx, 56, 11, 1, tone(mud, -0.35)); // splayed foot
      });
      // massive body
      P.band(38, 28 - br * 0.5, 29, 14 + br, hide, { tex: 1 });
      P.band(36, 36, 24, 5.5, tone(body, -0.05), { spec: false, steps: [0.1, 0.02, -0.08, -0.2] });
      // hide creases + wet sheen
      P.line(18, 26, 34, 24, tone(body, -0.28)); P.line(26, 32, 46, 30, tone(body, -0.22)); P.line(46, 24, 60, 26, tone(body, -0.25));
      P.line(18, 16, 32, 14, tone(wet, 0.05)); P.line(38, 13, 56, 14, tone(wet, 0.16));
      // back ridge plates (armour) — tall crest
      for (let i = 0; i < 6; i++) {
        P.poly([[18 + i * 8, 15 - (i % 2)], [26 + i * 8, 15 - (i % 2)], [24 + i * 8, 9 - (i % 2) - (i === 2 || i === 3 ? 2 : 0)], [20 + i * 8, 10 - (i % 2)]], tone(hide, -0.12));
        P.p(22 + i * 8, 10 - (i % 2), tone(wet, 0.1));
      }
      // low heavy head (sways; lowers with tusks forward in threat)
      const hs = lu ? 5 : th ? 3 : (mode === 'idle' ? [0, 0, 1, 2, 1, 0][f] : 0);
      P.poly([[62, 24 + hs], [76, 27 + hs], [78, 36 + hs], [72, 42 + hs], [62, 40 + hs]], tone(hide, 0.08));
      P.poly([[70, 30 + hs], [78, 33 + hs], [79, 40 + hs], [72, 42 + hs]], tone(body, -0.06)); // muzzle
      P.line(72, 41 + hs, 78, 40 + hs, ink); // mouth
      P.eye(68, 28 + hs, 3, 2, th ? '#ffe4c4' : '#e8e4d8', { glint: true, pupil: ink });
      P.line(66, 27 + hs, 71, 26 + hs, tone(body, -0.4)); // brow ridge
      // scythe tusks (wet gleam)
      P.spike(74, 42 + hs, 9 + (th ? 2 : 0), tusk, 0.55, 3); P.spike(70, 43 + hs, 6, tone(tusk, -0.12), 0.5, 2);
      if (th) { P.r(73, 42 + hs, 4, 2, ink); }
      // armoured tail stump
      tail(P, 10, 30, 2, 36, tone(body, -0.05), { thick: 6, segs: 4, tip: tone(mud, 0.1) });
      P.rim(tone(wet, 0.05), 0.3);
    },
  },

  // 7) PRISMA SHARDLING — living crystal; razor facets, refracted core, orbiting shards
  shardling: {
    w: 34, h: 40, scale: 1, idleFrames: 6, walkFrames: 8, threatFrames: 4, lungeFrames: 4,
    shadow: { rx: 12, ry: 4.4, alpha: 0.28 },
    aura: { kind: 'glint', color: '#a0d8f0', rate: 0.05, night: false },
    paint(P, f, mode) {
      const base = '#5a7a9c', lite = '#b8e6f8', glow = '#8AA4FF', deepc = '#2e4460', ink = '#0a1220';
      const th = mode === 'threat' || mode === 'lunge', lu = mode === 'lunge';
      // angular leg shards
      [[12, 0], [20, 1]].forEach(([x, i]) => {
        const g = mode === 'walk' ? stride(f, i, { amp: 2, lift: 3, order: [0, 0.5] }) : { dx: 0, dy: 0 };
        P.poly([[x - 1, 30], [x + 3, 30], [x + 2 + g.dx, 38 + g.dy], [x + g.dx, 38 + g.dy]], tone(base, -0.2));
        P.p(x + 1 + g.dx, 39 + g.dy, ink); P.p(x + 2 + g.dx, 39 + g.dy, tone(deepc, -0.2));
      });
      // central prism with hard facet planes
      P.poly([[17, 2], [27, 14], [24, 32], [10, 32], [7, 14]], base);
      P.poly([[17, 2], [7, 14], [10, 32], [16, 30], [15, 12]], tone(lite, -0.12)); // lit plane
      P.poly([[17, 2], [27, 14], [24, 32], [19, 30], [18, 12]], tone(deepc, -0.05)); // shaded plane
      P.line(17, 2, 17, 31, tone(deepc, 0.1)); // fracture seam
      P.line(15, 12, 7, 14, tone(lite, 0.15)); P.line(18, 12, 27, 14, tone(deepc, -0.2));
      // apex + refracted core pulse
      P.p(17, 1, '#f2fbff'); P.p(16, 3, tone(lite, 0.3));
      const pulse = [[15, 16], [17, 20], [19, 14], [15, 24], [18, 26], [16, 12]][f % 6];
      P.glow(pulse[0], pulse[1], glow, 0.45);
      P.r(15, 17, 3, 6, mixc(base, glow, th ? 0.7 : 0.45)); P.p(16, 19, tone(glow, 0.3));
      // razor edges in threat: shards angle outward
      const sp = lu ? 5 : th ? 3 : 0;
      P.poly([[7, 14], [1 - sp, 10 - sp], [9, 18]], mixc(base, lite, 0.5)); P.poly([[27, 14], [33 + sp, 10 - sp], [25, 18]], mixc(base, deepc, 0.4));
      // twin satellite shards (orbit)
      const o1 = [[29, 8], [31, 12], [29, 16], [27, 14], [26, 10], [28, 6]][f % 6];
      const o2 = [[4, 22], [2, 18], [3, 14], [5, 16], [6, 20], [5, 24]][f % 6];
      P.poly([[o1[0], o1[1]], [o1[0] + 3, o1[1] + 2], [o1[0] + 1, o1[1] + 6]], mixc(base, lite, 0.55)); P.p(o1[0] + 1, o1[1], tone(lite, 0.3));
      P.poly([[o2[0], o2[1]], [o2[0] + 3, o2[1] + 1], [o2[0] + 1, o2[1] + 5]], mixc(base, deepc, 0.5)); P.p(o2[0] + 1, o2[1], tone(lite, 0.1));
      // "eye" facets: a pair of bright refracting points
      P.eye(19, 9, 2, 2, th ? '#ffffff' : '#dff4ff', { glint: false, pupil: mixc(glow, ink, 0.5) });
      P.rim(tone(lite, 0.2), 0.4);
    },
  },

  // 8) MOSS WARDEN — walking ecosystem colossus; bark armour, moss canopy, ember-green eyes
  mosswarden: {
    w: 72, h: 62, scale: 1, idleFrames: 6, walkFrames: 8, threatFrames: 4, lungeFrames: 4, pace: 1.5,
    shadow: { rx: 30, ry: 9.5, alpha: 0.4 },
    aura: { kind: 'spore', color: '#6EF3C5', rate: 0.05, night: true },
    paint(P, f, mode) {
      const hide = '#3f6446', moss = '#6d9452', glow = '#6EF3C5', bark = '#4b4234', ink = '#0b120c';
      const th = mode === 'threat' || mode === 'lunge', lu = mode === 'lunge';
      const gp = mode === 'idle' ? breathe(f) : 0;
      // bark pillar limbs with root toes
      [[16, 44], [30, 46], [44, 46], [56, 44]].forEach(([x, y], i) => {
        const g = mode === 'walk' ? stride(f, i, { amp: 2, lift: 2, order: [0, 0.5, 0.25, 0.75] }) : { dx: 0, dy: 0 };
        const far = i === 0 || i === 2;
        P.slab(x + g.dx, y + g.dy, 9, 61 - y - g.dy, tone(bark, far ? -0.28 : -0.08), { tex: 1 });
        P.vl(x + 1 + g.dx, y + g.dy, 61 - y - g.dy, tone(bark, far ? -0.1 : 0.16)); // bark ridge
        P.line(x - 2 + g.dx, 60, x + g.dx, 58, tone(bark, -0.3)); P.line(x + 10 + g.dx, 60, x + 8 + g.dx, 58, tone(bark, -0.35)); // root toes
      });
      // colossal body with growth pulse
      P.band(36, 32 - gp * 0.5, 29, 15 + gp, hide, { tex: 1 });
      plates(P, 18, 30, 30, 12, tone(bark, 0.02), 6);
      // moss canopy layers (hard-edged clumps)
      P.band(30, 19, 22, 7, moss, { tex: 1 });
      P.band(46, 17, 13, 5.5, tone(moss, 0.1), { tex: 1 });
      P.band(20, 16, 9, 4.4, tone(moss, -0.06), { tex: 1 });
      P.dither(14, 12, 44, 8, tone(moss, 0.3), 0.08, 6);
      // canopy fronds (sway; bristle upright in threat)
      const vs = th ? 2 : (mode === 'idle' ? [0, 1, 1, 0, 0, 1][f] : 0);
      for (let i = 0; i < 9; i++) P.spike(16 + i * 5, 14 - (i % 3), 4 + (i % 2) + vs, tone(moss, 0.2), (i - 4) * 0.12, 1);
      // spore lights along flank (pulse; flare in threat)
      [[22, 28], [36, 36], [50, 28], [58, 34], [28, 40]].forEach(([x, y], i) => {
        if ((i + f) % 3 !== 0 && !th) P.p(x, y, tone(glow, -0.3));
        else P.glow(x, y, glow, 0.35);
      });
      // low head ridge: heavy brow, glowing eyes, bark jaw
      const hd = lu ? -4 : th ? -2 : (mode === 'idle' && f >= 3 ? 1 : 0);
      P.poly([[58, 26 + hd], [70, 28 + hd], [71, 36 + hd], [64, 40 + hd], [58, 38 + hd]], tone(hide, 0.08));
      P.line(60, 27 + hd, 68, 27 + hd, tone(bark, -0.2)); // brow ridge
      P.eye(63, 30 + hd, 3, 2, glow, { glint: true, pupil: ink, slit: th });
      P.eye(68, 31 + hd, 2, 2, tone(glow, -0.15), { glint: false, pupil: ink });
      P.line(64, 38 + hd, 70, 37 + hd, ink); // mouth seam
      if (th) { P.r(65, 38 + hd, 5, 2, '#1c2a1c'); P.p(66, 38 + hd, W); P.p(68, 38 + hd, W); } // bark teeth
      // dragging root tail
      tail(P, 8, 36, 1, 44, tone(bark, -0.05), { thick: 5, segs: 5 });
      P.dither(2, 44, 10, 3, tone(moss, -0.2), 0.3, 8);
      P.rim(tone(glow, -0.2), 0.3);
    },
  },
};
