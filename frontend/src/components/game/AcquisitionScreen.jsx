import { X, Lock, PackageCheck } from 'lucide-react';
import { useState } from 'react';
import { game } from '@/game/controller';
import { useGameTick } from '@/components/game/useGame';
import { SPECIES_LIST } from '@/game/data/species';
import { getSpeciesView } from '@/game/knowledge';
import { hasResearch } from '@/game/state';
import { fmtMoney } from '@/game/constants';
import Portrait from '@/components/game/Portrait';
import ExpeditionsTab from '@/components/game/fieldops/ExpeditionsTab';
import ContractsTab from '@/components/game/fieldops/ContractsTab';

const BACKDROP_STYLE = { background: 'rgba(5,7,11,0.8)' };
const BUY_BUTTON_STYLE = { background: 'var(--accent-cyan)', color: '#061014' };
const ATTENTION_DOT_STYLE = { background: 'var(--accent-seaglass)' };
const TABS = [
  { id: 'acquire', label: 'ACQUIRE' },
  { id: 'expeditions', label: 'EXPEDITIONS' },
  { id: 'contracts', label: 'CONTRACTS' },
];

const tierUnlocked = (s, tier) => tier === 1 || (tier === 2 && hasResearch(s, 'ops_field2')) || (tier === 3 && hasResearch(s, 'ops_field3'));

const dangerColor = (danger) => {
  if (danger >= 4) return 'var(--danger)';
  if (danger >= 3) return 'var(--warning)';
  return 'var(--text-3)';
};

const getTabAttention = (s) => ({
  acquire: false,
  expeditions: (s.expeditions || []).some((e) => e.status === 'returned' && e.specimens.some((sp) => !sp.placed)),
  contracts: (s.contracts?.available?.length || 0) > 0 && (s.contracts?.active?.length || 0) < 3,
});

const tabStyle = (active) => ({
  color: active ? 'var(--accent-cyan)' : 'var(--text-3)',
  borderBottom: active ? '2px solid var(--accent-cyan)' : '2px solid transparent',
  background: active ? 'var(--panel-2)' : 'transparent',
});

function CardBadges({ sp, owned }) {
  return (
    <div className="flex gap-1 mt-1 flex-wrap">
      <span className="text-[9px] px-1.5 py-0.5 rounded border border-[var(--line-2)]" style={{ color: dangerColor(sp.danger) }}>DNG {sp.danger}</span>
      <span className="text-[9px] px-1.5 py-0.5 rounded border border-[var(--line-2)] text-[var(--text-3)]">APL {sp.appeal}</span>
      {owned > 0 && <span className="text-[9px] px-1.5 py-0.5 rounded border border-[var(--line-2)] text-[var(--accent-seaglass)]">OWNED {owned}</span>}
    </div>
  );
}

function CardHeader({ sp, unlocked, owned }) {
  return (
    <div className="flex gap-3">
      <div className="relative">
        <Portrait speciesId={sp.id} size={56} className={unlocked ? '' : 'opacity-40'} />
        {!unlocked && <Lock size={14} className="absolute inset-0 m-auto text-[var(--text-3)]" />}
      </div>
      <div className="min-w-0">
        <div className="text-xs font-semibold truncate">{unlocked ? sp.name : 'UNRESOLVED SIGNAL'}</div>
        <div className="mono text-[9px] text-[var(--text-3)]">{unlocked ? `${sp.family} · ${sp.rarity}` : `Field Operations ${sp.tier === 2 ? 'II' : 'III'} required`}</div>
        {unlocked && <CardBadges sp={sp} owned={owned} />}
      </div>
    </div>
  );
}

function BiologyNotes({ view }) {
  return (
    <>
      <div className="text-[10px] text-[var(--text-3)] leading-snug">
        {view.unknown.length > 0
          ? <span className="text-[#ff8aa0]">{view.unknown.length} biological unknown(s) — requirements must be discovered through observation.</span>
          : <span className="text-[var(--success)]">Fully documented biology.</span>}
      </div>
      {view.known._containmentEstimate && <div className="text-[10px] text-[var(--warning)]">{view.known._containmentEstimate}</div>}
      {view.known.containment && <div className="text-[10px] text-[var(--text-3)]">Containment: {view.known.containment}</div>}
    </>
  );
}

function AcquireCard({ sp, s, onBuy }) {
  const unlocked = tierUnlocked(s, sp.tier);
  const view = getSpeciesView(s, sp.id);
  const afford = s.cash >= sp.cost || s.mode === 'sandbox';
  const owned = s.creatures.filter((c) => c.speciesId === sp.id).length;

  return (
    <div data-testid={`acquire-card-${sp.id}`} className="rounded-lg border border-[var(--line)] bg-[var(--panel-2)] p-3 flex flex-col gap-2" style={{ opacity: unlocked ? 1 : 0.55 }}>
      <CardHeader sp={sp} unlocked={unlocked} owned={owned} />
      {unlocked && (
        <>
          <BiologyNotes view={view} />
          <button
            data-testid={`acquire-buy-${sp.id}`}
            disabled={!afford}
            onClick={() => onBuy(sp.id)}
            className="mt-auto h-8 rounded font-semibold text-[11px] flex items-center justify-center gap-1.5 disabled:opacity-40 transition-colors"
            style={BUY_BUTTON_STYLE}>
            <PackageCheck size={13} /> ACQUIRE — {fmtMoney(sp.cost)}
          </button>
        </>
      )}
    </div>
  );
}

function FieldOpsTabs({ tab, attention, onSelect }) {
  return (
    <div className="flex border-b border-[var(--line)] bg-[var(--panel-3)]" data-testid="fieldops-tabs">
      {TABS.map((t) => (
        <button key={t.id} data-testid={`fieldops-tab-${t.id}`} onClick={() => onSelect(t.id)}
          className="px-5 py-2.5 mono text-[10px] tracking-[0.2em] font-medium transition-colors relative"
          style={tabStyle(tab === t.id)}>
          {t.label}
          {attention[t.id] && <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full" style={ATTENTION_DOT_STYLE} />}
        </button>
      ))}
    </div>
  );
}

export default function AcquisitionScreen({ onClose, onBuy, onClaimSpecimen }) {
  useGameTick();
  const [tab, setTab] = useState('acquire');
  const s = game.state;
  if (!s) return null;

  const attention = getTabAttention(s);

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center" style={BACKDROP_STYLE} data-testid="fieldops-modal">
      <div className="nl-panel w-[1100px] max-w-[95vw] h-[80vh] flex flex-col overflow-hidden">
        <div className="nl-panel-header flex items-center justify-between px-4 py-3">
          <div>
            <div className="mono text-[10px] tracking-[0.25em] text-[var(--accent-cyan)]">FIELD OPERATIONS</div>
            <div className="text-sm text-[var(--text-2)] mt-0.5">Asset recovery, survey expeditions and Oversight directives. Funds: <span className="mono">{fmtMoney(s.cash)}</span></div>
          </div>
          <button data-testid="fieldops-close-button" onClick={onClose} className="nl-tool w-8 h-8 flex items-center justify-center"><X size={15} /></button>
        </div>
        <FieldOpsTabs tab={tab} attention={attention} onSelect={setTab} />
        <div className="flex-1 overflow-y-auto nl-scroll p-4">
          {tab === 'acquire' && (
            <div className="grid grid-cols-3 gap-3 content-start">
              {SPECIES_LIST.map((sp) => <AcquireCard key={sp.id} sp={sp} s={s} onBuy={onBuy} />)}
            </div>
          )}
          {tab === 'expeditions' && <ExpeditionsTab s={s} onClaimSpecimen={onClaimSpecimen} />}
          {tab === 'contracts' && <ContractsTab s={s} />}
        </div>
      </div>
    </div>
  );
}
