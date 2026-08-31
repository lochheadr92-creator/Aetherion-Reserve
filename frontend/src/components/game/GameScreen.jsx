import { useState, useCallback } from 'react';
import GameCanvas from '@/components/game/GameCanvas';
import HudBar from '@/components/game/HudBar';
import BuildToolbar from '@/components/game/BuildToolbar';
import InspectPanel from '@/components/game/InspectPanel';
import ObjectivesPanel from '@/components/game/ObjectivesPanel';
import OverlayToggles from '@/components/game/OverlayToggles';
import TutorialOverlay from '@/components/game/TutorialOverlay';
import GameModals from '@/components/game/GameModals';
import EmergencyBanner from '@/components/game/EmergencyBanner';
import ScenarioTracker from '@/components/game/ScenarioTracker';
import PhotoMode from '@/components/game/PhotoMode';
import { useGameTick } from '@/components/game/useGame';
import { useGameScreenActions } from '@/components/game/hooks/useGameScreenActions';

const firstRun = () => !localStorage.getItem('aetherion_tutorial_done');

export default function GameScreen({ onExit }) {
  useGameTick();
  const [tutorialOpen, setTutorialOpen] = useState(firstRun);
  const [tutorialFirstTime] = useState(firstRun);
  const [photoMode, setPhotoMode] = useState(false);
  const ui = useGameScreenActions();

  const openHelp = useCallback(() => setTutorialOpen(true), [setTutorialOpen]);
  const closeHelp = useCallback(() => setTutorialOpen(false), [setTutorialOpen]);
  const openPhoto = useCallback(() => setPhotoMode(true), [setPhotoMode]);
  const closePhoto = useCallback(() => setPhotoMode(false), [setPhotoMode]);

  return (
    <div className="relative w-full h-full" data-testid="game-screen">
      <div className="absolute inset-0">
        <GameCanvas onSelect={ui.setSelection} onToolResult={ui.handleToolResult} rendererRef={ui.rendererRef} inputRef={ui.inputRef} />
      </div>

      {!photoMode && (
        <>
          <HudBar onOpenModal={ui.setModal} onExit={onExit} onNavigate={ui.navigateTo} onHelp={openHelp} onPhoto={openPhoto} />
          <EmergencyBanner onNavigate={ui.navigateTo} />
          <ScenarioTracker onExit={onExit} />
          <ObjectivesPanel />
          <OverlayToggles rendererRef={ui.rendererRef} />
          <BuildToolbar activeTool={ui.activeTool} setTool={ui.setTool} />
        </>
      )}

      {photoMode && <PhotoMode onClose={closePhoto} />}

      {!photoMode && ui.selection && (
        <InspectPanel
          selection={ui.selection}
          onClose={ui.clearSelection}
          onNavigate={ui.navigateTo}
          onOpenSpecies={ui.openSpecies}
        />
      )}

      <GameModals modal={ui.modal} dbSpecies={ui.dbSpecies} onClose={ui.closeModal} onBuy={ui.buyCreature} onClaimSpecimen={ui.claimSpecimen} />

      {tutorialOpen && <TutorialOverlay firstTime={tutorialFirstTime} onClose={closeHelp} />}
    </div>
  );
}
