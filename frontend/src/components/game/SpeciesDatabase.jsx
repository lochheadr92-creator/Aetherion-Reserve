import { useState } from 'react';
import { X, Lock } from 'lucide-react';
import { game } from '@/game/controller';
import { useGameTick } from '@/components/game/useGame';
import { SPECIES_LIST, speciesById } from '@/game/data/species';
import { getSpeciesView, EVIDENCE_THRESHOLD, attrLabel } from '@/game/knowledge';
import { hasResearch } from '@/game/state';
import Portrait from '@/components/game/Portrait';

const tierUnlocked = (s, tier) => tier === 1 || (tier === 2 && hasResearch(s, 'ops_field2')) || (tier === 3 && hasResearch(s, 'ops_field3'));

export default function SpeciesDatabase({ initialSpecies, onClose }) {
  useGameTick();
  const s = game.state;
  const [sel, setSel] = useState(initialSpecies || SPECIES_LIST[0].id);
  if (!s) return null;
  const sp = speciesById(sel);
  const unlocked = tierUnlocked(s, sp.tier);
  const view = getSpeciesView(s, sel);
  const owned = s.creatures.filter((c) => c.speciesId === sel).length;
  const k = s.knowledge[sel] || { evidence: {}, compat: {} };

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center" style={{ background: 'rgba(5,7,11,0.8)' }} data-testid="species-database-modal">
      <div className="nl-panel w-[1060px] max-w-[95vw] h-[80vh] flex flex-col overflow-hidden">
        <div className="nl-panel-header flex items-center justify-between px-4 py-3">
          <div>
            <div className="mono text-[10px] tracking-[0.25em] text-[var(--accent-cyan)]">AETHERION BIOLOGICAL ARCHIVE</div>
            <div className="text-sm text-[var(--text-2)] mt-0.5">Species Database — knowledge is earned through observation</div>
          </div>
          <button data-testid="species-db-close-button" onClick={onClose} className="nl-tool w-8 h-8 flex items-center justify-center"><X size={15} /></button>
        </div>
        <div className="flex flex-1 min-h-0">
          {/* list */}
          <div className="w-[300px] border-r border-[var(--line)] overflow-y-auto nl-scroll">
            {SPECIES_LIST.map((x) => {
              const xUnlocked = tierUnlocked(s, x.tier);
              const lvl = getSpeciesView(s, x.id).level;
              return (
                <button key={x.id} data-testid={`species-row-${x.id}`} onClick={() => setSel(x.id)}
                  className="w-full flex items-center gap-3 px-3 py-2 border-b border-[var(--line)] text-left hover:bg-[var(--panel-2)] transition-colors"
                  style={{ background: sel === x.id ? 'var(--panel-2)' : undefined }}>
                  <div className="relative">
                    <Portrait speciesId={x.id} size={44} className={xUnlocked ? '' : 'opacity-30'} />
                    {!xUnlocked && <Lock size={13} className="absolute inset-0 m-auto text-[var(--text-3)]" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium truncate" style={{ color: xUnlocked ? 'var(--text-1)' : 'var(--text-3)' }}>{xUnlocked ? x.name : 'SIGNAL DETECTED'}</div>
                    <div className="mono text-[9px] text-[var(--text-3)]">{xUnlocked ? `${x.family} · T${x.tier}` : `Requires Field Operations ${x.tier === 2 ? 'II' : 'III'}`}</div>
                  </div>
                  {xUnlocked && (
                    <div className="mono text-[9px]" style={{ color: lvl.pct === 1 ? 'var(--success)' : 'var(--text-3)' }}>{(lvl.pct * 100).toFixed(0)}%</div>
                  )}
                </button>
              );
            })}
          </div>
          {/* detail */}
          <div className="flex-1 overflow-y-auto nl-scroll p-5" data-testid="species-detail">
            {!unlocked ? (
              <div className="h-full flex flex-col items-center justify-center gap-3 text-center">
                <Lock size={40} className="text-[var(--text-3)]" />
                <div className="mono text-xs text-[var(--text-3)] tracking-widest">UNRESOLVED BIOSIGNAL</div>
                <div className="text-sm text-[var(--text-2)] max-w-[380px]">Deep-zone survey teams report an uncatalogued organism. Complete Field Operations research to authorise recovery.</div>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="flex gap-4">
                  <Portrait speciesId={sp.id} size={110} />
                  <div>
                    <div className="text-xl font-semibold">{sp.name}</div>
                    <div className="mono text-[11px] text-[var(--accent-cyan)]">{sp.code}</div>
                    <div className="flex gap-1.5 mt-2 flex-wrap">
                      <span className="text-[10px] px-2 py-0.5 rounded-full border border-[var(--line-2)] text-[var(--text-2)]">{sp.family}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full border border-[var(--line-2)] text-[var(--text-2)]">{sp.rarity}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full border border-[var(--line-2)]" style={{ color: sp.danger >= 4 ? 'var(--danger)' : sp.danger >= 3 ? 'var(--warning)' : 'var(--text-2)' }}>Danger {sp.danger}/5</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full border border-[var(--line-2)] text-[var(--text-2)]">Appeal {sp.appeal}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full border border-[var(--line-2)] text-[var(--text-2)]">In park: {owned}</span>
                    </div>
                    <div className="mt-2">
                      <span className="text-[10px] px-2 py-1 rounded border" style={{
                        borderColor: view.level.pct === 1 ? 'rgba(62,226,138,0.4)' : 'var(--line-2)',
                        color: view.level.pct === 1 ? 'var(--success)' : 'var(--text-2)',
                      }} data-testid="knowledge-level">{view.level.label.toUpperCase()} — {(view.level.pct * 100).toFixed(0)}% documented</span>
                    </div>
                  </div>
                </div>

                <div className="text-[13px] text-[var(--text-2)] italic leading-relaxed border-l-2 border-[var(--line-2)] pl-3">{sp.lore}</div>
                <div className="text-[12px] text-[var(--accent-violet)]">Field note: {sp.question}</div>

                <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                  <div className="col-span-2 mono text-[10px] tracking-[0.2em] text-[var(--text-3)]">DOCUMENTED BIOLOGY</div>
                  {Object.entries(view.known).filter(([kk]) => !kk.startsWith('_')).map(([kk, v]) => (
                    <div key={kk} className="text-[12px]">
                      <div className="text-[var(--text-3)] capitalize text-[10px] mono tracking-wider">{attrLabel(kk).toUpperCase()}</div>
                      <div className="text-[var(--text-1)]">{v}</div>
                    </div>
                  ))}
                  {view.known._containmentEstimate && (
                    <div className="text-[12px]">
                      <div className="text-[var(--text-3)] text-[10px] mono tracking-wider">CONTAINMENT (ESTIMATE)</div>
                      <div className="text-[var(--warning)]">{view.known._containmentEstimate}</div>
                    </div>
                  )}
                </div>

                {view.unknown.length > 0 && (
                  <div>
                    <div className="mono text-[10px] tracking-[0.2em] text-[var(--text-3)] mb-2">UNDOCUMENTED — OBSERVE TO LEARN</div>
                    <div className="space-y-2">
                      {view.unknown.map((u) => {
                        const ev = Math.min(1, (k.evidence[u] || 0) / EVIDENCE_THRESHOLD);
                        return (
                          <div key={u} className="flex items-center gap-3">
                            <span className="nl-redacted w-44 shrink-0" data-testid={`db-unknown-${u}`}>{attrLabel(u).toUpperCase()}: UNKNOWN</span>
                            <div className="nl-bar-track flex-1">
                              <div className="nl-bar-fill" style={{ width: `${ev * 100}%`, background: 'var(--accent-rose)' }} />
                            </div>
                            <span className="mono text-[9px] text-[var(--text-3)] w-24">{ev >= 0.5 ? 'HYPOTHESIS FORMING' : 'evidence ' + (ev * 100).toFixed(0) + '%'}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div>
                  <div className="mono text-[10px] tracking-[0.2em] text-[var(--text-3)] mb-2">KNOWN RELATIONSHIPS</div>
                  {Object.keys(k.compat || {}).length === 0 ? (
                    <div className="text-[11px] text-[var(--text-3)]">No confirmed cohabitation data. House species together (carefully) to learn.</div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(k.compat).map(([oid, status]) => (
                        <span key={oid} className="text-[10px] px-2 py-1 rounded border" style={{
                          borderColor: status === 'hostile' ? 'rgba(255,77,109,0.5)' : 'rgba(62,226,138,0.4)',
                          color: status === 'hostile' ? 'var(--danger)' : 'var(--success)',
                        }}>{speciesById(oid).name}: {status.toUpperCase()}</span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-1.5 flex-wrap">
                  {sp.traits.map((t) => <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--panel-2)] border border-[var(--line)] text-[var(--text-3)]">{t}</span>)}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
