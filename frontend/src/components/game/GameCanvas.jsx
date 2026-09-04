import { useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { GameRenderer } from '@/game/renderer';
import { InputController } from '@/game/input';
import { game } from '@/game/controller';
import { audio } from '@/game/audio';

export const GameCanvas = ({ onSelect, onToolResult, onToolChange, rendererRef, inputRef }) => {
  const canvasRef = useRef(null);
  // set once, on the first caught frame exception: the loop keeps running so the HUD stays
  // usable (save / exit), but the player is told the view is broken and the sim is paused
  const [renderError, setRenderError] = useState(false);

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

    const resize = () => {
      const parent = canvas.parentElement;
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
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
        if (!errored) {
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
      audio.update(null); // leaving the game screen fades the ambience beds out
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <canvas
        ref={canvasRef}
        data-testid="game-canvas"
        className="block w-full h-full cursor-crosshair"
        style={{ background: '#05070B' }}
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
