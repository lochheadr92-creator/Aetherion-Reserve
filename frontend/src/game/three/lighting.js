// ---- Lighting rig: sun/moon key + hemisphere fill + fog + exposure, blended across the day (bible 2 / 5) ----
import * as THREE from 'three';
import { CAM_DIST } from './iso';

function kelvin(k) {
  // Tanner Helland approximation -> linear-ish RGB colour
  const t = k / 100;
  let r, g, b;
  if (t <= 66) { r = 255; g = 99.4708025861 * Math.log(t) - 161.1195681661; b = t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307; }
  else { r = 329.698727446 * Math.pow(t - 60, -0.1332047592); g = 288.1221695283 * Math.pow(t - 60, -0.0755148492); b = 255; }
  const c = new THREE.Color(Math.min(255, Math.max(0, r)) / 255, Math.min(255, Math.max(0, g)) / 255, Math.min(255, Math.max(0, b)) / 255);
  return c.convertSRGBToLinear();
}

const PHASES = {
  dawn:  { keyK: 4200, key: 0.85, fillK: 6500, fill: 0.55, sky: '#BFD6E6', ground: '#6B6A5E', fog: '#A9B8C6', fogD: 0.012, shadow: 0.55, exposure: 0.95, sunEl: 32, night: 0.15 },
  day:   { keyK: 5600, key: 1.15, fillK: 7000, fill: 0.65, sky: '#CFE6FF', ground: '#7A6F5E', fog: '#C9D8E6', fogD: 0.008, shadow: 0.60, exposure: 1.0, sunEl: 55, night: 0 },
  dusk:  { keyK: 3600, key: 0.90, fillK: 5200, fill: 0.50, sky: '#9FB2C9', ground: '#5E5A52', fog: '#7E8FA6', fogD: 0.014, shadow: 0.50, exposure: 0.9, sunEl: 24, night: 0.35 },
  night: { keyK: 9000, key: 0.2, fillK: 11000, fill: 0.24, sky: '#1B2A3A', ground: '#0E141A', fog: '#0F1C26', fogD: 0.020, shadow: 0.35, exposure: 0.62, sunEl: 45, night: 1 },
};
const WEATHER = {
  clear:    { key: 1.0, shadow: 1.0, fog: 1.0, sky: null, wind: 1.0 },
  overcast: { key: 0.75, shadow: 0.55, fog: 1.25, sky: '#B9C7D3', wind: 1.2 },
  storm:    { key: 0.55, shadow: 0.45, fog: 1.35, sky: '#6E7F8F', wind: 1.8 },
};
const SUN_AZ = THREE.MathUtils.degToRad(290);  // light from the camera's upper-left: shadows fall down-right on screen
const MOON_AZ = THREE.MathUtils.degToRad(110);

// piecewise blend weights across the day fraction t (sim day: day < .62, dusk < .72, night after)
function phaseMix(t) {
  if (t < 0.05) return [['dawn', 1 - t / 0.05], ['day', t / 0.05]];
  if (t < 0.60) return [['day', 1]];
  if (t < 0.66) { const k = (t - 0.60) / 0.06; return [['day', 1 - k], ['dusk', k]]; }
  if (t < 0.72) { const k = (t - 0.66) / 0.06; return [['dusk', 1 - k], ['night', k]]; }
  if (t < 0.96) return [['night', 1]];
  const k = (t - 0.96) / 0.04; return [['night', 1 - k], ['dawn', k]];
}

const tmpC = new THREE.Color();
function mixColor(out, entries, pick) {
  out.setRGB(0, 0, 0);
  for (const [name, w] of entries) { tmpC.set(pick(PHASES[name])); out.r += tmpC.r * w; out.g += tmpC.g * w; out.b += tmpC.b * w; }
  return out;
}
const mixNum = (entries, pick) => entries.reduce((a, [n, w]) => a + pick(PHASES[n]) * w, 0);

function dirFrom(az, elDeg) {
  const el = THREE.MathUtils.degToRad(elDeg);
  return new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
}

export class LightRig {
  constructor(scene, quality) {
    this.scene = scene;
    this.sun = new THREE.DirectionalLight(0xffffff, 1);
    this.sun.castShadow = true;
    this.setShadowSize(quality === 'high' ? 2048 : quality === 'medium' ? 1536 : 1024);
    this.sun.shadow.bias = -0.00035;
    this.sun.shadow.normalBias = 0.02;
    this.sun.shadow.radius = 3;
    this.sun.target = new THREE.Object3D();
    scene.add(this.sun, this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xcfe6ff, 0x7a6f5e, 0.6);
    scene.add(this.hemi);
    this.ambient = new THREE.AmbientLight(0xffffff, 0.08);
    scene.add(this.ambient);
    this.fog = new THREE.Fog(0xc9d8e6, CAM_DIST + 20, CAM_DIST + 160);
    scene.fog = this.fog;
    this.background = new THREE.Color('#05070B');
    // exported per-frame state for other shaders (water, entities)
    this.sunDir = new THREE.Vector3(0, 1, 0);
    this.sunColor = new THREE.Color();
    this.skyColor = new THREE.Color();
    this.night = 0;
    this.exposure = 1;
    this.shadowOpacity = 0.6;
    this.wind = 1;
    this.flash = 0;
    this._nextFlash = 4;
    this._t = 0;
  }

  setShadowSize(px) {
    this.sun.shadow.mapSize.set(px, px);
    if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; }
  }

  /** @param dayT 0..1 day fraction, weather 'clear'|'overcast'|'storm', target world focus, halfW/halfH ortho extents */
  update(dayT, weatherType, target, halfW, halfH, dt) {
    const entries = phaseMix(dayT);
    const w = WEATHER[weatherType] || WEATHER.clear;
    this._t += dt;
    const night = mixNum(entries, (p) => p.night);
    this.night = night;
    // key light colour: blend sun/moon temperature, direction swings to the moon side at night
    const keyK = mixNum(entries, (p) => p.keyK);
    const key = mixNum(entries, (p) => p.key) * w.key;
    const el = mixNum(entries, (p) => p.sunEl);
    const sunDir = dirFrom(SUN_AZ, el), moonDir = dirFrom(MOON_AZ, 45);
    this.sunDir.copy(sunDir).lerp(moonDir, THREE.MathUtils.smoothstep(night, 0.3, 0.95)).normalize();
    this.sunColor.copy(kelvin(keyK));
    // storm lightning: brief white-blue flash on the key light
    this.flash = Math.max(0, this.flash - dt * 9);
    if (weatherType === 'storm') {
      this._nextFlash -= dt;
      if (this._nextFlash <= 0) { this.flash = 1; this._nextFlash = 6 + (Math.sin(this._t * 7.3) * 0.5 + 0.5) * 12; }
    }
    const flashBoost = 1 + this.flash * 1.2;
    this.sun.color.copy(this.sunColor).lerp(new THREE.Color('#EAF6FF'), this.flash * 0.6);
    this.sun.intensity = key * 2.6 * flashBoost;
    this.sun.position.copy(target).addScaledVector(this.sunDir, 120);
    this.sun.target.position.copy(target);
    this.sun.target.updateMatrixWorld();
    const sc = this.sun.shadow.camera;
    const ext = Math.max(halfW, halfH * 2.2) * 1.35 + 6;
    if (Math.abs(sc.right - ext) > 0.5) { sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = 1; sc.far = 300; sc.updateProjectionMatrix(); }
    this.shadowOpacity = mixNum(entries, (p) => p.shadow) * w.shadow;
    // fill: hemisphere sky/ground + tiny ambient
    const fill = mixNum(entries, (p) => p.fill);
    mixColor(this.skyColor, entries, (p) => p.sky);
    if (w.sky) this.skyColor.lerp(new THREE.Color(w.sky), 0.6 * (1 - night));
    this.hemi.color.copy(this.skyColor);
    mixColor(this.hemi.groundColor, entries, (p) => p.ground);
    this.hemi.intensity = fill * 1.4 * (0.75 + 0.25 * w.key);
    this.ambient.intensity = 0.05 + 0.1 * night;
    // fog + exposure
    mixColor(this.fog.color, entries, (p) => p.fog);
    const density = mixNum(entries, (p) => p.fogD) * w.fog;
    this.fog.near = CAM_DIST + 10;
    this.fog.far = CAM_DIST + 40 + 150 * (0.008 / density);
    this.exposure = mixNum(entries, (p) => p.exposure) * (weatherType === 'storm' ? 0.92 : 1);
    this.wind = w.wind;
    this.background.copy(this.fog.color).multiplyScalar(0.05 + 0.03 * (1 - night)); // dark void beyond the diorama edge
  }

  dispose() { this.scene.remove(this.sun, this.sun.target, this.hemi, this.ambient); }
}
