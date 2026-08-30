// ---- Game controller: owns the state object + fixed-timestep loop; bridge to React ----
import axios from 'axios';
import { TICK_MS } from './constants';
import { createNewGame, serialize, deserialize, emit, on, setTimeControls } from './state';
import { tickOnce, initObjectives } from './sim';
import { applyScenario } from './scenarios';
import { clearUndo } from './terrain';
import { parkValue } from './economy';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

class GameController {
  constructor() {
    this.state = null;
    this.saveId = null;
    this.saveName = null;
    this.loop = null;
    this.uiTimer = null;
    if (typeof window !== 'undefined') window.__game = this; // debug/testing access
  }

  newGame(opts) {
    this.state = createNewGame(opts);
    initObjectives(this.state);
    if (opts && opts.scenarioId) applyScenario(this.state, opts.scenarioId);
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
    const res = await axios.get(`${API}/saves`);
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
      const res = await axios.put(`${API}/saves/${this.saveId}`, payload);
      this.saveName = payload.name;
      return res.data;
    }
    const res = await axios.post(`${API}/saves`, payload);
    this.saveId = res.data.id;
    this.saveName = payload.name;
    return res.data;
  }

  async loadGame(saveId) {
    const res = await axios.get(`${API}/saves/${saveId}`);
    this.state = deserialize(res.data.state);
    initObjectives(this.state);
    this.saveId = saveId;
    this.saveName = res.data.name;
    clearUndo();
    this.startLoop();
    emit('gameStarted', this.state);
    return this.state;
  }

  async deleteSave(saveId) {
    await axios.delete(`${API}/saves/${saveId}`);
  }

  getParkValue() { return this.state ? parkValue(this.state) : 0; }
}

export const game = new GameController();
export { on, emit };
