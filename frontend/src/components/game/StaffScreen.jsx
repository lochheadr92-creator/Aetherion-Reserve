import { useCallback } from 'react';
import { toast } from 'sonner';
import { X, UserPlus, UserMinus, Microscope, HeartPulse, ShieldCheck, MapPin } from 'lucide-react';
import { game } from '@/game/controller';
import { hireStaff, fireStaff, dailyWages, assignStaffEnclosure } from '@/game/staff';
import { computeEnclosures } from '@/game/enclosures';
import { STAFF_ROLE_LIST, STAFF_ROLES, TASK_LABELS } from '@/game/data/staffRoles';
import { fmtMoney } from '@/game/constants';
import { useGameTick } from '@/components/game/useGame';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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

function RosterRow({ st, encOptions, onAssign, onFire }) {
  const def = STAFF_ROLES[st.role];
  const Icon = ROLE_ICONS[st.role];
  const assignedId = st.assignedEnclosureId;
  // fence edits can briefly leave an assignment pointing at an open (unlisted) area
  const stale = assignedId != null && !encOptions.some((e) => e.id === assignedId);
  return (
    <div data-testid={`staff-row-${st.id}`}
      className="flex items-center gap-3 px-3 py-2 rounded-lg border border-[var(--line)] bg-[var(--panel-2)]">
      <Icon size={15} style={{ color: ROLE_COLORS[st.role] }} />
      <div className="min-w-0 flex-1">
        <div className="text-[12px] font-medium text-[var(--text-1)]">{st.name}</div>
        <div className="mono text-[10px] text-[var(--text-3)]">{def.short} · hired cycle {st.hiredDay}</div>
        <div className="mono text-[10px] text-[var(--accent-seaglass)]" data-testid={`staff-report-${st.id}`}>
          {reportLine(st)} this cycle
        </div>
      </div>
      <Select
        value={assignedId != null ? String(assignedId) : 'none'}
        onValueChange={(v) => onAssign(st.id, v === 'none' ? null : Number(v))}>
        <SelectTrigger data-testid={`staff-assign-select-${st.id}`}
          className="h-7 w-[168px] shrink-0 px-2 text-[10px] mono border-[var(--line)] bg-[var(--panel-1)] text-[var(--text-2)]">
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
      <div className="mono text-[10px] text-[var(--text-2)]" data-testid={`staff-activity-${st.id}`}>{activityLabel(st)}</div>
      <div className="mono text-[10px] text-[var(--text-3)] w-20 text-right">{fmtMoney(def.wage)}/cyc</div>
      <button data-testid={`staff-fire-button-${st.id}`} onClick={() => onFire(st.id, st.name)}
        className="nl-tool h-7 w-7 flex items-center justify-center" title="Dismiss">
        <UserMinus size={13} />
      </button>
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
    <div className="absolute inset-0 z-40 flex items-center justify-center" style={{ background: 'rgba(5,7,11,0.8)' }} data-testid="staff-modal">
      <div className="nl-panel w-[880px] max-w-[95vw] h-[74vh] flex flex-col overflow-hidden">
        <div className="nl-panel-header flex items-center justify-between px-4 py-3">
          <div>
            <div className="mono text-[10px] tracking-[0.25em] text-[var(--accent-cyan)]">PERSONNEL DIVISION</div>
            <div className="text-sm text-[var(--text-2)] mt-0.5" data-testid="staff-summary">
              {roster.length} on roster · Payroll {fmtMoney(wages)}/cycle
            </div>
          </div>
          <button data-testid="staff-close-button" onClick={onClose} className="nl-tool w-8 h-8 flex items-center justify-center"><X size={15} /></button>
        </div>

        <div className="flex-1 overflow-y-auto nl-scroll p-4 space-y-4">
          <div className="mono text-[10px] tracking-[0.2em] text-[var(--text-3)]">RECRUITMENT</div>
          <div className="grid grid-cols-3 gap-3">
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
        </div>
      </div>
    </div>
  );
}
