// ---- Creatures: procedural rigs per body plan, PBR skins, state-driven animation (bible 4 / 6) ----
// One geometry template per bodyType (unit body length), one Group per living creature with its own
// three tinted materials (body / accent / glow) sharing the baked skin textures. Heading, gait phase
// and pose are derived here from authoritative positions + c.state every frame; nothing is written
// back to the sim.
import * as THREE from 'three';
import { speciesById } from '../data/species';
import { morphOf } from '../genetics';
import { idx, inMap } from '../state';
import { H_UNIT } from './iso';
import { WATER_DROP } from './terrain';
import { hashId, place, merge, jitterVertices, scaleUV } from './materials';

const SKIN = { quad: 'skin_scales', tall: 'skin_leather', winged: 'skin_scales', insect: 'skin_chitin', amphib: 'skin_leather', crystal: 'skin_crystal', blob: 'skin_gel', float: 'skin_gel', serpent: 'skin_scales' };
const SKIN_BY_SPECIES = { veyra: 'skin_leather', rhoak: 'skin_fur', vantha: 'skin_fur', aurox: 'skin_fur', umbra: 'skin_fur', silttitan: 'skin_leather', mirefin: 'skin_leather', sylvarr: 'skin_leather', thornback: 'skin_scales', karrgan: 'skin_scales', nyxarr: 'skin_scales' };
const ROUGH = { skin_scales: 0.62, skin_leather: 0.72, skin_chitin: 0.38, skin_crystal: 0.18, skin_gel: 0.22, skin_membrane: 0.55, skin_fur: 0.85 };
const NORMAL = { skin_scales: 0.75, skin_leather: 0.55, skin_chitin: 0.85, skin_crystal: 0.95, skin_gel: 0.35, skin_membrane: 0.4, skin_fur: 0.5 };
const BASE_LENGTH = 0.62; // world units of body length for size 1.0

// ---------- geometry templates (unit body length, +Z forward, origin at the ground under the chest) ----------
// node: { id, parent, pos, rot, geom, mat }  (nodes without geom are pivots)
const sphere = (r, sx = 1, sy = 1, sz = 1, seg = 14) => { const g = new THREE.SphereGeometry(r, seg, Math.max(6, seg - 4)); g.scale(sx, sy, sz); scaleUV(g, 2, 1.4); return g; };
const capsule = (r, len, seg = 8) => { const g = new THREE.CapsuleGeometry(r, len, 4, seg); g.translate(0, -len / 2, 0); scaleUV(g, 1.5, 1.5); return g; }; // hangs from the pivot
const cone = (r, h, seg = 8) => { const g = new THREE.ConeGeometry(r, h, seg); g.translate(0, h / 2, 0); return g; };
const wing = (span, chord) => {
  const s = new THREE.Shape();
  s.moveTo(0, 0); s.lineTo(span * 0.45, chord * 0.35); s.lineTo(span, chord * 0.1); s.lineTo(span * 0.85, -chord * 0.35); s.lineTo(span * 0.4, -chord * 0.6); s.lineTo(0, -chord * 0.3); s.closePath();
  const g = new THREE.ShapeGeometry(s, 4); g.rotateX(-Math.PI / 2); // lies flat, extends along +X, spans Z
  return g;
};

function quadTemplate({ legLen = 0.32, legR = 0.045, neckLen = 0.16, neckUp = 0.35, headScale = 1, torso = [0.5, 0.24, 0.22], tail = 0.45, ridge = true, crest = false } = {}) {
  const hip = legLen + torso[1] * 0.55;
  const nodes = [
    { id: 'body', parent: 'root', pos: [0, hip, 0] },
    { id: 'torso', parent: 'body', geom: sphere(1, torso[0], torso[1], torso[2]), mat: 'body' },
    { id: 'chest', parent: 'body', pos: [0, 0.02, torso[2] * 1.2], geom: sphere(1, torso[0] * 0.55, torso[1] * 0.9, torso[2] * 0.9), mat: 'body' },
    { id: 'neck', parent: 'body', pos: [0, torso[1] * 0.4, torso[2] * 1.9] },
    { id: 'neckMesh', parent: 'neck', pos: [0, 0, 0], rot: [Math.PI / 2 - neckUp, 0, 0], geom: capsule(0.07, neckLen).rotateX(Math.PI), mat: 'body' },
    { id: 'head', parent: 'neck', pos: [0, Math.sin(neckUp) * neckLen * 1.1, Math.cos(neckUp) * neckLen * 1.1] },
    { id: 'skull', parent: 'head', geom: sphere(0.13 * headScale, 1, 0.85, 1.25), mat: 'body' },
    { id: 'snout', parent: 'head', pos: [0, -0.02 * headScale, 0.15 * headScale], geom: sphere(0.08 * headScale, 1, 0.7, 1.3), mat: 'accent' },
    { id: 'eyeL', parent: 'head', pos: [0.085 * headScale, 0.04 * headScale, 0.07 * headScale], geom: sphere(0.026 * headScale, 1, 1, 1, 8), mat: 'eye' },
    { id: 'eyeR', parent: 'head', pos: [-0.085 * headScale, 0.04 * headScale, 0.07 * headScale], geom: sphere(0.026 * headScale, 1, 1, 1, 8), mat: 'eye' },
    { id: 'tail', parent: 'body', pos: [0, torso[1] * 0.3, -torso[2] * 2.1] },
    { id: 'tailMesh', parent: 'tail', rot: [-(Math.PI / 2 + 0.35), 0, 0], geom: cone(0.06, tail, 8), mat: 'body' },
  ];
  const lx = torso[0] * 0.55, lz = torso[2] * 1.15;
  for (const [id, x, z] of [['legFL', lx, lz], ['legFR', -lx, lz], ['legBL', lx, -lz], ['legBR', -lx, -lz]]) {
    nodes.push({ id, parent: 'body', pos: [x, -torso[1] * 0.35, z] });
    nodes.push({ id: id + 'Mesh', parent: id, geom: capsule(legR, legLen), mat: 'body' });
    nodes.push({ id: id + 'Foot', parent: id, pos: [0, -legLen - 0.02, 0.02], geom: sphere(legR * 1.35, 1.1, 0.6, 1.3, 8), mat: 'accent' });
  }
  if (ridge) for (let i = 0; i < 4; i++) nodes.push({ id: 'ridge' + i, parent: 'body', pos: [0, torso[1] * 0.95, torso[2] * 0.9 - i * torso[2] * 0.6], geom: cone(0.035, 0.09, 5), mat: 'accent' });
  if (crest) nodes.push({ id: 'crest', parent: 'head', pos: [0, 0.1 * headScale, -0.04 * headScale], rot: [-0.7, 0, 0], geom: cone(0.05, 0.22, 6), mat: 'accent' });
  for (let i = 0; i < 3; i++) nodes.push({ id: 'glow' + i, parent: 'body', pos: [torso[0] * 0.98, torso[1] * 0.1, torso[2] * 0.7 - i * torso[2] * 0.7], geom: sphere(0.028, 1, 1, 1, 8), mat: 'glow' });
  return { nodes, hip, legLen, kind: 'quad' };
}

function insectTemplate() {
  const nodes = [
    { id: 'body', parent: 'root', pos: [0, 0.2, 0] },
    { id: 'thorax', parent: 'body', geom: sphere(0.15, 1, 0.8, 1.1), mat: 'body' },
    { id: 'abdomen', parent: 'body', pos: [0, 0.01, -0.3], geom: sphere(0.2, 1, 0.8, 1.3), mat: 'body' },
    { id: 'head', parent: 'body', pos: [0, 0.02, 0.22] },
    { id: 'skull', parent: 'head', geom: sphere(0.1, 1, 0.9, 1), mat: 'accent' },
    { id: 'eyeL', parent: 'head', pos: [0.07, 0.03, 0.06], geom: sphere(0.03, 1, 1, 1, 8), mat: 'eye' },
    { id: 'eyeR', parent: 'head', pos: [-0.07, 0.03, 0.06], geom: sphere(0.03, 1, 1, 1, 8), mat: 'eye' },
    { id: 'antL', parent: 'head', pos: [0.04, 0.07, 0.05], rot: [-0.9, 0, -0.4], geom: capsule(0.008, 0.22, 5).rotateX(Math.PI), mat: 'accent' },
    { id: 'antR', parent: 'head', pos: [-0.04, 0.07, 0.05], rot: [-0.9, 0, 0.4], geom: capsule(0.008, 0.22, 5).rotateX(Math.PI), mat: 'accent' },
  ];
  for (let i = 0; i < 3; i++) for (const side of [1, -1]) {
    const id = `leg${i}${side > 0 ? 'L' : 'R'}`;
    nodes.push({ id, parent: 'body', pos: [side * 0.12, -0.02, 0.12 - i * 0.14], rot: [0, 0, side * 0.9] });
    nodes.push({ id: id + 'Mesh', parent: id, geom: capsule(0.014, 0.26, 5), mat: 'body' });
  }
  for (let i = 0; i < 3; i++) nodes.push({ id: 'seg' + i, parent: 'body', pos: [0, 0.14, -0.18 - i * 0.1], geom: sphere(0.05, 1.6, 0.4, 0.7, 8), mat: 'accent' });
  return { nodes, hip: 0.2, legLen: 0.26, kind: 'insect', legs: 6 };
}

function amphibTemplate() {
  const t = quadTemplate({ legLen: 0.16, legR: 0.05, neckLen: 0.06, neckUp: 0.1, headScale: 1.35, torso: [0.5, 0.15, 0.3], tail: 0.55, ridge: false });
  t.nodes.push({ id: 'fin', parent: 'tail', pos: [0, 0.03, -0.3], rot: [0.3, 0, 0], geom: new THREE.BoxGeometry(0.02, 0.16, 0.4), mat: 'accent' });
  t.nodes.push({ id: 'finTop', parent: 'body', pos: [0, 0.14, -0.1], geom: new THREE.BoxGeometry(0.02, 0.08, 0.35), mat: 'accent' });
  t.kind = 'amphib';
  return t;
}

function wingedTemplate() {
  const t = quadTemplate({ legLen: 0.28, legR: 0.035, neckLen: 0.14, neckUp: 0.5, headScale: 0.95, torso: [0.42, 0.2, 0.2], tail: 0.5, ridge: false, crest: true });
  for (const side of [1, -1]) {
    const id = side > 0 ? 'wingL' : 'wingR';
    t.nodes.push({ id, parent: 'body', pos: [side * 0.15, 0.14, 0.02], rot: [0, side > 0 ? 0 : Math.PI, 0] });
    t.nodes.push({ id: id + 'Mesh', parent: id, geom: wing(0.95, 0.5), mat: 'wing' });
    t.nodes.push({ id: id + 'Bone', parent: id, rot: [0, 0, Math.PI / 2], geom: capsule(0.018, 0.9, 5), mat: 'body' });
  }
  t.kind = 'winged';
  return t;
}

function crystalTemplate() {
  const core = jitterVertices(new THREE.IcosahedronGeometry(0.28, 0), 0.06, 4, false);
  const nodes = [
    { id: 'body', parent: 'root', pos: [0, 0.34, 0] },
    { id: 'core', parent: 'body', geom: core, mat: 'body' },
    { id: 'inner', parent: 'body', geom: new THREE.IcosahedronGeometry(0.19, 1), mat: 'glow' },
  ];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2, el = 0.35 + hashId(i, 2) * 0.5;
    nodes.push({ id: 'shard' + i, parent: 'body', pos: [Math.cos(a) * 0.12, 0.05, Math.sin(a) * 0.12], rot: [Math.cos(a + Math.PI / 2) * el, 0, Math.sin(a + Math.PI / 2) * el], geom: cone(0.06, 0.35 + hashId(i, 3) * 0.2, 4), mat: 'accent' });
  }
  for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2 + 0.5; nodes.push({ id: 'leg' + i, parent: 'body', pos: [Math.cos(a) * 0.14, -0.14, Math.sin(a) * 0.14], rot: [Math.PI, 0, 0], geom: cone(0.05, 0.22, 4), mat: 'body' }); }
  return { nodes, hip: 0.34, legLen: 0.2, kind: 'crystal' };
}

function blobTemplate() {
  const nodes = [
    { id: 'body', parent: 'root', pos: [0, 0.3, 0] },
    { id: 'mass', parent: 'body', geom: sphere(0.38, 1.15, 0.8, 1.05, 20), mat: 'body' },
    { id: 'core', parent: 'body', pos: [0, -0.02, 0.04], geom: sphere(0.17, 1, 1, 1, 12), mat: 'glow' },
    { id: 'eyeL', parent: 'body', pos: [0.12, 0.12, 0.34], geom: sphere(0.035, 1, 1, 1, 8), mat: 'eye' },
    { id: 'eyeR', parent: 'body', pos: [-0.12, 0.12, 0.34], geom: sphere(0.035, 1, 1, 1, 8), mat: 'eye' },
  ];
  for (let i = 0; i < 6; i++) { const a = hashId(i, 5) * Math.PI * 2, e = hashId(i, 6) * 0.9 + 0.2; nodes.push({ id: 'nod' + i, parent: 'body', pos: [Math.cos(a) * Math.cos(e) * 0.4, Math.sin(e) * 0.3, Math.sin(a) * Math.cos(e) * 0.38], geom: sphere(0.05 + hashId(i, 7) * 0.04, 1, 1, 1, 8), mat: 'accent' }); }
  return { nodes, hip: 0.3, legLen: 0, kind: 'blob' };
}

function floatTemplate() {
  const nodes = [
    { id: 'body', parent: 'root', pos: [0, 0.95, 0] },
    { id: 'bell', parent: 'body', geom: place(new THREE.SphereGeometry(0.32, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), 0, -0.08, 0), mat: 'body' },
    { id: 'rim', parent: 'body', pos: [0, -0.12, 0], geom: new THREE.TorusGeometry(0.29, 0.03, 8, 20).rotateX(Math.PI / 2), mat: 'accent' },
    { id: 'core', parent: 'body', pos: [0, 0.02, 0], geom: sphere(0.15, 1, 1.2, 1, 12), mat: 'glow' },
  ];
  for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; nodes.push({ id: 'tend' + i, parent: 'body', pos: [Math.cos(a) * 0.22, -0.12, Math.sin(a) * 0.22] }); nodes.push({ id: 'tend' + i + 'Mesh', parent: 'tend' + i, geom: capsule(0.014, 0.55 + hashId(i, 8) * 0.25, 5), mat: 'accent' }); }
  return { nodes, hip: 0.95, legLen: 0, kind: 'float' };
}

function serpentTemplate() {
  const nodes = [{ id: 'body', parent: 'root', pos: [0, 0, 0] }];
  const N = 10;
  for (let i = 0; i < N; i++) {
    const r = 0.11 * (1 - i / (N + 2));
    nodes.push({ id: 'seg' + i, parent: 'body', pos: [0, r, -i * 0.15], geom: sphere(r, 1, 1, 1.4, 10), mat: i % 2 ? 'accent' : 'body' });
    if (i % 3 === 1) nodes.push({ id: 'sg' + i, parent: 'seg' + i, pos: [0, r * 0.95, 0], geom: sphere(0.03, 1, 0.6, 1.6, 8), mat: 'glow' });
  }
  nodes.push({ id: 'head', parent: 'body', pos: [0, 0.12, 0.13] });
  nodes.push({ id: 'skull', parent: 'head', geom: sphere(0.12, 1.1, 0.8, 1.3, 12), mat: 'body' });
  nodes.push({ id: 'eyeL', parent: 'head', pos: [0.08, 0.04, 0.08], geom: sphere(0.028, 1, 1, 1, 8), mat: 'eye' });
  nodes.push({ id: 'eyeR', parent: 'head', pos: [-0.08, 0.04, 0.08], geom: sphere(0.028, 1, 1, 1, 8), mat: 'eye' });
  for (const s of [1, -1]) nodes.push({ id: 'fin' + s, parent: 'head', pos: [s * 0.1, 0.02, -0.04], rot: [0, s * 0.5, s * 0.8], geom: cone(0.05, 0.22, 4), mat: 'accent' });
  return { nodes, hip: 0.12, legLen: 0, kind: 'serpent', segments: N };
}

const TEMPLATES = {};
function template(bodyType) {
  if (TEMPLATES[bodyType]) return TEMPLATES[bodyType];
  let t;
  switch (bodyType) {
    case 'tall': t = quadTemplate({ legLen: 0.62, legR: 0.035, neckLen: 0.45, neckUp: 1.1, headScale: 0.8, torso: [0.36, 0.2, 0.18], tail: 0.35, ridge: true }); t.kind = 'tall'; break;
    case 'insect': t = insectTemplate(); break;
    case 'amphib': t = amphibTemplate(); break;
    case 'winged': t = wingedTemplate(); break;
    case 'crystal': t = crystalTemplate(); break;
    case 'blob': t = blobTemplate(); break;
    case 'float': t = floatTemplate(); break;
    case 'serpent': t = serpentTemplate(); break;
    default: t = quadTemplate();
  }
  TEMPLATES[bodyType] = t;
  return t;
}

// ---------- tint helpers (bible 4: body -> base, accent -> plates, glow -> emissive only) ----------
const _hsl = { h: 0, s: 0, l: 0 };
function liftedTint(hex, genes, morph, { lift = 0.62, satMul = 1 } = {}) {
  const c = new THREE.Color(hex);
  c.getHSL(_hsl);
  let h = _hsl.h + ((genes?.hue || 0) + (morph?.hue || 0)) / 360;
  let s = Math.min(1, _hsl.s * (genes?.sat || 1) * (morph?.sat || 1) * satMul);
  const l = Math.min(0.82, Math.max(0.35, _hsl.l * 0.9 + lift * 0.55));
  c.setHSL(((h % 1) + 1) % 1, s, l);
  return c;
}

const EYE_MAT = new THREE.MeshStandardMaterial({ color: '#0a0c10', roughness: 0.05, metalness: 0.1, emissive: '#2b3a4a', emissiveIntensity: 0.4 });
const RESTING = new Set(['resting', 'sheltering', 'settling', 'sleep', 'sleeping', 'held', 'captured']);
const FEEDING = new Set(['eating', 'grazing', 'drinking', 'filterFeeding']);

export class CreatureRig {
  constructor(kit, c) {
    const sp = speciesById(c.speciesId);
    this.sp = sp; this.id = c.id;
    this.tpl = template(sp.bodyType || 'quad');
    const skin = SKIN_BY_SPECIES[sp.id] || SKIN[sp.bodyType] || 'skin_scales';
    this.skin = skin;
    const reg = kit.registry;
    const maps = { map: reg.get(skin, 'albedo', '#9a9a9a'), normalMap: reg.get(skin, 'normal'), roughnessMap: reg.get(skin, 'rough') };
    const gel = skin === 'skin_gel', crystal = skin === 'skin_crystal';
    this.mats = {
      body: new THREE.MeshStandardMaterial({ ...maps, roughness: ROUGH[skin], metalness: crystal ? 0.05 : 0, normalScale: new THREE.Vector2(NORMAL[skin], NORMAL[skin]), transparent: gel, opacity: gel ? 0.86 : 1 }),
      accent: new THREE.MeshStandardMaterial({ ...maps, roughness: Math.max(0.1, ROUGH[skin] - 0.15), metalness: crystal ? 0.1 : 0.02, normalScale: new THREE.Vector2(NORMAL[skin] * 0.8, NORMAL[skin] * 0.8) }),
      glow: new THREE.MeshStandardMaterial({ color: '#111318', roughness: 0.3, emissive: '#ffffff', emissiveIntensity: 1 }),
      wing: new THREE.MeshStandardMaterial({ map: reg.get('skin_membrane', 'albedo', '#8a8a8a'), normalMap: reg.get('skin_membrane', 'normal'), roughness: 0.55, side: THREE.DoubleSide, transparent: true, opacity: 0.9 }),
      eye: EYE_MAT,
    };
    this.group = new THREE.Group();
    this.group.name = `creature-${c.id}`;
    this.nodes = { root: this.group };
    for (const n of this.tpl.nodes) {
      const obj = n.geom ? new THREE.Mesh(n.geom, this.mats[n.mat]) : new THREE.Group();
      if (n.geom) { obj.castShadow = n.mat !== 'glow'; obj.receiveShadow = true; }
      if (n.pos) obj.position.set(n.pos[0], n.pos[1], n.pos[2]);
      if (n.rot) obj.rotation.set(n.rot[0], n.rot[1], n.rot[2]);
      if (n.scale) obj.scale.set(n.scale[0], n.scale[1], n.scale[2]);
      (this.nodes[n.parent] || this.group).add(obj);
      this.nodes[n.id] = obj;
    }
    this.heading = hashId(c.id, 1) * Math.PI * 2;
    this.prev = { x: c.x, y: c.y };
    this.speed = 0;
    this.gait = hashId(c.id, 2) * 6;
    this.phase = hashId(c.id, 3) * 6.28;
    this.restBlend = RESTING.has(c.state) ? 1 : 0;
    this.feedBlend = 0;
    this.tintKey = null;
    this.retint(c);
  }

  /** Recolour when genes / morph / distress flags change (cheap, but not every frame). */
  retint(c) {
    const distressed = !!c.distressed, injured = !!c.injured, low = (c.health ?? 1) < 0.3;
    const morph = morphOf(c);
    const key = `${distressed}|${injured}|${low}|${morph?.id || ''}|${c.genes?.hue || 0}|${c.genes?.sat || 1}|${c.juvenile ? 1 : 0}`;
    if (key === this.tintKey) return;
    this.tintKey = key;
    const sp = this.sp, g = c.genes;
    const body = liftedTint(sp.colors.body, g, morph, { satMul: distressed ? 0.92 : 1 });
    const accent = liftedTint(sp.colors.accent, g, morph, { lift: 0.7, satMul: distressed ? 0.9 : 1 });
    if (distressed) { body.multiplyScalar(0.96); accent.multiplyScalar(0.96); }
    if (injured || low) { body.multiplyScalar(0.9); }
    this.mats.body.color.copy(body);
    this.mats.accent.color.copy(accent);
    this.mats.body.roughness = ROUGH[this.skin] + (c.juvenile ? 0.06 : 0) + (injured ? 0.05 : 0);
    const glowHex = (morph && morph.glow) || sp.colors.glow || sp.colors.accent;
    this.mats.glow.emissive.set(glowHex);
    this.glowBase = (sp.colors.glow || (morph && morph.glow)) ? 1.0 : 0.35;
    this.hasGlow = !!(sp.colors.glow || (morph && morph.glow));
    this.mats.glow.emissiveIntensity = this.glowBase * (distressed ? 0.65 : 1);
    this.mats.wing.color.copy(accent).lerp(body, 0.5);
  }

  /** Per-frame pose from authoritative state. */
  update(c, dt, T, ground, waterSurface, light) {
    const sp = this.sp, tpl = this.tpl, n = this.nodes;
    this.retint(c);
    // size: species x juvenile growth x genes (render-only)
    const juv = c.juvenile ? 0.5 + 0.35 * (c.growth || 0) : 1;
    const L = BASE_LENGTH * (sp.size || 1) * juv * (c.genes?.size || 1);
    this.group.scale.setScalar(L);
    // heading + speed from position deltas (smoothed)
    const dx = c.x - this.prev.x, dz = c.y - this.prev.y;
    this.prev.x = c.x; this.prev.y = c.y;
    const inst = dt > 0 ? Math.hypot(dx, dz) / dt : 0;
    if (inst < 40) this.speed += (inst - this.speed) * Math.min(1, dt * 8); // ignore teleports
    const moving = this.speed > 0.08;
    if (Math.hypot(dx, dz) > 0.002) {
      const target = Math.atan2(dx, dz);
      let d = target - this.heading; d = Math.atan2(Math.sin(d), Math.cos(d));
      this.heading += d * Math.min(1, dt * 7);
    }
    this.group.rotation.y = this.heading;
    // pose blends
    const resting = RESTING.has(c.state) && !moving;
    const feeding = FEEDING.has(c.state) && !moving;
    this.restBlend += ((resting ? 1 : 0) - this.restBlend) * Math.min(1, dt * 3);
    this.feedBlend += ((feeding ? 1 : 0) - this.feedBlend) * Math.min(1, dt * 4);
    const rb = this.restBlend, fb = this.feedBlend;
    const swimming = c.state === 'swimming' || (waterSurface != null && sp.bodyType === 'amphib' && c.state === 'seekSwim');
    const baseY = waterSurface != null ? waterSurface : ground;
    // gait phase advances with distance travelled (stride ~ 0.9 body lengths)
    this.gait += (this.speed / Math.max(0.2, L * 0.9)) * dt * Math.PI * 2 * 0.5;
    const g = this.gait, ph = this.phase;
    const breathe = 1 + 0.02 * Math.sin(T * 1.6 + ph) * (1 + rb);
    const body = n.body;
    const kind = tpl.kind;
    if (kind === 'quad' || kind === 'tall' || kind === 'amphib' || kind === 'winged') {
      const bob = moving ? Math.abs(Math.sin(g * 2)) * 0.03 : 0;
      const sink = swimming ? tpl.hip * 0.75 : 0;
      body.position.y = tpl.hip * (1 - 0.55 * rb) + bob - sink;
      body.scale.set(breathe, breathe, 1);
      body.rotation.z = moving ? Math.sin(g) * 0.03 : 0;
      const amp = moving ? Math.min(0.75, 0.35 + this.speed * 0.25) : 0;
      const legs = [['legFL', 0], ['legBR', 0], ['legFR', Math.PI], ['legBL', Math.PI]];
      for (const [id, off] of legs) {
        const leg = n[id];
        leg.rotation.x = Math.sin(g + off) * amp * (1 - rb) + rb * (id.startsWith('legF') ? 1.35 : -1.35);
        leg.scale.y = swimming ? 0.35 : 1 - 0.45 * rb;
        leg.visible = !swimming || kind === 'amphib';
      }
      // head: look around when idle, down while feeding, tucked when resting
      const look = moving ? 0 : Math.sin(T * 0.7 + ph) * 0.35;
      n.neck.rotation.y = look * (1 - fb) * (1 - rb);
      n.neck.rotation.x = fb * (kind === 'tall' ? 1.5 : 0.85) + rb * 0.35 - (moving ? 0.1 : 0);
      n.head.rotation.x = fb * 0.4 - Math.sin(T * 2.2 + ph) * 0.05 * fb;
      n.tail.rotation.y = Math.sin(T * 2.1 + ph) * (moving ? 0.35 : 0.2);
      n.tail.rotation.x = Math.sin(T * 1.3 + ph) * 0.08;
      if (kind === 'winged') {
        const fly = c.state === 'flee' || this.speed > 1.6;
        const flap = fly ? Math.sin(T * 9 + ph) * 0.55 : Math.sin(T * 1.1 + ph) * 0.06;
        const fold = fly ? 0.15 : 1.15 - 0.2 * Math.abs(Math.sin(T * 0.5 + ph));
        n.wingL.rotation.z = fold + flap;
        n.wingR.rotation.z = fold + flap;
        if (fly) body.position.y += 0.35 + Math.sin(T * 9 + ph) * 0.05;
      }
    } else if (kind === 'insect') {
      body.position.y = tpl.hip * (1 - 0.35 * rb) + (moving ? Math.abs(Math.sin(g * 3)) * 0.015 : 0);
      for (let i = 0; i < 3; i++) for (const side of ['L', 'R']) {
        const leg = n[`leg${i}${side}`];
        const off = (i % 2 === 0 ? 0 : Math.PI) + (side === 'L' ? 0 : Math.PI);
        leg.rotation.x = moving ? Math.sin(g * 1.5 + off) * 0.55 : 0;
        leg.rotation.z = (side === 'L' ? 0.9 : -0.9) + rb * (side === 'L' ? 0.5 : -0.5);
      }
      n.head.rotation.x = fb * 0.6;
      n.antL.rotation.x = -0.9 + Math.sin(T * 3.2 + ph) * 0.2;
      n.antR.rotation.x = -0.9 + Math.sin(T * 3.2 + ph + 1) * 0.2;
      n.abdomen.scale.set(breathe, breathe, breathe);
    } else if (kind === 'crystal') {
      body.position.y = tpl.hip + Math.sin(T * 0.9 + ph) * 0.03 - rb * 0.1;
      body.rotation.y = Math.sin(T * 0.3 + ph) * 0.2;
      n.inner.scale.setScalar(0.9 + 0.1 * Math.sin(T * 1.8 + ph));
    } else if (kind === 'blob') {
      const pulse = 1 + 0.06 * Math.sin(T * 1.4 + ph) * (moving ? 1.4 : 1);
      body.position.y = tpl.hip * pulse * (1 - 0.2 * rb);
      body.scale.set(2 - pulse, pulse, 2 - pulse);
      n.core.scale.setScalar(0.85 + 0.15 * Math.sin(T * 2.1 + ph));
    } else if (kind === 'float') {
      body.position.y = tpl.hip + Math.sin(T * 0.97 + ph) * 0.08 - rb * 0.25;
      body.rotation.z = Math.sin(T * 0.6 + ph) * 0.06;
      body.rotation.x = moving ? 0.12 : 0;
      for (let i = 0; i < 7; i++) { const t = n['tend' + i]; t.rotation.x = Math.sin(T * 1.3 + i + ph) * 0.18 - (moving ? 0.3 : 0); t.rotation.z = Math.cos(T * 1.1 + i * 1.3 + ph) * 0.14; }
      n.core.scale.setScalar(0.9 + 0.1 * Math.sin(T * 1.5 + ph));
    } else if (kind === 'serpent') {
      const N = tpl.segments;
      for (let i = 0; i < N; i++) {
        const s = n['seg' + i];
        const wave = Math.sin((moving ? g * 1.4 : T * 0.9) - i * 0.75 + ph) * (0.09 + 0.02 * i / N) * (moving ? 1 : 0.5);
        s.position.x = wave;
        s.position.y = 0.11 * (1 - i / (N + 2)) * (1 - 0.25 * rb) + Math.max(0, Math.sin(g * 1.4 - i * 0.75 + ph)) * 0.01 * (moving ? 1 : 0);
      }
      n.head.position.x = Math.sin((moving ? g * 1.4 : T * 0.9) + 0.75 + ph) * 0.09;
      n.head.position.y = 0.12 + 0.08 * (1 - rb) * (moving ? 0 : 1) + fb * -0.04;
      n.head.rotation.x = fb * 0.5 - (moving ? 0 : 0.15);
    }
    // world placement
    this.group.position.set(c.x, baseY, c.y);
    // emissive: brighter at night, suppressed under distress
    if (this.hasGlow) this.mats.glow.emissiveIntensity = this.glowBase * (0.55 + 0.75 * light.night) * (c.distressed ? 0.65 : 1);
    else this.mats.glow.emissiveIntensity = 0.25 * (0.6 + 0.4 * light.night);
  }

  dispose() { for (const k of Object.keys(this.mats)) if (k !== 'eye') this.mats[k].dispose(); }
}

/** Owns one rig per living creature, adds/removes on diff. */
export class CreatureLayer {
  constructor(group, kit, terrain) {
    this.group = group; this.kit = kit; this.terrain = terrain;
    this.rigs = new Map();
    this.time = 0;
  }

  sync(state, dt, light) {
    this.time += dt;
    const s = state, seen = new Set();
    for (const c of s.creatures) {
      if (c.held) continue;
      seen.add(c.id);
      let rig = this.rigs.get(c.id);
      if (!rig || rig.sp.id !== c.speciesId) {
        if (rig) { this.group.remove(rig.group); rig.dispose(); }
        rig = new CreatureRig(this.kit, c);
        this.rigs.set(c.id, rig);
        this.group.add(rig.group);
      }
      const tx = Math.floor(c.x), tz = Math.floor(c.y);
      let waterSurface = null;
      if (inMap(tx, tz) && s.water[idx(tx, tz)]) waterSurface = (s.heights[idx(tx, tz)] - WATER_DROP) * H_UNIT - 0.05;
      const ground = this.terrain.heightAt(c.x, c.y);
      rig.update(c, dt, this.time, ground, waterSurface, light);
    }
    for (const [id, rig] of this.rigs) if (!seen.has(id)) { this.group.remove(rig.group); rig.dispose(); this.rigs.delete(id); }
  }

  /** World-space position of a creature's rig (used by debug hooks). */
  positionOf(id) { const r = this.rigs.get(id); return r ? r.group.position : null; }

  dispose() { for (const rig of this.rigs.values()) { this.group.remove(rig.group); rig.dispose(); } this.rigs.clear(); }
}

export const creatureTemplate = template;
export const mergeParts = merge;
