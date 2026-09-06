// ---- World seed codes (UI <-> sim boundary) ----
// The sim only ever sees an integer seed (state.seed, < RNG_MOD). Players may type anything:
//   ''            -> null   (createNewGame derives a fresh clock-based seed)
//   '123456789'   -> 123456789 % RNG_MOD  (numeric codes replay exactly, and are what we copy)
//   'mossy vale'  -> FNV-1a hash of the trimmed text (word seeds are shareable too)
// The original text is kept as state.seedLabel so the HUD can show what the player typed.
export const SEED_MOD = 2147483648;
export const SEED_MAX_LEN = 40;

export function fnv1a(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

export function parseSeed(text) {
  const t = (text || '').trim().slice(0, SEED_MAX_LEN);
  if (!t) return { seed: null, label: null };
  if (/^\d+$/.test(t)) return { seed: Number(t.slice(-15)) % SEED_MOD, label: t };
  return { seed: fnv1a(t.toLowerCase()) % SEED_MOD, label: t };
}

// what the HUD shows / copies for a running park
export function seedCode(state) {
  if (!state) return '';
  if (state.seedLabel) return String(state.seedLabel);
  return Number.isFinite(state.seed) ? String(state.seed) : '';
}

// clipboard write with a graceful fallback (returns true when the text was copied)
export async function copyText(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) { /* fall through */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand && document.execCommand('copy');
    document.body.removeChild(ta);
    return !!ok;
  } catch (e) {
    return false;
  }
}
