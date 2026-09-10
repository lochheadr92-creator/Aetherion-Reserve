import { useEffect, useMemo } from 'react';
import { ScreenHostContext } from '@/components/game/ScreenFrame';

export const DRAWER_TITLES = {
  fieldops: 'Field Ops',
  staff: 'Staff',
  db: 'Species Database',
  research: 'Research',
  finances: 'Finances',
  ledger: 'Bloodline Ledger',
  album: 'Photo Album',
};

// 320px drawer docked right of the OpsDock, full height under the HudBar. The Drawer is only the
// shell (geometry, Esc, host context): the hosted screen renders its own header/body through
// ScreenFrame, which reads { host: 'drawer', title } from ScreenHostContext. Only one drawer
// exists at a time (see useDrawer).
export const Drawer = ({ id, onClose, children }) => {
  useEffect(() => {
    if (!id) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [id, onClose]);

  const title = id ? (DRAWER_TITLES[id] || id) : null;
  const hostCtx = useMemo(() => ({ host: 'drawer', title }), [title]);

  if (!id) return null;
  return (
    <aside
      data-testid="ops-drawer"
      data-drawer={id}
      role="dialog"
      aria-label={title}
      className="ops-drawer absolute left-14 top-14 bottom-0 w-[320px] z-30 flex flex-col border-r border-[var(--line)]"
    >
      <ScreenHostContext.Provider value={hostCtx}>
        <div data-testid="drawer-body" className="flex-1 min-h-0 flex flex-col">
          {children}
        </div>
      </ScreenHostContext.Provider>
    </aside>
  );
};

export default Drawer;
