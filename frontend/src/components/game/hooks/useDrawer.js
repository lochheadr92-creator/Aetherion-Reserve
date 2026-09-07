import { useState, useCallback } from 'react';

// Ops Deck drawer state: at most one drawer open at a time.
// `openDrawer(id)` on the already-open id toggles it closed (dock-button semantics);
// pass `{ toggle: false }` to guarantee the drawer ends up open (used when the legacy
// modal writers — inspect panel, alert navigation — route into the deck).
// `params` carries contextual payloads (e.g. the Bloodline Ledger's creatureId).
export const DRAWER_IDS = ['fieldops', 'staff', 'db', 'research', 'finances', 'ledger'];

export function useDrawer() {
  const [drawer, setDrawer] = useState(null); // { id, params } | null
  const openDrawer = useCallback((id, { toggle = true, params = null } = {}) => {
    if (!id || !DRAWER_IDS.includes(id)) return;
    setDrawer((cur) => (toggle && cur?.id === id ? null : { id, params }));
  }, []);
  const closeDrawer = useCallback(() => setDrawer(null), []);
  return { drawer: drawer?.id ?? null, drawerParams: drawer?.params ?? null, openDrawer, closeDrawer };
}

export default useDrawer;
