// ---- Shared PBR material kit for the 3D world (bible section 3) ----
// Every material here is render-only. Baked textures come from the TextureRegistry (with procedural
// stand-ins until they load); alpha-cut detail cards (foliage, grass blades, steel mesh) are drawn
// procedurally on a canvas at boot so they never depend on the offline pipeline.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { VIEW_DIR } from './iso';

// deterministic hash helpers (render-only jitter; never touches the sim RNG)
export const hash = (x, y, k = 0) => {
  let h = (Math.floor(x * 1000) * 374761393 + Math.floor(y * 1000) * 668265263 + k * 2246822519) >>> 0;
  h = (h ^ (h >>> 13)) * 1274126177 >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
export const hashId = (id, k = 0) => hash(id * 0.001 + 0.5, k * 0.37 + 0.25, k);

// ---------- procedural alpha cards ----------
function canvasTexture(size, draw) {
  const cv = document.createElement('canvas');
  cv.width = size; cv.height = size;
  const ctx = cv.getContext('2d');
  draw(ctx, size);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.anisotropy = 2;
  return tex;
}

let seed = 7;
const prand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

/** Cluster of leaf ellipses with soft edges: a foliage "puff" card. */
export function foliageCardTexture() {
  return canvasTexture(256, (ctx, S) => {
    ctx.clearRect(0, 0, S, S);
    seed = 11;
    for (let i = 0; i < 160; i++) {
      const a = prand() * Math.PI * 2, r = Math.pow(prand(), 0.6) * S * 0.42;
      const x = S / 2 + Math.cos(a) * r, y = S / 2 + Math.sin(a) * r * 0.9;
      const w = 10 + prand() * 18, h = w * (0.45 + prand() * 0.3), rot = prand() * Math.PI;
      const l = 0.78 + prand() * 0.42; // luminance variation, tinted by material colour
      ctx.fillStyle = `rgba(${Math.round(150 * l)},${Math.round(170 * l)},${Math.round(120 * l)},0.96)`;
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
      ctx.beginPath(); ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  });
}

/** A few tapering grass blades on a transparent card. */
export function grassBladeTexture() {
  return canvasTexture(128, (ctx, S) => {
    ctx.clearRect(0, 0, S, S);
    seed = 23;
    for (let i = 0; i < 11; i++) {
      const x0 = 10 + prand() * (S - 20), lean = (prand() - 0.5) * 40, top = 6 + prand() * 22, w = 5 + prand() * 5;
      const l = 0.8 + prand() * 0.4;
      ctx.fillStyle = `rgba(${Math.round(130 * l)},${Math.round(165 * l)},${Math.round(95 * l)},1)`;
      ctx.beginPath();
      ctx.moveTo(x0 - w / 2, S); ctx.quadraticCurveTo(x0 + lean * 0.3, S * 0.55, x0 + lean, top);
      ctx.quadraticCurveTo(x0 + lean * 0.4, S * 0.6, x0 + w / 2, S); ctx.closePath(); ctx.fill();
    }
  });
}

/** Woven steel mesh (alpha grid) for reinforced / heavy containment panels. */
export function steelMeshTexture() {
  const t = canvasTexture(128, (ctx, S) => {
    ctx.clearRect(0, 0, S, S);
    ctx.strokeStyle = 'rgba(205,212,220,1)';
    ctx.lineWidth = 2.2;
    const step = S / 6;
    ctx.beginPath();
    for (let i = 0; i <= 6; i++) { ctx.moveTo(i * step, 0); ctx.lineTo(i * step, S); ctx.moveTo(0, i * step); ctx.lineTo(S, i * step); }
    ctx.stroke();
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Soft radial blob (contact shadow / glow halo). */
export function radialTexture(inner = 0.0, outer = 1.0) {
  const t = canvasTexture(64, (ctx, S) => {
    const g = ctx.createRadialGradient(S / 2, S / 2, S * 0.5 * inner, S / 2, S / 2, S * 0.5 * outer);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  });
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

// ---------- wind (vertex displacement) ----------
// Installed through onBeforeCompile on flora materials: sway grows with local height, phase comes from
// the instance's world position so neighbouring plants never move in lockstep.
export const windUniforms = { uTime: { value: 0 }, uWind: { value: 1 }, uWindAmp: { value: 1 }, uGust: { value: 0 } };

export function installWind(material, { amp = 0.04, freq = 0.9, maxY = 1.0 } = {}) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = windUniforms.uTime;
    shader.uniforms.uWind = windUniforms.uWind;
    shader.uniforms.uWindAmp = windUniforms.uWindAmp;
    shader.uniforms.uGust = windUniforms.uGust;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        uniform float uTime; uniform float uWind; uniform float uWindAmp; uniform float uGust;`)
      .replace('#include <begin_vertex>', `
        vec3 transformed = vec3(position);
        {
          #ifdef USE_INSTANCING
            vec3 iw = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
          #else
            vec3 iw = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
          #endif
          float ph = iw.x * 1.7 + iw.z * 1.3;
          float hgt = clamp(position.y / ${maxY.toFixed(3)}, 0.0, 1.0);
          float g = sin(uTime * ${freq.toFixed(3)} + ph) + 0.35 * sin(uTime * ${(freq * 2.3).toFixed(3)} + ph * 1.7);
          // storm gusts: a fast flutter plus a steady lean downwind (+X-Z) that bends the whole plant
          g += uGust * (0.8 * sin(uTime * ${(freq * 4.1).toFixed(3)} + ph * 2.3) + 1.4);
          float sway = g * ${amp.toFixed(4)} * uWind * uWindAmp * hgt * hgt;
          transformed.x += sway; transformed.z += sway * 0.6 * cos(ph) - uGust * sway * 0.5;
        }`);
  };
  material.customProgramCacheKey = () => `wind2-${amp}-${freq}-${maxY}`;
  return material;
}

// ---------- emissive tinted by vertex colour (buildings: one material, many signage colours) ----------
export function installVertexEmissive(material) {
  material.vertexColors = true;
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      totalEmissiveRadiance *= vColor.rgb;`);
  };
  material.customProgramCacheKey = () => 'vertex-emissive';
  return material;
}

// ---------- geometry helpers ----------
/** Scale UVs so a repeating texture repeats `u`×`v` times over the geometry. */
export function scaleUV(geom, u, v = u) {
  const uv = geom.attributes.uv;
  if (!uv) return geom;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * u, uv.getY(i) * v);
  return geom;
}

/** Deterministically jitter vertices for organic silhouettes (canopies, rocks). */
export function jitterVertices(geom, amount, k = 1, smooth = true) {
  // hash on the position only: duplicated (non-indexed) vertices must move together or faces crack
  const p = geom.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const a = x * 7.13 + z * 3.1 + k, b = y * 5.7 + z * 1.3;
    const j = (hash(a, b, 1) - 0.5) * amount, j2 = (hash(a, b, 2) - 0.5) * amount, j3 = (hash(a, b, 3) - 0.5) * amount;
    p.setXYZ(i, x + j, y + j2, z + j3);
  }
  if (!smooth) { geom.computeVertexNormals(); return geom; } // keep facets (crystals)
  // weld duplicated verts so normals are smooth (polyhedra are non-indexed => faceted otherwise)
  const welded = mergeVertices(geom, 1e-4);
  welded.computeVertexNormals();
  geom.dispose();
  return welded;
}

/** Bake a colour attribute into a geometry (used by vertex-coloured materials). */
export function withColor(geom, color) {
  const c = new THREE.Color(color);
  const n = geom.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  geom.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geom;
}

/** Move / rotate / scale a geometry in place (helper for kit-bashing). */
export function place(geom, x = 0, y = 0, z = 0, { rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1 } = {}) {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
  geom.applyMatrix4(m);
  return geom;
}

export function merge(geoms) {
  const list = geoms.filter(Boolean);
  if (!list.length) return null;
  // drop attributes that are not shared by every part so merging never fails
  const names = list.map((g) => Object.keys(g.attributes));
  const common = names[0].filter((n) => names.every((ns) => ns.includes(n)));
  for (const g of list) for (const n of Object.keys(g.attributes)) if (!common.includes(n)) g.deleteAttribute(n);
  // mergeGeometries needs every part indexed or none: flatten when mixed
  const mixed = list.some((g) => !!g.index) && list.some((g) => !g.index);
  const parts = mixed ? list.map((g) => (g.index ? g.toNonIndexed() : g)) : list;
  const out = mergeGeometries(parts, false);
  for (const g of list) g.dispose();
  if (mixed) for (const g of parts) if (!list.includes(g)) g.dispose();
  return out;
}

/** Quaternion that turns a +Z-facing card towards the fixed iso camera (cards never need updating). */
export const CARD_QUAT = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), VIEW_DIR.clone().normalize());

// ---------- the kit ----------
export class MaterialKit {
  constructor(registry) {
    this.registry = registry;
    this.cache = new Map();
    this.foliageTex = foliageCardTexture();
    this.grassTex = grassBladeTexture();
    this.meshTex = steelMeshTexture();
    this.radialTex = radialTexture();
  }

  /** PBR material bound to a registry texture set (albedo/normal/rough). */
  pbr(key, { color = '#ffffff', boost = 1, roughness = 1, metalness = 0, normalScale = 0.6, vertexColors = false, emissive = null, emissiveIntensity = 1, side = THREE.FrontSide, transparent = false, opacity = 1, flatShading = false } = {}) {
    const id = `${key}|${color}|${boost}|${roughness}|${metalness}|${normalScale}|${vertexColors}|${emissive}|${side}|${opacity}|${flatShading}`;
    if (this.cache.has(id)) return this.cache.get(id);
    const r = this.registry;
    // very dark baked albedos (dark steel, roofing) are lifted with a >1 colour multiplier
    const tint = new THREE.Color(color).multiplyScalar(boost);
    const mat = new THREE.MeshStandardMaterial({
      color: tint, roughness, metalness, vertexColors, side, transparent, opacity, flatShading,
      map: key ? r.get(key, 'albedo', color) : null,
      normalMap: key ? r.get(key, 'normal') : null,
      roughnessMap: key ? r.get(key, 'rough') : null,
      normalScale: new THREE.Vector2(normalScale, normalScale),
      emissive: emissive || '#000000', emissiveIntensity,
    });
    this.cache.set(id, mat);
    return mat;
  }

  /** Plain (untextured) PBR material. */
  solid(color, { roughness = 0.8, metalness = 0, emissive = null, emissiveIntensity = 1, transparent = false, opacity = 1, side = THREE.FrontSide, vertexColors = false, flatShading = false } = {}) {
    const id = `solid|${color}|${roughness}|${metalness}|${emissive}|${emissiveIntensity}|${opacity}|${side}|${vertexColors}|${flatShading}`;
    if (this.cache.has(id)) return this.cache.get(id);
    const mat = new THREE.MeshStandardMaterial({ color, roughness, metalness, transparent, opacity, side, vertexColors, flatShading, emissive: emissive || '#000000', emissiveIntensity });
    this.cache.set(id, mat);
    return mat;
  }

  /** Bloom-safe emissive surface. */
  glow(color, intensity = 1.2) {
    const id = `glow|${color}|${intensity}`;
    if (this.cache.has(id)) return this.cache.get(id);
    const mat = new THREE.MeshStandardMaterial({ color: '#0a0a0a', roughness: 0.3, emissive: color, emissiveIntensity: intensity });
    this.cache.set(id, mat);
    return mat;
  }

  /** Glass: moderate transparency, tinted, glossy (bible: no true refraction). */
  glass(tint = '#A7F3FF', opacity = 0.42) {
    const id = `glass|${tint}|${opacity}`;
    if (this.cache.has(id)) return this.cache.get(id);
    const mat = new THREE.MeshPhysicalMaterial({ color: tint, roughness: 0.08, metalness: 0, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false, clearcoat: 1, clearcoatRoughness: 0.05, reflectivity: 0.8 });
    this.cache.set(id, mat);
    return mat;
  }

  /** Alpha-cut card material (foliage / grass); optional wind. */
  card(tex, { color = '#ffffff', roughness = 0.85, wind = null, emissive = null, emissiveIntensity = 0 } = {}) {
    const mat = new THREE.MeshStandardMaterial({ map: tex, color, roughness, metalness: 0, alphaTest: 0.45, side: THREE.DoubleSide, transparent: false, emissive: emissive || '#000000', emissiveIntensity });
    if (wind) installWind(mat, wind);
    return mat;
  }

  dispose() { for (const m of this.cache.values()) m.dispose(); this.cache.clear(); this.foliageTex.dispose(); this.grassTex.dispose(); this.meshTex.dispose(); this.radialTex.dispose(); }
}

/** InstancedMesh wrapper with capacity growth + per-instance colour + arbitrary rotation. */
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), UP = new THREE.Vector3(0, 1, 0);
export class Instances {
  constructor(geometry, material, initial = 64, { shadow = true, receive = true, renderOrder = 0 } = {}) {
    this.geometry = geometry; this.material = material; this.shadow = shadow; this.receive = receive; this.renderOrder = renderOrder;
    this.mesh = null; this.count = 0; this.parent = null;
    this.grow(initial);
  }
  grow(n) {
    const old = this.mesh;
    const mesh = new THREE.InstancedMesh(this.geometry, this.material, n);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.castShadow = this.shadow; mesh.receiveShadow = this.receive; mesh.frustumCulled = false;
    mesh.renderOrder = this.renderOrder;
    mesh.count = 0;
    if (old) { const p = old.parent; if (p) { p.remove(old); p.add(mesh); } old.dispose(); }
    this.mesh = mesh; this.capacity = n;
  }
  begin() { this.count = 0; }
  push(pos, scale, color, rotY = 0) {
    if (this.count >= this.capacity) this.grow(this.capacity * 2);
    _q.setFromAxisAngle(UP, rotY);
    _m.compose(pos, _q, scale);
    this.mesh.setMatrixAt(this.count, _m);
    if (color) this.mesh.setColorAt(this.count, color);
    this.count++;
  }
  pushEuler(pos, scale, color, rx, ry, rz) {
    if (this.count >= this.capacity) this.grow(this.capacity * 2);
    _q.setFromEuler(_e.set(rx, ry, rz));
    _m.compose(pos, _q, scale);
    this.mesh.setMatrixAt(this.count, _m);
    if (color) this.mesh.setColorAt(this.count, color);
    this.count++;
  }
  pushQuat(pos, scale, color, quat) {
    if (this.count >= this.capacity) this.grow(this.capacity * 2);
    _m.compose(pos, quat, scale);
    this.mesh.setMatrixAt(this.count, _m);
    if (color) this.mesh.setColorAt(this.count, color);
    this.count++;
  }
  pushMatrix(m, color) {
    if (this.count >= this.capacity) this.grow(this.capacity * 2);
    this.mesh.setMatrixAt(this.count, m);
    if (color) this.mesh.setColorAt(this.count, color);
    this.count++;
  }
  end() {
    this.mesh.count = this.count;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
  dispose() { if (this.mesh.parent) this.mesh.parent.remove(this.mesh); this.mesh.dispose(); this.geometry.dispose(); }
}
