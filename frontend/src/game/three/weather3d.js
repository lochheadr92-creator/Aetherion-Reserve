// ---- Living weather: rain splashes on hard surfaces (paths, slabs, rooftops) during storms ----
// A pool of instanced additive rings. Each splash lives ~0.4s: it pops as a bright dot, expands into a
// thinning ring and fades. Spawn positions are sampled inside the visible iso diamond every frame,
// snapped to the surface under them (building roof/slab or path ground); water tiles are skipped
// because the water shader draws its own rain rings. Pure render effect - Math.random is fine here.
import * as THREE from 'three';
import { MAP_SIZE } from '../constants';
import { idx, inMap } from '../state';
import { Instances } from './materials';

const _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
const SQ2 = Math.SQRT1_2;

function ringTexture() {
  const S = 64, cv = document.createElement('canvas');
  cv.width = S; cv.height = S;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(S / 2, S / 2, S * 0.26, S / 2, S / 2, S * 0.5);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.55, 'rgba(255,255,255,1)');
  g.addColorStop(0.8, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

export class RainSplashes {
  constructor(group, terrain, buildings, quality) {
    this.terrain = terrain; this.buildings = buildings;
    this.tex = ringTexture();
    const mat = new THREE.MeshBasicMaterial({ map: this.tex, color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    this.inst = new Instances(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), mat, 256, { shadow: false, receive: false, renderOrder: 8 });
    group.add(this.inst.mesh);
    this.pool = [];
    this.setQuality(quality);
    this.spawnAcc = 0;
  }

  setQuality(q) { this.max = q === 'low' ? 0 : q === 'medium' ? 110 : 220; }

  /** Surface height for a splash at (x, z) or null when rain would hit water / soft ground. */
  surfaceAt(state, x, z) {
    const tx = Math.floor(x), tz = Math.floor(z);
    if (!inMap(tx, tz)) return null;
    const i = idx(tx, tz);
    if (state.water[i]) return null;
    const roof = this.buildings.roofAt(x, z);
    if (roof != null) return roof + 0.01;
    if (state.paths && state.paths[i]) return this.terrain.heightAt(x, z) + 0.01;
    // occasional splash on open ground keeps the whole scene alive without carpeting it
    return Math.random() < 0.2 ? this.terrain.heightAt(x, z) + 0.01 : null;
  }

  sync(state, dt, light, view) {
    const storm = light.storm || 0;
    const pool = this.pool;
    // age + retire
    for (let i = pool.length - 1; i >= 0; i--) { pool[i].age += dt; if (pool[i].age >= pool[i].life) { pool[i] = pool[pool.length - 1]; pool.pop(); } }
    // spawn inside the visible diamond, rate scaled by storm strength and the visible area
    if (storm > 0.05 && this.max > 0 && view) {
      const area = Math.min(2600, view.halfW * view.halfH * 4);
      this.spawnAcc += dt * storm * this.max * 5.0 * Math.min(1, 90 / Math.max(30, area) + 0.35);
      let n = Math.floor(this.spawnAcc); this.spawnAcc -= n;
      while (n-- > 0 && pool.length < this.max) {
        const u = (Math.random() * 2 - 1) * view.halfW, v = (Math.random() * 2 - 1) * view.halfH * 2;
        const x = view.target.x + (u - v) * SQ2, z = view.target.z + (-u - v) * SQ2;
        const y = this.surfaceAt(state, x, z);
        if (y == null) continue;
        pool.push({ x, y, z, age: 0, life: 0.32 + Math.random() * 0.18, size: 0.14 + Math.random() * 0.12 });
      }
    }
    this.inst.begin();
    for (const sp of pool) {
      const t = sp.age / sp.life;
      const r = sp.size * (0.15 + 0.85 * t);
      const bright = (1 - t) * (1 - t) * (0.55 + 0.45 * storm) * (0.6 + 0.4 * (1 - light.night * 0.5));
      _c.setScalar(bright);
      this.inst.push(_p.set(sp.x, sp.y, sp.z), _s.set(r, 1, r * 0.75), _c, 0);
    }
    this.inst.end();
    this.inst.mesh.visible = pool.length > 0;
  }

  dispose() { this.inst.dispose(); this.tex.dispose(); }
}

export const mapSize = MAP_SIZE;
