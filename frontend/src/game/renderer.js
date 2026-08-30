// ---- Canvas isometric renderer. Reads authoritative state; never mutates gameplay. ----
import { MAP_SIZE, TILE_W, TILE_H, H_STEP, MAX_H, MATERIALS, VEG, FENCES, PALETTE } from './constants';
import { idx, inMap } from './state';
import { BUILDINGS } from './data/buildings';
import { speciesById } from './data/species';
import { computeEnclosures } from './enclosures';
import { getDayPhase } from './weather';

const OX = (MAP_SIZE * TILE_W) / 2 + TILE_W;
const OY = MAX_H * H_STEP + TILE_H;
const OFF_W = MAP_SIZE * TILE_W + TILE_W * 2;
const OFF_H = MAP_SIZE * TILE_H + MAX_H * H_STEP + TILE_H * 3;

export function worldPx(x, y, h = 0) {
  return { x: (x - y) * (TILE_W / 2), y: (x + y) * (TILE_H / 2) - h * H_STEP };
}

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  r = Math.min(255, Math.max(0, Math.round(r * f)));
  g = Math.min(255, Math.max(0, Math.round(g * f)));
  b = Math.min(255, Math.max(0, Math.round(b * f)));
  return `rgb(${r},${g},${b})`;
}

export class GameRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.off = document.createElement('canvas');
    this.off.width = OFF_W; this.off.height = OFF_H;
    this.offCtx = this.off.getContext('2d');
    this.cam = { x: 0, y: 0, zoom: 0.9 };
    this.state = null;
    this.hover = null; // {x,y}
    this.hoverEdge = null; // {x,y,d}
    this.fenceLinePreview = null; // { mode, edges: [{x,y,d,ok}], count, cost }
    this.tool = { mode: 'select' };
    this.selection = null; // {kind, id?, x?, y?, d?}
    this.overlay = null; // 'habitat' | 'power' | 'view' | null
    this.brushSize = 1;
    this.frame = 0;
  }

  setState(state) {
    this.state = state;
    state._terrainDirty = true;
    // center camera on map middle
    const c = worldPx(MAP_SIZE / 2, MAP_SIZE / 2, 0);
    this.cam.x = this.canvas.width / 2 - c.x * this.cam.zoom;
    this.cam.y = this.canvas.height / 2 - c.y * this.cam.zoom;
  }

  centerOn(x, y) {
    const c = worldPx(x, y, this.state ? this.state.heights[idx(Math.floor(x), Math.floor(y))] || 0 : 0);
    this.cam.x = this.canvas.width / 2 - c.x * this.cam.zoom;
    this.cam.y = this.canvas.height / 2 - c.y * this.cam.zoom;
  }

  screenToWorld(sx, sy) {
    return { x: (sx - this.cam.x) / this.cam.zoom, y: (sy - this.cam.y) / this.cam.zoom };
  }

  screenToTile(sx, sy) {
    const w = this.screenToWorld(sx, sy);
    const s = this.state;
    for (let h = MAX_H; h >= 0; h--) {
      const wy = w.y + h * H_STEP;
      const fx = (w.x / (TILE_W / 2) + wy / (TILE_H / 2)) / 2;
      const fy = (wy / (TILE_H / 2) - w.x / (TILE_W / 2)) / 2;
      const tx = Math.floor(fx), ty = Math.floor(fy);
      if (inMap(tx, ty) && s && s.heights[idx(tx, ty)] === h) return { x: tx, y: ty, fx, fy };
    }
    const fx = (w.x / (TILE_W / 2) + w.y / (TILE_H / 2)) / 2;
    const fy = (w.y / (TILE_H / 2) - w.x / (TILE_W / 2)) / 2;
    const tx = Math.max(0, Math.min(MAP_SIZE - 1, Math.floor(fx)));
    const ty = Math.max(0, Math.min(MAP_SIZE - 1, Math.floor(fy)));
    return { x: tx, y: ty, fx, fy };
  }

  edgeFromPointer(sx, sy) {
    const w = this.screenToWorld(sx, sy);
    // Collect candidate tiles from the height-plane inversions (a click can map
    // to different tiles depending on elevation), plus their neighbourhoods,
    // then snap to the nearest edge midpoint using real elevated corners.
    const tiles = new Set();
    for (let h = 0; h <= MAX_H; h++) {
      const wy = w.y + h * H_STEP;
      const fx = (w.x / (TILE_W / 2) + wy / (TILE_H / 2)) / 2;
      const fy = (wy / (TILE_H / 2) - w.x / (TILE_W / 2)) / 2;
      const tx = Math.floor(fx), ty = Math.floor(fy);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (inMap(tx + dx, ty + dy)) tiles.add(`${tx + dx},${ty + dy}`);
      }
    }
    let best = null, bestD = Infinity;
    for (const key of tiles) {
      const [x, y] = key.split(',').map(Number);
      for (const d of ['E', 'S']) {
        const { a, b } = this.fenceCorners(x, y, d);
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        const dist = Math.hypot(w.x - mx, w.y - my);
        if (dist < bestD) { bestD = dist; best = { x, y, d }; }
      }
    }
    return best || { x: 0, y: 0, d: 'E' };
  }

  // Nearest lattice corner (tile vertex, 0..MAP_SIZE) — anchor points for fence lines
  vertexFromPointer(sx, sy) {
    const t = this.screenToTile(sx, sy);
    const vx = Math.max(0, Math.min(MAP_SIZE, Math.round(t.fx)));
    const vy = Math.max(0, Math.min(MAP_SIZE, Math.round(t.fy)));
    return { vx, vy };
  }

  // ---------- terrain offscreen ----------
  redrawTerrain() {
    const s = this.state;
    const ctx = this.offCtx;
    ctx.clearRect(0, 0, OFF_W, OFF_H);
    for (let sum = 0; sum <= (MAP_SIZE - 1) * 2; sum++) {
      for (let x = Math.max(0, sum - MAP_SIZE + 1); x <= Math.min(MAP_SIZE - 1, sum); x++) {
        const y = sum - x;
        this.drawTileOff(ctx, x, y);
      }
    }
    s._terrainDirty = false;
  }

  drawTileOff(ctx, x, y) {
    const s = this.state;
    const i = idx(x, y);
    const h = s.heights[i];
    // IMPORTANT: tiles are centred on (x+0.5, y+0.5) so the drawn diamond
    // exactly matches previews, fences, buildings and picking.
    const p = worldPx(x + 0.5, y + 0.5, h);
    const px = p.x + OX, py = p.y + OY;
    const hw = TILE_W / 2, hh = TILE_H / 2;
    const mat = MATERIALS[s.materials[i]];
    const lightF = 0.82 + h * 0.05;
    // side faces if lower neighbours
    const hS = inMap(x, y + 1) ? s.heights[idx(x, y + 1)] : 0;
    const hE = inMap(x + 1, y) ? s.heights[idx(x + 1, y)] : 0;
    if (hS < h) {
      const dh = (h - hS) * H_STEP;
      ctx.fillStyle = shade(mat.color, 0.5);
      ctx.beginPath();
      ctx.moveTo(px - hw, py); ctx.lineTo(px, py + hh);
      ctx.lineTo(px, py + hh + dh); ctx.lineTo(px - hw, py + dh);
      ctx.closePath(); ctx.fill();
    }
    if (hE < h) {
      const dh = (h - hE) * H_STEP;
      ctx.fillStyle = shade(mat.color, 0.38);
      ctx.beginPath();
      ctx.moveTo(px + hw, py); ctx.lineTo(px, py + hh);
      ctx.lineTo(px, py + hh + dh); ctx.lineTo(px + hw, py + dh);
      ctx.closePath(); ctx.fill();
    }
    // top face
    ctx.fillStyle = shade(mat.color, lightF);
    ctx.beginPath();
    ctx.moveTo(px, py - hh); ctx.lineTo(px + hw, py); ctx.lineTo(px, py + hh); ctx.lineTo(px - hw, py);
    ctx.closePath(); ctx.fill();
    // texture speckle
    if ((x * 7 + y * 13) % 5 === 0) {
      ctx.fillStyle = shade(mat.hi, lightF);
      ctx.beginPath();
      ctx.ellipse(px + ((x * 13 + y * 7) % 11) - 5, py + ((x * 5 + y * 3) % 7) - 3, 3, 1.6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // water
    if (s.water[i] > 0) {
      ctx.fillStyle = s.water[i] === 2 ? PALETTE.waterDeep : PALETTE.waterShallow;
      ctx.globalAlpha = 0.92;
      ctx.beginPath();
      ctx.moveTo(px, py - hh); ctx.lineTo(px + hw, py); ctx.lineTo(px, py + hh); ctx.lineTo(px - hw, py);
      ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
      // foam edge if any neighbour is dry
      const dry = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([ax, ay]) => inMap(x + ax, y + ay) && !s.water[idx(x + ax, y + ay)]);
      if (dry) {
        ctx.strokeStyle = 'rgba(45,226,230,0.35)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
    }
    // path
    if (s.paths[i]) {
      ctx.fillStyle = PALETTE.path;
      ctx.beginPath();
      ctx.moveTo(px, py - hh + 3); ctx.lineTo(px + hw - 6, py); ctx.lineTo(px, py + hh - 3); ctx.lineTo(px - hw + 6, py);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = PALETTE.pathEdge; ctx.lineWidth = 1; ctx.stroke();
    }
    // subtle grid
    ctx.strokeStyle = PALETTE.gridLine;
    ctx.lineWidth = 0.4;
    ctx.beginPath();
    ctx.moveTo(px, py - hh); ctx.lineTo(px + hw, py); ctx.lineTo(px, py + hh); ctx.lineTo(px - hw, py);
    ctx.closePath(); ctx.stroke();
  }

  // ---------- main frame ----------
  render() {
    const s = this.state;
    const ctx = this.ctx;
    const W = this.canvas.width, H = this.canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = PALETTE.void;
    ctx.fillRect(0, 0, W, H);
    if (!s) return;
    this.frame++;
    this._phase = getDayPhase(s.tick).phase;
    this._storm = s.weather?.type === 'storm';
    this._overcast = s.weather?.type === 'overcast';
    if (s._terrainDirty) this.redrawTerrain();
    ctx.setTransform(this.cam.zoom, 0, 0, this.cam.zoom, this.cam.x, this.cam.y);
    ctx.imageSmoothingEnabled = this.cam.zoom < 1;
    ctx.drawImage(this.off, -OX, -OY);

    this.drawOverlays(ctx);
    this.drawToolPreview(ctx);

    // ---- depth-sorted dynamic entities ----
    const ents = [];
    for (let i2 = 0; i2 < s.veg.length; i2++) {
      if (!s.veg[i2]) continue;
      const x = i2 % MAP_SIZE, y = Math.floor(i2 / MAP_SIZE);
      ents.push({ d: x + y, kind: 'veg', x, y, v: s.veg[i2] });
    }
    for (const key of Object.keys(s.fences)) {
      const [x, y, d] = key.split(',');
      ents.push({ d: +x + +y + 0.5, kind: 'fence', x: +x, y: +y, dir: d, f: s.fences[key], key });
    }
    for (const b of s.buildings) ents.push({ d: b.x + b.y + Math.max(b.w, b.h) - 1, kind: 'building', b });
    for (const c of s.creatures) ents.push({ d: c.x + c.y, kind: 'creature', c });
    for (const g of s.guests) ents.push({ d: g.x + g.y, kind: 'guest', g });
    for (const u of (s.security?.units || [])) ents.push({ d: u.x + u.y, kind: 'secunit', u });
    ents.sort((a, b) => a.d - b.d);
    for (const e of ents) {
      if (e.kind === 'veg') this.drawVeg(ctx, e.x, e.y, e.v);
      else if (e.kind === 'fence') this.drawFence(ctx, e.x, e.y, e.dir, e.f, e.key);
      else if (e.kind === 'building') this.drawBuilding(ctx, e.b);
      else if (e.kind === 'creature') this.drawCreature(ctx, e.c);
      else if (e.kind === 'guest') this.drawGuest(ctx, e.g);
      else if (e.kind === 'secunit') this.drawSecurityUnit(ctx, e.u);
    }

    // entrance marker
    this.drawEntrance(ctx);
    this.drawSelection(ctx);
    this.drawHover(ctx);
    this.drawAtmosphere(ctx, W, H);
  }

  // day-night tint, rain and lightning — screen-space, drawn last
  drawAtmosphere(ctx, W, H) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (this._phase === 'night') {
      ctx.fillStyle = 'rgba(7, 11, 32, 0.42)';
      ctx.fillRect(0, 0, W, H);
    } else if (this._phase === 'dusk') {
      ctx.fillStyle = 'rgba(46, 18, 52, 0.22)';
      ctx.fillRect(0, 0, W, H);
    }
    if (this._overcast) {
      ctx.fillStyle = 'rgba(14, 20, 30, 0.18)';
      ctx.fillRect(0, 0, W, H);
    }
    if (this._storm) {
      ctx.fillStyle = 'rgba(10, 16, 28, 0.34)';
      ctx.fillRect(0, 0, W, H);
      // rain streaks (deterministic scatter, cheap)
      ctx.strokeStyle = 'rgba(150, 190, 230, 0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      const f = this.frame * 11;
      for (let i = 0; i < 110; i++) {
        const rx = ((i * 379 + f * 3) % (W + 60)) - 30;
        const ry = ((i * 173 + f * 7) % (H + 40)) - 20;
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx - 4, ry + 13);
      }
      ctx.stroke();
      // lightning flash
      if (this.frame % 260 < 3) {
        ctx.fillStyle = 'rgba(220, 235, 255, 0.14)';
        ctx.fillRect(0, 0, W, H);
      }
    }
  }

  tileCenter(x, y) {
    const s = this.state;
    const h = inMap(x, y) ? s.heights[idx(x, y)] : 0;
    return worldPx(x + 0.5, y + 0.5, h);
  }

  diamondPath(ctx, x, y, inset = 0) {
    const s = this.state;
    const h = inMap(x, y) ? s.heights[idx(x, y)] : 0;
    const p = worldPx(x + 0.5, y + 0.5, h);
    const hw = TILE_W / 2 - inset, hh = TILE_H / 2 - inset / 2;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - hh); ctx.lineTo(p.x + hw, p.y); ctx.lineTo(p.x, p.y + hh); ctx.lineTo(p.x - hw, p.y);
    ctx.closePath();
  }

  // ---------- entity drawing ----------
  drawVeg(ctx, x, y, vId) {
    const v = VEG[vId];
    const p = this.tileCenter(x, y);
    const seed = (x * 31 + y * 17) % 10;
    const sway = Math.sin(this.frame / 40 + seed) * 1.2;
    ctx.save();
    if (vId === 1) { // tall grass tufts
      ctx.strokeStyle = v.color; ctx.lineWidth = 1.4;
      for (let k = -2; k <= 2; k++) {
        ctx.beginPath();
        ctx.moveTo(p.x + k * 5, p.y + 3);
        ctx.quadraticCurveTo(p.x + k * 5 + sway, p.y - 5, p.x + k * 5 + sway * 1.5, p.y - v.h);
        ctx.stroke();
      }
    } else if (vId === 2) {
      ctx.fillStyle = v.color;
      for (let k = 0; k < 3; k++) {
        ctx.beginPath(); ctx.ellipse(p.x + (k - 1) * 7, p.y - 4 - (k % 2) * 3, 8, 6, 0, 0, Math.PI * 2); ctx.fill();
      }
    } else if (vId === 3 || vId === 4) {
      const big = vId === 4;
      ctx.strokeStyle = '#3a2e22'; ctx.lineWidth = big ? 3 : 2;
      ctx.beginPath(); ctx.moveTo(p.x, p.y + 2); ctx.lineTo(p.x + sway * 0.4, p.y - v.h * 0.6); ctx.stroke();
      ctx.fillStyle = v.color;
      ctx.beginPath(); ctx.ellipse(p.x + sway * 0.5, p.y - v.h * 0.75, big ? 16 : 11, big ? 12 : 8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = shade(v.color, 1.25);
      ctx.beginPath(); ctx.ellipse(p.x + sway * 0.5 - 4, p.y - v.h * 0.85, big ? 8 : 5, big ? 6 : 4, 0, 0, Math.PI * 2); ctx.fill();
    } else if (vId === 5) {
      ctx.strokeStyle = v.color; ctx.lineWidth = 1.6;
      for (let k = -1; k <= 1; k++) {
        ctx.beginPath(); ctx.moveTo(p.x + k * 6, p.y + 2);
        ctx.quadraticCurveTo(p.x + k * 6 + sway, p.y - 8, p.x + k * 8 + sway, p.y - v.h); ctx.stroke();
        ctx.fillStyle = shade(v.color, 1.3);
        ctx.beginPath(); ctx.ellipse(p.x + k * 8 + sway, p.y - v.h, 2.4, 2.4, 0, 0, Math.PI * 2); ctx.fill();
      }
    } else if (vId === 6 || vId === 7) {
      const glowC = v.glow;
      ctx.shadowColor = glowC; ctx.shadowBlur = 8;
      ctx.fillStyle = v.color;
      ctx.beginPath(); ctx.moveTo(p.x - 6, p.y + 2); ctx.lineTo(p.x - 2, p.y - v.h); ctx.lineTo(p.x + 2, p.y - v.h); ctx.lineTo(p.x + 6, p.y + 2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = glowC;
      ctx.beginPath(); ctx.ellipse(p.x, p.y - v.h, 4, 3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  }

  fenceCorners(x, y, d) {
    const s = this.state;
    const h1 = s.heights[idx(x, y)] || 0;
    const nx = d === 'E' ? x + 1 : x, ny = d === 'S' ? y + 1 : y;
    const h2 = inMap(nx, ny) ? s.heights[idx(nx, ny)] : h1;
    const h = Math.max(h1, h2);
    const c = worldPx(x + 0.5, y + 0.5, h);
    const hw = TILE_W / 2, hh = TILE_H / 2;
    if (d === 'E') return { a: { x: c.x + hw, y: c.y }, b: { x: c.x, y: c.y + hh }, h };
    return { a: { x: c.x - hw, y: c.y }, b: { x: c.x, y: c.y + hh }, h };
  }

  drawFence(ctx, x, y, d, f, key) {
    const def = FENCES[f.tier];
    const { a, b } = this.fenceCorners(x, y, d);
    const hgt = 14 + f.tier * 2;
    const damaged = f.hp < def.hp * 0.4;
    const col = f.gate ? '#F2C14E' : damaged ? '#FF4D6D' : def.color;
    ctx.save();
    // wall
    ctx.fillStyle = f.gate ? 'rgba(242,193,78,0.25)' : 'rgba(20,30,44,0.75)';
    ctx.beginPath();
    ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(b.x, b.y - hgt); ctx.lineTo(a.x, a.y - hgt);
    ctx.closePath(); ctx.fill();
    // rails
    ctx.strokeStyle = col; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(a.x, a.y - hgt); ctx.lineTo(b.x, b.y - hgt); ctx.stroke();
    ctx.globalAlpha = 0.55;
    ctx.beginPath(); ctx.moveTo(a.x, a.y - hgt / 2); ctx.lineTo(b.x, b.y - hgt / 2); ctx.stroke();
    ctx.globalAlpha = 1;
    // posts
    ctx.strokeStyle = shade('#3a4a60', damaged ? 0.8 : 1.2); ctx.lineWidth = 2;
    for (const pt of [a, b]) {
      ctx.beginPath(); ctx.moveTo(pt.x, pt.y); ctx.lineTo(pt.x, pt.y - hgt); ctx.stroke();
    }
    if (f.tier === 4) { // insulated glow
      ctx.shadowColor = '#6EF3C5'; ctx.shadowBlur = 6;
      ctx.strokeStyle = 'rgba(110,243,197,0.8)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(a.x, a.y - hgt); ctx.lineTo(b.x, b.y - hgt); ctx.stroke();
      ctx.shadowBlur = 0;
    }
    if (f.gate) {
      ctx.fillStyle = '#F2C14E';
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      ctx.fillRect(mx - 2, my - hgt - 4, 4, 4);
    }
    if (damaged && this.frame % 30 < 15) {
      ctx.fillStyle = '#FF4D6D';
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      ctx.beginPath(); ctx.arc(mx, my - hgt - 6, 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  drawBuilding(ctx, b) {
    const def = BUILDINGS[b.type];
    const s = this.state;
    const h = s.heights[idx(b.x, b.y)] || 0;
    const heights = { admin: 46, lab: 38, power: 44, tower: 72, viewing: 26, food_stall: 30, drink_stall: 26, restroom: 24, gift_shop: 32, shelter: 22, feeder_forage: 14, feeder_meat: 14, feeder_mineral: 14, feeder_fungal: 16, feeder_energy: 24 };
    const hgt = heights[b.type] || 30;
    const p00 = worldPx(b.x, b.y, h), p10 = worldPx(b.x + b.w, b.y, h), p11 = worldPx(b.x + b.w, b.y + b.h, h), p01 = worldPx(b.x, b.y + b.h, h);
    ctx.save();
    // left face (south-west)
    ctx.fillStyle = shade(def.color, 0.75);
    ctx.beginPath(); ctx.moveTo(p01.x, p01.y); ctx.lineTo(p11.x, p11.y); ctx.lineTo(p11.x, p11.y - hgt); ctx.lineTo(p01.x, p01.y - hgt); ctx.closePath(); ctx.fill();
    // right face (south-east)
    ctx.fillStyle = shade(def.color, 0.55);
    ctx.beginPath(); ctx.moveTo(p11.x, p11.y); ctx.lineTo(p10.x, p10.y); ctx.lineTo(p10.x, p10.y - hgt); ctx.lineTo(p11.x, p11.y - hgt); ctx.closePath(); ctx.fill();
    // roof
    ctx.fillStyle = shade(def.color, 1.5);
    ctx.beginPath(); ctx.moveTo(p00.x, p00.y - hgt); ctx.lineTo(p10.x, p10.y - hgt); ctx.lineTo(p11.x, p11.y - hgt); ctx.lineTo(p01.x, p01.y - hgt); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = PALETTE.buildingEdge; ctx.lineWidth = 1; ctx.stroke();
    // accent light strip
    ctx.strokeStyle = def.light; ctx.lineWidth = 1.6;
    ctx.globalAlpha = 0.85;
    ctx.beginPath(); ctx.moveTo(p01.x, p01.y - hgt + 4); ctx.lineTo(p11.x, p11.y - hgt + 4); ctx.lineTo(p10.x, p10.y - hgt + 4); ctx.stroke();
    ctx.globalAlpha = 1;
    // roof beacon
    const cx = (p00.x + p11.x) / 2, cy = (p00.y + p11.y) / 2 - hgt;
    ctx.shadowColor = def.light; ctx.shadowBlur = 8;
    ctx.fillStyle = def.light;
    ctx.beginPath(); ctx.arc(cx, cy - 2, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    if (b.type === 'tower') {
      ctx.strokeStyle = def.light; ctx.lineWidth = 1;
      ctx.strokeRect(cx - 8, cy - 14, 16, 10);
    }
    ctx.restore();
  }

  drawCreature(ctx, c) {
    const sp = speciesById(c.speciesId);
    const s = this.state;
    const ti = idx(Math.floor(c.x), Math.floor(c.y));
    const h = s.heights[ti] || 0;
    const inWater = s.water[ti] > 0;
    const p = worldPx(c.x, c.y, h);
    const grow = c.juvenile ? 0.5 + 0.5 * (c.growth || 0) : 1;
    const sc = sp.size * (inWater ? 0.8 : 1) * grow;
    const bob = Math.sin(this.frame / 12 + c.id) * 1.5;
    ctx.save();
    ctx.translate(p.x, p.y + (inWater ? 4 : 0));
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(0, 2, 12 * sc, 5 * sc, 0, 0, Math.PI * 2); ctx.fill();
    if (c.escaped && this.frame % 40 < 24) {
      ctx.strokeStyle = '#FF4D6D'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(0, 2, 16 * sc + 4, 8 * sc + 2, 0, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.scale(c.dir, 1);
    // camouflage: near-invisible shimmer; thermal optics keeps a readable heat signature
    if (c.cloaked) {
      const thermal = this.state.research?.completed?.includes('sec_thermal');
      ctx.globalAlpha = thermal ? 0.55 : 0.1 + 0.06 * Math.sin(this.frame / 6 + c.id);
      if (thermal) { ctx.shadowColor = '#FF8A5C'; ctx.shadowBlur = 10; }
    }
    if (!c.cloaked && sp.colors.glow) { ctx.shadowColor = sp.colors.glow; ctx.shadowBlur = this._phase === 'night' ? 18 : 10; }
    drawBody(ctx, sp, sc, this.frame, c, bob);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.restore();
    // electrical surge arcs
    if (c._surgeUntil && this.state.tick < c._surgeUntil) {
      ctx.save();
      ctx.strokeStyle = 'rgba(45,226,230,0.9)'; ctx.lineWidth = 1.4;
      for (let a = 0; a < 3; a++) {
        const ang = (this.frame / 3 + a * 2.1 + c.id) % (Math.PI * 2);
        let ax = p.x, ay = p.y - 10 * sc;
        ctx.beginPath(); ctx.moveTo(ax, ay);
        for (let seg = 0; seg < 3; seg++) {
          ax += Math.cos(ang + seg) * (6 + (this.frame + seg * 7) % 5);
          ay += Math.sin(ang * 1.7 + seg) * 5 - 3;
          ctx.lineTo(ax, ay);
        }
        ctx.stroke();
      }
      ctx.restore();
    }
    // status pip
    if (c.welfare < 0.4) {
      ctx.fillStyle = '#FF4D6D';
      ctx.beginPath(); ctx.arc(p.x, p.y - 30 * sc - 8, 3, 0, Math.PI * 2); ctx.fill();
    }
    if (this.selection?.kind === 'creature' && this.selection.id === c.id) {
      ctx.strokeStyle = PALETTE.selected; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.ellipse(p.x, p.y + 2, 14 * sc + 5, 7 * sc + 3, 0, 0, Math.PI * 2); ctx.stroke();
    }
  }

  drawGuest(ctx, g) {
    const s = this.state;
    const h = s.heights[idx(Math.floor(g.x), Math.floor(g.y))] || 0;
    const p = worldPx(g.x, g.y, h);
    const colors = { family: '#e0c080', researcher: '#6ef3c5', thrill: '#ff8a7a', nature: '#8fd0b0' };
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(p.x, p.y + 1, 3.4, 1.6, 0, 0, Math.PI * 2); ctx.fill();
    // panicked guests sprint with a frantic bounce and lean
    const bounce = g.panic ? Math.abs(Math.sin(this.frame / 2.2 + g.id)) * 2.5 : 0;
    if (g.panic) { ctx.translate(p.x, p.y - bounce); ctx.rotate(0.16 * (g.id % 2 === 0 ? 1 : -1)); ctx.translate(-p.x, -(p.y - bounce)); }
    ctx.fillStyle = colors[g.archetype] || PALETTE.guest;
    ctx.fillRect(p.x - 1.6, p.y - 9 - bounce, 3.2, 8);
    ctx.beginPath(); ctx.arc(p.x, p.y - 11 - bounce, 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    if (g.panic) {
      // red exclamation marker
      ctx.save();
      const flash = this.frame % 14 < 9;
      ctx.fillStyle = flash ? '#FF4D6D' : 'rgba(255,77,109,0.5)';
      ctx.fillRect(p.x - 0.9, p.y - 22, 1.8, 5);
      ctx.beginPath(); ctx.arc(p.x, p.y - 15.2, 1.1, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }

  drawSecurityUnit(ctx, u) {
    const s = this.state;
    const tx = Math.max(0, Math.min(MAP_SIZE - 1, Math.floor(u.x)));
    const ty = Math.max(0, Math.min(MAP_SIZE - 1, Math.floor(u.y)));
    const h = s.heights[idx(tx, ty)] || 0;
    const p = worldPx(u.x, u.y, h);
    ctx.save();
    // strobe light halo while active
    const pulse = 0.35 + 0.3 * Math.sin(this.frame / 5);
    ctx.fillStyle = `rgba(255,92,122,${pulse * 0.35})`;
    ctx.beginPath(); ctx.ellipse(p.x, p.y + 1, 8, 4, 0, 0, Math.PI * 2); ctx.fill();
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(p.x, p.y + 1, 3.8, 1.8, 0, 0, Math.PI * 2); ctx.fill();
    // armoured body (rose uniform, amber visor)
    ctx.fillStyle = '#b23a52';
    ctx.fillRect(p.x - 2.1, p.y - 10, 4.2, 9);
    ctx.fillStyle = '#F2C14E';
    ctx.fillRect(p.x - 2.1, p.y - 7.4, 4.2, 1.4);
    ctx.beginPath(); ctx.arc(p.x, p.y - 12, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = '#2a2f3a'; ctx.fill();
    // antenna blink
    ctx.strokeStyle = `rgba(255,92,122,${0.5 + pulse})`; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(p.x + 2, p.y - 13); ctx.lineTo(p.x + 3.5, p.y - 17); ctx.stroke();
    ctx.restore();
  }

  drawEntrance(ctx) {
    const s = this.state;
    const e = s.entrance;
    const p = worldPx(e.x + 0.5, e.y + 0.5, s.heights[idx(e.x, e.y)] || 0);
    ctx.save();
    ctx.strokeStyle = '#2DE2E6'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(p.x - 18, p.y); ctx.lineTo(p.x - 18, p.y - 26); ctx.lineTo(p.x + 18, p.y - 26); ctx.lineTo(p.x + 18, p.y); ctx.stroke();
    ctx.fillStyle = '#2DE2E6';
    ctx.font = '8px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('ENTRY', p.x, p.y - 30);
    ctx.restore();
  }

  // ---------- overlays ----------
  drawOverlays(ctx) {
    const s = this.state;
    if (!this.overlay) return;
    if (this.overlay === 'habitat') {
      const { enclosures } = computeEnclosures(s);
      for (const enc of enclosures) {
        const residents = s.creatures.filter((c) => c.enclosureId === enc.id);
        const score = residents.length ? residents.reduce((a, c) => a + c.comfort, 0) / residents.length : null;
        const col = score === null ? 'rgba(77,182,255,0.16)' : score > 0.7 ? 'rgba(62,226,138,0.2)' : score > 0.45 ? 'rgba(242,193,78,0.2)' : 'rgba(255,77,109,0.24)';
        ctx.fillStyle = col;
        for (const ti of enc.tiles) {
          this.diamondPath(ctx, ti % MAP_SIZE, Math.floor(ti / MAP_SIZE));
          ctx.fill();
        }
      }
    } else if (this.overlay === 'power') {
      for (const b of s.buildings) {
        if (b.type !== 'power') continue;
        const def = BUILDINGS.power;
        const offline = b.offlineUntil && s.tick < b.offlineUntil;
        const c = worldPx(b.x + b.w / 2, b.y + b.h / 2, s.heights[idx(b.x, b.y)] || 0);
        ctx.fillStyle = offline ? 'rgba(255,77,109,0.07)' : 'rgba(242,193,78,0.1)';
        ctx.strokeStyle = offline ? 'rgba(255,77,109,0.55)' : 'rgba(242,193,78,0.5)';
        ctx.lineWidth = 1.5;
        if (offline) ctx.setLineDash([6, 5]);
        ctx.beginPath();
        ctx.ellipse(c.x, c.y, def.powerRadius * TILE_W / 2, def.powerRadius * TILE_H / 2, 0, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        ctx.setLineDash([]);
        if (offline) {
          ctx.fillStyle = '#FF4D6D';
          ctx.font = `600 ${11 / this.cam.zoom}px "IBM Plex Mono", monospace`;
          ctx.textAlign = 'center';
          ctx.fillText('OFFLINE', c.x, c.y - 8);
          ctx.textAlign = 'left';
        }
      }
    } else if (this.overlay === 'view') {
      for (const b of s.buildings) {
        const def = BUILDINGS[b.type];
        if (!def.viewRadius) continue;
        const c = worldPx(b.x + b.w / 2, b.y + b.h / 2, s.heights[idx(b.x, b.y)] || 0);
        ctx.fillStyle = 'rgba(77,182,255,0.1)';
        ctx.strokeStyle = 'rgba(77,182,255,0.5)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(c.x, c.y, def.viewRadius * TILE_W / 2, def.viewRadius * TILE_H / 2, 0, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
      }
    }
  }

  // ---------- tool previews / hover / selection ----------
  drawToolPreview(ctx) {
    const t = this.tool;
    if (!this.hover) return;
    const { x, y } = this.hover;
    if (['raise', 'lower', 'flatten', 'smooth', 'paint', 'water', 'veg'].includes(t.mode)) {
      const r = this.brushSize - 1;
      ctx.fillStyle = PALETTE.blueprintFill;
      ctx.strokeStyle = PALETTE.blueprint;
      ctx.lineWidth = 1;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) + Math.abs(dy) > r + (this.brushSize > 1 ? 1 : 0)) continue;
        if (!inMap(x + dx, y + dy)) continue;
        this.diamondPath(ctx, x + dx, y + dy);
        ctx.fill(); ctx.stroke();
      }
    } else if (t.mode === 'path' || t.mode === 'pathRemove') {
      this.diamondPath(ctx, x, y);
      ctx.fillStyle = PALETTE.blueprintFill; ctx.fill();
      ctx.strokeStyle = PALETTE.blueprint; ctx.stroke();
    } else if (t.mode === 'fence' || t.mode === 'gate' || t.mode === 'fenceRemove') {
      const lp = this.fenceLinePreview;
      if (lp && lp.edges.length) {
        // drag-line preview: one straight wall, valid segments bright, blocked ones dim
        for (const ed of lp.edges) {
          const { a, b } = this.fenceCorners(ed.x, ed.y, ed.d);
          ctx.strokeStyle = ed.ok
            ? (lp.mode === 'fenceRemove' ? PALETTE.invalid : PALETTE.valid)
            : 'rgba(127,147,173,0.45)';
          ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
        // running total label near the end of the line
        const last = lp.edges[lp.edges.length - 1];
        const { a, b } = this.fenceCorners(last.x, last.y, last.d);
        const label = lp.mode === 'fenceRemove'
          ? `remove ${lp.count}`
          : `${lp.count} seg · ◈${lp.cost}`;
        const fs = 12 / this.cam.zoom;
        ctx.font = `600 ${fs}px "IBM Plex Mono", monospace`;
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 - 26 / this.cam.zoom;
        const tw = ctx.measureText(label).width;
        ctx.fillStyle = 'rgba(5,7,11,0.85)';
        ctx.fillRect(mx - tw / 2 - 6 / this.cam.zoom, my - fs * 1.1, tw + 12 / this.cam.zoom, fs * 1.7);
        ctx.fillStyle = lp.mode === 'fenceRemove' ? '#FF4D6D' : '#2DE2E6';
        ctx.textAlign = 'center';
        ctx.fillText(label, mx, my + fs * 0.25);
        ctx.textAlign = 'left';
      } else if (this.hoverEdge) {
        const { a, b } = this.fenceCorners(this.hoverEdge.x, this.hoverEdge.y, this.hoverEdge.d);
        ctx.strokeStyle = t.mode === 'fenceRemove' ? PALETTE.invalid : PALETTE.valid;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
    } else if (t.mode === 'building' && t.buildingType) {
      const def = BUILDINGS[t.buildingType];
      const ok = t._previewOk;
      ctx.fillStyle = ok ? PALETTE.validFill : PALETTE.invalidFill;
      ctx.strokeStyle = ok ? PALETTE.valid : PALETTE.invalid;
      for (let dy = 0; dy < def.h; dy++) for (let dx = 0; dx < def.w; dx++) {
        if (!inMap(x + dx, y + dy)) continue;
        this.diamondPath(ctx, x + dx, y + dy);
        ctx.fill(); ctx.stroke();
      }
    } else if (t.mode === 'place_creature') {
      this.diamondPath(ctx, x, y);
      ctx.fillStyle = t._previewOk ? PALETTE.validFill : PALETTE.invalidFill;
      ctx.fill();
      ctx.strokeStyle = t._previewOk ? PALETTE.valid : PALETTE.invalid;
      ctx.stroke();
    } else if (t.mode === 'demolish') {
      this.diamondPath(ctx, x, y);
      ctx.fillStyle = PALETTE.invalidFill; ctx.fill();
      ctx.strokeStyle = PALETTE.invalid; ctx.stroke();
    }
  }

  drawHover(ctx) {
    if (!this.hover || this.tool.mode !== 'select') return;
    this.diamondPath(ctx, this.hover.x, this.hover.y);
    ctx.strokeStyle = PALETTE.hover;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  drawSelection(ctx) {
    const sel = this.selection;
    const s = this.state;
    if (!sel) return;
    if (sel.kind === 'building') {
      const b = s.buildings.find((bb) => bb.id === sel.id);
      if (!b) return;
      ctx.strokeStyle = PALETTE.selected; ctx.lineWidth = 1.6;
      for (let dy = 0; dy < b.h; dy++) for (let dx = 0; dx < b.w; dx++) {
        this.diamondPath(ctx, b.x + dx, b.y + dy);
        ctx.stroke();
      }
    } else if (sel.kind === 'enclosure') {
      const { enclosures } = computeEnclosures(s);
      const enc = enclosures.find((e) => e.id === sel.id);
      if (!enc) return;
      ctx.fillStyle = 'rgba(45,226,230,0.07)';
      for (const ti of enc.tiles) {
        this.diamondPath(ctx, ti % MAP_SIZE, Math.floor(ti / MAP_SIZE));
        ctx.fill();
      }
    } else if (sel.kind === 'fence') {
      const f = s.fences[`${sel.x},${sel.y},${sel.d}`];
      if (!f) return;
      const { a, b } = this.fenceCorners(sel.x, sel.y, sel.d);
      ctx.strokeStyle = PALETTE.selected; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
  }
}

// ---------- procedural creature bodies (shared with UI portraits) ----------
export function drawBody(ctx, sp, sc, frame, c, bob = 0) {
  const col = sp.colors.body, acc = sp.colors.accent;
  const walk = c && c.path && c.path.length ? Math.sin(frame / 4) * 3 : 0;
  switch (sp.bodyType) {
    case 'tall': {
      // long legs, high body, long neck
      ctx.strokeStyle = shade(col, 0.8); ctx.lineWidth = 2.2 * sc;
      for (let k = 0; k < 4; k++) {
        const lx = (k - 1.5) * 5 * sc;
        ctx.beginPath(); ctx.moveTo(lx, -14 * sc); ctx.lineTo(lx + (k % 2 ? walk : -walk) * 0.4, 0); ctx.stroke();
      }
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.ellipse(0, -18 * sc + bob * 0.4, 12 * sc, 6.5 * sc, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = col; ctx.lineWidth = 3 * sc;
      ctx.beginPath(); ctx.moveTo(9 * sc, -20 * sc); ctx.quadraticCurveTo(16 * sc, -30 * sc, 18 * sc, -34 * sc + bob * 0.3); ctx.stroke();
      ctx.fillStyle = acc;
      ctx.beginPath(); ctx.ellipse(19 * sc, -35 * sc + bob * 0.3, 4 * sc, 2.6 * sc, 0.4, 0, Math.PI * 2); ctx.fill();
      // eyes glow points
      ctx.fillStyle = '#dff';
      ctx.fillRect(20 * sc, -36 * sc, 1.4, 1.4);
      break;
    }
    case 'quad': {
      ctx.strokeStyle = shade(col, 0.8); ctx.lineWidth = 2.4 * sc;
      for (let k = 0; k < 4; k++) {
        const lx = (k - 1.5) * 6 * sc;
        ctx.beginPath(); ctx.moveTo(lx, -8 * sc); ctx.lineTo(lx + (k % 2 ? walk : -walk) * 0.5, 0); ctx.stroke();
      }
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.ellipse(0, -11 * sc + bob * 0.3, 13 * sc, 7 * sc, 0, 0, Math.PI * 2); ctx.fill();
      // armour ridge
      ctx.strokeStyle = acc; ctx.lineWidth = 1.4 * sc;
      ctx.beginPath(); ctx.moveTo(-9 * sc, -15 * sc); ctx.quadraticCurveTo(0, -19 * sc + bob * 0.3, 9 * sc, -15 * sc); ctx.stroke();
      // head
      ctx.fillStyle = shade(col, 1.15);
      ctx.beginPath(); ctx.ellipse(13 * sc, -13 * sc + bob * 0.3, 5.5 * sc, 4 * sc, 0.2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#dff'; ctx.fillRect(15 * sc, -14 * sc, 1.4, 1.4);
      // tail
      ctx.strokeStyle = col; ctx.lineWidth = 2 * sc;
      ctx.beginPath(); ctx.moveTo(-12 * sc, -11 * sc); ctx.quadraticCurveTo(-18 * sc, -9 * sc, -20 * sc, -5 * sc); ctx.stroke();
      break;
    }
    case 'insect': {
      ctx.strokeStyle = shade(col, 0.9); ctx.lineWidth = 1.1 * sc;
      for (let k = 0; k < 6; k++) {
        const lx = (k - 2.5) * 3.4 * sc;
        ctx.beginPath(); ctx.moveTo(lx, -4 * sc); ctx.lineTo(lx + (k % 2 ? walk : -walk) * 0.6, 0); ctx.stroke();
      }
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.ellipse(-3 * sc, -6 * sc + bob * 0.4, 6 * sc, 4 * sc, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = shade(col, 1.2);
      ctx.beginPath(); ctx.ellipse(4 * sc, -6.5 * sc + bob * 0.4, 3.6 * sc, 2.8 * sc, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = acc;
      ctx.beginPath(); ctx.arc(6.5 * sc, -7 * sc, 1.1 * sc, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'winged': {
      const flap = Math.sin(frame / 8 + (c ? c.id : 0)) * 6;
      ctx.fillStyle = shade(col, 0.85);
      ctx.beginPath();
      ctx.moveTo(0, -14 * sc); ctx.quadraticCurveTo(-14 * sc, -22 * sc - flap, -22 * sc, -12 * sc - flap);
      ctx.quadraticCurveTo(-12 * sc, -12 * sc, 0, -12 * sc); ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(0, -14 * sc); ctx.quadraticCurveTo(14 * sc, -22 * sc - flap, 22 * sc, -12 * sc - flap);
      ctx.quadraticCurveTo(12 * sc, -12 * sc, 0, -12 * sc); ctx.closePath(); ctx.fill();
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.ellipse(0, -12 * sc + bob * 0.5, 7 * sc, 5 * sc, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = acc;
      ctx.beginPath(); ctx.ellipse(5 * sc, -14 * sc, 2.6 * sc, 2 * sc, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = shade(col, 0.7); ctx.lineWidth = 1.6 * sc;
      ctx.beginPath(); ctx.moveTo(-2 * sc, -7 * sc); ctx.lineTo(-2 * sc, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(2 * sc, -7 * sc); ctx.lineTo(2 * sc, 0); ctx.stroke();
      break;
    }
    case 'blob': {
      const squish = Math.sin(frame / 20 + (c ? c.id : 0)) * 1.5;
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.ellipse(0, -9 * sc + bob * 0.3, 13 * sc + squish, 9 * sc - squish * 0.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = shade(col, 1.25);
      ctx.beginPath(); ctx.ellipse(-3 * sc, -12 * sc, 6 * sc, 4 * sc, -0.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = acc;
      for (let k = 0; k < 3; k++) {
        ctx.beginPath(); ctx.arc((k - 1) * 6 * sc, -16 * sc + Math.sin(frame / 15 + k) * 1.5, 1.6 * sc, 0, Math.PI * 2); ctx.fill();
      }
      break;
    }
    case 'float': {
      const hover = Math.sin(frame / 16 + (c ? c.id : 0)) * 3;
      ctx.fillStyle = col;
      ctx.globalAlpha = 0.9;
      ctx.beginPath(); ctx.ellipse(0, -22 * sc + hover, 9 * sc, 6.5 * sc, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = acc;
      ctx.beginPath(); ctx.ellipse(0, -24 * sc + hover, 4 * sc, 2.6 * sc, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = acc; ctx.lineWidth = 1 * sc; ctx.globalAlpha = 0.7;
      for (let k = -1; k <= 1; k++) {
        ctx.beginPath(); ctx.moveTo(k * 4 * sc, -17 * sc + hover);
        ctx.quadraticCurveTo(k * 5 * sc + Math.sin(frame / 10 + k) * 2, -10 * sc + hover, k * 6 * sc, -4 * sc + hover);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      break;
    }
    case 'crystal': {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(0, -20 * sc + bob * 0.4); ctx.lineTo(6 * sc, -8 * sc); ctx.lineTo(3 * sc, 0); ctx.lineTo(-3 * sc, 0); ctx.lineTo(-6 * sc, -8 * sc);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = acc;
      ctx.beginPath(); ctx.moveTo(0, -17 * sc + bob * 0.4); ctx.lineTo(3 * sc, -9 * sc); ctx.lineTo(0, -6 * sc); ctx.lineTo(-3 * sc, -9 * sc); ctx.closePath(); ctx.fill();
      ctx.fillStyle = shade(col, 1.3);
      ctx.beginPath(); ctx.moveTo(7 * sc, -12 * sc); ctx.lineTo(10 * sc, -4 * sc); ctx.lineTo(6 * sc, -2 * sc); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-7 * sc, -12 * sc); ctx.lineTo(-10 * sc, -4 * sc); ctx.lineTo(-6 * sc, -2 * sc); ctx.closePath(); ctx.fill();
      break;
    }
    case 'serpent': {
      ctx.strokeStyle = col; ctx.lineWidth = 5 * sc;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-14 * sc, -3 * sc);
      for (let k = 0; k <= 8; k++) {
        const t = k / 8;
        ctx.lineTo(-14 * sc + t * 26 * sc, -6 * sc - Math.sin(t * Math.PI * 2 + frame / 8) * 4 * sc);
      }
      ctx.stroke();
      ctx.strokeStyle = acc; ctx.lineWidth = 1.4 * sc;
      ctx.beginPath();
      ctx.moveTo(-14 * sc, -3 * sc);
      for (let k = 0; k <= 8; k++) {
        const t = k / 8;
        ctx.lineTo(-14 * sc + t * 26 * sc, -6 * sc - Math.sin(t * Math.PI * 2 + frame / 8) * 4 * sc);
      }
      ctx.stroke();
      ctx.fillStyle = acc;
      ctx.beginPath(); ctx.arc(13 * sc, -7 * sc, 3 * sc, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'amphib': {
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.ellipse(0, -6 * sc + bob * 0.2, 14 * sc, 5.5 * sc, 0, 0, Math.PI * 2); ctx.fill();
      // ridged back
      ctx.strokeStyle = acc; ctx.lineWidth = 1.4 * sc;
      for (let k = -2; k <= 2; k++) {
        ctx.beginPath(); ctx.moveTo(k * 4 * sc, -10 * sc); ctx.lineTo(k * 4 * sc + 1.5 * sc, -13 * sc); ctx.stroke();
      }
      // head w/ raised eyes
      ctx.fillStyle = shade(col, 1.15);
      ctx.beginPath(); ctx.ellipse(12 * sc, -6 * sc, 6 * sc, 3.6 * sc, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = acc;
      ctx.beginPath(); ctx.arc(14 * sc, -10 * sc, 1.6 * sc, 0, Math.PI * 2); ctx.fill();
      // tail
      ctx.strokeStyle = col; ctx.lineWidth = 3.4 * sc;
      ctx.beginPath(); ctx.moveTo(-13 * sc, -5 * sc); ctx.quadraticCurveTo(-20 * sc, -4 * sc + Math.sin(frame / 10) * 2, -24 * sc, -2 * sc); ctx.stroke();
      break;
    }
    default: {
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.ellipse(0, -10 * sc, 10 * sc, 7 * sc, 0, 0, Math.PI * 2); ctx.fill();
    }
  }
}

export function renderPortrait(canvas, speciesId) {
  const sp = speciesById(speciesId);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#0A0F16';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // vignette rings
  ctx.strokeStyle = 'rgba(45,226,230,0.12)';
  ctx.beginPath(); ctx.arc(canvas.width / 2, canvas.height / 2, canvas.width * 0.42, 0, Math.PI * 2); ctx.stroke();
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height * 0.78);
  const sc = (canvas.width / 64) * 1.15;
  if (sp.colors.glow) { ctx.shadowColor = sp.colors.glow; ctx.shadowBlur = 12; }
  drawBody(ctx, sp, sc, 20, null, 0);
  ctx.restore();
}
