import { MoonStar, Lightbulb } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';
import { game } from '@/game/controller';
import { setTicketPrice, setPolicy } from '@/game/state';
import { Switch } from '@/components/ui/switch';
import { useGameTick } from '@/components/game/useGame';
import { fmtMoney } from '@/game/constants';
import { parkValue } from '@/game/economy';
import { lightingReport, NIGHT_LIT_BONUS, NIGHT_DARK_PENALTY } from '@/game/lighting';
import { ScreenFrame } from '@/components/game/ScreenFrame';

const INCOME_LABELS = { tickets: 'Entry tickets', tours: 'Tours & premiums', food: 'Food sales', drink: 'Drink sales', gift: 'Curio sales', grants: 'Grants & salvage', attractions: 'Attraction tickets', transport: 'Transport fares', lodging: 'Hotel lodging' };
const EXPENSE_LABELS = { upkeep: 'Facility upkeep', feed: 'Creature feed', wages: 'Staff wages', construction: 'Construction', terrain: 'Terraforming', acquisition: 'Acquisitions', research: 'Research', response: 'Emergency response' };

const AXIS_TICK = { fill: '#7F93AD', fontSize: 10, fontFamily: 'IBM Plex Mono' };
const AXIS_LINE = { stroke: '#1B2A3D' };
const TOOLTIP_CONTENT_STYLE = { background: '#0C121B', border: '1px solid #1B2A3D', borderRadius: 8, fontSize: 12 };
const TOOLTIP_LABEL_STYLE = { color: '#B7C4D6' };
const CHART_CURSOR = { fill: 'rgba(45,226,230,0.06)' };
const BAR_RADIUS = [3, 3, 0, 0];

function LedgerRows({ entries, labels, valueClass, prefix }) {
  return entries.map(([k, v]) => (
    <div key={k} className="flex justify-between text-[12px]">
      <span className="text-[var(--text-2)]">{labels[k] || k}</span>
      <span className={`mono ${valueClass}`} data-testid={`${prefix}-${k}`}>{fmtMoney(v)}</span>
    </div>
  ));
}

function TodayLedger({ t, incomeSum, expenseSum }) {
  const net = incomeSum - expenseSum;
  return (
    <>
      <div className="mono text-[10px] tracking-[0.2em] text-[var(--text-3)]">TODAY — INCOME ({fmtMoney(incomeSum)})</div>
      <LedgerRows entries={Object.entries(t.income)} labels={INCOME_LABELS} valueClass="text-[var(--success)]" prefix="income" />
      <div className="mono text-[10px] tracking-[0.2em] text-[var(--text-3)] pt-3">TODAY — EXPENSES ({fmtMoney(expenseSum)})</div>
      <LedgerRows entries={Object.entries(t.expenses)} labels={EXPENSE_LABELS} valueClass="text-[var(--danger)]" prefix="expense" />
      <div className="flex justify-between text-[13px] pt-2 border-t border-[var(--line)]">
        <span className="font-semibold">Net today</span>
        <span className="mono font-semibold" style={{ color: net >= 0 ? 'var(--success)' : 'var(--danger)' }} data-testid="net-today">{fmtMoney(net)}</span>
      </div>
    </>
  );
}

function TicketPricePanel({ s }) {
  return (
    <div className="pt-3">
      <div className="mono text-[10px] tracking-[0.2em] text-[var(--text-3)] mb-1">ENTRY TICKET PRICE</div>
      <div className="flex items-center gap-2">
        <input type="range" min="10" max="60" step="5" value={s.ticketPrice}
          onChange={(e) => { setTicketPrice(s, e.target.value); }}
          className="flex-1 accent-[#2DE2E6]" data-testid="ticket-price-slider" />
        <span className="mono text-xs w-14 text-right" data-testid="ticket-price-value">{fmtMoney(s.ticketPrice)}</span>
      </div>
      <div className="text-[10px] text-[var(--text-3)] mt-1">Higher prices earn more per guest but slow arrivals.</div>
    </div>
  );
}

function NightToursPanel({ s }) {
  return (
    <div className="pt-3 rounded-lg border border-[var(--line)] bg-[var(--panel-2)] p-3 mt-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <MoonStar size={14} className="text-[var(--accent-cyan)]" />
          <span className="mono text-[10px] tracking-[0.2em] text-[var(--text-2)]">NIGHT TOURS</span>
        </div>
        <Switch
          data-testid="night-tours-toggle"
          checked={!!s.policies?.nightTours}
          onCheckedChange={(v) => setPolicy(s, 'nightTours', v)}
        />
      </div>
      <div className="text-[10px] text-[var(--text-3)] mt-1.5 leading-snug">
        Keep the gates open after dark at a +75% admission premium. Guests expect bioluminescent
        exhibits — house glowing species or expect refund demands.
      </div>
    </div>
  );
}

// Why lamps matter: coverage of the walkways, last night's lit vs dark guest visits, and the rating carrot.
function NightLightingPanel({ s }) {
  const r = lightingReport(s);
  const last = r.lastNight.lit + r.lastNight.dark;
  const litShare = last ? Math.round((r.lastNight.lit / last) * 100) : null;
  const coverage = Math.round(r.coverage * 100);
  const coverageTone = coverage >= 70 ? 'var(--success)' : coverage >= 35 ? 'var(--warning)' : 'var(--danger)';
  return (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--panel-2)] p-3 mt-2" data-testid="night-lighting-panel">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Lightbulb size={14} className="text-[var(--accent-amber)]" />
          <span className="mono text-[10px] tracking-[0.2em] text-[var(--text-2)]">NIGHT LIGHTING</span>
        </div>
        <span className="mono text-[10px]" data-testid="lighting-status" data-on={r.night ? 'true' : 'false'} style={{ color: r.night ? 'var(--accent-amber)' : 'var(--text-3)' }}>
          {r.night ? 'LAMPS ON' : r.on ? 'DUSK' : 'DAYLIGHT'}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] mt-2">
        <span className="text-[var(--text-3)]">Lamps</span>
        <span className="mono text-right" data-testid="lighting-lamps">{r.lamps} <span className="text-[var(--text-3)]">(◈{r.upkeep}/cycle)</span></span>
        <span className="text-[var(--text-3)]">Walkway coverage</span>
        <span className="mono text-right" data-testid="lighting-coverage" style={{ color: r.pathTiles ? coverageTone : undefined }}>{r.litPathTiles}/{r.pathTiles} tiles · {coverage}%</span>
        <span className="text-[var(--text-3)]">Last night's visits</span>
        <span className="mono text-right" data-testid="lighting-last-night">
          {last ? <><span className="text-[var(--success)]">{r.lastNight.lit} lit</span> · <span className="text-[var(--danger)]">{r.lastNight.dark} dark</span></> : '—'}
        </span>
        <span className="text-[var(--text-3)]" title="Offsets breach and casualty marks on the rating's safety score (up to +5% at fully lit nights)">Safety mark offset</span>
        <span className="mono text-right" data-testid="lighting-safety-bonus">+{(r.safetyBonus * 100).toFixed(1)}%</span>
      </div>
      <div className="text-[10px] text-[var(--text-3)] mt-1.5 leading-snug">
        After dark, guests on lit paths gain +{(NIGHT_LIT_BONUS * 100).toFixed(1)}% comfort per check; guests in the dark lose {(NIGHT_DARK_PENALTY * 100).toFixed(1)}% and complain.
        {litShare !== null && <> Last night {litShare}% of path visits were lit.</>} Use the Lighting overlay to find the gaps.
      </div>
    </div>
  );
}

function NetHistoryChart({ chart }) {
  return (
    <div>
      <div className="mono text-[10px] tracking-[0.2em] text-[var(--text-3)] mb-2">NET RESULT — LAST {chart.length} CYCLES</div>
      <div className="h-[200px] rounded-lg border border-[var(--line)] bg-[var(--panel-2)] p-2">
        {chart.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-[var(--text-3)]">Complete a full cycle to see financial history.</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart}>
              <XAxis dataKey="day" tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} />
              <YAxis tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} />
              <Tooltip contentStyle={TOOLTIP_CONTENT_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} cursor={CHART_CURSOR} />
              <ReferenceLine y={0} stroke="#24384F" />
              <Bar dataKey="net" radius={BAR_RADIUS}>
                {chart.map((d) => (
                  <Cell key={d.day} fill={d.net >= 0 ? '#3EE28A' : '#FF4D6D'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function GuestFeed({ feed }) {
  return (
    <div>
      <div className="mono text-[10px] tracking-[0.2em] text-[var(--text-3)] mb-2">GUEST COMMS INTERCEPTS</div>
      <div className="space-y-1.5">
        {feed.length === 0 && <div className="text-xs text-[var(--text-3)]">No guest chatter yet — open the park by acquiring creatures and building viewing platforms.</div>}
        {feed.map((f) => (
          <div key={f.id ?? `${f.tick}-${f.text}`} className="flex items-start gap-2 text-[12px]">
            <span className="mt-1 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: f.positive ? 'var(--success)' : 'var(--danger)' }} />
            <span className="text-[var(--text-2)]">“{f.text}”</span>
            <span className="mono text-[9px] text-[var(--text-3)] ml-auto shrink-0 uppercase">{f.arch}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function FinanceScreen({ onClose }) {
  useGameTick();
  const s = game.state;
  if (!s) return null;
  const t = s.finances.today;
  const incomeSum = Object.values(t.income).reduce((a, b) => a + b, 0);
  const expenseSum = Object.values(t.expenses).reduce((a, b) => a + b, 0);
  const chart = s.finances.history.slice(-14).map((h) => ({ day: `C${h.day}`, net: h.net }));
  const feed = s._guestFeed || [];

  return (
    <ScreenFrame
      testId="finances-modal"
      closeTestId="finances-close-button"
      onClose={onClose}
      eyebrow="FISCAL OPERATIONS"
      subtitle={`Cycle ${s.day} · Park value ${fmtMoney(parkValue(s))} · Guest satisfaction ${(s.stats.guestSat * 100).toFixed(0)}%`}
      bodyClassName="p-4 grid grid-cols-3 gap-4 content-start drawer:grid-cols-1 drawer:p-3 drawer:gap-5"
    >
      <div className="space-y-2 min-w-0">
        <TodayLedger t={t} incomeSum={incomeSum} expenseSum={expenseSum} />
        <TicketPricePanel s={s} />
        <NightToursPanel s={s} />
        <NightLightingPanel s={s} />
      </div>
      <div className="col-span-2 space-y-4 min-w-0 drawer:col-span-1">
        <NetHistoryChart chart={chart} />
        <GuestFeed feed={feed} />
      </div>
    </ScreenFrame>
  );
}
