// ---- Water: one merged surface over every water tile, animated PBR-ish shader (bible 3 / 6) ----
import * as THREE from 'three';
import { MAP_SIZE } from '../constants';
import { idx, inMap } from '../state';
import { H_UNIT, VIEW_DIR } from './iso';
import { WATER_DROP } from './terrain';

const N = MAP_SIZE;

const VERT = `
  attribute float aDepth;   // 1 shallow, 2 deep
  attribute float aShore;   // 1 at corners touching land, 0 inside the body
  varying vec3 vWPos; varying float vDepth; varying float vShore;
  #include <fog_pars_vertex>
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWPos = wp.xyz; vDepth = aDepth; vShore = aShore;
    vec4 mvPosition = viewMatrix * wp;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }`;

const FRAG = `
  uniform sampler2D uNormal; uniform float uTime; uniform vec3 uSunDir; uniform vec3 uSunColor;
  uniform vec3 uShallow; uniform vec3 uDeep; uniform vec3 uSky; uniform vec3 uFoam; uniform vec3 uToCam;
  uniform float uNight; uniform float uQuality;
  varying vec3 vWPos; varying float vDepth; varying float vShore;
  #include <fog_pars_fragment>
  void main() {
    vec2 p = vWPos.xz;
    float speed = mix(0.022, 0.014, step(1.5, vDepth));
    vec3 n1 = texture2D(uNormal, p * 0.55 + vec2(uTime * speed, uTime * speed * 0.7)).xyz * 2.0 - 1.0;
    vec3 n2 = uQuality > 0.5 ? texture2D(uNormal, p * 0.31 - vec2(uTime * speed * 0.6, -uTime * speed * 0.9)).xyz * 2.0 - 1.0 : vec3(0.0, 0.0, 1.0);
    vec3 nt = normalize(vec3(n1.xy * 0.6 + n2.xy * 0.4, 1.0));
    // tangent space (x -> +X, y -> -Z) to world, gentle strength
    vec3 n = normalize(vec3(nt.x * 0.35, 1.0, -nt.y * 0.35));
    vec3 V = normalize(uToCam);
    float fres = pow(1.0 - max(dot(n, V), 0.0), mix(4.0, 5.0, step(1.5, vDepth)));
    vec3 base = mix(uShallow, uDeep, step(1.5, vDepth));
    vec3 col = mix(base, uSky, clamp(fres * 0.7, 0.0, 0.8));
    // sun glints
    vec3 L = normalize(uSunDir);
    vec3 R = reflect(-L, n);
    float spec = pow(max(dot(R, V), 0.0), 140.0) * (1.0 - uNight * 0.6);
    col += uSunColor * spec * 0.9;
    // shoreline foam: animated threshold along the corner-shore gradient
    float foamBand = smoothstep(0.72, 1.0, vShore + 0.08 * sin(uTime * 1.1 + p.x * 3.1 + p.y * 2.3));
    float ripple = 0.5 + 0.5 * sin(uTime * 2.2 + (p.x + p.y) * 9.0 + n1.x * 4.0);
    col = mix(col, uFoam, foamBand * (0.14 + 0.14 * ripple));
    float alpha = clamp(0.74 + fres * 0.25 + foamBand * 0.12, 0.0, 0.95);
    gl_FragColor = vec4(col, alpha);
    #include <fog_fragment>
  }`;

export class Water {
  constructor(registry) {
    this.registry = registry;
    this.geometry = null;
    this.uniforms = {
      uNormal: { value: registry.file('water_normal.jpg', 'normal') },
      uTime: { value: 0 },
      uSunDir: { value: new THREE.Vector3(-0.6, 0.8, 0.1) },
      uSunColor: { value: new THREE.Color('#fff2dc') },
      uShallow: { value: new THREE.Color('#2C8E9C') },
      uDeep: { value: new THREE.Color('#0E4C5E') },
      uSky: { value: new THREE.Color('#A7F3FF') },
      uFoam: { value: new THREE.Color('#D7F6FF') },
      uToCam: { value: VIEW_DIR.clone() },
      uNight: { value: 0 },
      uQuality: { value: 1 },
    };
    this.material = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, this.uniforms]),
      vertexShader: VERT, fragmentShader: FRAG,
      transparent: true, depthWrite: false, fog: true,
    });
    // merge() clones uniform values; keep our handles pointing at the live objects
    this.uniforms = this.material.uniforms;
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
    this.mesh.name = 'water';
    this.time = 0;
  }

  rebuild(state) {
    const water = state.water, heights = state.heights;
    const verts = [], depths = [], shores = [], indices = [];
    let vi = 0;
    const isLand = (x, z) => !inMap(x, z) || !water[idx(x, z)];
    for (let z = 0; z < N; z++) {
      for (let x = 0; x < N; x++) {
        const i = idx(x, z);
        if (!water[i]) continue;
        const y = (heights[i] - WATER_DROP) * H_UNIT;
        // corner touches land if any of the (up to 4) tiles around that corner is land
        const cornerShore = (cx, cz) => (isLand(cx - 1, cz - 1) || isLand(cx, cz - 1) || isLand(cx - 1, cz) || isLand(cx, cz)) ? 1 : 0;
        const c = [[x, z], [x + 1, z], [x + 1, z + 1], [x, z + 1]];
        for (const [cx, cz] of c) {
          verts.push(cx, y, cz);
          depths.push(water[i]);
          shores.push(cornerShore(cx, cz));
        }
        indices.push(vi, vi + 2, vi + 1, vi, vi + 3, vi + 2);
        vi += 4;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    g.setAttribute('aDepth', new THREE.Float32BufferAttribute(depths, 1));
    g.setAttribute('aShore', new THREE.Float32BufferAttribute(shores, 1));
    g.setIndex(indices);
    g.computeBoundingSphere();
    this.mesh.geometry.dispose();
    this.mesh.geometry = g;
    this.mesh.visible = vi > 0;
  }

  update(dt, light) {
    this.time += dt;
    const u = this.uniforms;
    u.uTime.value = this.time;
    u.uNight.value = light.night;
    u.uSunDir.value.copy(light.sunDir);
    u.uSunColor.value.copy(light.sunColor);
    u.uSky.value.copy(light.skyColor).lerp(new THREE.Color('#A7F3FF'), 0.35);
  }

  setQuality(q) { this.uniforms.uQuality.value = q === 'low' ? 0 : 1; }

  dispose() { this.mesh.geometry.dispose(); this.material.dispose(); }
}
