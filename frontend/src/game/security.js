// ---- Security: escape emergencies, rapid response units, capture loop ----
import { MAP_SIZE } from './constants';
import { pushAlert, logCause } from './state';
import { enclosureAt, computeEnclosures } from './enclosures';
import { spend } from './economy';

const UNIT_SPEED = 0.085; // faster than creatures (0.045)
const CAPTURE_TICKS = 40;
const DISPATCH_COST = 250;
const RETRY_COOLDOWN = 600; // ticks before re-attempting a failed recovery

export function getEscapes(state) {
  return state.creatures.filter((c) => c.escaped);
}

// Periodic: assign available response units (one active per post) to escaped creatures.
export function securityTick(state) {
  if (!state.security) state.security = { units: [] };
  const sec = state.security;
  const posts = state.buildings.filter((b) => b.type === 'security_post');

  // drop units whose post was demolished
  sec.units = sec.units.filter((u) => state.buildings.some((b) => b.id === u.postId));

  if (!posts.length) return;
  for (const c of getEscapes(state)) {
    if (c._recoveryCooldown && state.tick < c._recoveryCooldown) continue;
    if (sec.units.some((u) => u.targetId === c.id)) continue;
    const busy = new Set(sec.units.map((u) => u.postId));
    // nearest free post to the escapee
    const free = posts.filter((p) => !busy.has(p.id));
    if (!free.length) break;
    const post = free.sort((a, b) =>
      Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y))[0];
    const pay = spend(state, DISPATCH_COST, 'response', 'Rapid response dispatch');
    if (!pay.ok) break;
    sec.units.push({
      id: state.nextId++, postId: post.id, targetId: c.id,
      x: post.x + post.w / 2, y: post.y + post.h / 2,
      state: 'toTarget', captureTicks: 0,
    });
    pushAlert(state, {
      type: 'info', title: 'RESPONSE TEAM DISPATCHED',
      msg: `A rapid response unit is en route to recover ${c.name}.`,
      target: { kind: 'creature', id: c.id },
    });
  }
}

// Every tick: move units, run capture timers, escort creatures home.
export function tickSecurityUnits(state) {
  const sec = state.security;
  if (!sec || !sec.units.length) return;
  for (const u of sec.units) {
    const c = state.creatures.find((q) => q.id === u.targetId);
    if (u.state === 'toTarget') {
      if (!c || !c.escaped) { u.state = 'returning'; continue; }
      const dx = c.x - u.x, dy = c.y - u.y;
      const d = Math.hypot(dx, dy);
      if (d < 0.8) {
        u.state = 'capturing'; u.captureTicks = CAPTURE_TICKS;
        c.path = []; c.state = 'captured'; c.actionTicks = CAPTURE_TICKS + 5;
      } else {
        u.x += (dx / d) * UNIT_SPEED; u.y += (dy / d) * UNIT_SPEED;
      }
    } else if (u.state === 'capturing') {
      if (!c) { u.state = 'returning'; continue; }
      c.path = []; c.state = 'captured'; c.actionTicks = 10;
      u.x = c.x; u.y = c.y;
      u.captureTicks--;
      if (u.captureTicks <= 0) {
        resolveCapture(state, c);
        u.state = 'returning';
      }
    } else if (u.state === 'returning') {
      const post = state.buildings.find((b) => b.id === u.postId);
      if (!post) { u.state = 'done'; continue; }
      const px = post.x + post.w / 2, py = post.y + post.h / 2;
      const dx = px - u.x, dy = py - u.y;
      const d = Math.hypot(dx, dy);
      if (d < 0.4) u.state = 'done';
      else { u.x += (dx / d) * UNIT_SPEED; u.y += (dy / d) * UNIT_SPEED; }
    }
  }
  sec.units = sec.units.filter((u) => u.state !== 'done');
}

function resolveCapture(state, c) {
  // escort to home enclosure, or relocate to the largest intact enclosure
  let tx = c.homeTile.x, ty = c.homeTile.y;
  let enc = enclosureAt(state, tx, ty);
  if (!enc) {
    const { enclosures } = computeEnclosures(state);
    if (enclosures.length) {
      const e0 = [...enclosures].sort((a, b) => b.area - a.area)[0];
      const ti = e0.tiles[Math.floor(e0.tiles.length / 2)];
      tx = ti % MAP_SIZE; ty = Math.floor(ti / MAP_SIZE);
      enc = e0;
      c.homeTile = { x: tx, y: ty };
    }
  }
  c.x = tx + 0.5; c.y = ty + 0.5;
  c.path = []; c.state = 'idle'; c.actionTicks = 20;
  c.escaped = !enc;
  c.stress = Math.min(1, c.stress + 0.08);
  if (enc) {
    c.enclosureId = enc.id;
    state.stats.captures = (state.stats.captures || 0) + 1;
    pushAlert(state, {
      type: 'success', title: 'ASSET RECOVERED',
      msg: `${c.name} was recaptured and returned to containment by the response team.`,
      target: { kind: 'creature', id: c.id },
    });
    logCause(state, 'Security', `${c.name} recaptured by rapid response`);
  } else {
    c._recoveryCooldown = state.tick + RETRY_COOLDOWN;
    pushAlert(state, {
      type: 'danger', title: 'NO CONTAINMENT AVAILABLE',
      msg: `The response team has nowhere to put ${c.name} — repair or build an enclosure.`,
      target: { kind: 'creature', id: c.id },
    });
  }
}
