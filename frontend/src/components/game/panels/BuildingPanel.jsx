import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { game } from '@/game/controller';
import { BUILDINGS } from '@/game/data/buildings';
import { fmtMoney } from '@/game/constants';
import { demolishBuilding } from '@/game/construction';
import { platformVisibilityReport } from '@/game/guests';
import { attractionReport } from '@/game/attractions';
import { stationHasCar } from '@/game/transport';

function VisibilityReport({ report }) {
  return (
    <div>
      <div className="mono text-[10px] tracking-[0.2em] text-[var(--text-3)] mb-1.5">CURRENT VISIBILITY</div>
      {report.length === 0 && <div className="text-[11px] text-[var(--warning)]">No creatures visible from here right now.</div>}
      <div className="space-y-1">
        {report.slice(0, 6).map((v) => (
          <div key={v.creature.id} className="flex justify-between text-[11px]">
            <span className="text-[var(--text-2)]">{v.creature.name}</span>
            <span className="mono" data-testid="visibility-value" style={{ color: v.vis > 0.5 ? 'var(--success)' : 'var(--warning)' }}>{(v.vis * 100).toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SynergyReport({ report }) {
  const pct = Math.round(report.score * 100);
  return (
    <div data-testid="building-synergy-report">
      <div className="mono text-[10px] tracking-[0.2em] text-[var(--text-3)] mb-1.5">ATTRACTION RATING</div>
      <div className="flex items-baseline gap-2">
        <span className="text-lg font-semibold mono" style={{ color: report.score >= 1.3 ? 'var(--success)' : report.score <= 0.75 ? 'var(--danger)' : 'var(--text-1)' }}>{pct}%</span>
        <span className="text-[10px] text-[var(--text-3)]">of base value — placement matters</span>
      </div>
      <div className="space-y-0.5 mt-1">
        {report.parts.map((p) => (
          <div key={p.label} className="flex justify-between text-[10px]">
            <span className="text-[var(--text-3)]">{p.label}</span>
            <span className="mono" style={{ color: p.value >= 0 ? 'var(--success)' : 'var(--danger)' }}>{p.value >= 0 ? '+' : ''}{Math.round(p.value * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function BuildingPanel({ id, onClose }) {
  const s = game.state;
  const b = s.buildings.find((q) => q.id === id);
  if (!b) return <div className="p-4 text-xs text-[var(--text-3)]">Structure removed.</div>;
  const def = BUILDINGS[b.type];
  const visReport = def.viewRadius ? platformVisibilityReport(s, b) : null;
  const isAttraction = ['experience', 'major', 'amenity'].includes(def.cat) || def.sells === 'gift';
  const synReport = isAttraction ? attractionReport(s, b) : null;
  const isStation = !!def.transport;
  const linked = isStation ? stationHasCar(s, b.id) : false;

  const demolish = () => {
    demolishBuilding(s, b.id);
    toast.info(`${def.name} demolished (+${fmtMoney(def.cost * 0.5)})`);
    onClose();
  };

  return (
    <div className="flex flex-col gap-3 p-4" data-testid="building-panel">
      <div>
        <div className="text-base font-semibold">{def.name}</div>
        <div className="text-[11px] text-[var(--text-3)] mt-1">{def.desc}</div>
      </div>
      <div className="text-[11px] space-y-1">
        <div className="flex justify-between"><span className="text-[var(--text-3)]">Upkeep</span><span className="mono">◈{def.upkeep}/cycle</span></div>
        {def.viewRadius && <div className="flex justify-between"><span className="text-[var(--text-3)]">View radius</span><span className="mono">{def.viewRadius} tiles</span></div>}
        {def.powerRadius && <div className="flex justify-between"><span className="text-[var(--text-3)]">Power radius</span><span className="mono">{def.powerRadius} tiles</span></div>}
        {def.sells && def.price > 0 && <div className="flex justify-between"><span className="text-[var(--text-3)]">Price</span><span className="mono">◈{def.price}</span></div>}
      </div>
      {isStation && (
        <div className="text-[11px] rounded border px-2 py-1.5" data-testid="station-link-status"
          style={{ borderColor: linked ? 'var(--success)' : 'var(--warning)', color: linked ? 'var(--success)' : 'var(--warning)' }}>
          {linked ? 'LINE ACTIVE — an elevated car is shuttling guests over the park.' : 'NO LINE — build a second station of the same type (6+ tiles away) to open the route.'}
        </div>
      )}
      {synReport && <SynergyReport report={synReport} />}
      {visReport && <VisibilityReport report={visReport} />}
      <button data-testid="building-demolish-button" onClick={demolish}
        className="nl-tool h-8 text-[11px] flex items-center justify-center gap-1 !text-[var(--danger)]"><Trash2 size={12} /> Demolish (50% refund)</button>
    </div>
  );
}
