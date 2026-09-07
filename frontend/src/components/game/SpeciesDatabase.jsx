import { useState, useEffect, useRef } from 'react';
import { Lock } from 'lucide-react';
import { game } from '@/game/controller';
import { useGameTick } from '@/components/game/useGame';
import { SPECIES_LIST, speciesById } from '@/game/data/species';
import { getSpeciesView, EVIDENCE_THRESHOLD, attrLabel } from '@/game/knowledge';
import { hasResearch } from '@/game/state';
import Portrait from '@/components/game/Portrait';
import { ScreenFrame, useScreenHost } from '@/components/game/ScreenFrame';

const tierUnlocked = (s, tier) => tier === 1 || (tier === 2 && hasResearch(s, 'ops_field2')) || (tier === 3 && hasResearch(s, 'ops_field3')) || (tier === 4 && hasResearch(s, 'ops_field4'));
// The archive catalogues a species once its acquisition tier is researched OR the park has ever
// held one (scenario-granted or expedition-recovered organisms are documented from the dossier).
const catalogued = (s, species) => tierUnlocked(s, species.tier)
  || s.creatures.some((c) => c.speciesId === species.id)
  || Object.values(s.lineage || {}).some((e) => e.speciesId === species.id);

const CHIP = 'text-[10px] px-2 py-0.5 rounded-full border border-[var(--line-2)] text-[var(--text-2)]';

// ---------- roster list (left column / stacked strip in the drawer) ----------

function SpeciesListRow({ s, species, selected, onSelect, compact }) {
  const unlocked = catalogued(s, species);
  const lvl = getSpeciesView(s, species.id).level;
  return (
    <button data-testid={`species-row-${species.id}`} onClick={() => onSelect(species.id)}
      data-selected={selected ? 'true' : 'false'}
      className="w-full flex items-center gap-3 px-3 py-2 drawer:gap-2.5 drawer:px-2.5 drawer:py-1.5 border-b border-l-2 border-[var(--line)] text-left hover:bg-[var(--panel-2)] transition-colors focus-visible:outline-none focus-visible:bg-[var(--panel-2)]"
      style={{ background: selected ? 'var(--panel-2)' : undefined, borderLeftColor: selected ? 'var(--accent-cyan)' : 'transparent' }}>
      <div className="relative shrink-0">
        <Portrait speciesId={species.id} size={compact ? 36 : 44} className={unlocked ? '' : 'opacity-30'} />
        {!unlocked && <Lock size={13} className="absolute inset-0 m-auto text-[var(--text-3)]" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium truncate" style={{ color: unlocked ? 'var(--text-1)' : 'var(--text-3)' }}>{unlocked ? species.name : 'SIGNAL DETECTED'}</div>
        <div className="mono text-[9px] text-[var(--text-3)] truncate">{unlocked ? `${species.family} · T${species.tier}` : `Requires Field Operations ${species.tier === 2 ? 'II' : species.tier === 3 ? 'III' : 'IV'}`}</div>
      </div>
      {unlocked && (
        <div className="mono text-[9px] shrink-0" style={{ color: lvl.pct === 1 ? 'var(--success)' : 'var(--text-3)' }}>{(lvl.pct * 100).toFixed(0)}%</div>
      )}
    </button>
  );
}

function SpeciesList({ s, sel, onSelect }) {
  const compact = useScreenHost() === 'drawer';
  const ref = useRef(null);
  // the drawer roster is a short strip: keep the selected row in view (e.g. opened from a dossier)
  useEffect(() => {
    if (!compact) return;
    const row = ref.current?.querySelector('[data-selected="true"]');
    if (row) row.scrollIntoView({ block: 'nearest' });
  }, [sel, compact]);
  return (
    <div ref={ref} className="w-[300px] shrink-0 border-r border-[var(--line)] overflow-y-auto nl-scroll drawer:w-full drawer:max-h-[38%] drawer:border-r-0 drawer:border-b">
      {SPECIES_LIST.map((x) => (
        <SpeciesListRow key={x.id} s={s} species={x} selected={sel === x.id} onSelect={onSelect} compact={compact} />
      ))}
    </div>
  );
}

// ---------- detail sections (right column / lower pane in the drawer) ----------

function LockedDetail() {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-3 text-center">
      <Lock size={40} className="text-[var(--text-3)]" />
      <div className="mono text-xs text-[var(--text-3)] tracking-widest">UNRESOLVED BIOSIGNAL</div>
      <div className="text-sm text-[var(--text-2)] max-w-[380px]">Deep-zone survey teams report an uncatalogued organism. Complete Field Operations research to authorise recovery.</div>
    </div>
  );
}

function SpeciesHeader({ sp, view, owned }) {
  const complete = view.level.pct === 1;
  return (
    <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-x-4 gap-y-2 drawer:gap-x-3">
      <Portrait speciesId={sp.id} size={110} className="row-span-2 drawer:row-span-1" />
      <div className="min-w-0">
        <div className="text-xl font-semibold leading-tight drawer:text-base">{sp.name}</div>
        <div className="mono text-[11px] text-[var(--accent-cyan)]">{sp.code}</div>
        <div className="mt-2">
          <span className="inline-block text-[10px] px-2 py-1 rounded border whitespace-nowrap" style={{
            borderColor: complete ? 'rgba(62,226,138,0.4)' : 'var(--line-2)',
            color: complete ? 'var(--success)' : 'var(--text-2)',
          }} data-testid="knowledge-level">{view.level.label.toUpperCase()} · {(view.level.pct * 100).toFixed(0)}%</span>
        </div>
      </div>
      <div className="flex gap-1.5 flex-wrap self-start drawer:col-span-2">
        <span className={CHIP}>{sp.family}</span>
        <span className={CHIP}>{sp.rarity}</span>
        <span className={CHIP} style={{ color: sp.danger >= 4 ? 'var(--danger)' : sp.danger >= 3 ? 'var(--warning)' : undefined }}>Danger {sp.danger}/5</span>
        <span className={CHIP}>Appeal {sp.appeal}</span>
        <span className={CHIP}>In park: {owned}</span>
      </div>
    </div>
  );
}

function DocumentedBiology({ view, knownEntries }) {
  return (
    <div className="grid grid-cols-2 gap-x-8 gap-y-2 drawer:grid-cols-1 drawer:gap-y-2.5">
      <div className="col-span-2 drawer:col-span-1 mono text-[10px] tracking-[0.2em] text-[var(--text-3)]">DOCUMENTED BIOLOGY</div>
      {knownEntries.map(([key, v]) => (
        <div key={key} className="text-[12px] min-w-0">
          <div className="text-[var(--text-3)] capitalize text-[10px] mono tracking-wider">{attrLabel(key).toUpperCase()}</div>
          <div className="text-[var(--text-1)]">{v}</div>
        </div>
      ))}
      {view.known._containmentEstimate && (
        <div className="text-[12px] min-w-0">
          <div className="text-[var(--text-3)] text-[10px] mono tracking-wider">CONTAINMENT (ESTIMATE)</div>
          <div className="text-[var(--warning)]">{view.known._containmentEstimate}</div>
        </div>
      )}
    </div>
  );
}

function UndocumentedSection({ view, knowledge }) {
  if (!view.unknown.length) return null;
  return (
    <div>
      <div className="mono text-[10px] tracking-[0.2em] text-[var(--text-3)] mb-2">UNDOCUMENTED — OBSERVE TO LEARN</div>
      <div className="space-y-2 drawer:space-y-3">
        {view.unknown.map((u) => {
          const ev = Math.min(1, (knowledge.evidence[u] || 0) / EVIDENCE_THRESHOLD);
          return (
            <div key={u} className="flex items-center gap-3 drawer:flex-wrap drawer:gap-x-2 drawer:gap-y-1.5">
              <span className="nl-redacted w-44 shrink-0 drawer:w-full drawer:text-center" data-testid={`db-unknown-${u}`}>{attrLabel(u).toUpperCase()}: UNKNOWN</span>
              <div className="nl-bar-track flex-1 min-w-[60px]">
                <div className="nl-bar-fill" style={{ width: `${ev * 100}%`, background: 'var(--accent-rose)' }} />
              </div>
              <span className="mono text-[9px] text-[var(--text-3)] w-24 drawer:w-auto shrink-0">{ev >= 0.5 ? 'HYPOTHESIS FORMING' : 'evidence ' + (ev * 100).toFixed(0) + '%'}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RelationshipsSection({ knowledge }) {
  const entries = Object.entries(knowledge.compat || {});
  return (
    <div>
      <div className="mono text-[10px] tracking-[0.2em] text-[var(--text-3)] mb-2">KNOWN RELATIONSHIPS</div>
      {entries.length === 0 ? (
        <div className="text-[11px] text-[var(--text-3)]">No confirmed cohabitation data. House species together (carefully) to learn.</div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {entries.map(([oid, status]) => (
            <span key={oid} className="text-[10px] px-2 py-1 rounded border" style={{
              borderColor: status === 'hostile' ? 'rgba(255,77,109,0.5)' : 'rgba(62,226,138,0.4)',
              color: status === 'hostile' ? 'var(--danger)' : 'var(--success)',
            }}>{speciesById(oid).name}: {status.toUpperCase()}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function SpeciesDetail({ sp, view, knownEntries, knowledge, owned }) {
  return (
    <div className="space-y-5 drawer:space-y-4">
      <SpeciesHeader sp={sp} view={view} owned={owned} />
      <div className="text-[13px] text-[var(--text-2)] italic leading-relaxed border-l-2 border-[var(--line-2)] pl-3 drawer:text-[12px]">{sp.lore}</div>
      <div className="text-[12px] text-[var(--accent-violet)]">Field note: {sp.question}</div>
      <DocumentedBiology view={view} knownEntries={knownEntries} />
      <UndocumentedSection view={view} knowledge={knowledge} />
      <RelationshipsSection knowledge={knowledge} />
      <div className="flex gap-1.5 flex-wrap">
        {sp.traits.map((t) => <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--panel-2)] border border-[var(--line)] text-[var(--text-3)]">{t}</span>)}
      </div>
    </div>
  );
}

// ---------- screen ----------

export default function SpeciesDatabase({ initialSpecies, onClose }) {
  useGameTick();
  const compact = useScreenHost() === 'drawer';
  const s = game.state;
  const [sel, setSel] = useState(initialSpecies || SPECIES_LIST[0].id);
  // The component re-renders exactly once per game tick (via useGameTick), and the
  // view must reflect live sim state each tick — so we compute per render, no memo.
  const view = s ? getSpeciesView(s, sel) : null;
  const knownEntries = view ? Object.entries(view.known).filter(([key]) => !key.startsWith('_')) : [];
  if (!s || !view) return null;
  const sp = speciesById(sel);
  const unlocked = catalogued(s, sp);
  const owned = s.creatures.filter((c) => c.speciesId === sel).length;
  const knowledge = s.knowledge[sel] || { evidence: {}, compat: {} };

  return (
    <ScreenFrame
      testId="species-database-modal"
      closeTestId="species-db-close-button"
      onClose={onClose}
      eyebrow="AETHERION BIOLOGICAL ARCHIVE"
      subtitle={compact ? null : 'Species Database — knowledge is earned through observation'}
      size="w-[1060px] h-[80vh]"
      scroll={false}
      bodyClassName="drawer:flex-col"
    >
      <SpeciesList s={s} sel={sel} onSelect={setSel} />
      <div className="flex-1 min-w-0 min-h-0 overflow-y-auto nl-scroll p-5 drawer:p-3" data-testid="species-detail">
        {!unlocked
          ? <LockedDetail />
          : <SpeciesDetail sp={sp} view={view} knownEntries={knownEntries} knowledge={knowledge} owned={owned} />}
      </div>
    </ScreenFrame>
  );
}
