// ---- Canvas isometric renderer. Reads authoritative state; never mutates gameplay. ----
import { MAP_SIZE, TILE_W, TILE_H, H_STEP, MAX_H, MATERIALS, VEG, FENCES, PALETTE } from './constants';
import { idx, inMap } from './state';
import { BUILDINGS } from './data/buildings';
import { speciesById } from './data/species';
import { computeEnclosures } from './enclosures';
import { getDayPhase } from './weather';
import { SPRITE_SCALE } from './art/pixel';
import { getCreatureSheet } from './art/creatures';
import { getBuildingSprite } from './art/buildings';
import { getStaffSprite } from './art/staff';
import { getTileTexture, drawCliff, drawPathTile, h2 } from './art/terrain_tex';
import { getFloraSprite } from './art/flora';
import { getGuestSprite } from './art/guests';

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
    this._waterTiles = [];
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
    const matId = s.materials[i];
    const diamond = () => {
      ctx.beginPath();
      ctx.moveTo(px, py - hh); ctx.lineTo(px + hw, py); ctx.lineTo(px, py + hh); ctx.lineTo(px - hw, py);
      ctx.closePath();
    };
    // cliff side faces (layered strata + AO) where neighbours are lower
    const hS = inMap(x, y + 1) ? s.heights[idx(x, y + 1)] : 0;
    const hE = inMap(x + 1, y) ? s.heights[idx(x + 1, y)] : 0;
    if (hS < h) drawCliff(ctx, px, py, (h - hS) * H_STEP, matId, 'S', x * 31 + y);
    if (hE < h) drawCliff(ctx, px, py, (h - hE) * H_STEP, matId, 'E', x * 17 + y * 3);
    // textured top face (anti-tiling variant picked by tile hash)
    ctx.drawImage(getTileTexture(matId, x, y), px - hw, py - hh);
    // elevation light lift (higher ground catches more sky light)
    if (h > 0) {
      ctx.fillStyle = `rgba(205,228,255,${Math.min(0.11, h * 0.017)})`;
      diamond(); ctx.fill();
    }
    // received shadow bands from higher neighbours (grounds cliff bases)
    const hN = inMap(x, y - 1) ? s.heights[idx(x, y - 1)] : h;
    const hW = inMap(x - 1, y) ? s.heights[idx(x - 1, y)] : h;
    if (hW > h || hN > h) {
      ctx.save();
      diamond(); ctx.clip();
      if (hW > h) { // cast shadow from upper-left edge (key light side)
        const a = Math.min(0.3, (hW - h) * 0.1);
        ctx.fillStyle = `rgba(4,7,12,${a})`;
        ctx.beginPath();
        ctx.moveTo(px - hw, py); ctx.lineTo(px, py - hh);
        ctx.lineTo(px + 7, py - hh + 4); ctx.lineTo(px - hw + 7, py + 4);
        ctx.closePath(); ctx.fill();
      }
      if (hN > h) { // softer occlusion along upper-right edge
        const a = Math.min(0.2, (hN - h) * 0.065);
        ctx.fillStyle = `rgba(4,7,12,${a})`;
        ctx.beginPath();
        ctx.moveTo(px, py - hh); ctx.lineTo(px + hw, py);
        ctx.lineTo(px + hw - 7, py + 4); ctx.lineTo(px - 7, py - hh + 4);
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }
    // material transition dashes along edges with different neighbour material
    const blendEdge = (nx, ny, ex0, ey0, ex1, ey1) => {
      if (!inMap(nx, ny)) return;
      const nm = s.materials[idx(nx, ny)];
      if (nm === matId || s.heights[idx(nx, ny)] !== h) return;
      ctx.strokeStyle = MATERIALS[nm].color;
      ctx.globalAlpha = 0.3;
      ctx.lineWidth = 1.6;
      ctx.setLineDash([3, 4]);
      ctx.lineDashOffset = (x * 7 + y * 5) % 6;
      ctx.beginPath(); ctx.moveTo(ex0, ey0); ctx.lineTo(ex1, ey1); ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    };
    blendEdge(x - 1, y, px - hw, py, px, py - hh);
    blendEdge(x, y - 1, px, py - hh, px + hw, py);
    // sparse ambient props (visual-only, cached layer)
    if (!s.water[i] && !s.paths[i] && !s.veg[i] && h2(x, y, 55) > 0.94) {
      const rx = px + (h2(x, y, 56) - 0.5) * 30, ry = py + (h2(x, y, 57) - 0.5) * 10;
      if (matId <= 1 || matId === 8) { // flower / bright tuft on grassland
        ctx.fillStyle = h2(x, y, 58) > 0.5 ? '#4a8a68' : '#5a9a58';
        ctx.fillRect(rx, ry - 2, 1, 2);
        ctx.fillStyle = '#8fd0b0'; ctx.fillRect(rx, ry - 3, 1, 1);
      } else { // small rock cluster
        ctx.fillStyle = 'rgba(8,12,18,0.5)'; ctx.fillRect(rx + 1, ry + 1, 3, 1);
        ctx.fillStyle = '#3c434c'; ctx.fillRect(rx, ry, 3, 2);
        ctx.fillStyle = '#5a6675'; ctx.fillRect(rx, ry, 2, 1);
      }
    }
    // water: depth-tinted base in cached layer + tile registered for animated overlay
    if (s.water[i] > 0) {
      const deep = s.water[i] === 2;
      ctx.fillStyle = deep ? 'rgba(4,18,31,0.92)' : 'rgba(9,40,53,0.8)';
      diamond(); ctx.fill();
      if (deep) { // darker centre pool
        ctx.fillStyle = 'rgba(2,10,20,0.55)';
        ctx.beginPath();
        ctx.moveTo(px, py - hh * 0.55); ctx.lineTo(px + hw * 0.55, py);
        ctx.lineTo(px, py + hh * 0.55); ctx.lineTo(px - hw * 0.55, py);
        ctx.closePath(); ctx.fill();
      }
      const dryEdges = [];
      if (inMap(x - 1, y) && !s.water[idx(x - 1, y)]) dryEdges.push('w');
      if (inMap(x, y - 1) && !s.water[idx(x, y - 1)]) dryEdges.push('n');
      if (inMap(x + 1, y) && !s.water[idx(x + 1, y)]) dryEdges.push('e');
      if (inMap(x, y + 1) && !s.water[idx(x, y + 1)]) dryEdges.push('s');
      this._waterTiles.push({ x: p.x, y: p.y, deep, dryEdges, seed: (x * 13 + y * 29) % 97 });
    }
    // facility walkway
    if (s.paths[i]) {
      const conn = {
        n: !!(inMap(x, y - 1) && s.paths[idx(x, y - 1)]),
        e: !!(inMap(x + 1, y) && s.paths[idx(x + 1, y)]),
        s: !!(inMap(x, y + 1) && s.paths[idx(x, y + 1)]),
        w: !!(inMap(x - 1, y) && s.paths[idx(x - 1, y)]),
      };
      drawPathTile(ctx, px, py, conn, x * 7 + y * 13);
    }
    // faint survey grid
    ctx.strokeStyle = PALETTE.gridLine;
    ctx.lineWidth = 0.35;
    ctx.globalAlpha = 0.35;
    diamond(); ctx.stroke();
    ctx.globalAlpha = 1;
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
    this.drawWaterOverlay(ctx);

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
    for (const w of (s.waste || [])) ents.push({ d: w.x + w.y - 0.3, kind: 'waste', w });
    for (const c of s.creatures) ents.push({ d: c.x + c.y, kind: 'creature', c });
    for (const g of s.guests) ents.push({ d: g.x + g.y, kind: 'guest', g });
    for (const u of (s.security?.units || [])) ents.push({ d: u.x + u.y, kind: 'secunit', u });
    for (const st of (s.staff || [])) ents.push({ d: st.x + st.y, kind: 'staff', st });
    ents.sort((a, b) => a.d - b.d);
    for (const e of ents) {
      if (e.kind === 'veg') this.drawVeg(ctx, e.x, e.y, e.v);
      else if (e.kind === 'fence') this.drawFence(ctx, e.x, e.y, e.dir, e.f, e.key);
      else if (e.kind === 'building') this.drawBuilding(ctx, e.b);
      else if (e.kind === 'waste') this.drawWaste(ctx, e.w);
      else if (e.kind === 'creature') this.drawCreature(ctx, e.c);
      else if (e.kind === 'guest') this.drawGuest(ctx, e.g);
      else if (e.kind === 'secunit') this.drawSecurityUnit(ctx, e.u);
      else if (e.kind === 'staff') this.drawStaff(ctx, e.st);
    }

    // entrance marker
    this.drawEntrance(ctx);
    this.drawSelection(ctx);
    this.drawHover(ctx);
    this.drawAtmosphere(ctx, W, H);
  }

  // day-night grade, rain and lightning — screen-space, drawn last
  drawAtmosphere(ctx, W, H) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (this._phase === 'night') {
      // cool night grade + corner vignette (emissives read through)
      ctx.fillStyle = 'rgba(6, 10, 34, 0.44)';
      ctx.fillRect(0, 0, W, H);
      const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.9);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(2,4,14,0.38)');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, H);
    } else if (this._phase === 'dusk') {
      // warm horizon gradient falling to cool shadow
      const gr = ctx.createLinearGradient(0, 0, 0, H);
      gr.addColorStop(0, 'rgba(34,14,52,0.26)');
      gr.addColorStop(0.55, 'rgba(70,28,44,0.2)');
      gr.addColorStop(1, 'rgba(96,46,30,0.14)');
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, W, H);
    }
    if (this._overcast) {
      ctx.fillStyle = 'rgba(14, 20, 30, 0.18)';
      ctx.fillRect(0, 0, W, H);
    }
    if (this._storm) {
      ctx.fillStyle = 'rgba(10, 16, 28, 0.34)';
      ctx.fillRect(0, 0, W, H);
      const f = this.frame * 11;
      // far rain layer (short, dim)
      ctx.strokeStyle = 'rgba(120, 160, 200, 0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < 90; i++) {
        const rx = ((i * 269 + f * 2) % (W + 60)) - 30;
        const ry = ((i * 151 + f * 5) % (H + 40)) - 20;
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx - 2, ry + 8);
      }
      ctx.stroke();
      // near rain layer (long, bright, faster)
      ctx.strokeStyle = 'rgba(160, 200, 235, 0.4)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let i = 0; i < 70; i++) {
        const rx = ((i * 379 + f * 4) % (W + 80)) - 40;
        const ry = ((i * 173 + f * 9) % (H + 60)) - 30;
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx - 5, ry + 16);
      }
      ctx.stroke();
      // ground splash ticks
      ctx.fillStyle = 'rgba(170, 210, 240, 0.25)';
      for (let i = 0; i < 16; i++) {
        const sx = ((i * 487 + f * 6) % W);
        const sy = H * 0.3 + ((i * 211 + f * 3) % (H * 0.7));
        ctx.fillRect(sx, sy, 2, 1);
      }
      // lightning flash
      if (this.frame % 260 < 3) {
        ctx.fillStyle = 'rgba(220, 235, 255, 0.16)';
        ctx.fillRect(0, 0, W, H);
      }
    }
  }

  tileCenter(x, y) {
    const s = this.state;
    const h = inMap(x, y) ? s.heights[idx(x, y)] : 0;
    return worldPx(x + 0.5, y + 0.5, h);
  }

  // animated water: drifting shimmer streaks + shoreline foam (cheap, additive over cached base)
  drawWaterOverlay(ctx) {
    const tiles = this._waterTiles;
    if (!tiles || tiles.length === 0) return;
    const hw = TILE_W / 2, hh = TILE_H / 2;
    const f = this.frame;
    ctx.save();
    for (const t of tiles) {
      // shimmer streaks (subset each frame keeps cost flat)
      if ((t.seed + (f >> 4)) % 3 === 0) {
        const ph = Math.sin(f / 26 + t.seed);
        const sx = t.x + ph * 9;
        const sy = t.y - 3 + ((t.seed * 7) % 9);
        ctx.fillStyle = t.deep ? 'rgba(90,170,200,0.10)' : 'rgba(140,220,235,0.13)';
        ctx.fillRect(sx - 5, sy, 10 + ph * 2, 1);
        ctx.fillRect(sx - 2, sy + 3, 5, 1);
      }
      // glint pixel
      if ((t.seed + (f >> 3)) % 11 === 0) {
        ctx.fillStyle = 'rgba(200,240,250,0.35)';
        ctx.fillRect(t.x + ((t.seed * 13) % 17) - 8, t.y + ((t.seed * 5) % 7) - 3, 1, 1);
      }
      // shoreline foam dashes along edges bordering dry land
      if (t.dryEdges.length) {
        ctx.strokeStyle = `rgba(150,230,235,${0.16 + 0.1 * Math.sin(f / 18 + t.seed)})`;
        ctx.lineWidth = 1.2;
        ctx.setLineDash([4, 5]);
        ctx.lineDashOffset = (f / 6 + t.seed) % 9;
        ctx.beginPath();
        for (const d of t.dryEdges) {
          if (d === 'w') { ctx.moveTo(t.x - hw + 2, t.y); ctx.lineTo(t.x, t.y - hh + 1); }
          else if (d === 'n') { ctx.moveTo(t.x, t.y - hh + 1); ctx.lineTo(t.x + hw - 2, t.y); }
          else if (d === 'e') { ctx.moveTo(t.x + hw - 2, t.y); ctx.lineTo(t.x, t.y + hh - 1); }
          else { ctx.moveTo(t.x, t.y + hh - 1); ctx.lineTo(t.x - hw + 2, t.y); }
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    ctx.restore();
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
    if (vId === 1) { // tall grass: two-tone blade clumps + seed heads
      // tuft base shadow
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath(); ctx.ellipse(p.x + 1, p.y + 3, 13, 3.4, 0, 0, Math.PI * 2); ctx.fill();
      for (let k = -2; k <= 2; k++) {
        const tall = (k * 13 + seed) % 3 === 0;
        ctx.strokeStyle = tall ? shade(v.color, 1.35) : (k % 2 ? v.color : shade(v.color, 0.8));
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(p.x + k * 5, p.y + 3);
        ctx.quadraticCurveTo(p.x + k * 5 + sway, p.y - 5, p.x + k * 5 + sway * 1.5, p.y - v.h - (tall ? 3 : 0));
        ctx.stroke();
        if (tall) { // seed head
          ctx.fillStyle = shade(v.color, 1.7);
          ctx.fillRect(p.x + k * 5 + sway * 1.5 - 1, p.y - v.h - 5, 2, 2);
        }
      }
    } else if (vId === 5) { // reed bloom: layered blades + luminous seed pods
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath(); ctx.ellipse(p.x + 1, p.y + 3, 11, 3, 0, 0, Math.PI * 2); ctx.fill();
      for (let k = -1; k <= 1; k++) {
        ctx.strokeStyle = k === 0 ? shade(v.color, 1.2) : v.color;
        ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(p.x + k * 6, p.y + 2);
        ctx.quadraticCurveTo(p.x + k * 6 + sway, p.y - 8, p.x + k * 8 + sway, p.y - v.h); ctx.stroke();
        ctx.fillStyle = shade(v.color, 1.45);
        ctx.beginPath(); ctx.ellipse(p.x + k * 8 + sway, p.y - v.h, 2.2, 2.6, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = shade(v.color, 1.9);
        ctx.fillRect(p.x + k * 8 + sway - 1, p.y - v.h - 1, 1, 1);
      }
    } else { // baked flora sprites: shrubs, trees, spore pillars, aether fronds
      const frame = Math.floor(this.frame / 55 + seed) % 2;
      const spr = getFloraSprite(vId, x, y, frame);
      if (spr) {
        const S = SPRITE_SCALE;
        const dw = spr.w * S, dh = spr.h * S;
        // contact shadow toward lower-right
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(p.x + 3, p.y + 2, dw * 0.3, dw * 0.13, 0, 0, Math.PI * 2);
        ctx.fill();
        if (v.glow && this._phase === 'night') {
          ctx.shadowColor = v.glow; ctx.shadowBlur = 9;
        }
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(spr.cv, Math.round(p.x - dw / 2), Math.round(p.y - dh + 4), dw, dh);
        ctx.shadowBlur = 0;
      }
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
    const lerp = (t) => [a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t];
    const wallQuad = () => {
      ctx.beginPath();
      ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(b.x, b.y - hgt); ctx.lineTo(a.x, a.y - hgt);
      ctx.closePath();
    };
    ctx.save();
    if (f.gate) {
      // access gate: translucent amber portal with slats + header beam
      ctx.fillStyle = 'rgba(242,193,78,0.2)';
      wallQuad(); ctx.fill();
      ctx.strokeStyle = 'rgba(242,193,78,0.55)'; ctx.lineWidth = 1;
      for (let k = 1; k < 4; k++) {
        const [x0, y0] = lerp(0.12), [x1, y1] = lerp(0.88);
        const gy = (hgt * k) / 4;
        ctx.beginPath(); ctx.moveTo(x0, y0 - gy); ctx.lineTo(x1, y1 - gy); ctx.stroke();
      }
      ctx.strokeStyle = '#F2C14E'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(a.x, a.y - hgt); ctx.lineTo(b.x, b.y - hgt); ctx.stroke();
    } else if (f.tier === 1) {
      // T1 mesh barrier: translucent fill + diagonal wire crosshatch
      ctx.fillStyle = 'rgba(20,30,44,0.45)';
      wallQuad(); ctx.fill();
      ctx.strokeStyle = 'rgba(122,143,168,0.4)'; ctx.lineWidth = 0.8;
      ctx.beginPath();
      for (let k = 0; k <= 4; k++) {
        const [x0, y0] = lerp(k / 4), [x1u, y1u] = lerp(Math.min(1, k / 4 + 0.25));
        const [x1d, y1d] = lerp(Math.max(0, k / 4 - 0.25));
        ctx.moveTo(x0, y0 - 2); ctx.lineTo(x1u, y1u - hgt + 3);
        ctx.moveTo(x0, y0 - 2); ctx.lineTo(x1d, y1d - hgt + 3);
      }
      ctx.stroke();
      ctx.strokeStyle = col; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(a.x, a.y - hgt); ctx.lineTo(b.x, b.y - hgt); ctx.stroke();
    } else if (f.tier === 2) {
      // T2 reinforced: strut frame + lower armour panel + twin rails
      ctx.fillStyle = 'rgba(20,30,44,0.55)';
      wallQuad(); ctx.fill();
      // lower panel with seam
      ctx.fillStyle = 'rgba(52,66,88,0.85)';
      ctx.beginPath();
      ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(b.x, b.y - hgt * 0.45); ctx.lineTo(a.x, a.y - hgt * 0.45);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(12,18,26,0.7)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(a.x, a.y - hgt * 0.22); ctx.lineTo(b.x, b.y - hgt * 0.22); ctx.stroke();
      // diagonal strut
      ctx.strokeStyle = shade('#3a4a60', 1.15); ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(a.x, a.y - hgt * 0.45); ctx.lineTo(b.x, b.y - hgt); ctx.stroke();
      ctx.strokeStyle = col; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(a.x, a.y - hgt); ctx.lineTo(b.x, b.y - hgt); ctx.stroke();
      ctx.globalAlpha = 0.5;
      ctx.beginPath(); ctx.moveTo(a.x, a.y - hgt * 0.72); ctx.lineTo(b.x, b.y - hgt * 0.72); ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (f.tier === 3) {
      // T3 heavy plate wall: solid panels + seams + hazard band
      ctx.fillStyle = 'rgba(44,56,76,0.94)';
      wallQuad(); ctx.fill();
      ctx.strokeStyle = 'rgba(10,15,22,0.8)'; ctx.lineWidth = 1;
      for (let k = 1; k < 3; k++) {
        const [xm, ym] = lerp(k / 3);
        ctx.beginPath(); ctx.moveTo(xm, ym); ctx.lineTo(xm, ym - hgt); ctx.stroke();
      }
      ctx.beginPath(); ctx.moveTo(a.x, a.y - hgt * 0.5); ctx.lineTo(b.x, b.y - hgt * 0.5); ctx.stroke();
      // rivet studs
      ctx.fillStyle = 'rgba(160,180,205,0.5)';
      for (let k = 0; k < 3; k++) {
        const [rx2, ry2] = lerp(0.18 + k * 0.32);
        ctx.fillRect(rx2, ry2 - hgt * 0.5 - 2, 1.4, 1.4);
      }
      // hazard band along the top
      const segs = 6;
      for (let k = 0; k < segs; k++) {
        const [x0, y0] = lerp(k / segs), [x1, y1] = lerp((k + 1) / segs);
        ctx.fillStyle = k % 2 ? '#f2c14e' : '#1a1216';
        ctx.beginPath();
        ctx.moveTo(x0, y0 - hgt); ctx.lineTo(x1, y1 - hgt); ctx.lineTo(x1, y1 - hgt + 2.4); ctx.lineTo(x0, y0 - hgt + 2.4);
        ctx.closePath(); ctx.fill();
      }
      ctx.strokeStyle = shade(col, 1.1); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(a.x, a.y - hgt); ctx.lineTo(b.x, b.y - hgt); ctx.stroke();
    } else {
      // T4 insulated: dark frame + vertical field emitters + energised top rail
      ctx.fillStyle = 'rgba(14,26,30,0.6)';
      wallQuad(); ctx.fill();
      for (let k = 1; k < 4; k++) {
        const [xm, ym] = lerp(k / 4);
        const on = (k + (this.frame >> 4)) % 2 === 0;
        ctx.strokeStyle = on ? 'rgba(110,243,197,0.5)' : 'rgba(110,243,197,0.18)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(xm, ym - 2); ctx.lineTo(xm, ym - hgt + 2); ctx.stroke();
      }
      ctx.shadowColor = '#6EF3C5'; ctx.shadowBlur = 6;
      ctx.strokeStyle = 'rgba(110,243,197,0.85)'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(a.x, a.y - hgt); ctx.lineTo(b.x, b.y - hgt); ctx.stroke();
      ctx.shadowBlur = 0;
      // insulator cabling at base
      ctx.strokeStyle = 'rgba(58,74,96,0.9)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(a.x, a.y - 2); ctx.lineTo(b.x, b.y - 2); ctx.stroke();
    }
    // structural posts with caps + base plates (all tiers)
    ctx.strokeStyle = shade('#3a4a60', damaged ? 0.8 : 1.2); ctx.lineWidth = 2;
    for (const pt of [a, b]) {
      ctx.beginPath(); ctx.moveTo(pt.x, pt.y); ctx.lineTo(pt.x, pt.y - hgt); ctx.stroke();
      ctx.fillStyle = shade('#3a4a60', 1.55);
      ctx.fillRect(pt.x - 1.4, pt.y - hgt - 1.4, 2.8, 1.6); // cap
      ctx.fillStyle = 'rgba(15,22,32,0.85)';
      ctx.fillRect(pt.x - 2.2, pt.y - 0.6, 4.4, 1.6); // base plate
    }
    if (f.gate) {
      ctx.fillStyle = '#F2C14E';
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      ctx.fillRect(mx - 2, my - hgt - 4, 4, 4);
      ctx.fillStyle = '#1a1216';
      ctx.fillRect(mx - 0.8, my - hgt - 3, 1.6, 2);
    }
    if (damaged) {
      // bent rail + spark flicker
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      ctx.strokeStyle = 'rgba(127,147,173,0.8)'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(mx - 5, my - hgt + 1); ctx.lineTo(mx, my - hgt + 5); ctx.lineTo(mx + 4, my - hgt + 2); ctx.stroke();
      if (this.frame % 30 < 15) {
        ctx.fillStyle = '#FF4D6D';
        ctx.beginPath(); ctx.arc(mx, my - hgt - 6, 3, 0, Math.PI * 2); ctx.fill();
      }
      if (this.frame % 9 < 3) {
        ctx.fillStyle = '#ffd9b0';
        ctx.fillRect(mx + 2, my - hgt + 4, 1.6, 1.6);
      }
    }
    ctx.restore();
  }

  drawBuilding(ctx, b) {
    const s = this.state;
    const h = s.heights[idx(b.x, b.y)] || 0;
    const spr = getBuildingSprite(b.type, b.w, b.h);
    const p00 = worldPx(b.x, b.y, h);
    // slow ambient frame (status lights / pulses)
    const fi = Math.floor(this.frame / 42 + (b.id % 2)) % spr.frames.length;
    const S = SPRITE_SCALE;
    ctx.save();
    // grounding cast shadow toward lower-right
    const pc = worldPx(b.x + b.w / 2, b.y + b.h / 2, h);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(pc.x + 4, pc.y + 2, (b.w + b.h) * 15, (b.w + b.h) * 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(spr.frames[fi], p00.x - spr.ox * S, p00.y - spr.oy * S, spr.W * S, spr.H * S);
    // surge-offline flicker for power relays
    if (b.type === 'power' && b.offlineUntil && s.tick < b.offlineUntil && this.frame % 20 < 10) {
      ctx.fillStyle = 'rgba(255,77,109,0.85)';
      ctx.beginPath(); ctx.arc(pc.x, pc.y - 46, 3, 0, Math.PI * 2); ctx.fill();
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
    const sheet = getCreatureSheet(c.speciesId);
    const grow = c.juvenile ? 0.5 + 0.5 * (c.growth || 0) : 1;
    const S = SPRITE_SCALE * grow * (inWater ? 0.85 : 1);
    const moving = c.path && c.path.length > 0;
    const frames = moving && sheet.walk ? sheet.walk : sheet.idle;
    const fi = Math.floor(this.frame / (moving ? 7 : 16) + (c.id % 5)) % frames.length;
    const dw = sheet.w * S, dh = sheet.h * S;
    // floaters bob gently; hoverers sit slightly above ground
    const bob = sheet.bob ? Math.sin(this.frame / 18 + c.id) * 2.5 : 0;
    const lift = (sheet.hover || 0) * S;
    const gy = p.y + (inWater ? 3 : 0);
    ctx.save();
    // per-species contact shadow (soft/detached profiles supported)
    const sh = sheet.shadow;
    const shx = p.x + 2, shy = p.y + 1.5; // grounding toward lower-right
    ctx.fillStyle = `rgba(0,0,0,${sh.alpha * (sh.detached ? 0.8 : 1)})`;
    ctx.beginPath(); ctx.ellipse(shx, shy, sh.rx * S, sh.ry * S, 0, 0, Math.PI * 2); ctx.fill();
    if (sh.soft) {
      ctx.fillStyle = `rgba(0,0,0,${sh.alpha * 0.4})`;
      ctx.beginPath(); ctx.ellipse(shx, shy, sh.rx * S * 1.5, sh.ry * S * 1.5, 0, 0, Math.PI * 2); ctx.fill();
    }
    if (c.escaped && this.frame % 40 < 24) {
      ctx.strokeStyle = '#FF4D6D'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(p.x, p.y + 2, dw * 0.6 + 4, dw * 0.3 + 2, 0, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.translate(p.x, gy + bob - lift);
    ctx.scale(c.dir, 1);
    // camouflage: near-invisible shimmer; thermal optics keeps a readable heat signature
    if (c.cloaked) {
      const thermal = this.state.research?.completed?.includes('sec_thermal');
      ctx.globalAlpha = thermal ? 0.55 : 0.1 + 0.06 * Math.sin(this.frame / 6 + c.id);
      if (thermal) { ctx.shadowColor = '#FF8A5C'; ctx.shadowBlur = 8; }
    } else if (sp.colors.glow && this._phase === 'night') {
      // selective bioluminescence at night (restrained)
      ctx.shadowColor = sp.colors.glow; ctx.shadowBlur = 7;
    }
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(frames[fi], -dw / 2, -dh + 2, dw, dh);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.restore();
    // electrical surge arcs
    if (c._surgeUntil && this.state.tick < c._surgeUntil) {
      ctx.save();
      ctx.strokeStyle = 'rgba(45,226,230,0.9)'; ctx.lineWidth = 1.4;
      for (let a = 0; a < 3; a++) {
        const ang = (this.frame / 3 + a * 2.1 + c.id) % (Math.PI * 2);
        let ax = p.x, ay = p.y - dh * 0.5;
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
      ctx.beginPath(); ctx.arc(p.x, p.y - dh - 6, 3, 0, Math.PI * 2); ctx.fill();
    }
    if (this.selection?.kind === 'creature' && this.selection.id === c.id) {
      ctx.strokeStyle = PALETTE.selected; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.ellipse(p.x, p.y + 2, dw * 0.6 + 5, dw * 0.3 + 3, 0, 0, Math.PI * 2); ctx.stroke();
    }
  }

  drawGuest(ctx, g) {
    const s = this.state;
    const h = s.heights[idx(Math.floor(g.x), Math.floor(g.y))] || 0;
    const p = worldPx(g.x, g.y, h);
    const spr = getGuestSprite(g.archetype || 'family', g.id % 4, Math.floor(this.frame / (g.panic ? 4 : 9) + g.id));
    const S = 1.6; // guests slightly smaller than staff
    const dw = spr.w * S, dh = spr.h * S;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(p.x + 1, p.y + 1, 4, 1.8, 0, 0, Math.PI * 2); ctx.fill();
    // panicked guests sprint with a frantic bounce and lean
    const bounce = g.panic ? Math.abs(Math.sin(this.frame / 2.2 + g.id)) * 2.5 : 0;
    if (g.panic) { ctx.translate(p.x, p.y - bounce); ctx.rotate(0.16 * (g.id % 2 === 0 ? 1 : -1)); ctx.translate(-p.x, -(p.y - bounce)); }
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(spr.cv, p.x - dw / 2, p.y - dh + 1 - bounce, dw, dh);
    ctx.restore();
    if (g.panic) {
      // red exclamation marker
      ctx.save();
      const flash = this.frame % 14 < 9;
      ctx.fillStyle = flash ? '#FF4D6D' : 'rgba(255,77,109,0.5)';
      ctx.fillRect(p.x - 0.9, p.y - 27, 1.8, 5);
      ctx.beginPath(); ctx.arc(p.x, p.y - 20.2, 1.1, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }

  drawSecurityUnit(ctx, u) {
    const s = this.state;
    const tx = Math.max(0, Math.min(MAP_SIZE - 1, Math.floor(u.x)));
    const ty = Math.max(0, Math.min(MAP_SIZE - 1, Math.floor(u.y)));
    const h = s.heights[idx(tx, ty)] || 0;
    const p = worldPx(u.x, u.y, h);
    const spr = getStaffSprite('warden');
    const S = SPRITE_SCALE;
    const fi = Math.floor(this.frame / 20 + u.id) % spr.frames.length;
    ctx.save();
    // strobe light halo while active
    const pulse = 0.35 + 0.3 * Math.sin(this.frame / 5);
    ctx.fillStyle = `rgba(255,92,122,${pulse * 0.3})`;
    ctx.beginPath(); ctx.ellipse(p.x, p.y + 1, 9, 4.5, 0, 0, Math.PI * 2); ctx.fill();
    // contact shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(p.x + 1, p.y + 1, 4.5, 2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(spr.frames[fi], p.x - (spr.w * S) / 2, p.y - spr.h * S + 2, spr.w * S, spr.h * S);
    ctx.restore();
  }

  // ---------- keeper staff (deterministic sim entities; sprites from art/staff.js) ----------
  drawStaff(ctx, st) {
    const s = this.state;
    const tx = Math.max(0, Math.min(MAP_SIZE - 1, Math.floor(st.x)));
    const ty = Math.max(0, Math.min(MAP_SIZE - 1, Math.floor(st.y)));
    const h = s.heights[idx(tx, ty)] || 0;
    const p = worldPx(st.x, st.y, h);
    const spr = getStaffSprite(st.role === 'warden' ? 'warden' : st.role === 'biomedical' ? 'biomedical' : 'xenobiologist');
    if (!spr) return;
    const S = SPRITE_SCALE;
    const moving = st.state === 'moving';
    const fi = Math.floor(this.frame / (moving ? 9 : 22) + (st.id % 3)) % spr.frames.length;
    ctx.save();
    // contact shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(p.x + 1, p.y + 1, 4.5, 2, 0, 0, Math.PI * 2); ctx.fill();
    // working pulse ring (soft, role-tinted)
    if (st.state === 'working') {
      const pulse = 0.25 + 0.2 * Math.sin(this.frame / 8 + st.id);
      const tint = st.role === 'warden' ? '242,193,78' : st.role === 'biomedical' ? '77,182,255' : '110,243,197';
      ctx.strokeStyle = `rgba(${tint},${pulse})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.ellipse(p.x, p.y + 1, 8, 4, 0, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.translate(p.x, p.y);
    ctx.scale(st.dir || 1, 1);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(spr.frames[fi], -(spr.w * S) / 2, -spr.h * S + 2, spr.w * S, spr.h * S);
    ctx.restore();
  }

  // ---------- biowaste (cleaned up by keepers) ----------
  drawWaste(ctx, w) {
    const s = this.state;
    const h = s.heights[idx(w.x, w.y)] || 0;
    const p = worldPx(w.x + 0.5, w.y + 0.5, h);
    if (!this._wasteSpr) {
      const cv = document.createElement('canvas');
      cv.width = 9; cv.height = 6;
      const c2 = cv.getContext('2d');
      c2.imageSmoothingEnabled = false;
      // small olive mound, upper-left lit
      c2.fillStyle = '#3a4028'; c2.fillRect(2, 2, 5, 3);
      c2.fillStyle = '#4a5232'; c2.fillRect(3, 1, 3, 2);
      c2.fillStyle = '#565f3a'; c2.fillRect(3, 1, 2, 1);
      c2.fillStyle = '#2c301e'; c2.fillRect(4, 4, 3, 1);
      c2.fillStyle = 'rgba(5,9,14,0.6)'; c2.fillRect(1, 4, 2, 1); c2.fillRect(7, 3, 1, 2);
      this._wasteSpr = cv;
    }
    const S = SPRITE_SCALE;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath(); ctx.ellipse(p.x + 1, p.y + 1, 6, 2.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this._wasteSpr, p.x - (9 * S) / 2, p.y - 6 * S + 4, 9 * S, 6 * S);
    ctx.restore();
  }

  drawEntrance(ctx) {
    const s = this.state;
    const e = s.entrance;
    const p = worldPx(e.x + 0.5, e.y + 0.5, s.heights[idx(e.x, e.y)] || 0);
    ctx.save();
    // ground contact shadow
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath(); ctx.ellipse(p.x + 2, p.y + 2, 24, 7, 0, 0, Math.PI * 2); ctx.fill();
    // twin pylon towers
    for (const sx of [-19, 17]) {
      ctx.fillStyle = '#22303e';
      ctx.fillRect(p.x + sx, p.y - 28, 5, 28);
      ctx.fillStyle = '#31435c';
      ctx.fillRect(p.x + sx, p.y - 28, 2, 28); // lit edge
      ctx.fillStyle = '#141d28';
      ctx.fillRect(p.x + sx + 4, p.y - 28, 1, 28); // shaded edge
      // base plinth + cap
      ctx.fillStyle = '#3b414c';
      ctx.fillRect(p.x + sx - 1, p.y - 2, 7, 3);
      ctx.fillStyle = '#4a5a70';
      ctx.fillRect(p.x + sx - 1, p.y - 30, 7, 2);
      // status lamp
      ctx.fillStyle = this.frame % 60 < 30 ? '#2DE2E6' : 'rgba(45,226,230,0.4)';
      ctx.fillRect(p.x + sx + 1.5, p.y - 26, 2, 2);
    }
    // header beam with thickness
    ctx.fillStyle = '#2c3547';
    ctx.fillRect(p.x - 20, p.y - 34, 43, 5);
    ctx.fillStyle = '#3d5170';
    ctx.fillRect(p.x - 20, p.y - 34, 43, 1.6);
    ctx.fillStyle = '#141d28';
    ctx.fillRect(p.x - 20, p.y - 30, 43, 1);
    // scan curtain (subtle animated)
    const ph = (this.frame % 40) / 40;
    ctx.fillStyle = 'rgba(45,226,230,0.09)';
    ctx.fillRect(p.x - 14, p.y - 28, 30, 28);
    ctx.fillStyle = 'rgba(45,226,230,0.2)';
    ctx.fillRect(p.x - 14, p.y - 28 + ph * 26, 30, 1.2);
    // signage
    ctx.fillStyle = '#2DE2E6';
    ctx.font = '600 7px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('AETHERION · ENTRY', p.x + 1, p.y - 37);
    ctx.textAlign = 'left';
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

// ---------- Species Database portraits (baked pixel sprites in the archive frame) ----------
export function renderPortrait(canvas, speciesId) {
  const sp = speciesById(speciesId);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#0A0F16';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // vignette rings (archive framing preserved)
  ctx.strokeStyle = 'rgba(45,226,230,0.12)';
  ctx.beginPath(); ctx.arc(canvas.width / 2, canvas.height / 2, canvas.width * 0.42, 0, Math.PI * 2); ctx.stroke();
  const sheet = getCreatureSheet(speciesId);
  if (!sheet) return;
  const frame = sheet.idle[0];
  // fit sprite into the frame, integer-ish scale, silhouette-first
  const box = canvas.width * 0.76;
  const scale = Math.max(1, Math.min(box / sheet.w, box / sheet.h));
  const dw = sheet.w * scale, dh = sheet.h * scale;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  // soft ground contact
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(canvas.width / 2 + 2, canvas.height * 0.86, dw * 0.34, dh * 0.08 + 2, 0, 0, Math.PI * 2);
  ctx.fill();
  if (sp.colors.glow) { ctx.shadowColor = sp.colors.glow; ctx.shadowBlur = 6; }
  ctx.drawImage(frame, (canvas.width - dw) / 2, canvas.height * 0.86 - dh, dw, dh);
  ctx.restore();
}
