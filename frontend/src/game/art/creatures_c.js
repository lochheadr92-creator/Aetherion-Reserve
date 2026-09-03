// ---- Creature pixel painters C (Phase G rework: Tier 4 apex-class) ----
// nyxarr, zephyrmaw, aurox, sylvarr
// Painted FACING RIGHT at scale 1 (1 art px = 1 device px). Ground = bottom row.
// Key light upper-left, hard cel bands, opaque ink outline. Modes: idle (6),
// walk (8-frame gait), threat (4), lunge (4; baker adds whole-body kinematics).
// Eyes go through P.eye() so blink frames and night eye-glow are exact.
import { tone, mixc, breathe, stride, bobc } from './pixel';
import { legs, tail, jaw, plates, stripes } from './rig';

const W = '#f4f1ea'; // bone / tooth white

// ray-finger wing: shoulder (sx, sy), spread 0 (folded along the back) .. 1 (mantling, fully fanned)
function wing(P, sx, sy, spread, memb, finger, tipC, { n = 6, len = 26, far = false } = {}) {
  const tips = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const aFold = Math.PI * (1.1 + t * 0.1);            // bundled, swept back and up along the spine
    const aSpread = Math.PI * (1.1 + t * 0.52);         // fan from back-up to almost straight up
    const a = aFold + (aSpread - aFold) * spread;
    const L = len * (0.55 + 0.45 * spread) * (0.7 + t * 0.3);
    tips.push([sx + Math.cos(a) * L, sy + Math.sin(a) * L * 0.8]);
  }
  for (let i = 0; i + 1 < n; i++) P.poly([[sx, sy], tips[i], tips[i + 1]], i % 2 ? memb : tone(memb, far ? -0.06 : 0.08));
  tips.forEach(([tx, ty], i) => {
    P.line(sx, sy, tx, ty, i === n - 1 ? tone(finger, 0.15) : finger, 1);
    P.p(tx, ty, tipC);
  });
  return tips;
}

export const CREATURES_C = {
  // 16) NYXARR SOVEREIGN — titan apex predator; horn crown, blade spine, jaw engine, crimson war-stripes
  nyxarr: {
    w: 88, h: 60, scale: 1, idleFrames: 6, walkFrames: 8, threatFrames: 4, lungeFrames: 4, menace: '#ff3b57', pace: 1.2,
    shadow: { rx: 34, ry: 10, alpha: 0.44 },
    aura: { kind: 'wisp', color: '#b98ae0', rate: 0.02, night: true },
    paint(P, f, mode) {
      const body = '#3a2640', plate = '#241a2e', acc = '#ff5c7a', glow = '#b98ae0', claw = '#e8dcd0', ink = '#0a060d';
      const th = mode === 'threat' || mode === 'lunge', lu = mode === 'lunge';
      const br = mode === 'idle' ? breathe(f) : 0;
      const bob = mode === 'walk' ? bobc(f, 2) : 0;
      const open = lu ? 10 : th ? 8 : (mode === 'idle' ? [1, 1, 2, 3, 2, 1][f] : 2);
      const hipsFar = [[22, 38], [46, 38]], hipsNear = [[30, 40], [56, 38]];
      const g = { amp: 4, lift: 3, order: [0, 0.5], thick: 5, shinThick: 4, claws: 3, clawColor: claw, foot: '#1a1020' };
      legs(P, { hips: hipsFar, ground: 59, f, mode, color: body, far: true, kneeBias: -3, ...g });
      // haunch + hunched shoulder mass (shoulders tower over the pelvis)
      P.band(26, 32 + bob, 14, 10 + br * 0.4, tone(body, -0.05), { tex: 1 });
      P.band(50, 27 + bob, 17, 12 + br * 0.5, body, { tex: 1 });
      P.band(40, 36 + bob, 20, 4, tone(body, 0.1), { spec: false, steps: [0.14, 0.05, -0.06, -0.18] });
      // muscle definition + crimson war-stripes
      P.line(34, 24 + bob, 58, 19 + bob, tone(body, -0.3)); P.line(16, 32 + bob, 28, 27 + bob, tone(body, -0.26));
      stripes(P, 42, 22 + bob, 16, 10, tone(acc, -0.45), 5, 1);
      stripes(P, 18, 30 + bob, 10, 6, tone(acc, -0.5), 5, 1);
      legs(P, { hips: hipsNear, ground: 59, f: th ? 0 : f, mode: th ? 'idle' : mode, color: body, kneeBias: 3, ...g });
      if (th) { // threat: near foreleg lifted, claws splayed
        P.line(56, 38, 62, 46, tone(body, 0.02), 4); P.line(62, 46, 66 + (lu ? 4 : 0), 52, tone(body, -0.08), 3);
        for (let k = 0; k < 3; k++) P.claw(67 + (lu ? 4 : 0) + k * 2, 53 + (k % 2), 1, claw, 3);
      }
      // dorsal blade spines (violet-tipped; raise in threat)
      const rz = th ? 3 : (mode === 'idle' && f === 3 ? 1 : 0);
      [[14, 26], [21, 22], [28, 19], [35, 17], [42, 15], [49, 14], [56, 14]].forEach(([x, y], i) => {
        const hgt = 6 + (i % 2) * 2 + rz;
        P.spike(x, y + bob, hgt, plate, -0.6, 3);
        P.p(x - Math.round(0.6 * hgt), y + bob - hgt, (i + f) % 3 === 0 ? tone(glow, -0.05) : tone(plate, 0.3));
      });
      // neck: one thick tapered mass to a regal (or lowered, hunting) skull
      const hx = lu ? 76 : th ? 74 : 68, hy = lu ? 16 : th ? 13 : 4 + (mode === 'idle' ? [0, 0, 1, 2, 1, 0][f] : 0);
      P.poly([[54, 20 + bob], [64, 14 + bob], [hx + 2, hy + 6], [hx - 8, hy + 14]], tone(body, 0.02));
      P.poly([[58, 19 + bob], [64, 15 + bob], [hx, hy + 7], [hx - 6, hy + 12]], tone(body, 0.14));
      if ((f + 1) % 3 === 0 || th) P.glow(hx - 6, hy + 13, glow, 0.3); else P.p(hx - 6, hy + 13, tone(glow, -0.35)); // throat bud
      // skull: heavy brow plate over an angular wedge
      P.poly([[hx - 10, hy + 2], [hx + 6, hy - 1], [hx + 16, hy + 6], [hx + 14, hy + 10], [hx - 8, hy + 10]], tone(body, 0.16));
      P.poly([[hx - 8, hy + 1], [hx + 6, hy - 1], [hx + 10, hy + 3], [hx - 6, hy + 4]], tone(plate, 0.1));
      P.hl(hx - 6, hy + 4, 16, tone(plate, 0.3));
      // crown of swept horns
      P.spike(hx - 4, hy + 1, 9 + (th ? 2 : 0), plate, -1.0, 3);
      P.spike(hx, hy, 11 + (th ? 2 : 0), tone(plate, 0.06), -0.9, 3);
      P.spike(hx + 4, hy, 8, tone(plate, -0.05), -0.8, 2);
      // jaw engine: overbuilt lower jaw, five fangs a side, lower teeth row
      jaw(P, { x: hx - 4, y: hy + 9, w: 20, h: 5, color: tone(body, 0.08), open, fangs: 5, fangLen: 4, gum: '#4a0c1c', tongue: open > 3 ? '#8a2438' : null, lip: tone(acc, -0.55) });
      P.slab(hx + 1, hy + 14 + open, 15, 4, tone(body, -0.14)); P.hl(hx + 1, hy + 14 + open, 15, tone(acc, -0.5));
      for (let k = 0; k < 5; k++) P.p(hx + 3 + k * 3, hy + 13 + open, W);
      P.p(hx + 14, hy + 7, tone(body, -0.35)); // nostril
      // crimson slit eyes + rear eye; scowling brow
      P.eye(hx + 4, hy + 5, 4, 3, th ? '#ffd6dc' : '#ff9eae', { glint: true, pupil: '#3a0010', slit: true, sclera: acc });
      P.eye(hx - 2, hy + 6, 2, 2, tone(acc, 0.15), { glint: false, pupil: ink, slit: true });
      P.line(hx + 1, hy + 4, hx + 10, hy + 4, ink);
      if (th) { P.glow(hx + 5, hy + 6, acc, 0.5); }
      // armoured tail with blade tip
      const ts = mode === 'walk' ? (f % 4 < 2 ? 1 : -1) : (mode === 'idle' ? [0, 1, 1, 0, -1, -1][f] : 0);
      tail(P, 14, 32 + bob, 1, 24 + bob + ts, body, { thick: 5, segs: 8 });
      P.spike(3, 25 + bob + ts, 6, plate, -0.4, 2); P.spike(6, 27 + bob + ts, 3, tone(plate, -0.1), -0.5, 1);
      P.rim(tone(glow, -0.1), 0.3);
    },
  },

  // 17) ZEPHYRMAW SKYRENDER — aerial apex; ray-finger wings, spear beak, needle teeth, storm crest
  zephyrmaw: {
    w: 82, h: 60, scale: 1, idleFrames: 6, walkFrames: 8, threatFrames: 4, lungeFrames: 4, menace: '#9fb8ff', pace: 0.9,
    shadow: { rx: 22, ry: 6, alpha: 0.3, soft: true },
    aura: { kind: 'spark', color: '#8AA4FF', rate: 0.015, night: true },
    paint(P, f, mode) {
      const body = '#31404f', memb = '#22303c', acc = '#8AA4FF', talon = '#d8dde8', ink = '#0b1017';
      const th = mode === 'threat' || mode === 'lunge', lu = mode === 'lunge';
      const br = mode === 'idle' ? breathe(f) : 0;
      // wing spread: flap on walk, mantling display in threat, ruffle when idle
      const spread = th ? (lu ? 1 : 0.9) : mode === 'walk' ? 0.5 - 0.5 * Math.cos((f / 8) * Math.PI * 2) : (mode === 'idle' ? [0, 0, 0.08, 0.12, 0.06, 0][f] : 0);
      const bob = mode === 'walk' ? -Math.round(spread * 2) : 0;
      const open = lu ? 6 : th ? 4 : (mode === 'idle' && f === 4 ? 1 : 0);
      // far wing (behind the body, darker)
      wing(P, 38, 28 + bob, spread, tone(memb, -0.2), tone(body, -0.3), tone(acc, -0.4), { len: 30, far: true });
      // taloned legs (raptor crouch)
      const hips = [[30, 42], [42, 42]];
      hips.forEach(([hx, hy], i) => {
        const g = mode === 'walk' ? stride(f, i, { amp: 3, lift: 3, order: [0, 0.5] }) : { dx: 0, dy: 0 };
        P.line(hx, hy + bob, hx - 2 + g.dx, 52 + g.dy, tone(body, -0.22), 3);
        P.line(hx - 2 + g.dx, 52 + g.dy, hx + 1 + g.dx, 58 + g.dy, tone(body, -0.32), 2);
        P.r(hx - 3 + g.dx, 58 + g.dy, 8, 1, tone(body, -0.45));
        P.claw(hx - 4 + g.dx, 58 + g.dy, -1, talon, 2); P.claw(hx + 5 + g.dx, 58 + g.dy, 1, talon, 2); P.p(hx + 1 + g.dx, 59 + g.dy, talon);
      });
      // streamlined raptor body + chest keel
      P.band(38, 36 + bob, 17, 9 + br * 0.4, body, { tex: 1 });
      P.band(46, 33 + bob, 8, 6, tone(body, 0.06));
      P.band(38, 40 + bob, 11, 3, tone(body, 0.12), { spec: false, steps: [0.16, 0.06, -0.06, -0.16] });
      P.line(30, 30 + bob, 46, 27 + bob, tone(body, -0.3)); // back line
      // near wing (in front)
      const tips = wing(P, 32, 30 + bob, spread, memb, mixc(body, acc, 0.4), (f % 3 === 0 || th) ? tone(acc, 0.15) : tone(acc, -0.3), { len: 32 });
      if (th) tips.forEach(([tx, ty]) => P.glow(tx, ty, acc, 0.3)); // storm-charged fingertips when mantling
      // long neck to the spear-beak skull (drives forward in threat / lunge)
      const hx = lu ? 66 : th ? 63 : 60, hy = lu ? 20 : th ? 16 : 12 + (mode === 'idle' ? [0, 0, 1, 1, 0, 0][f] : 0);
      P.poly([[46, 30 + bob], [52, 24 + bob], [hx - 2, hy + 4], [hx - 8, hy + 10]], tone(body, 0.02));
      P.poly([[48, 29 + bob], [52, 25 + bob], [hx - 3, hy + 5], [hx - 6, hy + 8]], tone(body, 0.14));
      P.poly([[hx - 8, hy + 2], [hx + 2, hy], [hx + 8, hy + 4], [hx + 5, hy + 9], [hx - 6, hy + 9]], tone(body, 0.16)); // skull
      // spear beak: long, hooked, with needle teeth (open in threat)
      P.poly([[hx + 4, hy + 3], [hx + 20, hy + 5], [hx + 19, hy + 7], [hx + 5, hy + 7]], tone(acc, -0.45));
      P.hl(hx + 5, hy + 3, 14, tone(acc, -0.25)); P.p(hx + 20, hy + 6, tone(acc, -0.6)); P.p(hx + 19, hy + 7, ink);
      P.poly([[hx + 4, hy + 7 + open], [hx + 17, hy + 8 + open], [hx + 15, hy + 10 + open], [hx + 4, hy + 10 + open]], tone(acc, -0.55)); // lower mandible
      if (open) {
        P.r(hx + 6, hy + 7, 11, open, '#2a1230');
        for (let k = 0; k < 4; k++) { P.p(hx + 7 + k * 3, hy + 7, W); P.p(hx + 8 + k * 3, hy + 6 + open, W); }
      } else { P.p(hx + 8, hy + 7, W); P.p(hx + 13, hy + 7, W); }
      // sharp eye + hunting brow
      P.eye(hx - 1, hy + 3, 3, 2, th ? '#ffffff' : '#e6eeff', { glint: true, pupil: ink });
      P.line(hx - 3, hy + 2, hx + 3, hy + 2, ink);
      // storm crest: back-swept blades with a charged tip
      P.spike(hx - 4, hy + 1, 8 + (th ? 3 : 0), mixc(body, acc, 0.5), -0.9, 3);
      P.spike(hx, hy, 6 + (th ? 2 : 0), mixc(body, acc, 0.35), -0.7, 2);
      P.glow(hx - 4 - Math.round(0.9 * (8 + (th ? 3 : 0))), hy + 1 - (8 + (th ? 3 : 0)), acc, th ? 0.5 : 0.3);
      // rudder tail with membrane flag
      const ts = mode === 'walk' ? (f % 4 < 2 ? 1 : -1) : 0;
      tail(P, 24, 36 + bob, 8, 42 + bob + ts, body, { thick: 3, segs: 5 });
      P.poly([[8, 42 + bob + ts], [2, 36 + bob + ts], [4, 46 + bob + ts]], memb); P.line(8, 42 + bob + ts, 2, 36 + bob + ts, mixc(body, acc, 0.4));
      P.rim(tone(acc, -0.1), 0.35);
    },
  },

  // 18) AUROX TITANHORN — colossal armoured grazer; crescent horns, plated hump, pillar legs, amber pips
  aurox: {
    w: 92, h: 64, scale: 1, idleFrames: 6, walkFrames: 8, threatFrames: 4, lungeFrames: 4, pace: 1.4,
    shadow: { rx: 38, ry: 11, alpha: 0.42 },
    paint(P, f, mode) {
      const body = '#4f463b', armor = '#66594a', horn = '#e2d6c2', glow = '#f2c14e', mud = '#3a3129', ink = '#14100c';
      const th = mode === 'threat' || mode === 'lunge', lu = mode === 'lunge';
      const br = mode === 'idle' ? breathe(f) : 0;
      const bob = mode === 'walk' ? bobc(f, 1) : 0;
      // pillar legs (dust-stained); front legs brace wide in threat
      [[14, 42], [30, 44], [54, 44], [70, 42]].forEach(([x, y], i) => {
        const g = mode === 'walk' ? stride(f, i, { amp: 3, lift: 2, order: [0, 0.5, 0.25, 0.75] }) : { dx: th && i === 3 ? 3 : 0, dy: 0 };
        const far = i === 0 || i === 2;
        P.slab(x + g.dx, y + g.dy + bob, 10, 63 - y - g.dy - bob, tone(body, far ? -0.3 : -0.1), { tex: 1 });
        P.vl(x + g.dx, y + g.dy + bob, 63 - y - g.dy - bob, tone(body, far ? -0.15 : 0.1));
        P.r(x + g.dx, 57, 10, 6, mud); P.hl(x + g.dx, 57, 10, tone(mud, 0.2));
        P.r(x - 1 + g.dx, 62, 12, 1, tone(mud, -0.35));
        P.p(x + 2 + g.dx, 63 - 1, tone(horn, -0.3)); P.p(x + 7 + g.dx, 62, tone(horn, -0.35)); // hoof toes
      });
      // colossal body (deep breath) + belly
      P.band(42, 32 + bob - br * 0.4, 31, 15 + br, body, { tex: 1 });
      P.band(40, 40 + bob, 26, 6, tone(body, -0.06), { spec: false, steps: [0.1, 0.02, -0.08, -0.2] });
      // hide creases + muscle
      P.line(18, 30 + bob, 34, 28 + bob, tone(body, -0.26)); P.line(30, 38 + bob, 52, 36 + bob, tone(body, -0.22)); P.line(56, 26 + bob, 70, 30 + bob, tone(body, -0.24));
      P.line(60, 34 + bob, 72, 40 + bob, tone(body, -0.3)); // shoulder crease
      // armoured hump: plated shell with striated scutes
      P.band(38, 20 + bob, 24, 7, armor, { tex: 1 });
      plates(P, 18, 16 + bob, 40, 10, tone(armor, 0.02), 6);
      P.hl(14, 26 + bob, 48, tone(body, -0.32)); // hump/hide seam
      for (let i = 0; i < 7; i++) { // back ridge scutes
        P.poly([[18 + i * 6, 15 + bob], [24 + i * 6, 15 + bob], [22 + i * 6, 11 + bob - (i === 3 ? 1 : 0)], [19 + i * 6, 12 + bob]], tone(armor, -0.1));
        P.p(21 + i * 6, 12 + bob, tone(horn, -0.3));
      }
      // amber signal pips (slow pulse; blaze in threat)
      [[24, 34], [34, 30], [48, 34], [58, 30], [40, 38]].forEach(([x, y], i) => {
        if (th || (i + f) % 3 === 0) P.glow(x, y + bob, glow, 0.3); else P.p(x, y + bob, tone(glow, -0.45));
      });
      // heavy head: lowered charge posture in threat / lunge, graze sway when idle
      const hd = lu ? 9 : th ? 6 : (mode === 'idle' ? [0, 0, 1, 2, 1, 0][f] : 0);
      const hx = lu ? 78 : 74, hy = 24 + hd + bob;
      P.poly([[66, hy - 2], [hx + 4, hy - 4], [hx + 14, hy + 4], [hx + 12, hy + 16], [hx + 2, hy + 20], [66, hy + 14]], tone(body, 0.08));
      P.poly([[hx + 4, hy + 8], [hx + 14, hy + 8], [hx + 15, hy + 16], [hx + 6, hy + 19]], tone(body, -0.04)); // broad muzzle
      P.p(hx + 13, hy + 12, tone(mud, -0.2)); P.line(hx + 6, hy + 18, hx + 14, hy + 17, ink); // nostril, mouth
      if (th) { P.r(hx + 8, hy + 18, 5, 2, '#2a1418'); P.p(hx + 9, hy + 18, W); P.p(hx + 12, hy + 18, W); } // bellowing
      P.poly([[66, hy + 12], [70, hy + 20], [64, hy + 22]], tone(body, -0.14)); // dewlap
      // brow boss + eyes
      P.r(hx - 2, hy - 2, 12, 3, armor); P.hl(hx - 2, hy - 2, 12, tone(armor, 0.3));
      P.eye(hx + 2, hy + 2, 3, 2, th ? '#fff3d0' : '#e8e4d8', { glint: true, pupil: ink });
      P.line(hx, hy + 1, hx + 6, hy + 1, tone(body, -0.45)); // brow shadow
      // massive crescent horns (forward-sweeping)
      P.spike(hx + 6, hy - 3, 14 + (th ? 2 : 0), horn, 0.75, 4);
      P.spike(hx, hy - 2, 11, tone(horn, -0.14), 0.7, 3);
      P.line(hx - 1, hy - 1, hx + 9, hy - 2, tone(horn, -0.4)); // horn boss shadow
      // ears + tufted tail
      P.spike(hx - 4, hy - 2, 3, tone(body, 0.1), -0.8, 2);
      const tw = mode === 'idle' ? [0, 1, 1, 0, 0, -1][f] : (mode === 'walk' ? (f % 4 < 2 ? 1 : 0) : 0);
      tail(P, 12, 30 + bob, 3, 44 + bob + tw, body, { thick: 4, segs: 6 });
      P.r(1, 44 + bob + tw, 4, 4, mud); P.p(2, 48 + bob + tw, tone(glow, -0.4));
      P.rim(tone(horn, -0.2), 0.3);
    },
  },

  // 19) SYLVARR CROWNSPIRE — bioluminescent canopy colossus; spire neck, frond crown, bark saddle
  sylvarr: {
    w: 70, h: 96, scale: 1, idleFrames: 6, walkFrames: 8, threatFrames: 4, lungeFrames: 4, pace: 1.3,
    shadow: { rx: 24, ry: 8, alpha: 0.36 },
    aura: { kind: 'spore', color: '#6EF3C5', rate: 0.03, night: true },
    paint(P, f, mode) {
      const body = '#3c5548', belly = '#517263', glow = '#6EF3C5', bark = '#4b4234', ink = '#0b120d';
      const th = mode === 'threat' || mode === 'lunge', lu = mode === 'lunge';
      const br = mode === 'idle' ? breathe(f) : 0;
      const bob = mode === 'walk' ? bobc(f, 2) : 0;
      const hipsFar = [[18, 68], [38, 68]], hipsNear = [[26, 70], [46, 68]];
      const g = { amp: 3, lift: 3, order: [0, 0.5], thick: 5, shinThick: 4, foot: tone(bark, -0.2) };
      legs(P, { hips: hipsFar, ground: 95, f, mode, color: body, far: true, kneeBias: -3, ...g });
      // barrel body with chest mass
      P.band(32, 59 + bob, 21, 13 + br * 0.5, body, { tex: 1 });
      P.band(42, 56 + bob, 10, 8, tone(body, 0.06));
      P.band(30, 66 + bob, 14, 4, belly, { spec: false, steps: [0.2, 0.08, -0.06, -0.18] });
      P.line(20, 52 + bob, 40, 49 + bob, tone(body, -0.28)); P.line(36, 62 + bob, 48, 58 + bob, tone(body, -0.24)); // muscle lines
      legs(P, { hips: hipsNear, ground: 95, f: th ? 0 : f, mode: th ? 'idle' : mode, color: body, kneeBias: 3, ...g });
      if (th) { P.line(46, 68, 54 + (lu ? 4 : 0), 80, tone(body, 0.02), 4); P.line(54 + (lu ? 4 : 0), 80, 52 + (lu ? 6 : 0), 92, tone(body, -0.1), 3); P.r(50 + (lu ? 6 : 0), 92, 6, 2, tone(bark, -0.2)); } // rearing foreleg
      // bark saddle plates along the back
      plates(P, 18, 48 + bob, 28, 8, bark, 5);
      P.hl(16, 56 + bob, 30, tone(body, -0.32));
      // spire neck: long tapered curve rising right (graze dip idle; tall + forward in threat; whip in lunge)
      const dip = mode === 'idle' ? [0, 0, 2, 4, 2, 0][f] : 0;
      const hx = lu ? 66 : th ? 62 : 56, hy = lu ? 22 : th ? 4 : 10 + dip;
      const n = 12;
      let px0 = 46, py0 = 50 + bob;
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const cx = px0 + (hx - px0) * t + Math.sin(t * Math.PI) * (lu ? 6 : 3);
        const cy = py0 + (hy + 6 - py0) * t;
        const w = Math.max(3, Math.round(8 - t * 4));
        P.r(Math.round(cx - w / 2), Math.round(cy - 2), w, 4, i % 3 ? body : tone(body, 0.07));
        P.p(Math.round(cx - w / 2), Math.round(cy - 2), tone(body, 0.2)); // lit edge
        P.p(Math.round(cx + w / 2 - 1), Math.round(cy + 1), tone(body, -0.3)); // shaded edge
        if (i % 2 === 0) P.p(Math.round(cx + w / 2), Math.round(cy), tone(belly, -0.05)); // throat ridge
        // luminous signal spots (slow sequence pulse; all lit in threat)
        if (i % 3 === 1) { if (th || (i / 3 + f) % 4 < 1) P.glow(Math.round(cx), Math.round(cy), glow, 0.32); else P.p(Math.round(cx), Math.round(cy), tone(glow, -0.35)); }
      }
      // head: assertive wedge with heavy brow, soft muzzle
      P.poly([[hx - 6, hy + 2], [hx + 4, hy], [hx + 10, hy + 4], [hx + 8, hy + 9], [hx - 4, hy + 10]], tone(body, 0.14));
      P.poly([[hx + 3, hy + 4], [hx + 10, hy + 5], [hx + 8, hy + 9], [hx + 2, hy + 9]], tone(belly, 0.06)); // muzzle
      P.line(hx + 3, hy + 9, hx + 8, hy + 9, tone(body, -0.45)); P.p(hx + 9, hy + 6, tone(body, -0.3));
      if (th) { P.r(hx + 4, hy + 9, 4, 2, '#1c2a24'); P.p(hx + 5, hy + 9, W); } // trumpeting call
      P.line(hx - 3, hy + 3, hx + 3, hy + 3, tone(body, -0.4)); // brow
      P.eye(hx, hy + 4, 3, 2, th ? '#ffffff' : '#e9fff6', { glint: true, pupil: ink });
      // frond crown: fans wide in threat, sways idle
      const sw = mode === 'idle' ? [0, 1, 1, 0, -1, -1][f] : (mode === 'walk' ? (f % 4 < 2 ? 1 : 0) : 0);
      const fan = th ? 3 : 0;
      for (let i = 0; i < 7; i++) {
        const lean = (i - 3) * (0.35 + fan * 0.15) + sw * 0.15;
        P.spike(hx - 4 + i * 1.6, hy + 1, 6 + (i % 2) + fan, i % 2 ? tone(body, 0.22) : tone(body, 0.12), lean, 1);
        if (i % 2 === 0) P.glow(Math.round(hx - 4 + i * 1.6 + lean * (6 + fan)), hy - 6 - fan, glow, th ? 0.4 : 0.25);
      }
      // counterbalance tail sweeping down-left
      tail(P, 14, 62 + bob, 1, 80 + bob, body, { thick: 5, segs: 8, sway: mode === 'walk' ? (f % 4 < 2 ? 1 : -1) : 0 });
      P.p(1, 82 + bob, tone(glow, -0.2));
      P.rim(tone(glow, -0.3), 0.3);
    },
  },
};
