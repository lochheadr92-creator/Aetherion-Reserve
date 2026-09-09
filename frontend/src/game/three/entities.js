// ---- Entity orchestrator: every non-terrain object class of the world, synced from authoritative state ----
// Layers own their meshes; this class only decides when each one needs a rebuild (static layers) or a
// per-frame sync (living things), and shares the material kit + wind uniforms between them.
import * as THREE from 'three';
import { MATERIALS } from '../constants';
import { idx, inMap } from '../state';
import { H_UNIT } from './iso';
import { MaterialKit, Instances, windUniforms } from './materials';
import { FloraLayer } from './flora3d';
import { FenceLayer } from './fences3d';
import { BuildingLayer } from './buildings3d';
import { CreatureLayer } from './creatures3d';
import { PeopleLayer } from './people3d';
import { PropLayer } from './props3d';
import { RainSplashes } from './weather3d';

const _p = new THREE.Vector3(), _s = new THREE.Vector3();

export class EntityLayers {
  constructor(scene, terrain, registry, quality = 'medium') {
    this.scene = scene; this.terrain = terrain;
    this.group = new THREE.Group(); this.group.name = 'entities';
    scene.add(this.group);
    this.kit = new MaterialKit(registry);
    const heightAt = (x, z) => terrain.heightAt(x, z);
    this.heightAt = heightAt;
    this.flora = new FloraLayer(this.group, this.kit, terrain, quality);
    this.fences = new FenceLayer(this.group, this.kit);
    this.buildings = new BuildingLayer(this.group, this.kit);
    this.creatures = new CreatureLayer(this.group, this.kit, terrain);
    this.people = new PeopleLayer(this.group, this.kit);
    this.props = new PropLayer(this.group, this.kit, terrain);
    this.rain = new RainSplashes(this.group, terrain, this.buildings, quality);
    // soft contact blobs ground living things under the flat iso light (bible 7)
    const blobGeom = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    this.blobs = new Instances(blobGeom, new THREE.MeshBasicMaterial({ map: this.kit.radialTex, color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }), 256, { shadow: false, receive: false, renderOrder: 2 });
    this.group.add(this.blobs.mesh);
    this.vegSig = null;
    this.terrainVersion = -1;
    this.quality = quality;
  }

  /** Called after the terrain mesh was rebuilt: everything planted on it must re-fit. */
  onTerrainRebuilt() { this.vegSig = null; this.buildingsDirty = true; this.props.invalidate(); }

  vegSignature(veg) {
    let a = 0, b = 0;
    for (let i = 0; i < veg.length; i++) { const v = veg[i]; if (v) { a = (a + v * (i + 1)) % 2147483647; b = (b * 31 + v) % 2147483647; } }
    return a * 3 + b;
  }

  setQuality(q) { this.quality = q; this.rain.setQuality(q); }

  sync(state, dt, light, view = null) {
    const s = state;
    windUniforms.uTime.value += dt;
    windUniforms.uWind.value = light.wind;
    windUniforms.uGust.value = light.gust || 0;
    windUniforms.uWindAmp.value = this.quality === 'low' ? 0.3 : 1;
    // static layers: rebuild on change only
    const vs = this.vegSignature(s.veg);
    if (vs !== this.vegSig) { this.vegSig = vs; this.flora.rebuild(s); }
    this.flora.update(light);
    this.buildings.sync(s, this.heightAt, this.buildingsDirty);
    this.buildingsDirty = false;
    this.buildings.update(light);
    // dynamic layers
    this.fences.sync(s, this.heightAt);
    this.fences.update(dt, light);
    this.creatures.sync(s, dt, light);
    this.people.sync(s, dt, this.heightAt);
    this.props.sync(s, dt, light);
    this.rain.sync(s, dt, light, view);
    // contact blobs
    this.blobs.begin();
    for (const rig of this.creatures.rigs.values()) {
      const L = rig.group.scale.x;
      this.blobs.push(_p.set(rig.group.position.x, this.heightAt(rig.group.position.x, rig.group.position.z) + 0.015, rig.group.position.z), _s.set(L * 1.1, 1, L * 0.9), null, rig.heading);
    }
    for (const g of s.guests) { if (g.riding) continue; this.blobs.push(_p.set(g.x, this.heightAt(g.x, g.y) + 0.012, g.y), _s.set(0.26, 1, 0.26), null); }
    for (const st of (s.staff || [])) this.blobs.push(_p.set(st.x, this.heightAt(st.x, st.y) + 0.012, st.y), _s.set(0.27, 1, 0.27), null);
    this.blobs.end();
  }

  dispose() {
    this.flora.dispose(); this.fences.dispose(); this.buildings.dispose(); this.creatures.dispose(); this.people.dispose(); this.props.dispose(); this.rain.dispose();
    this.blobs.dispose();
    this.kit.dispose();
    this.scene.remove(this.group);
  }
}

export const materialColor = (id) => (MATERIALS[id] ? MATERIALS[id].color : '#22352a');
export const inMapTile = inMap;
export const tileIndex = idx;
export const HEIGHT_UNIT = H_UNIT;
