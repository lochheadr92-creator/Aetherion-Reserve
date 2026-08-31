import { useEffect, useRef } from 'react';
import { GameRenderer } from '@/game/renderer';
import { InputController } from '@/game/input';
import { game } from '@/game/controller';

export const GameCanvas = ({ onSelect, onToolResult, onToolChange, rendererRef, inputRef }) => {
  const canvasRef = useRef(null);

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

    const resize = () => {
      const parent = canvas.parentElement;
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    if (game.state) renderer.setState(game.state);

    let raf;
    const frame = () => {
      if (game.state && renderer.state !== game.state) renderer.setState(game.state);
      renderer.render();
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      input.detach();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <canvas
      ref={canvasRef}
      data-testid="game-canvas"
      className="block w-full h-full cursor-crosshair"
      style={{ background: '#05070B' }}
    />
  );
};

export default GameCanvas;
