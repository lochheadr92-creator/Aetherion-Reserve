import { useEffect, useState } from 'react';
import { Play, FolderOpen, Trash2, Beaker, Coins, Target, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { game } from '@/game/controller';
import { fmtMoney } from '@/game/constants';
import { SCENARIO_LIST } from '@/game/data/scenarios';

const DIFF_COLORS = { EASY: 'var(--success)', MEDIUM: 'var(--accent-amber)', HARD: 'var(--danger)', EXPERT: 'var(--accent-violet)' };

function completedScenarios() {
  try { return JSON.parse(localStorage.getItem('aetherion_scenarios_done') || '{}'); } catch (e) { return {}; }
}

function ScenarioPicker({ selected, onSelect }) {
  const done = completedScenarios();
  return (
    <div className="grid grid-cols-2 gap-2" data-testid="scenario-picker">
      {SCENARIO_LIST.map((sc) => (
        <button key={sc.id} data-testid={`scenario-card-${sc.id}`}
          onClick={() => onSelect(sc.id)}
          className="rounded-lg border p-2.5 text-left transition-colors"
          style={{
            borderColor: selected === sc.id ? 'var(--accent-amber)' : 'var(--line)',
            background: selected === sc.id ? 'rgba(242,193,78,0.06)' : 'var(--panel-2)',
          }}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12px] font-semibold text-[var(--text-1)] truncate">{sc.name}</span>
            {done[sc.id] && <CheckCircle2 size={13} className="text-[var(--success)] shrink-0" data-testid={`scenario-done-${sc.id}`} />}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="mono text-[9px] tracking-wider" style={{ color: DIFF_COLORS[sc.difficulty] }}>{sc.difficulty}</span>
            <span className="mono text-[9px] text-[var(--accent-amber)]">+◈{sc.reward.toLocaleString()}</span>
          </div>
          <div className="text-[10px] text-[var(--text-3)] mt-1 leading-snug line-clamp-2">{sc.tagline}</div>
        </button>
      ))}
    </div>
  );
}

export default function MainMenu({ onStart, onLoad }) {
  const [parkName, setParkName] = useState('Aetherion Reserve');
  const [mode, setMode] = useState('management');
  const [scenarioId, setScenarioId] = useState(SCENARIO_LIST[0].id);
  const [saves, setSaves] = useState([]);
  const [loadingSaves, setLoadingSaves] = useState(true);

  const refreshSaves = async () => {
    setLoadingSaves(true);
    try {
      const list = await game.listSaves();
      setSaves(list);
    } catch (e) {
      setSaves([]);
    }
    setLoadingSaves(false);
  };

  useEffect(() => { refreshSaves(); }, []);

  const del = async (id, e) => {
    e.stopPropagation();
    try {
      await game.deleteSave(id);
      toast.info('Save deleted');
      refreshSaves();
    } catch (err) { toast.error('Delete failed'); }
  };

  return (
    <div className="w-full h-full flex items-center justify-center relative overflow-hidden" style={{ background: 'radial-gradient(1200px 700px at 70% 20%, #0d1523 0%, #070a0e 55%, #05070b 100%)' }} data-testid="main-menu">
      {/* ambient grid */}
      <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'linear-gradient(#2DE2E6 1px, transparent 1px), linear-gradient(90deg, #2DE2E6 1px, transparent 1px)', backgroundSize: '48px 48px' }} />
      <div className="absolute bottom-0 left-0 right-0 h-40" style={{ background: 'linear-gradient(transparent, rgba(45,226,230,0.04))' }} />

      <div className="relative z-10 w-[880px] max-w-[94vw] grid grid-cols-5 gap-6">
        <div className="col-span-3">
          <div className="mono text-[11px] tracking-[0.4em] text-[var(--accent-cyan)] mb-2">AETHERION INITIATIVE · SITE-04</div>
          <h1 className="text-5xl font-bold text-[var(--text-1)] leading-tight">Aetherion<br />Reserve</h1>
          <p className="text-[var(--text-2)] mt-4 text-sm leading-relaxed max-w-[420px]">
            Humanity has recovered organisms it does not understand. Build the worlds they need,
            learn how they live by watching them, contain what must be contained — and keep the
            lights on while you do it.
          </p>

          <div className="nl-panel mt-8 p-5 space-y-4">
            <div>
              <label className="mono text-[10px] tracking-[0.2em] text-[var(--text-3)]">FACILITY DESIGNATION</label>
              <input
                data-testid="park-name-input"
                value={parkName}
                onChange={(e) => setParkName(e.target.value)}
                className="mt-1.5 w-full h-10 rounded-lg bg-[var(--panel-2)] border border-[var(--line-2)] px-3 text-sm text-[var(--text-1)] outline-none focus:border-[var(--accent-cyan)] transition-colors"
                maxLength={40}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <button data-testid="mode-management" onClick={() => setMode('management')}
                className="rounded-lg border p-3 text-left transition-colors"
                style={{ borderColor: mode === 'management' ? 'var(--accent-cyan)' : 'var(--line)', background: mode === 'management' ? 'rgba(45,226,230,0.06)' : 'var(--panel-2)' }}>
                <div className="flex items-center gap-2 text-sm font-semibold"><Coins size={14} className="text-[var(--accent-amber)]" /> Management</div>
                <div className="text-[11px] text-[var(--text-3)] mt-1">Budget {fmtMoney(150000)}, research progression, unknown biology.</div>
              </button>
              <button data-testid="mode-sandbox" onClick={() => setMode('sandbox')}
                className="rounded-lg border p-3 text-left transition-colors"
                style={{ borderColor: mode === 'sandbox' ? 'var(--accent-cyan)' : 'var(--line)', background: mode === 'sandbox' ? 'rgba(45,226,230,0.06)' : 'var(--panel-2)' }}>
                <div className="flex items-center gap-2 text-sm font-semibold"><Beaker size={14} className="text-[var(--accent-seaglass)]" /> Sandbox</div>
                <div className="text-[11px] text-[var(--text-3)] mt-1">Unlimited funds, all research and biology unlocked.</div>
              </button>
              <button data-testid="mode-scenario" onClick={() => setMode('scenario')}
                className="rounded-lg border p-3 text-left transition-colors"
                style={{ borderColor: mode === 'scenario' ? 'var(--accent-amber)' : 'var(--line)', background: mode === 'scenario' ? 'rgba(242,193,78,0.06)' : 'var(--panel-2)' }}>
                <div className="flex items-center gap-2 text-sm font-semibold"><Target size={14} className="text-[var(--accent-amber)]" /> Scenarios</div>
                <div className="text-[11px] text-[var(--text-3)] mt-1">Hand-crafted missions with goals, rewards and fail states.</div>
              </button>
            </div>
            {mode === 'scenario' && (
              <>
                <ScenarioPicker selected={scenarioId} onSelect={setScenarioId} />
                <div className="text-[11px] text-[var(--text-2)] leading-relaxed px-0.5" data-testid="scenario-desc">
                  {SCENARIO_LIST.find((sc) => sc.id === scenarioId)?.desc}
                </div>
              </>
            )}
            <button
              data-testid="start-game-button"
              onClick={() => onStart({
                parkName: parkName.trim() || 'Aetherion Reserve',
                mode: mode === 'scenario' ? 'management' : mode,
                scenarioId: mode === 'scenario' ? scenarioId : undefined,
              })}
              className="w-full h-11 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-colors hover:opacity-90"
              style={{ background: 'var(--accent-cyan)', color: '#061014' }}>
              <Play size={16} /> BEGIN OPERATIONS
            </button>
          </div>
        </div>

        <div className="col-span-2">
          <div className="nl-panel h-full flex flex-col overflow-hidden">
            <div className="nl-panel-header px-4 py-3 flex items-center gap-2">
              <FolderOpen size={14} className="text-[var(--text-3)]" />
              <span className="mono text-[10px] tracking-[0.2em] text-[var(--text-3)]">ARCHIVED FACILITIES</span>
            </div>
            <div className="flex-1 overflow-y-auto nl-scroll" data-testid="save-list">
              {loadingSaves && <div className="p-4 text-xs text-[var(--text-3)]">Querying secure storage…</div>}
              {!loadingSaves && saves.length === 0 && (
                <div className="p-4 text-xs text-[var(--text-3)]">No archived facilities. Saves made in-game will appear here.</div>
              )}
              {saves.map((sv) => (
                <button key={sv.id} data-testid={`save-slot-${sv.id}`} onClick={() => onLoad(sv.id)}
                  className="w-full text-left px-4 py-3 border-b border-[var(--line)] hover:bg-[var(--panel-2)] transition-colors group">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-[var(--text-1)] truncate">{sv.park_name}</span>
                    <span onClick={(e) => del(sv.id, e)} className="opacity-0 group-hover:opacity-100 text-[var(--danger)] transition-opacity p-1" data-testid={`delete-save-${sv.id}`}>
                      <Trash2 size={13} />
                    </span>
                  </div>
                  <div className="mono text-[10px] text-[var(--text-3)] mt-0.5">
                    CYCLE {sv.day} · {fmtMoney(sv.cash)} · {sv.creatures} ORGANISMS · {sv.mode.toUpperCase()}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
