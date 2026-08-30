import { MapPin, Trash2, BookOpen, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { game } from '@/game/controller';
import { computeEnclosures, evaluateHabitat } from '@/game/enclosures';
import { getSpeciesView } from '@/game/knowledge';
import { speciesById } from '@/game/data/species';
import { fmtMoney } from '@/game/constants';
import { recallCreature, removeCreature } from '@/game/creatures';
import { earn } from '@/game/economy';
import Portrait from '@/components/game/Portrait';
import Bar from '@/components/game/panels/Bar';

export const ACTIVITY = {
  idle: 'Idling', wander: 'Roaming', seekWater: 'Heading to water', drinking: 'Drinking', seekSwim: 'Heading to water', swimming: 'Swimming',
  seekFood: 'Heading to feeder', eating: 'Feeding', seekGraze: 'Foraging', grazing: 'Grazing', seekFilterFeed: 'Drifting to water', filterFeeding: 'Filter feeding',
  resting: 'Resting', seekShelter: 'Heading to shelter', sheltering: 'Sheltering', seekTerrain: 'Seeking preferred ground', settling: 'Settling in',
  social: 'Approaching kin', seekSocial: 'Approaching kin', socialising: 'Socialising', hungry: 'HUNGRY — no reachable food source', thirsty: 'THIRSTY — no reachable water', flee: 'Fleeing',
};

function TraitChips({ view, sp, trait }) {
  return (
    <div className="flex gap-1.5 mt-1.5 flex-wrap">
      <span className="text-[10px] px-2 py-0.5 rounded-full border border-[var(--line-2)] text-[var(--text-2)]">{view.level.label}</span>
      <span className="text-[10px] px-2 py-0.5 rounded-full border border-[var(--line-2)] text-[var(--text-2)]">Danger {sp.danger}/5</span>
      <span className="text-[10px] px-2 py-0.5 rounded-full border border-[var(--line-2)] text-[var(--text-2)]">{trait}</span>
    </div>
  );
}

function EscapeBanner({ creature }) {
  const recall = () => {
    const r = recallCreature(game.state, creature.id);
    if (!r.ok) toast.error(r.reason);
  };
  return (
    <div className="flex items-center gap-2 rounded-lg border border-[rgba(255,77,109,0.5)] bg-[rgba(255,77,109,0.08)] px-3 py-2">
      <AlertTriangle size={14} className="text-[var(--danger)]" />
      <span className="text-xs text-[var(--danger)]">OUTSIDE CONTAINMENT</span>
      <button
        data-testid="recall-creature-button"
        onClick={recall}
        className="ml-auto text-[11px] px-2 py-1 rounded bg-[var(--danger)] text-[#14060B] font-semibold hover:opacity-90"
      >
        Recall ◈500
      </button>
    </div>
  );
}

function HabitatFactors({ habitat }) {
  return (
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
  );
}

function BiologySection({ view, knownEntries }) {
  return (
    <div>
      <div className="mono text-[10px] tracking-[0.2em] text-[var(--text-3)] mb-1.5">BIOLOGY</div>
      <div className="space-y-1 text-[11px]">
        {knownEntries.map(([k, v]) => (
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
  );
}

// Biology entries the player has actually confirmed (private "_" keys are UI hints).
function knownBiologyEntries(view) {
  return view ? Object.entries(view.known).filter(([key]) => !key.startsWith('_')) : [];
}

export default function CreaturePanel({ id, onNavigate, onOpenSpecies, onClose }) {
  const s = game.state;
  const c = s.creatures.find((q) => q.id === id);
  const view = c ? getSpeciesView(s, c.speciesId) : null;
  const knownEntries = knownBiologyEntries(view);
  if (!c || !view) return <div className="p-4 text-xs text-[var(--text-3)]">Creature no longer present.</div>;

  const sp = speciesById(c.speciesId);
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
          <div className="text-base font-semibold text-[var(--text-1)] flex items-center gap-2">
            {c.name}
            {c.juvenile && (
              <span data-testid="creature-juvenile-badge"
                className="mono text-[9px] tracking-[0.15em] px-1.5 py-0.5 rounded border"
                style={{ borderColor: 'var(--accent-seaglass)', color: 'var(--accent-seaglass)' }}>
                JUVENILE {Math.round((c.growth || 0) * 100)}%
              </span>
            )}
            {c.cloaked && (
              <span data-testid="creature-cloaked-badge"
                className="mono text-[9px] tracking-[0.15em] px-1.5 py-0.5 rounded border"
                style={{ borderColor: 'var(--accent-violet)', color: 'var(--accent-violet)' }}>
                CLOAKED
              </span>
            )}
          </div>
          <div className="mono text-[10px] text-[var(--text-3)]">{sp.code}</div>
          <TraitChips view={view} sp={sp} trait={c.trait} />
        </div>
      </div>

      {c.escaped && <EscapeBanner creature={c} />}

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

      <HabitatFactors habitat={habitat} />
      <BiologySection view={view} knownEntries={knownEntries} />

      <div className="flex gap-2 pt-1">
        <button data-testid="creature-locate-button" onClick={() => onNavigate({ kind: 'creature', id: c.id })} className="nl-tool flex-1 h-8 text-[11px] flex items-center justify-center gap-1"><MapPin size={12} /> Locate</button>
        <button data-testid="creature-species-button" onClick={() => onOpenSpecies(sp.id)} className="nl-tool flex-1 h-8 text-[11px] flex items-center justify-center gap-1"><BookOpen size={12} /> Species</button>
        <button data-testid="creature-sell-button" onClick={sell} className="nl-tool flex-1 h-8 text-[11px] flex items-center justify-center gap-1 !text-[var(--danger)]"><Trash2 size={12} /> Transfer</button>
      </div>
    </div>
  );
}
