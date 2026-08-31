// ---- Terrain material texture baker (visual-only) ----
// Pre-bakes diamond tile textures per material with anti-tiling variants,
// and paints layered cliff strata for elevation faces.
// Dark bioluminescent sci-fi identity: low-value bases, cool ambient,
// upper-left key light, restrained accent glints.
import { TILE_W, TILE_H } from '../constants';
import { tone, mixc } from './pixel';

const HW = TILE_W / 2, HH = TILE_H / 2;
const VARIANTS = 4;

// deterministic hash noise 0..1
export function h2(x, y, seed = 0) {
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

// value noise with 2 octaves for soft patches
function patch(x, y, seed, freq) {
  const gx = Math.floor(x / freq), gy = Math.floor(y / freq);
  const fx = (x / freq) - gx, fy = (y / freq) - gy;
  const sm = (t) => t * t * (3 - 2 * t);
  const a = h2(gx, gy, seed), b = h2(gx + 1, gy, seed);
  const c = h2(gx, gy + 1, seed), d = h2(gx + 1, gy + 1, seed);
  const u = sm(fx), v = sm(fy);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

// ---------- material recipes ----------
// base: mid albedo · deep: shadow pit · hi: lit grain · acc: rare accent
// feat: feature painter key
const RECIPES = {
  0:  { base: '#22352a', deep: '#16241c', hi: '#31473a', acc: '#3d5c48', feat: 'grass' },
  1:  { base: '#1d3d2b', deep: '#12281c', hi: '#2b503a', acc: '#39664b', feat: 'grassDense' },
  2:  { base: '#33291f', deep: '#211a13', hi: '#443728', acc: '#57493a', feat: 'soil' },
  3:  { base: '#4a4130', deep: '#332d20', hi: '#5c5340', acc: '#6e6350', feat: 'sand' },
  4:  { base: '#333a46', deep: '#20252e', hi: '#46505f', acc: '#5a6675', feat: 'rock' },
  5:  { base: '#2c3138', deep: '#1c2026', hi: '#3c434c', acc: '#4c545e', feat: 'gravel' },
  6:  { base: '#2f2620', deep: '#1d1712', hi: '#3f342b', acc: '#4e6a72', feat: 'mud' },
  7:  { base: '#1a3436', deep: '#0f2123', hi: '#25474a', acc: '#2DE2E6', feat: 'wetland' },
  8:  { base: '#213a2e', deep: '#14261d', hi: '#2e4e3e', acc: '#4a8a68', feat: 'moss' },
  9:  { base: '#332440', deep: '#201628', hi: '#453257', acc: '#b98ae0', feat: 'fungal' },
  10: { base: '#20304a', deep: '#131e30', hi: '#2c4266', acc: '#2DE2E6', feat: 'alien' },
};

function inDiamond(x, y) {
  return Math.abs(x - HW) / HW + Math.abs(y - HH) / HH <= 1;
}

// ---------- per-material feature painters (drawn over the shaded base) ----------
const FEATURES = {
  grass(ctx, R, sd) {
    // blade clusters + mottle
    for (let k = 0; k < 26; k++) {
      const x = Math.floor(h2(k, 1, sd) * TILE_W), y = Math.floor(h2(k, 2, sd) * TILE_H);
      if (!inDiamond(x, y) || !inDiamond(x, y - 2)) continue;
      ctx.fillStyle = h2(k, 3, sd) > 0.5 ? R.acc : R.hi;
      ctx.fillRect(x, y - 1, 1, 2);
      if (h2(k, 4, sd) > 0.72) { ctx.fillStyle = tone(R.acc, 0.15); ctx.fillRect(x, y - 2, 1, 1); }
    }
  },
  grassDense(ctx, R, sd) {
    FEATURES.grass(ctx, R, sd);
    for (let k = 0; k < 16; k++) {
      const x = Math.floor(h2(k, 5, sd) * TILE_W), y = Math.floor(h2(k, 6, sd) * TILE_H);
      if (!inDiamond(x, y)) continue;
      ctx.fillStyle = R.deep; ctx.fillRect(x, y, 2, 1);
      ctx.fillStyle = R.acc; ctx.fillRect(x, y - 1, 1, 1);
    }
  },
  soil(ctx, R, sd) {
    for (let k = 0; k < 14; k++) { // pebbles with 1px shadow
      const x = Math.floor(h2(k, 1, sd) * TILE_W), y = Math.floor(h2(k, 2, sd) * TILE_H);
      if (!inDiamond(x, y)) continue;
      ctx.fillStyle = R.deep; ctx.fillRect(x + 1, y + 1, 2, 1);
      ctx.fillStyle = h2(k, 3, sd) > 0.5 ? R.hi : R.acc; ctx.fillRect(x, y, 2, 1);
    }
    // thin crack
    let cx = HW + (h2(1, sd, 7) - 0.5) * 30, cy = 6 + h2(2, sd, 7) * 8;
    ctx.fillStyle = R.deep;
    for (let s = 0; s < 10; s++) {
      if (inDiamond(cx, cy)) ctx.fillRect(Math.floor(cx), Math.floor(cy), 1, 1);
      cx += h2(s, sd, 9) > 0.4 ? 1.6 : -1.2; cy += 1.4;
    }
  },
  sand(ctx, R, sd) {
    // ripple bands (subtle diagonal)
    ctx.fillStyle = 'rgba(255,235,200,0.05)';
    for (let b = 0; b < 4; b++) {
      const off = b * 8 + Math.floor(h2(b, 1, sd) * 4);
      for (let x = 0; x < TILE_W; x++) {
        const y = Math.floor(HH - 8 + off / 2 + Math.sin(x / 9 + b) * 1.6 + x * 0.12);
        if (inDiamond(x, y)) ctx.fillRect(x, y, 1, 1);
      }
    }
    for (let k = 0; k < 8; k++) {
      const x = Math.floor(h2(k, 2, sd) * TILE_W), y = Math.floor(h2(k, 3, sd) * TILE_H);
      if (inDiamond(x, y)) { ctx.fillStyle = h2(k, 4, sd) > 0.6 ? R.acc : R.deep; ctx.fillRect(x, y, 1, 1); }
    }
  },
  rock(ctx, R, sd) {
    // fracture plates: dark polylines + facet highlight along upper side
    for (let c = 0; c < 3; c++) {
      let x = 8 + h2(c, 1, sd) * (TILE_W - 16), y = 4 + h2(c, 2, sd) * 6;
      const dx = h2(c, 3, sd) > 0.5 ? 1.8 : -1.8;
      for (let s = 0; s < 12; s++) {
        if (inDiamond(x, y)) {
          ctx.fillStyle = R.deep; ctx.fillRect(Math.floor(x), Math.floor(y), 2, 1);
          if (inDiamond(x, y - 1)) { ctx.fillStyle = tone(R.hi, 0.12); ctx.fillRect(Math.floor(x), Math.floor(y) - 1, 1, 1); }
        }
        x += dx * (0.6 + h2(s, c, sd) * 0.8); y += 1.6;
      }
    }
  },
  gravel(ctx, R, sd) {
    for (let k = 0; k < 30; k++) {
      const x = Math.floor(h2(k, 1, sd) * TILE_W), y = Math.floor(h2(k, 2, sd) * TILE_H);
      if (!inDiamond(x, y)) continue;
      const t = h2(k, 3, sd);
      ctx.fillStyle = R.deep; ctx.fillRect(x + 1, y + 1, 2, 1);
      ctx.fillStyle = t > 0.66 ? R.acc : t > 0.33 ? R.hi : mixc(R.base, R.hi, 0.5);
      ctx.fillRect(x, y, 2, 1);
      if (t > 0.8) ctx.fillRect(x, y - 1, 1, 1);
    }
  },
  mud(ctx, R, sd) {
    // wet sheen patches + rare puddle glint
    for (let k = 0; k < 5; k++) {
      const x = Math.floor(h2(k, 1, sd) * TILE_W), y = Math.floor(h2(k, 2, sd) * TILE_H);
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 5; dx++) {
        if (inDiamond(x + dx, y + dy) && h2(dx, dy, k + sd) > 0.3) {
          ctx.fillStyle = 'rgba(140,170,190,0.07)'; ctx.fillRect(x + dx, y + dy, 1, 1);
        }
      }
      if (h2(k, 9, sd) > 0.75 && inDiamond(x + 2, y)) { ctx.fillStyle = R.acc; ctx.globalAlpha = 0.5; ctx.fillRect(x + 2, y, 1, 1); ctx.globalAlpha = 1; }
    }
    FEATURES.soil(ctx, { ...R, hi: tone(R.hi, -0.1), acc: R.deep }, sd + 5);
  },
  wetland(ctx, R, sd) {
    // micro-pools with rim highlight + reed stubble
    for (let k = 0; k < 4; k++) {
      const x = 10 + Math.floor(h2(k, 1, sd) * (TILE_W - 22)), y = 6 + Math.floor(h2(k, 2, sd) * (TILE_H - 12));
      if (!inDiamond(x, y)) continue;
      ctx.fillStyle = R.deep; ctx.fillRect(x, y, 4, 2);
      ctx.fillStyle = 'rgba(45,226,230,0.22)'; ctx.fillRect(x, y - 1, 3, 1);
    }
    for (let k = 0; k < 10; k++) {
      const x = Math.floor(h2(k, 3, sd) * TILE_W), y = Math.floor(h2(k, 4, sd) * TILE_H);
      if (inDiamond(x, y) && inDiamond(x, y - 2)) { ctx.fillStyle = mixc(R.base, '#4ac0a8', 0.5); ctx.fillRect(x, y - 2, 1, 3); }
    }
  },
  moss(ctx, R, sd) {
    // soft rounded clumps
    for (let k = 0; k < 6; k++) {
      const x = Math.floor(h2(k, 1, sd) * TILE_W), y = Math.floor(h2(k, 2, sd) * TILE_H);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -2; dx <= 2; dx++) {
        if (Math.abs(dx) + Math.abs(dy) > 2 || !inDiamond(x + dx, y + dy)) continue;
        ctx.fillStyle = dy < 0 ? tone(R.acc, -0.15) : mixc(R.base, R.acc, 0.4);
        ctx.fillRect(x + dx, y + dy, 1, 1);
      }
      if (inDiamond(x, y - 2)) { ctx.fillStyle = tone(R.acc, 0.15); ctx.fillRect(x, y - 2, 1, 1); }
    }
  },
  fungal(ctx, R, sd) {
    // mycelium web strands + spore specks
    for (let c = 0; c < 3; c++) {
      let x = HW + (h2(c, 1, sd) - 0.5) * 30, y = 5 + h2(c, 2, sd) * 5;
      for (let s = 0; s < 12; s++) {
        if (inDiamond(x, y)) { ctx.fillStyle = mixc(R.base, R.acc, 0.35); ctx.globalAlpha = 0.6; ctx.fillRect(Math.floor(x), Math.floor(y), 1, 1); ctx.globalAlpha = 1; }
        x += Math.sin(s + c * 3 + sd) * 2.2; y += 1.5;
      }
    }
    for (let k = 0; k < 4; k++) {
      const x = Math.floor(h2(k, 3, sd) * TILE_W), y = Math.floor(h2(k, 4, sd) * TILE_H);
      if (inDiamond(x, y)) { ctx.fillStyle = R.acc; ctx.globalAlpha = 0.55; ctx.fillRect(x, y, 1, 1); ctx.globalAlpha = 1; }
    }
  },
  alien(ctx, R, sd) {
    // faint geometric seams (circuit-like) + rare cyan glint
    ctx.fillStyle = 'rgba(90,140,200,0.16)';
    const y0 = 8 + Math.floor(h2(1, sd, 3) * 10);
    for (let x = 6; x < TILE_W - 6; x++) if (inDiamond(x, y0)) ctx.fillRect(x, y0, 1, 1);
    const x1 = 14 + Math.floor(h2(2, sd, 4) * 30);
    for (let y = 4; y < TILE_H - 4; y++) if (inDiamond(x1, y) && y % 2 === 0) ctx.fillRect(x1, y, 1, 1);
    if (h2(3, sd, 5) > 0.4) {
      const gx = 10 + Math.floor(h2(4, sd, 6) * 40), gy = 6 + Math.floor(h2(5, sd, 7) * 18);
      if (inDiamond(gx, gy)) { ctx.fillStyle = R.acc; ctx.globalAlpha = 0.5; ctx.fillRect(gx, gy, 1, 1); ctx.globalAlpha = 1; }
    }
  },
};

// ---------- tile texture bake ----------
const tileCache = new Map();

function bakeTile(matId, variant) {
  const R = RECIPES[matId] || RECIPES[0];
  const cv = document.createElement('canvas');
  cv.width = TILE_W; cv.height = TILE_H;
  const ctx = cv.getContext('2d');
  const sd = matId * 13 + variant * 101;
  // base: per-pixel patch noise + upper-left band light
  for (let y = 0; y < TILE_H; y++) {
    for (let x = 0; x < TILE_W; x++) {
      if (!inDiamond(x, y)) continue;
      const n = patch(x, y, sd, 7) * 0.65 + h2(x, y, sd) * 0.35;
      let c = n < 0.3 ? R.deep : n > 0.76 ? R.hi : R.base;
      c = mixc(c, n < 0.5 ? R.deep : R.hi, Math.abs(n - 0.5) * 0.4);
      // directional light: top-left lighter (soft, avoids visible tiling)
      const l = ((x - HW) / HW + (y - HH) / HH) / 2;
      c = l < 0 ? tone(c, -l * 0.05) : tone(c, -l * 0.06);
      ctx.fillStyle = c;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  (FEATURES[R.feat] || FEATURES.grass)(ctx, R, sd);
  return cv;
}

export function getTileTexture(matId, x, y) {
  const variant = Math.floor(h2(x, y, 77) * VARIANTS);
  const key = matId * 10 + variant;
  if (!tileCache.has(key)) tileCache.set(key, bakeTile(matId, variant));
  return tileCache.get(key);
}

// ---------- cliff faces (layered strata + AO) ----------
// dir 'S': lower-left face, dir 'E': lower-right face.
// Painted directly (terrain layer is cached; cost only on redraw).
export function drawCliff(ctx, px, py, dh, matId, dir, seed) {
  const R = RECIPES[matId] || RECIPES[0];
  const rockR = RECIPES[4];
  const hw = HW, hh = HH;
  // face polygon
  const pts = dir === 'S'
    ? [[px - hw, py], [px, py + hh], [px, py + hh + dh], [px - hw, py + dh]]
    : [[px + hw, py], [px, py + hh], [px, py + hh + dh], [px + hw, py + dh]];
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.clip();
  const shadeMul = dir === 'S' ? 0.92 : 0.62; // E face away from key light
  const minX = Math.min(pts[0][0], pts[1][0]), maxX = Math.max(pts[0][0], pts[1][0]);
  const topY = Math.min(pts[0][1], pts[1][1]);
  const H = hh + dh;
  // topsoil lip: material color for first rows, then strata rock below
  for (let row = 0; row < H + 1; row++) {
    const soilDepth = 3 + Math.floor(h2(seed, row, 3) * 2);
    let c;
    if (row < soilDepth) c = R.base;
    else {
      const band = Math.floor((row + h2(seed, row, 1) * 2.5) / 5);
      const bt = h2(band, seed, 2);
      c = bt > 0.66 ? rockR.acc : bt > 0.33 ? rockR.base : rockR.deep;
      c = mixc(c, R.base, 0.22); // tint strata toward material
    }
    // AO: dark under lip + at foot
    let mul = shadeMul;
    if (row < 2) mul *= 0.55;
    else if (row >= H - 2) mul *= 0.72;
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
    ctx.fillStyle = `rgb(${Math.round(r * mul)},${Math.round(g * mul)},${Math.round(b * mul)})`;
    ctx.fillRect(minX, topY + row, maxX - minX + 1, 1);
  }
  // vertical crack accents
  ctx.fillStyle = 'rgba(8,12,18,0.5)';
  for (let c = 0; c < 3; c++) {
    const cx = minX + 4 + h2(seed, c, 9) * (maxX - minX - 8);
    const ch = 4 + h2(seed, c, 11) * (dh * 0.6);
    ctx.fillRect(Math.floor(cx), topY + 4 + Math.floor(h2(seed, c, 13) * 4), 1, Math.floor(ch));
  }
  // embedded boulder glints on lit face
  if (dir === 'S') {
    ctx.fillStyle = 'rgba(160,180,205,0.14)';
    for (let k = 0; k < 3; k++) {
      const bx = minX + 3 + h2(seed, k, 15) * (maxX - minX - 8);
      const by = topY + 6 + h2(seed, k, 17) * Math.max(2, H - 10);
      ctx.fillRect(Math.floor(bx), Math.floor(by), 2, 1);
    }
  }
  ctx.restore();
}

// ---------- path deck texture ----------
// Facility walkway: dark deck panels + seams + edge trim + wear.
// Edge naming: n=(x,y-1) up-right edge · e=(x+1,y) down-right · s=(x,y+1) down-left · w=(x-1,y) up-left.
export function drawPathTile(ctx, px, py, conn, seed) {
  const hw = HW, hh = HH;
  // deck polygon: inset only on sides with no path connection
  const iN = conn.n ? 0 : 5, iE = conn.e ? 0 : 5, iS = conn.s ? 0 : 5, iW = conn.w ? 0 : 5;
  // corners: top(N∩W), right(N∩E), bottom(E∩S), left(S∩W)
  const top = [px + (iW - iN) * 0.45, py - hh + (iN + iW) * 0.28];
  const right = [px + hw - (iN + iE) * 0.55, py + (iE - iN) * 0.26];
  const bot = [px + (iE - iS) * 0.45, py + hh - (iE + iS) * 0.28];
  const left = [px - hw + (iS + iW) * 0.55, py + (iW - iS) * 0.26];
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(top[0], top[1]); ctx.lineTo(right[0], right[1]); ctx.lineTo(bot[0], bot[1]); ctx.lineTo(left[0], left[1]);
  ctx.closePath();
  // base deck
  ctx.fillStyle = '#1e2836';
  ctx.fill();
  ctx.clip();
  // panel banding along the iso axis
  for (let k = -3; k <= 3; k++) {
    const off = k * 8 + Math.floor(h2(seed, k, 1) * 2);
    ctx.strokeStyle = k % 2 ? 'rgba(12,18,26,0.55)' : 'rgba(58,74,96,0.28)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px - hw, py + off * 0.5 - 4);
    ctx.lineTo(px, py + off * 0.5 - 4 + hh * 0.5);
    ctx.lineTo(px + hw, py + off * 0.5 - 4);
    ctx.stroke();
  }
  // wear speckle
  for (let k = 0; k < 10; k++) {
    const x = px - hw + h2(seed, k, 2) * TILE_W, y = py - hh + h2(seed, k, 3) * TILE_H;
    ctx.fillStyle = h2(seed, k, 4) > 0.5 ? 'rgba(10,14,20,0.4)' : 'rgba(95,115,140,0.18)';
    ctx.fillRect(Math.floor(x), Math.floor(y), 1, 1);
  }
  ctx.restore();
  // edge trim: lit top-left edges, dark bottom-right, corner studs
  ctx.strokeStyle = 'rgba(94,120,150,0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(left[0], left[1]); ctx.lineTo(top[0], top[1]); ctx.lineTo(right[0], right[1]); ctx.stroke();
  ctx.strokeStyle = 'rgba(6,10,16,0.7)';
  ctx.beginPath(); ctx.moveTo(right[0], right[1]); ctx.lineTo(bot[0], bot[1]); ctx.lineTo(left[0], left[1]); ctx.stroke();
  // guide studs at open ends
  ctx.fillStyle = 'rgba(45,226,230,0.35)';
  if (!conn.n && !conn.e) ctx.fillRect(top[0] - 1, top[1] + 2, 1, 1);
  if (!conn.s && !conn.w) ctx.fillRect(bot[0], bot[1] - 3, 1, 1);
}
