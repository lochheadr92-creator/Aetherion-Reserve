import { useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { GameRenderer } from '@/game/renderer';
import { InputController } from '@/game/input';
import { game } from '@/game/controller';
import { audio } from '@/game/audio';
import { RENDER_3D, RENDER_3D_FORCED } from '@/game/art/flags';
import { World3D, webglAvailable, softwareRenderer } from '@/game/three/world';

// Two stacked canvases: the WebGL world (three.js) underneath, the legacy 2D canvas on top as a
// transparent overlay that still owns input, selection, tool previews and HUD markers. When WebGL2
// is unavailable (or ?classic=1) the 2D canvas renders the whole pixel-art world as before.

// ---- module-level runtime helpers (plain functions: keep the mount effect a short orchestration) ----

// 2D renderer + input layer bound to the overlay canvas; exposes the debug/testing handles.
function createRuntime(canvas, callbacks, { rendererRef, inputRef }) {
  const renderer = new GameRenderer(canvas);
  const input = new InputController(canvas, renderer, () => game.state, callbacks);
  if (rendererRef) rendererRef.current = renderer;
  if (inputRef) inputRef.current = input;
  window.__gameRenderer = renderer;
  window.__gameInput = input; // debug/testing access (edge scrolling state)
  return { renderer, input };
}

// Software GL (headless browsers, VMs) cannot run the cinematic pipeline at speed: stay classic
// unless explicitly forced, so automated suites and GPU-less machines keep the fast 2D renderer.
function wants3D(glCanvas) {
  return RENDER_3D && !!glCanvas && webglAvailable() && (RENDER_3D_FORCED || !softwareRenderer());
}

// Build the WebGL world and attach it under the 2D overlay. Returns null (classic mode) on failure.
function tryAttach3D(renderer, glCanvas) {
  try {
    const world = new World3D(glCanvas);
    renderer.attach3D(world);
    window.__world3d = world; // debug/testing access (camera lock verification, stats, quality)
    return world;
  } catch (err) {
    console.warn('[render3d] falling back to the classic renderer:', err && err.message);
    return null;
  }
}

// Detach + dispose the WebGL world; never throws (used from the frame loop's recovery path).
function dropWorld(renderer, world) {
  try { renderer.detach3D(); world.dispose(); } catch (e) { console.warn('[render3d] dispose failed:', e && e.message); }
}

// Both canvases follow the parent element's box; the 3D world resizes its render targets with it.
function fitCanvases(canvas, glCanvas, world) {
  const parent = canvas.parentElement;
  canvas.width = parent.clientWidth;
  canvas.height = parent.clientHeight;
  if (glCanvas) { glCanvas.width = parent.clientWidth; glCanvas.height = parent.clientHeight; }
  if (world) world.setSize(parent.clientWidth, parent.clientHeight);
}

// requestAnimationFrame loop with two-stage error recovery: a broken 3D frame drops the game to the
// classic renderer; a broken classic frame pauses the sim and raises the banner (the loop keeps
// running so the HUD stays usable for save / exit). Returns a stop() function.
function startFrameLoop({ renderer, input, rt, onWorldDropped, onFatal }) {
  let raf = 0;
  let errored = false;
  const seenErrors = new Set(); // a render exception must never stop the loop silently

  const recover = (err) => {
    const msg = (err && err.message) || String(err);
    if (!seenErrors.has(msg)) { seenErrors.add(msg); console.error('[render]', err); }
    if (rt.world && !errored) {
      dropWorld(renderer, rt.world);
      rt.world = null;
      onWorldDropped();
    } else if (!errored) {
      errored = true;
      onFatal();
    }
  };

  const frame = () => {
    if (game.state && renderer.state !== game.state) renderer.setState(game.state);
    try {
      input.frame(); // edge scrolling glides the camera before the frame is drawn
      renderer.render();
      audio.update(game.state); // ambience follows weather / night / breaches (read-only)
    } catch (err) {
      recover(err);
    }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return () => cancelAnimationFrame(raf);
}

// Pause the sim when the view is unrecoverable; tolerate "no active game" on the title screen.
function pauseSimSafely() {
  try { game.setPaused(true); } catch (e) { console.warn('[render] could not pause the sim:', e && e.message); }
}

export const GameCanvas = ({ onSelect, onToolResult, onToolChange, rendererRef, inputRef }) => {
  const canvasRef = useRef(null);
  const glRef = useRef(null);
  // set once, on the first caught frame exception: the loop keeps running so the HUD stays
  // usable (save / exit), but the player is told the view is broken and the sim is paused
  const [renderError, setRenderError] = useState(false);
  const [mode, setMode] = useState(RENDER_3D ? '3d' : 'classic');

  useEffect(() => {
    const canvas = canvasRef.current;
    const glCanvas = glRef.current;
    const { renderer, input } = createRuntime(canvas, { onSelect, onToolResult, onToolChange }, { rendererRef, inputRef });

    // rt.world is shared with the resize handler and the frame loop (which may drop it on error)
    const rt = { world: wants3D(glCanvas) ? tryAttach3D(renderer, glCanvas) : null };
    if (RENDER_3D && !rt.world) setMode('classic');
    window.__renderMode = rt.world ? '3d' : 'classic';

    const resize = () => fitCanvases(canvas, glRef.current, rt.world); // glRef empties once the 3D canvas unmounts
    resize();
    window.addEventListener('resize', resize);

    if (game.state) renderer.setState(game.state);

    const stop = startFrameLoop({
      renderer, input, rt,
      onWorldDropped: () => { window.__renderMode = 'classic'; setMode('classic'); },
      onFatal: () => { setRenderError(true); pauseSimSafely(); },
    });

    return () => {
      stop();
      window.removeEventListener('resize', resize);
      input.detach();
      if (rt.world) dropWorld(renderer, rt.world);
      audio.update(null); // leaving the game screen fades the ambience beds out
    };
    // mount-once: the callbacks are stable (useState setter / useCallback([])) and the input layer
    // is constructed exactly once per canvas
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      {RENDER_3D && mode === '3d' && (
        // unmounted (not just hidden) in classic mode so the legacy DOM baseline stays identical
        <canvas
          ref={glRef}
          data-testid="game-canvas-3d"
          className="absolute inset-0 block w-full h-full pointer-events-none"
          style={{ background: '#05070B' }}
        />
      )}
      <canvas
        ref={canvasRef}
        data-testid="game-canvas"
        data-render-mode={mode}
        className="relative block w-full h-full cursor-crosshair"
        style={{ background: mode === '3d' ? 'transparent' : '#05070B' }}
      />
      {renderError && (
        <div
          data-testid="render-error-banner"
          role="alert"
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 nl-panel px-4 py-3 flex items-center gap-3 pointer-events-none"
          style={{ borderColor: 'var(--danger)' }}
        >
          <AlertTriangle size={18} className="text-[var(--danger)] shrink-0" />
          <span className="mono text-xs tracking-[0.2em] text-[var(--danger)]">
            Rendering error — save your game and reload
          </span>
        </div>
      )}
    </>
  );
};

export default GameCanvas;
