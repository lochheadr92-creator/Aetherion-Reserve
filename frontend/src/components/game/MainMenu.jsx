import { useCallback, useEffect, useState } from 'react';
import { Play, FolderOpen, Trash2, Beaker, Coins, Target, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { game } from '@/game/controller';
import { fmtMoney } from '@/game/constants';
import { SCENARIO_LIST } from '@/game/data/scenarios';

const DIFF_COLORS = { EASY: 'var(--success)', MEDIUM: 'var(--accent-amber)', HARD: 'var(--danger)', EXPERT: 'var(--accent-violet)' };

const MENU_BG = { background: 'radial-gradient(1200px 700px at 70% 20%, #0d1523 0%, #070a0e 55%, #05070b 100%)' };
const GRID_BG = {
  backgroundImage: 'linear-gradient(#2DE2E6 1px, transparent 1px), linear-gradient(90deg, #2DE2E6 1px, transparent 1px)',
  backgroundSize: '48px 48px',
};
const GLOW_BG = { background: 'linear-gradient(transparent, rgba(45,226,230,0.04))' };

const MODES = [
  { id: 'management', label: 'Management', icon: Coins, iconClass: 'text-[var(--accent-amber)]', accent: 'var(--accent-cyan)', tint: 'rgba(45,226,230,0.06)', desc: `Budget ${fmtMoney(150000)}, research progression, unknown biology.` },
  { id: 'sandbox', label: 'Sandbox', icon: Beaker, iconClass: 'text-[var(--accent-seaglass)]', accent: 'var(--accent-cyan)', tint: 'rgba(45,226,230,0.06)', desc: 'Unlimited funds, all research and biology unlocked.' },
  { id: 'scenario', label: 'Scenarios', icon: Target, iconClass: 'text-[var(--accent-amber)]', accent: 'var(--accent-amber)', tint: 'rgba(242,193,78,0.06)', desc: 'Hand-crafted missions with goals, rewards and fail states.' },
];

// ---------- save slots: data hook + list components ----------

function useSaveSlots() {
  const [saves, setSaves] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setSaves(await game.listSaves());
    } catch (e) {
      setSaves([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const remove = useCallback(async (id, e) => {
    e.stopPropagation();
    try {
      await game.deleteSave(id);
      toast.info('Save deleted');
      refresh();
    } catch (err) {
      toast.error('Delete failed');
    }
  }, [refresh]);

  return { saves, loading, remove };
}

function SaveSlot({ save, onLoad, onDelete }) {
  return (
    <button data-testid={`save-slot-${save.id}`} onClick={() => onLoad(save.id)}
      className="w-full text-left px-4 py-3 border-b border-[var(--line)] hover:bg-[var(--panel-2)] transition-colors group">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-[var(--text-1)] truncate">{save.park_name}</span>
        <span onClick={(e) => onDelete(save.id, e)} className="opacity-0 group-hover:opacity-100 text-[var(--danger)] transition-opacity p-1" data-testid={`delete-save-${save.id}`}>
          <Trash2 size={13} />
        </span>
      </div>
      <div className="mono text-[10px] text-[var(--text-3)] mt-0.5">
        CYCLE {save.day} · {fmtMoney(save.cash)} · {save.creatures} ORGANISMS · {save.mode.toUpperCase()}
      </div>
    </button>
  );
}

function SavesPanel({ onLoad }) {
  const { saves, loading, remove } = useSaveSlots();
  return (
    <div className="nl-panel h-full max-h-[76vh] flex flex-col overflow-hidden">
      <div className="nl-panel-header px-4 py-3 flex items-center gap-2">
        <FolderOpen size={14} className="text-[var(--text-3)]" />
        <span className="mono text-[10px] tracking-[0.2em] text-[var(--text-3)]">ARCHIVED FACILITIES</span>
      </div>
      <div className="flex-1 overflow-y-auto nl-scroll" data-testid="save-list">
        {loading && <div className="p-4 text-xs text-[var(--text-3)]">Querying secure storage…</div>}
        {!loading && saves.length === 0 && (
          <div className="p-4 text-xs text-[var(--text-3)]">No archived facilities. Saves made in-game will appear here.</div>
        )}
        {saves.map((sv) => <SaveSlot key={sv.id} save={sv} onLoad={onLoad} onDelete={remove} />)}
      </div>
    </div>
  );
}

// ---------- mode + scenario selection ----------

function ModeSelector({ mode, onSelect }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {MODES.map((m) => {
        const Icon = m.icon;
        const active = mode === m.id;
        return (
          <button key={m.id} data-testid={`mode-${m.id}`} onClick={() => onSelect(m.id)}
            className="rounded-lg border p-3 text-left transition-colors"
            style={{ borderColor: active ? m.accent : 'var(--line)', background: active ? m.tint : 'var(--panel-2)' }}>
            <div className="flex items-center gap-2 text-sm font-semibold"><Icon size={14} className={m.iconClass} /> {m.label}</div>
            <div className="text-[11px] text-[var(--text-3)] mt-1">{m.desc}</div>
          </button>
        );
      })}
    </div>
  );
}

function completedScenarios() {
  try { return JSON.parse(localStorage.getItem('aetherion_scenarios_done') || '{}'); } catch (e) { return {}; }
}

function ScenarioCard({ scenario, selected, done, onSelect }) {
  return (
    <button data-testid={`scenario-card-${scenario.id}`} onClick={() => onSelect(scenario.id)}
      className="rounded-lg border p-2.5 text-left transition-colors"
      style={{
        borderColor: selected ? 'var(--accent-amber)' : 'var(--line)',
        background: selected ? 'rgba(242,193,78,0.06)' : 'var(--panel-2)',
      }}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] font-semibold text-[var(--text-1)] truncate">{scenario.name}</span>
        {done && <CheckCircle2 size={13} className="text-[var(--success)] shrink-0" data-testid={`scenario-done-${scenario.id}`} />}
      </div>
      <div className="flex items-center gap-2 mt-0.5">
        <span className="mono text-[9px] tracking-wider" style={{ color: DIFF_COLORS[scenario.difficulty] }}>{scenario.difficulty}</span>
        <span className="mono text-[9px] text-[var(--accent-amber)]">+◈{scenario.reward.toLocaleString()}</span>
      </div>
      <div className="text-[10px] text-[var(--text-3)] mt-1 leading-snug line-clamp-2">{scenario.tagline}</div>
    </button>
  );
}

function ScenarioPicker({ selected, onSelect }) {
  const done = completedScenarios();
  const current = SCENARIO_LIST.find((sc) => sc.id === selected);
  return (
    <>
      <div className="grid grid-cols-2 gap-2" data-testid="scenario-picker">
        {SCENARIO_LIST.map((sc) => (
          <ScenarioCard key={sc.id} scenario={sc} selected={selected === sc.id} done={!!done[sc.id]} onSelect={onSelect} />
        ))}
      </div>
      <div className="text-[11px] text-[var(--text-2)] leading-relaxed px-0.5" data-testid="scenario-desc">
        {current?.desc}
      </div>
    </>
  );
}

// ---------- new game form ----------

function NewGamePanel({ onStart }) {
  const [parkName, setParkName] = useState('Aetherion Reserve');
  const [mode, setMode] = useState('management');
  const [scenarioId, setScenarioId] = useState(SCENARIO_LIST[0].id);

  const start = () => onStart({
    parkName: parkName.trim() || 'Aetherion Reserve',
    mode: mode === 'scenario' ? 'management' : mode,
    scenarioId: mode === 'scenario' ? scenarioId : undefined,
  });

  return (
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
      <ModeSelector mode={mode} onSelect={setMode} />
      {mode === 'scenario' && <ScenarioPicker selected={scenarioId} onSelect={setScenarioId} />}
      <button
        data-testid="start-game-button"
        onClick={start}
        className="w-full h-11 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-colors hover:opacity-90"
        style={{ background: 'var(--accent-cyan)', color: '#061014' }}>
        <Play size={16} /> BEGIN OPERATIONS
      </button>
    </div>
  );
}

// ---------- menu ----------

export default function MainMenu({ onStart, onLoad }) {
  return (
    <div className="w-full h-full flex items-center justify-center relative overflow-hidden" style={MENU_BG} data-testid="main-menu">
      {/* ambient grid */}
      <div className="absolute inset-0 opacity-[0.07]" style={GRID_BG} />
      <div className="absolute bottom-0 left-0 right-0 h-40" style={GLOW_BG} />

      <div className="relative z-10 w-[880px] max-w-[94vw] grid grid-cols-5 gap-6">
        <div className="col-span-3">
          <div className="mono text-[11px] tracking-[0.4em] text-[var(--accent-cyan)] mb-2">AETHERION INITIATIVE · SITE-04</div>
          <h1 className="text-5xl font-bold text-[var(--text-1)] leading-tight">Aetherion<br />Reserve</h1>
          <p className="text-[var(--text-2)] mt-4 text-sm leading-relaxed max-w-[420px]">
            Humanity has recovered organisms it does not understand. Build the worlds they need,
            learn how they live by watching them, contain what must be contained — and keep the
            lights on while you do it.
          </p>
          <NewGamePanel onStart={onStart} />
        </div>

        <div className="col-span-2">
          <SavesPanel onLoad={onLoad} />
        </div>
      </div>
    </div>
  );
}
