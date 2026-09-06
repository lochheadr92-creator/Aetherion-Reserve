import { useState, useCallback } from 'react';

// Ops Deck drawer state: at most one drawer open at a time.
// `openDrawer(id)` on the already-open id toggles it closed (dock-button semantics);
// pass `{ toggle: false }` to guarantee the drawer ends up open (used when the legacy
// modal writers — inspect panel, alert navigation — route into the deck).
export const DRAWER_IDS = ['fieldops', 'staff', 'db', 'research', 'finances'];

export function useDrawer() {
  const [drawer, setDrawer] = useState(null);
  const openDrawer = useCallback((id, { toggle = true } = {}) => {
    if (!id || !DRAWER_IDS.includes(id)) return;
    setDrawer((cur) => (toggle && cur === id ? null : id));
  }, []);
  const closeDrawer = useCallback(() => setDrawer(null), []);
  return { drawer, openDrawer, closeDrawer };
}

export default useDrawer;
