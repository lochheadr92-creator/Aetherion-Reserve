import { AlertTriangle, MapPin, ShieldAlert, Radio } from 'lucide-react';
import { game } from '@/game/controller';
import { computeEnclosures } from '@/game/enclosures';
import { speciesById } from '@/game/data/species';
import { isDiscovered } from '@/game/knowledge';
import { FENCES, MATERIALS } from '@/game/constants';
import { gapsFor, openGaps } from '@/game/construction';
import { enclosureTension, assignedKeepers, STRESS } from '@/game/tensionProfile';
import Bar from '@/components/game/panels/Bar';
import { levelTone, hazardTone, relationClass } from '@/components/game/tone';

function CompositionSection({ enc, mats }) {
  return (
    <div>
      <div className="mono text-[10px] tracking-[0.2em] text-[var(--text-3)] mb-2">COMPOSITION</div>
      <div className="space-y-1.5">
        {mats.map(([m, pct]) => (
          <div key={m} className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm border border-[var(--line-2)]" style={{ background: MATERIALS[m].color }} />
            <span className="text-[11px] text-[var(--text-2)] flex-1">{MATERIALS[m].name}</span>
            <span className="mono text-[10px] text-[var(--text-3)]">{(pct * 100).toFixed(0)}%</span>
          </div>
        ))}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 pt-1 text-[11px]">
          <div className="flex justify-between"><span className="text-[var(--text-3)]">Water</span><span className="mono" data-testid="enclosure-water-pct">{(enc.waterPct * 100).toFixed(0)}%</span></div>
          <div className="flex justify-between"><span className="text-[var(--text-3)]">— deep</span><span className="mono">{(enc.waterDeepPct * 100).toFixed(0)}%</span></div>
          <div className="flex justify-between"><span className="text-[var(--text-3)]">Canopy</span><span className="mono">{(enc.forestPct * 100).toFixed(0)}%</span></div>
          <div className="flex justify-between"><span className="text-[var(--text-3)]">Open ground</span><span className="mono">{(enc.openPct * 100).toFixed(0)}%</span></div>
          <div className="flex justify-between"><span className="text-[var(--text-3)]">Avg elevation</span><span className="mono">{enc.avgElev.toFixed(1)}</span></div>
          <div className="flex justify-between"><span className="text-[var(--text-3)]">High ground</span><span className="mono">{(enc.highGroundPct * 100).toFixed(0)}%</span></div>
          <div className="flex justify-between"><span className="text-[var(--text-3)]">Humidity</span><span className="mono">{(enc.humidity * 100).toFixed(0)}%</span></div>
          <div className="flex justify-between"><span className="text-[var(--text-3)]">Temperature</span><span className="mono">{enc.temperature.toFixed(0)}°C</span></div>
        </div>
      </div>
    </div>
  );
}

function SecuritySection({ enc }) {
  return (
    <div>
      <div className="mono text-[10px] tracking-[0.2em] text-[var(--text-3)] mb-1.5">SECURITY</div>
      <div className="text-[11px] space-y-1">
        <div className="flex justify-between"><span className="text-[var(--text-3)]">Weakest barrier</span>
          <span className="mono" style={{ color: enc.minFenceTier === 0 ? 'var(--danger)' : undefined }}>{enc.minFenceTier > 0 ? FENCES[enc.minFenceTier].name : 'NONE'}</span></div>
        <div className="flex justify-between"><span className="text-[var(--text-3)]">Damaged segments</span>
          <span className="mono" style={{ color: enc.damagedSegments ? 'var(--danger)' : 'var(--success)' }}>{enc.damagedSegments}</span></div>
        <div className="flex justify-between"><span className="text-[var(--text-3)]">Feeders</span><span className="mono">{Object.keys(enc.feeders).join(', ') || 'none'}</span></div>
        <div className="flex justify-between"><span className="text-[var(--text-3)]">Shelters</span><span className="mono">{enc.shelters.length}</span></div>
      </div>
    </div>
  );
}

function ResidentsSection({ residents, bySpecies, pairs, onNavigate }) {
  return (
    <div>
      <div className="mono text-[10px] tracking-[0.2em] text-[var(--text-3)] mb-1.5">RESIDENTS ({residents.length})</div>
      {residents.length === 0 && <div className="text-[11px] text-[var(--text-3)]">Empty. Acquire creatures via Field Ops.</div>}
      <div className="space-y-1">
        {Object.entries(bySpecies).map(([sid, list]) => (
          <div key={sid}>
            <div className="text-[11px] font-medium text-[var(--text-2)]">{speciesById(sid).name} ×{list.length}</div>
            {list.map((c) => (
              <button key={c.id} onClick={() => onNavigate({ kind: 'creature', id: c.id })}
                className="w-full flex justify-between text-[11px] px-2 py-1 rounded hover:bg-[var(--panel-2)] transition-colors">
                <span className="text-[var(--text-3)] flex items-center gap-1.5">
                  {c.name}
                  {(c.injured || c.distressed) && <AlertTriangle size={10} className="text-[var(--danger)]" aria-label="distressed" />}
                </span>
                <span className="mono" style={{ color: levelTone(c.welfare) }}>{(c.welfare * 100).toFixed(0)}%</span>
              </button>
            ))}
          </div>
        ))}
      </div>
      {pairs.length > 0 && (
        <div className="mt-2 space-y-1">
          {pairs.map((p) => (
            <div key={p.a + p.b} className="text-[10px] flex items-center gap-1.5">
              {p.status === 'hostile' ? <AlertTriangle size={11} className="text-[var(--danger)]" /> : <span className="w-[11px]" />}
              <span className="text-[var(--text-3)]">{speciesById(p.a).name} + {speciesById(p.b).name}:</span>
              <span className={relationClass(p.status)}>
                {p.status === 'unknown' ? 'RELATIONSHIP UNKNOWN' : p.status.toUpperCase()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- tension (Phase O): what the residents are doing to each other and to the barrier ----

const TENSION_LEVELS = [
  { at: 0.75, label: 'CRITICAL', color: 'var(--danger)' },
  { at: 0.5, label: 'TENSE', color: 'var(--warning)' },
  { at: 0.3, label: 'UNSETTLED', color: 'var(--accent-violet)' },
  { at: -1, label: 'CALM', color: 'var(--success)' },
];
const tensionLevel = (mean, max) => TENSION_LEVELS.find((l) => Math.max(mean, max - 0.15) >= l.at);

// Incompatible mixes the player is entitled to see: confirmed hostility (knowledge), a conflict the
// sim actually recorded here, or the public danger-rating gap (danger is shown on every dossier).
// Undiscovered compat data is never read directly.
function incompatibleMixes(s, encId, speciesIds) {
  const out = [];
  const seen = new Set();
  const push = (a, b, why) => { const k = [a, b].sort().join('|'); if (!seen.has(k)) { seen.add(k); out.push({ a, b, why }); } };
  for (const inc of (s.tension?.incidents || [])) {
    if (inc.encId !== encId) continue;
    const ag = s.creatures.find((c) => c.id === inc.aggressorId), vi = s.creatures.find((c) => c.id === inc.victimId);
    if (ag && vi && ag.speciesId !== vi.speciesId) push(ag.speciesId, vi.speciesId, 'conflict recorded in this pen');
  }
  for (let i = 0; i < speciesIds.length; i++) {
    for (let j = i + 1; j < speciesIds.length; j++) {
      const a = speciesIds[i], b = speciesIds[j];
      if (s.knowledge[a]?.compat?.[b] === 'hostile' || s.knowledge[b]?.compat?.[a] === 'hostile') push(a, b, 'confirmed hostile');
      else if (Math.abs(speciesById(a).danger - speciesById(b).danger) >= 3) push(a, b, 'danger ratings 3+ apart — the larger predator will dominate');
    }
  }
  return out;
}

// Overcrowding is only named once the social needs of that species are documented.
function overcrowdedGroups(s, bySpecies) {
  const out = [];
  for (const [sid, list] of Object.entries(bySpecies)) {
    const sp = speciesById(sid);
    if (list.length > sp.social.max && isDiscovered(s, sid, 'social')) out.push({ sid, count: list.length, max: sp.social.max });
  }
  return out;
}

function WarningRow({ testId, title, detail, tone = 'danger' }) {
  const color = tone === 'danger' ? 'var(--danger)' : 'var(--warning)';
  return (
    <div className="flex gap-2 rounded-lg border px-2.5 py-1.5" data-testid={testId}
      style={{ borderColor: `${color}66`, background: `${color}14` }}>
      <AlertTriangle size={12} className="shrink-0 mt-px" style={{ color }} />
      <div className="min-w-0">
        <div className="mono text-[10px] tracking-[0.12em]" style={{ color }}>{title}</div>
        {detail && <div className="text-[10px] text-[var(--text-2)] leading-snug mt-0.5">{detail}</div>}
      </div>
    </div>
  );
}

function TensionSection({ s, enc, bySpecies }) {
  const t = enclosureTension(s, enc.id);
  const keepers = assignedKeepers(s, enc.id);
  const level = tensionLevel(t.mean, t.max);
  const mixes = incompatibleMixes(s, enc.id, Object.keys(bySpecies));
  const crowded = overcrowdedGroups(s, bySpecies);
  const recentConflicts = (s.tension?.incidents || []).filter((i) => i.encId === enc.id).length;
  const agitated = t.residents.filter((c) => c.stress >= STRESS.aggressionAny).length;
  return (
    <div data-testid="enclosure-tension-section">
      <div className="flex items-center justify-between mb-1.5">
        <span className="mono text-[10px] tracking-[0.2em] text-[var(--text-3)]">TENSION</span>
        <span data-testid="enclosure-tension-status" className="mono text-[9px] tracking-[0.15em] px-1.5 py-0.5 rounded border"
          style={{ borderColor: level.color, color: level.color }}>{level.label}</span>
      </div>
      {t.residents.length === 0 ? (
        <div className="text-[11px] text-[var(--text-3)]">No residents — nothing to stress.</div>
      ) : (
        <div className="space-y-2">
          <Bar label="Mean stress" value={t.mean} testId="enclosure-tension-mean"
            color={hazardTone(t.mean)}
            cause={`Mean ${(t.mean * 100).toFixed(0)}% · peak ${(t.max * 100).toFixed(0)}% — above 70% residents test weak barriers, above 75% they turn on each other`} />
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
            <div className="flex justify-between"><span className="text-[var(--text-3)]">Agitated</span>
              <span className="mono" data-testid="enclosure-tension-agitated" style={{ color: agitated ? 'var(--warning)' : undefined }}>{agitated}</span></div>
            <div className="flex justify-between"><span className="text-[var(--text-3)]">Distressed</span>
              <span className="mono" data-testid="enclosure-tension-distressed" style={{ color: t.distressed ? 'var(--danger)' : undefined }}>{t.distressed}</span></div>
            <div className="flex justify-between"><span className="text-[var(--text-3)]">Injured</span>
              <span className="mono" data-testid="enclosure-tension-injured" style={{ color: t.injured ? 'var(--danger)' : undefined }}>{t.injured}</span></div>
            <div className="flex justify-between"><span className="text-[var(--text-3)]">Testing barrier</span>
              <span className="mono" data-testid="enclosure-tension-breach-risk" style={{ color: t.breachRisk ? 'var(--danger)' : undefined }}>{t.breachRisk}</span></div>
            <div className="flex justify-between"><span className="text-[var(--text-3)]">Recent conflicts</span>
              <span className="mono" data-testid="enclosure-tension-conflicts" style={{ color: recentConflicts ? 'var(--danger)' : undefined }}>{recentConflicts}</span></div>
            <div className="flex justify-between"><span className="text-[var(--text-3)] flex items-center gap-1"><Radio size={10} /> Keepers</span>
              <span className="mono" data-testid="enclosure-tension-keepers" style={{ color: keepers ? 'var(--success)' : 'var(--warning)' }}>{keepers}</span></div>
          </div>
          <div className="space-y-1.5" data-testid="enclosure-tension-warnings">
            {mixes.map((m) => (
              <WarningRow key={m.a + m.b} testId="enclosure-incompatible-warning" title="INCOMPATIBLE SPECIES"
                detail={`${speciesById(m.a).name} + ${speciesById(m.b).name} — ${m.why}. Separate them before the next incident.`} />
            ))}
            {crowded.map((g) => (
              <WarningRow key={g.sid} testId="enclosure-overcrowding-warning" title="OVERCROWDED" tone="warning"
                detail={`${g.count} ${speciesById(g.sid).name} exceed the group maximum of ${g.max}. Crowded residents pick fights.`} />
            ))}
            {t.breachRisk > 0 && (
              <WarningRow testId="enclosure-breach-risk-warning" title="BREACH RISK" tone="warning"
                detail={`${t.breachRisk} resident${t.breachRisk === 1 ? ' is' : 's are'} testing a weakened or under-rated barrier segment. Repair or upgrade it and calm the animal${t.breachRisk === 1 ? '' : 's'}.`} />
            )}
            {keepers === 0 && t.mean >= 0.35 && (
              <WarningRow testId="enclosure-no-keeper-warning" title="NO KEEPER ASSIGNED" tone="warning"
                detail="Assigned keepers slow neglect, settle residents and radio in trouble early." />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---- breached: a destroyed segment leaves the pen physically open until it is rebuilt ----
function BreachedBanner({ gaps, onNavigate }) {
  return (
    <div className="rounded-lg border border-[rgba(255,77,109,0.5)] bg-[rgba(255,77,109,0.08)] px-3 py-2 space-y-1.5" data-testid="enclosure-breached">
      <div className="flex items-center gap-2">
        <ShieldAlert size={14} className="text-[var(--danger)]" />
        <span className="mono text-xs tracking-[0.12em] text-[var(--danger)]">BREACHED — {gaps.length} OPEN SEGMENT{gaps.length === 1 ? '' : 'S'}</span>
      </div>
      <div className="text-[10px] text-[var(--text-2)] leading-snug">
        The barrier was broken through. Residents count as loose until every gap is rebuilt (wardens rebuild automatically; or place a fence on the gap).
      </div>
      <div className="space-y-1">
        {gaps.map((g) => {
          const [x, y] = g.key.split(',').map(Number);
          return (
            <div key={g.key} className="flex items-center justify-between text-[11px]" data-testid="enclosure-gap-row">
              <span className="mono text-[var(--text-3)]">{FENCES[g.tier]?.name || 'Barrier'} · ({x}, {y}) · {g.by === 'collapse' ? 'collapsed' : `broken by ${g.by}`}</span>
              <button data-testid="enclosure-gap-locate-button" onClick={() => onNavigate({ kind: 'tile', x, y })}
                className="nl-tool h-6 px-2 text-[10px] flex items-center gap-1"><MapPin size={10} /> Locate</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// cohabitation intel: only what the sim has actually learned (never raw species data)
function knownPairs(s, speciesIds) {
  const pairs = [];
  for (let i = 0; i < speciesIds.length; i++) {
    for (let j = i + 1; j < speciesIds.length; j++) {
      const a = speciesIds[i], b = speciesIds[j];
      pairs.push({ a, b, status: s.knowledge[a]?.compat?.[b] || 'unknown' });
    }
  }
  return pairs;
}

// Derives the resident/composition view model for one enclosure (module-level helper).
function deriveEnclosureView(s, enc) {
  if (!enc) return null;
  const residents = s.creatures.filter((c) => c.enclosureId === enc.id);
  const bySpecies = {};
  residents.forEach((c) => { bySpecies[c.speciesId] = (bySpecies[c.speciesId] || []).concat(c); });
  const mats = Object.entries(enc.matPct).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const pairs = knownPairs(s, Object.keys(bySpecies));
  return { residents, bySpecies, mats, pairs };
}

export default function EnclosurePanel({ id, onNavigate }) {
  const s = game.state;
  const enc = computeEnclosures(s).enclosures.find((e) => e.id === id);
  const derived = deriveEnclosureView(s, enc);
  const gaps = gapsFor(s, id);

  if (!enc || !derived) {
    // the region opened up (breach): keep the pen inspectable so the player can find and close the gaps
    const open = openGaps(s);
    if (open.length) {
      return (
        <div className="flex flex-col gap-3 p-4" data-testid="enclosure-panel">
          <div>
            <div className="text-base font-semibold">Enclosure #{id}</div>
            <div className="mono text-[10px] text-[var(--text-3)]">CONTAINMENT LOST · PERIMETER OPEN</div>
          </div>
          <BreachedBanner gaps={open} onNavigate={onNavigate} />
        </div>
      );
    }
    return <div className="p-4 text-xs text-[var(--text-3)]">This area is no longer enclosed.</div>;
  }

  return (
    <div className="flex flex-col gap-3 p-4" data-testid="enclosure-panel">
      <div>
        <div className="text-base font-semibold">Enclosure #{enc.id}</div>
        <div className="mono text-[10px] text-[var(--text-3)]">{enc.area} TILES · {enc.gates} GATE(S) · {enc.fenceSegments} SEGMENTS</div>
      </div>
      {gaps.length > 0 && <BreachedBanner gaps={gaps} onNavigate={onNavigate} />}
      <TensionSection s={s} enc={enc} bySpecies={derived.bySpecies} />
      <CompositionSection enc={enc} mats={derived.mats} />
      <SecuritySection enc={enc} />
      <ResidentsSection residents={derived.residents} bySpecies={derived.bySpecies} pairs={derived.pairs} onNavigate={onNavigate} />
    </div>
  );
}
