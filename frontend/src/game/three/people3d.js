// ---- People: instanced humanoids for guests, staff and rapid-response units (bible 6 "guests_staff") ----
// Seven InstancedMeshes (head, hair/cap, torso, two legs, two arms) cover every person in the park.
// Per-person heading and gait phase are derived from position deltas; colours come from a deterministic
// hash of the entity id (guests) or the role (staff) so nothing depends on Math.random or the sim RNG.
import * as THREE from 'three';
import { Instances, hashId, scaleUV } from './materials';

const _root = new THREE.Matrix4(), _local = new THREE.Matrix4(), _m = new THREE.Matrix4();
const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(1, 1, 1), _c = new THREE.Color();
const UP = new THREE.Vector3(0, 1, 0);

const SKIN = ['#f1d3b8', '#e2b894', '#c98f68', '#a7704d', '#7d4f36', '#5a3826'];
const GUEST = ['#c9d6e8', '#8fb3d9', '#d9a76b', '#b7c9a1', '#e0c3d0', '#9fc5c9', '#d8d0b8', '#ad9ccf', '#e3e3e3', '#8ea3b8'];
const TROUSERS = ['#2c3340', '#3d4757', '#4a4038', '#26303a', '#5a5f66'];
const ROLE = { warden: '#F2C14E', biomedical: '#4DB6FF', xenobiologist: '#6EF3C5' };
const H = 0.42; // standing height in world units

export class PeopleLayer {
  constructor(group, kit) {
    const add = (inst) => { group.add(inst.mesh); return inst; };
    const cloth = kit.solid('#ffffff', { roughness: 0.9 });
    const skin = kit.solid('#ffffff', { roughness: 0.7 });
    this.head = add(new Instances(new THREE.SphereGeometry(0.045, 10, 8), skin, 256));
    this.hair = add(new Instances(new THREE.SphereGeometry(0.048, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.55), cloth, 256, { shadow: false }));
    const torso = new THREE.CapsuleGeometry(0.05, 0.11, 3, 8); scaleUV(torso, 1, 1);
    this.torso = add(new Instances(torso, cloth, 256));
    const leg = new THREE.CapsuleGeometry(0.024, 0.14, 3, 6); leg.translate(0, -0.085, 0);
    this.legL = add(new Instances(leg, cloth, 256));
    this.legR = add(new Instances(leg.clone(), cloth, 256));
    const arm = new THREE.CapsuleGeometry(0.017, 0.12, 3, 6); arm.translate(0, -0.075, 0);
    this.armL = add(new Instances(arm, cloth, 256));
    this.armR = add(new Instances(arm.clone(), cloth, 256));
    this.all = [this.head, this.hair, this.torso, this.legL, this.legR, this.armL, this.armR];
    this.track = new Map(); // id -> { x, y, heading, speed, gait }
    this.time = 0;
  }

  _person(id, x, z, groundY, dt, kind, tint, skinTone, capTint, scale = 1) {
    let t = this.track.get(id);
    if (!t) { t = { x, y: z, heading: hashId(id, 4) * Math.PI * 2, speed: 0, gait: hashId(id, 5) * 6, seen: 0 }; this.track.set(id, t); }
    t.seen = this.time;
    const dx = x - t.x, dz = z - t.y; t.x = x; t.y = z;
    const inst = dt > 0 ? Math.hypot(dx, dz) / dt : 0;
    if (inst < 30) t.speed += (inst - t.speed) * Math.min(1, dt * 8);
    if (Math.hypot(dx, dz) > 0.002) { let d = Math.atan2(dx, dz) - t.heading; d = Math.atan2(Math.sin(d), Math.cos(d)); t.heading += d * Math.min(1, dt * 9); }
    const moving = t.speed > 0.08;
    t.gait += (t.speed / 0.32) * dt * Math.PI * 2 * 0.5;
    const swing = moving ? Math.sin(t.gait) * 0.65 : Math.sin(this.time * 0.9 + id) * 0.04;
    const bob = moving ? Math.abs(Math.sin(t.gait)) * 0.012 : 0;
    _q.setFromAxisAngle(UP, t.heading);
    _root.compose(_p.set(x, groundY + bob, z), _q, _s.set(scale, scale, scale));
    // head + cap
    _c.set(skinTone);
    this.head.pushMatrix(_m.multiplyMatrices(_root, _local.makeTranslation(0, H - 0.045, 0)), _c);
    _c.set(capTint);
    this.hair.pushMatrix(_m.multiplyMatrices(_root, _local.makeTranslation(0, H - 0.035, 0)), _c);
    // torso
    _c.set(tint);
    this.torso.pushMatrix(_m.multiplyMatrices(_root, _local.makeTranslation(0, H * 0.62, 0)), _c);
    // legs (pivot at hip, swing about X)
    _c.set(TROUSERS[Math.floor(hashId(id, 6) * TROUSERS.length)]);
    if (kind === 'security') _c.set('#22262e');
    this.legL.pushMatrix(_m.multiplyMatrices(_root, _local.makeRotationX(swing).setPosition(0.028, H * 0.45, 0)), _c);
    this.legR.pushMatrix(_m.multiplyMatrices(_root, _local.makeRotationX(-swing).setPosition(-0.028, H * 0.45, 0)), _c);
    // arms swing opposite to the legs
    _c.set(tint).multiplyScalar(0.92);
    this.armL.pushMatrix(_m.multiplyMatrices(_root, _local.makeRotationX(-swing * 0.8).setPosition(0.072, H * 0.73, 0)), _c);
    this.armR.pushMatrix(_m.multiplyMatrices(_root, _local.makeRotationX(swing * 0.8).setPosition(-0.072, H * 0.73, 0)), _c);
  }

  sync(state, dt, heightAt) {
    this.time += dt;
    for (const l of this.all) l.begin();
    for (const g of state.guests) {
      if (g.riding) continue; // aboard a transport car
      const tint = GUEST[Math.floor(hashId(g.id, 2) * GUEST.length)];
      const skin = SKIN[Math.floor(hashId(g.id, 1) * SKIN.length)];
      const cap = hashId(g.id, 3) < 0.35 ? GUEST[Math.floor(hashId(g.id, 7) * GUEST.length)] : ['#2a1f1a', '#4a3527', '#1c1a1a', '#8a6a4a', '#d8c8a8'][Math.floor(hashId(g.id, 8) * 5)];
      this._person(g.id, g.x, g.y, heightAt(g.x, g.y), dt, 'guest', g.nightTour ? '#5a6478' : tint, skin, cap, 0.92 + hashId(g.id, 9) * 0.16);
    }
    for (const st of (state.staff || [])) {
      const tint = ROLE[st.role] || '#b7c4d6';
      const skin = SKIN[Math.floor(hashId(st.id, 1) * SKIN.length)];
      this._person(st.id, st.x, st.y, heightAt(st.x, st.y), dt, 'staff', tint, skin, tint, 1.02);
    }
    for (const u of (state.security?.units || [])) {
      this._person(u.id, u.x, u.y, heightAt(u.x, u.y), dt, 'security', '#4a2230', '#2a2e36', '#1c2028', 1.08);
    }
    for (const l of this.all) l.end();
    // forget people who left
    if (this.track.size > 64) for (const [id, t] of this.track) if (this.time - t.seen > 5) this.track.delete(id);
  }

  dispose() { for (const l of this.all) l.dispose(); }
}
