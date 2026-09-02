// ---- Bloodline registry & family-tree queries ----
// Every organism that has ever lived in the park keeps a permanent ledger entry
// (`state.lineage`, keyed by creature id) so family trees survive transfers and
// let players plan pairings. Purely additive state: `ensureLineage` backfills
// older saves from the creatures present and the parent names stored in genes.

const UNKNOWN = 'unknown';

function stub(state, id, name, speciesId) {
  if (id == null || id < 0 || state.lineage[id]) return;
  state.lineage[id] = {
    id, name: name || 'Unknown', speciesId, gen: null, mId: null, fId: null,
    morph: null, inbreed: 0, bornDay: null, status: UNKNOWN, leftDay: null,
  };
}

// Upsert a living creature (call on acquisition, birth and after renames).
export function registerLineage(state, c) {
  if (!state.lineage) state.lineage = {};
  const g = c.genes || {};
  const prev = state.lineage[c.id];
  state.lineage[c.id] = {
    id: c.id, name: c.name, speciesId: c.speciesId,
    gen: g.gen || 0,
    mId: g.parents?.mId ?? null,
    fId: g.parents?.fId != null && g.parents.fId >= 0 ? g.parents.fId : null,
    morph: g.morph || null, inbreed: g.inbreed || 0,
    bornDay: prev?.bornDay ?? state.day, status: 'park', leftDay: null,
  };
  if (g.parents) {
    stub(state, g.parents.mId, g.parents.mName, c.speciesId);
    stub(state, g.parents.fId, g.parents.fName, c.speciesId);
  }
  return state.lineage[c.id];
}

// A creature left the park (transfer/removal) — keep its history.
export function markLineageLeft(state, id, status = 'transferred') {
  const e = state.lineage?.[id];
  if (!e) return;
  e.status = status;
  e.leftDay = state.day;
}

// Backfill + reconcile: living creatures are registered, stale 'park' entries
// whose organism is gone are marked transferred.
export function ensureLineage(state) {
  if (!state || !state.creatures) return;
  if (!state.lineage) state.lineage = {};
  for (const c of state.creatures) registerLineage(state, c);
  const alive = new Set(state.creatures.map((c) => c.id));
  for (const e of Object.values(state.lineage)) {
    if (e.status === 'park' && !alive.has(e.id)) { e.status = 'transferred'; e.leftDay = e.leftDay ?? state.day; }
  }
}

export const lineageEntry = (state, id) => (state.lineage && id != null ? state.lineage[id] || null : null);

// ---------- relatedness ----------
// Mirrors inheritGenes: an individual's "blood" is itself plus its tracked
// ancestors; shared members between two lines drive the inbreeding coefficient.
const bloodOf = (c) => new Set([c.id, ...((c.genes && c.genes.ancestors) || [])].filter((v) => v != null && v >= 0));

export function sharedBlood(a, b) {
  const A = bloodOf(a), B = bloodOf(b);
  let n = 0;
  for (const id of A) if (B.has(id)) n++;
  return n;
}

export const projectedInbreeding = (a, b) => Math.round(Math.min(1, sharedBlood(a, b) / 3) * 100) / 100;

const parentsOf = (e) => [e?.mId, e?.fId].filter((v) => v != null && v >= 0);

export function relationLabel(state, a, b) {
  const ea = lineageEntry(state, a.id) || { mId: a.genes?.parents?.mId, fId: a.genes?.parents?.fId };
  const eb = lineageEntry(state, b.id) || { mId: b.genes?.parents?.mId, fId: b.genes?.parents?.fId };
  const pa = parentsOf(ea), pb = parentsOf(eb);
  if (pa.includes(b.id) || pb.includes(a.id)) return 'Parent / offspring';
  if (pa.length === 2 && pb.length === 2 && pa.every((p) => pb.includes(p))) return 'Sibling';
  if (pa.some((p) => pb.includes(p))) return 'Half-sibling';
  const shared = sharedBlood(a, b);
  if (shared > 0) return 'Shared blood';
  return 'Unrelated';
}

// ---------- tree ----------
export function familyTree(state, id) {
  const L = state.lineage || {};
  const me = L[id];
  if (!me) return null;
  const node = (nid) => (nid != null && nid >= 0 ? L[nid] || null : null);
  const mother = node(me.mId), father = node(me.fId);
  const grand = [
    mother ? [node(mother.mId), node(mother.fId)] : [null, null],
    father ? [node(father.mId), node(father.fId)] : [null, null],
  ];
  const all = Object.values(L);
  const myParents = parentsOf(me);
  const siblings = [], halfSiblings = [];
  if (myParents.length) {
    for (const e of all) {
      if (e.id === me.id) continue;
      const ps = parentsOf(e);
      if (!ps.length) continue;
      const shared = ps.filter((p) => myParents.includes(p)).length;
      if (shared >= 2 && myParents.length === 2 && ps.length === 2) siblings.push(e);
      else if (shared >= 1) halfSiblings.push(e);
    }
  }
  const offspring = all
    .filter((e) => e.mId === me.id || e.fId === me.id)
    .sort((x, y) => (x.bornDay ?? 0) - (y.bornDay ?? 0) || x.id - y.id)
    .map((e) => ({ ...e, mateId: e.mId === me.id ? e.fId : e.mId }));
  const mates = [...new Set(offspring.map((o) => o.mateId).filter((v) => v != null && v >= 0))].map((mid) => L[mid]).filter(Boolean);
  const descendants = countDescendants(L, me.id);
  return { me, mother, father, grand, siblings, halfSiblings, offspring, mates, descendants };
}

function countDescendants(L, rootId) {
  const seen = new Set();
  const stack = [rootId];
  const all = Object.values(L);
  while (stack.length) {
    const pid = stack.pop();
    for (const e of all) {
      if ((e.mId === pid || e.fId === pid) && !seen.has(e.id)) { seen.add(e.id); stack.push(e.id); }
    }
  }
  let living = 0;
  for (const id of seen) if (L[id].status === 'park') living++;
  return { total: seen.size, living };
}

// ---------- pairing outlook ----------
// Same-species organisms currently in the park, ranked for the subject: safe
// (unrelated) mates first, then by proximity/readiness. Juveniles are listed
// but flagged — they cannot pair until they mature.
export function pairingOutlook(state, c) {
  const others = state.creatures.filter((o) => o.id !== c.id && o.speciesId === c.speciesId && !o.escaped);
  const rows = others.map((o) => {
    const inbreed = projectedInbreeding(c, o);
    return {
      id: o.id, name: o.name, gen: o.genes?.gen || 0, juvenile: !!o.juvenile,
      relation: relationLabel(state, c, o), inbreed, safe: inbreed < 0.25,
      sameEnclosure: c.enclosureId != null && o.enclosureId === c.enclosureId,
      ready: !o.juvenile && !o.gestation && (o.breedCd || 0) <= 0,
      morph: o.genes?.morph || null, carrier: o.genes?.carrier || null,
    };
  });
  rows.sort((a, b) => (b.safe - a.safe) || (b.sameEnclosure - a.sameEnclosure) || (a.juvenile - b.juvenile) || a.id - b.id);
  return rows;
}
