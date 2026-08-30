import { X, MoonStar } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';
import { game } from '@/game/controller';
import { setTicketPrice, setPolicy } from '@/game/state';
import { Switch } from '@/components/ui/switch';
import { useGameTick } from '@/components/game/useGame';
import { fmtMoney } from '@/game/constants';
import { parkValue } from '@/game/economy';

const INCOME_LABELS = { tickets: 'Entry tickets', tours: 'Night tour premiums', food: 'Food sales', drink: 'Drink sales', gift: 'Curio sales', grants: 'Grants & salvage' };
const EXPENSE_LABELS = { upkeep: 'Facility upkeep', feed: 'Creature feed', wages: 'Staff wages', construction: 'Construction', terrain: 'Terraforming', acquisition: 'Acquisitions', research: 'Research', response: 'Emergency response' };

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
    <div className="absolute inset-0 z-40 flex items-center justify-center" style={{ background: 'rgba(5,7,11,0.8)' }} data-testid="finances-modal">
      <div className="nl-panel w-[980px] max-w-[95vw] h-[78vh] flex flex-col overflow-hidden">
        <div className="nl-panel-header flex items-center justify-between px-4 py-3">
          <div>
            <div className="mono text-[10px] tracking-[0.25em] text-[var(--accent-cyan)]">FISCAL OPERATIONS</div>
            <div className="text-sm text-[var(--text-2)] mt-0.5">Cycle {s.day} · Park value {fmtMoney(parkValue(s))} · Guest satisfaction {(s.stats.guestSat * 100).toFixed(0)}%</div>
          </div>
          <button data-testid="finances-close-button" onClick={onClose} className="nl-tool w-8 h-8 flex items-center justify-center"><X size={15} /></button>
        </div>
        <div className="flex-1 overflow-y-auto nl-scroll p-4 grid grid-cols-3 gap-4 content-start">
          <div className="space-y-2">
            <div className="mono text-[10px] tracking-[0.2em] text-[var(--text-3)]">TODAY — INCOME ({fmtMoney(incomeSum)})</div>
            {Object.entries(t.income).map(([k, v]) => (
              <div key={k} className="flex justify-between text-[12px]">
                <span className="text-[var(--text-2)]">{INCOME_LABELS[k] || k}</span>
                <span className="mono text-[var(--success)]" data-testid={`income-${k}`}>{fmtMoney(v)}</span>
              </div>
            ))}
            <div className="mono text-[10px] tracking-[0.2em] text-[var(--text-3)] pt-3">TODAY — EXPENSES ({fmtMoney(expenseSum)})</div>
            {Object.entries(t.expenses).map(([k, v]) => (
              <div key={k} className="flex justify-between text-[12px]">
                <span className="text-[var(--text-2)]">{EXPENSE_LABELS[k] || k}</span>
                <span className="mono text-[var(--danger)]" data-testid={`expense-${k}`}>{fmtMoney(v)}</span>
              </div>
            ))}
            <div className="flex justify-between text-[13px] pt-2 border-t border-[var(--line)]">
              <span className="font-semibold">Net today</span>
              <span className="mono font-semibold" style={{ color: incomeSum - expenseSum >= 0 ? 'var(--success)' : 'var(--danger)' }} data-testid="net-today">{fmtMoney(incomeSum - expenseSum)}</span>
            </div>
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
          </div>

          <div className="col-span-2 space-y-4">
            <div>
              <div className="mono text-[10px] tracking-[0.2em] text-[var(--text-3)] mb-2">NET RESULT — LAST {chart.length} CYCLES</div>
              <div className="h-[200px] rounded-lg border border-[var(--line)] bg-[var(--panel-2)] p-2">
                {chart.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-[var(--text-3)]">Complete a full cycle to see financial history.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chart}>
                      <XAxis dataKey="day" tick={{ fill: '#7F93AD', fontSize: 10, fontFamily: 'IBM Plex Mono' }} axisLine={{ stroke: '#1B2A3D' }} tickLine={false} />
                      <YAxis tick={{ fill: '#7F93AD', fontSize: 10, fontFamily: 'IBM Plex Mono' }} axisLine={{ stroke: '#1B2A3D' }} tickLine={false} />
                      <Tooltip contentStyle={{ background: '#0C121B', border: '1px solid #1B2A3D', borderRadius: 8, fontSize: 12 }} labelStyle={{ color: '#B7C4D6' }} cursor={{ fill: 'rgba(45,226,230,0.06)' }} />
                      <ReferenceLine y={0} stroke="#24384F" />
                      <Bar dataKey="net" radius={[3, 3, 0, 0]}>
                        {chart.map((d) => (
                          <Cell key={d.day} fill={d.net >= 0 ? '#3EE28A' : '#FF4D6D'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
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
          </div>
        </div>
      </div>
    </div>
  );
}
