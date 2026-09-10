import { useState, useEffect, useCallback } from 'react';
import { Dna, ArrowLeftRight, ShieldCheck, ShieldAlert, Check, X, Sparkles, Trophy, Info } from 'lucide-react';
import { speciesById } from '@/game/data/species';
import { MORPHS } from '@/game/genetics';
import { projectPairing, recommendPartners, bestPairs, plannerRoster, OUTLOOK_KEYS, GENE_GOOD_HIGH } from '@/game/pairing';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// ---- Pairing Planner: pick two organisms, read the projected pairing ----
// Read-only over live state (every value comes from the pure helpers in game/pairing.js).
// Mounted inside the Bloodline Ledger drawer; the ledger subject pre-fills slot A.

const MORPH_BY_ID = Object.fromEntries(MORPHS.map((m) => [m.id, m]));
const TRAIT_COLORS = { warning: 'var(--warning)', danger: 'var(--danger)', behaviour: 'var(--text-2)', bio: 'var(--accent-seaglass)' };
const pct = (v) => `${Math.round(v * 100)}%`;

function Label({ children }) {
  return <div className="mono text-[9px] tracking-[0.2em] text-[var(--text-3)]">{children}</div>;
}

function rosterLabel(c) {
  const sp = speciesById(c.speciesId);
  return `${c.name} · ${sp?.name || c.speciesId} · G${c.genes?.gen || 0}${c.juvenile ? ' · juvenile' : ''}`;
}

function SlotSelect({ slot, value, roster, onChange, placeholder }) {
  return (
    <div className="space-y-1">
      <Label>ORGANISM {slot}</Label>
      <Select value={value != null ? String(value) : ''} onValueChange={(v) => onChange(Number(v))}>
        <SelectTrigger data-testid={`pairing-slot-${slot.toLowerCase()}`}
          className="h-8 px-2 text-[11px] border-[var(--line)] bg-[var(--panel-1)] text-[var(--text-1)] focus:ring-[var(--focus-ring)]">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className="border-[var(--line)] bg-[var(--panel-1)] max-h-72">
          {roster.length === 0 && <div className="px-2 py-1.5 text-[11px] text-[var(--text-3)]">No candidates in the park</div>}
          {roster.map((c) => (
            <SelectItem key={c.id} value={String(c.id)} data-testid={`pairing-slot-${slot.toLowerCase()}-option-${c.id}`} className="text-[11px]">
              {rosterLabel(c)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function RiskBanner({ p }) {
  const { risk } = p;
  return (
    <div className="rounded-lg border px-3 py-2 flex items-start gap-3" data-testid="pairing-risk" data-tier={risk.id}
      style={{ borderColor: risk.color, background: `color-mix(in srgb, ${risk.color} 8%, transparent)` }}>
      <div className="shrink-0 pt-0.5" style={{ color: risk.color }}>{risk.id === 'clean' ? <ShieldCheck size={16} /> : <ShieldAlert size={16} />}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="mono text-[10px] tracking-[0.2em] font-semibold" style={{ color: risk.color }}>{risk.label}</span>
          <span className="mono text-[14px] font-semibold" style={{ color: risk.color }} data-testid="pairing-inbreed">{pct(p.inbreed)}</span>
        </div>
        <div className="text-[10px] text-[var(--text-2)] mt-0.5" data-testid="pairing-relation">
          {p.relation} · {p.shared} shared ancestor{p.shared === 1 ? '' : 's'} · projected inbreeding coefficient
        </div>
        <div className="text-[10px] text-[var(--text-3)] mt-1 leading-snug">{risk.blurb}</div>
      </div>
    </div>
  );
}

function Viability({ p }) {
  const failing = p.blockers;
  const green = p.checklist.length - failing.length;
  return (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--panel-2)] px-3 py-2 space-y-1.5" data-testid="pairing-viability" data-viable={p.viable ? 'true' : 'false'}>
      <div className="flex items-center justify-between gap-2">
        <Label>READINESS</Label>
        <span className="mono text-[9px] text-[var(--text-3)]">{green}/{p.checklist.length} gates green</span>
      </div>
      {p.viable ? (
        <div className="flex items-center gap-1.5 text-[11px] text-[var(--success)]" data-testid="pairing-ready">
          <Check size={12} /> Ready to pair — courtship can begin at the next check.
        </div>
      ) : (
        <ul className="space-y-1">
          {failing.map((g) => (
            <li key={g.id} className="flex items-start gap-1.5 text-[11px]" data-testid={`pairing-gate-${g.id}`} data-hard={g.hard ? 'true' : 'false'}>
              <X size={12} className="shrink-0 mt-0.5" style={{ color: g.hard ? 'var(--danger)' : 'var(--warning)' }} />
              <span className="min-w-0">
                <span className="text-[var(--text-1)]">{g.label}</span>
                {g.why && <span className="text-[var(--text-3)]"> — {g.why}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-[var(--line)]" data-testid="pairing-odds">
        <span className="text-[10px] text-[var(--text-2)]">Courtship odds per check, once all gates are green</span>
        <span className="mono text-[11px] text-[var(--accent-cyan)]">{pct(p.pairChance)}</span>
      </div>
    </div>
  );
}

function MorphOutlook({ m }) {
  const morph = m.morph;
  const glow = morph?.glow || 'var(--text-3)';
  return (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--panel-2)] px-3 py-2 space-y-1" data-testid="pairing-morph" data-morph={m.id || 'none'}
      style={morph ? { boxShadow: `inset 3px 0 0 ${glow}` } : undefined}>
      <div className="flex items-center justify-between gap-2">
        <Label>MORPH OUTLOOK</Label>
        <Sparkles size={11} style={{ color: glow }} />
      </div>
      {morph ? (
        <>
          <div className="flex items-center gap-2 text-[11px]">
            <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ background: glow, boxShadow: `0 0 6px ${glow}` }} />
            <span className="text-[var(--text-1)] font-semibold">{morph.name}</span>
            <span className="mono ml-auto" style={{ color: glow }} data-testid="pairing-morph-chance">{pct(m.pMorph)}</span>
          </div>
          <div className="text-[10px] text-[var(--text-3)]">{m.source} · {pct(m.pCarrier)} chance of a hidden carrier instead</div>
        </>
      ) : (
        <div className="text-[10px] text-[var(--text-3)]">
          Neither line expresses or carries a morph — only the {pct(m.pMorph)} spontaneous chance remains.
          {m.pool.length > 0 && ` Carrier pool: ${m.pool.map((id) => MORPH_BY_ID[id]?.name || id).join(', ')}.`}
        </div>
      )}
    </div>
  );
}

// parents' ticks + the expected offspring range on a 0..1 track
function TraitBar({ g, aName, bName }) {
  const good = GENE_GOOD_HIGH.has(g.key);
  const tone = g.depression ? 'var(--danger)' : good && g.mean >= 0.65 ? 'var(--accent-seaglass)' : 'var(--accent-cyan)';
  return (
    <div className="space-y-0.5" data-testid={`pairing-trait-${g.key}`} data-mean={g.mean.toFixed(2)}>
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-[var(--text-2)]">{g.label}</span>
        <span className="mono flex items-center gap-1.5">
          {g.depression > 0 && <span className="text-[9px] px-1 rounded border border-[var(--danger)] text-[var(--danger)]" data-testid={`pairing-depression-${g.key}`}>−{g.depression}%</span>}
          <span style={{ color: tone }}>{pct(g.mean)}</span>
        </span>
      </div>
      <div className="relative h-2 rounded-full bg-[var(--panel-1)] border border-[var(--line)] overflow-visible" role="img"
        aria-label={`${g.label}: ${aName} ${pct(g.a)}, ${bName} ${pct(g.b)}, offspring ${pct(g.low)} to ${pct(g.high)}`}>
        <div className="absolute top-0 bottom-0 rounded-full opacity-70" style={{ left: `${g.low * 100}%`, width: `${Math.max(1, (g.high - g.low) * 100)}%`, background: tone }} />
        <span className="absolute -top-0.5 w-px h-3 bg-[var(--accent-cyan)]" style={{ left: `${g.a * 100}%` }} title={`${aName} ${pct(g.a)}`} />
        <span className="absolute -top-0.5 w-px h-3 bg-[var(--accent-violet)]" style={{ left: `${g.b * 100}%` }} title={`${bName} ${pct(g.b)}`} />
      </div>
    </div>
  );
}

function TraitOutlook({ p }) {
  return (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--panel-2)] px-3 py-2 space-y-2" data-testid="pairing-traits">
      <div className="flex items-center justify-between gap-2">
        <Label>TRAIT OUTLOOK · GEN {p.expected.gen}</Label>
      </div>
      <div className="mono text-[9px] text-[var(--text-3)] flex items-center gap-3 min-w-0">
        <span className="flex items-center gap-1 min-w-0"><span className="inline-block w-px h-2.5 bg-[var(--accent-cyan)] shrink-0" /><span className="truncate">{p.a.name}</span></span>
        <span className="flex items-center gap-1 min-w-0"><span className="inline-block w-px h-2.5 bg-[var(--accent-violet)] shrink-0" /><span className="truncate">{p.b.name}</span></span>
        <span className="flex items-center gap-1 shrink-0"><span className="inline-block w-3 h-1.5 rounded-full bg-[var(--accent-cyan)] opacity-70" />offspring</span>
      </div>
      <div className="space-y-1.5">
        {OUTLOOK_KEYS.slice(0, 6).map((k) => <TraitBar key={k} g={p.genes[k]} aName={p.a.name} bName={p.b.name} />)}
      </div>
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-[var(--line)] text-[10px]">
        <span className="text-[var(--text-3)]">Expected size ×{p.expected.size.toFixed(2)} · blend ±8% jitter</span>
      </div>
      {p.traits.length > 0 && (
        <div className="flex gap-1.5 flex-wrap" data-testid="pairing-trait-chips">
          {p.traits.map((t) => {
            const morph = t.kind === 'morph' ? p.morph.morph : null;
            const color = morph ? morph.glow : (TRAIT_COLORS[t.kind] || 'var(--text-2)');
            return (
              <span key={t.label} className="text-[10px] px-2 py-0.5 rounded-full border"
                style={{ borderColor: morph ? morph.glow : 'var(--line-2)', color, boxShadow: morph ? `0 0 8px ${morph.glow}44` : 'none' }}>
                likely: {t.label}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ReasonChips({ reasons }) {
  return (
    <span className="flex gap-1 flex-wrap">
      {reasons.slice(0, 4).map((r) => <span key={r} className="mono text-[8px] tracking-[0.08em] px-1 py-px rounded border border-[var(--line)] text-[var(--text-3)]">{r}</span>)}
    </span>
  );
}

function Recommendations({ rows, activeId, onPick }) {
  return (
    <div data-testid="pairing-recommendations">
      <Label>RECOMMENDED PARTNERS</Label>
      {rows.length === 0 && <div className="text-[11px] text-[var(--text-3)] py-1.5">No other organisms of this species in the park.</div>}
      <div className="space-y-1 mt-1">
        {rows.map((r, i) => (
          <button key={r.id} type="button" data-testid={`pairing-recommend-${r.id}`} data-rank={i + 1} data-active={r.id === activeId ? 'true' : 'false'}
            onClick={() => onPick(r.id)}
            className={`w-full text-left rounded-lg border px-2.5 py-1.5 text-[11px] space-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${r.id === activeId ? 'border-[var(--accent-cyan)] bg-[rgba(45,226,230,0.08)]' : 'border-[var(--line)] bg-[var(--panel-2)] hover:border-[var(--accent-cyan)]'}`}>
            <div className="flex items-center gap-2">
              <span className="mono text-[9px] text-[var(--text-3)] w-3 shrink-0">{i + 1}</span>
              <span className="text-[var(--text-1)] truncate min-w-0 flex-1">{r.name} <span className="mono text-[9px] text-[var(--text-3)]">G{r.gen}</span></span>
              <span className="mono text-[9px] shrink-0" style={{ color: r.risk.color }}>{r.risk.label} · {pct(r.inbreed)}</span>
            </div>
            <div className="pl-5"><ReasonChips reasons={r.reasons} /></div>
          </button>
        ))}
      </div>
    </div>
  );
}

function BestPairs({ pairs, onPick }) {
  if (!pairs.length) return null;
  return (
    <div data-testid="pairing-best-pairs">
      <Label><span className="inline-flex items-center gap-1"><Trophy size={10} /> BEST PAIRINGS IN THE PARK</span></Label>
      <div className="space-y-1 mt-1">
        {pairs.map((r, i) => (
          <button key={`${r.aId}-${r.bId}`} type="button" data-testid={`pairing-pair-${i + 1}`} onClick={() => onPick(r.aId, r.bId)}
            className="w-full text-left rounded-lg border border-[var(--line)] bg-[var(--panel-2)] hover:border-[var(--accent-cyan)] px-2.5 py-1.5 text-[11px] space-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">
            <div className="flex items-center gap-2">
              <span className="text-[var(--text-1)] truncate min-w-0 flex-1">{r.aName} <span className="text-[var(--text-3)]">×</span> {r.bName}</span>
              <span className="mono text-[9px] shrink-0" style={{ color: r.risk.color }}>{r.risk.label} · {pct(r.inbreed)}{r.pMorph >= 0.2 ? ` · ${pct(r.pMorph)} morph` : ''}</span>
            </div>
            <ReasonChips reasons={r.reasons} />
          </button>
        ))}
      </div>
    </div>
  );
}

// Pure projection of the planner's derived data for the current slot choices. Cheap over a few dozen
// residents; recomputed on every tick re-render so the planner stays live.
function derivePlan(state, aId, bId, focusSpeciesId) {
  const creatures = state?.creatures || [];
  const a = creatures.find((c) => c.id === aId) || null;
  const rosterA = plannerRoster(state);
  const rosterB = a ? plannerRoster(state, a.speciesId).filter((c) => c.id !== a.id) : [];
  const recs = a ? recommendPartners(state, a, 5) : [];
  // slot B follows the top recommendation until the player picks one explicitly
  const effectiveB = bId != null && rosterB.some((c) => c.id === bId) ? bId : (recs[0]?.id ?? null);
  const b = creatures.find((c) => c.id === effectiveB) || null;
  const p = a && b ? projectPairing(state, a, b) : null;
  const pairs = a ? bestPairs(state, a.speciesId, 3) : [];
  const speciesId = a ? a.speciesId : focusSpeciesId;
  const sp = speciesId ? speciesById(speciesId) : null;
  return { a, b, rosterA, rosterB, recs, p, pairs, sp };
}

// Empty states: no organism A yet (species-focused or generic) / A has no possible partner.
function PlannerEmpty({ a, sp, focusSpeciesId }) {
  const name = sp?.name || 'organism';
  let text;
  if (!a && focusSpeciesId) text = `No ${name} lives in the park yet — recover one through Field Operations to found a line.`;
  else if (!a) text = 'Pick an organism to start planning a pairing.';
  else text = `No other ${name} in the park — acquire fresh blood to found a line.`;
  return (
    <div className="text-[11px] text-[var(--text-3)] flex items-start gap-1.5" data-testid="pairing-empty">
      <Info size={12} className="shrink-0 mt-0.5" /> <span>{text}</span>
    </div>
  );
}

export const PairingPlanner = ({ state, subjectId, focusSpeciesId = null }) => {
  const [aId, setAId] = useState(subjectId ?? null);
  const [bId, setBId] = useState(null);
  useEffect(() => { setAId(subjectId ?? null); setBId(null); }, [subjectId]);

  const { a, b, rosterA, rosterB, recs, p, pairs, sp } = derivePlan(state, aId, bId, focusSpeciesId);

  const swap = useCallback(() => { if (a && b) { setAId(b.id); setBId(a.id); } }, [a, b]);
  const pickPair = useCallback((x, y) => { setAId(x); setBId(y); }, []);
  const pickA = useCallback((id) => { setAId(id); setBId(null); }, []);

  return (
    <div data-testid="pairing-planner" className="space-y-3" data-focus-species={focusSpeciesId || undefined}>
      <div className="mono text-[10px] tracking-[0.2em] text-[var(--text-3)] flex items-center gap-1.5"><Dna size={11} /> PAIRING PLANNER</div>
      <div className="space-y-2">
        <SlotSelect slot="A" value={a?.id ?? null} roster={rosterA} onChange={pickA} placeholder="Choose an organism" />
        <div className="flex justify-center -my-1">
          <button type="button" data-testid="pairing-swap" onClick={swap} disabled={!a || !b} title="Swap A and B"
            className="nl-tool h-6 px-2 text-[10px] flex items-center gap-1 disabled:opacity-40">
            <ArrowLeftRight size={11} /> swap
          </button>
        </div>
        <SlotSelect slot="B" value={b?.id ?? null} roster={rosterB} onChange={setBId} placeholder={a ? `Choose a ${sp?.name || 'partner'}` : 'Pick organism A first'} />
      </div>

      {(!a || !b) && <PlannerEmpty a={a} sp={sp} focusSpeciesId={focusSpeciesId} />}

      {p && (
        <div className="space-y-2" data-testid="pairing-projection" data-a={p.a.id} data-b={p.b.id}>
          <RiskBanner p={p} />
          <Viability p={p} />
          <MorphOutlook m={p.morph} />
          <TraitOutlook p={p} />
        </div>
      )}

      {a && <Recommendations rows={recs} activeId={b?.id ?? null} onPick={setBId} />}
      {a && <BestPairs pairs={pairs} onPick={pickPair} />}
    </div>
  );
};

export default PairingPlanner;
