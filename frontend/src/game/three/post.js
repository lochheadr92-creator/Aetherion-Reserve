// ---- Post-processing stack: AO -> bloom -> grade/vignette -> AA -> output (bible 5 / 8) ----
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { FXAAPass } from 'three/examples/jsm/postprocessing/FXAAPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uContrast: { value: 1.06 },
    uSaturation: { value: 0.96 },
    uVignette: { value: 0.18 },
    uLift: { value: new THREE.Color(0.0, 0.004, 0.01) },
    uGain: { value: new THREE.Color(1.0, 1.0, 1.0) },
    uPhoto: { value: 0 },
  },
  vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uContrast; uniform float uSaturation; uniform float uVignette;
    uniform vec3 uLift; uniform vec3 uGain; uniform float uPhoto; varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      vec3 col = c.rgb * uGain + uLift;
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(l), col, uSaturation + uPhoto * 0.06);
      col = (col - 0.5) * (uContrast + uPhoto * 0.08) + 0.5;
      vec2 q = vUv - 0.5; float vig = 1.0 - smoothstep(0.35, 0.95, length(q) * 1.35) * (uVignette + uPhoto * 0.06);
      gl_FragColor = vec4(max(col * vig, 0.0), c.a);
    }`,
};

export class PostStack {
  constructor(renderer, scene, camera, quality) {
    this.renderer = renderer; this.scene = scene; this.camera = camera;
    this.composer = null;
    this.build(quality);
  }

  build(quality) {
    if (this.composer) this.composer.dispose?.();
    const size = new THREE.Vector2();
    this.renderer.getSize(size);
    const pr = this.renderer.getPixelRatio();
    const composer = new EffectComposer(this.renderer);
    composer.setPixelRatio(pr);
    composer.setSize(size.x, size.y);
    composer.addPass(new RenderPass(this.scene, this.camera));
    this.ao = null;
    if (quality !== 'low') {
      const ao = new GTAOPass(this.scene, this.camera, size.x, size.y);
      ao.output = GTAOPass.OUTPUT.Default;
      ao.blendIntensity = quality === 'high' ? 0.55 : 0.4;
      ao.updateGtaoMaterial({ radius: 0.35, distanceExponent: 1, thickness: 1, scale: 1, samples: quality === 'high' ? 16 : 8, distanceFallOff: 1, screenSpaceRadius: false });
      composer.addPass(ao);
      this.ao = ao;
    }
    this.bloom = null;
    if (quality !== 'low') {
      const bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.35, 0.55, 1.05);
      composer.addPass(bloom);
      this.bloom = bloom;
    }
    // the grade works in the display-referred domain, so tone map + colour space first
    composer.addPass(new OutputPass());
    this.grade = new ShaderPass(GradeShader);
    composer.addPass(this.grade);
    this.aa = quality === 'high' ? new SMAAPass() : new FXAAPass();
    composer.addPass(this.aa);
    this.composer = composer;
    this.quality = quality;
  }

  setSize(w, h) {
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(w, h);
    if (this.ao) this.ao.setSize(w, h);
  }

  /** Per-frame tuning: bloom a little stronger at night, photo-mode grade variant. */
  update(night, photo) {
    if (this.bloom) this.bloom.strength = 0.35 * (1 + 0.25 * night) + (photo ? 0.15 : 0);
    this.grade.uniforms.uPhoto.value = photo ? 1 : 0;
    // slightly warm gain by day, cool by night (bible 5: lift/gamma/gain)
    this.grade.uniforms.uGain.value.setRGB(1.0 + 0.02 * (1 - night), 1.0, 1.0 + 0.03 * night);
  }

  render() { this.composer.render(); }

  dispose() { this.composer.dispose?.(); }
}
