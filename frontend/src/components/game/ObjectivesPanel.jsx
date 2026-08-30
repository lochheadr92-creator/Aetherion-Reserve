import { useState } from 'react';
import { ChevronDown, ChevronUp, CheckCircle2, Circle } from 'lucide-react';
import { game } from '@/game/controller';
import { OBJECTIVES } from '@/game/sim';
import { useGameTick } from '@/components/game/useGame';

export default function ObjectivesPanel() {
  useGameTick();
  const [open, setOpen] = useState(true);
  const s = game.state;
  if (!s || !s.objectives.length) return null;
  const done = s.objectives.filter((o) => o.done).length;
  const upcoming = s.objectives.filter((o) => !o.done).slice(0, 3);

  return (
    <div className="absolute left-3 top-16 z-20 w-[300px]" data-testid="objectives-panel">
      <div className="nl-panel overflow-hidden">
        <button className="w-full nl-panel-header px-3 py-2 flex items-center justify-between" onClick={() => setOpen(!open)} data-testid="objectives-toggle">
          <span className="mono text-[10px] tracking-[0.2em] text-[var(--text-3)]">DIRECTIVES {done}/{s.objectives.length}</span>
          {open ? <ChevronUp size={14} className="text-[var(--text-3)]" /> : <ChevronDown size={14} className="text-[var(--text-3)]" />}
        </button>
        {open && (
          <div className="px-3 py-2 space-y-2">
            {upcoming.length === 0 && <div className="text-xs text-[var(--success)] py-1">All directives complete. The Board is watching with interest.</div>}
            {upcoming.map((o) => {
              const def = OBJECTIVES.find((d) => d.id === o.id);
              if (!def) return null;
              return (
                <div key={o.id} className="flex gap-2 items-start" data-testid={`objective-${o.id}`}>
                  <Circle size={13} className="text-[var(--text-3)] mt-0.5 shrink-0" />
                  <div>
                    <div className="text-xs font-medium text-[var(--text-1)]">{def.name} <span className="mono text-[10px] text-[var(--accent-amber)]">+◈{def.reward.toLocaleString()}</span></div>
                    <div className="text-[11px] text-[var(--text-3)] leading-snug">{def.desc}</div>
                  </div>
                </div>
              );
            })}
            {done > 0 && (
              <div className="flex items-center gap-1.5 pt-1 border-t border-[var(--line)]">
                <CheckCircle2 size={12} className="text-[var(--success)]" />
                <span className="text-[10px] text-[var(--text-3)]">{done} completed</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
