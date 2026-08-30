import { useEffect } from 'react';
import { toast } from 'sonner';
import { on } from '@/game/controller';

const BREAKTHROUGH_STYLE = {
  borderColor: 'rgba(45,226,230,0.5)',
  boxShadow: '0 0 0 1px rgba(45,226,230,0.25), 0 0 24px rgba(45,226,230,0.15)',
};
const DANGER_STYLE = { borderColor: 'rgba(255,77,109,0.6)' };

function breakthroughToast(a, navigateTo) {
  toast.custom((t) => (
    <div
      data-testid="toast-breakthrough"
      className="nl-panel nl-scan px-4 py-3 w-[360px] cursor-pointer"
      style={BREAKTHROUGH_STYLE}
      onClick={() => { navigateTo(a.target); toast.dismiss(t); }}
    >
      <div className="mono text-[10px] tracking-[0.2em] text-[var(--accent-cyan)]">{a.title}</div>
      <div className="text-sm mt-1 text-[var(--text-1)]">{a.msg}</div>
    </div>
  ), { duration: 7000 });
}

function dangerToast(a, navigateTo) {
  toast.custom((t) => (
    <div
      data-testid="toast-danger"
      className="nl-panel px-4 py-3 w-[360px] cursor-pointer"
      style={DANGER_STYLE}
      onClick={() => { navigateTo(a.target); toast.dismiss(t); }}
    >
      <div className="mono text-[10px] tracking-[0.2em] text-[var(--danger)]">{a.title}</div>
      <div className="text-sm mt-1 text-[var(--text-1)]">{a.msg}</div>
    </div>
  ), { duration: 4500 });
}

// Routes one simulation alert to the appropriately styled toast (module-level helper).
function routeAlert(alert, navigateTo) {
  const opts = { duration: 4500 };
  if (alert.type === 'breakthrough') breakthroughToast(alert, navigateTo);
  else if (alert.type === 'danger') dangerToast(alert, navigateTo);
  else if (alert.type === 'warning') toast.warning(`${alert.title}: ${alert.msg}`, opts);
  else if (alert.type === 'success') toast.success(`${alert.title}: ${alert.msg}`, opts);
  else toast.info(`${alert.title}: ${alert.msg}`, opts);
}

// Routes simulation alerts into styled toasts.
export function useGameAlerts(navigateTo) {
  useEffect(() => {
    return on('alert', (alert) => routeAlert(alert, navigateTo));
  }, [navigateTo]);
}
