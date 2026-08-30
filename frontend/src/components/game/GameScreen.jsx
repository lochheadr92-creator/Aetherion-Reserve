import { useState, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import GameCanvas from '@/components/game/GameCanvas';
import HudBar from '@/components/game/HudBar';
import BuildToolbar from '@/components/game/BuildToolbar';
import InspectPanel from '@/components/game/InspectPanel';
import ObjectivesPanel from '@/components/game/ObjectivesPanel';
import OverlayToggles from '@/components/game/OverlayToggles';
import TutorialOverlay from '@/components/game/TutorialOverlay';
import GameModals from '@/components/game/GameModals';
import { useGameTick } from '@/components/game/useGame';
import { useGameAlerts } from '@/components/game/hooks/useGameAlerts';
import { useHotkeys } from '@/components/game/hooks/useHotkeys';
import { useNavigateTarget } from '@/components/game/hooks/useNavigateTarget';

const firstRun = () => !localStorage.getItem('aetherion_tutorial_done');

export default function GameScreen({ onExit }) {
  useGameTick();
  const rendererRef = useRef(null);
  const inputRef = useRef(null);
  const [selection, setSelection] = useState(null);
  const [modal, setModal] = useState(null); // 'db' | 'research' | 'finances' | 'fieldops'
  const [dbSpecies, setDbSpecies] = useState(null);
  const [activeTool, setActiveTool] = useState({ mode: 'select' });
  const [tutorialOpen, setTutorialOpen] = useState(firstRun);
  const [tutorialFirstTime] = useState(firstRun);

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

  const openSpecies = useCallback((sid) => {
    setDbSpecies(sid);
    setModal('db');
  }, [setDbSpecies, setModal]);

  const openHelp = useCallback(() => setTutorialOpen(true), [setTutorialOpen]);
  const closeHelp = useCallback(() => setTutorialOpen(false), [setTutorialOpen]);

  return (
    <div className="relative w-full h-full" data-testid="game-screen">
      <div className="absolute inset-0">
        <GameCanvas onSelect={setSelection} onToolResult={handleToolResult} rendererRef={rendererRef} inputRef={inputRef} />
      </div>

      <HudBar onOpenModal={setModal} onExit={onExit} onNavigate={navigateTo} onHelp={openHelp} />
      <ObjectivesPanel />
      <OverlayToggles rendererRef={rendererRef} />
      <BuildToolbar activeTool={activeTool} setTool={setTool} />

      {selection && (
        <InspectPanel
          selection={selection}
          onClose={clearSelection}
          onNavigate={navigateTo}
          onOpenSpecies={openSpecies}
        />
      )}

      <GameModals modal={modal} dbSpecies={dbSpecies} onClose={closeModal} onBuy={buyCreature} />

      {tutorialOpen && <TutorialOverlay firstTime={tutorialFirstTime} onClose={closeHelp} />}
    </div>
  );
}
