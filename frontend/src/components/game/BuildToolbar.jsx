import { useState } from 'react';
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

const Tool = ({ active, onClick, children, testId, disabled, title }) => (
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

export default function BuildToolbar({ activeTool, setTool }) {
  useGameTick();
  const [cat, setCat] = useState('terrain');
  const [open, setOpen] = useState(true);
  const [brushSize, setBrushSize] = useState(1);
  const s = game.state;
  if (!s) return null;

  const is = (m, extra = {}) => activeTool.mode === m && Object.entries(extra).every(([k, v]) => activeTool[k] === v);
  const setBrush = (sz) => {
    setBrushSize(sz);
    if (window.__gameRenderer) window.__gameRenderer.brushSize = sz;
  };

  const doUndo = () => {
    const r = undoTerrain(s);
    if (r.ok) toast.info('Terrain change undone (cost refunded)');
    else toast.error(r.reason);
  };

  return (
    <div className="absolute left-3 bottom-3 z-30 w-[480px]" data-testid="build-toolbar">
      <div className="nl-panel overflow-hidden">
        <div className="nl-panel-header flex items-center gap-1 px-2 py-1.5">
          <Tool testId="tool-select" active={is('select')} onClick={() => setTool({ mode: 'select' })} title="Select / inspect">
            <MousePointer2 size={16} /><span>Select</span>
          </Tool>
          <Tool testId="tool-pan" active={is('pan')} onClick={() => setTool({ mode: 'pan' })} title="Pan camera (or drag right mouse)">
            <Hand size={16} /><span>Pan</span>
          </Tool>
          <Tool testId="tool-demolish" active={is('demolish')} onClick={() => setTool({ mode: 'demolish' })} title="Demolish (50% refund)">
            <Hammer size={16} /><span>Demolish</span>
          </Tool>
          <Tool testId="tool-undo" onClick={doUndo} disabled={getUndoCount() === 0} title="Undo terrain edit (Ctrl+Z)">
            <Undo2 size={16} /><span>Undo</span>
          </Tool>
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
              {cat === 'terrain' && (
                <div className="flex flex-wrap gap-1.5">
                  <Tool testId="tool-raise" active={is('raise')} onClick={() => setTool({ mode: 'raise' })} title={`Raise terrain — ◈${COSTS.raise}/tile`}>
                    <Mountain size={16} /><span>Raise</span><span className="mono text-[var(--text-3)]">◈{COSTS.raise}</span>
                  </Tool>
                  <Tool testId="tool-lower" active={is('lower')} onClick={() => setTool({ mode: 'lower' })} title={`Lower terrain — ◈${COSTS.lower}/tile`}>
                    <ArrowDownToLine size={16} /><span>Lower</span><span className="mono text-[var(--text-3)]">◈{COSTS.lower}</span>
                  </Tool>
                  <Tool testId="tool-flatten" active={is('flatten')} onClick={() => setTool({ mode: 'flatten' })} title={`Flatten to centre height — ◈${COSTS.flatten}/tile`}>
                    <AlignVerticalJustifyCenter size={16} /><span>Flatten</span><span className="mono text-[var(--text-3)]">◈{COSTS.flatten}</span>
                  </Tool>
                  <Tool testId="tool-smooth" active={is('smooth')} onClick={() => setTool({ mode: 'smooth' })} title={`Smooth slopes — ◈${COSTS.smooth}/tile`}>
                    <Waves size={16} /><span>Smooth</span><span className="mono text-[var(--text-3)]">◈{COSTS.smooth}</span>
                  </Tool>
                </div>
              )}

              {cat === 'ground' && (
                <div className="flex flex-wrap gap-1.5">
                  {Object.values(MATERIALS).map((m) => {
                    const locked = m.locked && !hasResearch(s, m.locked);
                    return (
                      <Tool key={m.id} testId={`paint-${m.key}`} disabled={locked} active={is('paint', { materialId: m.id })}
                        onClick={() => setTool({ mode: 'paint', materialId: m.id })} title={locked ? 'Requires Exotic Flora Cultivation research' : `Paint ${m.name} — ◈${m.cost}/tile`}>
                        <span className="w-5 h-5 rounded border border-[var(--line-2)]" style={{ background: m.color }} />
                        <span>{m.name}</span>
                        <span className="mono text-[var(--text-3)]">{locked ? <Lock size={9} className="inline" /> : `◈${m.cost}`}</span>
                      </Tool>
                    );
                  })}
                </div>
              )}

              {cat === 'water' && (
                <div className="flex flex-wrap gap-1.5">
                  <Tool testId="tool-water-shallow" active={is('water', { waterMode: 1 })} onClick={() => setTool({ mode: 'water', waterMode: 1 })} title={`Shallow water — ◈${COSTS.waterShallow}/tile`}>
                    <span className="w-5 h-5 rounded border border-[var(--line-2)]" style={{ background: '#0e3a46' }} />
                    <span>Shallow</span><span className="mono text-[var(--text-3)]">◈{COSTS.waterShallow}</span>
                  </Tool>
                  <Tool testId="tool-water-deep" disabled={!hasResearch(s, 'env_hydro')} active={is('water', { waterMode: 2 })} onClick={() => setTool({ mode: 'water', waterMode: 2 })}
                    title={hasResearch(s, 'env_hydro') ? `Deep water — ◈${COSTS.waterDeep}/tile` : 'Requires Hydro-Engineering research'}>
                    <span className="w-5 h-5 rounded border border-[var(--line-2)]" style={{ background: '#072030' }} />
                    <span>Deep</span><span className="mono text-[var(--text-3)]">{hasResearch(s, 'env_hydro') ? `◈${COSTS.waterDeep}` : <Lock size={9} className="inline" />}</span>
                  </Tool>
                  <Tool testId="tool-water-drain" active={is('water', { waterMode: 0 })} onClick={() => setTool({ mode: 'water', waterMode: 0 })} title={`Drain water — ◈${COSTS.waterRemove}/tile`}>
                    <Eraser size={16} /><span>Drain</span><span className="mono text-[var(--text-3)]">◈{COSTS.waterRemove}</span>
                  </Tool>
                </div>
              )}

              {cat === 'flora' && (
                <div className="flex flex-wrap gap-1.5">
                  {Object.values(VEG).filter(Boolean).map((v) => {
                    const locked = v.locked && !hasResearch(s, v.locked);
                    return (
                      <Tool key={v.id} testId={`veg-${v.key}`} disabled={locked} active={is('veg', { vegId: v.id })}
                        onClick={() => setTool({ mode: 'veg', vegId: v.id })} title={locked ? 'Requires Exotic Flora Cultivation research' : `Plant ${v.name} — ◈${v.cost}/tile`}>
                        <TreePine size={16} style={{ color: v.color }} />
                        <span>{v.name}</span>
                        <span className="mono text-[var(--text-3)]">{locked ? <Lock size={9} className="inline" /> : `◈${v.cost}`}</span>
                      </Tool>
                    );
                  })}
                  <Tool testId="veg-clear" active={is('veg', { vegId: 0 })} onClick={() => setTool({ mode: 'veg', vegId: 0 })} title="Clear vegetation">
                    <Eraser size={16} /><span>Clear</span><span className="mono text-[var(--text-3)]">◈{COSTS.vegRemove}</span>
                  </Tool>
                </div>
              )}

              {cat === 'paths' && (
                <div className="flex flex-wrap gap-1.5">
                  <Tool testId="tool-path" active={is('path')} onClick={() => setTool({ mode: 'path' })} title={`Guest path — ◈${COSTS.path}/tile`}>
                    <Route size={16} /><span>Path</span><span className="mono text-[var(--text-3)]">◈{COSTS.path}</span>
                  </Tool>
                  <Tool testId="tool-path-remove" active={is('pathRemove')} onClick={() => setTool({ mode: 'pathRemove' })} title="Remove path (50% refund)">
                    <Eraser size={16} /><span>Remove</span>
                  </Tool>
                </div>
              )}

              {cat === 'fences' && (
                <div className="flex flex-wrap gap-1.5">
                  {Object.values(FENCES).map((f) => {
                    const locked = f.locked && !hasResearch(s, f.locked);
                    return (
                      <Tool key={f.tier} testId={`fence-tier-${f.tier}`} disabled={locked} active={is('fence', { fenceTier: f.tier })}
                        onClick={() => setTool({ mode: 'fence', fenceTier: f.tier })}
                        title={locked ? `Requires research: ${f.name}` : `${f.name} — ◈${f.cost}/segment · Security T${f.security}`}>
                        <Fence size={16} style={{ color: f.color }} />
                        <span>{f.name.replace(' Barrier', '').replace(' Containment', '')}</span>
                        <span className="mono text-[var(--text-3)]">{locked ? <Lock size={9} className="inline" /> : `◈${f.cost}`}</span>
                      </Tool>
                    );
                  })}
                  <Tool testId="tool-gate" active={is('gate')} onClick={() => setTool({ mode: 'gate' })} title={`Toggle access gate on a fence segment — ◈${COSTS.gate}`}>
                    <DoorClosed size={16} /><span>Gate</span><span className="mono text-[var(--text-3)]">◈{COSTS.gate}</span>
                  </Tool>
                  <Tool testId="tool-fence-remove" active={is('fenceRemove')} onClick={() => setTool({ mode: 'fenceRemove' })} title="Remove fence (50% refund)">
                    <Eraser size={16} /><span>Remove</span>
                  </Tool>
                </div>
              )}

              {(cat === 'habitat' || cat === 'facilities') && (
                <div className="flex flex-wrap gap-1.5">
                  {Object.values(BUILDINGS).filter((b) => (cat === 'habitat' ? b.cat === 'habitat' : b.cat !== 'habitat')).map((b) => {
                    const locked = b.locked && !hasResearch(s, b.locked);
                    return (
                      <Tool key={b.id} testId={`building-${b.id}`} disabled={locked} active={is('building', { buildingType: b.id })}
                        onClick={() => setTool({ mode: 'building', buildingType: b.id })}
                        title={locked ? 'Requires research' : `${b.name} — ◈${b.cost} · upkeep ◈${b.upkeep}/cycle · ${b.desc}`}>
                        <Building2 size={16} style={{ color: b.light }} />
                        <span className="text-center leading-tight">{b.name}</span>
                        <span className="mono text-[var(--text-3)]">{locked ? <Lock size={9} className="inline" /> : `◈${b.cost}`}</span>
                      </Tool>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
