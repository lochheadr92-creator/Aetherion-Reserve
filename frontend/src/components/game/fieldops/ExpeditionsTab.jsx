import { Rocket, Clock, AlertTriangle, PackageOpen, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { game } from '@/game/controller';
import { ZONE_LIST, EXPEDITION_ZONES } from '@/game/data/expeditions';
import { launchExpedition, expeditionProgress } from '@/game/expeditions';
import { speciesById } from '@/game/data/species';
import { fmtMoney, TICKS_PER_DAY } from '@/game/constants';
import Portrait from '@/components/game/Portrait';

const RISK_LABEL = { 1: 'LOW', 2: 'MODERATE', 3: 'HIGH' };
const RISK_COLOR = { 1: 'var(--success)', 2: 'var(--warning)', 3: 'var(--danger)' };

function ZoneCard({ zone, s }) {
  const activeCount = s.expeditions.filter((e) => e.status === 'active').length;
  const afford = s.cash >= zone.cost || s.mode === 'sandbox';
  const canLaunch = afford && activeCount < 2;
  const cycles = (zone.duration / TICKS_PER_DAY).toFixed(1);

  const launch = () => {
    const r = launchExpedition(game.state, zone.id);
    if (!r.ok) toast.error(r.reason);
    else toast.success(`Expedition to ${zone.name} launched`);
  };

  return (
    <div data-testid={`zone-card-${zone.id}`} className="rounded-lg border border-[var(--line)] bg-[var(--panel-2)] p-3 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-xs font-semibold flex items-center gap-1.5">
            <MapPin size={12} style={{ color: zone.color }} /> {zone.name}
          </div>
          <div className="mono text-[9px] text-[var(--text-3)]">{zone.code}</div>
        </div>
        <span className="mono text-[9px] px-1.5 py-0.5 rounded border border-[var(--line-2)]" style={{ color: RISK_COLOR[zone.risk] }}>
          RISK {RISK_LABEL[zone.risk]}
        </span>
      </div>
      <p className="text-[10px] text-[var(--text-3)] leading-snug">{zone.desc}</p>
      <div className="flex items-center gap-1">
        {zone.speciesPool.slice(0, 5).map((sid) => (
          <div key={sid} title={speciesById(sid).name}>
            <Portrait speciesId={sid} size={26} />
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between mono text-[10px] text-[var(--text-2)]">
        <span className="flex items-center gap-1"><Clock size={10} /> ~{cycles} cycles</span>
        <span>{fmtMoney(zone.cost)}</span>
      </div>
      <button
        data-testid={`launch-expedition-${zone.id}`}
        disabled={!canLaunch}
        onClick={launch}
        className="h-8 rounded font-semibold text-[11px] flex items-center justify-center gap-1.5 disabled:opacity-40 transition-colors hover:opacity-90"
        style={{ background: 'var(--accent-cyan)', color: '#061014' }}>
        <Rocket size={12} /> {activeCount >= 2 ? 'TEAMS DEPLOYED' : `LAUNCH — ${fmtMoney(zone.cost)}`}
      </button>
    </div>
  );
}

function ActiveExpedition({ exp, onClaimSpecimen }) {
  const zone = EXPEDITION_ZONES[exp.zoneId];
  const prog = expeditionProgress(exp);
  const unclaimed = exp.specimens.filter((sp) => !sp.placed);
  return (
    <div data-testid={`expedition-${exp.id}`} className="rounded-lg border border-[var(--line)] bg-[var(--panel-2)] p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold flex items-center gap-1.5">
          <MapPin size={12} style={{ color: zone.color }} /> {zone.name}
        </div>
        <span className="mono text-[9px]" style={{ color: exp.status === 'returned' ? 'var(--success)' : 'var(--accent-cyan)' }}
          data-testid={`expedition-stage-${exp.id}`}>
          {exp.status === 'returned' ? 'RETURNED' : prog.stageName.toUpperCase()}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-[var(--panel-3)] overflow-hidden">
        <div className="h-full rounded-full transition-transform" style={{ width: `${Math.round(prog.pct * 100)}%`, background: exp.status === 'returned' ? 'var(--success)' : 'var(--accent-cyan)' }} />
      </div>
      {unclaimed.length > 0 && exp.status === 'returned' && (
        <div className="flex flex-col gap-1.5">
          {unclaimed.map((spec) => {
            const sp = speciesById(spec.speciesId);
            return (
              <div key={spec.id} className="flex items-center gap-2">
                <Portrait speciesId={spec.speciesId} size={28} />
                <span className="text-[11px] flex-1">{sp.name}</span>
                <button data-testid={`claim-specimen-${spec.id}`} onClick={() => onClaimSpecimen(exp.id, spec)}
                  className="h-7 px-3 rounded font-semibold text-[10px] flex items-center gap-1 hover:opacity-90 transition-opacity"
                  style={{ background: 'var(--accent-seaglass)', color: '#061014' }}>
                  <PackageOpen size={11} /> CLAIM &amp; RELEASE
                </button>
              </div>
            );
          })}
        </div>
      )}
      <div className="flex flex-col gap-0.5 max-h-[90px] overflow-y-auto nl-scroll" data-testid={`expedition-log-${exp.id}`}>
        {exp.log.map((l, _unused) => (
          <div key={`${l.tick}-${l.msg}`} className="text-[10px] leading-snug flex items-start gap-1">
            {l.type === 'mishap' && <AlertTriangle size={9} className="text-[var(--warning)] mt-0.5 shrink-0" />}
            <span style={{ color: l.type === 'find' ? 'var(--success)' : l.type === 'evidence' ? 'var(--accent-seaglass)' : l.type === 'mishap' ? 'var(--warning)' : 'var(--text-3)' }}>
              {l.msg}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ExpeditionsTab({ s, onClaimSpecimen }) {
  const active = s.expeditions || [];
  return (
    <div className="grid grid-cols-3 gap-3 content-start" data-testid="expeditions-tab">
      <div className="col-span-2 grid grid-cols-2 gap-3 content-start">
        {ZONE_LIST.map((z) => <ZoneCard key={z.id} zone={z} s={s} />)}
      </div>
      <div className="flex flex-col gap-2">
        <div className="mono text-[10px] tracking-[0.2em] text-[var(--text-3)]">FIELD TEAMS ({active.filter((e) => e.status === 'active').length}/2 DEPLOYED)</div>
        {active.length === 0 && (
          <div className="text-[11px] text-[var(--text-3)] rounded-lg border border-dashed border-[var(--line)] p-4 text-center" data-testid="expeditions-empty">
            No expeditions in the field. Launch one to recover specimens, salvage and wild biology data.
          </div>
        )}
        {active.map((exp) => <ActiveExpedition key={exp.id} exp={exp} onClaimSpecimen={onClaimSpecimen} />)}
      </div>
    </div>
  );
}
