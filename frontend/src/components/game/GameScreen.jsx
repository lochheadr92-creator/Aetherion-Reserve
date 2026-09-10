import { useState, useCallback, useEffect } from 'react';
import GameCanvas from '@/components/game/GameCanvas';
import HudBar from '@/components/game/HudBar';
import BuildToolbar from '@/components/game/BuildToolbar';
import InspectPanel from '@/components/game/InspectPanel';
import ObjectivesPanel from '@/components/game/ObjectivesPanel';
import OverlayToggles from '@/components/game/OverlayToggles';
import TutorialOverlay from '@/components/game/TutorialOverlay';
import EmergencyBanner from '@/components/game/EmergencyBanner';
import ScenarioTracker from '@/components/game/ScenarioTracker';
import PhotoMode from '@/components/game/PhotoMode';
import AlbumScreen from '@/components/game/AlbumScreen';
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

const firstRun = () => !localStorage.getItem('aetherion_tutorial_done');

// The Ops Deck hosts every management screen as a native drawer panel (ScreenFrame reads the drawer
// host from context). The Bloodline Ledger is a contextual drawer (no dock button) opened from an
// organism dossier. The legacy full-screen modal HUD was retired.
function DeckScreen({ id, params, dbSpecies, onClose, onBuy, onClaimSpecimen, onNavigate, onOpenPhoto, onPlanPairing }) {
  switch (id) {
    case 'album': return <AlbumScreen onClose={onClose} onOpenPhoto={onOpenPhoto} initialPhotoId={params?.photoId} />;
    case 'db': return <SpeciesDatabase initialSpecies={dbSpecies} onClose={onClose} onPlanPairing={onPlanPairing} />;
    case 'research': return <ResearchScreen onClose={onClose} />;
    case 'finances': return <FinanceScreen onClose={onClose} />;
    case 'fieldops': return <AcquisitionScreen onClose={onClose} onBuy={onBuy} onClaimSpecimen={onClaimSpecimen} />;
    case 'staff': return <StaffScreen onClose={onClose} />;
    case 'ledger': return <BloodlineLedger creatureId={params?.creatureId} speciesId={params?.speciesId} onClose={onClose} onNavigate={onNavigate} />;
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
  // photo mode -> album: leave the viewfinder and open the gallery drawer on the new capture
  const openAlbumFromPhoto = useCallback(() => { setPhotoMode(false); openDrawer('album', { toggle: false }); }, [openDrawer]);

  const openHelp = useCallback(() => setTutorialOpen(true), [setTutorialOpen]);
  const closeHelp = useCallback(() => setTutorialOpen(false), [setTutorialOpen]);
  const openPhoto = useCallback(() => setPhotoMode(true), [setPhotoMode]);
  const closePhoto = useCallback(() => setPhotoMode(false), [setPhotoMode]);

  // ---- Ops Deck: the shell is presentational; every action still goes through ui.* ----
  // screen requests (inspect panel "open species", alert navigation) arrive via ui.modal and route into the drawer
  const { modal: legacyModal, setModal: setLegacyModal, closeModal: closeLegacyModal } = ui;
  useEffect(() => {
    if (!legacyModal) return;
    openDrawer(legacyModal, { toggle: false });
    setLegacyModal(null); // the request is consumed; dbSpecies focus is kept
  }, [legacyModal, setLegacyModal, openDrawer]);
  const closeDeck = useCallback(() => { closeDrawer(); closeLegacyModal(); }, [closeDrawer, closeLegacyModal]);
  const { buyCreature, claimSpecimen } = ui;
  const deckBuy = useCallback((speciesId) => { closeDrawer(); buyCreature(speciesId); }, [closeDrawer, buyCreature]);
  const deckClaim = useCallback((expeditionId, specimen) => { closeDrawer(); claimSpecimen(expeditionId, specimen); }, [closeDrawer, claimSpecimen]);
  // organism dossier → Bloodline Ledger as a contextual drawer
  const openLedger = useCallback((creatureId) => openDrawer('ledger', { toggle: false, params: { creatureId } }), [openDrawer]);
  // Species Database "Plan pairing" shortcut → ledger drawer focused on that species (no dossier needed)
  const openPlanner = useCallback((speciesId) => openDrawer('ledger', { toggle: false, params: { speciesId } }), [openDrawer]);

  return (
    <div className="relative w-full h-full" data-testid="game-screen">
      <div className="absolute inset-0">
        <GameCanvas onSelect={ui.setSelection} onToolResult={ui.handleToolResult} onToolChange={ui.syncTool} rendererRef={ui.rendererRef} inputRef={ui.inputRef} />
      </div>

      {!photoMode && (
        <>
          <HudBar onOpenModal={openDrawer} onExit={onExit} onNavigate={ui.navigateTo} onHelp={openHelp} onPhoto={openPhoto} />
          <EmergencyBanner onNavigate={ui.navigateTo} />
          <ScenarioTracker onExit={onExit} />
          {/* left-anchored overlays sit right of the dock (56px), or right of dock + drawer (376px) while one is open */}
          <div className={`ops-left-shift absolute inset-y-0 right-0 ${drawer ? 'left-[376px]' : 'left-14'}`} data-testid="ops-left-shift">
            <ObjectivesPanel />
            <BuildToolbar activeTool={ui.activeTool} setTool={ui.setTool} />
          </div>
          <OverlayToggles rendererRef={ui.rendererRef} />
        </>
      )}

      {photoMode && <PhotoMode onClose={closePhoto} onOpenAlbum={openAlbumFromPhoto} />}

      {!photoMode && ui.selection && (
        <InspectPanel
          selection={ui.selection}
          onClose={ui.clearSelection}
          onNavigate={ui.navigateTo}
          onOpenSpecies={ui.openSpecies}
          onOpenLedger={openLedger}
        />
      )}

      {!photoMode && (
        <>
          <OpsDock active={drawer} onOpen={openDrawer} />
          <Drawer id={drawer} onClose={closeDeck}>
            <DeckScreen id={drawer} params={drawerParams} dbSpecies={ui.dbSpecies} onClose={closeDeck} onBuy={deckBuy} onClaimSpecimen={deckClaim} onNavigate={ui.navigateTo} onOpenPhoto={openPhoto} onPlanPairing={openPlanner} />
          </Drawer>
        </>
      )}

      {tutorialOpen && <TutorialOverlay firstTime={tutorialFirstTime} onClose={closeHelp} />}
    </div>
  );
}
