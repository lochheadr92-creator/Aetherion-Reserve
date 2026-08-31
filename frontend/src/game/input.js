// ---- Input: camera pan/zoom, tool application, selection ----
import { idx, inMap } from './state';
import { applyHeightTool, applyPaint, applyWater, applyVeg, applyPath } from './terrain';
import { placeFence, removeFence, toggleGate, canPlaceBuilding, placeBuilding, demolishBuilding, repairFence, canPlaceFenceSegment, fenceLineEdges, fenceRectEdges, placeFenceLine, placeFenceRect, removeFenceLine, removeFenceRect } from './construction';
import { enclosureAt } from './enclosures';
import { addCreature } from './creatures';
import { markSpecimenPlaced } from './expeditions';
import { speciesById } from './data/species';
import { spend } from './economy';
import { walkableForCreature } from './pathfind';
import { MAP_SIZE, FENCES } from './constants';

export class InputController {
  constructor(canvas, renderer, getState, cb = {}) {
    this.canvas = canvas;
    this.renderer = renderer;
    this.getState = getState;
    this.cb = cb; // { onSelect, onToolResult, onToolChange }
    this.dragging = false;
    this.panning = false;
    this.leftPanPending = null;
    this.lastApplied = null;
    this.lineStart = null; // fence drag-line anchor vertex {vx, vy}
    this.attach();
  }

  setTool(tool) {
    this.renderer.tool = tool;
    this.renderer.fenceLinePreview = null;
    this.lastApplied = null;
    this.lineStart = null;
    if (this.cb.onToolChange) this.cb.onToolChange(tool);
  }

  attach() {
    const c = this.canvas;
    c.addEventListener('wheel', this.onWheel, { passive: false });
    c.addEventListener('mousedown', this.onDown);
    window.addEventListener('mousemove', this.onMove);
    window.addEventListener('mouseup', this.onUp);
    c.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  detach() {
    const c = this.canvas;
    c.removeEventListener('wheel', this.onWheel);
    c.removeEventListener('mousedown', this.onDown);
    window.removeEventListener('mousemove', this.onMove);
    window.removeEventListener('mouseup', this.onUp);
  }

  onWheel = (e) => {
    e.preventDefault();
    const r = this.renderer;
    const rect = this.canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    const before = r.screenToWorld(sx, sy);
    r.cam.zoom = Math.max(0.35, Math.min(2.2, r.cam.zoom * (e.deltaY > 0 ? 0.9 : 1.11)));
    const after = r.screenToWorld(sx, sy);
    r.cam.x += (after.x - before.x) * r.cam.zoom;
    r.cam.y += (after.y - before.y) * r.cam.zoom;
  };

  onDown = (e) => {
    const rect = this.canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    if (e.button === 2 && this.dragging && this.lineStart) {
      // right-click cancels an in-progress fence drag-line
      this.cancelFenceDrag();
      return;
    }
    if (e.button === 2 || e.button === 1 || this.renderer.tool.mode === 'pan') {
      this.startPan(e.clientX, e.clientY, e.button);
      return;
    }
    if (e.button === 0) {
      const mode = this.renderer.tool.mode;
      if (mode === 'fence' || mode === 'fenceRemove') {
        // start a drag-line: anchor on the nearest tile corner; commit on mouseup
        this.dragging = true;
        this.lineStart = this.renderer.vertexFromPointer(sx, sy);
        this.updateFenceLinePreview(sx, sy);
        return;
      }
      if (mode === 'select') {
        // defer: a plain click selects on mouseup; dragging pans the camera
        this.leftPanPending = { x: e.clientX, y: e.clientY, sx, sy };
        return;
      }
      this.dragging = true;
      this.applyTool(sx, sy, true);
    }
  };

  startPan(cx, cy, button) {
    this.panning = true;
    this.panStart = { x: cx, y: cy, camX: this.renderer.cam.x, camY: this.renderer.cam.y, button, moved: false };
    this.canvas.style.cursor = 'grabbing';
  }

  cancelFenceDrag() {
    this.dragging = false;
    this.lineStart = null;
    this.renderer.fenceLinePreview = null;
  }

  // quick right-click (no drag): cancel the active tool, or clear the selection
  rightClickCancel() {
    if (this.renderer.tool.mode !== 'select') this.setTool({ mode: 'select' });
    else this.setSelection(null);
  }

  onMove = (e) => {
    const rect = this.canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    if (this.leftPanPending) {
      // promote a select-mode left drag into a camera pan after a small threshold
      if (Math.hypot(e.clientX - this.leftPanPending.x, e.clientY - this.leftPanPending.y) > 5) {
        this.startPan(this.leftPanPending.x, this.leftPanPending.y, 0);
        this.leftPanPending = null;
      }
    }
    if (this.panning) {
      const dx = e.clientX - this.panStart.x, dy = e.clientY - this.panStart.y;
      if (Math.hypot(dx, dy) > 4) this.panStart.moved = true;
      this.renderer.cam.x = this.panStart.camX + dx;
      this.renderer.cam.y = this.panStart.camY + dy;
      return;
    }
    const state = this.getState();
    if (!state) return;
    const t = this.renderer.screenToTile(sx, sy);
    this.renderer.hover = t;
    const mode = this.renderer.tool.mode;
    if (['fence', 'gate', 'fenceRemove'].includes(mode)) {
      this.renderer.hoverEdge = this.renderer.edgeFromPointer(sx, sy);
    } else this.renderer.hoverEdge = null;
    if (mode === 'building' && this.renderer.tool.buildingType) {
      this.renderer.tool._previewOk = canPlaceBuilding(state, this.renderer.tool.buildingType, t.x, t.y).ok;
    }
    if (mode === 'place_creature') {
      const enc = enclosureAt(state, t.x, t.y);
      this.renderer.tool._previewOk = !!enc && walkableForCreature(state, t.x, t.y, true);
    }
    if (this.dragging) {
      if (this.lineStart && (mode === 'fence' || mode === 'fenceRemove')) this.updateFenceLinePreview(sx, sy);
      else this.applyTool(sx, sy, false);
    }
  };

  onUp = (e) => {
    if (this.leftPanPending) {
      // plain left click in select mode → pick the object under the cursor
      this.applyTool(this.leftPanPending.sx, this.leftPanPending.sy, true);
      this.leftPanPending = null;
    }
    if (this.panning && this.panStart.button === 2 && !this.panStart.moved) this.rightClickCancel();
    if (this.lineStart && this.dragging) {
      const rect = this.canvas.getBoundingClientRect();
      this.commitFenceLine(e.clientX - rect.left, e.clientY - rect.top);
    }
    this.dragging = false;
    this.panning = false;
    this.lastApplied = null;
    this.canvas.style.cursor = '';
  };

  // ---------- fence drag-line ----------
  updateFenceLinePreview(sx, sy) {
    const state = this.getState();
    const r = this.renderer;
    if (!state || !this.lineStart) return;
    const mode = r.tool.mode;
    const tier = r.tool.fenceTier || 1;
    const def = FENCES[tier];
    const v1 = r.vertexFromPointer(sx, sy);
    const rect = r.tool.fenceShape === 'rect';
    const edges = rect ? fenceRectEdges(this.lineStart, v1) : fenceLineEdges(this.lineStart, v1);
    let count = 0;
    const annotated = edges.map((ed) => {
      const ok = mode === 'fence'
        ? canPlaceFenceSegment(state, ed.x, ed.y, ed.d, tier).ok
        : !!state.fences[`${ed.x},${ed.y},${ed.d}`];
      if (ok) count++;
      return { ...ed, ok };
    });
    r.fenceLinePreview = { mode, edges: annotated, count, cost: mode === 'fence' ? count * def.cost : 0 };
  }

  commitFenceLine(sx, sy) {
    const state = this.getState();
    const r = this.renderer;
    const mode = r.tool.mode;
    const v0 = this.lineStart;
    const v1 = r.vertexFromPointer(sx, sy);
    this.lineStart = null;
    r.fenceLinePreview = null;
    if (!state || !v0) return;
    const dragged = v0.vx !== v1.vx || v0.vy !== v1.vy;
    if (!dragged) {
      // simple click → single segment under the pointer (fine-tuning)
      const ed = r.edgeFromPointer(sx, sy);
      if (!ed) return;
      if (mode === 'fence') this.report(placeFence(state, ed.x, ed.y, ed.d, r.tool.fenceTier || 1), true);
      else this.report(removeFence(state, ed.x, ed.y, ed.d), true);
      return;
    }
    const rect = r.tool.fenceShape === 'rect';
    if (mode === 'fence') this.report(rect ? placeFenceRect(state, v0, v1, r.tool.fenceTier || 1) : placeFenceLine(state, v0, v1, r.tool.fenceTier || 1));
    else this.report(rect ? removeFenceRect(state, v0, v1) : removeFenceLine(state, v0, v1));
  }

  report(res, quiet = false) {
    if (this.cb.onToolResult && res && (!res.ok || !quiet)) this.cb.onToolResult(res);
    return res;
  }

  applyTool(sx, sy, isClick) {
    const state = this.getState();
    if (!state) return;
    const r = this.renderer;
    const mode = r.tool.mode;
    const t = r.screenToTile(sx, sy);
    const brush = r.brushSize;

    const throttleKey = mode === 'gate'
      ? (r.hoverEdge ? `${r.hoverEdge.x},${r.hoverEdge.y},${r.hoverEdge.d}` : null)
      : `${t.x},${t.y}`;
    if (!isClick && throttleKey === this.lastApplied) return;
    this.lastApplied = throttleKey;

    switch (mode) {
      case 'select': {
        if (!isClick) return;
        this.select(state, sx, sy, t);
        return;
      }
      case 'raise': case 'lower': case 'flatten': case 'smooth':
        this.report(applyHeightTool(state, mode, t.x, t.y, brush), true); return;
      case 'paint':
        this.report(applyPaint(state, r.tool.materialId, t.x, t.y, brush), true); return;
      case 'water':
        this.report(applyWater(state, r.tool.waterMode, t.x, t.y, brush), true); return;
      case 'veg':
        this.report(applyVeg(state, r.tool.vegId, t.x, t.y, brush), true); return;
      case 'path':
        this.report(applyPath(state, true, t.x, t.y), true); return;
      case 'pathRemove':
        this.report(applyPath(state, false, t.x, t.y), true); return;
      case 'gate': {
        if (!isClick) return;
        const e = r.hoverEdge; if (!e) return;
        this.report(toggleGate(state, e.x, e.y, e.d)); return;
      }
      case 'building': {
        if (!isClick) return;
        const res = placeBuilding(state, r.tool.buildingType, t.x, t.y);
        this.report(res);
        return;
      }
      case 'demolish': {
        if (!isClick) return;
        // priority: building > fence > path > veg
        const occ = state._occ && !state._occDirty ? state._occ : null;
        const b = state.buildings.find((bb) => t.x >= bb.x && t.x < bb.x + bb.w && t.y >= bb.y && t.y < bb.y + bb.h);
        if (b) { this.report(demolishBuilding(state, b.id)); return; }
        const e = r.edgeFromPointer(sx, sy);
        if (state.fences[`${e.x},${e.y},${e.d}`]) { this.report(removeFence(state, e.x, e.y, e.d)); return; }
        if (state.paths[idx(t.x, t.y)]) { this.report(applyPath(state, false, t.x, t.y)); return; }
        if (state.veg[idx(t.x, t.y)]) { this.report(applyVeg(state, 0, t.x, t.y, 1)); return; }
        return;
      }
      case 'place_creature': {
        if (!isClick) return;
        const speciesId = r.tool.speciesId;
        const sp = speciesById(speciesId);
        const enc = enclosureAt(state, t.x, t.y);
        if (!enc) { this.report({ ok: false, reason: 'Creatures must be released inside a fenced enclosure' }); return; }
        if (!walkableForCreature(state, t.x, t.y, true)) { this.report({ ok: false, reason: 'Blocked tile — choose open ground' }); return; }
        if (!r.tool.free) {
          const pay = spend(state, sp.cost, 'acquisition', `Acquired ${sp.name}`);
          if (!pay.ok) { this.report(pay); return; }
        }
        const c = addCreature(state, speciesId, t.x, t.y);
        if (r.tool.free && r.tool.expeditionId) markSpecimenPlaced(state, r.tool.expeditionId, r.tool.specimenId);
        this.report({ ok: true, msg: `${c.name} released` });
        if (this.cb.onCreaturePlaced) this.cb.onCreaturePlaced(c);
        return;
      }
      default: return;
    }
  }

  select(state, sx, sy, t) {
    const r = this.renderer;
    // creature pick: nearest within 20px screen
    let best = null, bestD = 26 / r.cam.zoom;
    for (const c of state.creatures) {
      const w = r.screenToWorld(sx, sy);
      const s = state;
      const h = s.heights[idx(Math.floor(c.x), Math.floor(c.y))] || 0;
      const p = { x: (c.x - c.y) * 32, y: (c.x + c.y) * 16 - h * 10 };
      const d = Math.hypot(w.x - p.x, w.y - p.y + 12);
      if (d < bestD) { bestD = d; best = c; }
    }
    if (best) { this.setSelection({ kind: 'creature', id: best.id }); return; }
    // building
    const b = state.buildings.find((bb) => t.x >= bb.x && t.x < bb.x + bb.w && t.y >= bb.y && t.y < bb.y + bb.h);
    if (b) { this.setSelection({ kind: 'building', id: b.id }); return; }
    // fence
    const e = r.edgeFromPointer(sx, sy);
    if (inMap(e.x, e.y) && state.fences[`${e.x},${e.y},${e.d}`]) { this.setSelection({ kind: 'fence', x: e.x, y: e.y, d: e.d }); return; }
    // enclosure
    const enc = enclosureAt(state, t.x, t.y);
    if (enc) { this.setSelection({ kind: 'enclosure', id: enc.id }); return; }
    this.setSelection(null);
  }

  setSelection(sel) {
    this.renderer.selection = sel;
    if (this.cb.onSelect) this.cb.onSelect(sel);
  }
}

export { repairFence };
