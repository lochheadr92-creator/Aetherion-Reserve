// ---- Flora: instanced procedural plants with baked bark/leaf PBR and shader wind (bible 3 / 6) ----
// One geometry per plant part, one InstancedMesh per part. Instances are rebuilt only when the veg
// map changes; motion lives entirely in the wind vertex shader, so a still frame costs nothing.
import * as THREE from 'three';
import { MAP_SIZE, VEG } from '../constants';
import { Instances, hash, installWind, scaleUV, jitterVertices, place, merge, CARD_QUAT } from './materials';

const _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();

// canopy tints multiply the (already green) leaf albedo; kept light so the texture carries the colour
const TINT = { 2: '#d8ecc4', 3: '#e6f0d4', 4: '#c9dfc0', 1: '#f2f6dc', 5: '#b8dccc' };

function lobeCluster(lobes, detail = 2) {
  return merge(lobes.map(([x, y, z, r], i) => {
    const g = jitterVertices(new THREE.IcosahedronGeometry(r, detail), r * 0.22, i + 1);
    scaleUV(g, 2.2, 2.2);
    return place(g, x, y, z);
  }));
}

function trunkGeometry(rTop, rBot, h, branches = 0, seedK = 1) {
  const parts = [scaleUV(place(new THREE.CylinderGeometry(rTop, rBot, h, 9, 3), 0, h / 2, 0), 1.6, 2.4)];
  for (let i = 0; i < branches; i++) {
    const a = (i / branches) * Math.PI * 2 + hash(seedK, i) * 0.8;
    const b = new THREE.CylinderGeometry(rTop * 0.35, rTop * 0.8, h * 0.55, 6, 1);
    place(b, 0, h * 0.275, 0);                         // base at origin, pointing up
    place(b, 0, 0, 0, { rz: 0.6 + hash(seedK, i + 9) * 0.25 }); // tilt outward
    place(b, 0, 0, 0, { ry: a });                      // spin around the trunk
    place(b, 0, h * 0.62, 0);                          // lift to the branch fork
    scaleUV(b, 1, 1.4);
    parts.push(b);
  }
  return merge(parts);
}

export class FloraLayer {
  constructor(group, kit, terrain, quality) {
    this.kit = kit; this.terrain = terrain; this.group = group;
    const low = quality === 'low';
    const windAmp = low ? 0.35 : quality === 'medium' ? 0.7 : 1;
    const add = (inst) => { group.add(inst.mesh); return inst; };

    const bark = kit.pbr('bark', { roughness: 0.88, normalScale: 0.9 });
    // kit materials are cached by options: clone before installing wind so each use keeps its own program
    const canopyMat = installWind(kit.pbr('leaves', { roughness: 0.72, normalScale: 0.55 }).clone(), { amp: 0.02 * windAmp, freq: 1.13, maxY: 2.0 });
    const shrubMat = installWind(kit.pbr('leaves', { roughness: 0.78, normalScale: 0.5 }).clone(), { amp: 0.035 * windAmp, freq: 1.57, maxY: 0.5 });
    const cardMat = kit.card(kit.foliageTex, { color: '#ffffff', roughness: 0.8, wind: { amp: 0.03 * windAmp, freq: 1.13, maxY: 0.6 } });
    const grassMat = kit.card(kit.grassTex, { color: '#ffffff', roughness: 0.9, wind: { amp: 0.06 * windAmp, freq: 2.2, maxY: 0.35 } });
    const reedMat = installWind(kit.solid('#6f9d6b', { roughness: 0.85 }).clone(), { amp: 0.08 * windAmp, freq: 2.5, maxY: 0.7 });
    const bloomMat = kit.solid('#cfeee6', { roughness: 0.6, emissive: '#7FFFE1', emissiveIntensity: 0.12 });
    const sporeMat = installWind(kit.pbr('skin_gel', { color: '#5a4470', roughness: 0.7, normalScale: 0.5 }).clone(), { amp: 0.015 * windAmp, freq: 0.75, maxY: 0.9 });
    this.sporeCapMat = kit.glow('#B58CFF', 0.6);
    const frondMat = installWind(kit.pbr('skin_scales', { color: '#2f5f80', roughness: 0.55, normalScale: 0.6, emissive: '#7FFFE1', emissiveIntensity: 0.08 }).clone(), { amp: 0.045 * windAmp, freq: 1.38, maxY: 1.1 });
    this.frondTipMat = kit.glow('#7FFFE1', 0.6);

    // ---- geometries (origin at the base) ----
    // small tree: trunk 1.05, three-lobe canopy
    this.smallTrunk = add(new Instances(trunkGeometry(0.055, 0.085, 1.05, 2, 3), bark, 256));
    this.smallCanopy = add(new Instances(lobeCluster([[0, 1.25, 0, 0.46], [0.28, 1.05, 0.12, 0.32], [-0.24, 1.08, -0.18, 0.3], [0.02, 1.0, 0.3, 0.26]]), canopyMat, 256));
    // canopy tree: thick trunk with branches, five-lobe crown
    this.largeTrunk = add(new Instances(trunkGeometry(0.09, 0.15, 1.35, 3, 7), bark, 128));
    this.largeCanopy = add(new Instances(lobeCluster([[0, 1.85, 0, 0.7], [0.5, 1.55, 0.2, 0.46], [-0.45, 1.6, -0.25, 0.44], [0.1, 1.5, -0.5, 0.4], [-0.15, 1.55, 0.5, 0.38], [0, 2.25, 0, 0.42]]), canopyMat, 128));
    // foliage cards fluff the crown silhouette (camera-facing, never updated)
    const card = new THREE.PlaneGeometry(1, 1);
    this.cards = add(new Instances(card, cardMat, 1024, { shadow: !low }));
    // shrub: four low lobes
    this.shrub = add(new Instances(lobeCluster([[0, 0.22, 0, 0.26], [0.2, 0.18, 0.1, 0.2], [-0.18, 0.2, -0.12, 0.19], [0.02, 0.16, -0.22, 0.17]], 1), shrubMat, 256));
    // tall grass: two crossed blade cards per clump
    const blades = merge([place(new THREE.PlaneGeometry(0.45, 0.42), 0, 0.21, 0), place(new THREE.PlaneGeometry(0.45, 0.42), 0, 0.21, 0, { ry: Math.PI / 2 })]);
    this.grass = add(new Instances(blades, grassMat, 2048, { shadow: false }));
    // reeds: a fan of thin cones + pale blooms
    const reeds = merge(Array.from({ length: 7 }, (_, i) => {
      const a = (i / 7) * Math.PI * 2, r = 0.09 + hash(i, 3) * 0.06, h = 0.5 + hash(i, 4) * 0.25;
      return place(place(new THREE.ConeGeometry(0.02, h, 5), 0, h / 2, 0, { rz: 0.18 }), Math.cos(a) * r, 0, Math.sin(a) * r, { ry: a });
    }));
    this.reeds = add(new Instances(reeds, reedMat, 256, { shadow: false }));
    const blooms = merge(Array.from({ length: 3 }, (_, i) => place(new THREE.SphereGeometry(0.045, 8, 6), (hash(i, 5) - 0.5) * 0.2, 0.55 + hash(i, 6) * 0.2, (hash(i, 7) - 0.5) * 0.2)));
    this.blooms = add(new Instances(blooms, bloomMat, 256, { shadow: false }));
    // spore pillar: stacked bulbs + glowing cap
    const spore = merge([
      place(new THREE.SphereGeometry(0.16, 12, 9), 0, 0.14, 0, { sy: 0.8 }),
      place(new THREE.SphereGeometry(0.13, 12, 9), 0, 0.38, 0, { sy: 0.9 }),
      place(new THREE.SphereGeometry(0.11, 12, 9), 0, 0.58, 0),
      place(new THREE.CylinderGeometry(0.05, 0.09, 0.5, 8), 0, 0.25, 0),
    ]);
    this.spore = add(new Instances(spore, sporeMat, 128));
    this.sporeCap = add(new Instances(place(new THREE.SphereGeometry(0.15, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0, 0.68, 0, { sy: 0.55 }), this.sporeCapMat, 128, { shadow: false }));
    // aether frond: six tapered fronds leaning outward, glowing tips
    const fronds = merge(Array.from({ length: 6 }, (_, i) => {
      const a = (i / 6) * Math.PI * 2 + 0.3, h = 0.8 + hash(i, 8) * 0.35;
      const g = new THREE.ConeGeometry(0.05, h, 6);
      place(g, 0, h / 2, 0); place(g, 0, 0, 0, { rz: 0.42 }); place(g, 0, 0, 0, { ry: a });
      return g;
    }));
    this.frond = add(new Instances(fronds, frondMat, 128));
    const tips = merge(Array.from({ length: 6 }, (_, i) => {
      const a = (i / 6) * Math.PI * 2 + 0.3, h = 0.8 + hash(i, 8) * 0.35;
      const d = Math.sin(0.42) * h, y = Math.cos(0.42) * h;
      return place(new THREE.SphereGeometry(0.035, 8, 6), -d * Math.cos(a), y, d * Math.sin(a));
    }));
    this.tips = add(new Instances(tips, this.frondTipMat, 128, { shadow: false }));
    this.all = [this.smallTrunk, this.smallCanopy, this.largeTrunk, this.largeCanopy, this.cards, this.shrub, this.grass, this.reeds, this.blooms, this.spore, this.sporeCap, this.frond, this.tips];
    this.low = low;
  }

  rebuild(state) {
    const s = state;
    for (const l of this.all) l.begin();
    const gy = (x, z) => this.terrain.heightAt(x, z);
    for (let i = 0; i < s.veg.length; i++) {
      const v = s.veg[i]; if (!v) continue;
      const x = i % MAP_SIZE, z = Math.floor(i / MAP_SIZE);
      const jx = 0.3 + hash(x, z, 1) * 0.4, jz = 0.3 + hash(x, z, 2) * 0.4;
      const px = x + jx, pz = z + jz, y = gy(px, pz);
      const rot = hash(x, z, 5) * Math.PI * 2;
      const scl = 0.85 + hash(x, z, 3) * 0.3;
      const lum = (hash(x, z, 4) - 0.5) * 0.12;
      if (v === 3 || v === 4) {
        const big = v === 4;
        _c.set(TINT[v]).offsetHSL((hash(x, z, 6) - 0.5) * 0.03, 0, lum);
        (big ? this.largeTrunk : this.smallTrunk).push(_p.set(px, y - 0.02, pz), _s.set(scl, scl, scl), null, rot);
        (big ? this.largeCanopy : this.smallCanopy).push(_p.set(px, y, pz), _s.set(scl, scl, scl), _c, rot);
        if (!this.low) {
          const n = big ? 7 : 4, cy = (big ? 1.8 : 1.2) * scl, cr = (big ? 0.62 : 0.42) * scl;
          for (let k = 0; k < n; k++) {
            const a = hash(x, z, 40 + k) * Math.PI * 2, r = cr * (0.55 + hash(x, z, 60 + k) * 0.6);
            const cs = (big ? 0.9 : 0.62) * (0.8 + hash(x, z, 80 + k) * 0.4) * scl;
            _c.set(TINT[v]).offsetHSL(0, 0, lum + (hash(x, z, 90 + k) - 0.5) * 0.1);
            this.cards.pushQuat(_p.set(px + Math.cos(a) * r, y + cy + (hash(x, z, 70 + k) - 0.4) * cr, pz + Math.sin(a) * r), _s.set(cs, cs, cs), _c, CARD_QUAT);
          }
        }
      } else if (v === 2) {
        _c.set(TINT[2]).offsetHSL(0, 0, lum);
        this.shrub.push(_p.set(px, y, pz), _s.set(scl * 1.1, scl, scl * 1.1), _c, rot);
        if (!this.low) for (let k = 0; k < 2; k++) {
          const a = hash(x, z, 40 + k) * Math.PI * 2;
          this.cards.pushQuat(_p.set(px + Math.cos(a) * 0.14, y + 0.24 * scl, pz + Math.sin(a) * 0.14), _s.set(0.42 * scl, 0.42 * scl, 1), _c, CARD_QUAT);
        }
      } else if (v === 1) {
        const n = this.low ? 3 : 5;
        for (let k = 0; k < n; k++) {
          const ox = hash(x, z, 10 + k) * 0.8 + 0.1, oz = hash(x, z, 20 + k) * 0.8 + 0.1;
          _c.set(TINT[1]).offsetHSL((hash(x, z, 50 + k) - 0.5) * 0.04, 0, (hash(x, z, 30 + k) - 0.5) * 0.14);
          const gs = 0.8 + hash(x, z, 60 + k) * 0.5;
          this.grass.push(_p.set(x + ox, gy(x + ox, z + oz) - 0.01, z + oz), _s.set(gs, gs, gs), _c, hash(x, z, 70 + k) * Math.PI);
        }
      } else if (v === 5) {
        _c.set(TINT[5]).offsetHSL(0, 0, lum);
        this.reeds.push(_p.set(px, y - 0.02, pz), _s.set(scl, scl, scl), _c, rot);
        this.blooms.push(_p.set(px, y, pz), _s.set(scl, scl, scl), null, rot);
        // second tuft for density
        const ox = 0.2 + hash(x, z, 11) * 0.5, oz = 0.2 + hash(x, z, 12) * 0.5;
        this.reeds.push(_p.set(x + ox, gy(x + ox, z + oz) - 0.02, z + oz), _s.set(scl * 0.8, scl * 0.85, scl * 0.8), _c, rot + 1.3);
      } else if (v === 6) {
        this.spore.push(_p.set(px, y - 0.02, pz), _s.set(scl, scl * (0.9 + hash(x, z, 9) * 0.5), scl), null, rot);
        this.sporeCap.push(_p.set(px, y - 0.02, pz), _s.set(scl, scl * (0.9 + hash(x, z, 9) * 0.5), scl), null, rot);
      } else if (v === 7) {
        this.frond.push(_p.set(px, y - 0.02, pz), _s.set(scl, scl, scl), null, rot);
        this.tips.push(_p.set(px, y - 0.02, pz), _s.set(scl, scl, scl), null, rot);
      }
    }
    for (const l of this.all) l.end();
  }

  /** Night ramps bioluminescence up (bible 2: alien flora emissives). */
  update(light) {
    const n = light.night;
    this.sporeCapMat.emissiveIntensity = 0.35 + 1.1 * n;
    this.frondTipMat.emissiveIntensity = 0.3 + 1.0 * n;
  }

  dispose() { for (const l of this.all) l.dispose(); }
}

export const vegName = (v) => (VEG[v] ? VEG[v].name : 'none');
