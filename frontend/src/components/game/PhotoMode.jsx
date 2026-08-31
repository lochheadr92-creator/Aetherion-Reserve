import { useState, useEffect, useCallback } from 'react';
import { Camera, X, Grid3x3, Pause, Play, Download, RotateCcw } from 'lucide-react';
import { game } from '@/game/controller';
import { clockLabel } from '@/game/weather';
import { useGameTick } from '@/components/game/useGame';
import { Button } from '@/components/ui/button';

// ---- Photo Mode: frame a shot with the live camera, capture the canvas to a
// framed PNG (vignette + park caption) and download it. Render/UI-only — the
// simulation is untouched (the pause toggle reuses the existing time control).

const BAR_STYLE = { background: 'rgba(5,7,11,0.82)', backdropFilter: 'blur(14px)' };
const BACKDROP_STYLE = { background: 'rgba(5,7,11,0.85)' };
const CAPTION_PLATE_H = 44;

function drawVignette(ctx, w, h) {
  const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.max(w, h) * 0.72);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(2,4,14,0.4)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);
}

function drawCaption(ctx, w, h, state) {
  ctx.fillStyle = 'rgba(5,7,11,0.62)';
  ctx.fillRect(0, h - CAPTION_PLATE_H, w, CAPTION_PLATE_H);
  ctx.fillStyle = 'rgba(45,226,230,0.5)';
  ctx.fillRect(0, h - CAPTION_PLATE_H, w, 1);
  ctx.textBaseline = 'middle';
  ctx.font = '600 14px "Space Grotesk", sans-serif';
  ctx.fillStyle = '#E8F2FF';
  ctx.fillText(state.parkName || 'Aetherion Reserve', 18, h - CAPTION_PLATE_H / 2);
  ctx.font = '500 11px "IBM Plex Mono", monospace';
  ctx.fillStyle = '#2DE2E6';
  const meta = `AETHERION INITIATIVE · CYCLE ${state.day} · ${clockLabel(state.tick)}`;
  const mw = ctx.measureText(meta).width;
  ctx.fillText(meta, w - mw - 18, h - CAPTION_PLATE_H / 2);
}

function composeShot(state) {
  const src = document.querySelector('canvas[data-testid="game-canvas"]');
  if (!src || !src.width) return null;
  const out = document.createElement('canvas');
  out.width = src.width;
  out.height = src.height;
  const ctx = out.getContext('2d');
  ctx.drawImage(src, 0, 0);
  drawVignette(ctx, out.width, out.height);
  drawCaption(ctx, out.width, out.height, state);
  return out.toDataURL('image/png');
}

// capture flow: shot data URL + shutter flash animation state
function usePhotoCapture() {
  const [shot, setShot] = useState(null);
  const [flash, setFlash] = useState(false);
  const capture = useCallback(() => {
    const url = composeShot(game.state);
    if (!url) return;
    setFlash(true);
    setTimeout(() => setFlash(false), 220);
    setTimeout(() => setShot(url), 160);
  }, [setShot, setFlash]);
  const retake = useCallback(() => setShot(null), [setShot]);
  return { shot, flash, capture, retake };
}

// keyboard shortcuts: ESC exits, SPACE/ENTER captures while framing
function usePhotoHotkeys(onClose, capture, framing) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { onClose(); return; }
      if ((e.key === ' ' || e.key === 'Enter') && framing) {
        e.preventDefault();
        capture();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, capture, framing]);
}

function PreviewDialog({ shot, day, onRetake, onClose }) {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center" style={BACKDROP_STYLE} data-testid="photo-preview-dialog">
      <div className="nl-panel max-w-[80vw] p-4 space-y-3">
        <div className="mono text-[10px] tracking-[0.3em] text-[var(--accent-cyan)] flex items-center gap-2">
          <Camera size={12} /> FIELD PHOTOGRAPH · CYCLE {day}
        </div>
        <img src={shot} alt="Captured park photograph" data-testid="photo-preview-image"
          className="max-h-[62vh] max-w-full rounded border border-[var(--line-2)]" />
        <div className="flex gap-2 justify-end">
          <Button data-testid="photo-retake-button" onClick={onRetake} variant="outline"
            className="h-9 px-4 text-xs border-[var(--line-2)] text-[var(--text-2)] bg-transparent hover:bg-[var(--panel-2)]">
            <RotateCcw size={13} className="mr-1.5" /> Retake
          </Button>
          <a data-testid="photo-download-button" href={shot} download={`aetherion-cycle${day}-${Date.now()}.png`}
            className="nl-tool h-9 px-4 text-xs flex items-center gap-1.5 !text-[var(--accent-cyan)]">
            <Download size={13} /> Download PNG
          </a>
          <Button data-testid="photo-close-button" onClick={onClose}
            className="h-9 px-4 text-xs bg-[var(--accent-cyan)] text-[#04141A] hover:bg-[var(--accent-cyan)]/85">
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}

function GridLines() {
  return (
    <div className="absolute left-0 right-0 top-10 bottom-16" data-testid="photo-grid-lines">
      <div className="absolute left-1/3 top-0 bottom-0 w-px bg-[var(--accent-cyan)] opacity-15" />
      <div className="absolute left-2/3 top-0 bottom-0 w-px bg-[var(--accent-cyan)] opacity-15" />
      <div className="absolute top-1/3 left-0 right-0 h-px bg-[var(--accent-cyan)] opacity-15" />
      <div className="absolute top-2/3 left-0 right-0 h-px bg-[var(--accent-cyan)] opacity-15" />
    </div>
  );
}

function TopStrip() {
  return (
    <div className="absolute top-0 left-0 right-0 h-10 flex items-center justify-between px-4">
      <span className="mono text-[10px] tracking-[0.3em] text-[var(--accent-cyan)] flex items-center gap-2">
        <Camera size={12} /> PHOTO MODE
      </span>
      <span className="mono text-[10px] text-[var(--text-3)]">Drag to pan · scroll to zoom · SPACE to capture · ESC to exit</span>
    </div>
  );
}

function ControlBar({ paused, grid, onPause, onGrid, onCapture, onExit }) {
  return (
    <div className="absolute bottom-0 left-0 right-0 h-16 flex items-center justify-center gap-2 pointer-events-auto">
      <button data-testid="photo-pause-toggle" onClick={onPause}
        className="nl-tool h-10 w-10 flex items-center justify-center" data-active={paused ? 'true' : 'false'}
        title={paused ? 'Resume the moment' : 'Freeze the moment'}>
        {paused ? <Play size={16} /> : <Pause size={16} />}
      </button>
      <button data-testid="photo-grid-toggle" onClick={onGrid}
        className="nl-tool h-10 w-10 flex items-center justify-center" data-active={grid ? 'true' : 'false'} title="Rule-of-thirds grid">
        <Grid3x3 size={16} />
      </button>
      <button data-testid="photo-capture-button" onClick={onCapture}
        className="h-11 px-6 rounded-full border-2 border-[var(--accent-cyan)] bg-[var(--accent-cyan)]/15 text-[var(--accent-cyan)] mono text-xs tracking-[0.2em] flex items-center gap-2 hover:bg-[var(--accent-cyan)]/30 transition-colors">
        <Camera size={16} /> CAPTURE
      </button>
      <button data-testid="photo-exit-button" onClick={onExit}
        className="nl-tool h-10 w-10 flex items-center justify-center" title="Exit photo mode (Esc)">
        <X size={16} />
      </button>
    </div>
  );
}

export default function PhotoMode({ onClose }) {
  useGameTick();
  const [grid, setGrid] = useState(true);
  const { shot, flash, capture, retake } = usePhotoCapture();
  usePhotoHotkeys(onClose, capture, !shot);
  const togglePause = useCallback(() => game.setPaused(!game.state.paused), []);
  const toggleGrid = useCallback(() => setGrid((g) => !g), [setGrid]);
  const s = game.state;
  if (!s) return null;

  return (
    <div className="absolute inset-0 z-40 pointer-events-none" data-testid="photo-mode-overlay">
      {/* letterbox bars */}
      <div className="absolute top-0 left-0 right-0 h-10" style={BAR_STYLE} />
      <div className="absolute bottom-0 left-0 right-0 h-16" style={BAR_STYLE} />
      {/* rule-of-thirds framing aid (never part of the capture) */}
      {grid && !shot && <GridLines />}
      {/* capture flash */}
      <div className="absolute inset-0 bg-white transition-opacity duration-200"
        style={{ opacity: flash ? 0.55 : 0, willChange: 'opacity' }} />
      <TopStrip />
      <ControlBar paused={s.paused} grid={grid}
        onPause={togglePause} onGrid={toggleGrid} onCapture={capture} onExit={onClose} />
      {shot && (
        <div className="pointer-events-auto">
          <PreviewDialog shot={shot} day={s.day} onRetake={retake} onClose={onClose} />
        </div>
      )}
    </div>
  );
}
