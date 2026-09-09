// ---- World3D: the cinematic three.js world under the 2D overlay canvas ----
// Reads authoritative state every frame and never mutates gameplay. The orthographic camera is fitted
// so that world (x, h, y) lands on exactly the same canvas pixel as the legacy worldPx() projection,
// which keeps all picking, tool previews and HUD markers (drawn on the overlay canvas) valid.
import * as THREE from 'three';
import { MAP_SIZE } from '../constants';
import { getDayPhase } from '../weather';
import { fitCamera, projectToScreen, legacyScreen, tileToWorld, S_PX } from './iso';
import { TextureRegistry } from './textures';
import { Terrain } from './terrain';
import { Water } from './water';
import { LightRig } from './lighting';
import { PostStack } from './post';
import { EntityLayers } from './entities';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const QUALITY_KEY = 'aetherion.gfx';
const TIERS = ['low', 'medium', 'high'];

export function pickQuality() {
  try {
    const q = new URLSearchParams(window.location.search).get('gfx');
    if (TIERS.includes(q)) return q; // explicit request (also pins the tier, see constructor)
    const saved = window.localStorage.getItem(QUALITY_KEY);
    if (TIERS.includes(saved)) return saved;
  } catch (e) { /* no storage */ }
  if (softwareRenderer()) return 'low'; // SwiftShader / llvmpipe (headless, VMs): keep the post stack off
  const cores = navigator.hardwareConcurrency || 4;
  return cores >= 8 ? 'high' : cores >= 4 ? 'medium' : 'low';
}

export function softwareRenderer() {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    return /swiftshader|llvmpipe|software|mesa offscreen/i.test(String(name));
  } catch (e) { return false; }
}

export function webglAvailable() {
  try {
    const cv = document.createElement('canvas');
    return !!cv.getContext('webgl2');
  } catch (e) { return false; }
}

export class World3D {
  constructor(canvas, { quality = pickQuality() } = {}) {
    this.canvas = canvas;
    this.quality = quality;
    try { this._pinned = TIERS.includes(new URLSearchParams(window.location.search).get('gfx')); } catch (e) { this._pinned = false; }
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false, stencil: false });
    if (!renderer.capabilities.isWebGL2) throw new Error('WebGL2 unavailable');
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality === 'high' ? 2 : 1.5));
    this.renderer = renderer;

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 500);
    this.scene.add(this.camera);
    // neutral studio environment so metals / glass / wet skins pick up reflections (bible 3: fake refraction via envMap)
    try {
      const pmrem = new THREE.PMREMGenerator(renderer);
      this.envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      pmrem.dispose();
      this.scene.environment = this.envMap;
      this.scene.environmentIntensity = 0.55;
    } catch (e) { this.envMap = null; }
    this.registry = new TextureRegistry(renderer);
    this.terrain = new Terrain(this.registry, quality);
    this.scene.add(this.terrain.mesh);
    this.water = new Water(this.registry);
    this.water.setQuality(quality);
    this.scene.add(this.water.mesh);
    this.lights = new LightRig(this.scene, quality);
    this.entities = new EntityLayers(this.scene, this.terrain, this.registry, quality);
    this.scene.background = this.lights.background;
    this.post = new PostStack(renderer, this.scene, this.camera, quality);

    this.W = canvas.width || 1; this.H = canvas.height || 1;
    this.state = null;
    this.lastTime = performance.now();
    this.frame = 0;
    this.photo = false;
    this._frameTimes = [];
    this._lastFit = null;
    this.stats = { drawCalls: 0, triangles: 0, frameMs: 0 };
  }

  setSize(W, H) {
    if (W === this.W && H === this.H) return;
    this.W = W; this.H = H;
    this.renderer.setSize(W, H, false);
    this.post.setSize(W, H);
  }

  setQuality(q) {
    if (!TIERS.includes(q) || q === this.quality) return;
    this.quality = q;
    try { window.localStorage.setItem(QUALITY_KEY, q); } catch (e) { /* ignore */ }
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q === 'high' ? 2 : 1.5));
    this.renderer.setSize(this.W, this.H, false);
    this.lights.setShadowSize(q === 'high' ? 2048 : q === 'medium' ? 1536 : 1024);
    this.water.setQuality(q);
    this.terrain.uniforms.uNormalStrength.value = q === 'low' ? 0 : 0.6;
    this.entities.setQuality(q);
    this.post.build(q);
    this.post.setSize(this.W, this.H);
  }

  // drop a tier when frames stay slow (adaptive quality; never climbs back automatically)
  _adapt(ms) {
    if (this._pinned || this.quality === 'low') return;
    if (this.frame > 3 && ms > 250) { this.setQuality('low'); return; } // hopeless GPU: bail out at once
    const ft = this._frameTimes;
    ft.push(ms);
    if (ft.length < 40) return;
    const avg = ft.reduce((a, b) => a + b, 0) / ft.length;
    ft.length = 0;
    if (avg > 34) this.setQuality(this.quality === 'high' ? 'medium' : 'low');
  }

  /**
   * Called once per animation frame by GameRenderer (3D branch).
   * @param view { state, cam, offX, offY, W, H, photo }
   */
  sync(view) {
    const { state, cam } = view;
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.lastTime) / 1000);
    this.lastTime = now;
    this.frame++;
    this.setSize(view.W, view.H);
    if (state !== this.state || state._terrainDirty || state._terrain3dDirty) {
      this.state = state;
      this.terrain.rebuild(state);
      this.water.rebuild(state, this.terrain);
      this.entities.onTerrainRebuilt();
      state._terrainDirty = false;
      state._terrain3dDirty = false;
    }
    const target = fitCamera(this.camera, cam, view.W, view.H, view.offX || 0, view.offY || 0);
    const halfW = view.W / (2 * cam.zoom * S_PX), halfH = view.H / (2 * cam.zoom * S_PX);
    const { t } = getDayPhase(state.tick);
    this.lights.update(t, state.weather?.type || 'clear', target, halfW, halfH, dt);
    this.renderer.toneMappingExposure = this.lights.exposure * (view.photo ? 1.05 : 1);
    this.terrain.update(dt, this.lights.night, this.lights.storm);
    this.water.update(dt, this.lights);
    this.entities.sync(state, dt, this.lights, { target, halfW, halfH });
    this.post.update(this.lights.night, !!view.photo);
    this.post.render();
    const ms = performance.now() - now;
    this.stats.frameMs = ms;
    this.stats.drawCalls = this.renderer.info.render.calls;
    this.stats.triangles = this.renderer.info.render.triangles;
    this._adapt(ms);
  }

  /** Re-render the current frame synchronously (photo mode capture). */
  renderNow() { this.post.render(); }

  /** Where the 3D camera puts a tile point vs where the 2D overlay believes it is (px). */
  project(x, y, h = 0) {
    return projectToScreen(this.camera, tileToWorld(x, y, h), this.W, this.H);
  }

  /** Max pixel discrepancy between the two projections over a grid of sample points. */
  verifyCameraLock(cam, offX = 0, offY = 0) {
    fitCamera(this.camera, cam, this.W, this.H, offX, offY);
    let worst = 0;
    for (let y = 0; y <= MAP_SIZE; y += 12) for (let x = 0; x <= MAP_SIZE; x += 12) for (let h = 0; h <= 8; h += 4) {
      const a = this.project(x, y, h), b = legacyScreen(cam, x, y, h, offX, offY);
      worst = Math.max(worst, Math.hypot(a.x - b.x, a.y - b.y));
    }
    return worst;
  }

  dispose() {
    if (this.envMap) this.envMap.dispose();
    this.entities.dispose();
    this.water.dispose();
    this.terrain.dispose();
    this.lights.dispose();
    this.post.dispose();
    this.registry.dispose();
    this.renderer.dispose();
  }
}
