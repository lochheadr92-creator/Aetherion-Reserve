import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { game } from '@/game/controller';
import { BUILDINGS } from '@/game/data/buildings';
import { fmtMoney } from '@/game/constants';
import { demolishBuilding } from '@/game/construction';
import { platformVisibilityReport } from '@/game/guests';
import { attractionReport } from '@/game/attractions';
import { stationHasCar } from '@/game/transport';

const ATTRACTION_CATS = ['experience', 'major', 'amenity'];

// Derive every optional report/flag for a building in one flat pass.
function buildReports(s, b, def) {
  const isAttraction = ATTRACTION_CATS.includes(def.cat) || def.sells === 'gift';
  const isStation = !!def.transport;
  return {
    visReport: def.viewRadius ? platformVisibilityReport(s, b) : null,
    synReport: isAttraction ? attractionReport(s, b) : null,
    isStation,
    linked: isStation ? stationHasCar(s, b.id) : false,
  };
}

function demolishWithRefund(s, b, def, onClose) {
  demolishBuilding(s, b.id);
  toast.info(`${def.name} demolished (+${fmtMoney(def.cost * 0.5)})`);
  onClose();
}

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

// Data-driven stat rows keep the main component free of per-field branching.
function statRows(def) {
  const rows = [{ label: 'Upkeep', value: `◈${def.upkeep}/cycle` }];
  if (def.viewRadius) rows.push({ label: 'View radius', value: `${def.viewRadius} tiles` });
  if (def.powerRadius) rows.push({ label: 'Power radius', value: `${def.powerRadius} tiles` });
  if (def.sells && def.price > 0) rows.push({ label: 'Price', value: `◈${def.price}` });
  return rows;
}

function StatsList({ def }) {
  return (
    <div className="text-[11px] space-y-1">
      {statRows(def).map((r) => (
        <div key={r.label} className="flex justify-between"><span className="text-[var(--text-3)]">{r.label}</span><span className="mono">{r.value}</span></div>
      ))}
    </div>
  );
}

function StationStatus({ linked }) {
  return (
    <div className="text-[11px] rounded border px-2 py-1.5" data-testid="station-link-status"
      style={{ borderColor: linked ? 'var(--success)' : 'var(--warning)', color: linked ? 'var(--success)' : 'var(--warning)' }}>
      {linked ? 'LINE ACTIVE — an elevated car is shuttling guests over the park.' : 'NO LINE — build a second station of the same type (6+ tiles away) to open the route.'}
    </div>
  );
}

export default function BuildingPanel({ id, onClose }) {
  const s = game.state;
  const b = s.buildings.find((q) => q.id === id);
  if (!b) return <div className="p-4 text-xs text-[var(--text-3)]">Structure removed.</div>;
  const def = BUILDINGS[b.type];
  const { visReport, synReport, isStation, linked } = buildReports(s, b, def);

  return (
    <div className="flex flex-col gap-3 p-4" data-testid="building-panel">
      <div>
        <div className="text-base font-semibold">{def.name}</div>
        <div className="text-[11px] text-[var(--text-3)] mt-1">{def.desc}</div>
      </div>
      <StatsList def={def} />
      {isStation && <StationStatus linked={linked} />}
      {synReport && <SynergyReport report={synReport} />}
      {visReport && <VisibilityReport report={visReport} />}
      <button data-testid="building-demolish-button" onClick={() => demolishWithRefund(s, b, def, onClose)}
        className="nl-tool h-8 text-[11px] flex items-center justify-center gap-1 !text-[var(--danger)]"><Trash2 size={12} /> Demolish (50% refund)</button>
    </div>
  );
}
