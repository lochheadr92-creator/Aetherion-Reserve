// ---- Keeper staff: hireable personnel who feed, clean and calm creatures ----
// Deterministic staff simulation. Staff move on the tile grid (A*, service access
// through gates/fences), acquire tasks by role priority and apply effects on completion.
import { FENCES, MAP_SIZE } from './constants';
import { idx, inMap, logCause, rnd } from './state';
import { spend } from './economy';
import { findPath, buildOccupancy } from './pathfind';
import { speciesById } from './data/species';
import { recordEvidence } from './knowledge';
import { enclosureAt, computeEnclosures } from './enclosures';
import { STAFF_ROLES, STAFF_NAMES } from './data/staffRoles';

const STAFF_SPEED = 0.08; // brisk service pace: faster than creatures (0.045), slower than response units (0.085)
const MAX_STAFF = 12;
const MED_COOLDOWN = 900; // ticks before the same creature can be treated again
const WORK_TICKS = { feed: 20, clean: 18, treat: 25, observe: 50, repair: 240, patrol: 40 };
const FEED_COST = { forage: 8, meat: 26, mineral: 14, fungal: 16, energy: 30 };

// ---------- hire / fire (controlled mutators; UI never touches state directly) ----------
export function hireStaff(state, role) {
  const def = STAFF_ROLES[role];
  if (!def) return { ok: false, reason: 'Unknown role' };
  if (!state.staff) state.staff = [];
  if (state.staff.length >= MAX_STAFF) return { ok: false, reason: `Staff roster is full (${MAX_STAFF})` };
  if (state.mode !== 'sandbox' && state.cash < def.hire) {
    return { ok: false, reason: `Insufficient funds (need \u25c8${def.hire.toLocaleString()})` };
  }
  const pay = spend(state, def.hire, 'wages', `Hiring: ${def.name}`);
  if (!pay.ok) return pay;
  const admin = state.buildings.find((b) => b.type === 'admin');
  const sx = Math.max(0.5, Math.min(MAP_SIZE - 0.5, admin ? admin.x + admin.w / 2 : state.entrance.x + 0.5));
  const sy = Math.max(0.5, Math.min(MAP_SIZE - 0.5, admin ? admin.y + admin.h + 0.5 : state.entrance.y - 1.5));
  const st = {
    id: state.nextId++, role,
    name: STAFF_NAMES[state.nextId % STAFF_NAMES.length],
    x: sx, y: sy, dir: 1,
    path: [], state: 'idle', task: null, workTicks: 0, hiredDay: state.day,
    assignedEnclosureId: null, assignedAnchor: null,
    report: {}, // per-cycle work tally: feeds/cleans/treats/observes/repairs
  };
  state.staff.push(st);
  logCause(state, 'Staffing', `${def.name} ${st.name} joined the facility`);
  return { ok: true, staff: st };
}

export function fireStaff(state, id) {
  if (!state.staff) return { ok: false, reason: 'No staff' };
  const i = state.staff.findIndex((s) => s.id === id);
  if (i < 0) return { ok: false, reason: 'Staff member not found' };
  const st = state.staff[i];
  state.staff.splice(i, 1);
  logCause(state, 'Staffing', `${STAFF_ROLES[st.role].name} ${st.name} left the facility`);
  return { ok: true };
}

export function dailyWages(state) {
  return (state.staff || []).reduce((sum, st) => sum + (STAFF_ROLES[st.role]?.wage || 0), 0);
}

// ---------- keeper priorities: per-staff enclosure assignment ----------
// Assignments are anchored to a representative tile inside the enclosure so that
// fence edits (which renumber flood-fill regions) keep pointing at the same
// physical area. Assigned staff prioritise tasks inside their enclosure first,
// then help anywhere in the park when their own area needs nothing (flexible mode).
export function assignStaffEnclosure(state, staffId, enclosureId) {
  const st = (state.staff || []).find((s) => s.id === staffId);
  if (!st) return { ok: false, reason: 'Staff member not found' };
  if (enclosureId == null) {
    st.assignedEnclosureId = null;
    st.assignedAnchor = null;
    logCause(state, 'Staffing', `${st.name} returned to general duties`);
    return { ok: true, enclosureId: null };
  }
  const { enclosures } = computeEnclosures(state);
  const enc = enclosures.find((e) => e.id === enclosureId);
  if (!enc) return { ok: false, reason: 'Enclosure no longer exists' };
  const ti = enc.tiles[0];
  st.assignedEnclosureId = enc.id;
  st.assignedAnchor = { x: ti % MAP_SIZE, y: Math.floor(ti / MAP_SIZE) };
  logCause(state, 'Staffing', `${st.name} assigned to Enclosure #${enc.id}`);
  return { ok: true, enclosureId: enc.id };
}

// Resolve an assignment to the live enclosure object. Returns null when the
// anchor is no longer inside a fenced region (e.g. mid-rebuild) — the keeper
// then falls back to park-wide duties until the area is enclosed again.
export function resolveAssignment(state, st) {
  if (!st.assignedAnchor) return null;
  const enc = enclosureAt(state, st.assignedAnchor.x, st.assignedAnchor.y);
  if (enc) st.assignedEnclosureId = enc.id; // regions may renumber after fence edits
  return enc;
}

// task candidate filters: restrict a search pass to one enclosure, or allow all
const PASS_ANY = { creature: () => true, tile: () => true, fence: () => true };

function assignmentFilter(state, enc) {
  const { region } = computeEnclosures(state);
  const rid = enc.id;
  const tileIn = (x, y) => inMap(x, y) && region[idx(x, y)] === rid;
  return {
    creature: (c) => c.enclosureId === rid,
    tile: tileIn,
    fence: (key) => {
      const [xs, ys, dir] = key.split(',');
      const x = Number(xs), y = Number(ys);
      return tileIn(x, y) || (dir === 'E' ? tileIn(x + 1, y) : tileIn(x, y + 1));
    },
  };
}

// ---------- biowaste: creatures foul their exhibits; keepers clean it ----------
export function wasteTick(state, c) {
  if (c.escaped || c.juvenile) return;
  if (rnd() > 0.35) return;
  if (!state.waste) state.waste = [];
  if (state.waste.length >= 60) return;
  const x = Math.floor(c.x), y = Math.floor(c.y);
  if (!inMap(x, y)) return;
  if (!enclosureAt(state, x, y)) return;
  if (state.water[idx(x, y)]) return;
  const nearby = state.waste.filter((w) => Math.abs(w.x - x) + Math.abs(w.y - y) < 8).length;
  if (nearby >= 6) return;
  state.waste.push({ id: state.nextId++, x, y });
}

export function wasteNear(state, x, y, r = 7) {
  if (!state.waste || !state.waste.length) return 0;
  return state.waste.filter((w) => Math.hypot(w.x - x, w.y - y) <= r).length;
}

// ---------- movement helpers ----------
function staffWalk(state) {
  const occ = buildOccupancy(state);
  return (x, y) => {
    if (!inMap(x, y)) return false;
    if (occ[idx(x, y)]) return false;
    if (state.water[idx(x, y)] === 2) return false;
    return true;
  };
}

// Staff have facility access: fences/gates never block them, deep water and cliffs do.
function routeTo(state, st, tx, ty) {
  const sx = Math.floor(st.x), sy = Math.floor(st.y);
  const p = findPath(state, sx, sy, tx, ty, { crossFences: true, walkFn: staffWalk(state), maxNodes: 3200 });
  if (!p) return false;
  st.path = p;
  return true;
}

function goTo(state, st, tx, ty, task) {
  if (!routeTo(state, st, tx, ty)) return false;
  st.task = task;
  st.state = 'moving';
  st._retries = 0;
  return true;
}

function targeted(state, type, targetId) {
  return (state.staff || []).some((s) => s.task && s.task.type === type &&
    (s.task.targetId === targetId || s.task.key === targetId));
}

function finishTask(st) {
  st.task = null;
  st.state = 'idle';
  st.workTicks = 0;
  st.path = [];
}

// ---------- task acquisition by role ----------
// Each role finder searches for a job among candidates accepted by `pick`
// (an assignment filter or PASS_ANY) and returns true if a task was acquired.
function tryXenoTasks(state, st, pick) {
  // 1) hungriest contained creature
  const hungry = state.creatures
    .filter((c) => !c.escaped && c.needs.hunger < 0.45 && pick.creature(c) && !targeted(state, 'feed', c.id))
    .sort((a, b) => a.needs.hunger - b.needs.hunger)[0];
  if (hungry && goTo(state, st, Math.floor(hungry.x), Math.floor(hungry.y), { type: 'feed', targetId: hungry.id })) return true;
  // 2) nearest biowaste
  if (state.waste && state.waste.length) {
    const w = [...state.waste]
      .filter((q) => pick.tile(q.x, q.y) && !targeted(state, 'clean', q.id))
      .sort((a, b) => Math.hypot(a.x - st.x, a.y - st.y) - Math.hypot(b.x - st.x, b.y - st.y))[0];
    if (w && goTo(state, st, w.x, w.y, { type: 'clean', targetId: w.id })) return true;
  }
  // 3) observe an organism with undocumented biology
  const cands = state.creatures.filter((c) => {
    if (c.escaped || !pick.creature(c)) return false;
    const sp = speciesById(c.speciesId);
    const k = state.knowledge[c.speciesId];
    return sp.hiddenAttrs.some((a) => !k.discovered[a]);
  });
  if (cands.length) {
    const c = cands[Math.floor(rnd() * cands.length)];
    if (goTo(state, st, Math.floor(c.x), Math.floor(c.y), { type: 'observe', targetId: c.id })) return true;
  }
  return false;
}

function tryMedTasks(state, st, pick) {
  const sick = state.creatures
    .filter((c) => !c.escaped && (!c._medCd || state.tick >= c._medCd) &&
      (c.stress > 0.55 || c.health < 0.7) && pick.creature(c) && !targeted(state, 'treat', c.id))
    .sort((a, b) => (b.stress + (1 - b.health)) - (a.stress + (1 - a.health)))[0];
  return Boolean(sick && goTo(state, st, Math.floor(sick.x), Math.floor(sick.y), { type: 'treat', targetId: sick.id }));
}

function tryWardenTasks(state, st, pick) {
  let best = null, bd = Infinity;
  for (const key of Object.keys(state.fences)) {
    const f = state.fences[key];
    if (f.hp >= FENCES[f.tier].hp) continue;
    if (!pick.fence(key)) continue;
    if (targeted(state, 'repair', key)) continue;
    const [fx, fy] = key.split(',').map(Number);
    const d = Math.hypot(fx - st.x, fy - st.y);
    if (d < bd) { bd = d; best = { key, x: fx, y: fy }; }
  }
  return Boolean(best && goTo(state, st, best.x, best.y, { type: 'repair', key: best.key }));
}

const ROLE_TASKS = { xenobiologist: tryXenoTasks, biomedical: tryMedTasks, warden: tryWardenTasks };

function acquireTask(state, st) {
  const finder = ROLE_TASKS[st.role];
  if (!finder) { wander(state, st, null); return; }
  const enc = resolveAssignment(state, st);
  if (enc && finder(state, st, assignmentFilter(state, enc))) return; // priority: own enclosure
  if (finder(state, st, PASS_ANY)) return;                            // flexible: help anywhere
  wander(state, st, enc);
}

function wander(state, st, enc) {
  const walk = staffWalk(state);
  // assigned keepers idle inside their enclosure so they respond faster there
  if (enc && enc.tiles.length) {
    for (let tries = 0; tries < 6; tries++) {
      const ti = enc.tiles[Math.floor(rnd() * enc.tiles.length)];
      const tx = ti % MAP_SIZE, ty = Math.floor(ti / MAP_SIZE);
      if (!walk(tx, ty)) continue;
      if (goTo(state, st, tx, ty, { type: 'patrol' })) return;
    }
  }
  for (let tries = 0; tries < 6; tries++) {
    const tx = Math.floor(st.x) + Math.floor(rnd() * 13) - 6;
    const ty = Math.floor(st.y) + Math.floor(rnd() * 13) - 6;
    if (!walk(tx, ty)) continue;
    if (goTo(state, st, tx, ty, { type: 'patrol' })) return;
  }
}

// ---------- work application ----------
// per-cycle report card tally (reset each new day by the economy day rollover)
function bumpReport(st, key) {
  if (!st.report) st.report = {};
  st.report[key] = (st.report[key] || 0) + 1;
}

function beginWork(state, st) {
  st.state = 'working';
  st.workTicks = WORK_TICKS[st.task?.type] || 20;
}

function applyWork(state, st) {
  const t = st.task;
  if (!t) { finishTask(st); return; }
  if (t.type === 'feed') {
    const c = state.creatures.find((q) => q.id === t.targetId);
    if (c && !c.escaped) {
      const sp = speciesById(c.speciesId);
      const cost = FEED_COST[sp.diet.station] || 10;
      spend(state, cost, 'feed', `${st.name} hand-fed ${c.name}`);
      c.needs.hunger = 1;
      state.stats.staffFeedings = (state.stats.staffFeedings || 0) + 1;
      bumpReport(st, 'feeds');
      recordEvidence(state, sp.id, 'diet', 0.6);
      logCause(state, st.name, `hand-fed ${c.name}`);
    }
  } else if (t.type === 'clean') {
    if (state.waste) {
      const i = state.waste.findIndex((w) => w.id === t.targetId);
      if (i >= 0) {
        state.waste.splice(i, 1);
        state.stats.staffCleanings = (state.stats.staffCleanings || 0) + 1;
        bumpReport(st, 'cleans');
        logCause(state, st.name, 'cleared biowaste from an exhibit');
      }
    }
  } else if (t.type === 'treat') {
    const c = state.creatures.find((q) => q.id === t.targetId);
    if (c && !c.escaped) {
      c.stress = Math.max(0, c.stress - 0.35);
      c.health = Math.min(1, c.health + 0.15);
      c._medCd = state.tick + MED_COOLDOWN;
      state.stats.staffTreatments = (state.stats.staffTreatments || 0) + 1;
      bumpReport(st, 'treats');
      logCause(state, st.name, `stabilised ${c.name} — stress reduced`);
    }
  } else if (t.type === 'observe') {
    const c = state.creatures.find((q) => q.id === t.targetId);
    if (c) {
      const sp = speciesById(c.speciesId);
      const k = state.knowledge[c.speciesId];
      const undisc = sp.hiddenAttrs.filter((a) => !k.discovered[a]);
      if (undisc.length) {
        const attr = undisc[Math.floor(rnd() * undisc.length)];
        recordEvidence(state, sp.id, attr, 0.5);
        bumpReport(st, 'observes');
        logCause(state, st.name, `documented ${c.name}'s behaviour`);
      }
    }
  }
  finishTask(st);
}

// repair happens over time while working (not on completion)
function repairTick(state, st) {
  const f = state.fences[st.task.key];
  if (!f) { finishTask(st); return; }
  const max = FENCES[f.tier].hp;
  f.hp = Math.min(max, f.hp + 2.5);
  if (f.hp >= max) {
    state.stats.staffRepairs = (state.stats.staffRepairs || 0) + 1;
    bumpReport(st, 'repairs');
    logCause(state, st.name, 'restored a barrier segment to full integrity');
    finishTask(st);
  }
}

// ---------- per-tick update ----------
function moveStaff(state, st) {
  if (!st.path || !st.path.length) {
    // arrived: re-target drifting creatures once or twice, then work in place
    const t = st.task;
    if (t && (t.type === 'feed' || t.type === 'treat' || t.type === 'observe')) {
      const c = state.creatures.find((q) => q.id === t.targetId);
      if (!c || c.escaped) { finishTask(st); return; }
      const d = Math.hypot(c.x - st.x, c.y - st.y);
      if (d > 2.2 && (st._retries || 0) < 3) {
        st._retries = (st._retries || 0) + 1;
        if (routeTo(state, st, Math.floor(c.x), Math.floor(c.y))) return;
      }
    }
    if (t && t.type === 'patrol') { beginWork(state, st); return; }
    beginWork(state, st);
    return;
  }
  const wp = st.path[0];
  const dx = wp.x + 0.5 - st.x, dy = wp.y + 0.5 - st.y;
  const d = Math.hypot(dx, dy);
  if (d < STAFF_SPEED) {
    st.x = wp.x + 0.5; st.y = wp.y + 0.5;
    st.path.shift();
  } else {
    st.x += (dx / d) * STAFF_SPEED;
    st.y += (dy / d) * STAFF_SPEED;
    st.dir = dx - dy >= 0 ? 1 : -1;
  }
}

export function staffTick(state) {
  if (!state.staff || !state.staff.length) return;
  const T = state.tick;
  for (const st of state.staff) {
    if (st.state === 'moving') {
      moveStaff(state, st);
    } else if (st.state === 'working') {
      if (st.task && st.task.type === 'repair') { repairTick(state, st); continue; }
      st.workTicks--;
      if (st.workTicks <= 0) applyWork(state, st);
    } else if (T % 30 === st.id % 30) {
      acquireTask(state, st);
    }
  }
}
