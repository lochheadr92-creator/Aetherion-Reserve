// ---- Shared semantic tone helpers for HUD panels and drawers ----
// Small, named lookups that replace nested colour/label ternaries scattered through the UI. All of
// them return CSS colour strings (design tokens) or plain labels; none touch sim state.

/** Good-when-high meter (welfare, comfort, needs): success above `hi`, warning above `mid`, else danger. */
export function levelTone(v, hi = 0.65, mid = 0.4) {
  if (v > hi) return 'var(--success)';
  if (v > mid) return 'var(--warning)';
  return 'var(--danger)';
}

/** Bad-when-high meter (stress, breach pressure): danger above `hi`, warning above `mid`, else calm. */
export function hazardTone(v, hi = 0.6, mid = 0.35, calm = 'var(--accent-violet)') {
  if (v > hi) return 'var(--danger)';
  if (v > mid) return 'var(--warning)';
  return calm;
}

/** Attraction rating multiplier around 1.0: strong (>= 1.3) success, weak (<= 0.75) danger, else neutral. */
export function scoreTone(score) {
  if (score >= 1.3) return 'var(--success)';
  if (score <= 0.75) return 'var(--danger)';
  return 'var(--text-1)';
}

/** Species danger 1-5 chip colour: 4+ danger, 3 warning, otherwise inherit. */
export function dangerTone(danger) {
  if (danger >= 4) return 'var(--danger)';
  if (danger >= 3) return 'var(--warning)';
  return undefined;
}

/** Field Operations tier as a roman numeral (tier 1 species are always available). */
const TIER_NUMERAL = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V' };
export function tierNumeral(tier) {
  return TIER_NUMERAL[tier] || 'IV';
}

/** Research card border: done (green), active (cyan), otherwise the resting line. */
export function researchBorder(state) {
  if (state.done) return 'rgba(62,226,138,0.35)';
  if (state.isActive) return 'rgba(45,226,230,0.45)';
  return 'var(--line)';
}

/** Expedition log line colour by entry type. */
const LOG_TONES = { find: 'var(--success)', evidence: 'var(--accent-seaglass)', mishap: 'var(--warning)' };
export function logTone(type) {
  return LOG_TONES[type] || 'var(--text-3)';
}

/** Enclosure cohabitation status class. */
const RELATION_CLASS = { hostile: 'text-[var(--danger)]', compatible: 'text-[var(--success)]' };
export function relationClass(status) {
  return RELATION_CLASS[status] || 'text-[#ff8aa0] mono';
}

/** Bloodline registry chip classes by where the relative is now. */
const REGISTRY_CHIP = {
  park: 'border-[var(--line-2)] text-[var(--text-2)] hover:border-[var(--accent-cyan)]',
  deceased: 'border-[rgba(255,77,109,0.4)] text-[var(--text-3)] line-through decoration-[var(--danger)]',
};
export function registryChipClass(status) {
  return REGISTRY_CHIP[status] || 'border-[var(--line)] text-[var(--text-3)]';
}

/** Trait bar tone in the pairing planner: depression (red) beats a strong good trait (seaglass) beats neutral cyan. */
export function traitTone(g, goodWhenHigh) {
  if (g.depression) return 'var(--danger)';
  if (goodWhenHigh && g.mean >= 0.65) return 'var(--accent-seaglass)';
  return 'var(--accent-cyan)';
}

/** Album caption editor hint by save status. */
const CAPTION_HINT = { saving: 'Saving…', failed: 'Could not save — try again' };
export function captionHint(status) {
  return CAPTION_HINT[status] || 'Enter to save · Esc to cancel';
}
