// ---- Texture registry: baked PBR maps from /textures (generated offline) with procedural fallbacks ----
// Nothing here touches gameplay. Every texture has an immediate procedural stand-in so the world renders
// on the first frame; baked images swap in as they arrive.
import * as THREE from 'three';
import { MATERIALS } from '../constants';

export const GROUND_LAYERS = ['grass', 'denseGrass', 'soil', 'sand', 'rock', 'gravel', 'mud', 'wetland', 'moss', 'fungal', 'alien', 'path', 'cliff'];
export const LAYER_PATH = 11;
export const LAYER_CLIFF = 12;
export const ATLAS_SIZE = 512;

// per-layer texture repeats per tile (design bible section 3)
export const LAYER_REPEAT = [1.6, 1.3, 1.8, 2.2, 1.2, 1.7, 1.9, 1.6, 1.4, 1.5, 1.6, 2.4, 1.0];
// fallback albedo per layer when a baked texture is missing (bible albedo targets)
const LAYER_FALLBACK = ['#5E7A4B', '#3F6B3E', '#6A4E3A', '#C7B08A', '#7A7F86', '#8A8176', '#4B3A2F', '#3E4F46', '#4F6E5A', '#3A2B45', '#1F3E4F', '#5F666E', '#6E737A'];
const LAYER_ROUGH = [0.92, 0.9, 0.95, 0.98, 0.78, 0.88, 0.97, 0.93, 0.9, 0.86, 0.84, 0.72, 0.8];

const BASE = (process.env.PUBLIC_URL || '') + '/textures/';

function hexRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// deterministic grain so the stand-in isn't a flat colour (render-only; never touches the sim RNG)
function proceduralLayer(size, rgb, grain = 22) {
  const out = new Uint8Array(size * size * 4);
  let seed = 1234567;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < size * size; i++) {
    const g = (rnd() - 0.5) * grain;
    out[i * 4] = Math.max(0, Math.min(255, rgb[0] + g));
    out[i * 4 + 1] = Math.max(0, Math.min(255, rgb[1] + g));
    out[i * 4 + 2] = Math.max(0, Math.min(255, rgb[2] + g));
    out[i * 4 + 3] = 255;
  }
  return out;
}

function flatLayer(size, rgb) {
  const out = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) { out[i * 4] = rgb[0]; out[i * 4 + 1] = rgb[1]; out[i * 4 + 2] = rgb[2]; out[i * 4 + 3] = 255; }
  return out;
}

/** 4x4 flat-colour canvas texture; a plain THREE.Texture so its image can later become the baked <img>. */
function standInTexture(rgb) {
  const cv = document.createElement('canvas');
  cv.width = 4; cv.height = 4;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
  ctx.fillRect(0, 0, 4, 4);
  const tex = new THREE.Texture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.generateMipmaps = false;
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

function imageToRGBA(img, size) {
  const cv = document.createElement('canvas');
  cv.width = size; cv.height = size;
  const ctx = cv.getContext('2d');
  ctx.drawImage(img, 0, 0, size, size);
  return ctx.getImageData(0, 0, size, size).data;
}

export class TextureRegistry {
  constructor(renderer) {
    this.renderer = renderer;
    this.manifest = null;
    this.cache = new Map();
    this.loader = new THREE.TextureLoader();
    this.imgLoader = new THREE.ImageLoader();
    this.maxAniso = renderer ? renderer.capabilities.getMaxAnisotropy() : 1;
    this.ready = fetch(BASE + 'manifest.json').then((r) => (r.ok ? r.json() : {})).catch(() => ({})).then((m) => { this.manifest = m; return m; });
  }

  has(key) { return !!(this.manifest && this.manifest[key]); }

  /** Repeating texture (albedo | normal | rough) — returns immediately, fills in when loaded. */
  get(key, kind = 'albedo', fallbackHex = '#808080') {
    const id = `${key}:${kind}`;
    if (this.cache.has(id)) return this.cache.get(id);
    const rgb = kind === 'normal' ? [128, 128, 255] : kind === 'rough' ? [200, 200, 200] : hexRgb(fallbackHex);
    // stand-in is a tiny canvas (not a DataTexture) so the baked <img> can be swapped in later
    const tex = standInTexture(rgb);
    tex.colorSpace = kind === 'albedo' ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    this.cache.set(id, tex);
    this.ready.then(() => {
      const entry = this.manifest && this.manifest[key];
      const file = entry ? entry[kind] : null;
      if (!file) return;
      this.loader.load(BASE + file, (loaded) => {
        if (this.disposed) return;
        loaded.wrapS = loaded.wrapT = THREE.RepeatWrapping;
        loaded.colorSpace = tex.colorSpace;
        loaded.anisotropy = Math.min(4, this.maxAniso);
        loaded.generateMipmaps = true;
        loaded.minFilter = THREE.LinearMipmapLinearFilter;
        // swap the image into the existing texture object so materials keep their reference
        tex.image = loaded.image;
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.anisotropy = loaded.anisotropy;
        tex.generateMipmaps = true;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.needsUpdate = true;
      });
    });
    return tex;
  }

  /** Repeating texture loaded straight from /textures/<file> (not in the manifest). */
  file(name, kind = 'albedo') {
    const id = `file:${name}`;
    if (this.cache.has(id)) return this.cache.get(id);
    const rgb = kind === 'normal' ? [128, 128, 255] : [200, 200, 200];
    const tex = standInTexture(rgb);
    tex.colorSpace = kind === 'albedo' ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    this.cache.set(id, tex);
    this.loader.load(BASE + name, (loaded) => {
      if (this.disposed) return;
      tex.image = loaded.image;
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.anisotropy = Math.min(4, this.maxAniso);
      tex.generateMipmaps = true;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.needsUpdate = true;
    }, undefined, () => { /* keep the flat stand-in */ });
    return tex;
  }

  /**
   * Ground splat atlas: one DataArrayTexture per map kind (albedo / normal / rough), one layer per
   * GROUND_LAYERS entry. Starts procedural, upgrades layer by layer as baked images arrive.
   */
  buildGroundAtlas(size = ATLAS_SIZE) {
    if (this.atlas) return this.atlas;
    const layers = GROUND_LAYERS.length;
    const mk = (fill, colorSpace) => {
      const data = new Uint8Array(size * size * 4 * layers);
      for (let l = 0; l < layers; l++) data.set(fill(l), l * size * size * 4);
      const t = new THREE.DataArrayTexture(data, size, size, layers);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.colorSpace = colorSpace;
      t.generateMipmaps = true;
      t.minFilter = THREE.LinearMipmapLinearFilter;
      t.magFilter = THREE.LinearFilter;
      t.anisotropy = Math.min(4, this.maxAniso);
      t.needsUpdate = true;
      return t;
    };
    const albedo = mk((l) => proceduralLayer(size, hexRgb(LAYER_FALLBACK[l])), THREE.SRGBColorSpace);
    const normal = mk(() => flatLayer(size, [128, 128, 255]), THREE.NoColorSpace);
    const rough = mk((l) => flatLayer(size, [Math.round(LAYER_ROUGH[l] * 255), 0, 0]), THREE.NoColorSpace);
    this.atlas = { albedo, normal, rough, size, loaded: 0 };
    this.ready.then(() => {
      GROUND_LAYERS.forEach((key, l) => {
        const entry = this.manifest && this.manifest[key];
        if (!entry) return;
        const put = (tex, file) => {
          this.imgLoader.load(BASE + file, (img) => {
            if (!this.atlas || this.disposed) return; // registry torn down while the image was in flight
            tex.image.data.set(imageToRGBA(img, size), l * size * size * 4);
            tex.needsUpdate = true;
            this.atlas.loaded++;
          });
        };
        put(albedo, entry.albedo);
        put(normal, entry.normal);
        put(rough, entry.rough);
      });
    });
    return this.atlas;
  }

  dispose() {
    this.disposed = true;
    for (const t of this.cache.values()) t.dispose();
    this.cache.clear();
    if (this.atlas) { this.atlas.albedo.dispose(); this.atlas.normal.dispose(); this.atlas.rough.dispose(); this.atlas = null; }
  }
}

export const materialLayer = (matId) => (MATERIALS[matId] ? matId : 0);
