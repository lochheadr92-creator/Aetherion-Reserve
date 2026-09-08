// ---- Security: escape emergencies, rapid response units, capture loop, incident response ----
import { MAP_SIZE } from './constants';
import { pushAlert, logCause } from './state';
import { enclosureAt, computeEnclosures } from './enclosures';
import { spend } from './economy';
import { gapsFor } from './construction';
import { fleeWithin, CONFLICT } from './tension';
import { RESPONSE_RADIUS } from './tensionProfile';

const UNIT_SPEED = 0.085; // faster than creatures (0.045)
const CAPTURE_TICKS = 40;
const SEPARATE_TICKS = 25;
const DISPATCH_COST = 250;
const INCIDENT_COST = 150;
const RETRY_COOLDOWN = 600; // ticks before re-attempting a failed recovery

export function getEscapes(state) {
  return state.creatures.filter((c) => c.escaped);
}

const postCentre = (p) => ({ x: p.x + p.w / 2, y: p.y + p.h / 2 });

// A pen counts as secure when it is a closed region with no breach gaps on record.
function secureHome(state, c) {
  const enc = enclosureAt(state, c.homeTile.x, c.homeTile.y);
  if (!enc) return null;
  return gapsFor(state, enc.id).length ? null : enc;
}

// Held organisms go back to their pen once it is closed again.
function releaseHeld(state) {
  for (const c of state.creatures) {
    if (!c.held) continue;
    const enc = secureHome(state, c);
    if (!enc) continue;
    c.x = c.homeTile.x + 0.5; c.y = c.homeTile.y + 0.5;
    c.held = null; c.path = []; c.state = 'idle'; c.actionTicks = 20;
    c.enclosureId = enc.id; c.escaped = false;
    pushAlert(state, {
      type: 'success', title: 'RELEASED FROM HOLDING',
      msg: `${c.name} has been returned to Pen #${enc.id} now that the barrier is closed.`,
      target: { kind: 'creature', id: c.id },
    });
    logCause(state, 'Security', `${c.name} released from holding into Pen #${enc.id}`);
  }
}

// Periodic: assign available response units (one active per post) to escapes and incidents.
export function securityTick(state) {
  if (!state.security) state.security = { units: [] };
  const sec = state.security;
  const posts = state.buildings.filter((b) => b.type === 'security_post');

  // drop units whose post was demolished
  sec.units = sec.units.filter((u) => state.buildings.some((b) => b.id === u.postId));
  releaseHeld(state);

  if (!posts.length) return;
  const busy = () => new Set(sec.units.map((u) => u.postId));

  for (const c of getEscapes(state)) {
    if (c._recoveryCooldown && state.tick < c._recoveryCooldown) continue;
    if (sec.units.some((u) => u.targetId === c.id)) continue;
    const b = busy();
    // nearest free post to the escapee
    const free = posts.filter((p) => !b.has(p.id));
    if (!free.length) break;
    const post = free.sort((p, q) => Math.hypot(p.x - c.x, p.y - c.y) - Math.hypot(q.x - c.x, q.y - c.y))[0];
    const pay = spend(state, DISPATCH_COST, 'response', 'Rapid response dispatch');
    if (!pay.ok) break;
    sec.units.push({ id: state.nextId++, postId: post.id, targetId: c.id, ...postCentre(post), state: 'toTarget', captureTicks: 0 });
    pushAlert(state, {
      type: 'info', title: 'RESPONSE TEAM DISPATCHED',
      msg: `A rapid response unit is en route to recover ${c.name}.`,
      target: { kind: 'creature', id: c.id },
    });
  }

  // serious in-pen aggression: a post within range sends a team to break it up
  for (const inc of state.tension?.incidents || []) {
    if (inc.unitId != null) continue;
    const b = busy();
    const free = posts.filter((p) => !b.has(p.id) && Math.hypot(p.x + p.w / 2 - inc.x, p.y + p.h / 2 - inc.y) <= RESPONSE_RADIUS.incident);
    if (!free.length) continue;
    const post = free.sort((p, q) => Math.hypot(p.x - inc.x, p.y - inc.y) - Math.hypot(q.x - inc.x, q.y - inc.y))[0];
    const pay = spend(state, INCIDENT_COST, 'response', 'Rapid response intervention');
    if (!pay.ok) break;
    const unit = { id: state.nextId++, postId: post.id, targetId: inc.victimId, incidentId: inc.id, ...postCentre(post), state: 'toIncident', captureTicks: 0 };
    inc.unitId = unit.id;
    sec.units.push(unit);
    const victim = state.creatures.find((q) => q.id === inc.victimId);
    pushAlert(state, {
      type: 'info', title: 'RESPONSE TEAM DISPATCHED',
      msg: `A rapid response unit is moving to separate the animals in Pen #${inc.encId}.`,
      target: victim ? { kind: 'creature', id: victim.id } : { kind: 'enclosure', id: inc.encId },
    });
  }
}

function moveToward(u, tx, ty) {
  const dx = tx - u.x, dy = ty - u.y;
  const d = Math.hypot(dx, dy);
  if (d > UNIT_SPEED) { u.x += (dx / d) * UNIT_SPEED; u.y += (dy / d) * UNIT_SPEED; }
  return d;
}

function resolveIncident(state, u) {
  const inc = (state.tension?.incidents || []).find((i) => i.id === u.incidentId);
  const a = inc ? state.creatures.find((q) => q.id === inc.aggressorId) : null;
  const b = inc ? state.creatures.find((q) => q.id === inc.victimId) : null;
  if (a) { a.stress = Math.max(0, a.stress - 0.15); a._aggrCd = state.tick + CONFLICT.aggressorCooldown * 1.5; }
  if (b) b.stress = Math.max(0, b.stress - 0.15);
  if (inc) {
    const { enclosures } = computeEnclosures(state);
    const enc = enclosures.find((e) => e.id === inc.encId);
    if (a && b && enc) fleeWithin(state, b, a, enc);
    state.tension.encCooldown[inc.encId] = Math.max(state.tension.encCooldown[inc.encId] || 0, state.tick + CONFLICT.encCooldown * 2);
    state.stats.interventions = (state.stats.interventions || 0) + 1;
    pushAlert(state, {
      type: 'success', title: 'ANIMALS SEPARATED',
      msg: `The response team broke up the fight in Pen #${inc.encId}${a && b ? ` — ${a.name} and ${b.name} are apart for now` : ''}. Fix the cause: the pen mix, crowding or stress.`,
      target: b ? { kind: 'creature', id: b.id } : { kind: 'enclosure', id: inc.encId },
    });
    logCause(state, 'Security', `response team separated the animals in Pen #${inc.encId}`);
  }
  if (state.tension) state.tension.incidents = state.tension.incidents.filter((i) => i.id !== u.incidentId);
}

// Every tick: move units, run capture / separation timers, escort creatures home.
export function tickSecurityUnits(state) {
  const sec = state.security;
  if (!sec || !sec.units.length) return;
  for (const u of sec.units) {
    const c = state.creatures.find((q) => q.id === u.targetId);
    if (u.state === 'toTarget') {
      if (!c || !c.escaped) { u.state = 'returning'; continue; }
      const d = moveToward(u, c.x, c.y);
      if (d < 0.8) {
        u.state = 'capturing'; u.captureTicks = CAPTURE_TICKS;
        c.path = []; c.state = 'captured'; c.actionTicks = CAPTURE_TICKS + 5;
      }
    } else if (u.state === 'capturing') {
      if (!c) { u.state = 'returning'; continue; }
      c.path = []; c.state = 'captured'; c.actionTicks = 10;
      u.x = c.x; u.y = c.y;
      u.captureTicks--;
      if (u.captureTicks <= 0) {
        resolveCapture(state, c, u);
        u.state = 'returning';
      }
    } else if (u.state === 'toIncident') {
      const inc = (state.tension?.incidents || []).find((i) => i.id === u.incidentId);
      if (!inc || !c) { u.state = 'returning'; continue; }
      const d = moveToward(u, c.x, c.y);
      if (d < 1.2) { u.state = 'separating'; u.captureTicks = SEPARATE_TICKS; }
    } else if (u.state === 'separating') {
      u.captureTicks--;
      if (u.captureTicks <= 0) { resolveIncident(state, u); u.state = 'returning'; }
    } else if (u.state === 'returning') {
      const post = state.buildings.find((b) => b.id === u.postId);
      if (!post) { u.state = 'done'; continue; }
      const { x: px, y: py } = postCentre(post);
      const d = moveToward(u, px, py);
      if (d < 0.4) u.state = 'done';
    }
  }
  sec.units = sec.units.filter((u) => u.state !== 'done');
}

function resolveCapture(state, c, u) {
  const health = `${Math.round(c.health * 100)}% condition${c.health < 0.6 ? ' — needs treatment' : ''}`;
  c.path = []; c.actionTicks = 20;
  c.stress = Math.min(1, c.stress + 0.08);
  const enc = secureHome(state, c);
  if (enc) {
    c.x = c.homeTile.x + 0.5; c.y = c.homeTile.y + 0.5;
    c.state = 'idle'; c.escaped = false; c.enclosureId = enc.id;
    state.stats.captures = (state.stats.captures || 0) + 1;
    pushAlert(state, {
      type: 'success', title: 'ASSET RECOVERED',
      msg: `${c.name} was recaptured and returned to Pen #${enc.id}. Health check: ${health}.`,
      target: { kind: 'creature', id: c.id },
    });
    logCause(state, 'Security', `${c.name} recaptured by rapid response`);
    return;
  }
  // home pen is open (breach gap) or gone: hold the animal at the post until it is secure again
  const post = state.buildings.find((b) => b.id === u.postId);
  if (post) {
    const { x, y } = postCentre(post);
    c.x = x; c.y = y;
    c.state = 'held'; c.held = post.id; c.escaped = false; c.enclosureId = null;
    state.stats.captures = (state.stats.captures || 0) + 1;
    state.stats.holdings = (state.stats.holdings || 0) + 1;
    pushAlert(state, {
      type: 'warning', title: 'IN HOLDING',
      msg: `${c.name} was recaptured but its pen is breached — the animal is being held at the Rapid Response Post. Health check: ${health}. Rebuild the barrier to release it.`,
      target: { kind: 'creature', id: c.id },
    });
    logCause(state, 'Security', `${c.name} placed in holding — home pen breached`);
    return;
  }
  c.state = 'idle';
  c._recoveryCooldown = state.tick + RETRY_COOLDOWN;
  pushAlert(state, {
    type: 'danger', title: 'NO CONTAINMENT AVAILABLE',
    msg: `The response team has nowhere to put ${c.name} — repair or build an enclosure.`,
    target: { kind: 'creature', id: c.id },
  });
}

// largest closed, gap-free enclosure (relocation helper)
export function largestSecureEnclosure(state) {
  const { enclosures } = computeEnclosures(state);
  const ok = enclosures.filter((e) => !gapsFor(state, e.id).length);
  if (!ok.length) return null;
  const e0 = [...ok].sort((a, b) => b.area - a.area)[0];
  const ti = e0.tiles[Math.floor(e0.tiles.length / 2)];
  return { enc: e0, x: ti % MAP_SIZE, y: Math.floor(ti / MAP_SIZE) };
}
