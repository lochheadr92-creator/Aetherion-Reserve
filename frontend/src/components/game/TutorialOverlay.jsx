import { useState, useEffect } from 'react';
import { Compass, Mountain, Fence, Rocket, Eye, Target, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { game } from '@/game/controller';

const STEPS = [
  {
    id: 'welcome',
    icon: Compass,
    title: 'Welcome to the Aetherion Initiative',
    body: 'You run a containment facility for organisms humanity does not yet understand. Your job: build the worlds they need, learn how they live, keep them contained — and keep the lights on.',
    tip: 'Camera: hold the RIGHT mouse button to pan. Scroll to zoom. SPACE pauses time; 1 and 3 set speed.',
  },
  {
    id: 'terrain',
    icon: Mountain,
    title: 'Shape the land',
    body: 'The toolbar (bottom-left) is your construction kit. Under TERRAIN you can raise, lower, flatten and smooth the ground. GROUND paints substrates like rock, sand or wetland. WATER and FLORA complete the ecosystem.',
    tip: 'Every edit costs money and can be undone with Ctrl+Z. Habitats are built, not decorated — terrain genuinely matters to creatures.',
  },
  {
    id: 'containment',
    icon: Fence,
    title: 'Build containment',
    body: 'Use FENCES to enclose an area completely — any gap and it is not an enclosure. Click and DRAG to draw a straight wall in one stroke; a single click places one segment. Add a GATE so keepers can enter. Place a feeder and (for some species) a shelter inside. PATHS connect everything for your guests.',
    tip: 'Drag four walls to box in an area, then click it with the Select tool to see its full analysis: terrain composition, water coverage, security rating.',
  },
  {
    id: 'acquisition',
    icon: Rocket,
    title: 'Acquire the unknown',
    body: 'FIELD OPS (top bar) recovers creatures from survey zones. After purchase, click inside an enclosure to release them. Start with the Skitterling — the only species we fully understand.',
    tip: 'Most species arrive with UNKNOWN biology. You will not be told what they need. That is the point.',
  },
  {
    id: 'discovery',
    icon: Eye,
    title: 'Observe. Hypothesise. Discover.',
    body: 'Creatures reveal their needs through behaviour: swimming, climbing, hiding, socialising. Evidence accumulates into FIELD HYPOTHESES, then BIOLOGICAL BREAKTHROUGHS. The Species Database tracks everything you have learned — and everything you have not.',
    tip: 'Low welfare with an "unclear cause"? Watch the creature. Or fund a Field Study in the Research screen.',
  },
  {
    id: 'operations',
    icon: Target,
    title: 'Run the park',
    body: 'Build the Administration Nexus and paths so guests arrive. Viewing platforms only earn their keep if creatures are actually visible. Storms and nightfall change everything — guests flee storms, and bioluminescent species shine after dark.',
    tip: 'Follow the DIRECTIVES panel (top-left) — it walks you through your first facility, step by step. Good luck, Director.',
  },
];

export default function TutorialOverlay({ onClose, firstTime }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (firstTime && game.state) game.setPaused(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finish = () => {
    localStorage.setItem('aetherion_tutorial_done', '1');
    if (firstTime && game.state) game.setPaused(false);
    onClose();
  };

  const s = STEPS[step];
  const Icon = s.icon;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(5,7,11,0.78)' }} data-testid="tutorial-overlay">
      <div className="nl-panel w-[620px] max-w-[92vw] overflow-hidden nl-scan">
        <div className="nl-panel-header flex items-center justify-between px-4 py-3">
          <span className="mono text-[10px] tracking-[0.25em] text-[var(--accent-cyan)]">FIELD ORIENTATION — {step + 1} / {STEPS.length}</span>
          <button data-testid="tutorial-skip-button" onClick={finish} className="nl-tool w-7 h-7 flex items-center justify-center" title="Skip orientation">
            <X size={13} />
          </button>
        </div>
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl border border-[rgba(45,226,230,0.35)] bg-[rgba(45,226,230,0.07)] flex items-center justify-center shrink-0">
              <Icon size={22} className="text-[var(--accent-cyan)]" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[var(--text-1)]" data-testid="tutorial-step-title">{s.title}</h2>
              <p className="text-sm text-[var(--text-2)] mt-2 leading-relaxed">{s.body}</p>
              <div className="mt-3 rounded-lg border border-[var(--line)] bg-[var(--panel-2)] px-3 py-2 text-[12px] text-[var(--text-3)]">
                <span className="mono text-[9px] tracking-[0.2em] text-[var(--accent-seaglass)]">TIP </span>{s.tip}
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between mt-6">
            <div className="flex gap-1.5">
              {STEPS.map((st, i) => (
                <button key={st.id} onClick={() => setStep(i)}
                  aria-label={`Go to step ${i + 1}: ${st.title}`}
                  className="w-2 h-2 rounded-full transition-colors"
                  style={{ background: i === step ? 'var(--accent-cyan)' : 'var(--line-2)' }} />
              ))}
            </div>
            <div className="flex gap-2">
              {step > 0 && (
                <button data-testid="tutorial-back-button" onClick={() => setStep(step - 1)}
                  className="nl-tool h-9 px-4 text-xs flex items-center gap-1"><ChevronLeft size={13} /> Back</button>
              )}
              {step < STEPS.length - 1 ? (
                <button data-testid="tutorial-next-button" onClick={() => setStep(step + 1)}
                  className="h-9 px-5 rounded-lg font-semibold text-xs flex items-center gap-1 hover:opacity-90 transition-opacity"
                  style={{ background: 'var(--accent-cyan)', color: '#061014' }}>
                  Next <ChevronRight size={13} />
                </button>
              ) : (
                <button data-testid="tutorial-finish-button" onClick={finish}
                  className="h-9 px-5 rounded-lg font-semibold text-xs hover:opacity-90 transition-opacity"
                  style={{ background: 'var(--accent-cyan)', color: '#061014' }}>
                  Begin Operations
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
