import { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, MapPin, GitBranch, Dna, ShieldCheck, ShieldAlert } from 'lucide-react';
import { game } from '@/game/controller';
import { speciesById } from '@/game/data/species';
import { familyTree, pairingOutlook } from '@/game/lineage';
import { MORPHS } from '@/game/genetics';
import { useGameTick } from '@/components/game/useGame';

// ---- Bloodline Ledger: family tree + pairing outlook for one organism ----
// Read-only view over state.lineage (permanent registry) and living creatures.

const MORPH_BY_ID = Object.fromEntries(MORPHS.map((m) => [m.id, m]));

const STATUS_META = {
  park: { label: 'IN PARK', color: 'var(--accent-seaglass)' },
  transferred: { label: 'TRANSFERRED', color: 'var(--text-3)' },
  unknown: { label: 'WILD / UNTRACKED', color: 'var(--text-3)' },
};

function statusOf(e) {
  return STATUS_META[e?.status] || STATUS_META.unknown;
}

function genLabel(e) {
  if (!e || e.gen == null) return 'Origin unknown';
  return e.gen === 0 ? 'Gen 0 · wild-recovered' : `Gen ${e.gen} · park-bred`;
}

// A single person-card in the tree. Living organisms can be located on the map.
function Node({ entry, role, highlight = false, onLocate, testId }) {
  if (!entry) {
    return (
      <div className="w-[150px] rounded-lg border border-dashed border-[var(--line)] px-3 py-2 text-center" data-testid={testId}>
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
      className={`w-[150px] rounded-lg border px-3 py-2 text-left ${highlight ? 'border-[var(--accent-cyan)] bg-[rgba(45,226,230,0.08)]' : 'border-[var(--line)] bg-[var(--panel-2)]'} ${alive ? 'hover:border-[var(--accent-cyan)] cursor-pointer' : 'cursor-default'}`}
      style={morph ? { boxShadow: `0 0 10px ${morph.glow}33` } : undefined}
      title={alive ? 'Locate on the map' : undefined}>
      <div className="mono text-[9px] tracking-[0.15em] text-[var(--text-3)] truncate" title={role}>{role}</div>
      <div className="text-[12px] font-semibold text-[var(--text-1)] truncate flex items-center gap-1.5">
        {morph && <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ background: morph.glow, boxShadow: `0 0 6px ${morph.glow}` }} />}
        {entry.name}
      </div>
      <div className="mono text-[9px] text-[var(--text-2)] mt-0.5">{genLabel(entry)}</div>
      <div className="flex items-center gap-1.5 mt-1">
        <span className="mono text-[8px] tracking-[0.12em] px-1 py-px rounded border" style={{ color: st.color, borderColor: st.color }}>{st.label}</span>
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
      <div className="flex gap-3 justify-center flex-wrap">{children}</div>
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
          className={`text-[10px] px-2 py-0.5 rounded-full border ${e.status === 'park' ? 'border-[var(--line-2)] text-[var(--text-2)] hover:border-[var(--accent-cyan)]' : 'border-[var(--line)] text-[var(--text-3)]'}`}>
          {e.name}{e.status !== 'park' ? ' ·' + ' away' : ''}
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

function PairingOutlook({ rows, onLocate }) {
  return (
    <div data-testid="ledger-pairing">
      <div className="mono text-[10px] tracking-[0.2em] text-[var(--text-3)] mb-1.5 flex items-center gap-1.5"><Dna size={11} /> PAIRING OUTLOOK</div>
      {rows.length === 0 && (
        <div className="text-[11px] text-[var(--text-3)] py-2" data-testid="ledger-pairing-empty">
          No other organisms of this species in the park. Acquire fresh blood to found a line.
        </div>
      )}
      {rows.length > 0 && (
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
                <td className="py-1.5 pr-2">
                  <button type="button" onClick={() => onLocate(r.id)} className="text-[var(--text-1)] hover:text-[var(--accent-cyan)] flex items-center gap-1">
                    {r.name} <span className="mono text-[9px] text-[var(--text-3)]">G{r.gen}</span>
                  </button>
                </td>
                <td className="py-1.5 pr-2 text-[var(--text-2)]">{r.relation}</td>
                <td className="py-1.5 pr-2 mono" style={{ color: r.safe ? 'var(--text-2)' : 'var(--danger)' }}>{Math.round(r.inbreed * 100)}%</td>
                <td className="py-1.5 pr-2 text-[var(--text-2)]">{r.sameEnclosure ? 'Same enclosure' : 'Elsewhere'}{r.ready ? '' : ' · not ready'}</td>
                <td className="py-1.5"><Verdict row={r} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="text-[10px] text-[var(--text-3)] mt-2 leading-snug">
        Any shared ancestor inside the tracked line produces an inbred birth (fertility and hardiness drop). Transfer surplus kin or acquire wild stock to keep the line clean.
      </div>
    </div>
  );
}

export default function BloodlineLedger({ creatureId, onClose, onNavigate }) {
  useGameTick();
  const s = game.state;
  const c = s?.creatures.find((q) => q.id === creatureId);
  const tree = useMemo(() => (s ? familyTree(s, creatureId) : null), [s, creatureId, s?.tick]);
  const rows = useMemo(() => (s && c ? pairingOutlook(s, c) : []), [s, c, s?.tick]);
  if (!s || !tree) return null;
  const sp = speciesById(tree.me.speciesId);
  const locate = (id) => {
    onClose();
    onNavigate({ kind: 'creature', id });
  };
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(5,7,11,0.8)' }} data-testid="bloodline-ledger">
      <div className="nl-panel w-[840px] max-w-[95vw] max-h-[86vh] flex flex-col overflow-hidden">
        <div className="nl-panel-header flex items-center justify-between px-4 py-3">
          <div>
            <div className="mono text-[10px] tracking-[0.25em] text-[var(--accent-cyan)] flex items-center gap-1.5"><GitBranch size={11} /> BLOODLINE LEDGER</div>
            <div className="text-sm text-[var(--text-1)] mt-0.5" data-testid="ledger-title">
              {tree.me.name} <span className="text-[var(--text-3)]">· {sp?.name} · {genLabel(tree.me)}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="mono text-[10px] text-[var(--text-2)]" data-testid="ledger-descendants">
              {tree.descendants.total} descendant{tree.descendants.total === 1 ? '' : 's'} · {tree.descendants.living} in park
            </div>
            <button data-testid="ledger-close-button" onClick={onClose} className="nl-tool w-8 h-8 flex items-center justify-center"><X size={15} /></button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto nl-scroll p-4 space-y-5">
          <FamilyTreeView tree={tree} onLocate={locate} />
          <div className="border-t border-[var(--line)]" />
          <PairingOutlook rows={rows} onLocate={locate} />
        </div>
      </div>
    </div>,
    document.body,
  );
}
