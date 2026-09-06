// ---- Feature flags for the Ops Deck redesign (Step 1) ----
// The ONLY flag mechanism: each flag is read once at module load from localStorage so a
// whole session renders consistently; toggle the key and reload to switch.
//
//   localStorage.setItem('aetherion.artV2', 'off')    // ART_V2 post-passes (default 'on')
//   localStorage.setItem('aetherion.opsDeck', 'off')  // Ops Deck dock + drawer shell (default 'on')
//   ?legacyHud=1 in the URL forces OPS_DECK off for that load.
//
// Both flags are removal candidates after one release.

function readFlag(key, fallback = 'on') {
  try {
    if (typeof localStorage === 'undefined') return fallback === 'on';
    const v = localStorage.getItem(key);
    return (v === null ? fallback : v) !== 'off';
  } catch (e) {
    return fallback === 'on'; // storage unavailable (private mode / tests)
  }
}

function legacyHudRequested() {
  try {
    return typeof window !== 'undefined' && /[?&]legacyHud=1(&|$)/.test(window.location.search || '');
  } catch (e) {
    return false;
  }
}

export const ART_V2 = readFlag('aetherion.artV2');
export const OPS_DECK = !legacyHudRequested() && readFlag('aetherion.opsDeck');
