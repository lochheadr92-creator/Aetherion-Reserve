import { X, Lock, PackageCheck } from 'lucide-react';
import { game } from '@/game/controller';
import { useGameTick } from '@/components/game/useGame';
import { SPECIES_LIST } from '@/game/data/species';
import { getSpeciesView } from '@/game/knowledge';
import { hasResearch } from '@/game/state';
import { fmtMoney } from '@/game/constants';
import Portrait from '@/components/game/Portrait';

const tierUnlocked = (s, tier) => tier === 1 || (tier === 2 && hasResearch(s, 'ops_field2')) || (tier === 3 && hasResearch(s, 'ops_field3'));

export default function AcquisitionScreen({ onClose, onBuy }) {
  useGameTick();
  const s = game.state;
  if (!s) return null;

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center" style={{ background: 'rgba(5,7,11,0.8)' }} data-testid="fieldops-modal">
      <div className="nl-panel w-[1100px] max-w-[95vw] h-[80vh] flex flex-col overflow-hidden">
        <div className="nl-panel-header flex items-center justify-between px-4 py-3">
          <div>
            <div className="mono text-[10px] tracking-[0.25em] text-[var(--accent-cyan)]">FIELD OPERATIONS — ASSET RECOVERY</div>
            <div className="text-sm text-[var(--text-2)] mt-0.5">Acquire recovered organisms. You will be asked to release them into a fenced enclosure. Funds: <span className="mono">{fmtMoney(s.cash)}</span></div>
          </div>
          <button data-testid="fieldops-close-button" onClick={onClose} className="nl-tool w-8 h-8 flex items-center justify-center"><X size={15} /></button>
        </div>
        <div className="flex-1 overflow-y-auto nl-scroll p-4 grid grid-cols-3 gap-3 content-start">
          {SPECIES_LIST.map((sp) => {
            const unlocked = tierUnlocked(s, sp.tier);
            const view = getSpeciesView(s, sp.id);
            const afford = s.cash >= sp.cost || s.mode === 'sandbox';
            const owned = s.creatures.filter((c) => c.speciesId === sp.id).length;
            return (
              <div key={sp.id} data-testid={`acquire-card-${sp.id}`} className="rounded-lg border border-[var(--line)] bg-[var(--panel-2)] p-3 flex flex-col gap-2" style={{ opacity: unlocked ? 1 : 0.55 }}>
                <div className="flex gap-3">
                  <div className="relative">
                    <Portrait speciesId={sp.id} size={56} className={unlocked ? '' : 'opacity-40'} />
                    {!unlocked && <Lock size={14} className="absolute inset-0 m-auto text-[var(--text-3)]" />}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold truncate">{unlocked ? sp.name : 'UNRESOLVED SIGNAL'}</div>
                    <div className="mono text-[9px] text-[var(--text-3)]">{unlocked ? `${sp.family} · ${sp.rarity}` : `Field Operations ${sp.tier === 2 ? 'II' : 'III'} required`}</div>
                    {unlocked && (
                      <div className="flex gap-1 mt-1 flex-wrap">
                        <span className="text-[9px] px-1.5 py-0.5 rounded border border-[var(--line-2)]" style={{ color: sp.danger >= 4 ? 'var(--danger)' : sp.danger >= 3 ? 'var(--warning)' : 'var(--text-3)' }}>DNG {sp.danger}</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded border border-[var(--line-2)] text-[var(--text-3)]">APL {sp.appeal}</span>
                        {owned > 0 && <span className="text-[9px] px-1.5 py-0.5 rounded border border-[var(--line-2)] text-[var(--accent-seaglass)]">OWNED {owned}</span>}
                      </div>
                    )}
                  </div>
                </div>
                {unlocked && (
                  <>
                    <div className="text-[10px] text-[var(--text-3)] leading-snug">
                      {view.unknown.length > 0
                        ? <span className="text-[#ff8aa0]">{view.unknown.length} biological unknown(s) — requirements must be discovered through observation.</span>
                        : <span className="text-[var(--success)]">Fully documented biology.</span>}
                    </div>
                    {view.known._containmentEstimate && <div className="text-[10px] text-[var(--warning)]">{view.known._containmentEstimate}</div>}
                    {view.known.containment && <div className="text-[10px] text-[var(--text-3)]">Containment: {view.known.containment}</div>}
                    <button
                      data-testid={`acquire-buy-${sp.id}`}
                      disabled={!afford}
                      onClick={() => onBuy(sp.id)}
                      className="mt-auto h-8 rounded font-semibold text-[11px] flex items-center justify-center gap-1.5 disabled:opacity-40 transition-colors"
                      style={{ background: 'var(--accent-cyan)', color: '#061014' }}>
                      <PackageCheck size={13} /> ACQUIRE — {fmtMoney(sp.cost)}
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
