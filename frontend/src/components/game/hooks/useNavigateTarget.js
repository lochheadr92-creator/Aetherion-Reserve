import { useCallback } from 'react';
import { game } from '@/game/controller';

// Navigation from alerts/panels to world objects and screens.
export function useNavigateTarget({ rendererRef, setSelection, setModal, setDbSpecies }) {
  return useCallback((target) => {
    if (!target || !rendererRef.current) return;
    const s = game.state;
    if (target.kind === 'creature') {
      const c = s.creatures.find((q) => q.id === target.id);
      if (c) {
        rendererRef.current.centerOn(c.x, c.y);
        rendererRef.current.selection = { kind: 'creature', id: c.id };
        setSelection({ kind: 'creature', id: c.id });
      }
    } else if (target.kind === 'tile') {
      rendererRef.current.centerOn(target.x, target.y);
    } else if (target.kind === 'species') {
      setDbSpecies(target.id);
      setModal('db');
    } else if (target.kind === 'research') {
      setModal('research');
    } else if (target.kind === 'finances') {
      setModal('finances');
    }
    // 'objectives' targets need no action — the directives panel is always visible
  }, [rendererRef, setSelection, setModal, setDbSpecies]);
}
