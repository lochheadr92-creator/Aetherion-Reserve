import { useEffect } from 'react';
import { X } from 'lucide-react';

export const DRAWER_TITLES = {
  fieldops: 'Field Ops',
  staff: 'Staff',
  db: 'Species Database',
  research: 'Research',
  finances: 'Finances',
};

// 320px drawer docked right of the OpsDock, full height under the HudBar. The body is the
// `ops-drawer-host`: the legacy management screens are full-screen modals (absolute inset-0
// backdrop + fixed-width centred panel); the host's CSS neutralises ONLY that chrome so the
// screens mount unchanged. Esc closes. Only one drawer exists at a time (see useDrawer).
export const Drawer = ({ id, onClose, children }) => {
  useEffect(() => {
    if (!id) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [id, onClose]);

  if (!id) return null;
  const title = DRAWER_TITLES[id] || id;
  return (
    <aside
      data-testid="ops-drawer"
      data-drawer={id}
      role="dialog"
      aria-label={title}
      className="ops-drawer absolute left-14 top-14 bottom-0 w-[320px] z-30 flex flex-col border-r border-[var(--line)]"
    >
      <header className="nl-panel-header flex items-center justify-between px-3 h-10 shrink-0">
        <span data-testid="drawer-title" className="mono text-[10px] tracking-[0.2em] text-[var(--text-3)]">{title.toUpperCase()}</span>
        <button
          type="button"
          data-testid="drawer-close"
          onClick={onClose}
          title="Close (Esc)"
          aria-label="Close drawer"
          className="nl-tool w-7 h-7 flex items-center justify-center !rounded-[6px]"
        >
          <X size={13} />
        </button>
      </header>
      <div data-testid="drawer-body" className="ops-drawer-host flex-1 min-h-0 overflow-auto nl-scroll">
        {children}
      </div>
    </aside>
  );
};

export default Drawer;
