// ---- Creature pixel painters B (Phase G rework: crisp, angular, expressive) ----
// rhoak, vantha, karrgan, lumen, umbra, voltari, emberoot
// Painted FACING RIGHT at scale 1 (1 art px = 1 device px). Ground = bottom row.
// Predators: fanged jaws, slit eyes, hackles, hunched prowl; threat mode = jaws open.
import { tone, mixc, breathe, stride } from './pixel';
import { legs, tail, ridge, jaw, plates, stripes } from './rig';

const W = '#f4f1ea';

export const CREATURES_B = {
  // 9) ASHMANE RHOAK — territorial ram-strider; horn crown, ash-filament mane, ember tips
  rhoak: {
    w: 56, h: 44, scale: 1, idleFrames: 6, walkFrames: 8, threatFrames: 4, lungeFrames: 4,
    shadow: { rx: 20, ry: 6.5, alpha: 0.34 },
    aura: { kind: 'ember', color: '#ff8a4c', rate: 0.02, night: false },
    paint(P, f, mode) {
      const body = '#5c3a33', ash = '#8a7a78', ember = '#ff8a4c', horn = '#d9cfbf', ink = '#160c0a';
      const th = mode === 'threat' || mode === 'lunge', lu = mode === 'lunge';
      const br = mode === 'idle' ? breathe(f) : 0;
      const hips = [[14, 26], [22, 27], [34, 27], [42, 26]];
      const g = { amp: 3, lift: 3, order: [0, 0.5, 0.25, 0.75], thick: 3, foot: '#2a1a16' };
      legs(P, { hips: hips.slice(0, 2), ground: 43, f, mode, color: body, far: true, kneeBias: -1, ...g });
      // deep-chested body
      P.band(20, 22, 10, 8 + br * 0.3, tone(body, -0.05), { tex: 1 });
      P.band(33, 20, 13, 9 + br * 0.4, body, { tex: 1 });
      P.band(28, 26, 14, 3.5, tone(body, 0.12), { spec: false, steps: [0.16, 0.06, -0.06, -0.18] });
      stripes(P, 26, 17, 12, 7, tone(ash, -0.45), 5, 1);
      legs(P, { hips: hips.slice(2), ground: 43, f: th ? 0 : f, mode: th ? 'idle' : mode, color: body, kneeBias: 1, ...g });
      if (th) { P.r(42, 27, 3, 12, tone(body, 0.02)); P.r(44, 38, 4, 2, '#2a1a16'); } // pawing front leg
      // ash mane: layered filaments along neck/back with ember tips (bristles in threat)
      const rz = th ? 3 : (mode === 'idle' ? [0, 1, 1, 0, 0, 0][f] : 0);
      for (let i = 0; i < 10; i++) {
        const x = 22 + i * 2.4, y = 13 + Math.round(Math.sin(i * 0.5) * 1.5);
        P.spike(Math.round(x), y, 5 + (i % 3) + rz, i % 2 ? ash : tone(ash, -0.15), -0.35 + (i > 6 ? 0.3 : 0), 2);
        if (i % 3 === 0) P.glow(Math.round(x), y - 5 - (i % 3) - rz, ember, 0.35);
      }
      // thick neck + ram skull with horn crown (head drops to charge in threat)
      const hd = lu ? 6 : th ? 4 : (mode === 'idle' && f >= 3 ? 1 : 0);
      P.poly([[40, 14 + hd], [46, 12 + hd], [52, 16 + hd], [50, 24 + hd], [42, 24 + hd]], tone(body, 0.06));
      P.poly([[44, 12 + hd], [54, 14 + hd], [56, 20 + hd], [52, 27 + hd], [45, 25 + hd]], tone(body, 0.16)); // skull
      P.poly([[50, 20 + hd], [56, 21 + hd], [55, 27 + hd], [50, 27 + hd]], tone(body, 0.02)); // muzzle
      P.line(51, 27 + hd, 55, 27 + hd, ink); P.p(55, 23 + hd, tone(body, -0.3)); // mouth, nostril
      if (th) { P.r(51, 27 + hd, 4, 2, '#3a1018'); P.p(52, 27 + hd, W); P.p(54, 27 + hd, W); } // snarl
      // horn crown: twin curled horns sweeping back + brow spikes
      P.spike(46, 12 + hd, 8, horn, -0.8, 3); P.spike(49, 12 + hd, 6, tone(horn, -0.12), -0.7, 2);
      P.spike(44, 13 + hd, 4, tone(horn, -0.2), -0.9, 2);
      P.line(47, 16 + hd, 53, 15 + hd, tone(body, -0.45)); // furious brow
      P.eye(50, 17 + hd, 3, 2, th ? '#ffd27a' : '#f5d9a0', { glint: true, pupil: ink });
      // tail whip with ember tuft
      tail(P, 10, 20, 2, 12, body, { thick: 3, segs: 6, sway: mode === 'walk' ? (f % 2 ? 1 : -1) : 0 });
      P.glow(2, 11, ember, 0.4); P.p(3, 12, tone(ember, -0.2));
      P.rim(tone(ash, 0.25), 0.3);
    },
  },

  // 10) VANTHA DUSKRUNNER — low pack hunter; sensor-band eyes, fanged grin, twin tail filaments
  vantha: {
    w: 50, h: 32, scale: 1, idleFrames: 6, walkFrames: 8, threatFrames: 4, lungeFrames: 4, menace: '#c9a6ff', pace: 0.8,
    shadow: { rx: 18, ry: 5, alpha: 0.32 },
    aura: { kind: 'mote', color: '#8a6adf', rate: 0.02, night: true },
    paint(P, f, mode) {
      const body = '#343448', pale = '#5c5c78', vio = '#a98cff', ink = '#0a0a12';
      const th = mode === 'threat' || mode === 'lunge', lu = mode === 'lunge';
      const open = lu ? 6 : th ? 4 : (mode === 'idle' && f === 5 ? 1 : 0);
      const prowl = lu ? 1 : th ? 2 : 0;
      const hips = [[12, 18], [18, 19], [30, 19], [36, 18]];
      const g = { amp: 3, lift: 3, order: [0, 0.5, 0.25, 0.75], thick: 2, claws: 2, clawColor: '#d8d4e0', crouch: prowl };
      legs(P, { hips: hips.slice(0, 2), ground: 31, f, mode, color: body, far: true, kneeBias: -1, ...g });
      // lean, low body (sinuous)
      P.band(17, 16 + prowl, 8, 5.5, tone(body, -0.04), { tex: 1 });
      P.band(28, 15 + prowl, 11, 6, body, { tex: 1 });
      P.band(23, 19 + prowl, 11, 2.5, pale, { spec: false, steps: [0.12, 0.04, -0.06, -0.16] });
      // hackles along the spine (raise in threat)
      ridge(P, [[16, 11 + prowl], [20, 10 + prowl], [24, 9 + prowl], [28, 9 + prowl], [32, 10 + prowl]], tone(body, -0.1), { h: 2, lean: -0.4, raised: th ? 2 : 0 });
      legs(P, { hips: hips.slice(2), ground: 31, f, mode, color: body, kneeBias: 1, ...g });
      // neck + long wolfish skull, lowered
      const hd = prowl;
      P.poly([[34, 12 + hd], [40, 9 + hd], [44, 13 + hd], [40, 18 + hd], [34, 18 + hd]], tone(body, 0.06));
      P.poly([[38, 8 + hd], [46, 9 + hd], [50, 14 + hd], [46, 16 + hd], [38, 15 + hd]], tone(body, 0.14)); // skull
      jaw(P, { x: 40, y: 13 + hd, w: 10, h: 3, color: tone(body, 0.1), open, fangs: 3, fangLen: 2, gum: '#3a0f1c', tongue: open > 2 ? '#7a2a3a' : null });
      // sensor band: a glowing visor strip across the eyes
      P.r(41, 10 + hd, 8, 1, tone(vio, -0.4));
      P.eye(42, 10 + hd, 2, 2, th ? '#ffffff' : vio, { glint: false, pupil: ink, slit: true });
      P.eye(46, 10 + hd, 2, 2, th ? '#ffffff' : vio, { glint: false, pupil: ink, slit: true });
      P.line(40, 9 + hd, 48, 8 + hd, tone(body, -0.45)); // brow
      // ears pinned back
      P.spike(38, 8 + hd, 4, tone(body, 0.05), -0.9, 2); P.spike(41, 8 + hd, 3, tone(body, 0.1), -0.7, 2);
      // twin tail filaments
      const ts = mode === 'walk' ? (f % 2 ? 1 : -1) : (mode === 'idle' ? [0, 0, 1, 1, 0, -1][f] : 0);
      tail(P, 10, 15 + prowl, 2, 8 + ts, body, { thick: 2, segs: 6 });
      P.line(6, 11 + ts, 1, 6 + ts, tone(vio, -0.3)); P.p(1, 5 + ts, vio);
      P.line(6, 12 + ts, 2, 12 + ts, tone(vio, -0.35)); P.p(1, 12 + ts, tone(vio, -0.1));
      P.rim(tone(vio, -0.25), 0.3);
    },
  },

  // 11) KARRGAN MAW — apex jaw-engine; armour plates, four eyes, hunched shoulders, maniacal grin
  karrgan: {
    w: 70, h: 50, scale: 1, idleFrames: 6, walkFrames: 8, threatFrames: 4, lungeFrames: 4, menace: '#ff4d5a', pace: 1.15,
    shadow: { rx: 27, ry: 8, alpha: 0.38 },
    paint(P, f, mode) {
      const body = '#4a3038', plate = '#6a4a52', red = '#e05a6a', ink = '#0e0608';
      const th = mode === 'threat' || mode === 'lunge', lu = mode === 'lunge';
      const open = lu ? 9 : th ? 7 : (mode === 'idle' ? [1, 1, 2, 2, 1, 1][f] : 2);
      const br = mode === 'idle' ? breathe(f) : 0;
      const hips = [[14, 30], [22, 32], [40, 30], [50, 28]];
      const g = { amp: 3, lift: 3, order: [0, 0.5, 0.25, 0.75], thick: 4, claws: 3, clawColor: '#e8e0d8', foot: '#221016', shinThick: 3 };
      legs(P, { hips: hips.slice(0, 2), ground: 49, f, mode, color: body, far: true, kneeBias: -2, ...g });
      // hunched body: massive shoulders, low pelvis
      P.band(20, 27, 11, 8 + br * 0.3, tone(body, -0.06), { tex: 1 });
      P.band(38, 22, 16, 11 + br * 0.5, body, { tex: 1 });
      P.band(30, 31, 16, 3.5, tone(body, 0.1), { spec: false, steps: [0.14, 0.05, -0.06, -0.18] });
      // dorsal armour plates + shoulder shield
      plates(P, 26, 14, 24, 9, plate, 6);
      P.poly([[42, 12], [56, 14], [58, 22], [46, 24]], tone(plate, 0.08)); P.line(42, 12, 56, 14, tone(plate, 0.3));
      ridge(P, [[22, 15], [28, 13], [34, 12], [40, 11]], tone(plate, -0.2), { h: 3, lean: -0.5, raised: th ? 2 : 0 });
      legs(P, { hips: hips.slice(2), ground: 49, f, mode, color: body, kneeBias: 2, ...g });
      // war-scar stripes
      stripes(P, 24, 22, 14, 8, tone(red, -0.55), 6, 1);
      // enormous skull + jaw engine (overbuilt lower jaw)
      const hd = lu ? 4 : th ? 2 : 0;
      P.poly([[50, 12 + hd], [62, 12 + hd], [68, 20 + hd], [64, 26 + hd], [50, 26 + hd]], tone(body, 0.14));
      P.poly([[52, 12 + hd], [60, 12 + hd], [58, 16 + hd], [52, 16 + hd]], tone(plate, 0.1)); // skull plate
      jaw(P, { x: 52, y: 20 + hd, w: 18, h: 5, color: tone(body, 0.1), open, fangs: 5, fangLen: 4, gum: '#4a0f1c', tongue: open > 3 ? '#8a2a3a' : null, lip: tone(red, -0.5) });
      // heavy lower jaw block extends when open
      P.slab(56, 25 + hd + open, 13, 5, tone(body, -0.14)); P.hl(56, 25 + hd + open, 13, tone(red, -0.5));
      for (let k = 0; k < 4; k++) P.p(58 + k * 3, 25 + hd + open - 1, W); // lower teeth row
      // four eyes: two large slit eyes + two small rear eyes
      P.eye(60, 15 + hd, 3, 2, th ? '#fff0a0' : '#ffd6a8', { glint: true, pupil: ink, slit: true });
      P.eye(56, 16 + hd, 2, 2, th ? '#ffe680' : '#ffcf9a', { glint: false, pupil: ink, slit: true });
      P.eye(53, 14 + hd, 2, 1, tone(red, 0.3), { glint: false });
      P.eye(64, 16 + hd, 2, 1, tone(red, 0.3), { glint: false });
      P.line(55, 14 + hd, 63, 13 + hd, ink); // scowling brow
      // horn nubs + cheek spikes
      P.spike(54, 12 + hd, 4, tone(plate, 0.15), -0.7, 2); P.spike(60, 12 + hd, 3, tone(plate, 0.1), -0.5, 2);
      P.spike(66, 22 + hd, 3, tone(plate, 0.05), 0.6, 2);
      // heavy tail with plates
      tail(P, 10, 26, 1, 20, body, { thick: 5, segs: 6, sway: mode === 'walk' ? (f % 2 ? 1 : -1) : 0 });
      P.spike(6, 22, 3, tone(plate, -0.1), -0.5, 2); P.spike(3, 21, 3, tone(plate, -0.15), -0.5, 1);
      P.rim(tone(red, -0.2), 0.28);
    },
  },

  // 12) LUMEN DRIFTER — floating lantern; faceted translucent bell, glow organs, trailing tendrils
  lumen: {
    w: 38, h: 58, scale: 1, idleFrames: 6, walkFrames: 0, threatFrames: 4, lungeFrames: 4, bob: true,
    shadow: { rx: 11, ry: 4, alpha: 0.16, detached: true },
    aura: { kind: 'mote', color: '#2DE2E6', rate: 0.04, night: true },
    paint(P, f, mode) {
      const bell = '#3d6a8c', lite = '#9fe2f2', glow = '#2DE2E6', deep = '#223d55', ink = '#06111a';
      const th = mode === 'threat' || mode === 'lunge', lu = mode === 'lunge';
      const pulse = breathe(f, 6);
      // trailing tendrils (drift)
      for (let i = 0; i < 6; i++) {
        const x = 8 + i * 4.4, ph = Math.sin(f * 1.05 + i * 0.9);
        const len = 20 + (i % 3) * 4 + (lu ? 8 : th ? 4 : 0);
        for (let s = 0; s < len; s += 2) {
          const t = s / len;
          P.r(Math.round(x + Math.sin(t * 3 + ph) * 2 * t), 30 + s, 1, 2, mixc(deep, glow, t * 0.5 + (s / 2 + f) % 6 === 0 ? 0.8 : 0.25));
        }
      }
      // bell: faceted dome with hard planes
      const ry = 12 + pulse * 1.2;
      P.band(19, 16, 15, ry, bell, { tex: 0, steps: [0.36, 0.12, -0.1, -0.3] });
      P.poly([[6, 18], [19, 4], [19, 28]], tone(lite, -0.3)); // lit facet
      P.poly([[19, 4], [33, 18], [19, 28]], tone(deep, -0.02)); // dark facet
      P.line(19, 4, 19, 28, tone(lite, 0.05)); P.line(6, 18, 33, 18, tone(bell, -0.3));
      P.poly([[10, 22], [28, 22], [24, 30], [14, 30]], tone(deep, -0.15)); // underbell skirt
      for (let k = 0; k < 5; k++) P.p(11 + k * 4, 30, tone(lite, -0.2)); // skirt frill
      // glow organs (pulse)
      [[14, 14], [22, 10], [24, 20], [12, 22]].forEach(([x, y], i) => {
        if ((i + f) % 2 === 0 || th) P.glow(x, y, glow, 0.45); else P.p(x, y, tone(glow, -0.3));
      });
      P.r(17, 12, 4, 8, mixc(bell, glow, 0.6)); P.p(18, 14, tone(glow, 0.4)); // lantern core
      // sensory eye-spots on the bell rim
      P.eye(26, 16, 2, 2, th ? '#ffffff' : '#dffbff', { glint: false, pupil: ink });
      P.eye(30, 19, 2, 1, tone(lite, 0.1), { glint: false });
      // crown spire
      P.spike(19, 4, 5 + (th ? 2 : 0), lite, 0, 2);
      P.rim(tone(lite, 0.1), 0.35);
    },
  },

  // 13) UMBRA VEILWING — shade stalker; blade wings, hooked beak-jaw, violet ember eyes
  umbra: {
    w: 54, h: 32, scale: 1, idleFrames: 6, walkFrames: 8, threatFrames: 4, lungeFrames: 4, menace: '#a08cff', pace: 0.9,
    shadow: { rx: 18, ry: 5, alpha: 0.26, soft: true },
    aura: { kind: 'wisp', color: '#8AA4FF', rate: 0.03, night: true },
    paint(P, f, mode) {
      const body = '#2a2438', vio = '#8AA4FF', pale = '#4a4262', ink = '#07060c';
      const th = mode === 'threat' || mode === 'lunge', lu = mode === 'lunge';
      const open = lu ? 6 : th ? 4 : 0;
      // clawed legs (low crouch)
      [[16, 20], [30, 20]].forEach(([hx, hy], i) => {
        const g = mode === 'walk' ? stride(f, i, { amp: 3, lift: 2, order: [0, 0.5] }) : { dx: 0, dy: 0 };
        P.line(hx, hy, hx - 3 + g.dx, 30 + g.dy, tone(body, -0.05), 2);
        P.line(hx + 3, hy, hx + 5 + g.dx, 30 + g.dy, tone(body, -0.2), 2);
        P.claw(hx - 4 + g.dx, 30 + g.dy, -1, '#cfc8e0', 2); P.claw(hx + 7 + g.dx, 30 + g.dy, 1, '#cfc8e0', 2);
      });
      // low body
      P.band(24, 18, 13, 5.5, body, { tex: 1, steps: [0.3, 0.08, -0.1, -0.3] });
      P.band(24, 21, 10, 2, pale, { spec: false, steps: [0.1, 0.02, -0.08, -0.18] });
      // blade wings: folded membranes (spread wide in threat / flap when walking)
      const wf = lu ? 10 : th ? 8 : (mode === 'walk' ? [0, 2, 4, 3, 1, 0, 2, 4][f] : (mode === 'idle' ? [0, 0, 1, 1, 0, 0][f] : 0));
      P.poly([[12, 16], [2, 6 - wf], [20, 12]], tone(body, -0.12));
      P.poly([[14, 16], [4, 8 - wf], [20, 13]], tone(pale, -0.2));
      P.line(12, 16, 2, 6 - wf, tone(vio, -0.4)); P.line(20, 12, 4, 8 - wf, tone(vio, -0.5)); // wing fingers
      P.poly([[28, 15], [44, 4 - wf], [36, 14]], tone(body, -0.12));
      P.poly([[30, 15], [42, 6 - wf], [36, 14]], tone(pale, -0.25));
      P.line(28, 15, 44, 4 - wf, tone(vio, -0.4));
      // hooded head: hooked beak-jaw with needle teeth
      P.poly([[34, 10], [44, 9], [50, 13], [46, 20], [36, 19]], tone(body, 0.1));
      P.poly([[44, 12], [54, 15], [50, 19], [45, 18]], tone(pale, 0.05)); // beak
      P.line(46, 18, 53, 16, ink);
      if (th) { P.poly([[45, 18], [53, 17], [48, 20 + open], [44, 20]], '#3a1030'); P.p(47, 18, W); P.p(50, 18, W); P.p(46, 20 + open - 1, W); }
      else { P.p(48, 18, W); P.p(51, 17, W); }
      P.spike(36, 10, 5, tone(body, 0.05), -0.9, 2); P.spike(40, 9, 6, tone(body, 0.1), -0.7, 2); // hood spines
      // violet ember eyes (slit)
      P.eye(42, 12, 3, 2, th ? '#e8e0ff' : vio, { glint: false, pupil: ink, slit: true });
      P.eye(39, 13, 2, 1, tone(vio, -0.2), { glint: false });
      P.line(41, 11, 46, 11, ink); // brow
      // whip tail
      tail(P, 12, 19, 1, 22, body, { thick: 2, segs: 6, sway: mode === 'idle' ? [0, 1, 1, 0, -1, -1][f] : 0, tip: tone(vio, -0.25) });
      P.rim(tone(vio, -0.15), 0.4);
    },
  },

  // 14) VOLTARI ARCHLING — energivore arc serpent; segmented capacitor body, forked crown, live arcs
  voltari: {
    w: 54, h: 34, scale: 1, idleFrames: 6, walkFrames: 8, threatFrames: 4, lungeFrames: 4, pace: 0.8, hover: 4,
    shadow: { rx: 18, ry: 4.4, alpha: 0.24, detached: true },
    aura: { kind: 'spark', color: '#2DE2E6', rate: 0.05, night: false },
    paint(P, f, mode) {
      const body = '#2a3a55', cyan = '#2DE2E6', pale = '#7fb3d8', ink = '#050a14';
      const th = mode === 'threat' || mode === 'lunge', lu = mode === 'lunge';
      // serpentine segmented body (sine wave ripples along length)
      const segs = 12;
      for (let i = 0; i < segs; i++) {
        const t = i / (segs - 1);
        const x = 4 + i * 3.6;
        const wave = Math.sin(t * 6 + f * 1.05) * (mode === 'walk' ? 3 : 2) * (1 - t * 0.4);
        const y = 20 + wave - t * 6;
        const rad = 2 + Math.round(3 * Math.sin(t * Math.PI));
        P.band(x, y, rad + 1, rad, i % 2 ? body : tone(body, 0.08), { spec: i % 3 === 0, steps: [0.32, 0.1, -0.12, -0.3] });
        if (i % 2 === 0) P.vl(Math.round(x), Math.round(y - rad), rad * 2, tone(pale, -0.2)); // capacitor ring
        if (i % 3 === 1) P.glow(Math.round(x), Math.round(y), cyan, th ? 0.5 : 0.3);
      }
      // head: angular wedge with forked crown horns
      const hx = lu ? 49 : 46, hy = 12 + Math.round(Math.sin(f * 1.05) * (mode === 'walk' ? 2 : 1));
      P.poly([[hx - 6, hy], [hx + 4, hy - 1], [hx + 8, hy + 4], [hx + 3, hy + 9], [hx - 6, hy + 8]], tone(body, 0.14));
      P.poly([[hx + 1, hy + 4], [hx + 8, hy + 5], [hx + 5, hy + 9], [hx, hy + 8]], tone(pale, -0.1)); // snout
      P.line(hx + 1, hy + 8, hx + 6, hy + 9, ink);
      if (th) { P.r(hx + 2, hy + 9, 4, 2, '#0a2a33'); P.p(hx + 3, hy + 9, cyan); P.p(hx + 5, hy + 9, cyan); } // crackling maw
      P.spike(hx - 4, hy, 7 + (th ? 2 : 0), pale, -0.8, 2); P.spike(hx, hy - 1, 6 + (th ? 2 : 0), pale, -0.4, 2); // forked crown
      P.glow(hx - 8, hy - 6 - (th ? 2 : 0), cyan, 0.45); P.glow(hx - 1, hy - 6 - (th ? 2 : 0), cyan, 0.4); // crown tips
      P.eye(hx + 2, hy + 2, 3, 2, th ? '#ffffff' : cyan, { glint: false, pupil: ink, slit: true });
      P.eye(hx - 2, hy + 3, 2, 1, tone(cyan, -0.2), { glint: false });
      // arcs jumping between segments (frame-driven)
      const a = (f * 2) % segs;
      P.line(4 + a * 3.6, 12, 4 + (a + 2) * 3.6, 10, tone(cyan, 0.2), 1);
      P.p(4 + (a + 1) * 3.6, 9, '#eaffff');
      // tail fork
      P.line(4, 24, 0, 28, pale); P.line(4, 24, 0, 20, pale); P.p(0, 28, cyan); P.p(0, 20, cyan);
      P.rim(tone(cyan, -0.3), 0.4);
    },
  },

  // 15) EMBEROOT GORGER — fungal colossus; stacked caps, ember spore cavities, root talons
  emberoot: {
    w: 58, h: 46, scale: 1, idleFrames: 6, walkFrames: 8, threatFrames: 4, lungeFrames: 4, pace: 1.35,
    shadow: { rx: 23, ry: 7.5, alpha: 0.38 },
    aura: { kind: 'ember', color: '#e0785a', rate: 0.04, night: false },
    paint(P, f, mode) {
      const cap = '#4a2a35', capLite = '#7a4658', ember = '#e0785a', vio = '#b98ae0', root = '#3a2a22', ink = '#120809';
      const th = mode === 'threat' || mode === 'lunge', lu = mode === 'lunge';
      const br = mode === 'idle' ? breathe(f) : 0;
      // root-talon legs
      [[14, 30], [26, 32], [38, 32], [48, 30]].forEach(([x, y], i) => {
        const g = mode === 'walk' ? stride(f, i, { amp: 2, lift: 2, order: [0, 0.5, 0.25, 0.75] }) : { dx: 0, dy: 0 };
        const far = i === 0 || i === 2;
        P.slab(x + g.dx, y + g.dy, 6, 45 - y - g.dy, tone(root, far ? -0.25 : 0), { tex: 1 });
        P.line(x - 2 + g.dx, 45, x + g.dx, 42, tone(root, -0.2)); P.line(x + 7 + g.dx, 45, x + 5 + g.dx, 42, tone(root, -0.3)); // talon roots
      });
      // fungal body mass
      P.band(30, 26 - br * 0.4, 20, 9 + br, cap, { tex: 1 });
      P.band(28, 31, 16, 3, tone(cap, -0.12), { spec: false, steps: [0.06, 0, -0.08, -0.2] });
      // stacked caps (hard-edged shelves)
      P.poly([[8, 20], [52, 18], [46, 12], [14, 13]], capLite);
      P.hl(10, 19, 40, tone(cap, -0.3)); P.line(14, 13, 46, 12, tone(capLite, 0.3));
      P.poly([[16, 13], [44, 12], [40, 7], [20, 8]], tone(capLite, 0.08));
      P.line(20, 8, 40, 7, tone(capLite, 0.35));
      P.poly([[24, 8], [38, 7], [35, 3], [27, 3]], tone(capLite, 0.16)); P.line(27, 3, 35, 3, tone(capLite, 0.4));
      // ember spore cavities (breathe brighter; blaze in threat)
      [[20, 24], [30, 22], [40, 24], [26, 29], [36, 29]].forEach(([x, y], i) => {
        const on = th || (i + f) % 3 !== 2;
        P.r(x - 1, y - 1, 3, 3, ink);
        if (on) P.glow(x, y, ember, 0.45); else P.p(x, y, tone(ember, -0.4));
      });
      P.dither(12, 14, 36, 5, tone(vio, -0.3), 0.08, 5); // violet spore dust on caps
      // face: heavy cap brow, ember eyes, gaping spore-maw in threat
      const hd = lu ? -3 : th ? -1 : 0;
      P.poly([[46, 20 + hd], [56, 22 + hd], [57, 30 + hd], [50, 34 + hd], [46, 32 + hd]], tone(cap, 0.1));
      P.eye(50, 24 + hd, 3, 2, th ? '#ffe0b0' : ember, { glint: false, pupil: ink });
      P.eye(54, 26 + hd, 2, 2, tone(ember, -0.1), { glint: false, pupil: ink });
      P.line(49, 32 + hd, 55, 31 + hd, ink);
      if (th) { P.poly([[49, 32 + hd], [56, 31 + hd], [54, 37 + hd], [49, 36 + hd]], '#2a0810'); }
      if (th) { P.glow(52, 34 + hd, ember, 0.5); P.p(50, 33 + hd, W); P.p(54, 32 + hd, W); }
      // root tail drag
      tail(P, 10, 30, 2, 38, root, { thick: 4, segs: 5 });
      P.rim(tone(ember, -0.25), 0.3);
    },
  },
};
