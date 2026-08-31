import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Pause, Play, Bell, Database, FlaskConical, Coins, Rocket, Save, DoorOpen, Users, Star, Sun, Moon, Sunset, Cloud, CloudRain, HelpCircle, UserCog, Camera } from 'lucide-react';
import { game } from '@/game/controller';
import { fmtMoney } from '@/game/constants';
import { getDayPhase, clockLabel } from '@/game/weather';
import { useGameTick } from '@/components/game/useGame';

const HudButton = ({ icon: Icon, label, onClick, testId, active }) => (
  <button
    data-testid={testId}
    onClick={onClick}
    data-active={active ? 'true' : 'false'}
    className="nl-tool flex items-center gap-1.5 h-9 px-3 text-xs font-medium"
    title={label}
  >
    <Icon size={15} />
    <span className="hidden xl:inline">{label}</span>
  </button>
);

function ParkIdentity({ s }) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      <div className="w-2 h-2 rounded-full" style={{ background: 'var(--accent-cyan)', boxShadow: '0 0 8px rgba(45,226,230,0.8)' }} />
      <div className="min-w-0">
        <div className="text-sm font-semibold truncate text-[var(--text-1)]" data-testid="hud-park-name">{s.parkName}</div>
        <div className="mono text-[10px] text-[var(--text-3)] tracking-wider">
          CYCLE {s.day} · {s.mode === 'sandbox' ? 'SANDBOX' : 'MANAGEMENT'}
        </div>
      </div>
    </div>
  );
}

function TimeControls({ s }) {
  return (
    <div className="flex items-center gap-1">
      <button data-testid="hud-time-pause-button" onClick={() => game.setPaused(!s.paused)}
        className="nl-tool h-9 w-9 flex items-center justify-center" data-active={s.paused ? 'true' : 'false'} title="Pause (Space)">
        {s.paused ? <Play size={15} /> : <Pause size={15} />}
      </button>
      <button data-testid="hud-speed-1-button" onClick={() => game.setSpeed(1)}
        className="nl-tool h-9 px-3 mono text-xs" data-active={!s.paused && s.speed === 1 ? 'true' : 'false'} title="Normal speed (1)">1×</button>
      <button data-testid="hud-speed-3-button" onClick={() => game.setSpeed(3)}
        className="nl-tool h-9 px-3 mono text-xs" data-active={!s.paused && s.speed === 3 ? 'true' : 'false'} title="Fast speed (3)">3×</button>
    </div>
  );
}

const WEATHER_TOOLTIP = 'Weather & time affect the park: storms send guests home, damage exposed barriers and stress unsheltered creatures. At night fewer guests arrive and visibility drops — but bioluminescent species glow.';

const WEATHER_VISUALS = {
  storm: { Icon: CloudRain, color: 'var(--info)' },
  night: { Icon: Moon, color: 'var(--accent-violet)' },
  dusk: { Icon: Sunset, color: 'var(--accent-amber)' },
  overcast: { Icon: Cloud, color: 'var(--text-3)' },
  clear: { Icon: Sun, color: 'var(--accent-amber)' },
};

function getWeatherVisual(phase, wType) {
  if (wType === 'storm') return WEATHER_VISUALS.storm;
  if (phase === 'night' || phase === 'dusk') return WEATHER_VISUALS[phase];
  return WEATHER_VISUALS[wType] || WEATHER_VISUALS.clear;
}

function WeatherChip({ s }) {
  const { phase } = getDayPhase(s.tick);
  const wType = s.weather?.type || 'clear';
  const { Icon, color } = getWeatherVisual(phase, wType);
  const label = `${phase.toUpperCase()}${wType !== 'clear' ? ' · ' + wType.toUpperCase() : ''}`;
  return (
    <div className="flex items-center gap-1.5 px-3 h-9 rounded-lg border border-[var(--line)] bg-[var(--panel-2)] ml-2" data-testid="hud-weather-chip" title={WEATHER_TOOLTIP}>
      <Icon size={14} style={{ color }} />
      <span className="mono text-[10px] text-[var(--text-2)] tracking-wider" data-testid="hud-weather-label">{label}</span>
      <span className="mono text-[10px] text-[var(--text-3)]" data-testid="hud-clock">{clockLabel(s.tick)}</span>
    </div>
  );
}

function HudKpis({ s }) {
  const stars = Math.round(s.rating.overall * 5 * 10) / 10;
  const ratingTip = `Park rating — welfare ${((s.rating.comp.welfare || 0) * 100).toFixed(0)}%, guests ${((s.rating.comp.guestSat || 0) * 100).toFixed(0)}%, discoveries ${((s.rating.comp.discoveries || 0) * 100).toFixed(0)}%`;
  return (
    <>
      <div className="flex items-center gap-1.5 px-3 h-9 rounded-lg border border-[var(--line)] bg-[var(--panel-2)]" title="Available funds">
        <Coins size={14} className="text-[var(--accent-amber)]" />
        <span className="mono text-xs text-[var(--text-1)]" data-testid="hud-cash-value" style={{ color: s.cash < 0 ? 'var(--danger)' : undefined }}>
          {fmtMoney(s.cash)}
        </span>
      </div>
      <div className="flex items-center gap-1.5 px-3 h-9 rounded-lg border border-[var(--line)] bg-[var(--panel-2)]" title="Guests in park">
        <Users size={14} className="text-[var(--info)]" />
        <span className="mono text-xs" data-testid="hud-guest-count">{s.guests.length}</span>
      </div>
      <div className="flex items-center gap-1.5 px-3 h-9 rounded-lg border border-[var(--line)] bg-[var(--panel-2)]" title={ratingTip}>
        <Star size={14} className="text-[var(--accent-seaglass)]" />
        <span className="mono text-xs" data-testid="hud-rating">{stars.toFixed(1)}</span>
      </div>
    </>
  );
}

const alertColor = (type) => (
  type === 'danger' ? 'var(--danger)'
    : type === 'warning' ? 'var(--warning)'
      : type === 'breakthrough' ? 'var(--accent-cyan)'
        : type === 'success' ? 'var(--success)' : 'var(--info)'
);

function AlertsDropdown({ alerts, onPick }) {
  return (
    <div className="absolute right-0 top-11 w-[380px] max-h-[420px] overflow-y-auto nl-scroll nl-panel z-50" data-testid="alerts-dropdown">
      <div className="nl-panel-header px-3 py-2 mono text-[10px] tracking-[0.2em] text-[var(--text-3)]">ALERT FEED</div>
      {alerts.length === 0 && <div className="px-3 py-4 text-xs text-[var(--text-3)]">No alerts. The facility is quiet… for now.</div>}
      {alerts.map((a) => (
        <button key={a.id} onClick={() => onPick(a)}
          className="w-full text-left px-3 py-2 border-b border-[var(--line)] hover:bg-[var(--panel-2)] transition-colors">
          <div className="mono text-[10px] tracking-wider" style={{ color: alertColor(a.type) }}>{a.title}</div>
          <div className="text-xs text-[var(--text-2)] mt-0.5">{a.msg}</div>
        </button>
      ))}
    </div>
  );
}

function AlertsBell({ s, onNavigate }) {
  const [open, setOpen] = useState(false);
  const unread = s.alerts.filter((a) => !a.read).length;
  const toggle = useCallback(() => {
    setOpen((o) => !o);
    s.alerts.forEach((a) => { a.read = true; });
  }, [s]);
  const pick = useCallback((a) => {
    setOpen(false);
    onNavigate(a.target);
  }, [onNavigate]);
  return (
    <div className="relative">
      <button data-testid="hud-alerts-button" onClick={toggle}
        className="nl-tool h-9 w-9 flex items-center justify-center relative" title="Alert feed">
        <Bell size={15} />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 rounded-full bg-[var(--danger)] text-[#14060B] text-[9px] mono font-semibold flex items-center justify-center px-1">
            {unread}
          </span>
        )}
      </button>
      {open && <AlertsDropdown alerts={s.alerts} onPick={pick} />}
    </div>
  );
}

export default function HudBar({ onOpenModal, onExit, onNavigate, onHelp, onPhoto }) {
  useGameTick();
  const [saving, setSaving] = useState(false);
  const s = game.state;

  const doSave = useCallback(async () => {
    setSaving(true);
    try {
      await game.saveGame();
      toast.success('Facility state archived to secure storage.');
    } catch (e) {
      toast.error('Save failed — backend unreachable.');
    }
    setSaving(false);
  }, [setSaving]);

  if (!s) return null;

  return (
    <div className="absolute top-0 left-0 right-0 z-30">
      <div className="nl-panel !rounded-none !rounded-b-none border-t-0 border-x-0 flex items-center gap-3 px-4 h-14">
        <ParkIdentity s={s} />
        <div className="flex items-center mx-auto">
          <TimeControls s={s} />
          <WeatherChip s={s} />
        </div>
        <div className="flex items-center gap-2">
          <HudKpis s={s} />
          <div className="w-px h-6 bg-[var(--line)]" />
          <HudButton icon={Rocket} label="Field Ops" testId="open-fieldops-button" onClick={() => onOpenModal('fieldops')} />
          <HudButton icon={UserCog} label="Staff" testId="open-staff-button" onClick={() => onOpenModal('staff')} />
          <HudButton icon={Database} label="Species" testId="species-database-open-button" onClick={() => onOpenModal('db')} />
          <HudButton icon={FlaskConical} label="Research" testId="open-research-button" onClick={() => onOpenModal('research')} />
          <HudButton icon={Coins} label="Finances" testId="open-finances-button" onClick={() => onOpenModal('finances')} />
          <AlertsBell s={s} onNavigate={onNavigate} />
          <HudButton icon={Camera} label="Photo" testId="hud-photo-button" onClick={onPhoto} />
          <HudButton icon={Save} label={saving ? 'Saving…' : 'Save'} testId="hud-save-button" onClick={doSave} />
          <HudButton icon={HelpCircle} label="Help" testId="hud-help-button" onClick={onHelp} />
          <HudButton icon={DoorOpen} label="Menu" testId="hud-exit-button" onClick={onExit} />
        </div>
      </div>
    </div>
  );
}
