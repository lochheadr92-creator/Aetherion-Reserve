import { useState } from 'react';
import { toast } from 'sonner';
import { Pause, Play, Bell, Database, FlaskConical, Coins, Rocket, Save, DoorOpen, Users, Star, Sun, Moon, Sunset, Cloud, CloudRain, HelpCircle } from 'lucide-react';
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

export default function HudBar({ onOpenModal, onExit, onNavigate, onHelp }) {
  useGameTick();
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const s = game.state;
  if (!s) return null;
  const unread = s.alerts.filter((a) => !a.read).length;
  const stars = Math.round(s.rating.overall * 5 * 10) / 10;
  const { phase } = getDayPhase(s.tick);
  const wType = s.weather?.type || 'clear';
  const WeatherIcon = wType === 'storm' ? CloudRain : phase === 'night' ? Moon : phase === 'dusk' ? Sunset : wType === 'overcast' ? Cloud : Sun;
  const weatherColor = wType === 'storm' ? 'var(--info)' : phase === 'night' ? 'var(--accent-violet)' : phase === 'dusk' ? 'var(--accent-amber)' : wType === 'overcast' ? 'var(--text-3)' : 'var(--accent-amber)';
  const weatherLabel = `${phase.toUpperCase()}${wType !== 'clear' ? ' \u00b7 ' + wType.toUpperCase() : ''}`;

  const doSave = async () => {
    setSaving(true);
    try {
      await game.saveGame();
      toast.success('Facility state archived to secure storage.');
    } catch (e) {
      toast.error('Save failed — backend unreachable.');
    }
    setSaving(false);
  };

  return (
    <div className="absolute top-0 left-0 right-0 z-30">
      <div className="nl-panel !rounded-none !rounded-b-none border-t-0 border-x-0 flex items-center gap-3 px-4 h-14">
        {/* left: identity */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-2 h-2 rounded-full" style={{ background: 'var(--accent-cyan)', boxShadow: '0 0 8px rgba(45,226,230,0.8)' }} />
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate text-[var(--text-1)]" data-testid="hud-park-name">{s.parkName}</div>
            <div className="mono text-[10px] text-[var(--text-3)] tracking-wider">
              CYCLE {s.day} · {s.mode === 'sandbox' ? 'SANDBOX' : 'MANAGEMENT'}
            </div>
          </div>
        </div>

        {/* center: time controls */}
        <div className="flex items-center gap-1 mx-auto">
          <button data-testid="hud-time-pause-button" onClick={() => game.setPaused(!s.paused)}
            className="nl-tool h-9 w-9 flex items-center justify-center" data-active={s.paused ? 'true' : 'false'} title="Pause (Space)">
            {s.paused ? <Play size={15} /> : <Pause size={15} />}
          </button>
          <button data-testid="hud-speed-1-button" onClick={() => game.setSpeed(1)}
            className="nl-tool h-9 px-3 mono text-xs" data-active={!s.paused && s.speed === 1 ? 'true' : 'false'} title="Normal speed (1)">1×</button>
          <button data-testid="hud-speed-3-button" onClick={() => game.setSpeed(3)}
            className="nl-tool h-9 px-3 mono text-xs" data-active={!s.paused && s.speed === 3 ? 'true' : 'false'} title="Fast speed (3)">3×</button>
          <div
            className="flex items-center gap-1.5 px-3 h-9 rounded-lg border border-[var(--line)] bg-[var(--panel-2)] ml-2"
            data-testid="hud-weather-chip"
            title="Weather & time affect the park: storms send guests home, damage exposed barriers and stress unsheltered creatures. At night fewer guests arrive and visibility drops — but bioluminescent species glow."
          >
            <WeatherIcon size={14} style={{ color: weatherColor }} />
            <span className="mono text-[10px] text-[var(--text-2)] tracking-wider" data-testid="hud-weather-label">{weatherLabel}</span>
            <span className="mono text-[10px] text-[var(--text-3)]" data-testid="hud-clock">{clockLabel(s.tick)}</span>
          </div>
        </div>

        {/* right: KPIs + menus */}
        <div className="flex items-center gap-2">
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
          <div className="flex items-center gap-1.5 px-3 h-9 rounded-lg border border-[var(--line)] bg-[var(--panel-2)]" title={`Park rating — welfare ${(s.rating.comp.welfare * 100 || 0).toFixed(0)}%, guests ${(s.rating.comp.guestSat * 100 || 0).toFixed(0)}%, discoveries ${(s.rating.comp.discoveries * 100 || 0).toFixed(0)}%`}>
            <Star size={14} className="text-[var(--accent-seaglass)]" />
            <span className="mono text-xs" data-testid="hud-rating">{stars.toFixed(1)}</span>
          </div>

          <div className="w-px h-6 bg-[var(--line)]" />

          <HudButton icon={Rocket} label="Field Ops" testId="open-fieldops-button" onClick={() => onOpenModal('fieldops')} />
          <HudButton icon={Database} label="Species" testId="species-database-open-button" onClick={() => onOpenModal('db')} />
          <HudButton icon={FlaskConical} label="Research" testId="open-research-button" onClick={() => onOpenModal('research')} />
          <HudButton icon={Coins} label="Finances" testId="open-finances-button" onClick={() => onOpenModal('finances')} />

          <div className="relative">
            <button data-testid="hud-alerts-button" onClick={() => { setAlertsOpen(!alertsOpen); s.alerts.forEach((a) => { a.read = true; }); }}
              className="nl-tool h-9 w-9 flex items-center justify-center relative" title="Alert feed">
              <Bell size={15} />
              {unread > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 rounded-full bg-[var(--danger)] text-[#14060B] text-[9px] mono font-semibold flex items-center justify-center px-1">
                  {unread}
                </span>
              )}
            </button>
            {alertsOpen && (
              <div className="absolute right-0 top-11 w-[380px] max-h-[420px] overflow-y-auto nl-scroll nl-panel z-50" data-testid="alerts-dropdown">
                <div className="nl-panel-header px-3 py-2 mono text-[10px] tracking-[0.2em] text-[var(--text-3)]">ALERT FEED</div>
                {s.alerts.length === 0 && <div className="px-3 py-4 text-xs text-[var(--text-3)]">No alerts. The facility is quiet… for now.</div>}
                {s.alerts.map((a) => (
                  <button key={a.id} onClick={() => { setAlertsOpen(false); onNavigate(a.target); }}
                    className="w-full text-left px-3 py-2 border-b border-[var(--line)] hover:bg-[var(--panel-2)] transition-colors">
                    <div className="mono text-[10px] tracking-wider" style={{
                      color: a.type === 'danger' ? 'var(--danger)' : a.type === 'warning' ? 'var(--warning)' : a.type === 'breakthrough' ? 'var(--accent-cyan)' : a.type === 'success' ? 'var(--success)' : 'var(--info)',
                    }}>{a.title}</div>
                    <div className="text-xs text-[var(--text-2)] mt-0.5">{a.msg}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <HudButton icon={Save} label={saving ? 'Saving…' : 'Save'} testId="hud-save-button" onClick={doSave} />
          <HudButton icon={HelpCircle} label="Help" testId="hud-help-button" onClick={onHelp} />
          <HudButton icon={DoorOpen} label="Menu" testId="hud-exit-button" onClick={onExit} />
        </div>
      </div>
    </div>
  );
}
