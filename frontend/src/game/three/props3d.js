// ---- Props: waste, the park entrance gate and the elevated transport (guideway + cars) ----
// Waste is instanced; the entrance is a small static kit; guideways are tubes along the same quadratic
// arc the sim describes (station -> raised mid-point -> station) and the cars ride it at car.t.
import * as THREE from 'three';
import { idx, inMap } from '../state';
import { Instances, hash, scaleUV, place, merge } from './materials';
import { stationPylon } from './buildings3d';

const _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color(), _t = new THREE.Vector3();

export class PropLayer {
  constructor(group, kit, terrain) {
    this.group = group; this.kit = kit; this.terrain = terrain;
    const add = (inst) => { group.add(inst.mesh); return inst; };
    const waste = new THREE.DodecahedronGeometry(0.11, 0); waste.scale(1.1, 0.6, 1);
    this.waste = add(new Instances(waste, kit.solid('#4d4a2e', { roughness: 0.98 }), 64, { shadow: false }));
    this.steel = kit.pbr('darksteel', { boost: 2.3, roughness: 0.5, metalness: 0.5, normalScale: 0.55 });
    this.lightSteel = kit.pbr('steel', { boost: 1.1, roughness: 0.5, metalness: 0.55, normalScale: 0.5 });
    this.lampMat = kit.glow('#2DE2E6', 1.0);
    this.entrance = null; this._entranceKey = null;
    this.guideways = new Map(); // car.key -> { mesh, curve }
    this.cars = new Map();      // car.id -> { group, key }
    this.time = 0;
  }

  // ---- entrance: twin pylons + header beam + turnstile posts, at the map's front edge ----
  _buildEntrance(e, heightAt) {
    const cx = e.x + 0.5, cz = e.y + 0.5, y = heightAt(cx, cz);
    const g = new THREE.Group(); g.name = 'entrance';
    const mk = (geom, mat, shadow = true) => { const m = new THREE.Mesh(geom, mat); m.castShadow = shadow; m.receiveShadow = true; g.add(m); return m; };
    mk(scaleUV(place(new THREE.BoxGeometry(2.2, 0.08, 1.2), cx, y + 0.04, cz), 2, 1), this.kit.pbr('concrete', { color: '#c9ccd0', roughness: 0.86 }));
    for (const dx of [-0.85, 0.85]) {
      mk(scaleUV(place(new THREE.BoxGeometry(0.22, 1.5, 0.22), cx + dx, y + 0.83, cz), 0.5, 2), this.steel);
      mk(place(new THREE.BoxGeometry(0.3, 0.06, 0.3), cx + dx, y + 1.61, cz), this.lightSteel);
      mk(place(new THREE.SphereGeometry(0.05, 10, 8), cx + dx, y + 1.45, cz + 0.14), this.lampMat, false);
    }
    mk(scaleUV(place(new THREE.BoxGeometry(2.0, 0.16, 0.26), cx, y + 1.72, cz), 2, 0.3), this.steel);
    mk(place(new THREE.BoxGeometry(1.6, 0.04, 0.02), cx, y + 1.72, cz + 0.14), this.lampMat, false);
    for (const dx of [-0.35, 0, 0.35]) mk(place(new THREE.CylinderGeometry(0.03, 0.035, 0.5, 8), cx + dx, y + 0.33, cz + 0.35), this.lightSteel);
    mk(place(new THREE.BoxGeometry(1.0, 0.03, 0.03), cx, y + 0.56, cz + 0.35), this.lightSteel);
    return g;
  }

  // ---- transport ----
  _curveFor(car, state, heightAt) {
    const a = state.buildings.find((b) => b.id === car.aId), b = state.buildings.find((b2) => b2.id === car.bId);
    const pa = a ? stationPylon(a, heightAt) : { x: car.a.x + 0.5, y: heightAt(car.a.x + 0.5, car.a.y + 0.5) + 2.3, z: car.a.y + 0.5 };
    const pb = b ? stationPylon(b, heightAt) : { x: car.b.x + 0.5, y: heightAt(car.b.x + 0.5, car.b.y + 0.5) + 2.3, z: car.b.y + 0.5 };
    const dist = Math.hypot(pb.x - pa.x, pb.z - pa.z);
    const mid = new THREE.Vector3((pa.x + pb.x) / 2, Math.max(pa.y, pb.y) + 1.2 + dist * 0.08, (pa.z + pb.z) / 2);
    return new THREE.QuadraticBezierCurve3(new THREE.Vector3(pa.x, pa.y, pa.z), mid, new THREE.Vector3(pb.x, pb.y, pb.z));
  }

  _buildGuideway(car, curve) {
    const tube = new THREE.TubeGeometry(curve, 32, 0.035, 6, false);
    const mesh = new THREE.Mesh(tube, this.lightSteel);
    mesh.castShadow = true; mesh.frustumCulled = false; mesh.name = `guideway-${car.key}`;
    return mesh;
  }

  _buildCar(car) {
    const g = new THREE.Group(); g.name = `car-${car.id}`;
    const tint = new THREE.Color(car.color || '#2DE2E6');
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.42, 4, 10).rotateZ(Math.PI / 2), this.steel);
    body.castShadow = true; g.add(body);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.165, 0.165, 0.34, 12, 1, true).rotateZ(Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#0a1014', roughness: 0.2, emissive: tint, emissiveIntensity: 0.9, side: THREE.DoubleSide }));
    band.position.y = 0.03; g.add(band);
    const hanger = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.22, 0.04), this.lightSteel); hanger.position.y = 0.24; g.add(hanger);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), this.kit.glow('#F2C14E', 1.2)); lamp.position.set(0.36, 0, 0); g.add(lamp);
    g.userData.lamp = lamp;
    return g;
  }

  sync(state, dt, light) {
    this.time += dt;
    const heightAt = (x, z) => this.terrain.heightAt(x, z);
    // waste
    this.waste.begin();
    for (const w of (state.waste || [])) {
      const x = w.x + 0.5, z = w.y + 0.5;
      this.waste.push(_p.set(x + (hash(w.x, w.y, 1) - 0.5) * 0.3, heightAt(x, z) + 0.03, z + (hash(w.x, w.y, 2) - 0.5) * 0.3), _s.set(1, 1, 1), null, hash(w.x, w.y) * 6.28);
    }
    this.waste.end();
    // entrance (rebuilt if it moves or the terrain shifts under it)
    const e = state.entrance;
    const ek = e ? `${e.x},${e.y},${heightAt(e.x + 0.5, e.y + 0.5).toFixed(3)}` : null;
    if (ek !== this._entranceKey) {
      if (this.entrance) { this.group.remove(this.entrance); this.entrance.traverse((o) => o.geometry && o.geometry.dispose()); }
      this.entrance = e ? this._buildEntrance(e, heightAt) : null;
      if (this.entrance) this.group.add(this.entrance);
      this._entranceKey = ek;
    }
    // transport
    const cars = state.transport?.cars || [];
    const liveKeys = new Set(), liveIds = new Set();
    for (const car of cars) {
      liveKeys.add(car.key); liveIds.add(car.id);
      let gw = this.guideways.get(car.key);
      if (!gw) {
        const curve = this._curveFor(car, state, heightAt);
        gw = { mesh: this._buildGuideway(car, curve), curve };
        this.group.add(gw.mesh);
        this.guideways.set(car.key, gw);
      }
      let cg = this.cars.get(car.id);
      if (!cg) { cg = { group: this._buildCar(car), key: car.key }; this.group.add(cg.group); this.cars.set(car.id, cg); }
      const t = Math.max(0, Math.min(1, car.t));
      gw.curve.getPoint(t, _p);
      gw.curve.getTangent(t, _t);
      cg.group.position.copy(_p).y -= 0.34; // car hangs under the guideway
      cg.group.rotation.y = Math.atan2(_t.x, _t.z) - Math.PI / 2;
      cg.group.userData.lamp.material.emissiveIntensity = (Math.floor(this.time * 3) % 2 === 0 ? 1.2 : 0.3);
      cg.group.scale.setScalar(car.dir > 0 ? 1 : 1);
    }
    for (const [key, gw] of this.guideways) if (!liveKeys.has(key)) { this.group.remove(gw.mesh); gw.mesh.geometry.dispose(); this.guideways.delete(key); }
    for (const [id, cg] of this.cars) if (!liveIds.has(id)) { this.group.remove(cg.group); cg.group.traverse((o) => o.geometry && o.geometry.dispose()); this.cars.delete(id); }
    this.lampMat.emissiveIntensity = 0.6 + 0.9 * light.night;
  }

  /** Terrain edits move station pylons: drop cached guideways so they re-fit. */
  invalidate() {
    for (const [key, gw] of this.guideways) { this.group.remove(gw.mesh); gw.mesh.geometry.dispose(); this.guideways.delete(key); }
    this._entranceKey = null;
  }

  dispose() {
    this.waste.dispose();
    if (this.entrance) { this.group.remove(this.entrance); this.entrance.traverse((o) => o.geometry && o.geometry.dispose()); }
    this.invalidate();
    for (const [, cg] of this.cars) { this.group.remove(cg.group); cg.group.traverse((o) => o.geometry && o.geometry.dispose()); }
    this.cars.clear();
  }
}

export const tileInMap = inMap;
export const tileIdx = idx;
export const mergeGeoms = merge;
