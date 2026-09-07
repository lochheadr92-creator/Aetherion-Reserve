import { createContext, useContext } from 'react';
import { X } from 'lucide-react';

// Which surface a management screen is mounted in. The Ops Deck Drawer provides
// { host: 'drawer', title }; the default (legacy HUD → GameModals) is the full-screen modal.
export const ScreenHostContext = createContext({ host: 'modal', title: null });
export const useScreenHost = () => useContext(ScreenHostContext).host;

const BACKDROP_STYLE = { background: 'rgba(5,7,11,0.8)' };

/**
 * Chrome for a management screen, host-aware:
 *  - modal  (legacy HUD): full-screen backdrop + centred .nl-panel with the eyebrow/subtitle header —
 *           the same DOM the screens rendered before the Ops Deck (identical [data-testid] order).
 *  - drawer (Ops Deck):   fills the 320px drawer with ONE compact header (drawer title + the screen's
 *           own close button), an optional subtitle/actions strip, an optional toolbar, then the body.
 * The root keeps the screen's `*-modal` testid in both hosts (one selector for the tests) and exposes
 * `data-host` so screens can declare narrow layouts with the Tailwind `drawer:` variant.
 */
export const ScreenFrame = ({
  testId,
  closeTestId,
  onClose,
  eyebrow,
  subtitle,
  actions,
  toolbar,
  size = 'w-[1060px] h-[80vh]',
  bodyClassName = '',
  scroll = true,
  layer = 'absolute inset-0 z-40',
  children,
}) => {
  const { host, title } = useContext(ScreenHostContext);
  const bodyClass = `flex-1 min-h-0 ${scroll ? 'overflow-y-auto nl-scroll' : 'flex'} ${bodyClassName}`;

  if (host === 'drawer') {
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
  }

  return (
    <div data-testid={testId} data-host="modal" className={`${layer} flex items-center justify-center`} style={BACKDROP_STYLE}>
      <div className={`nl-panel ${size} max-w-[95vw] flex flex-col overflow-hidden`}>
        <div className="nl-panel-header flex items-center justify-between px-4 py-3">
          <div>
            <div className="mono text-[10px] tracking-[0.25em] text-[var(--accent-cyan)] flex items-center gap-1.5">{eyebrow}</div>
            {subtitle && <div className="text-sm text-[var(--text-2)] mt-0.5">{subtitle}</div>}
          </div>
          <div className="flex items-center gap-3">
            {actions}
            <button data-testid={closeTestId} onClick={onClose} aria-label="Close" className="nl-tool w-8 h-8 flex items-center justify-center"><X size={15} /></button>
          </div>
        </div>
        {toolbar}
        <div className={bodyClass}>{children}</div>
      </div>
    </div>
  );
};

export default ScreenFrame;
