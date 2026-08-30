import { useState, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { useGameAlerts } from '@/components/game/hooks/useGameAlerts';
import { useHotkeys } from '@/components/game/hooks/useHotkeys';
import { useNavigateTarget } from '@/components/game/hooks/useNavigateTarget';

const INITIAL_TOOL = { mode: 'select' };

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

  const handleToolResult = useCallback((res) => {
    if (!res) return;
    if (!res.ok && res.reason) toast.error(res.reason, { duration: 2600 });
    else if (res.ok && res.msg) toast.success(res.msg, { duration: 2200 });
  }, []);

  const navigateTo = useNavigateTarget({ rendererRef, setSelection, setModal, setDbSpecies });
  useGameAlerts(navigateTo);
  useHotkeys({ setTool, clearSelection, closeModal });

  const buyCreature = useCallback((speciesId) => {
    setModal(null);
    setTool({ mode: 'place_creature', speciesId });
    toast.info('Transfer crate ready — click inside a fenced enclosure to release the creature.', { duration: 5000 });
  }, [setTool, setModal]);

  const claimSpecimen = useCallback((expeditionId, specimen) => {
    setModal(null);
    setTool({ mode: 'place_creature', speciesId: specimen.speciesId, free: true, expeditionId, specimenId: specimen.id });
    toast.info('Recovered specimen ready — click inside a fenced enclosure to release it (no charge).', { duration: 5000 });
  }, [setTool, setModal]);

  const openSpecies = useCallback((sid) => {
    setDbSpecies(sid);
    setModal('db');
  }, [setDbSpecies, setModal]);

  return {
    rendererRef, inputRef,
    selection, setSelection, clearSelection,
    modal, setModal, closeModal,
    dbSpecies,
    activeTool, setTool,
    handleToolResult, navigateTo,
    buyCreature, claimSpecimen, openSpecies,
  };
}
