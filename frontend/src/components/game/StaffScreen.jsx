import { useCallback } from 'react';
import { toast } from 'sonner';
import { UserPlus, UserMinus, Microscope, HeartPulse, ShieldCheck, MapPin, Radio } from 'lucide-react';
import { game } from '@/game/controller';
import { hireStaff, fireStaff, dailyWages, assignStaffEnclosure } from '@/game/staff';
import { setPolicy } from '@/game/state';
import { computeEnclosures } from '@/game/enclosures';
import { STAFF_ROLE_LIST, STAFF_ROLES, TASK_LABELS } from '@/game/data/staffRoles';
import { fmtMoney } from '@/game/constants';
import { useGameTick } from '@/components/game/useGame';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScreenFrame, useScreenHost } from '@/components/game/ScreenFrame';

const ROLE_ICONS = { xenobiologist: Microscope, biomedical: HeartPulse, warden: ShieldCheck };
const ROLE_COLORS = { xenobiologist: 'var(--accent-seaglass)', biomedical: 'var(--info)', warden: 'var(--warning)' };
// role-relevant report card fields: [reportKey, label]
const ROLE_REPORT = {
  xenobiologist: [['feeds', 'fed'], ['cleans', 'cleaned'], ['observes', 'observed']],
  biomedical: [['treats', 'treated']],
  warden: [['repairs', 'repaired']],
};

function reportLine(st) {
  const fields = ROLE_REPORT[st.role] || [];
  return fields.map(([key, label]) => `${st.report?.[key] || 0} ${label}`).join(' · ');
}

function activityLabel(st) {
  if (st.state === 'working' && st.task) return TASK_LABELS[st.task.type] || 'Working';
  if (st.state === 'moving' && st.task) return `En route — ${(TASK_LABELS[st.task.type] || 'task').toLowerCase()}`;
  return 'Standing by';
}

function HireCard({ def, cash, onHire }) {
  const Icon = ROLE_ICONS[def.id];
  const disabled = game.state?.mode !== 'sandbox' && cash < def.hire;
  return (
    <div className="nl-panel p-3 flex flex-col gap-2" data-testid={`hire-card-${def.id}`}>
      <div className="flex items-center gap-2">
        <Icon size={16} style={{ color: ROLE_COLORS[def.id] }} />
        <div className="text-[13px] font-semibold text-[var(--text-1)]">{def.name}</div>
      </div>
      <div className="text-[11px] text-[var(--text-2)] leading-relaxed flex-1">{def.desc}</div>
      <div className="flex flex-wrap gap-1">
        {def.duties.map((d) => (
          <Badge key={d} variant="outline" className="text-[9px] mono border-[var(--line)] text-[var(--text-3)]">{d}</Badge>
        ))}
      </div>
      <div className="flex items-center justify-between pt-1">
        <div className="mono text-[10px] text-[var(--text-3)]">
          Hire {fmtMoney(def.hire)} · {fmtMoney(def.wage)}/cycle
        </div>
        <Button size="sm" data-testid={`hire-${def.id}-button`} disabled={disabled}
          onClick={() => onHire(def.id)}
          className="h-7 px-3 text-[11px] bg-[var(--accent-cyan)] text-[#04141A] hover:bg-[var(--accent-cyan)]/85">
          <UserPlus size={13} className="mr-1" /> Hire
        </Button>
      </div>
    </div>
  );
}

function AssignSelect({ st, encOptions, onAssign, className = '' }) {
  const assignedId = st.assignedEnclosureId;
  // fence edits can briefly leave an assignment pointing at an open (unlisted) area
  const stale = assignedId != null && !encOptions.some((e) => e.id === assignedId);
  return (
    <Select
      value={assignedId != null ? String(assignedId) : 'none'}
      onValueChange={(v) => onAssign(st.id, v === 'none' ? null : Number(v))}>
      <SelectTrigger data-testid={`staff-assign-select-${st.id}`}
        className={`h-7 shrink-0 px-2 text-[10px] mono border-[var(--line)] bg-[var(--panel-1)] text-[var(--text-2)] ${className}`}>
        <MapPin size={11} className="mr-1 shrink-0" style={{ color: assignedId != null ? 'var(--accent-cyan)' : 'var(--text-3)' }} />
        <SelectValue placeholder="General duties" />
      </SelectTrigger>
      <SelectContent className="border-[var(--line)] bg-[var(--panel-1)]">
        <SelectItem value="none" data-testid={`staff-assign-none-${st.id}`} className="text-[11px] mono">
          General duties
        </SelectItem>
        {stale && (
          <SelectItem value={String(assignedId)} className="text-[11px] mono">
            Enclosure #{assignedId} (area open)
          </SelectItem>
        )}
        {encOptions.map((e) => (
          <SelectItem key={e.id} value={String(e.id)} data-testid={`staff-assign-enc-${st.id}-${e.id}`} className="text-[11px] mono">
            Enclosure #{e.id} · {e.residents} resident{e.residents === 1 ? '' : 's'}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function RosterIdentity({ st, def }) {
  return (
    <div className="min-w-0 flex-1">
      <div className="text-[12px] font-medium text-[var(--text-1)] truncate">{st.name}</div>
      <div className="mono text-[10px] text-[var(--text-3)]">{def.short} · hired cycle {st.hiredDay}</div>
      <div className="mono text-[10px] text-[var(--accent-seaglass)]" data-testid={`staff-report-${st.id}`}>
        {reportLine(st)} this cycle
      </div>
    </div>
  );
}

function FireButton({ st, onFire }) {
  return (
    <button data-testid={`staff-fire-button-${st.id}`} onClick={() => onFire(st.id, st.name)}
      className="nl-tool h-7 w-7 shrink-0 flex items-center justify-center" title="Dismiss">
      <UserMinus size={13} />
    </button>
  );
}

function RosterRow({ st, encOptions, onAssign, onFire }) {
  const compact = useScreenHost() === 'drawer';
  const def = STAFF_ROLES[st.role];
  const Icon = ROLE_ICONS[st.role];
  const activity = <div className="mono text-[10px] text-[var(--text-2)]" data-testid={`staff-activity-${st.id}`}>{activityLabel(st)}</div>;
  if (compact) {
    // drawer host: stacked card — identity + dismiss, then status line, then the assignment select
    return (
      <div data-testid={`staff-row-${st.id}`}
        className="flex flex-col gap-2 px-3 py-2 rounded-lg border border-[var(--line)] bg-[var(--panel-2)]">
        <div className="flex items-center gap-2.5">
          <Icon size={15} className="shrink-0" style={{ color: ROLE_COLORS[st.role] }} />
          <RosterIdentity st={st} def={def} />
          <FireButton st={st} onFire={onFire} />
        </div>
        <div className="flex items-center justify-between gap-2">
          {activity}
          <div className="mono text-[10px] text-[var(--text-3)] shrink-0">{fmtMoney(def.wage)}/cyc</div>
        </div>
        <AssignSelect st={st} encOptions={encOptions} onAssign={onAssign} className="w-full" />
      </div>
    );
  }
  return (
    <div data-testid={`staff-row-${st.id}`}
      className="flex items-center gap-3 px-3 py-2 rounded-lg border border-[var(--line)] bg-[var(--panel-2)]">
      <Icon size={15} style={{ color: ROLE_COLORS[st.role] }} />
      <RosterIdentity st={st} def={def} />
      <AssignSelect st={st} encOptions={encOptions} onAssign={onAssign} className="w-[168px]" />
      {activity}
      <div className="mono text-[10px] text-[var(--text-3)] w-20 text-right">{fmtMoney(def.wage)}/cyc</div>
      <FireButton st={st} onFire={onFire} />
    </div>
  );
}

export default function StaffScreen({ onClose }) {
  useGameTick();
  const s = game.state;

  const doHire = useCallback((role) => {
    const r = hireStaff(game.state, role);
    if (r.ok) toast.success(`${STAFF_ROLES[role].name} ${r.staff.name} hired.`);
    else toast.error(r.reason || 'Unable to hire.');
  }, []);

  const doFire = useCallback((id, name) => {
    const r = fireStaff(game.state, id);
    if (r.ok) toast.success(`${name} released from contract.`);
    else toast.error(r.reason || 'Unable to dismiss.');
  }, []);

  const doAssign = useCallback((id, encId) => {
    const r = assignStaffEnclosure(game.state, id, encId);
    if (r.ok) toast.success(encId == null ? 'Returned to general duties.' : `Assigned to Enclosure #${r.enclosureId} — it now gets priority care.`);
    else toast.error(r.reason || 'Unable to assign.');
  }, []);

  if (!s) return null;
  const roster = s.staff || [];
  const wages = dailyWages(s);
  // enclosure list for keeper assignment (computeEnclosures is cached per fence edit)
  const encOptions = computeEnclosures(s).enclosures.map((e) => ({
    id: e.id,
    residents: s.creatures.filter((c) => c.enclosureId === e.id).length,
  }));

  return (
    <ScreenFrame
      testId="staff-modal"
      closeTestId="staff-close-button"
      onClose={onClose}
      eyebrow="PERSONNEL DIVISION"
      subtitle={<span data-testid="staff-summary">{roster.length} on roster · Payroll {fmtMoney(wages)}/cycle</span>}
      actions={(
        <label className="flex items-center gap-2 nl-panel px-2.5 py-1.5 cursor-pointer drawer:w-full drawer:justify-between drawer:shadow-none" title="Assigned keepers call in when they finish work in their pen">
          <span className="flex items-center gap-2">
            <Radio size={13} className="text-[var(--accent-seaglass)]" />
            <span className="mono text-[10px] tracking-[0.15em] text-[var(--text-2)]">RADIO CHATTER</span>
          </span>
          <Switch data-testid="staff-radio-toggle" checked={!!s.policies?.keeperRadio}
            onCheckedChange={(v) => setPolicy(game.state, 'keeperRadio', v)} />
        </label>
      )}
      size="w-[880px] h-[74vh]"
      bodyClassName="p-4 space-y-4 drawer:p-3 drawer:space-y-3"
    >
      <div className="mono text-[10px] tracking-[0.2em] text-[var(--text-3)]">RECRUITMENT</div>
      <div className="grid grid-cols-3 gap-3 drawer:grid-cols-1">
        {STAFF_ROLE_LIST.map((def) => (
          <HireCard key={def.id} def={def} cash={s.cash} onHire={doHire} />
        ))}
      </div>

      <div className="mono text-[10px] tracking-[0.2em] text-[var(--text-3)] pt-2">ACTIVE ROSTER</div>
      {roster.length > 0 && (
        <div className="text-[10px] text-[var(--text-3)]" data-testid="staff-priority-hint">
          Assign a keeper to an enclosure to prioritise its care — they help elsewhere when their area needs nothing.
        </div>
      )}
      {roster.length === 0 && (
        <div className="text-xs text-[var(--text-3)] py-4" data-testid="staff-empty">
          No personnel on site. Hire staff to automate feeding, cleaning, treatment and barrier repair.
        </div>
      )}
      <div className="space-y-1.5">
        {roster.map((st) => <RosterRow key={st.id} st={st} encOptions={encOptions} onAssign={doAssign} onFire={doFire} />)}
      </div>
    </ScreenFrame>
  );
}
