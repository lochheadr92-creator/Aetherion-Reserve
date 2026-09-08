import { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { MapPin, GitBranch, Dna, ShieldCheck, ShieldAlert } from 'lucide-react';
import { game } from '@/game/controller';
import { speciesById } from '@/game/data/species';
import { familyTree, pairingOutlook } from '@/game/lineage';
import { MORPHS } from '@/game/genetics';
import { useGameTick } from '@/components/game/useGame';
import { ScreenFrame, useScreenHost } from '@/components/game/ScreenFrame';

// ---- Bloodline Ledger: family tree + pairing outlook for one organism ----
// Read-only view over state.lineage (permanent registry) and living creatures.
// Hosted natively in the Ops Deck drawer (id 'ledger'); in the legacy HUD it is a portal modal.

const MORPH_BY_ID = Object.fromEntries(MORPHS.map((m) => [m.id, m]));

const STATUS_META = {
  park: { label: 'IN PARK', color: 'var(--accent-seaglass)' },
  transferred: { label: 'TRANSFERRED', color: 'var(--text-3)' },
  deceased: { label: 'DECEASED', color: 'var(--danger)' }, // tension pass: neglect or a fatal conflict
  unknown: { label: 'WILD / UNTRACKED', color: 'var(--text-3)' },
};
const AWAY_SUFFIX = { transferred: ' · away', deceased: ' · deceased', unknown: ' · away' };

function statusOf(e) {
  return STATUS_META[e?.status] || STATUS_META.unknown;
}

function genLabel(e) {
  if (!e || e.gen == null) return 'Origin unknown';
  return e.gen === 0 ? 'Gen 0 · wild-recovered' : `Gen ${e.gen} · park-bred`;
}

const NODE_W = 'w-[150px] drawer:w-[128px]';
const SUBJECT_W = 'w-[150px] drawer:w-[220px]'; // the subject sits alone in its tier, so it can use the width

// A single person-card in the tree. Living organisms can be located on the map.
function Node({ entry, role, highlight = false, onLocate, testId }) {
  const width = highlight ? SUBJECT_W : NODE_W;
  if (!entry) {
    return (
      <div className={`${width} rounded-lg border border-dashed border-[var(--line)] px-3 py-2 text-center`} data-testid={testId}>
        <div className="mono text-[9px] tracking-[0.15em] text-[var(--text-3)]">{role}</div>
        <div className="text-[11px] text-[var(--text-3)] mt-0.5">— wild origin —</div>
      </div>
    );
  }
  const st = statusOf(entry);
  const morph = entry.morph ? MORPH_BY_ID[entry.morph] : null;
  const alive = entry.status === 'park';
  return (
    <button type="button" data-testid={testId} disabled={!alive}
      onClick={() => alive && onLocate(entry.id)}
      className={`${width} rounded-lg border px-3 py-2 drawer:px-2.5 text-left ${highlight ? 'border-[var(--accent-cyan)] bg-[rgba(45,226,230,0.08)]' : 'border-[var(--line)] bg-[var(--panel-2)]'} ${alive ? 'hover:border-[var(--accent-cyan)] cursor-pointer' : 'cursor-default'}`}
      style={morph ? { boxShadow: `0 0 10px ${morph.glow}33` } : undefined}
      title={alive ? `${entry.name} — locate on the map` : entry.name}>
      <div className="mono text-[9px] tracking-[0.15em] text-[var(--text-3)] truncate" title={role}>{role}</div>
      <div className="text-[12px] font-semibold text-[var(--text-1)] truncate flex items-center gap-1.5">
        {morph && <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ background: morph.glow, boxShadow: `0 0 6px ${morph.glow}` }} />}
        {entry.name}
      </div>
      <div className="mono text-[9px] text-[var(--text-2)] mt-0.5">{genLabel(entry)}</div>
      <div className="flex items-center gap-1.5 mt-1">
        <span className="mono text-[8px] tracking-[0.12em] px-1 py-px rounded border" data-testid={testId ? `${testId}-status` : undefined} data-status={entry.status} style={{ color: st.color, borderColor: st.color }}>{st.label}</span>
        {entry.inbreed >= 0.25 && <span className="mono text-[8px] tracking-[0.12em] px-1 py-px rounded border border-[var(--danger)] text-[var(--danger)]">INBRED</span>}
        {alive && <MapPin size={9} className="ml-auto text-[var(--text-3)]" />}
      </div>
    </button>
  );
}

function Tier({ label, children, testId }) {
  return (
    <div className="flex flex-col items-center gap-1.5" data-testid={testId}>
      <div className="mono text-[9px] tracking-[0.25em] text-[var(--text-3)]">{label}</div>
      <div className="flex gap-3 drawer:gap-2 justify-center flex-wrap">{children}</div>
    </div>
  );
}

const Connector = () => <div className="w-px h-4 bg-[var(--line-2)] mx-auto" aria-hidden="true" />;

function ChipList({ label, entries, onLocate, testId }) {
  if (!entries.length) return null;
  return (
    <div className="flex items-center gap-2 flex-wrap justify-center" data-testid={testId}>
      <span className="mono text-[9px] tracking-[0.2em] text-[var(--text-3)]">{label}</span>
      {entries.map((e) => (
        <button key={e.id} type="button" disabled={e.status !== 'park'} onClick={() => onLocate(e.id)}
          data-status={e.status}
          className={`text-[10px] px-2 py-0.5 rounded-full border ${e.status === 'park' ? 'border-[var(--line-2)] text-[var(--text-2)] hover:border-[var(--accent-cyan)]' : e.status === 'deceased' ? 'border-[rgba(255,77,109,0.4)] text-[var(--text-3)] line-through decoration-[var(--danger)]' : 'border-[var(--line)] text-[var(--text-3)]'}`}>
          {e.name}{e.status !== 'park' ? (AWAY_SUFFIX[e.status] || ' · away') : ''}
        </button>
      ))}
    </div>
  );
}

function OffspringTier({ tree, onLocate }) {
  if (!tree.offspring.length) {
    return (
      <Tier label="OFFSPRING" testId="ledger-offspring">
        <div className="text-[11px] text-[var(--text-3)] py-1">No offspring recorded yet.</div>
      </Tier>
    );
  }
  const L = game.state.lineage || {};
  return (
    <Tier label={`OFFSPRING · ${tree.offspring.length}`} testId="ledger-offspring">
      {tree.offspring.map((o) => (
        <Node key={o.id} entry={o} role={`× ${L[o.mateId]?.name || 'unknown mate'}`} onLocate={onLocate} testId={`ledger-offspring-${o.id}`} />
      ))}
    </Tier>
  );
}

function FamilyTreeView({ tree, onLocate }) {
  const hasParents = !!(tree.mother || tree.father);
  return (
    <div className="space-y-1" data-testid="ledger-tree">
      {hasParents && (
        <>
          <Tier label="GRANDPARENTS" testId="ledger-grandparents">
            <Node entry={tree.grand[0][0]} role="MATERNAL DAM" onLocate={onLocate} testId="ledger-gp-mm" />
            <Node entry={tree.grand[0][1]} role="MATERNAL SIRE" onLocate={onLocate} testId="ledger-gp-mf" />
            <Node entry={tree.grand[1][0]} role="PATERNAL DAM" onLocate={onLocate} testId="ledger-gp-fm" />
            <Node entry={tree.grand[1][1]} role="PATERNAL SIRE" onLocate={onLocate} testId="ledger-gp-ff" />
          </Tier>
          <Connector />
          <Tier label="PARENTS" testId="ledger-parents">
            <Node entry={tree.mother} role="DAM" onLocate={onLocate} testId="ledger-mother" />
            <Node entry={tree.father} role="SIRE" onLocate={onLocate} testId="ledger-father" />
          </Tier>
        </>
      )}
      {!hasParents && (
        <Tier label="ORIGIN" testId="ledger-parents">
          <div className="rounded-lg border border-dashed border-[var(--line)] px-4 py-2 text-center" data-testid="ledger-wild-origin">
            <div className="text-[11px] text-[var(--text-2)]">Wild-recovered founder</div>
            <div className="mono text-[9px] text-[var(--text-3)] mt-0.5">No recorded ancestry — fresh blood for the line</div>
          </div>
        </Tier>
      )}
      <Connector />
      <Tier label="SUBJECT" testId="ledger-subject-tier">
        <Node entry={tree.me} role="THIS ORGANISM" highlight onLocate={onLocate} testId="ledger-subject" />
      </Tier>
      <ChipList label="SIBLINGS" entries={tree.siblings} onLocate={onLocate} testId="ledger-siblings" />
      <ChipList label="HALF-SIBLINGS" entries={tree.halfSiblings} onLocate={onLocate} testId="ledger-half-siblings" />
      <Connector />
      <OffspringTier tree={tree} onLocate={onLocate} />
    </div>
  );
}

function Verdict({ row }) {
  if (row.juvenile) return <span className="mono text-[9px] tracking-[0.12em] text-[var(--text-3)]">MATURES FIRST</span>;
  return row.safe
    ? <span className="mono text-[9px] tracking-[0.12em] text-[var(--success)] flex items-center gap-1"><ShieldCheck size={10} /> SAFE PAIRING</span>
    : <span className="mono text-[9px] tracking-[0.12em] text-[var(--danger)] flex items-center gap-1"><ShieldAlert size={10} /> INBRED RISK</span>;
}

function CandidateName({ r, onLocate }) {
  return (
    <button type="button" onClick={() => onLocate(r.id)} className="text-[var(--text-1)] hover:text-[var(--accent-cyan)] flex items-center gap-1 min-w-0">
      <span className="truncate">{r.name}</span> <span className="mono text-[9px] text-[var(--text-3)] shrink-0">G{r.gen}</span>
    </button>
  );
}

const locationLabel = (r) => `${r.sameEnclosure ? 'Same enclosure' : 'Elsewhere'}${r.ready ? '' : ' · not ready'}`;

// wide host: five-column table
function PairingTable({ rows, onLocate }) {
  return (
    <table className="w-full text-[11px]">
      <thead>
        <tr className="mono text-[9px] tracking-[0.15em] text-[var(--text-3)] text-left">
          <th className="py-1 font-normal">CANDIDATE</th>
          <th className="py-1 font-normal">RELATION</th>
          <th className="py-1 font-normal">PROJECTED INBREEDING</th>
          <th className="py-1 font-normal">LOCATION</th>
          <th className="py-1 font-normal">VERDICT</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className="border-t border-[var(--line)]" data-testid={`ledger-candidate-${r.id}`} data-safe={r.safe ? 'true' : 'false'}>
            <td className="py-1.5 pr-2"><CandidateName r={r} onLocate={onLocate} /></td>
            <td className="py-1.5 pr-2 text-[var(--text-2)]">{r.relation}</td>
            <td className="py-1.5 pr-2 mono" style={{ color: r.safe ? 'var(--text-2)' : 'var(--danger)' }}>{Math.round(r.inbreed * 100)}%</td>
            <td className="py-1.5 pr-2 text-[var(--text-2)]">{locationLabel(r)}</td>
            <td className="py-1.5"><Verdict row={r} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// drawer host: one card per candidate (same testids / data-safe / text as the table)
function PairingCards({ rows, onLocate }) {
  return (
    <div className="space-y-1.5">
      {rows.map((r) => (
        <div key={r.id} className="rounded-lg border border-[var(--line)] bg-[var(--panel-2)] px-2.5 py-2 space-y-1 text-[11px]"
          data-testid={`ledger-candidate-${r.id}`} data-safe={r.safe ? 'true' : 'false'}>
          <div className="flex items-center justify-between gap-2">
            <CandidateName r={r} onLocate={onLocate} />
            <span className="shrink-0"><Verdict row={r} /></span>
          </div>
          <div className="flex items-center justify-between gap-2 text-[var(--text-2)]">
            <span className="truncate">{r.relation}</span>
            <span className="mono shrink-0" style={{ color: r.safe ? 'var(--text-2)' : 'var(--danger)' }}>{Math.round(r.inbreed * 100)}% projected</span>
          </div>
          <div className="text-[10px] text-[var(--text-3)]">{locationLabel(r)}</div>
        </div>
      ))}
    </div>
  );
}

function PairingOutlook({ rows, onLocate }) {
  const compact = useScreenHost() === 'drawer';
  return (
    <div data-testid="ledger-pairing">
      <div className="mono text-[10px] tracking-[0.2em] text-[var(--text-3)] mb-1.5 flex items-center gap-1.5"><Dna size={11} /> PAIRING OUTLOOK</div>
      {rows.length === 0 && (
        <div className="text-[11px] text-[var(--text-3)] py-2" data-testid="ledger-pairing-empty">
          No other organisms of this species in the park. Acquire fresh blood to found a line.
        </div>
      )}
      {rows.length > 0 && (compact ? <PairingCards rows={rows} onLocate={onLocate} /> : <PairingTable rows={rows} onLocate={onLocate} />)}
      <div className="text-[10px] text-[var(--text-3)] mt-2 leading-snug">
        Any shared ancestor inside the tracked line produces an inbred birth (fertility and hardiness drop). Transfer surplus kin or acquire wild stock to keep the line clean.
      </div>
    </div>
  );
}

function LedgerEmpty() {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-2 text-center px-4" data-testid="ledger-empty">
      <GitBranch size={28} className="text-[var(--text-3)]" />
      <div className="mono text-[10px] tracking-[0.2em] text-[var(--text-3)]">NO REGISTRY ENTRY</div>
      <div className="text-[11px] text-[var(--text-2)]">Select an organism and open its dossier to trace the bloodline.</div>
    </div>
  );
}

export default function BloodlineLedger({ creatureId, onClose, onNavigate }) {
  useGameTick();
  const host = useScreenHost();
  const s = game.state;
  const c = s?.creatures.find((q) => q.id === creatureId);
  const tree = useMemo(() => (s && creatureId != null ? familyTree(s, creatureId) : null), [s, creatureId, s?.tick]);
  const rows = useMemo(() => (s && c ? pairingOutlook(s, c) : []), [s, c, s?.tick]);
  if (!s) return null;
  const inDrawer = host === 'drawer';
  if (!tree && !inDrawer) return null; // legacy modal has nothing to show without a registry entry
  const sp = tree ? speciesById(tree.me.speciesId) : null;
  const locate = (id) => {
    onClose();
    onNavigate({ kind: 'creature', id });
  };

  const frame = (
    <ScreenFrame
      testId="bloodline-ledger"
      closeTestId="ledger-close-button"
      onClose={onClose}
      layer="fixed inset-0 z-50"
      size="w-[840px] max-h-[86vh]"
      eyebrow={<><GitBranch size={11} /> BLOODLINE LEDGER</>}
      subtitle={tree ? (
        <span className="text-[var(--text-1)]" data-testid="ledger-title">
          {tree.me.name} <span className="text-[var(--text-3)]">· {sp?.name} · {genLabel(tree.me)}</span>
        </span>
      ) : null}
      actions={tree ? (
        <div className="mono text-[10px] text-[var(--text-2)]" data-testid="ledger-descendants">
          {tree.descendants.total} descendant{tree.descendants.total === 1 ? '' : 's'} · {tree.descendants.living} in park
        </div>
      ) : null}
      bodyClassName="p-4 space-y-5 drawer:p-3 drawer:space-y-4"
    >
      {tree ? (
        <>
          <FamilyTreeView tree={tree} onLocate={locate} />
          <div className="border-t border-[var(--line)]" />
          <PairingOutlook rows={rows} onLocate={locate} />
        </>
      ) : <LedgerEmpty />}
    </ScreenFrame>
  );
  return inDrawer ? frame : createPortal(frame, document.body);
}
