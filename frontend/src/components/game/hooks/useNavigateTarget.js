import { useCallback } from 'react';
import { game } from '@/game/controller';

// ---- Navigation from alerts/panels to world objects and screens.
// One flat handler per target kind keeps nesting shallow.

function goToCreature(target, { rendererRef, setSelection }) {
  const found = game.state.creatures.find((cr) => cr.id === target.id);
  if (!found) return;
  rendererRef.current.centerOn(found.x, found.y);
  rendererRef.current.selection = { kind: 'creature', id: found.id };
  setSelection({ kind: 'creature', id: found.id });
}

function goToTile(target, { rendererRef }) {
  rendererRef.current.centerOn(target.x, target.y);
}

function goToSpecies(target, { setModal, setDbSpecies }) {
  setDbSpecies(target.id);
  setModal('db');
}

const goToResearch = (target, { setModal }) => setModal('research');
const goToFinances = (target, { setModal }) => setModal('finances');

// 'objectives' targets need no handler — the directives panel is always visible
const NAV_HANDLERS = {
  creature: goToCreature,
  tile: goToTile,
  species: goToSpecies,
  research: goToResearch,
  finances: goToFinances,
};

// Pure navigation routine (module-level: keeps the hook closure free of locals).
function navigateToTarget(target, ctx) {
  if (!target || !ctx.rendererRef.current || !game.state) return;
  const handler = NAV_HANDLERS[target.kind];
  if (handler) handler(target, ctx);
}

export function useNavigateTarget({ rendererRef, setSelection, setModal, setDbSpecies }) {
  return useCallback(
    (target) => navigateToTarget(target, { rendererRef, setSelection, setModal, setDbSpecies }),
    [rendererRef, setSelection, setModal, setDbSpecies],
  );
}
