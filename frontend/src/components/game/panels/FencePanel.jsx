import { Trash2, Wrench, LifeBuoy } from 'lucide-react';
import { toast } from 'sonner';
import { game } from '@/game/controller';
import { FENCES } from '@/game/constants';
import { repairFence, removeFence, toggleGate } from '@/game/construction';
import Bar from '@/components/game/panels/Bar';

export default function FencePanel({ sel, onClose }) {
  const s = game.state;
  const f = s.fences[`${sel.x},${sel.y},${sel.d}`];
  if (!f) return <div className="p-4 text-xs text-[var(--text-3)]">Fence removed.</div>;
  const def = FENCES[f.tier];

  const repair = () => {
    const r = repairFence(s, sel.x, sel.y, sel.d);
    if (!r.ok) toast.error(r.reason);
    else toast.success('Fence repaired');
  };
  const gate = () => {
    const r = toggleGate(s, sel.x, sel.y, sel.d);
    if (!r.ok) toast.error(r.reason);
  };
  const remove = () => {
    removeFence(s, sel.x, sel.y, sel.d);
    onClose();
  };

  return (
    <div className="flex flex-col gap-3 p-4" data-testid="fence-panel">
      <div>
        <div className="text-base font-semibold">{def.name}{f.gate ? ' — Gate' : ''}</div>
        <div className="mono text-[10px] text-[var(--text-3)]">SECURITY TIER {def.security}</div>
      </div>
      <Bar label="Integrity" value={f.hp / def.hp} testId="fence-integrity" />
      <div className="flex gap-2">
        <button data-testid="fence-repair-button" onClick={repair}
          className="nl-tool flex-1 h-8 text-[11px] flex items-center justify-center gap-1"><Wrench size={12} /> Repair</button>
        <button data-testid="fence-gate-button" onClick={gate}
          className="nl-tool flex-1 h-8 text-[11px] flex items-center justify-center gap-1"><LifeBuoy size={12} /> {f.gate ? 'Remove Gate' : 'Add Gate ◈150'}</button>
        <button data-testid="fence-remove-button" onClick={remove}
          className="nl-tool flex-1 h-8 text-[11px] flex items-center justify-center gap-1 !text-[var(--danger)]"><Trash2 size={12} /> Remove</button>
      </div>
    </div>
  );
}
