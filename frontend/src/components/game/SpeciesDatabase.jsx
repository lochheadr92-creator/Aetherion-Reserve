import { useState, useEffect, useRef } from 'react';
import { Lock, Search, X } from 'lucide-react';
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

// ---------- roster filters ----------
// Families are grouped into four ecological classes for the chips (19 individual families would not
// fit the drawer). Locked species never leak their identity: text search and class chips only match
// catalogued entries; the tier chips match everyone because the tier is already visible on the row.
export const FAMILY_GROUPS = [
  { key: 'grazers', label: 'Grazers', test: /walker|browser|grazer|strider/i },
  { key: 'predators', label: 'Predators', test: /predator|hunter|stalker/i },
  { key: 'colossi', label: 'Colossi', test: /colossus|giant/i },
  { key: 'anomalous', label: 'Anomalous', test: /.*/ }, // everything else (lithomorphs, energivores, scuttlers, ...)
];
export const familyGroup = (species) => FAMILY_GROUPS.find((g) => g.test.test(species.family)).key;

export function filterRoster(s, list, { query = '', group = null, tiers = [] } = {}) {
  const q = query.trim().toLowerCase();
  return list.filter((sp) => {
    if (tiers.length && !tiers.includes(sp.tier)) return false;
    const unlocked = catalogued(s, sp);
    if (group && (!unlocked || familyGroup(sp) !== group)) return false;
    if (!q) return true;
    if (!unlocked) return `t${sp.tier}`.includes(q) || 'signal detected'.includes(q);
    return [sp.name, sp.family, sp.code, familyGroup(sp), `t${sp.tier}`].some((v) => String(v).toLowerCase().includes(q));
  });
}

const FILTER_CHIP = 'mono text-[9px] tracking-wide px-2 h-6 rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]';
const chipClass = (active) => `${FILTER_CHIP} ${active
  ? 'border-[var(--accent-cyan)] text-[var(--accent-cyan)] bg-[color-mix(in_srgb,var(--accent-cyan)_14%,transparent)]'
  : 'border-[var(--line-2)] text-[var(--text-3)] hover:text-[var(--text-1)] hover:border-[var(--text-3)]'}`;

function RosterFilters({ filters, setFilters, shown, total }) {
  const { query, group, tiers } = filters;
  const active = query.trim() || group || tiers.length > 0;
  const toggleTier = (t) => setFilters((f) => ({ ...f, tiers: f.tiers.includes(t) ? f.tiers.filter((x) => x !== t) : [...f.tiers, t].sort() }));
  return (
    <div className="sticky top-0 z-10 bg-[var(--panel)] border-b border-[var(--line)] px-2.5 pt-1.5 pb-1.5 flex flex-col gap-1" data-testid="species-roster-filters">
      <div className="relative">
        <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-3)] pointer-events-none" />
        <input
          data-testid="species-search-input"
          type="search"
          value={query}
          onChange={(e) => setFilters((f) => ({ ...f, query: e.target.value }))}
          onKeyDown={(e) => {
            // Esc while typing clears the query (then blurs) instead of closing the whole drawer
            if (e.key !== 'Escape') return;
            e.preventDefault(); e.stopPropagation();
            if (query) setFilters((f) => ({ ...f, query: '' })); else e.currentTarget.blur();
          }}
          placeholder="Search name, family, code…"
          aria-label="Search species"
          className="w-full h-7 pl-7 pr-7 text-[11px] rounded-md bg-[var(--panel-2)] border border-[var(--line)] text-[var(--text-1)] placeholder:text-[var(--text-3)] focus-visible:outline-none focus-visible:border-[var(--accent-cyan)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        />
        {query && (
          <button type="button" data-testid="species-search-clear" aria-label="Clear search" onClick={() => setFilters((f) => ({ ...f, query: '' }))}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded text-[var(--text-3)] hover:text-[var(--text-1)]">
            <X size={11} />
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Family filter">
        <button type="button" data-testid="species-filter-family-all" aria-pressed={!group} onClick={() => setFilters((f) => ({ ...f, group: null }))} className={chipClass(!group)}>ALL</button>
        {FAMILY_GROUPS.map((g) => (
          <button key={g.key} type="button" data-testid={`species-filter-family-${g.key}`} aria-pressed={group === g.key}
            onClick={() => setFilters((f) => ({ ...f, group: f.group === g.key ? null : g.key }))} className={chipClass(group === g.key)}>
            {g.label.toUpperCase()}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1" role="group" aria-label="Tier filter">
        {[1, 2, 3, 4].map((t) => (
          <button key={t} type="button" data-testid={`species-filter-tier-${t}`} aria-pressed={tiers.includes(t)} onClick={() => toggleTier(t)} className={chipClass(tiers.includes(t))}>T{t}</button>
        ))}
        <span className="ml-auto mono text-[9px] text-[var(--text-3)]" data-testid="species-roster-count">{shown}/{total}</span>
        {active && (
          <button type="button" data-testid="species-filter-clear" onClick={() => setFilters({ query: '', group: null, tiers: [] })}
            className="mono text-[9px] tracking-wide text-[var(--accent-cyan)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] rounded px-1">
            CLEAR
          </button>
        )}
      </div>
    </div>
  );
}

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
  const [filters, setFilters] = useState({ query: '', group: null, tiers: [] });
  const rows = filterRoster(s, SPECIES_LIST, filters);
  // the drawer roster is a short strip: keep the selected row in view (e.g. opened from a dossier)
  useEffect(() => {
    if (!compact) return;
    const row = ref.current?.querySelector('[data-selected="true"]');
    if (row) row.scrollIntoView({ block: 'nearest' });
  }, [sel, compact]);
  return (
    <div ref={ref} className="w-[300px] shrink-0 border-r border-[var(--line)] overflow-y-auto nl-scroll drawer:w-full drawer:max-h-[40%] drawer:border-r-0 drawer:border-b" data-testid="species-roster">
      <RosterFilters filters={filters} setFilters={setFilters} shown={rows.length} total={SPECIES_LIST.length} />
      {rows.map((x) => (
        <SpeciesListRow key={x.id} s={s} species={x} selected={sel === x.id} onSelect={onSelect} compact={compact} />
      ))}
      {rows.length === 0 && (
        <div className="px-3 py-6 flex flex-col items-center gap-2 text-center" data-testid="species-roster-empty">
          <Search size={18} className="text-[var(--text-3)]" />
          <div className="mono text-[10px] tracking-[0.2em] text-[var(--text-3)]">NO MATCHING RECORDS</div>
          <button type="button" data-testid="species-roster-empty-clear" onClick={() => setFilters({ query: '', group: null, tiers: [] })}
            className="nl-tool h-7 px-3 text-[11px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">Clear filters</button>
        </div>
      )}
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
