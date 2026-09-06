import { useEffect, useRef } from 'react';
import { renderPortrait, portraitPose } from '@/game/renderer';
import { getCreatureSheet } from '@/game/art/creatures';
import { REDUCED_MOTION } from '@/game/fx';

// ---------- shared live-portrait ticker ----------
// One requestAnimationFrame loop drives every mounted live portrait at ~25Hz; a portrait only
// repaints when its idle frame or blink state actually changes (a few draws per second each),
// skips while scrolled out of view (IntersectionObserver) or while the tab is hidden, and the
// loop stops entirely when the last live portrait unmounts. Render-only: nothing here touches
// the sim. Exposed as window.__portraitLive (count) for the test suites.
const live = new Set();
let rafId = 0;
let lastTick = 0;

function tick(now) {
  rafId = 0;
  if (!live.size) return;
  if (!document.hidden && now - lastTick >= 40) {
    lastTick = now;
    for (const fn of live) fn(now);
  }
  rafId = requestAnimationFrame(tick);
}

function subscribe(fn) {
  live.add(fn);
  if (!rafId) rafId = requestAnimationFrame(tick);
  if (typeof window !== 'undefined') window.__portraitLive = live.size;
  return () => {
    live.delete(fn);
    if (typeof window !== 'undefined') window.__portraitLive = live.size;
  };
}

// deterministic per-species phase so a list of portraits never blinks in unison
function phaseFor(speciesId, stage) {
  let h = 7;
  const s = `${speciesId}:${stage}`;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 9973;
  return h / 9973 * 6;
}

// Species portrait. The backing store is rendered at 2x the CSS size so the
// crisp Phase G sprites keep whole pixels in small list thumbnails.
// `stage` picks the derived juvenile sheet ('cub' | 'young') for young specimens.
// `live` (default true) animates the idle/blink loop; reduced-motion users get a still frame.
export const Portrait = ({ speciesId, size = 64, stage = 'adult', live: wantLive = true, className = '' }) => {
  const ref = useRef(null);
  const animated = wantLive && !REDUCED_MOTION;

  // first paint (and repaint on identity changes) — always frame 0, eyes open
  useEffect(() => {
    if (ref.current) renderPortrait(ref.current, speciesId, stage);
  }, [speciesId, size, stage]);

  useEffect(() => {
    if (!animated || !ref.current) return undefined;
    const canvas = ref.current;
    const sheet = getCreatureSheet(speciesId, stage);
    if (!sheet || (sheet.idle.length < 2 && !sheet.blink)) return undefined;
    const phase = phaseFor(speciesId, stage);
    let visible = true;
    let last = { frame: 0, blink: false };
    const io = typeof IntersectionObserver !== 'undefined'
      ? new IntersectionObserver((entries) => { visible = entries.some((e) => e.isIntersecting); }, { threshold: 0 })
      : null;
    if (io) io.observe(canvas);
    const unsubscribe = subscribe((now) => {
      if (!visible) return;
      const pose = portraitPose(sheet, now, phase);
      if (pose.frame === last.frame && pose.blink === last.blink) return;
      last = pose;
      renderPortrait(canvas, speciesId, stage, pose);
    });
    return () => { unsubscribe(); if (io) io.disconnect(); };
  }, [animated, speciesId, stage, size]);

  return (
    <canvas
      ref={ref}
      width={size * 2}
      height={size * 2}
      style={{ width: size, height: size }}
      className={`rounded-md border border-[var(--line)] ${className}`}
      data-testid={`portrait-${speciesId}`}
      data-stage={stage}
      data-live={animated ? 'on' : 'off'}
    />
  );
};

export default Portrait;
