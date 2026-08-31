import { useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { game } from '@/game/controller';
import { undoTerrain } from '@/game/terrain';

// ---- Global keyboard shortcuts: Space pause, 1/3 speed, Escape cancel, Ctrl+Z undo.
// Handlers are flat (early returns) and mapped per key to keep complexity low.

const isEditableTarget = (el) => el.tagName === 'INPUT' || el.tagName === 'TEXTAREA';

function undoLatestTerrain(state) {
  const r = undoTerrain(state);
  if (r.ok) toast.info('Terrain change undone');
}

function cancelToSelect(actions) {
  actions.setTool({ mode: 'select' });
  actions.clearSelection();
  actions.closeModal();
}

// Pure key handler (module-level: keeps the effect closure free of locals).
function handleHotkey(event, actions) {
  if (isEditableTarget(event.target)) return;
  const state = game.state;
  if (!state) return;
  if (event.code === 'Space') {
    event.preventDefault();
    game.setPaused(!state.paused);
    return;
  }
  if (event.key === '1') { game.setSpeed(1); return; }
  if (event.key === '3') { game.setSpeed(3); return; }
  if (event.key === 'Escape') { cancelToSelect(actions); return; }
  if (event.key === 'z' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    undoLatestTerrain(state);
  }
}

export function useHotkeys({ setTool, clearSelection, closeModal }) {
  const listener = useCallback(
    (event) => handleHotkey(event, { setTool, clearSelection, closeModal }),
    [setTool, clearSelection, closeModal],
  );
  useEffect(() => {
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [listener]);
}
