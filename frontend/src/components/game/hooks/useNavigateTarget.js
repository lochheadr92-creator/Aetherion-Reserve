import { useCallback } from 'react';
import { game } from '@/game/controller';

// Pure navigation routine (module-level: keeps the hook closure free of locals).
function navigateToTarget(target, { rendererRef, setSelection, setModal, setDbSpecies }) {
  if (!target || !rendererRef.current) return;
  const state = game.state;
  if (target.kind === 'creature') {
    const found = state.creatures.find((cr) => cr.id === target.id);
    if (found) {
      rendererRef.current.centerOn(found.x, found.y);
      rendererRef.current.selection = { kind: 'creature', id: found.id };
      setSelection({ kind: 'creature', id: found.id });
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
}

// Navigation from alerts/panels to world objects and screens.
export function useNavigateTarget({ rendererRef, setSelection, setModal, setDbSpecies }) {
  return useCallback(
    (target) => navigateToTarget(target, { rendererRef, setSelection, setModal, setDbSpecies }),
    [rendererRef, setSelection, setModal, setDbSpecies],
  );
}
