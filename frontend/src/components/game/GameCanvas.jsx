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
export const GameCanvas = ({ onSelect, onToolResult, onToolChange, rendererRef, inputRef }) => {
  const canvasRef = useRef(null);
  const glRef = useRef(null);
  // set once, on the first caught frame exception: the loop keeps running so the HUD stays
  // usable (save / exit), but the player is told the view is broken and the sim is paused
  const [renderError, setRenderError] = useState(false);
  const [mode, setMode] = useState(RENDER_3D ? '3d' : 'classic');

  useEffect(() => {
    const canvas = canvasRef.current;
    const renderer = new GameRenderer(canvas);
    const input = new InputController(canvas, renderer, () => game.state, {
      onSelect,
      onToolResult,
      onToolChange,
    });
    if (rendererRef) rendererRef.current = renderer;
    if (inputRef) inputRef.current = input;
    window.__gameRenderer = renderer;
    window.__gameInput = input; // debug/testing access (edge scrolling state)

    let world = null;
    // software GL (headless browsers, VMs) cannot run the cinematic pipeline at speed: stay classic
    // unless explicitly forced, so automated suites and GPU-less machines keep the fast 2D renderer
    const want3D = RENDER_3D && glRef.current && webglAvailable() && (RENDER_3D_FORCED || !softwareRenderer());
    if (want3D) {
      try {
        world = new World3D(glRef.current);
        renderer.attach3D(world);
        window.__world3d = world; // debug/testing access (camera lock verification, stats, quality)
      } catch (err) {
        console.warn('[render3d] falling back to the classic renderer:', err && err.message);
        world = null;
        setMode('classic');
      }
    } else if (RENDER_3D) {
      setMode('classic');
    }
    window.__renderMode = world ? '3d' : 'classic';

    const resize = () => {
      const parent = canvas.parentElement;
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
      if (glRef.current) { glRef.current.width = parent.clientWidth; glRef.current.height = parent.clientHeight; }
      if (world) world.setSize(parent.clientWidth, parent.clientHeight);
    };
    resize();
    window.addEventListener('resize', resize);

    if (game.state) renderer.setState(game.state);

    let raf;
    let errored = false;
    const seenErrors = new Set(); // a render exception must never stop the loop silently
    const frame = () => {
      if (game.state && renderer.state !== game.state) renderer.setState(game.state);
      try {
        input.frame(); // edge scrolling glides the camera before the frame is drawn
        renderer.render();
        audio.update(game.state); // ambience follows weather / night / breaches (read-only)
      } catch (err) {
        const msg = (err && err.message) || String(err);
        if (!seenErrors.has(msg)) { seenErrors.add(msg); console.error('[render]', err); }
        if (world && !errored) {
          // a broken 3D frame must not take the game down: drop to the classic renderer
          try { renderer.detach3D(); world.dispose(); } catch (e) { /* ignore */ }
          world = null; window.__renderMode = 'classic'; setMode('classic');
        } else if (!errored) {
          errored = true;
          setRenderError(true);
          try { game.setPaused(true); } catch (e) { /* no active game to pause */ }
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      input.detach();
      if (world) { try { renderer.detach3D(); world.dispose(); } catch (e) { /* ignore */ } }
      audio.update(null); // leaving the game screen fades the ambience beds out
    };
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
