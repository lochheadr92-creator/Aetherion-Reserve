import { useState, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { audio } from '@/game/audio';
import { useGameAlerts } from '@/components/game/hooks/useGameAlerts';
import { useHotkeys } from '@/components/game/hooks/useHotkeys';
import { useNavigateTarget } from '@/components/game/hooks/useNavigateTarget';

const INITIAL_TOOL = { mode: 'select' };

// Module-level notifiers keep hook callbacks tiny and dependency-free.
function notifyToolResult(res) {
  if (!res) return;
  audio.toolResult(res); // placement thunk / deny buzz
  if (!res.ok && res.reason) toast.error(res.reason, { duration: 2600 });
  else if (res.ok && res.msg) toast.success(res.msg, { duration: 2200 });
}

const PLACE_HINTS = {
  buy: 'Transfer crate ready — click inside a fenced enclosure to release the creature.',
  claim: 'Recovered specimen ready — click inside a fenced enclosure to release it (no charge).',
};

// Purchase / specimen-release flows share the same "arm placement tool" shape.
function usePlacementFlows(setTool, setModal) {
  const buyCreature = useCallback((speciesId) => {
    setModal(null);
    setTool({ mode: 'place_creature', speciesId });
    toast.info(PLACE_HINTS.buy, { duration: 5000 });
  }, [setTool, setModal]);

  const claimSpecimen = useCallback((expeditionId, specimen) => {
    setModal(null);
    setTool({ mode: 'place_creature', speciesId: specimen.speciesId, free: true, expeditionId, specimenId: specimen.id });
    toast.info(PLACE_HINTS.claim, { duration: 5000 });
  }, [setTool, setModal]);

  return { buyCreature, claimSpecimen };
}

/**
 * Bundles all interactive state and callbacks used by GameScreen:
 * selection, active modal, species database focus, active tool, and
 * the navigation / purchase / specimen flows. Keeps GameScreen as a
 * pure composition component.
 */
export function useGameScreenActions() {
  const rendererRef = useRef(null);
  const inputRef = useRef(null);
  const [selection, setSelection] = useState(null);
  const [modal, setModal] = useState(null); // 'db' | 'research' | 'finances' | 'fieldops' | 'staff'
  const [dbSpecies, setDbSpecies] = useState(null);
  const [activeTool, setActiveTool] = useState(INITIAL_TOOL);

  const setTool = useCallback((tool) => {
    if (inputRef.current) inputRef.current.setTool(tool);
    setActiveTool(tool);
  }, [inputRef, setActiveTool]);

  const clearSelection = useCallback(() => {
    setSelection(null);
    if (rendererRef.current) rendererRef.current.selection = null;
  }, [rendererRef, setSelection]);

  const closeModal = useCallback(() => {
    setModal(null);
    setDbSpecies(null);
  }, [setModal, setDbSpecies]);

  const handleToolResult = useCallback((res) => notifyToolResult(res), []);

  // keeps the React toolbar state in sync when the input layer changes tools
  // on its own (e.g. right-click cancel back to Select)
  const syncTool = useCallback((tool) => setActiveTool(tool), []);

  const openSpecies = useCallback((sid) => {
    setDbSpecies(sid);
    setModal('db');
  }, [setDbSpecies, setModal]);

  const navigateTo = useNavigateTarget({ rendererRef, setSelection, setModal, setDbSpecies });
  useGameAlerts(navigateTo);
  useHotkeys({ setTool, clearSelection, closeModal });
  const { buyCreature, claimSpecimen } = usePlacementFlows(setTool, setModal);

  return {
    rendererRef, inputRef,
    selection, setSelection, clearSelection,
    modal, setModal, closeModal,
    dbSpecies,
    activeTool, setTool,
    handleToolResult, syncTool, navigateTo,
    buyCreature, claimSpecimen, openSpecies,
  };
}
