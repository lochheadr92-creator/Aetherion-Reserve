import { Siren, ShieldAlert } from 'lucide-react';
import { game } from '@/game/controller';
import { useGameTick } from '@/components/game/useGame';
import { speciesById } from '@/game/data/species';

const BANNER_STYLE = {
  border: '1px solid rgba(255,77,109,0.55)',
  boxShadow: '0 0 0 1px rgba(255,77,109,0.22), 0 0 24px rgba(255,77,109,0.18)',
  background: 'rgba(24,8,14,0.92)',
  backdropFilter: 'blur(14px)',
};

const MAX_CHIPS = 4;

function EscapeChip({ creature, hunted, onNavigate }) {
  const sp = speciesById(creature.speciesId);
  return (
    <button
      data-testid={`emergency-chip-${creature.id}`}
      onClick={() => onNavigate({ kind: 'creature', id: creature.id })}
      className="mono text-[10px] px-2 py-0.5 rounded border transition-colors hover:bg-[rgba(255,77,109,0.15)]"
      style={{
        borderColor: sp.danger >= 3 ? 'var(--danger)' : 'rgba(255,77,109,0.4)',
        color: hunted ? 'var(--accent-seaglass)' : 'var(--text-1)',
      }}
      title={hunted ? 'Response team en route \u2014 click to view' : 'Click to locate'}
    >
      {creature.name}{sp.danger >= 3 ? ' \u26A0' : ''}{hunted ? ' \u00b7 TEAM EN ROUTE' : ''}
    </button>
  );
}

function EscapeChipRow({ escapes, units, onNavigate }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {escapes.slice(0, MAX_CHIPS).map((c) => (
        <EscapeChip key={c.id} creature={c} hunted={units.some((u) => u.targetId === c.id)} onNavigate={onNavigate} />
      ))}
      {escapes.length > MAX_CHIPS && (
        <span className="mono text-[10px] text-[var(--text-3)]">+{escapes.length - MAX_CHIPS} more</span>
      )}
    </div>
  );
}

function ResponseStatusLine({ hasPost, unitsOut, evacuating }) {
  return (
    <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-3)]" data-testid="emergency-status">
      <ShieldAlert size={11} className="shrink-0" />
      {hasPost
        ? `${unitsOut} response unit${unitsOut === 1 ? '' : 's'} deployed \u2014 \u25C8250 per dispatch`
        : 'No Rapid Response Post \u2014 build one (Facilities tab) or recall manually from the creature panel (\u25C8500)'}
      {evacuating > 0 && (
        <span className="mono text-[var(--warning)]" data-testid="emergency-evacuating">
          {' '}· {evacuating} GUEST{evacuating === 1 ? '' : 'S'} STAMPEDING TO THE EXIT
        </span>
      )}
    </div>
  );
}

export default function EmergencyBanner({ onNavigate }) {
  useGameTick();
  const s = game.state;
  if (!s) return null;
  const escapes = s.creatures.filter((c) => c.escaped);
  if (!escapes.length) return null;
  const hasPost = s.buildings.some((b) => b.type === 'security_post');
  const units = s.security?.units || [];
  const evacuating = s.guests.filter((g) => g.panic).length;

  return (
    <div
      data-testid="emergency-banner"
      className="absolute top-16 left-1/2 -translate-x-1/2 z-40 nl-panel px-4 py-2.5 flex items-center gap-3"
      style={BANNER_STYLE}
    >
      <Siren size={18} className="text-[var(--danger)] animate-pulse shrink-0" />
      <div className="flex flex-col gap-1 min-w-0">
        <div className="mono text-[10px] tracking-[0.25em] text-[var(--danger)]" data-testid="emergency-title">
          CONTAINMENT EMERGENCY — {escapes.length} ASSET{escapes.length > 1 ? 'S' : ''} LOOSE
        </div>
        <EscapeChipRow escapes={escapes} units={units} onNavigate={onNavigate} />
        <ResponseStatusLine hasPost={hasPost} unitsOut={units.length} evacuating={evacuating} />
      </div>
    </div>
  );
}
