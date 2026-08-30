import { useState, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
import { MousePointer2, Hand, Hammer, Undo2, Mountain, ArrowDownToLine, AlignVerticalJustifyCenter, Waves, TreePine, Route, Fence, DoorClosed, Building2, Eraser, Lock } from 'lucide-react';
import { game } from '@/game/controller';
import { MATERIALS, VEG, FENCES, COSTS } from '@/game/constants';
import { BUILDINGS } from '@/game/data/buildings';
import { hasResearch } from '@/game/state';
import { undoTerrain, getUndoCount } from '@/game/terrain';
import { useGameTick } from '@/components/game/useGame';

const CATS = [
  { id: 'terrain', label: 'Terrain' },
  { id: 'ground', label: 'Ground' },
  { id: 'water', label: 'Water' },
  { id: 'flora', label: 'Flora' },
  { id: 'paths', label: 'Paths' },
  { id: 'fences', label: 'Fences' },
  { id: 'habitat', label: 'Habitat' },
  { id: 'facilities', label: 'Facilities' },
];

const MATERIAL_LIST = Object.values(MATERIALS);
const VEG_LIST = Object.values(VEG).filter(Boolean);
const FENCE_LIST = Object.values(FENCES);
const BUILDING_LIST = Object.values(BUILDINGS);
const TERRAIN_TOOLS = [
  { mode: 'raise', label: 'Raise', icon: Mountain, cost: COSTS.raise, title: 'Raise terrain' },
  { mode: 'lower', label: 'Lower', icon: ArrowDownToLine, cost: COSTS.lower, title: 'Lower terrain' },
  { mode: 'flatten', label: 'Flatten', icon: AlignVerticalJustifyCenter, cost: COSTS.flatten, title: 'Flatten to centre height' },
  { mode: 'smooth', label: 'Smooth', icon: Waves, cost: COSTS.smooth, title: 'Smooth slopes' },
];

const ToolButton = ({ active, onClick, children, testId, disabled, title }) => (
  <button
    data-testid={testId}
    disabled={disabled}
    onClick={onClick}
    data-active={active ? 'true' : 'false'}
    title={title}
    className="nl-tool flex flex-col items-center justify-center gap-1 px-2 py-2 text-[10px] leading-tight min-w-[64px] disabled:opacity-40 disabled:pointer-events-none"
  >
    {children}
  </button>
);

function TerrainSection({ is, setTool }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {TERRAIN_TOOLS.map((t) => (
        <ToolButton key={t.mode} testId={`tool-${t.mode}`} active={is(t.mode)} onClick={() => setTool({ mode: t.mode })} title={`${t.title} — ◈${t.cost}/tile`}>
          <t.icon size={16} /><span>{t.label}</span><span className="mono text-[var(--text-3)]">◈{t.cost}</span>
        </ToolButton>
      ))}
    </div>
  );
}

function GroundSection({ s, is, setTool }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {MATERIAL_LIST.map((m) => {
        const locked = m.locked && !hasResearch(s, m.locked);
        return (
          <ToolButton key={m.id} testId={`paint-${m.key}`} disabled={locked} active={is('paint', { materialId: m.id })}
            onClick={() => setTool({ mode: 'paint', materialId: m.id })} title={locked ? 'Requires Exotic Flora Cultivation research' : `Paint ${m.name} — ◈${m.cost}/tile`}>
            <span className="w-5 h-5 rounded border border-[var(--line-2)]" style={{ background: m.color }} />
            <span>{m.name}</span>
            <span className="mono text-[var(--text-3)]">{locked ? <Lock size={9} className="inline" /> : `◈${m.cost}`}</span>
          </ToolButton>
        );
      })}
    </div>
  );
}

function WaterSection({ s, is, setTool }) {
  const deepUnlocked = hasResearch(s, 'env_hydro');
  return (
    <div className="flex flex-wrap gap-1.5">
      <ToolButton testId="tool-water-shallow" active={is('water', { waterMode: 1 })} onClick={() => setTool({ mode: 'water', waterMode: 1 })} title={`Shallow water — ◈${COSTS.waterShallow}/tile`}>
        <span className="w-5 h-5 rounded border border-[var(--line-2)]" style={{ background: '#0e3a46' }} />
        <span>Shallow</span><span className="mono text-[var(--text-3)]">◈{COSTS.waterShallow}</span>
      </ToolButton>
      <ToolButton testId="tool-water-deep" disabled={!deepUnlocked} active={is('water', { waterMode: 2 })} onClick={() => setTool({ mode: 'water', waterMode: 2 })}
        title={deepUnlocked ? `Deep water — ◈${COSTS.waterDeep}/tile` : 'Requires Hydro-Engineering research'}>
        <span className="w-5 h-5 rounded border border-[var(--line-2)]" style={{ background: '#072030' }} />
        <span>Deep</span><span className="mono text-[var(--text-3)]">{deepUnlocked ? `◈${COSTS.waterDeep}` : <Lock size={9} className="inline" />}</span>
      </ToolButton>
      <ToolButton testId="tool-water-drain" active={is('water', { waterMode: 0 })} onClick={() => setTool({ mode: 'water', waterMode: 0 })} title={`Drain water — ◈${COSTS.waterRemove}/tile`}>
        <Eraser size={16} /><span>Drain</span><span className="mono text-[var(--text-3)]">◈{COSTS.waterRemove}</span>
      </ToolButton>
    </div>
  );
}

function FloraSection({ s, is, setTool }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {VEG_LIST.map((v) => {
        const locked = v.locked && !hasResearch(s, v.locked);
        return (
          <ToolButton key={v.id} testId={`veg-${v.key}`} disabled={locked} active={is('veg', { vegId: v.id })}
            onClick={() => setTool({ mode: 'veg', vegId: v.id })} title={locked ? 'Requires Exotic Flora Cultivation research' : `Plant ${v.name} — ◈${v.cost}/tile`}>
            <TreePine size={16} style={{ color: v.color }} />
            <span>{v.name}</span>
            <span className="mono text-[var(--text-3)]">{locked ? <Lock size={9} className="inline" /> : `◈${v.cost}`}</span>
          </ToolButton>
        );
      })}
      <ToolButton testId="veg-clear" active={is('veg', { vegId: 0 })} onClick={() => setTool({ mode: 'veg', vegId: 0 })} title="Clear vegetation">
        <Eraser size={16} /><span>Clear</span><span className="mono text-[var(--text-3)]">◈{COSTS.vegRemove}</span>
      </ToolButton>
    </div>
  );
}

function PathsSection({ is, setTool }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <ToolButton testId="tool-path" active={is('path')} onClick={() => setTool({ mode: 'path' })} title={`Guest path — ◈${COSTS.path}/tile`}>
        <Route size={16} /><span>Path</span><span className="mono text-[var(--text-3)]">◈{COSTS.path}</span>
      </ToolButton>
      <ToolButton testId="tool-path-remove" active={is('pathRemove')} onClick={() => setTool({ mode: 'pathRemove' })} title="Remove path (50% refund)">
        <Eraser size={16} /><span>Remove</span>
      </ToolButton>
    </div>
  );
}

function FencesSection({ s, is, setTool }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {FENCE_LIST.map((f) => {
        const locked = f.locked && !hasResearch(s, f.locked);
        return (
          <ToolButton key={f.tier} testId={`fence-tier-${f.tier}`} disabled={locked} active={is('fence', { fenceTier: f.tier })}
            onClick={() => setTool({ mode: 'fence', fenceTier: f.tier })}
            title={locked ? `Requires research: ${f.name}` : `${f.name} — ◈${f.cost}/segment · Security T${f.security} · Drag to draw a straight wall`}>
            <Fence size={16} style={{ color: f.color }} />
            <span>{f.name.replace(' Barrier', '').replace(' Containment', '')}</span>
            <span className="mono text-[var(--text-3)]">{locked ? <Lock size={9} className="inline" /> : `◈${f.cost}`}</span>
          </ToolButton>
        );
      })}
      <ToolButton testId="tool-gate" active={is('gate')} onClick={() => setTool({ mode: 'gate' })} title={`Toggle access gate on a fence segment — ◈${COSTS.gate}`}>
        <DoorClosed size={16} /><span>Gate</span><span className="mono text-[var(--text-3)]">◈{COSTS.gate}</span>
      </ToolButton>
      <ToolButton testId="tool-fence-remove" active={is('fenceRemove')} onClick={() => setTool({ mode: 'fenceRemove' })} title="Remove fence — drag along a wall (50% refund)">
        <Eraser size={16} /><span>Remove</span>
      </ToolButton>
      <div data-testid="fence-drag-hint" className="w-full mono text-[9px] tracking-[0.12em] text-[var(--text-3)] pt-0.5">
        DRAG TO DRAW A STRAIGHT WALL · CLICK FOR A SINGLE SEGMENT
      </div>
    </div>
  );
}

function BuildingsSection({ s, cat, is, setTool }) {
  const list = useMemo(
    () => BUILDING_LIST.filter((b) => (cat === 'habitat' ? b.cat === 'habitat' : b.cat !== 'habitat')),
    [cat],
  );
  return (
    <div className="flex flex-wrap gap-1.5">
      {list.map((b) => {
        const locked = b.locked && !hasResearch(s, b.locked);
        return (
          <ToolButton key={b.id} testId={`building-${b.id}`} disabled={locked} active={is('building', { buildingType: b.id })}
            onClick={() => setTool({ mode: 'building', buildingType: b.id })}
            title={locked ? 'Requires research' : `${b.name} — ◈${b.cost} · upkeep ◈${b.upkeep}/cycle · ${b.desc}`}>
            <Building2 size={16} style={{ color: b.light }} />
            <span className="text-center leading-tight">{b.name}</span>
            <span className="mono text-[var(--text-3)]">{locked ? <Lock size={9} className="inline" /> : `◈${b.cost}`}</span>
          </ToolButton>
        );
      })}
    </div>
  );
}

function HeaderRow({ is, setTool, brushSize, setBrush, open, setOpen }) {
  const doUndo = useCallback(() => {
    const r = undoTerrain(game.state);
    if (r.ok) toast.info('Terrain change undone (cost refunded)');
    else toast.error(r.reason);
  }, []);
  return (
    <div className="nl-panel-header flex items-center gap-1 px-2 py-1.5">
      <ToolButton testId="tool-select" active={is('select')} onClick={() => setTool({ mode: 'select' })} title="Select / inspect">
        <MousePointer2 size={16} /><span>Select</span>
      </ToolButton>
      <ToolButton testId="tool-pan" active={is('pan')} onClick={() => setTool({ mode: 'pan' })} title="Pan camera (or drag right mouse)">
        <Hand size={16} /><span>Pan</span>
      </ToolButton>
      <ToolButton testId="tool-demolish" active={is('demolish')} onClick={() => setTool({ mode: 'demolish' })} title="Demolish (50% refund)">
        <Hammer size={16} /><span>Demolish</span>
      </ToolButton>
      <ToolButton testId="tool-undo" onClick={doUndo} disabled={getUndoCount() === 0} title="Undo terrain edit (Ctrl+Z)">
        <Undo2 size={16} /><span>Undo</span>
      </ToolButton>
      <div className="ml-auto flex items-center gap-1 pr-1">
        <span className="mono text-[9px] text-[var(--text-3)] mr-1">BRUSH</span>
        {[1, 2, 3].map((b) => (
          <button key={b} data-testid={`brush-size-${b}`} onClick={() => setBrush(b)}
            className="nl-tool w-7 h-7 mono text-[10px] flex items-center justify-center" data-active={brushSize === b ? 'true' : 'false'}>{b}</button>
        ))}
        <button className="nl-tool w-7 h-7 flex items-center justify-center ml-1" onClick={() => setOpen(!open)} data-testid="toolbar-collapse" title={open ? 'Collapse' : 'Expand'}>
          {open ? '–' : '+'}
        </button>
      </div>
    </div>
  );
}

const SECTIONS = {
  terrain: TerrainSection,
  ground: GroundSection,
  water: WaterSection,
  flora: FloraSection,
  paths: PathsSection,
  fences: FencesSection,
  habitat: BuildingsSection,
  facilities: BuildingsSection,
};

export default function BuildToolbar({ activeTool, setTool }) {
  useGameTick();
  const [cat, setCat] = useState('terrain');
  const [open, setOpen] = useState(true);
  const [brushSize, setBrushSize] = useState(1);
  const s = game.state;

  const is = useCallback(
    (m, extra = {}) => activeTool.mode === m && Object.entries(extra).every(([k, v]) => activeTool[k] === v),
    [activeTool],
  );
  const setBrush = useCallback((sz) => {
    setBrushSize(sz);
    if (window.__gameRenderer) window.__gameRenderer.brushSize = sz;
  }, [setBrushSize]);

  if (!s) return null;
  const Section = SECTIONS[cat] || TerrainSection;

  return (
    <div className="absolute left-3 bottom-3 z-30 w-[480px]" data-testid="build-toolbar">
      <div className="nl-panel overflow-hidden">
        <HeaderRow is={is} setTool={setTool} brushSize={brushSize} setBrush={setBrush} open={open} setOpen={setOpen} />
        {open && (
          <>
            <div className="flex border-b border-[var(--line)] bg-[var(--panel-3)]" data-testid="build-toolbar-category-tabs">
              {CATS.map((c) => (
                <button key={c.id} data-testid={`cat-${c.id}`} onClick={() => setCat(c.id)}
                  className="flex-1 py-2 text-[11px] font-medium transition-colors"
                  style={{
                    color: cat === c.id ? 'var(--accent-cyan)' : 'var(--text-3)',
                    borderBottom: cat === c.id ? '2px solid var(--accent-cyan)' : '2px solid transparent',
                    background: cat === c.id ? 'var(--panel-2)' : 'transparent',
                  }}>{c.label}</button>
              ))}
            </div>
            <div className="p-2 max-h-[200px] overflow-y-auto nl-scroll">
              <Section s={s} cat={cat} is={is} setTool={setTool} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
