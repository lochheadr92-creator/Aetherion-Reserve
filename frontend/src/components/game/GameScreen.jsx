import { useState, useCallback, useEffect } from 'react';
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
import { OpsDock } from '@/components/game/OpsDock';
import { Drawer } from '@/components/game/Drawer';
import SpeciesDatabase from '@/components/game/SpeciesDatabase';
import ResearchScreen from '@/components/game/ResearchScreen';
import FinanceScreen from '@/components/game/FinanceScreen';
import AcquisitionScreen from '@/components/game/AcquisitionScreen';
import StaffScreen from '@/components/game/StaffScreen';
import BloodlineLedger from '@/components/game/BloodlineLedger';
import { useDrawer } from '@/components/game/hooks/useDrawer';
import { useGameTick } from '@/components/game/useGame';
import { useGameScreenActions } from '@/components/game/hooks/useGameScreenActions';
import { OPS_DECK } from '@/game/art/flags';

const firstRun = () => !localStorage.getItem('aetherion_tutorial_done');

// Deck mode hosts the management screens as native drawer panels (ScreenFrame reads the drawer
// host from context); GameModals itself is only mounted when the flag is off. The Bloodline
// Ledger is a contextual drawer (no dock button) opened from an organism dossier.
function DeckScreen({ id, params, dbSpecies, onClose, onBuy, onClaimSpecimen, onNavigate }) {
  switch (id) {
    case 'db': return <SpeciesDatabase initialSpecies={dbSpecies} onClose={onClose} />;
    case 'research': return <ResearchScreen onClose={onClose} />;
    case 'finances': return <FinanceScreen onClose={onClose} />;
    case 'fieldops': return <AcquisitionScreen onClose={onClose} onBuy={onBuy} onClaimSpecimen={onClaimSpecimen} />;
    case 'staff': return <StaffScreen onClose={onClose} />;
    case 'ledger': return <BloodlineLedger creatureId={params?.creatureId} onClose={onClose} onNavigate={onNavigate} />;
    default: return null;
  }
}

export default function GameScreen({ onExit }) {
  useGameTick();
  const [tutorialOpen, setTutorialOpen] = useState(firstRun);
  const [tutorialFirstTime] = useState(firstRun);
  const [photoMode, setPhotoMode] = useState(false);
  const ui = useGameScreenActions();
  const { drawer, drawerParams, openDrawer, closeDrawer } = useDrawer();

  const openHelp = useCallback(() => setTutorialOpen(true), [setTutorialOpen]);
  const closeHelp = useCallback(() => setTutorialOpen(false), [setTutorialOpen]);
  const openPhoto = useCallback(() => setPhotoMode(true), [setPhotoMode]);
  const closePhoto = useCallback(() => setPhotoMode(false), [setPhotoMode]);

  // ---- Ops Deck (flag on): the shell is presentational; every action still goes through ui.* ----
  // legacy modal writers (inspect panel "open species", alert navigation) route into the deck
  const { modal: legacyModal, setModal: setLegacyModal, closeModal: closeLegacyModal } = ui;
  useEffect(() => {
    if (!OPS_DECK || !legacyModal) return;
    openDrawer(legacyModal, { toggle: false });
    setLegacyModal(null); // GameModals is not mounted in deck mode; dbSpecies focus is kept
  }, [legacyModal, setLegacyModal, openDrawer]);
  const closeDeck = useCallback(() => { closeDrawer(); closeLegacyModal(); }, [closeDrawer, closeLegacyModal]);
  const { buyCreature, claimSpecimen } = ui;
  const deckBuy = useCallback((speciesId) => { closeDrawer(); buyCreature(speciesId); }, [closeDrawer, buyCreature]);
  const deckClaim = useCallback((expeditionId, specimen) => { closeDrawer(); claimSpecimen(expeditionId, specimen); }, [closeDrawer, claimSpecimen]);
  // organism dossier → Bloodline Ledger as a contextual drawer (legacy HUD keeps its portal modal)
  const openLedger = useCallback((creatureId) => openDrawer('ledger', { toggle: false, params: { creatureId } }), [openDrawer]);

  return (
    <div className="relative w-full h-full" data-testid="game-screen">
      <div className="absolute inset-0">
        <GameCanvas onSelect={ui.setSelection} onToolResult={ui.handleToolResult} onToolChange={ui.syncTool} rendererRef={ui.rendererRef} inputRef={ui.inputRef} />
      </div>

      {!photoMode && (
        <>
          <HudBar onOpenModal={OPS_DECK ? openDrawer : ui.setModal} onExit={onExit} onNavigate={ui.navigateTo} onHelp={openHelp} onPhoto={openPhoto} />
          <EmergencyBanner onNavigate={ui.navigateTo} />
          <ScenarioTracker onExit={onExit} />
          {OPS_DECK ? (
            // left-anchored overlays sit right of the dock (56px), or right of dock + drawer (376px) while one is open
            <div className={`ops-left-shift absolute inset-y-0 right-0 ${drawer ? 'left-[376px]' : 'left-14'}`} data-testid="ops-left-shift">
              <ObjectivesPanel />
              <BuildToolbar activeTool={ui.activeTool} setTool={ui.setTool} />
            </div>
          ) : (
            <>
              <ObjectivesPanel />
              <OverlayToggles rendererRef={ui.rendererRef} />
              <BuildToolbar activeTool={ui.activeTool} setTool={ui.setTool} />
            </>
          )}
          {OPS_DECK && <OverlayToggles rendererRef={ui.rendererRef} />}
        </>
      )}

      {photoMode && <PhotoMode onClose={closePhoto} />}

      {!photoMode && ui.selection && (
        <InspectPanel
          selection={ui.selection}
          onClose={ui.clearSelection}
          onNavigate={ui.navigateTo}
          onOpenSpecies={ui.openSpecies}
          onOpenLedger={OPS_DECK ? openLedger : undefined}
        />
      )}

      {OPS_DECK ? (
        !photoMode && (
          <>
            <OpsDock active={drawer} onOpen={openDrawer} />
            <Drawer id={drawer} onClose={closeDeck}>
              <DeckScreen id={drawer} params={drawerParams} dbSpecies={ui.dbSpecies} onClose={closeDeck} onBuy={deckBuy} onClaimSpecimen={deckClaim} onNavigate={ui.navigateTo} />
            </Drawer>
          </>
        )
      ) : (
        <GameModals modal={ui.modal} dbSpecies={ui.dbSpecies} onClose={ui.closeModal} onBuy={ui.buyCreature} onClaimSpecimen={ui.claimSpecimen} />
      )}

      {tutorialOpen && <TutorialOverlay firstTime={tutorialFirstTime} onClose={closeHelp} />}
    </div>
  );
}
