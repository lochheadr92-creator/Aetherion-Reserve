/**
 * ART_V2 bake invariants (Spec 01 acceptance), run for BOTH flag values by isolating the art
 * modules and mocking `flags.js`. Pixels are real: jsdom is backed by the `canvas` package.
 *
 *  off  every species' idle[0] hash, all-frames hash, bounds, w/h == bake_baseline.json (main)
 *       every terrain tile variant hash == baseline
 *  on   every sheet has v2:true, idle[0] hash differs from main, bounds/w/h/frame counts equal
 *       recorded eye rects are pixel-identical to the off bake (passes never recolour eyes)
 *       halo only for aura/menace species; no frame gains a fully opaque pixel outside the
 *       off-bake silhouette (new pixels are halo pixels with alpha < 255)
 *       terrain tiles show <= 4 distinct luminance bands per material
 *
 * bake_baseline.json was recorded on main with the same hash (FNV-1a over RGBA bytes).
 */
import baseline from './bake_baseline.json';

const fnv = (d) => { let h = 2166136261; for (let i = 0; i < d.length; i++) { h ^= d[i]; h = Math.imul(h, 16777619) >>> 0; } return h; };
const pixels = (cv) => cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
const hashCanvas = (cv) => fnv(pixels(cv));
const MODES = ['idle', 'walk', 'threat', 'lunge', 'blink'];
const allFramesHash = (sh) => {
  const all = [];
  for (const m of MODES) if (sh[m]) for (const cv of sh[m]) all.push(hashCanvas(cv));
  return { hash: fnv(new Uint8Array(new Uint32Array(all).buffer)), n: all.length };
};

function loadArt(flag) {
  let mods;
  jest.isolateModules(() => {
    jest.doMock('../flags', () => ({ ART_V2: flag, OPS_DECK: true }));
    mods = { creatures: require('../creatures'), terrain: require('../terrain_tex') };
  });
  return mods;
}

// terrain variant for (x, y) — mirrors getTileTexture's h2(x, y, 77) pick so every variant is probed
const variantAt = (x, y) => { const n = Math.sin(x * 127.1 + y * 311.7 + 77 * 74.7) * 43758.5453; return Math.floor((n - Math.floor(n)) * 4); };
function tileVariants(getTileTexture) {
  const out = {};
  for (let m = 0; m <= 10; m++) for (let v = 0; v < 4; v++) {
    for (let x = 0; x < 200; x++) if (variantAt(x, 3) === v) { out[`${m}:${v}`] = getTileTexture(m, x, 3); break; }
  }
  return out;
}

const lightness = (r, g, b) => (Math.max(r, g, b) + Math.min(r, g, b)) / 510;
function luminanceBands(cv, tol = 0.012) {
  const d = pixels(cv);
  const ls = [];
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 40) ls.push(lightness(d[i], d[i + 1], d[i + 2]));
  ls.sort((a, b) => a - b);
  let bands = 0, last = -1;
  for (const l of ls) { if (l - last > tol) { bands++; last = l; } }
  return bands;
}

const OFF = loadArt(false);
const ON = loadArt(true);
const IDS = Object.keys(baseline.species).sort();

describe('ART_V2 off — byte-identical to main', () => {
  test.each(IDS)('%s sheet hashes/bounds match baseline', (id) => {
    const sh = OFF.creatures.getCreatureSheet(id);
    const b = baseline.species[id];
    expect(sh.v2).toBe(false);
    expect(hashCanvas(sh.idle[0])).toBe(b.idle0);
    const all = allFramesHash(sh);
    expect(all.hash).toBe(b.all);
    expect(all.n).toBe(b.frames);
    expect(sh.bounds).toEqual(b.bounds);
    expect([sh.w, sh.h]).toEqual([b.w, b.h]);
  });

  test('all 44 terrain tile variants match baseline', () => {
    const tiles = tileVariants(OFF.terrain.getTileTexture);
    expect(Object.keys(tiles).length).toBe(44);
    for (const [k, cv] of Object.entries(tiles)) expect(hashCanvas(cv)).toBe(baseline.tiles[k]);
  });
});

describe('ART_V2 on — passes applied, geometry preserved', () => {
  test.each(IDS)('%s v2 sheet differs but keeps bounds, eyes and silhouette', (id) => {
    const on = ON.creatures.getCreatureSheet(id);
    const off = OFF.creatures.getCreatureSheet(id);
    const b = baseline.species[id];
    expect(on.v2).toBe(true);
    expect(hashCanvas(on.idle[0])).not.toBe(b.idle0);
    expect(on.bounds).toEqual(b.bounds);
    expect([on.w, on.h]).toEqual([b.w, b.h]);
    expect(allFramesHash(on).n).toBe(b.frames);
    // eyes: every recorded rect is pixel-identical between the two bakes, on every frame
    for (const mode of ['idle', 'walk', 'threat', 'lunge']) {
      if (!on[mode]) continue;
      on[mode].forEach((cv, f) => {
        const rects = on.eyesBy[mode][f] || [];
        expect(rects).toEqual(off.eyesBy[mode][f] || []);
        const a = pixels(cv), c = pixels(off[mode][f]);
        for (const r of rects) for (let yy = 0; yy < r.h; yy++) for (let xx = 0; xx < r.w; xx++) {
          const o = ((r.y + yy) * on.w + (r.x + xx)) * 4;
          expect([a[o], a[o + 1], a[o + 2], a[o + 3]]).toEqual([c[o], c[o + 1], c[o + 2], c[o + 3]]);
        }
      });
    }
    // silhouette: a fully opaque pixel in the v2 frame must be solid in the main frame too
    // (anything new is halo, alpha < 255); halo exists only for aura/menace species
    const halo = !!(on.aura || on.menace);
    for (const mode of MODES) {
      if (!on[mode]) continue;
      on[mode].forEach((cv, f) => {
        const a = pixels(cv), c = pixels(off[mode][f]);
        let semi = 0, leaked = 0;
        for (let i = 3; i < a.length; i += 4) {
          if (a[i] === 255 && c[i] <= 40) leaked++;
          if (a[i] > 0 && a[i] < 255 && c[i] === 0) semi++;
        }
        expect(leaked).toBe(0);
        if (!halo) expect(semi).toBe(0); else expect(semi).toBeGreaterThan(0);
      });
    }
  });

  test('terrain tiles show <= 4 luminance bands per material and differ from main', () => {
    const on = tileVariants(ON.terrain.getTileTexture);
    for (const [k, cv] of Object.entries(on)) {
      expect(hashCanvas(cv)).not.toBe(baseline.tiles[k]);
      expect(luminanceBands(cv)).toBeLessThanOrEqual(4);
    }
  });
});
