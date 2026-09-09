// ---- Terrain: smooth heightfield + splat-blended PBR ground (materials / paths / cliffs) ----
// Geometry: (MAP_SIZE+1)^2 vertices; a corner takes the mean height of the land tiles around it,
// water-only corners sink into a basin. The tile-id map (72x72 DataTexture) drives a 4-tap soft
// blend between the ground layers of the texture atlas so material borders read as painted edges
// instead of hard diamonds. Slopes fade into the cliff layer. Alien grounds carry a faint emissive
// speckle (bible 3 / 2). Everything is render-only.
import * as THREE from 'three';
import { MAP_SIZE, MAX_H } from '../constants';
import { idx, inMap } from '../state';
import { H_UNIT } from './iso';
import { GROUND_LAYERS, LAYER_PATH, LAYER_CLIFF, LAYER_REPEAT, materialLayer } from './textures';

const LAYER_SAND = GROUND_LAYERS.indexOf('sand'), LAYER_MUD = GROUND_LAYERS.indexOf('mud');

const N = MAP_SIZE;
const V = N + 1;
const BASIN = { 1: 1.3, 2: 2.6 }; // basin depth targets (height steps) under shallow / deep water
export const WATER_DROP = 0.14;   // water surface sits this many height steps under the tile top

export class Terrain {
  constructor(registry, quality) {
    this.registry = registry;
    this.corner = new Float32Array(V * V);           // world Y per lattice corner
    this.geometry = new THREE.PlaneGeometry(N, N, N, N);
    this.geometry.rotateX(-Math.PI / 2);              // XZ plane, +Y up
    this.geometry.translate(N / 2, 0, N / 2);         // tiles span 0..N
    this.geometry.deleteAttribute('uv');
    this.idData = new Uint8Array(N * N * 4);
    this.idMap = new THREE.DataTexture(this.idData, N, N, THREE.RGBAFormat, THREE.UnsignedByteType);
    this.idMap.magFilter = this.idMap.minFilter = THREE.NearestFilter;
    this.idMap.generateMipmaps = false;
    this.idMap.needsUpdate = true;
    this.atlas = registry.buildGroundAtlas();
    this.material = this.buildMaterial(quality);
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = false;
    this.mesh.frustumCulled = false;
    this.mesh.name = 'terrain';
    this.time = 0;
    // perimeter skirt: cliff walls dropping from the border corners into the void (visual-only)
    this.skirtMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, metalness: 0, vertexColors: true, side: THREE.DoubleSide,
      map: registry.get('cliff', 'albedo', '#6E737A'), normalMap: registry.get('cliff', 'normal'), roughnessMap: registry.get('cliff', 'rough'), normalScale: new THREE.Vector2(0.9, 0.9) });
    this.skirt = new THREE.Mesh(new THREE.BufferGeometry(), this.skirtMaterial);
    this.skirt.receiveShadow = true; this.skirt.castShadow = false; this.skirt.frustumCulled = false; this.skirt.name = 'terrain-skirt';
    this.mesh.add(this.skirt);
  }

  /** Rebuild the border skirt from the current corner heights. */
  buildSkirt() {
    const DEPTH = 3.2, c = this.corner;
    const pos = [], nrm = [], uv = [], col = [], index = [];
    let vi = 0;
    // each side is a strip of V-1 quads; (x, z) run along the border, normal points outward
    const strip = (pts, nx, nz) => {
      for (let i = 0; i < pts.length - 1; i++) {
        const [ax, az, ay] = pts[i], [bx, bz, by] = pts[i + 1];
        const top = [[ax, ay, az], [bx, by, bz]], bot = [[ax, ay - DEPTH, az], [bx, by - DEPTH, bz]];
        for (const [x, y, z] of [top[0], top[1], bot[1], bot[0]]) {
          pos.push(x, y, z); nrm.push(nx, 0, nz);
          const along = (x * Math.abs(nz) + z * Math.abs(nx)); // coordinate running along the edge
          const depth = (top[0][1] - y);
          uv.push(along * 0.9, depth * 0.9);
          const shade = Math.max(0.03, 0.55 - depth / DEPTH * 0.7); // dark strata fading into the void
          col.push(shade, shade, shade);
        }
        index.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3);
        vi += 4;
      }
    };
    const north = [], south = [], west = [], east = [];
    for (let i = 0; i < V; i++) {
      north.push([i, 0, c[i]]);                       // z = 0 edge, outward -Z
      south.push([N - i, N, c[N * V + (N - i)]]);     // z = N edge, outward +Z (reversed so faces point out)
      west.push([0, N - i, c[(N - i) * V]]);          // x = 0 edge, outward -X
      east.push([N, i, c[i * V + N]]);                // x = N edge, outward +X
    }
    strip(north, 0, -1); strip(south, 0, 1); strip(west, -1, 0); strip(east, 1, 0);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(index);
    g.computeBoundingSphere();
    this.skirt.geometry.dispose();
    this.skirt.geometry = g;
  }

  buildMaterial(quality) {
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0 });
    mat.name = 'terrain-splat';
    const repeat = new Float32Array(16);
    LAYER_REPEAT.forEach((r, i) => { repeat[i] = r; });
    const u = {
      uAtlas: { value: this.atlas.albedo },
      uAtlasN: { value: this.atlas.normal },
      uAtlasR: { value: this.atlas.rough },
      uIdMap: { value: this.idMap },
      uRepeat: { value: repeat },
      uMapSize: { value: N },
      uTime: { value: 0 },
      uNormalStrength: { value: quality === 'low' ? 0.0 : 0.6 },
      uGlowViolet: { value: new THREE.Color('#B58CFF') },
      uGlowSea: { value: new THREE.Color('#7FFFE1') },
      uNight: { value: 0 },
      uWet: { value: 0 },
    };
    this.uniforms = u;
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, u);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>
          varying vec3 vWPos; varying vec3 vTanV; varying vec3 vBitV; varying vec3 vWNormal;`)
        .replace('#include <defaultnormal_vertex>', `#include <defaultnormal_vertex>
          vWNormal = normalize(mat3(modelMatrix) * objectNormal);`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          vWPos = (modelMatrix * vec4(position, 1.0)).xyz;
          vTanV = normalize(normalMatrix * vec3(1.0, 0.0, 0.0));
          vBitV = normalize(normalMatrix * vec3(0.0, 0.0, -1.0));`);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
          precision highp sampler2DArray;
          uniform sampler2DArray uAtlas; uniform sampler2DArray uAtlasN; uniform sampler2DArray uAtlasR;
          uniform sampler2D uIdMap; uniform float uRepeat[16]; uniform float uMapSize; uniform float uTime;
          uniform float uNormalStrength; uniform vec3 uGlowViolet; uniform vec3 uGlowSea; uniform float uNight; uniform float uWet;
          varying vec3 vWPos; varying vec3 vTanV; varying vec3 vBitV; varying vec3 vWNormal;
          float hash21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
          float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
            return mix(mix(hash21(i), hash21(i + vec2(1, 0)), f.x), mix(hash21(i + vec2(0, 1)), hash21(i + vec2(1, 1)), f.x), f.y); }
          float layerAt(vec2 tile) {
            vec2 t = clamp(tile, vec2(0.0), vec2(uMapSize - 1.0));
            vec4 id = texture2D(uIdMap, (t + 0.5) / uMapSize);
            if (id.b > 0.2) return id.b > 0.6 ? ${LAYER_MUD}.0 : ${LAYER_SAND}.0; // pond bed: sand shelf, silty deeps
            return id.g > 0.5 ? ${LAYER_PATH}.0 : floor(id.r * 255.0 + 0.5);
          }
          float waterAt(vec2 tile) {
            vec2 t = clamp(tile, vec2(0.0), vec2(uMapSize - 1.0));
            return texture2D(uIdMap, (t + 0.5) / uMapSize).b > 0.2 ? 1.0 : 0.0;
          }
          vec3 splatA, splatN; float splatR, splatLayer;
          void sampleLayer(float layer, vec2 p, float w, inout vec3 a, inout vec3 n, inout float r) {
            vec2 uv = p * uRepeat[int(layer)];
            a += texture(uAtlas, vec3(uv, layer)).rgb * w;
            n += (texture(uAtlasN, vec3(uv, layer)).xyz * 2.0 - 1.0) * w;
            r += texture(uAtlasR, vec3(uv, layer)).r * w;
          }
          void computeSplat(float geomNormalWorldY) {
            vec2 p = vWPos.xz;
            vec2 b = floor(p - 0.5); vec2 f = fract(p - 0.5);
            // soft border: 0.18 tile transition either side of the tile edge
            vec2 fs = smoothstep(0.32, 0.68, f);
            float l00 = layerAt(b), l10 = layerAt(b + vec2(1, 0)), l01 = layerAt(b + vec2(0, 1)), l11 = layerAt(b + vec2(1, 1));
            float w00 = (1.0 - fs.x) * (1.0 - fs.y), w10 = fs.x * (1.0 - fs.y), w01 = (1.0 - fs.x) * fs.y, w11 = fs.x * fs.y;
            vec3 a = vec3(0.0), n = vec3(0.0); float r = 0.0;
            if (l00 == l10 && l00 == l01 && l00 == l11) { sampleLayer(l00, p, 1.0, a, n, r); }
            else { sampleLayer(l00, p, w00, a, n, r); sampleLayer(l10, p, w10, a, n, r); sampleLayer(l01, p, w01, a, n, r); sampleLayer(l11, p, w11, a, n, r); }
            // slopes turn into cliff rock (geometry normal Y falls as terraces steepen)
            float slope = 1.0 - clamp(geomNormalWorldY, 0.0, 1.0);
            float cliff = smoothstep(0.10, 0.30, slope);
            if (cliff > 0.001) { vec3 ca = vec3(0.0), cn = vec3(0.0); float cr = 0.0; sampleLayer(${LAYER_CLIFF}.0, p, 1.0, ca, cn, cr);
              a = mix(a, ca, cliff); n = mix(n, cn, cliff); r = mix(r, cr, cliff); }
            // shoreline: a wide bilinear water weight gives a half-tile wet beach that darkens and glosses the ground
            float wet = mix(mix(waterAt(b), waterAt(b + vec2(1, 0)), f.x), mix(waterAt(b + vec2(0, 1)), waterAt(b + vec2(1, 1)), f.x), f.y);
            wet = smoothstep(0.0, 0.6, wet);
            float beach = smoothstep(0.12, 0.9, wet);
            if (beach > 0.001) { vec3 sa = vec3(0.0), sn = vec3(0.0); float sr = 0.0; sampleLayer(${LAYER_SAND}.0, p, 1.0, sa, sn, sr);
              a = mix(a, sa, beach * (1.0 - cliff)); n = mix(n, sn, beach); r = mix(r, sr, beach); }
            a *= mix(1.0, 0.58, wet); r *= mix(1.0, 0.5, wet);
            // storm: the whole ground darkens and glosses as it soaks (paths puddle first)
            float soak = uWet * (0.6 + 0.4 * step(0.5, texture2D(uIdMap, (clamp(floor(p), vec2(0.0), vec2(uMapSize - 1.0)) + 0.5) / uMapSize).g));
            a *= mix(1.0, 0.72, soak); r *= mix(1.0, 0.45, soak);
            // large-scale tonal variation breaks tiling
            float vary = 0.90 + 0.20 * vnoise(p * 0.11 + 3.7) ;
            splatA = a * vary; splatN = n; splatR = clamp(r, 0.05, 1.0);
            splatLayer = (w00 >= w10 && w00 >= w01 && w00 >= w11) ? l00 : (w10 >= w01 && w10 >= w11) ? l10 : (w01 >= w11 ? l01 : l11);
          }`)
        // map_fragment is the first chunk that needs the splat, so it drives the sampling
        .replace('#include <map_fragment>', `computeSplat(normalize(vWNormal).y); diffuseColor.rgb *= splatA;`)
        .replace('#include <roughnessmap_fragment>', `float roughnessFactor = roughness * splatR;`)
        .replace('#include <normal_fragment_maps>', `{
          vec3 mapN = splatN; mapN.xy *= uNormalStrength;
          normal = normalize(vTanV * mapN.x + vBitV * mapN.y + normal * max(mapN.z, 0.2));
        }`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          {
            float lum = dot(splatA, vec3(0.299, 0.587, 0.114));
            float pulse = 0.85 + 0.15 * sin(uTime * 0.9 + vWPos.x * 1.7 + vWPos.z * 1.1);
            float speck = smoothstep(0.42, 0.75, lum) * pulse * (0.35 + 0.65 * uNight);
            if (splatLayer == 9.0) totalEmissiveRadiance += uGlowViolet * speck * 0.55;
            else if (splatLayer == 10.0) totalEmissiveRadiance += uGlowSea * speck * 0.5;
          }`);
    };
    mat.customProgramCacheKey = () => 'terrain-splat-v3';
    return mat;
  }

  /** Bilinear ground height (world Y) at tile-space (x, z). Used to plant entities on the mesh. */
  heightAt(x, z) {
    const cx = Math.max(0, Math.min(N - 1e-6, x)), cz = Math.max(0, Math.min(N - 1e-6, z));
    const ix = Math.floor(cx), iz = Math.floor(cz), fx = cx - ix, fz = cz - iz;
    const c = this.corner;
    const h00 = c[iz * V + ix], h10 = c[iz * V + ix + 1], h01 = c[(iz + 1) * V + ix], h11 = c[(iz + 1) * V + ix + 1];
    return (h00 * (1 - fx) + h10 * fx) * (1 - fz) + (h01 * (1 - fx) + h11 * fx) * fz;
  }

  /** Rebuild corner heights, vertex positions, normals and the id map from authoritative state. */
  rebuild(state) {
    const heights = state.heights, water = state.water, mats = state.materials, paths = state.paths || [];
    const c = this.corner;
    // pass 1: corner classification + mean heights + basin target (mean of the adjacent water depths)
    const target = this._target || (this._target = new Float32Array(V * V));
    const dist = this._dist || (this._dist = new Int16Array(V * V));
    const base = this._base || (this._base = new Float32Array(V * V));
    const queue = [];
    for (let vz = 0; vz < V; vz++) {
      for (let vx = 0; vx < V; vx++) {
        let landSum = 0, landN = 0, allSum = 0, allN = 0, basinSum = 0, basinN = 0;
        for (let dz = -1; dz <= 0; dz++) for (let dx = -1; dx <= 0; dx++) {
          const tx = vx + dx, tz = vz + dz;
          if (!inMap(tx, tz)) continue;
          const i = idx(tx, tz);
          const h = heights[i];
          allSum += h; allN++;
          if (water[i]) { basinSum += BASIN[water[i]] || 0.9; basinN++; }
          else { landSum += h; landN++; }
        }
        const k = vz * V + vx;
        if (landN > 0 || allN === 0) {
          // land / shore corners keep the land height (the shore rim sits just above the waterline)
          base[k] = landN > 0 ? landSum / landN : 0;
          target[k] = 0; dist[k] = 0; queue.push(k);
        } else {
          base[k] = allSum / allN;
          target[k] = basinSum / basinN;
          dist[k] = -1;
        }
      }
    }
    // pass 2: BFS distance (in corner steps) from the shore into the water body
    for (let qi = 0; qi < queue.length; qi++) {
      const k = queue[qi], kx = k % V, kz = (k - kx) / V, d = dist[k] + 1;
      if (kx > 0 && dist[k - 1] < 0) { dist[k - 1] = d; queue.push(k - 1); }
      if (kx < V - 1 && dist[k + 1] < 0) { dist[k + 1] = d; queue.push(k + 1); }
      if (kz > 0 && dist[k - V] < 0) { dist[k - V] = d; queue.push(k - V); }
      if (kz < V - 1 && dist[k + V] < 0) { dist[k + V] = d; queue.push(k + V); }
    }
    // pass 3: gentle beach profile — the bed falls 0.9 steps at the first ring, +0.65 per ring, capped by the basin target
    for (let k = 0; k < V * V; k++) {
      const d = dist[k];
      const depth = d <= 0 ? 0 : Math.min(target[k], 0.9 + 0.65 * (d - 1));
      c[k] = (base[k] - depth) * H_UNIT;
    }
    queue.length = 0;
    const pos = this.geometry.attributes.position;
    for (let vz = 0; vz < V; vz++) for (let vx = 0; vx < V; vx++) pos.setY(vz * V + vx, c[vz * V + vx]);
    pos.needsUpdate = true;
    this.geometry.computeVertexNormals();
    this.geometry.computeBoundingSphere();
    this.buildSkirt();
    // id map: R = material layer, G = path flag, B = water depth, A = height (for other shaders)
    const d = this.idData;
    for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
      const i = idx(x, z), o = i * 4;
      d[o] = materialLayer(mats[i]);
      d[o + 1] = paths[i] ? 255 : 0;
      d[o + 2] = water[i] ? water[i] * 100 : 0;
      d[o + 3] = Math.round((heights[i] / MAX_H) * 255);
    }
    this.idMap.needsUpdate = true;
  }

  update(dt, night, storm = 0) {
    this.time += dt;
    this.uniforms.uTime.value = this.time;
    this.uniforms.uNight.value = night;
    this.uniforms.uWet.value = storm;
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
    this.idMap.dispose();
    this.skirt.geometry.dispose();
    this.skirtMaterial.dispose();
  }
}

export const groundLayerName = (i) => GROUND_LAYERS[i] || 'grass';
