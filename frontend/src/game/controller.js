// ---- Game controller: owns the state object + fixed-timestep loop; bridge to React ----
import axios from 'axios';
import { TICK_MS } from './constants';
import { createNewGame, serialize, deserialize, emit, on, setTimeControls, getRngCursor, getRngState } from './state';
import { tickOnce, initObjectives } from './sim';
import { adjacentOpenTile, addCreature, killCreature } from './creatures';
import { refreshContracts } from './contracts';
import { applyScenario } from './scenarios';
import { ensureGenes, inheritGenes } from './genetics';
import { ensureLineage } from './lineage';
import { projectPairing, recommendPartners, bestPairs } from './pairing';
import { clearUndo } from './terrain';
import { parkValue } from './economy';
import { placeFenceRect, damageFence, placeBuilding, canPlaceBuilding, demolishBuilding } from './construction';
import { computeEnclosures, enclosureAt } from './enclosures';
import { hireStaff, assignStaffEnclosure } from './staff';
import { BUILDINGS } from './data/buildings';
import { idx } from './state';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Per-player save scoping: a random UUID minted once per browser and sent with
// every save-service request. The backend stores it as the save's owner.
const TOKEN_KEY = 'aetherion_player_token';
export function playerToken() {
  try {
    let t = localStorage.getItem(TOKEN_KEY);
    if (!t) {
      t = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID()
        : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`;
      localStorage.setItem(TOKEN_KEY, t);
    }
    return t;
  } catch (e) {
    return null; // storage unavailable: fall back to unscoped (legacy) behaviour
  }
}
const http = axios.create({ baseURL: API });
http.interceptors.request.use((cfg) => {
  const t = playerToken();
  if (t) cfg.headers['X-Player-Token'] = t;
  return cfg;
});

class GameController {
  constructor() {
    this.state = null;
    this.saveId = null;
    this.saveName = null;
    this.loop = null;
    this.uiTimer = null;
    if (typeof window !== 'undefined') {
      window.__game = this; // debug/testing access
      // pure helpers exposed for the local test suites (no gameplay side effects)
      window.__gameDebug = {
        adjacentOpenTile, serialize, deserialize, getRngCursor, getRngState, playerToken,
        // pairing planner projections (read-only over this.state)
        projectPairing: (aId, bId) => { const cs = this.state?.creatures || []; return projectPairing(this.state, cs.find((c) => c.id === aId), cs.find((c) => c.id === bId)); },
        recommendPartners: (id, limit) => recommendPartners(this.state, (this.state?.creatures || []).find((c) => c.id === id), limit),
        bestPairs: (speciesId, limit) => bestPairs(this.state, speciesId, limit),
      };
    }
    // Deterministic setup harness for tests / debug tooling: scripted world building through the
    // same mutators the UI uses (fences, organisms, staff) plus a direct building spawn that skips
    // path/power/cost checks. Never used by gameplay code.
    this.dev = {
      fenceRect: (x0, y0, x1, y1, tier = 1) => placeFenceRect(this.state, { vx: x0, vy: y0 }, { vx: x1, vy: y1 }, tier),
      addCreature: (speciesId, x, y, opts = {}) => addCreature(this.state, speciesId, x, y, opts),
      spawnBuilding: (typeId, x, y) => {
        const def = BUILDINGS[typeId];
        if (!def) return null;
        const b = { id: this.state.nextId++, type: typeId, x, y, w: def.w, h: def.h, shelter: !!def.shelter, station: def.station || null };
        this.state.buildings.push(b);
        for (let dy = 0; dy < def.h; dy++) for (let dx = 0; dx < def.w; dx++) this.state.veg[idx(x + dx, y + dy)] = 0;
        this.state._occDirty = true; this.state._encDirty = true; this.state._terrainDirty = true;
        return b;
      },
      // the real (validated + paid) construction path, for rule/cost tests
      placeBuilding: (typeId, x, y) => placeBuilding(this.state, typeId, x, y),
      canPlaceBuilding: (typeId, x, y) => canPlaceBuilding(this.state, typeId, x, y),
      demolishBuilding: (id) => demolishBuilding(this.state, id),
      hireStaff: (role) => hireStaff(this.state, role),
      assignStaff: (staffId, encId) => assignStaffEnclosure(this.state, staffId, encId),
      enclosureAt: (x, y) => enclosureAt(this.state, x, y),
      enclosures: () => computeEnclosures(this.state).enclosures.map((e) => ({ id: e.id, area: e.area, tiles: e.tiles.length })),
      damageFence: (key, amount) => damageFence(this.state, key, amount),
      grant: (amount) => { this.state.cash += amount; return this.state.cash; },
      // tension pass: bloodline + death hooks so tests can stage lineage / DECEASED states deterministically
      offspring: (motherId, fatherId, x, y, juvenile = false) => {
        const m = this.state.creatures.find((c) => c.id === motherId);
        const f = this.state.creatures.find((c) => c.id === fatherId) || null;
        if (!m) return null;
        return addCreature(this.state, m.speciesId, x, y, { genes: inheritGenes(this.state, m, f), juvenile });
      },
      kill: (creatureId, cause = 'test harness') => {
        const c = this.state.creatures.find((q) => q.id === creatureId);
        return c ? killCreature(this.state, c, cause) : false;
      },
      flatten: (x0, y0, x1, y1, h = 2) => {
        const s = this.state;
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = idx(x, y); s.heights[i] = h; s.water[i] = 0; s.veg[i] = 0; }
        s._terrainDirty = true; s._encDirty = true; s._occDirty = true;
      },
      // every alert since the watch started (state.alerts is capped at 60, so long runs need a log)
      watchAlerts: () => {
        if (!this._alertLog) { this._alertLog = []; on('alert', (a) => this._alertLog.push({ tick: a.tick, type: a.type, title: a.title, msg: a.msg })); }
        return this._alertLog;
      },
      alerts: () => this._alertLog || [],
      clearAlerts: () => { if (this._alertLog) this._alertLog.length = 0; },
    };
  }

  newGame(opts) {
    this.state = createNewGame(opts); // opts.seed (if any) passes through unchanged
    initObjectives(this.state);
    if (opts && opts.scenarioId) applyScenario(this.state, opts.scenarioId);
    ensureGenes(this.state);
    ensureLineage(this.state);
    // initial directive offers (the only call outside the tick) — AFTER the scenario template,
    // so a mission's directives are generated against its populated park, not an empty one
    refreshContracts(this.state);
    this.saveId = null;
    this.saveName = null;
    clearUndo();
    this.startLoop();
    emit('gameStarted', this.state);
    return this.state;
  }

  startLoop() {
    if (this.loop) clearInterval(this.loop);
    if (this.uiTimer) clearInterval(this.uiTimer);
    let last = performance.now();
    let acc = 0;
    this.loop = setInterval(() => {
      const now = performance.now();
      acc += now - last;
      last = now;
      if (!this.state || this.state.paused) { acc = 0; return; }
      let steps = 0;
      while (acc >= TICK_MS && steps < 8) {
        acc -= TICK_MS;
        for (let k = 0; k < this.state.speed; k++) tickOnce(this.state);
        steps++;
      }
      if (acc > TICK_MS * 4) acc = 0; // avoid spiral of death
    }, TICK_MS / 2);
    this.uiTimer = setInterval(() => emit('uiRefresh', {}), 400);
  }

  stopLoop() {
    if (this.loop) clearInterval(this.loop);
    if (this.uiTimer) clearInterval(this.uiTimer);
    this.loop = null; this.uiTimer = null;
  }

  // Deterministic stepping for tests/debug tooling: advances the sim exactly n
  // fixed ticks synchronously regardless of pause state, then refreshes the UI.
  stepTicks(n) {
    if (!this.state) return 0;
    const steps = Math.max(0, Math.floor(Number(n) || 0));
    for (let k = 0; k < steps; k++) tickOnce(this.state);
    emit('uiRefresh', {});
    return this.state.tick;
  }

  setPaused(p) {
    if (!this.state) return;
    setTimeControls(this.state, { paused: p });
    emit('uiRefresh', {});
  }

  setSpeed(s) {
    if (!this.state) return;
    setTimeControls(this.state, { speed: s });
    emit('uiRefresh', {});
  }

  // ---------- persistence ----------
  async listSaves() {
    const res = await http.get('/saves');
    return res.data;
  }

  async saveGame(name) {
    if (!this.state) throw new Error('No active game');
    const payload = {
      name: name || this.saveName || `${this.state.parkName} — Cycle ${this.state.day}`,
      park_name: this.state.parkName,
      mode: this.state.mode,
      day: this.state.day,
      cash: Math.round(this.state.cash),
      rating: Math.round(this.state.rating.overall * 100) / 100,
      creatures: this.state.creatures.length,
      state: serialize(this.state),
    };
    if (this.saveId) {
      const res = await http.put(`/saves/${this.saveId}`, payload);
      this.saveName = payload.name;
      return res.data;
    }
    const res = await http.post('/saves', payload);
    this.saveId = res.data.id;
    this.saveName = payload.name;
    return res.data;
  }

  async loadGame(saveId) {
    const res = await http.get(`/saves/${saveId}`);
    // build and validate the incoming state fully before touching controller fields:
    // a failed load must leave the current game (if any) untouched
    const next = deserialize(res.data.state);
    initObjectives(next);
    ensureGenes(next);
    ensureLineage(next);
    this.state = next;
    this.saveId = saveId;
    this.saveName = res.data.name;
    clearUndo();
    this.startLoop();
    emit('gameStarted', this.state);
    return this.state;
  }

  async deleteSave(saveId) {
    await http.delete(`/saves/${saveId}`);
  }

  getParkValue() { return this.state ? parkValue(this.state) : 0; }
}

export const game = new GameController();
export { on, emit };
