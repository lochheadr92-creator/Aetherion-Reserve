// ---- Fences & gates: tiered instanced barriers (bible 3 "fences") ----
// T1 galvanized posts + rails, T2 dark steel + mesh panel, T3 concrete plinth + steel mesh + top bar,
// T4 composite posts with an animated energy field. Damage darkens the tint and tilts posts; a gate
// swaps the rails for a framed door panel with a hazard strip. Rebuilt every frame (a few hundred
// segments at most) straight from state.fences; never writes back.
import * as THREE from 'three';
import { FENCES } from '../constants';
import { Instances, hash, scaleUV, place, merge } from './materials';

const _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
const HEIGHT = { 1: 0.55, 2: 0.7, 3: 0.85, 4: 0.92 };
const TINT = { 1: '#eef1f4', 2: '#aab2ba', 3: '#7a8189', 4: '#454b53' };

const FIELD_VERT = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec4 mv = vec4(position, 1.0);
    #ifdef USE_INSTANCING
      mv = instanceMatrix * mv;
    #endif
    gl_Position = projectionMatrix * modelViewMatrix * mv;
  }`;
const FIELD_FRAG = `
  uniform float uTime; uniform vec3 uColor; uniform float uNight;
  varying vec2 vUv;
  float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  void main() {
    float warp = h21(floor(vUv * vec2(24.0, 12.0)) + floor(uTime * 6.0)) * 0.03;
    float scan = 0.5 + 0.5 * sin((vUv.y + warp) * 46.0 - uTime * 3.2);
    float edge = smoothstep(0.0, 0.12, vUv.y) * smoothstep(1.0, 0.86, vUv.y);
    float lattice = max(step(0.955, fract(vUv.x * 6.0 + warp)), step(0.93, fract(vUv.y * 4.0)));
    float a = (0.11 + 0.07 * scan + 0.12 * lattice) * edge * (0.75 + 0.45 * uNight);
    gl_FragColor = vec4(uColor * (1.1 + 0.7 * scan + 0.6 * lattice), a);
  }`;

export class FenceLayer {
  constructor(group, kit) {
    this.kit = kit;
    const add = (inst) => { group.add(inst.mesh); return inst; };
    const steel = kit.pbr('steel', { boost: 1.05, roughness: 0.5, metalness: 0.55, normalScale: 0.6 });
    const concrete = kit.pbr('concrete', { color: '#8e9297', roughness: 0.86, normalScale: 0.65 });
    const meshMat = new THREE.MeshStandardMaterial({ map: kit.meshTex, color: '#b8bfc6', roughness: 0.5, metalness: 0.8, alphaTest: 0.4, side: THREE.DoubleSide });
    this.fieldMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color('#6FEAFF') }, uNight: { value: 0 } },
      vertexShader: FIELD_VERT, fragmentShader: FIELD_FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    });
    this.bandMat = kit.glow('#6FEAFF', 0.9);
    this.hazardMat = kit.glow('#FFB86B', 0.7);

    // post: square column + cap, base at origin, height 1 (scaled per tier)
    const post = merge([
      scaleUV(place(new THREE.BoxGeometry(0.085, 1, 0.085), 0, 0.5, 0), 0.3, 1.2),
      place(new THREE.BoxGeometry(0.12, 0.035, 0.12), 0, 1.0, 0),
    ]);
    this.post = add(new Instances(post, steel, 1024));
    this.rail = add(new Instances(scaleUV(new THREE.BoxGeometry(1, 0.042, 0.034), 1.6, 0.2), steel, 1024));
    this.topBar = add(new Instances(scaleUV(new THREE.BoxGeometry(1.02, 0.06, 0.09), 1.6, 0.2), steel, 512));
    this.panel = add(new Instances(scaleUV(new THREE.PlaneGeometry(0.96, 1), 3, 2), meshMat, 512, { shadow: false }));
    this.plinth = add(new Instances(scaleUV(new THREE.BoxGeometry(1, 0.16, 0.16), 1.2, 0.3), concrete, 512));
    this.field = add(new Instances(new THREE.PlaneGeometry(0.96, 1), this.fieldMat, 256, { shadow: false, receive: false, renderOrder: 6 }));
    this.band = add(new Instances(new THREE.BoxGeometry(0.1, 0.05, 0.1), this.bandMat, 512, { shadow: false }));
    // gate: door panel with a recessed frame and a hazard strip
    const door = merge([
      scaleUV(place(new THREE.BoxGeometry(0.86, 0.86, 0.05), 0, 0.5, 0), 1.2, 1.2),
      place(new THREE.BoxGeometry(0.9, 0.06, 0.09), 0, 0.96, 0),
    ]);
    this.gate = add(new Instances(door, steel, 128));
    this.hazard = add(new Instances(place(new THREE.BoxGeometry(0.7, 0.05, 0.06), 0, 0.5, 0), this.hazardMat, 128, { shadow: false }));
    this.all = [this.post, this.rail, this.topBar, this.panel, this.plinth, this.field, this.band, this.gate, this.hazard];
    this.time = 0;
    this._posts = new Map();
  }

  sync(state, heightAt) {
    const s = state;
    for (const l of this.all) l.begin();
    const posts = this._posts; posts.clear();
    const notePost = (x, z, tier, hp) => {
      const k = x * 1000 + z;
      const e = posts.get(k);
      if (!e) posts.set(k, { x, z, tier, hp });
      else { e.tier = Math.max(e.tier, tier); e.hp = Math.min(e.hp, hp); }
    };
    for (const key of Object.keys(s.fences)) {
      const f = s.fences[key]; if (!f) continue;
      const [xs, zs, d] = key.split(',');
      const x = +xs, z = +zs;
      const tier = FENCES[f.tier] ? f.tier : 1;
      const def = FENCES[tier];
      const H = HEIGHT[tier];
      const hp = Math.max(0, Math.min(1, f.hp / (def.hp || 100)));
      const ax = d === 'E' ? x + 1 : x, az = d === 'E' ? z : z + 1;
      const bx = x + 1, bz = z + 1;
      notePost(ax, az, tier, hp); notePost(bx, bz, tier, hp);
      const mx = (ax + bx) / 2, mz = (az + bz) / 2;
      const ym = (heightAt(ax, az) + heightAt(bx, bz)) / 2;
      const rotY = d === 'E' ? Math.PI / 2 : 0;
      // damage: scrape-darkening (bible: -8% sat) and a shallow lean when the segment is failing
      _c.set(TINT[tier]).offsetHSL(0, -0.08 * (1 - hp), -0.22 * (1 - hp));
      if (f.gate) {
        this.gate.push(_p.set(mx, ym, mz), _s.set(1, H, 1), _c, rotY);
        this.hazard.push(_p.set(mx, ym, mz), _s.set(1, H * 0.9, 1), null, rotY);
        continue;
      }
      if (tier === 1) {
        for (const fr of [0.42, 0.82]) this.rail.push(_p.set(mx, ym + H * fr, mz), _s.set(1, 1, 1), _c, rotY);
      } else if (tier === 2) {
        for (const fr of [0.25, 0.6, 0.95]) this.rail.push(_p.set(mx, ym + H * fr, mz), _s.set(1, 1, 1), _c, rotY);
        this.panel.push(_p.set(mx, ym + H * 0.55, mz), _s.set(1, H * 0.62, 1), _c, rotY);
      } else if (tier === 3) {
        this.plinth.push(_p.set(mx, ym + 0.08, mz), _s.set(1, 1, 1), null, rotY);
        this.panel.push(_p.set(mx, ym + 0.16 + H * 0.42, mz), _s.set(1, H * 0.74, 1), _c, rotY);
        this.topBar.push(_p.set(mx, ym + H, mz), _s.set(1, 1, 1), _c, rotY);
      } else {
        this.rail.push(_p.set(mx, ym + H * 0.12, mz), _s.set(1, 1, 1), _c, rotY);
        this.topBar.push(_p.set(mx, ym + H, mz), _s.set(1, 1, 1), _c, rotY);
        this.field.push(_p.set(mx, ym + H * 0.55, mz), _s.set(1, H * 0.8, 1), null, rotY);
      }
    }
    for (const e of posts.values()) {
      const H = HEIGHT[e.tier] + 0.06;
      const y = heightAt(e.x, e.z);
      _c.set(TINT[e.tier]).offsetHSL(0, -0.08 * (1 - e.hp), -0.22 * (1 - e.hp));
      const lean = e.hp < 0.5 ? (0.5 - e.hp) * 0.28 * (hash(e.x, e.z) - 0.5) : 0;
      const w = e.tier >= 3 ? 1.35 : e.tier === 2 ? 1.15 : 1;
      this.post.pushEuler(_p.set(e.x, y - 0.02, e.z), _s.set(w, H, w), _c, lean, hash(e.x, e.z, 2) * 0.05, lean * 0.6);
      if (e.tier === 4) for (const fr of [0.3, 0.62, 0.94]) this.band.push(_p.set(e.x, y + H * fr, e.z), _s.set(1.1, 1, 1.1), null);
    }
    for (const l of this.all) l.end();
  }

  update(dt, light) {
    this.time += dt;
    this.fieldMat.uniforms.uTime.value = this.time;
    this.fieldMat.uniforms.uNight.value = light.night;
    this.bandMat.emissiveIntensity = 0.5 + 0.9 * light.night;
    this.hazardMat.emissiveIntensity = 0.4 + 0.8 * light.night;
  }

  dispose() { for (const l of this.all) l.dispose(); this.fieldMat.dispose(); }
}
