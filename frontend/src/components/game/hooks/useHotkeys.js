import { useEffect } from 'react';
import { toast } from 'sonner';
import { game } from '@/game/controller';
import { undoTerrain } from '@/game/terrain';

// Pure key handler (module-level: keeps the effect closure free of locals).
function handleHotkey(event, { setTool, clearSelection, closeModal }) {
  if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') return;
  const state = game.state;
  if (!state) return;
  if (event.code === 'Space') {
    event.preventDefault();
    game.setPaused(!state.paused);
  } else if (event.key === '1') {
    game.setSpeed(1);
  } else if (event.key === '3') {
    game.setSpeed(3);
  } else if (event.key === 'Escape') {
    setTool({ mode: 'select' });
    clearSelection();
    closeModal();
  } else if (event.key === 'z' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    const r = undoTerrain(state);
    if (r.ok) toast.info('Terrain change undone');
  }
}

// Global keyboard shortcuts: Space pause, 1/3 speed, Escape cancel, Ctrl+Z undo.
export function useHotkeys({ setTool, clearSelection, closeModal }) {
  useEffect(() => {
    const listener = (event) => handleHotkey(event, { setTool, clearSelection, closeModal });
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [setTool, clearSelection, closeModal]);
}
