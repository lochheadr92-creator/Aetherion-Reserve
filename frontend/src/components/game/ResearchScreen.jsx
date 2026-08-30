import { X, FlaskConical, Check, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { game } from '@/game/controller';
import { useGameTick } from '@/components/game/useGame';
import { RESEARCH_LIST, RESEARCH } from '@/game/data/research';
import { startResearch } from '@/game/sim';
import { fmtMoney } from '@/game/constants';

// ---------- pure helpers ----------

// Group static projects by category and append dynamic field studies.
function groupProjects(s) {
  const cats = {};
  RESEARCH_LIST.forEach((r) => { cats[r.cat] = (cats[r.cat] || []).concat(r); });
  if (s.research.dynamicProjects.length) cats['Field Studies'] = s.research.dynamicProjects;
  return cats;
}

// Derive the display state of one research card.
function cardState(s, r, active) {
  const done = s.research.completed.includes(r.id);
  const isActive = active?.id === r.id;
  const prereqMissing = !!(r.requires && !r.requires.every((q) => s.research.completed.includes(q)));
  let evidenceMissing = false;
  if (r.requiresEvidence) {
    const k = s.knowledge[r.requiresEvidence.speciesId];
    evidenceMissing = !(k && (Object.keys(k.evidence).length > 0 || Object.keys(k.discovered).length > 0));
  }
  return { done, isActive, prereqMissing, evidenceMissing, locked: prereqMissing || evidenceMissing };
}

// ---------- sub-components ----------

function ProgressBar({ active }) {
  return (
    <div className="nl-bar-track">
      <div className="nl-bar-fill" style={{ width: `${(active.progress / active.total) * 100}%`, background: 'var(--accent-cyan)' }} />
    </div>
  );
}

function ActiveProjectChip({ active, activeDef }) {
  if (!active || !activeDef) return null;
  const pct = (active.progress / active.total) * 100;
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[rgba(45,226,230,0.4)] bg-[rgba(45,226,230,0.06)]">
      <FlaskConical size={13} className="text-[var(--accent-cyan)]" />
      <span className="text-xs">{activeDef.name}</span>
      <div className="nl-bar-track w-28">
        <div className="nl-bar-fill" style={{ width: `${pct}%`, background: 'var(--accent-cyan)' }} />
      </div>
      <span className="mono text-[10px] text-[var(--text-3)]" data-testid="active-research-progress">{pct.toFixed(0)}%</span>
    </div>
  );
}

function CardStatusIcon({ state }) {
  if (state.done) return <Check size={14} className="text-[var(--success)]" />;
  if (state.locked) return <Lock size={12} className="text-[var(--text-3)]" />;
  return null;
}

function ResearchCard({ s, r, active, hasLab, onBegin }) {
  const state = cardState(s, r, active);
  return (
    <div data-testid={`research-card-${r.id}`}
      className="rounded-lg border p-3 space-y-1.5"
      style={{
        borderColor: state.done ? 'rgba(62,226,138,0.35)' : state.isActive ? 'rgba(45,226,230,0.45)' : 'var(--line)',
        background: 'var(--panel-2)',
        opacity: state.locked ? 0.65 : 1,
      }}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-[var(--text-1)]">{r.name}</span>
        <CardStatusIcon state={state} />
      </div>
      <div className="text-[11px] text-[var(--text-3)] leading-snug">{r.desc}</div>
      {state.evidenceMissing && <div className="text-[10px] text-[#ff8aa0] mono">{r.requiresEvidence.note}</div>}
      {!state.done && !state.isActive && (
        <div className="flex items-center justify-between pt-1">
          <span className="mono text-[10px] text-[var(--text-3)]">{fmtMoney(r.cost)} · {r.time}s</span>
          <button data-testid={`research-start-${r.id}`}
            disabled={state.locked || !hasLab || !!active}
            onClick={() => onBegin(r.id)}
            className="text-[10px] px-2.5 py-1 rounded font-semibold disabled:opacity-40 transition-colors"
            style={{ background: 'var(--accent-cyan)', color: '#061014' }}>
            START
          </button>
        </div>
      )}
      {state.isActive && <ProgressBar active={active} />}
    </div>
  );
}

function CategoryColumn({ s, cat, list, active, hasLab, onBegin }) {
  return (
    <div className="space-y-2">
      <div className="mono text-[10px] tracking-[0.2em] text-[var(--text-3)]">{cat.toUpperCase()}</div>
      {list.map((r) => (
        <ResearchCard key={r.id} s={s} r={r} active={active} hasLab={hasLab} onBegin={onBegin} />
      ))}
    </div>
  );
}

// ---------- screen ----------

export default function ResearchScreen({ onClose }) {
  useGameTick();
  const s = game.state;
  if (!s) return null;
  const hasLab = s.buildings.some((b) => b.type === 'lab');
  const active = s.research.active;
  const activeDef = active ? (RESEARCH[active.id] || s.research.dynamicProjects.find((p) => p.id === active.id)) : null;
  const cats = groupProjects(s);

  const begin = (id) => {
    const r = startResearch(s, id);
    if (!r.ok) toast.error(r.reason);
    else toast.success('Research project started');
  };

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center" style={{ background: 'rgba(5,7,11,0.8)' }} data-testid="research-modal">
      <div className="nl-panel w-[1100px] max-w-[95vw] h-[80vh] flex flex-col overflow-hidden">
        <div className="nl-panel-header flex items-center justify-between px-4 py-3">
          <div>
            <div className="mono text-[10px] tracking-[0.25em] text-[var(--accent-cyan)]">RESEARCH DIVISION</div>
            <div className="text-sm text-[var(--text-2)] mt-0.5">
              {hasLab ? 'One active project at a time. Field studies emerge from real observations.' : 'NO LABORATORY — build a Research Laboratory to begin.'}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ActiveProjectChip active={active} activeDef={activeDef} />
            <button data-testid="research-close-button" onClick={onClose} className="nl-tool w-8 h-8 flex items-center justify-center"><X size={15} /></button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto nl-scroll p-4 grid grid-cols-3 gap-4 content-start">
          {Object.entries(cats).map(([cat, list]) => (
            <CategoryColumn key={cat} s={s} cat={cat} list={list} active={active} hasLab={hasLab} onBegin={begin} />
          ))}
        </div>
      </div>
    </div>
  );
}
