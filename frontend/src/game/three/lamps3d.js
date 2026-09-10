// ---- Night lighting pass: warm path lamps + cool building floodlights that switch on at dusk ----
// Render-only. Placement is a pure, deterministic function of state (paths / buildings / terrain), so the
// same park always lights the same way. Every lamp is instanced (post, head, bulb, ground pool); a small
// pool of real PointLights is re-assigned each frame to the lamps nearest the camera focus so nearby
// surfaces actually pick up the light without paying for hundreds of dynamic lights. The dusk curve is a
// smoothstep of the rig's night factor: lamps warm up through dusk, hold at night and fade out at dawn.
import * as THREE from 'three';
import { MAP_SIZE } from '../constants';
import { idx, inMap } from '../state';
import { BUILDINGS } from '../data/buildings';
import { lampTarget } from '../construction';
import { Instances, hash, radialTexture } from './materials';
import { buildingBaseY } from './buildings3d';

const _p = new THREE.Vector3(), _s = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _m = new THREE.Matrix4();
const DOWN = new THREE.Vector3(0, -1, 0);
const LAMP_WARM = '#FFB347';       // sodium-warm path lamps
const FLOOD_COOL = '#DDF3FF';      // cool white floods
const LAMP_STRIDE = 4;             // one lamp every N path tiles along an edge (deterministic)
const LAMP_MAX = 320;              // hard cap on path lamps (the stride widens beyond it)
const LIGHTS_BY_QUALITY = { low: 0, medium: 4, high: 8 };

/** 0 (day) .. 1 (full night) switch curve from the rig's night factor: warming through dusk (night .35 -> ~.36),
 *  mostly lit as dusk hands over to night (.57 -> ~.86), full at night, off again as dawn breaks (.15 -> 0). */
export const lampSwitch = (night) => THREE.MathUtils.smoothstep(night, 0.12, 0.7);

// ---- deterministic placement ----
// A lamp stands on a path tile that borders a non-path tile (walkway edges), every LAMP_STRIDE tiles along
// the diagonal so runs read as a regular row; the post is offset toward the open side so it never blocks the
// middle of the walkway.
export function pathLampSpots(state) {
  const paths = state.paths || [];
  const spots = [];
  for (let i = 0; i < paths.length; i++) {
    if (!paths[i]) continue;
    const x = i % MAP_SIZE, y = Math.floor(i / MAP_SIZE);
    if ((x + y) % LAMP_STRIDE !== 0) continue;
    let ox = 0, oz = 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (!inMap(nx, ny) || !paths[idx(nx, ny)]) { ox = dx; oz = dy; break; }
    }
    if (!ox && !oz) continue; // interior plaza tile: no lamp
    spots.push({ x: x + 0.5 + ox * 0.36, z: y + 0.5 + oz * 0.36, key: i });
  }
  if (spots.length > LAMP_MAX) { const step = Math.ceil(spots.length / LAMP_MAX); return spots.filter((_, k) => k % step === 0); }
  // player-placed Path Lamps stand at their tile centre (never thinned)
  for (const b of state.buildings) if (BUILDINGS[b.type]?.lamp === 'path') spots.push({ x: b.x + 0.5, z: b.y + 0.5, key: `b${b.id}`, player: true });
  return spots;
}

// Player-placed Floodlight Masts: a free-standing pole aimed at the nearest building.
export const FLOOD_MAST_H = 1.9;
export function playerFloodSpots(state, heightAt) {
  const out = [];
  for (const b of state.buildings) {
    if (BUILDINGS[b.type]?.lamp !== 'flood') continue;
    const x = b.x + 0.5, z = b.y + 0.5;
    const y = heightAt(x, z);
    const t = lampTarget(state, b);
    let dx = 1, dz = 1;
    if (t) { dx = t.x - x; dz = t.y - z; }
    const n = Math.hypot(dx, dz) || 1;
    out.push({ x, z, top: y + FLOOD_MAST_H, dx: dx / n, dz: dz / n, id: b.id, key: `m${b.id}`, mast: true, base: y });
  }
  return out;
}

// Floodlights sit on the camera-facing (+x) roof corners and throw an oval pool outward from the corner.
// `roofAt(x, z, fallback)` resolves the real roof surface under the mount (see LampLayer.roofHeightAt).
export function floodSpots(state, heightAt, roofAt = null) {
  const out = [];
  for (const b of state.buildings) {
    const def = BUILDINGS[b.type]; if (!def) continue;
    const w = b.w || def.w, h = b.h || def.h;
    const y = buildingBaseY(b, heightAt) + 0.04;
    const estimate = y + Math.min(2.2, 0.9 + 0.35 * Math.max(w, h)); // used only when no roof geometry is available
    const corners = [{ x: b.x + w - 0.2, z: b.y + h - 0.2, dx: 1, dz: 1 }];
    if (w * h >= 4) corners.push({ x: b.x + w - 0.2, z: b.y + 0.2, dx: 1, dz: -1 });
    for (const c of corners) {
      const n = Math.hypot(c.dx, c.dz);
      const top = roofAt ? roofAt(c.x, c.z, estimate) : estimate;
      if (top < y + 0.3) continue; // nothing to mount on at this corner (open platform edge)
      out.push({ x: c.x, z: c.z, top, dx: c.dx / n, dz: c.dz / n, id: b.id, key: `${b.id}:${c.dx},${c.dz}` });
    }
  }
  return out;
}

export class LampLayer {
  constructor(group, kit, terrain, buildings, quality = 'medium') {
    this.group = group; this.kit = kit; this.terrain = terrain; this.buildings = buildings;
    this.quality = quality;
    this._ray = new THREE.Raycaster(); this._ray.far = 200;
    const add = (inst) => { group.add(inst.mesh); return inst; };
    this.steel = kit.pbr('darksteel', { boost: 2.0, roughness: 0.55, metalness: 0.55, normalScale: 0.5 });
    // bulbs / lenses are not cached kit materials: their emissive intensity animates with the dusk curve
    this.bulbMat = new THREE.MeshStandardMaterial({ color: '#1a1206', roughness: 0.3, emissive: LAMP_WARM, emissiveIntensity: 0 });
    this.lensMat = new THREE.MeshStandardMaterial({ color: '#0b0f14', roughness: 0.25, emissive: FLOOD_COOL, emissiveIntensity: 0 });
    this.poolTex = radialTexture(0.0, 1.0);
    this.poolMat = new THREE.MeshBasicMaterial({ map: this.poolTex, color: LAMP_WARM, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    this.floodPoolMat = new THREE.MeshBasicMaterial({ map: this.poolTex, color: FLOOD_COOL, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    // path lamps: post + head + bulb + ground pool
    this.post = add(new Instances(new THREE.CylinderGeometry(0.022, 0.03, 1.0, 7).translate(0, 0.5, 0), this.steel, 128, { shadow: true }));
    this.head = add(new Instances(new THREE.BoxGeometry(0.13, 0.04, 0.13).translate(0, 1.06, 0), this.steel, 128, { shadow: false }));
    this.bulb = add(new Instances(new THREE.SphereGeometry(0.05, 10, 8).translate(0, 0.98, 0), this.bulbMat, 128, { shadow: false, receive: false }));
    this.pool = add(new Instances(new THREE.PlaneGeometry(1.7, 1.7).rotateX(-Math.PI / 2), this.poolMat, 128, { shadow: false, receive: false, renderOrder: 3 }));
    // floodlights: mast + tilted head + lens + oval pool
    this.mast = add(new Instances(new THREE.CylinderGeometry(0.018, 0.022, 0.34, 6).translate(0, 0.17, 0), this.steel, 32, { shadow: false }));
    this.floodHead = add(new Instances(new THREE.BoxGeometry(0.17, 0.1, 0.13), this.steel, 32, { shadow: false }));
    this.lens = add(new Instances(new THREE.BoxGeometry(0.15, 0.085, 0.02), this.lensMat, 32, { shadow: false, receive: false }));
    this.floodPool = add(new Instances(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), this.floodPoolMat, 32, { shadow: false, receive: false, renderOrder: 3 }));
    // free-standing masts for player floodlights (roof floods reuse the short mast above)
    this.pole = add(new Instances(new THREE.CylinderGeometry(0.03, 0.045, FLOOD_MAST_H, 8).translate(0, FLOOD_MAST_H / 2, 0), this.steel, 32, { shadow: true }));
    // real lights (pooled)
    this.lights = [];
    this.setQuality(quality);
    this.spots = [];       // path lamps: { x, y, z }
    this.floods = [];      // floodlights: { x, y, z, px, pz }
    this.signature = null;
    this.on = 0;
    this.time = 0;
    this.count = 0;
  }

  setQuality(q) {
    this.quality = q;
    const want = LIGHTS_BY_QUALITY[q] ?? 4;
    while (this.lights.length > want) { const l = this.lights.pop(); this.group.remove(l); l.dispose(); }
    while (this.lights.length < want) {
      const l = new THREE.PointLight(LAMP_WARM, 0, 4.5, 2);
      l.castShadow = false; l.visible = false;
      this.group.add(l); this.lights.push(l);
    }
  }

  /** Terrain edits: lamp feet must re-fit the new heightfield. */
  invalidate() { this.signature = null; }

  /** Real roof surface under (x, z): a downward ray against the merged building meshes (rebuild-time only). */
  roofHeightAt(x, z, fallback) {
    const meshes = [];
    for (const [bucket, m] of Object.entries(this.buildings?.meshes || {})) if (bucket !== 'glass' && bucket !== 'glow') { m.updateMatrixWorld(true); meshes.push(m); }
    if (!meshes.length) return fallback;
    this._ray.set(_p.set(x, 80, z), DOWN);
    const hits = this._ray.intersectObjects(meshes, false);
    return hits.length ? hits[0].point.y : fallback;
  }

  _signature(state) {
    let a = 0;
    const paths = state.paths || [];
    for (let i = 0; i < paths.length; i++) if (paths[i]) a = (a * 31 + i) % 2147483647;
    let b = '';
    for (const bld of state.buildings) b += `${bld.type}:${bld.x},${bld.y};`;
    return `${a}|${paths.length}|${b}`;
  }

  _rebuild(state) {
    const heightAt = (x, z) => this.terrain.heightAt(x, z);
    this.spots = pathLampSpots(state).map((s) => ({ ...s, y: heightAt(s.x, s.z) }));
    this.floods = [...floodSpots(state, heightAt, (x, z, fb) => this.roofHeightAt(x, z, fb)), ...playerFloodSpots(state, heightAt)].map((f) => {
      const reach = f.mast ? 1.6 : 1.15;
      const px = f.x + f.dx * reach, pz = f.z + f.dz * reach;
      return { ...f, py: heightAt(px, pz), px, pz };
    });
    this.playerLamps = this.spots.filter((s) => s.player).length;
    this.playerFloods = this.floods.filter((f) => f.mast).length;
    this.count = this.spots.length;
    // static instance transforms (pool / bulb intensities animate through their shared materials)
    this.post.begin(); this.head.begin(); this.bulb.begin(); this.pool.begin();
    for (const s of this.spots) {
      const rot = hash(s.x, s.z, 9) * Math.PI * 2;
      this.post.push(_p.set(s.x, s.y, s.z), _s.set(1, 1, 1), null, rot);
      this.head.push(_p, _s, null, rot);
      this.bulb.push(_p, _s, null, rot);
      this.pool.push(_p.set(s.x, s.y + 0.02, s.z), _s.set(1, 1, 1), null, rot);
    }
    this.post.end(); this.head.end(); this.bulb.end(); this.pool.end();
    this.mast.begin(); this.floodHead.begin(); this.lens.begin(); this.floodPool.begin(); this.pole.begin();
    for (const f of this.floods) {
      const yaw = Math.atan2(f.dx, f.dz);
      if (f.mast) this.pole.push(_p.set(f.x, f.base, f.z), _s.set(1, 1, 1), null, yaw);
      else this.mast.push(_p.set(f.x, f.top, f.z), _s.set(1, 1, 1), null, yaw);
      // head tilted down ~38deg toward the pool, lens on its front face
      _q.setFromEuler(_e.set(0.66, yaw, 0, 'YXZ'));
      _m.compose(_p.set(f.x, f.top + 0.36, f.z), _q, _s.set(1, 1, 1));
      this.floodHead.pushMatrix(_m, null);
      const fx = f.x + f.dx * 0.085, fz = f.z + f.dz * 0.085;
      _m.compose(_p.set(fx, f.top + 0.325, fz), _q, _s);
      this.lens.pushMatrix(_m, null);
      // oval pool: long axis along the throw direction (local +x -> (dx, dz) after a Y rotation of atan2(-dz, dx))
      this.floodPool.push(_p.set(f.px, f.py + 0.02, f.pz), _s.set(f.mast ? 3.2 : 2.6, 1, f.mast ? 2.1 : 1.7), null, Math.atan2(-f.dz, f.dx));
    }
    this.mast.end(); this.floodHead.end(); this.lens.end(); this.floodPool.end(); this.pole.end();
  }

  sync(state, dt, light, view = null) {
    this.time += dt;
    const sig = this._signature(state);
    if (sig !== this.signature) { this.signature = sig; this._rebuild(state); }
    // dusk curve + a faint mains hum on the warm bulbs
    const on = lampSwitch(light.night);
    this.on = on;
    const hum = 1 + 0.06 * Math.sin(this.time * 11.3) * on;
    this.bulbMat.emissiveIntensity = on * 2.4 * hum;
    this.lensMat.emissiveIntensity = on * 3.0;
    this.poolMat.opacity = on * 0.34;
    this.floodPoolMat.opacity = on * 0.26;
    this.bulb.mesh.visible = this.pool.mesh.visible = this.lens.mesh.visible = this.floodPool.mesh.visible = on > 0.01;
    // real lights: nearest lamps to the camera focus (floods first — they are the strongest sources)
    if (this.lights.length) {
      const tx = view?.target?.x ?? MAP_SIZE / 2, tz = view?.target?.z ?? MAP_SIZE / 2;
      const cands = [];
      for (const f of this.floods) cands.push({ x: f.px, y: f.py + 0.9, z: f.pz, d: Math.hypot(f.px - tx, f.pz - tz) - 3, warm: false });
      for (const s of this.spots) cands.push({ x: s.x, y: s.y + 0.95, z: s.z, d: Math.hypot(s.x - tx, s.z - tz), warm: true });
      cands.sort((a, b) => a.d - b.d);
      for (let i = 0; i < this.lights.length; i++) {
        const l = this.lights[i], c = cands[i];
        if (!c || on < 0.01) { l.visible = false; l.intensity = 0; continue; }
        l.visible = true;
        l.position.set(c.x, c.y, c.z);
        l.color.set(c.warm ? LAMP_WARM : FLOOD_COOL);
        l.distance = c.warm ? 4.5 : 7;
        l.intensity = on * (c.warm ? 2.2 * hum : 3.6);
      }
    }
  }

  dispose() {
    for (const inst of [this.post, this.head, this.bulb, this.pool, this.mast, this.floodHead, this.lens, this.floodPool, this.pole]) inst.dispose();
    for (const l of this.lights) { this.group.remove(l); l.dispose(); }
    this.lights.length = 0;
    this.bulbMat.dispose(); this.lensMat.dispose(); this.poolMat.dispose(); this.floodPoolMat.dispose(); this.poolTex.dispose();
  }
}
