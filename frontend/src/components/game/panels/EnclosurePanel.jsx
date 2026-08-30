import { useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { game } from '@/game/controller';
import { computeEnclosures } from '@/game/enclosures';
import { speciesById } from '@/game/data/species';
import { FENCES, MATERIALS } from '@/game/constants';

function CompositionSection({ enc, mats }) {
  return (
    <div>
      <div className="mono text-[10px] tracking-[0.2em] text-[var(--text-3)] mb-2">COMPOSITION</div>
      <div className="space-y-1.5">
        {mats.map(([m, pct]) => (
          <div key={m} className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm border border-[var(--line-2)]" style={{ background: MATERIALS[m].color }} />
            <span className="text-[11px] text-[var(--text-2)] flex-1">{MATERIALS[m].name}</span>
            <span className="mono text-[10px] text-[var(--text-3)]">{(pct * 100).toFixed(0)}%</span>
          </div>
        ))}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 pt-1 text-[11px]">
          <div className="flex justify-between"><span className="text-[var(--text-3)]">Water</span><span className="mono" data-testid="enclosure-water-pct">{(enc.waterPct * 100).toFixed(0)}%</span></div>
          <div className="flex justify-between"><span className="text-[var(--text-3)]">— deep</span><span className="mono">{(enc.waterDeepPct * 100).toFixed(0)}%</span></div>
          <div className="flex justify-between"><span className="text-[var(--text-3)]">Canopy</span><span className="mono">{(enc.forestPct * 100).toFixed(0)}%</span></div>
          <div className="flex justify-between"><span className="text-[var(--text-3)]">Open ground</span><span className="mono">{(enc.openPct * 100).toFixed(0)}%</span></div>
          <div className="flex justify-between"><span className="text-[var(--text-3)]">Avg elevation</span><span className="mono">{enc.avgElev.toFixed(1)}</span></div>
          <div className="flex justify-between"><span className="text-[var(--text-3)]">High ground</span><span className="mono">{(enc.highGroundPct * 100).toFixed(0)}%</span></div>
          <div className="flex justify-between"><span className="text-[var(--text-3)]">Humidity</span><span className="mono">{(enc.humidity * 100).toFixed(0)}%</span></div>
          <div className="flex justify-between"><span className="text-[var(--text-3)]">Temperature</span><span className="mono">{enc.temperature.toFixed(0)}°C</span></div>
        </div>
      </div>
    </div>
  );
}

function SecuritySection({ enc }) {
  return (
    <div>
      <div className="mono text-[10px] tracking-[0.2em] text-[var(--text-3)] mb-1.5">SECURITY</div>
      <div className="text-[11px] space-y-1">
        <div className="flex justify-between"><span className="text-[var(--text-3)]">Weakest barrier</span>
          <span className="mono" style={{ color: enc.minFenceTier === 0 ? 'var(--danger)' : undefined }}>{enc.minFenceTier > 0 ? FENCES[enc.minFenceTier].name : 'NONE'}</span></div>
        <div className="flex justify-between"><span className="text-[var(--text-3)]">Damaged segments</span>
          <span className="mono" style={{ color: enc.damagedSegments ? 'var(--danger)' : 'var(--success)' }}>{enc.damagedSegments}</span></div>
        <div className="flex justify-between"><span className="text-[var(--text-3)]">Feeders</span><span className="mono">{Object.keys(enc.feeders).join(', ') || 'none'}</span></div>
        <div className="flex justify-between"><span className="text-[var(--text-3)]">Shelters</span><span className="mono">{enc.shelters.length}</span></div>
      </div>
    </div>
  );
}

function ResidentsSection({ residents, bySpecies, pairs, onNavigate }) {
  return (
    <div>
      <div className="mono text-[10px] tracking-[0.2em] text-[var(--text-3)] mb-1.5">RESIDENTS ({residents.length})</div>
      {residents.length === 0 && <div className="text-[11px] text-[var(--text-3)]">Empty. Acquire creatures via Field Ops.</div>}
      <div className="space-y-1">
        {Object.entries(bySpecies).map(([sid, list]) => (
          <div key={sid}>
            <div className="text-[11px] font-medium text-[var(--text-2)]">{speciesById(sid).name} ×{list.length}</div>
            {list.map((c) => (
              <button key={c.id} onClick={() => onNavigate({ kind: 'creature', id: c.id })}
                className="w-full flex justify-between text-[11px] px-2 py-1 rounded hover:bg-[var(--panel-2)] transition-colors">
                <span className="text-[var(--text-3)]">{c.name}</span>
                <span className="mono" style={{ color: c.welfare > 0.65 ? 'var(--success)' : c.welfare > 0.4 ? 'var(--warning)' : 'var(--danger)' }}>{(c.welfare * 100).toFixed(0)}%</span>
              </button>
            ))}
          </div>
        ))}
      </div>
      {pairs.length > 0 && (
        <div className="mt-2 space-y-1">
          {pairs.map((p) => (
            <div key={p.a + p.b} className="text-[10px] flex items-center gap-1.5">
              {p.status === 'hostile' ? <AlertTriangle size={11} className="text-[var(--danger)]" /> : <span className="w-[11px]" />}
              <span className="text-[var(--text-3)]">{speciesById(p.a).name} + {speciesById(p.b).name}:</span>
              <span className={p.status === 'hostile' ? 'text-[var(--danger)]' : p.status === 'compatible' ? 'text-[var(--success)]' : 'text-[#ff8aa0] mono'}>
                {p.status === 'unknown' ? 'RELATIONSHIP UNKNOWN' : p.status.toUpperCase()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// cohabitation intel: only what the sim has actually learned (never raw species data)
function knownPairs(s, speciesIds) {
  const pairs = [];
  for (let i = 0; i < speciesIds.length; i++) {
    for (let j = i + 1; j < speciesIds.length; j++) {
      const a = speciesIds[i], b = speciesIds[j];
      pairs.push({ a, b, status: s.knowledge[a]?.compat?.[b] || 'unknown' });
    }
  }
  return pairs;
}

export default function EnclosurePanel({ id, tick, onNavigate }) {
  const s = game.state;
  const enc = computeEnclosures(s).enclosures.find((e) => e.id === id);
  const derived = useMemo(() => {
    if (!enc) return null;
    const residents = s.creatures.filter((c) => c.enclosureId === enc.id);
    const bySpecies = {};
    residents.forEach((c) => { bySpecies[c.speciesId] = (bySpecies[c.speciesId] || []).concat(c); });
    const mats = Object.entries(enc.matPct).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const pairs = knownPairs(s, Object.keys(bySpecies));
    return { residents, bySpecies, mats, pairs };
  }, [s, enc, tick]);

  if (!enc || !derived) return <div className="p-4 text-xs text-[var(--text-3)]">This area is no longer enclosed.</div>;

  return (
    <div className="flex flex-col gap-3 p-4" data-testid="enclosure-panel">
      <div>
        <div className="text-base font-semibold">Enclosure #{enc.id}</div>
        <div className="mono text-[10px] text-[var(--text-3)]">{enc.area} TILES · {enc.gates} GATE(S) · {enc.fenceSegments} SEGMENTS</div>
      </div>
      <CompositionSection enc={enc} mats={derived.mats} />
      <SecuritySection enc={enc} />
      <ResidentsSection residents={derived.residents} bySpecies={derived.bySpecies} pairs={derived.pairs} onNavigate={onNavigate} />
    </div>
  );
}
