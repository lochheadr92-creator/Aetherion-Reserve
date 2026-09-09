import { createContext, useContext } from 'react';
import { X } from 'lucide-react';

// Which surface a management screen is mounted in. The Ops Deck Drawer provides
// { host: 'drawer', title }. The legacy full-screen modal host was retired: every management
// screen is a native drawer panel, so the context defaults to the drawer as well.
export const ScreenHostContext = createContext({ host: 'drawer', title: null });
export const useScreenHost = () => useContext(ScreenHostContext).host;

/**
 * Chrome for a management screen inside the 320px Ops Deck drawer: ONE compact header (drawer title +
 * the screen's own close button), an optional subtitle/actions strip, an optional toolbar, then the
 * body. The root keeps the screen's historical `*-modal` testid (one stable selector for the tests) and
 * exposes `data-host="drawer"` so screens can declare narrow layouts with the Tailwind `drawer:` variant.
 */
export const ScreenFrame = ({
  testId,
  closeTestId,
  onClose,
  eyebrow,
  subtitle,
  actions,
  toolbar,
  bodyClassName = '',
  scroll = true,
  children,
}) => {
  const { title } = useContext(ScreenHostContext);
  const bodyClass = `flex-1 min-h-0 ${scroll ? 'overflow-y-auto nl-scroll' : 'flex'} ${bodyClassName}`;

  return (
    <div data-testid={testId} data-host="drawer" className="flex flex-col h-full min-h-0 text-[var(--text-1)]">
      <header className="nl-panel-header flex items-center justify-between gap-2 px-3 h-10 shrink-0">
        <span data-testid="drawer-title" className="mono text-[10px] tracking-[0.2em] text-[var(--text-3)] truncate">
          {String(title || eyebrow || '').toUpperCase()}
        </span>
        <button
          type="button"
          data-testid={closeTestId}
          onClick={onClose}
          title="Close (Esc)"
          aria-label="Close"
          className="nl-tool w-7 h-7 flex items-center justify-center !rounded-[6px] shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        >
          <X size={13} />
        </button>
      </header>
      {(subtitle || actions) && (
        <div className="px-3 py-2 border-b border-[var(--line)] flex flex-col gap-2 shrink-0">
          {subtitle && <div className="text-[11px] leading-snug text-[var(--text-2)]">{subtitle}</div>}
          {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
        </div>
      )}
      {toolbar}
      <div className={bodyClass}>{children}</div>
    </div>
  );
};

export default ScreenFrame;
