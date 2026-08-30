import { X, MapPin, Trash2, Wrench, LifeBuoy, BookOpen, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { game } from '@/game/controller';
import { useGameTick } from '@/components/game/useGame';
import { computeEnclosures, evaluateHabitat } from '@/game/enclosures';
import { getSpeciesView } from '@/game/knowledge';
import { speciesById } from '@/game/data/species';
import { BUILDINGS } from '@/game/data/buildings';
import { FENCES, MATERIALS, fmtMoney } from '@/game/constants';
import { demolishBuilding, repairFence, removeFence, toggleGate } from '@/game/construction';
import { recallCreature, removeCreature } from '@/game/creatures';
import { platformVisibilityReport } from '@/game/guests';
import { earn } from '@/game/economy';
import Portrait from '@/components/game/Portrait';

const ACTIVITY = {
  idle: 'Idling', wander: 'Roaming', seekWater: 'Heading to water', drinking: 'Drinking', seekSwim: 'Heading to water', swimming: 'Swimming',
  seekFood: 'Heading to feeder', eating: 'Feeding', seekGraze: 'Foraging', grazing: 'Grazing', seekFilterFeed: 'Drifting to water', filterFeeding: 'Filter feeding',
  resting: 'Resting', seekShelter: 'Heading to shelter', sheltering: 'Sheltering', seekTerrain: 'Seeking preferred ground', settling: 'Settling in',
  social: 'Approaching kin', seekSocial: 'Approaching kin', socialising: 'Socialising', hungry: 'HUNGRY — no reachable food source', thirsty: 'THIRSTY — no reachable water', flee: 'Fleeing',
};

const Bar = ({ label, value, color, testId, cause }) => (
  <div className="space-y-1" title={cause || `${label}: ${(value * 100).toFixed(0)}%`}>
    <div className="flex justify-between text-[11px]">
      <span className="text-[var(--text-2)]">{label}</span>
      <span className="mono text-[var(--text-3)]" data-testid={testId}>{(value * 100).toFixed(0)}%</span>
    </div>
    <div className="nl-bar-track">
      <div className="nl-bar-fill" style={{ width: `${value * 100}%`, background: color || (value > 0.65 ? 'var(--success)' : value > 0.4 ? 'var(--warning)' : 'var(--danger)') }} />
    </div>
  </div>
);

function CreaturePanel({ id, onNavigate, onOpenSpecies, onClose }) {
  const s = game.state;
  const c = s.creatures.find((q) => q.id === id);
  if (!c) { return <div className="p-4 text-xs text-[var(--text-3)]">Creature no longer present.</div>; }
  const sp = speciesById(c.speciesId);
  const view = getSpeciesView(s, c.speciesId);
  const enc = computeEnclosures(s).enclosures.find((e) => e.id === c.enclosureId);
  const habitat = evaluateHabitat(s, c, enc);

  const sell = () => {
    earn(s, sp.cost * 0.4, 'grants', `Transferred ${c.name} to partner facility`);
    removeCreature(s, c.id);
    toast.info(`${c.name} transferred (+${fmtMoney(sp.cost * 0.4)})`);
    onClose();
  };

  return (
    <div className="flex flex-col gap-3 p-4" data-testid="creature-panel">
      <div className="flex gap-3">
        <Portrait speciesId={sp.id} size={72} />
        <div className="min-w-0">
          <div className="text-base font-semibold text-[var(--text-1)]">{c.name}</div>
          <div className="mono text-[10px] text-[var(--text-3)]">{sp.code}</div>
          <div className="flex gap-1.5 mt-1.5 flex-wrap">
            <span className="text-[10px] px-2 py-0.5 rounded-full border border-[var(--line-2)] text-[var(--text-2)]">{view.level.label}</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full border border-[var(--line-2)] text-[var(--text-2)]">Danger {sp.danger}/5</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full border border-[var(--line-2)] text-[var(--text-2)]">{c.trait}</span>
          </div>
        </div>
      </div>

      {c.escaped && (
        <div className="flex items-center gap-2 rounded-lg border border-[rgba(255,77,109,0.5)] bg-[rgba(255,77,109,0.08)] px-3 py-2">
          <AlertTriangle size={14} className="text-[var(--danger)]" />
          <span className="text-xs text-[var(--danger)]">OUTSIDE CONTAINMENT</span>
          <button data-testid="recall-creature-button" onClick={() => { const r = recallCreature(s, c.id); if (!r.ok) toast.error(r.reason); }}
            className="ml-auto text-[11px] px-2 py-1 rounded bg-[var(--danger)] text-[#14060B] font-semibold hover:opacity-90">
            Recall ◈500
          </button>
        </div>
      )}

      <div className="text-[11px] mono text-[var(--accent-cyan)]">▸ {ACTIVITY[c.state] || c.state}</div>

      <div className="space-y-2">
        <Bar label="Welfare" value={c.welfare} testId="creature-welfare" />
        <Bar label="Stress" value={c.stress} color={c.stress > 0.6 ? 'var(--danger)' : 'var(--accent-violet)'} testId="creature-stress" />
        <div className="grid grid-cols-3 gap-2 pt-1">
          <Bar label="Food" value={c.needs.hunger} testId="creature-hunger" />
          <Bar label="Water" value={c.needs.thirst} testId="creature-thirst" />
          <Bar label="Rest" value={c.needs.energy} testId="creature-energy" />
        </div>
      </div>

      <div>
        <div className="mono text-[10px] tracking-[0.2em] text-[var(--text-3)] mb-2">ENVIRONMENT ({(habitat.overall * 100).toFixed(0)}%)</div>
        <div className="space-y-2">
          {habitat.factors.map((f) => (
            <div key={f.key}>
              <Bar label={f.label} value={f.score} />
              {f.score < 0.9 && (
                <div className={`text-[10px] mt-0.5 leading-snug ${f.masked ? 'text-[#ff8aa0] italic' : 'text-[var(--text-3)]'}`}>{f.cause}</div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="mono text-[10px] tracking-[0.2em] text-[var(--text-3)] mb-1.5">BIOLOGY</div>
        <div className="space-y-1 text-[11px]">
          {Object.entries(view.known).filter(([k]) => !k.startsWith('_')).map(([k, v]) => (
            <div key={k} className="flex gap-2"><span className="text-[var(--text-3)] capitalize w-20 shrink-0">{k}</span><span className="text-[var(--text-2)]">{v}</span></div>
          ))}
          {view.known._containmentEstimate && (
            <div className="flex gap-2"><span className="text-[var(--text-3)] w-20 shrink-0">Containment</span><span className="text-[var(--warning)]">{view.known._containmentEstimate}</span></div>
          )}
          {view.unknown.map((u) => (
            <div key={u} className="flex gap-2 items-center">
              <span className="text-[var(--text-3)] capitalize w-20 shrink-0">{u}</span>
              <span className="nl-redacted" data-testid={`unknown-${u}`}>UNKNOWN{view.hypotheses.includes(u) ? ' — HYPOTHESIS FORMING' : ''}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <button data-testid="creature-locate-button" onClick={() => onNavigate({ kind: 'creature', id: c.id })} className="nl-tool flex-1 h-8 text-[11px] flex items-center justify-center gap-1"><MapPin size={12} /> Locate</button>
        <button data-testid="creature-species-button" onClick={() => onOpenSpecies(sp.id)} className="nl-tool flex-1 h-8 text-[11px] flex items-center justify-center gap-1"><BookOpen size={12} /> Species</button>
        <button data-testid="creature-sell-button" onClick={sell} className="nl-tool flex-1 h-8 text-[11px] flex items-center justify-center gap-1 !text-[var(--danger)]"><Trash2 size={12} /> Transfer</button>
      </div>
    </div>
  );
}

function EnclosurePanel({ id, onNavigate }) {
  const s = game.state;
  const enc = computeEnclosures(s).enclosures.find((e) => e.id === id);
  if (!enc) return <div className="p-4 text-xs text-[var(--text-3)]">This area is no longer enclosed.</div>;
  const residents = s.creatures.filter((c) => c.enclosureId === enc.id);
  const bySpecies = {};
  residents.forEach((c) => { bySpecies[c.speciesId] = (bySpecies[c.speciesId] || []).concat(c); });
  const mats = Object.entries(enc.matPct).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const speciesIds = Object.keys(bySpecies);
  // cohabitation intel: only what the sim has actually learned
  const pairs = [];
  for (let i = 0; i < speciesIds.length; i++) for (let j = i + 1; j < speciesIds.length; j++) {
    const a = speciesIds[i], b = speciesIds[j];
    const known = s.knowledge[a]?.compat?.[b];
    pairs.push({ a, b, status: known || 'unknown' });
  }

  return (
    <div className="flex flex-col gap-3 p-4" data-testid="enclosure-panel">
      <div>
        <div className="text-base font-semibold">Enclosure #{enc.id}</div>
        <div className="mono text-[10px] text-[var(--text-3)]">{enc.area} TILES · {enc.gates} GATE(S) · {enc.fenceSegments} SEGMENTS</div>
      </div>

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
    </div>
  );
}

function BuildingPanel({ id, onClose }) {
  const s = game.state;
  const b = s.buildings.find((q) => q.id === id);
  if (!b) return <div className="p-4 text-xs text-[var(--text-3)]">Structure removed.</div>;
  const def = BUILDINGS[b.type];
  const visReport = def.viewRadius ? platformVisibilityReport(s, b) : null;
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
      {visReport && (
        <div>
          <div className="mono text-[10px] tracking-[0.2em] text-[var(--text-3)] mb-1.5">CURRENT VISIBILITY</div>
          {visReport.length === 0 && <div className="text-[11px] text-[var(--warning)]">No creatures visible from here right now.</div>}
          <div className="space-y-1">
            {visReport.slice(0, 6).map((v) => (
              <div key={v.creature.id} className="flex justify-between text-[11px]">
                <span className="text-[var(--text-2)]">{v.creature.name}</span>
                <span className="mono" data-testid="visibility-value" style={{ color: v.vis > 0.5 ? 'var(--success)' : 'var(--warning)' }}>{(v.vis * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <button data-testid="building-demolish-button" onClick={() => { demolishBuilding(s, b.id); toast.info(`${def.name} demolished (+${fmtMoney(def.cost * 0.5)})`); onClose(); }}
        className="nl-tool h-8 text-[11px] flex items-center justify-center gap-1 !text-[var(--danger)]"><Trash2 size={12} /> Demolish (50% refund)</button>
    </div>
  );
}

function FencePanel({ sel, onClose }) {
  const s = game.state;
  const f = s.fences[`${sel.x},${sel.y},${sel.d}`];
  if (!f) return <div className="p-4 text-xs text-[var(--text-3)]">Fence removed.</div>;
  const def = FENCES[f.tier];
  return (
    <div className="flex flex-col gap-3 p-4" data-testid="fence-panel">
      <div>
        <div className="text-base font-semibold">{def.name}{f.gate ? ' — Gate' : ''}</div>
        <div className="mono text-[10px] text-[var(--text-3)]">SECURITY TIER {def.security}</div>
      </div>
      <Bar label="Integrity" value={f.hp / def.hp} testId="fence-integrity" />
      <div className="flex gap-2">
        <button data-testid="fence-repair-button" onClick={() => { const r = repairFence(s, sel.x, sel.y, sel.d); if (!r.ok) toast.error(r.reason); else toast.success('Fence repaired'); }}
          className="nl-tool flex-1 h-8 text-[11px] flex items-center justify-center gap-1"><Wrench size={12} /> Repair</button>
        <button data-testid="fence-gate-button" onClick={() => { const r = toggleGate(s, sel.x, sel.y, sel.d); if (!r.ok) toast.error(r.reason); }}
          className="nl-tool flex-1 h-8 text-[11px] flex items-center justify-center gap-1"><LifeBuoy size={12} /> {f.gate ? 'Remove Gate' : 'Add Gate ◈150'}</button>
        <button data-testid="fence-remove-button" onClick={() => { removeFence(s, sel.x, sel.y, sel.d); onClose(); }}
          className="nl-tool flex-1 h-8 text-[11px] flex items-center justify-center gap-1 !text-[var(--danger)]"><Trash2 size={12} /> Remove</button>
      </div>
    </div>
  );
}

export default function InspectPanel({ selection, onClose, onNavigate, onOpenSpecies }) {
  useGameTick();
  const s = game.state;
  if (!s || !selection) return null;
  return (
    <div className="absolute right-3 top-16 bottom-3 w-[400px] z-30 pointer-events-none" data-testid="inspect-panel">
      <div className="nl-panel h-full flex flex-col pointer-events-auto overflow-hidden">
        <div className="nl-panel-header flex items-center justify-between px-3 py-2">
          <span className="mono text-[10px] tracking-[0.2em] text-[var(--text-3)]">
            {selection.kind === 'creature' ? 'ORGANISM DOSSIER' : selection.kind === 'enclosure' ? 'ENCLOSURE ANALYSIS' : selection.kind === 'building' ? 'STRUCTURE' : 'BARRIER SEGMENT'}
          </span>
          <button data-testid="inspect-panel-close-button" onClick={onClose} className="nl-tool w-7 h-7 flex items-center justify-center"><X size={13} /></button>
        </div>
        <div className="flex-1 overflow-y-auto nl-scroll">
          {selection.kind === 'creature' && <CreaturePanel id={selection.id} onNavigate={onNavigate} onOpenSpecies={onOpenSpecies} onClose={onClose} />}
          {selection.kind === 'enclosure' && <EnclosurePanel id={selection.id} onNavigate={onNavigate} />}
          {selection.kind === 'building' && <BuildingPanel id={selection.id} onClose={onClose} />}
          {selection.kind === 'fence' && <FencePanel sel={selection} onClose={onClose} />}
        </div>
      </div>
    </div>
  );
}
