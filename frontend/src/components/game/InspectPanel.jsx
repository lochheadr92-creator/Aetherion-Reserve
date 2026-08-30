import { X } from 'lucide-react';
import { game } from '@/game/controller';
import { useGameTick } from '@/components/game/useGame';
import CreaturePanel from '@/components/game/panels/CreaturePanel';
import EnclosurePanel from '@/components/game/panels/EnclosurePanel';
import BuildingPanel from '@/components/game/panels/BuildingPanel';
import FencePanel from '@/components/game/panels/FencePanel';

const TITLES = {
  creature: 'ORGANISM DOSSIER',
  enclosure: 'ENCLOSURE ANALYSIS',
  building: 'STRUCTURE',
  fence: 'BARRIER SEGMENT',
};

export default function InspectPanel({ selection, onClose, onNavigate, onOpenSpecies }) {
  const tick = useGameTick();
  if (!game.state || !selection) return null;
  return (
    <div className="absolute right-3 top-16 bottom-3 w-[400px] z-30 pointer-events-none" data-testid="inspect-panel">
      <div className="nl-panel h-full flex flex-col pointer-events-auto overflow-hidden">
        <div className="nl-panel-header flex items-center justify-between px-3 py-2">
          <span className="mono text-[10px] tracking-[0.2em] text-[var(--text-3)]">{TITLES[selection.kind] || 'INSPECT'}</span>
          <button data-testid="inspect-panel-close-button" onClick={onClose} className="nl-tool w-7 h-7 flex items-center justify-center"><X size={13} /></button>
        </div>
        <div className="flex-1 overflow-y-auto nl-scroll">
          {selection.kind === 'creature' && <CreaturePanel id={selection.id} tick={tick} onNavigate={onNavigate} onOpenSpecies={onOpenSpecies} onClose={onClose} />}
          {selection.kind === 'enclosure' && <EnclosurePanel id={selection.id} tick={tick} onNavigate={onNavigate} />}
          {selection.kind === 'building' && <BuildingPanel id={selection.id} onClose={onClose} />}
          {selection.kind === 'fence' && <FencePanel sel={selection} onClose={onClose} />}
        </div>
      </div>
    </div>
  );
}
