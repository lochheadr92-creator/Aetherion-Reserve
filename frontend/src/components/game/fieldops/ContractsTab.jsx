import { FileCheck2, FileX2, Timer, Award } from 'lucide-react';
import { toast } from 'sonner';
import { game } from '@/game/controller';
import { acceptContract, declineContract, contractProgress, refreshContracts } from '@/game/contracts';
import { fmtMoney } from '@/game/constants';

function ProgressBar({ pct, done }) {
  return (
    <div className="h-1.5 rounded-full bg-[var(--panel-3)] overflow-hidden">
      <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.round(pct * 100))}%`, background: done ? 'var(--success)' : 'var(--accent-cyan)' }} />
    </div>
  );
}

function ActiveContract({ s, c }) {
  const p = contractProgress(s, c);
  const daysLeft = c.expiresDay - s.day;
  return (
    <div data-testid={`contract-active-${c.id}`} className="rounded-lg border border-[var(--line)] bg-[var(--panel-2)] p-3 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div className="text-xs font-semibold">{c.name}</div>
        <span className="mono text-[10px] text-[var(--success)] shrink-0">{fmtMoney(c.reward)}</span>
      </div>
      <p className="text-[10px] text-[var(--text-3)] leading-snug">{c.desc}</p>
      <ProgressBar pct={p.target ? p.cur / p.target : 0} done={p.done} />
      <div className="flex items-center justify-between mono text-[9px] text-[var(--text-3)]">
        <span data-testid={`contract-progress-${c.id}`}>{p.label}</span>
        <span className="flex items-center gap-1" style={{ color: daysLeft <= 1 ? 'var(--danger)' : 'var(--text-3)' }}>
          <Timer size={9} /> {daysLeft} cycle{daysLeft === 1 ? '' : 's'} left
        </span>
      </div>
    </div>
  );
}

function OfferedContract({ c, canAccept }) {
  const accept = () => {
    const r = acceptContract(game.state, c.id);
    if (!r.ok) toast.error(r.reason);
    else toast.success(`Directive accepted: ${c.name}`);
  };
  const decline = () => declineContract(game.state, c.id);
  return (
    <div data-testid={`contract-offer-${c.id}`} className="rounded-lg border border-[var(--line)] bg-[var(--panel-2)] p-3 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div className="text-xs font-semibold">{c.name}</div>
        <span className="mono text-[10px] text-[var(--success)] shrink-0">{fmtMoney(c.reward)}</span>
      </div>
      <p className="text-[10px] text-[var(--text-3)] leading-snug">{c.desc}</p>
      <div className="flex gap-2">
        <button data-testid={`contract-accept-${c.id}`} disabled={!canAccept} onClick={accept}
          className="flex-1 h-7 rounded font-semibold text-[10px] flex items-center justify-center gap-1 disabled:opacity-40 hover:opacity-90 transition-opacity"
          style={{ background: 'var(--accent-cyan)', color: '#061014' }}>
          <FileCheck2 size={11} /> ACCEPT
        </button>
        <button data-testid={`contract-decline-${c.id}`} onClick={decline}
          className="nl-tool h-7 px-3 text-[10px] flex items-center justify-center gap-1">
          <FileX2 size={11} /> PASS
        </button>
      </div>
    </div>
  );
}

export default function ContractsTab({ s }) {
  const cs = s.contracts;
  if (cs.available.length === 0 && cs.active.length === 0) refreshContracts(s);
  const canAccept = cs.active.length < 3;
  return (
    <div className="grid grid-cols-2 gap-4 content-start" data-testid="contracts-tab">
      <div className="flex flex-col gap-2">
        <div className="mono text-[10px] tracking-[0.2em] text-[var(--text-3)]">ACTIVE DIRECTIVES ({cs.active.length}/3)</div>
        {cs.active.length === 0 && (
          <div className="text-[11px] text-[var(--text-3)] rounded-lg border border-dashed border-[var(--line)] p-4 text-center" data-testid="contracts-active-empty">
            No active directives. Accept offers from Oversight to earn grants.
          </div>
        )}
        {cs.active.map((c) => <ActiveContract key={c.id} s={s} c={c} />)}
        <div className="mono text-[9px] text-[var(--text-3)] flex items-center gap-1 pt-1" data-testid="contracts-completed-count">
          <Award size={10} /> {cs.completed || 0} DIRECTIVE{(cs.completed || 0) === 1 ? '' : 'S'} COMPLETED
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <div className="mono text-[10px] tracking-[0.2em] text-[var(--text-3)]">OVERSIGHT OFFERS — REFRESH CYCLE {cs.nextRefreshDay}</div>
        {cs.available.length === 0 && (
          <div className="text-[11px] text-[var(--text-3)] rounded-lg border border-dashed border-[var(--line)] p-4 text-center">
            New offers arrive on cycle {cs.nextRefreshDay}.
          </div>
        )}
        {cs.available.map((c) => <OfferedContract key={c.id} c={c} canAccept={canAccept} />)}
      </div>
    </div>
  );
}
