import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, CheckCircle2, Circle, Trophy, Skull, Target, Gem } from 'lucide-react';
import { game } from '@/game/controller';
import { SCENARIOS } from '@/game/data/scenarios';
import { ackScenario } from '@/game/scenarios';
import { useGameTick } from '@/components/game/useGame';
import { Button } from '@/components/ui/button';

const BACKDROP_STYLE = { background: 'rgba(5,7,11,0.85)' };
const TITLE_STYLE = { color: 'var(--accent-amber)' };

function markCompleted(id) {
  try {
    const done = JSON.parse(localStorage.getItem('aetherion_scenarios_done') || '{}');
    if (!done[id]) {
      done[id] = true;
      localStorage.setItem('aetherion_scenarios_done', JSON.stringify(done));
    }
  } catch (e) { /* storage unavailable */ }
}

const endDialogBody = (won, def, sc) => {
  if (won) return `Every objective met. A commendation grant of ◈${def.reward.toLocaleString()} has been transferred. The reserve is yours to keep building.`;
  const failLabel = def.fails.find((f) => f.id === sc.failedBy)?.label || 'A fail condition was met';
  return `${failLabel}. The Board has suspended the mission — you may keep managing the site in freeplay.`;
};

function EndDialog({ def, sc, onDismiss, onExit }) {
  const won = sc.status === 'won';
  const mastery = won && def.mastery ? def.mastery : null;
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center" style={BACKDROP_STYLE}
      data-testid={won ? 'scenario-victory-dialog' : 'scenario-defeat-dialog'}>
      <div className="nl-panel w-[480px] max-w-[92vw] p-6 text-center space-y-4">
        {won
          ? <Trophy size={40} className="mx-auto text-[var(--accent-amber)]" />
          : <Skull size={40} className="mx-auto text-[var(--danger)]" />}
        <div>
          <div className="mono text-[10px] tracking-[0.3em]" style={{ color: won ? 'var(--accent-cyan)' : 'var(--danger)' }}>
            {won ? 'SCENARIO COMPLETE' : 'SCENARIO FAILED'}
          </div>
          <div className="text-xl font-bold text-[var(--text-1)] mt-1">{def.name}</div>
        </div>
        <p className="text-sm text-[var(--text-2)] leading-relaxed">{endDialogBody(won, def, sc)}</p>
        {mastery && (
          <div className="text-left rounded border border-[var(--line)] bg-[var(--panel-2)] p-3 space-y-1.5" data-testid="scenario-mastery-results">
            <div className="mono text-[9px] tracking-[0.25em] text-[var(--accent-amber)] flex items-center gap-1.5">
              <Gem size={11} /> MASTERY · {mastery.filter((m) => sc.mastery?.[m.id]).length}/{mastery.length}
            </div>
            {mastery.map((m) => {
              const earned = !!sc.mastery?.[m.id];
              return (
                <div key={m.id} className="flex gap-2 items-start" data-testid={`scenario-mastery-${m.id}`} data-earned={earned ? 'true' : 'false'}>
                  {earned
                    ? <CheckCircle2 size={12} className="text-[var(--accent-amber)] mt-0.5 shrink-0" />
                    : <Circle size={12} className="text-[var(--text-3)] mt-0.5 shrink-0" />}
                  <span className={`text-[11px] leading-snug ${earned ? 'text-[var(--text-1)]' : 'text-[var(--text-3)]'}`}>{m.label}</span>
                </div>
              );
            })}
          </div>
        )}
        <div className="flex gap-3 justify-center pt-1">
          <Button data-testid="scenario-continue-button" onClick={onDismiss}
            className="h-9 px-4 text-xs bg-[var(--accent-cyan)] text-[#04141A] hover:bg-[var(--accent-cyan)]/85">
            Continue in freeplay
          </Button>
          <Button data-testid="scenario-exit-button" onClick={onExit} variant="outline"
            className="h-9 px-4 text-xs border-[var(--line-2)] text-[var(--text-2)] bg-transparent hover:bg-[var(--panel-2)]">
            Return to menu
          </Button>
        </div>
      </div>
    </div>
  );
}

function GoalRow({ goal, done }) {
  return (
    <div className="flex gap-2 items-start" data-testid={`scenario-goal-${goal.id}`} data-done={done ? 'true' : 'false'}>
      {done
        ? <CheckCircle2 size={13} className="text-[var(--success)] mt-0.5 shrink-0" />
        : <Circle size={13} className="text-[var(--text-3)] mt-0.5 shrink-0" />}
      <span className={`text-[11px] leading-snug ${done ? 'text-[var(--text-3)] line-through' : 'text-[var(--text-1)]'}`}>{goal.label}</span>
    </div>
  );
}

function TrackerBody({ def, sc, s }) {
  return (
    <div className="px-3 py-2 space-y-1.5">
      {def.goals.map((g) => <GoalRow key={g.id} goal={g} done={!!sc.progress[g.id]} />)}
      <div className="pt-1.5 mt-0.5 border-t border-[var(--line)] space-y-1">
        {def.fails.map((f) => (
          <div key={f.id} className="text-[10px] mono text-[var(--danger)] opacity-80">✕ FAIL: {f.label}</div>
        ))}
      </div>
      {def.mastery && (
        <div className="pt-1.5 mt-0.5 border-t border-[var(--line)] space-y-1" data-testid="scenario-mastery-tracker">
          <div className="mono text-[9px] tracking-[0.25em] text-[var(--accent-amber)] flex items-center gap-1">
            <Gem size={10} /> MASTERY · OPTIONAL
          </div>
          {def.mastery.map((m) => {
            const onTrack = s ? !!m.check(s) : false;
            return (
              <div key={m.id} className="flex gap-1.5 items-start" data-testid={`scenario-mastery-row-${m.id}`}>
                <Gem size={10} className={`mt-0.5 shrink-0 ${onTrack ? 'text-[var(--accent-amber)]' : 'text-[var(--text-3)] opacity-50'}`} />
                <span className={`text-[10px] leading-snug ${onTrack ? 'text-[var(--text-2)]' : 'text-[var(--text-3)]'}`}>{m.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ScenarioTracker({ onExit }) {
  useGameTick();
  const [open, setOpen] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const s = game.state;
  const sc = s?.scenario;
  const def = sc ? SCENARIOS[sc.id] : null;

  useEffect(() => {
    if (sc && sc.status === 'won') markCompleted(sc.id);
  }, [sc, sc?.status]);

  if (!s || !sc || !def) return null;

  const goalsDone = def.goals.filter((g) => sc.progress[g.id]).length;
  const ended = sc.status !== 'active';

  return (
    <>
      <div className="absolute right-14 top-16 z-20 w-[300px]" data-testid="scenario-tracker">
        <div className="nl-panel overflow-hidden">
          <button className="w-full nl-panel-header px-3 py-2 flex items-center justify-between" onClick={() => setOpen(!open)} data-testid="scenario-tracker-toggle">
            <span className="mono text-[10px] tracking-[0.2em] flex items-center gap-1.5" style={TITLE_STYLE}>
              <Target size={12} /> MISSION · {def.name.toUpperCase()} {goalsDone}/{def.goals.length}
            </span>
            {open ? <ChevronUp size={14} className="text-[var(--text-3)]" /> : <ChevronDown size={14} className="text-[var(--text-3)]" />}
          </button>
          {open && <TrackerBody def={def} sc={sc} s={s} />}
        </div>
      </div>
      {ended && !dismissed && !sc.ack && (
        <EndDialog def={def} sc={sc}
          onDismiss={() => { ackScenario(game.state); setDismissed(true); }}
          onExit={onExit} />
      )}
    </>
  );
}
