import { useState, useRef, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { game, on } from '@/game/controller';
import GameCanvas from '@/components/game/GameCanvas';
import HudBar from '@/components/game/HudBar';
import BuildToolbar from '@/components/game/BuildToolbar';
import InspectPanel from '@/components/game/InspectPanel';
import ObjectivesPanel from '@/components/game/ObjectivesPanel';
import SpeciesDatabase from '@/components/game/SpeciesDatabase';
import ResearchScreen from '@/components/game/ResearchScreen';
import FinanceScreen from '@/components/game/FinanceScreen';
import AcquisitionScreen from '@/components/game/AcquisitionScreen';
import OverlayToggles from '@/components/game/OverlayToggles';
import TutorialOverlay from '@/components/game/TutorialOverlay';
import { undoTerrain } from '@/game/terrain';
import { useGameTick } from '@/components/game/useGame';

export default function GameScreen({ onExit }) {
  useGameTick();
  const rendererRef = useRef(null);
  const inputRef = useRef(null);
  const [selection, setSelection] = useState(null);
  const [modal, setModal] = useState(null); // 'db' | 'research' | 'finances' | 'fieldops'
  const [dbSpecies, setDbSpecies] = useState(null);
  const [activeTool, setActiveTool] = useState({ mode: 'select' });
  const [tutorialOpen, setTutorialOpen] = useState(() => !localStorage.getItem('aetherion_tutorial_done'));
  const [tutorialFirstTime] = useState(() => !localStorage.getItem('aetherion_tutorial_done'));

  const setTool = useCallback((tool) => {
    if (inputRef.current) inputRef.current.setTool(tool);
    setActiveTool(tool);
  }, []);

  const handleToolResult = useCallback((res) => {
    if (!res) return;
    if (!res.ok && res.reason) toast.error(res.reason, { duration: 2600 });
    else if (res.ok && res.msg) toast.success(res.msg, { duration: 2200 });
  }, []);

  const navigateTo = useCallback((target) => {
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
    } else if (target.kind === 'research') setModal('research');
    else if (target.kind === 'finances') setModal('finances');
    else if (target.kind === 'objectives') { /* objectives always visible */ }
  }, []);

  // toast pipeline for sim alerts
  useEffect(() => {
    return on('alert', (a) => {
      const opts = { duration: a.type === 'breakthrough' ? 7000 : 4500 };
      if (a.type === 'breakthrough') {
        toast.custom((t) => (
          <div
            data-testid="toast-breakthrough"
            className="nl-panel nl-scan px-4 py-3 w-[360px] cursor-pointer"
            style={{ borderColor: 'rgba(45,226,230,0.5)', boxShadow: '0 0 0 1px rgba(45,226,230,0.25), 0 0 24px rgba(45,226,230,0.15)' }}
            onClick={() => { navigateTo(a.target); toast.dismiss(t); }}
          >
            <div className="mono text-[10px] tracking-[0.2em] text-[var(--accent-cyan)]">{a.title}</div>
            <div className="text-sm mt-1 text-[var(--text-1)]">{a.msg}</div>
          </div>
        ), opts);
      } else if (a.type === 'danger') {
        toast.custom((t) => (
          <div data-testid="toast-danger" className="nl-panel px-4 py-3 w-[360px] cursor-pointer" style={{ borderColor: 'rgba(255,77,109,0.6)' }}
            onClick={() => { navigateTo(a.target); toast.dismiss(t); }}>
            <div className="mono text-[10px] tracking-[0.2em] text-[var(--danger)]">{a.title}</div>
            <div className="text-sm mt-1 text-[var(--text-1)]">{a.msg}</div>
          </div>
        ), opts);
      } else if (a.type === 'warning') {
        toast.warning(`${a.title}: ${a.msg}`, opts);
      } else if (a.type === 'success') {
        toast.success(`${a.title}: ${a.msg}`, opts);
      } else {
        toast.info(`${a.title}: ${a.msg}`, opts);
      }
    });
  }, [navigateTo]);

  // keyboard shortcuts
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      const s = game.state;
      if (!s) return;
      if (e.code === 'Space') { e.preventDefault(); game.setPaused(!s.paused); }
      else if (e.key === '1') game.setSpeed(1);
      else if (e.key === '3') game.setSpeed(3);
      else if (e.key === 'Escape') { setTool({ mode: 'select' }); setSelection(null); if (rendererRef.current) rendererRef.current.selection = null; setModal(null); }
      else if (e.key === 'z' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); const r = undoTerrain(s); if (r.ok) toast.info('Terrain change undone'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setTool]);

  const buyCreature = useCallback((speciesId) => {
    setModal(null);
    setTool({ mode: 'place_creature', speciesId });
    toast.info('Transfer crate ready — click inside a fenced enclosure to release the creature.', { duration: 5000 });
  }, [setTool]);

  return (
    <div className="relative w-full h-full" data-testid="game-screen">
      <div className="absolute inset-0">
        <GameCanvas onSelect={setSelection} onToolResult={handleToolResult} rendererRef={rendererRef} inputRef={inputRef} />
      </div>

      <HudBar
        onOpenModal={setModal}
        onExit={onExit}
        onNavigate={navigateTo}
        onHelp={() => setTutorialOpen(true)}
      />

      <ObjectivesPanel />

      <OverlayToggles rendererRef={rendererRef} />

      <BuildToolbar activeTool={activeTool} setTool={setTool} />

      {selection && (
        <InspectPanel
          selection={selection}
          onClose={() => { setSelection(null); if (rendererRef.current) rendererRef.current.selection = null; }}
          onNavigate={navigateTo}
          onOpenSpecies={(sid) => { setDbSpecies(sid); setModal('db'); }}
        />
      )}

      {modal === 'db' && <SpeciesDatabase initialSpecies={dbSpecies} onClose={() => { setModal(null); setDbSpecies(null); }} />}
      {modal === 'research' && <ResearchScreen onClose={() => setModal(null)} />}
      {modal === 'finances' && <FinanceScreen onClose={() => setModal(null)} />}
      {modal === 'fieldops' && <AcquisitionScreen onClose={() => setModal(null)} onBuy={buyCreature} />}

      {tutorialOpen && <TutorialOverlay firstTime={tutorialFirstTime} onClose={() => setTutorialOpen(false)} />}
    </div>
  );
}
