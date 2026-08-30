import { useEffect } from 'react';
import { toast } from 'sonner';
import { game } from '@/game/controller';
import { undoTerrain } from '@/game/terrain';

// Global keyboard shortcuts: Space pause, 1/3 speed, Escape cancel, Ctrl+Z undo.
export function useHotkeys({ setTool, clearSelection, closeModal }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      const s = game.state;
      if (!s) return;
      if (e.code === 'Space') {
        e.preventDefault();
        game.setPaused(!s.paused);
      } else if (e.key === '1') {
        game.setSpeed(1);
      } else if (e.key === '3') {
        game.setSpeed(3);
      } else if (e.key === 'Escape') {
        setTool({ mode: 'select' });
        clearSelection();
        closeModal();
      } else if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        const r = undoTerrain(s);
        if (r.ok) toast.info('Terrain change undone');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setTool, clearSelection, closeModal]);
}
