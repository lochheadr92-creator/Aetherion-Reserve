import { Rocket, UserCog, Database, FlaskConical, Coins } from 'lucide-react';

// Persistent left dock (56px): one button per management screen. Same lucide icons as the
// HudBar entries; testids are `dock-` prefixed so the HudBar's original five stay unique.
export const DOCK_ITEMS = [
  { id: 'fieldops', label: 'Field Ops', short: 'OPS', icon: Rocket, testId: 'dock-open-fieldops-button' },
  { id: 'staff', label: 'Staff', short: 'STAFF', icon: UserCog, testId: 'dock-open-staff-button' },
  { id: 'db', label: 'Species', short: 'SPEC', icon: Database, testId: 'dock-species-database-open-button' },
  { id: 'research', label: 'Research', short: 'RSRCH', icon: FlaskConical, testId: 'dock-open-research-button' },
  { id: 'finances', label: 'Finances', short: 'FIN', icon: Coins, testId: 'dock-open-finances-button' },
];

export const OpsDock = ({ active, onOpen }) => (
  <nav
    data-testid="ops-dock"
    aria-label="Operations deck"
    className="ops-dock absolute left-0 top-14 bottom-0 w-14 z-30 flex flex-col items-center gap-1.5 pt-2 border-r border-[var(--line)]"
  >
    {DOCK_ITEMS.map(({ id, label, short, icon: Icon, testId }) => {
      const selected = active === id;
      return (
        <button
          key={id}
          type="button"
          data-testid={testId}
          data-active={selected ? 'true' : 'false'}
          aria-pressed={selected}
          aria-label={label}
          title={label}
          onClick={() => onOpen(id)}
          className="nl-tool w-11 h-11 flex flex-col items-center justify-center gap-0.5 !rounded-[6px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        >
          <Icon size={16} />
          <span className="mono text-[7px] tracking-[0.12em] leading-none">{short}</span>
        </button>
      );
    })}
  </nav>
);

export default OpsDock;
