import { useState, useEffect, useCallback } from 'react';
import { Images, Download, Trash2, ChevronLeft, Camera, RefreshCw, AlertTriangle } from 'lucide-react';
import { on } from '@/game/state';
import { listPhotos, getPhoto, deletePhoto, photoFileName } from '@/game/album';
import { ScreenFrame } from '@/components/game/ScreenFrame';
import { Skeleton } from '@/components/ui/skeleton';

// ---- Photo Album: every photo-mode capture, browsable and re-downloadable (Ops Deck drawer 'album') ----
// Read-only over the save service's per-player photo collection; deleting is the only write.

function useAlbum() {
  const [photos, setPhotos] = useState(null); // null = loading
  const [error, setError] = useState(null);
  const load = useCallback(() => {
    setError(null);
    listPhotos().then(setPhotos).catch((e) => { setError(e?.message || 'Album unavailable'); setPhotos([]); });
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => on('albumChanged', load), [load]);
  return { photos, error, reload: load, setPhotos };
}

function Tile({ p, onOpen }) {
  return (
    <button type="button" data-testid={`album-photo-${p.id}`} onClick={() => onOpen(p)}
      className="group text-left rounded-lg overflow-hidden border border-[var(--line)] bg-[var(--panel-2)] hover:border-[var(--accent-cyan)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">
      <div className="aspect-video bg-[#05070B] overflow-hidden">
        <img src={p.thumb} alt={`Cycle ${p.day} ${p.clock}`} className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-[1.03]" loading="lazy" />
      </div>
      <div className="px-2 py-1.5 flex items-center justify-between gap-2">
        <span className="mono text-[9px] tracking-[0.15em] text-[var(--accent-cyan)]">CYCLE {p.day}</span>
        <span className="mono text-[9px] text-[var(--text-3)]">{p.clock}</span>
      </div>
    </button>
  );
}

function Detail({ meta, onBack, onDeleted }) {
  const [full, setFull] = useState(null);
  const [error, setError] = useState(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    setFull(null); setError(null); setConfirm(false);
    getPhoto(meta.id).then((p) => live && setFull(p)).catch(() => live && setError('Could not load this photograph'));
    return () => { live = false; };
  }, [meta.id]);
  const remove = async () => {
    if (!confirm) { setConfirm(true); return; }
    setBusy(true);
    try { await deletePhoto(meta.id); onDeleted(meta.id); } catch (e) { setError('Delete failed'); setBusy(false); setConfirm(false); }
  };
  const when = new Date(meta.created_at);
  return (
    <div className="space-y-3" data-testid="album-detail">
      <button type="button" data-testid="album-back-button" onClick={onBack}
        className="mono text-[10px] tracking-[0.15em] text-[var(--text-2)] hover:text-[var(--text-1)] flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] rounded px-1">
        <ChevronLeft size={12} /> ALL PHOTOGRAPHS
      </button>
      <div className="rounded-lg overflow-hidden border border-[var(--line-2)] bg-[#05070B] aspect-video flex items-center justify-center">
        {full ? <img src={full.image} alt={`Cycle ${meta.day} ${meta.clock}`} data-testid="album-detail-image" className="w-full h-full object-contain" />
          : error ? <span className="text-[11px] text-[var(--warning)] flex items-center gap-1.5"><AlertTriangle size={12} /> {error}</span>
          : <img src={meta.thumb} alt="" className="w-full h-full object-contain opacity-60" />}
      </div>
      <div className="space-y-0.5">
        <div className="text-[12px] font-semibold text-[var(--text-1)]" data-testid="album-detail-title">{meta.park_name} · Cycle {meta.day} · {meta.clock}</div>
        <div className="mono text-[9px] text-[var(--text-3)]">{meta.width}×{meta.height} · {meta.mode} · taken {isNaN(when) ? '' : when.toLocaleString()}</div>
      </div>
      <div className="flex items-center gap-2">
        <a data-testid="album-download-button" href={full ? full.image : undefined} download={photoFileName(meta)}
          aria-disabled={!full}
          className={`nl-tool h-8 px-3 text-[11px] flex items-center gap-1.5 !text-[var(--accent-cyan)] ${full ? '' : 'opacity-50 pointer-events-none'}`}>
          <Download size={12} /> Download JPEG
        </a>
        <button type="button" data-testid="album-delete-button" onClick={remove} disabled={busy}
          className={`nl-tool h-8 px-3 text-[11px] flex items-center gap-1.5 ml-auto ${confirm ? '!text-[var(--danger)] !border-[var(--danger)]' : 'text-[var(--text-2)]'}`}>
          <Trash2 size={12} /> {confirm ? 'Confirm delete' : 'Delete'}
        </button>
      </div>
    </div>
  );
}

function AlbumEmpty({ onOpenPhoto }) {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-2 text-center px-4 py-10" data-testid="album-empty">
      <Images size={28} className="text-[var(--text-3)]" />
      <div className="mono text-[10px] tracking-[0.2em] text-[var(--text-3)]">NO PHOTOGRAPHS YET</div>
      <div className="text-[11px] text-[var(--text-2)]">Every capture from Photo Mode is kept here for you to browse and download again.</div>
      {onOpenPhoto && (
        <button type="button" data-testid="album-open-photo-button" onClick={onOpenPhoto}
          className="nl-tool h-8 px-3 text-[11px] flex items-center gap-1.5 mt-1 !text-[var(--accent-cyan)]"><Camera size={12} /> Open Photo Mode</button>
      )}
    </div>
  );
}

export default function AlbumScreen({ onClose, onOpenPhoto, initialPhotoId = null }) {
  const { photos, error, reload, setPhotos } = useAlbum();
  const [openId, setOpenId] = useState(initialPhotoId);
  const selected = photos && openId ? photos.find((p) => p.id === openId) : null;
  const onDeleted = (id) => { setPhotos((list) => (list || []).filter((p) => p.id !== id)); setOpenId(null); };
  const openPhoto = onOpenPhoto ? () => { onClose(); onOpenPhoto(); } : null;

  return (
    <ScreenFrame
      testId="album-modal"
      closeTestId="album-close-button"
      onClose={onClose}
      eyebrow={<><Images size={11} /> PHOTO ALBUM</>}
      subtitle={<span className="text-[var(--text-2)]">Field photographs from every cycle, kept for this player.</span>}
      actions={photos ? <span className="mono text-[10px] text-[var(--text-2)]" data-testid="album-count">{photos.length} photo{photos.length === 1 ? '' : 's'}</span> : null}
      bodyClassName="p-3"
    >
      {photos === null && (
        <div className="grid grid-cols-2 gap-2" data-testid="album-loading">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="aspect-video rounded-lg bg-[var(--panel-2)]" />)}
        </div>
      )}
      {photos && error && (
        <div className="rounded-lg border border-[var(--line)] p-3 text-[11px] text-[var(--warning)] flex items-center justify-between gap-2" data-testid="album-error">
          <span className="flex items-center gap-1.5"><AlertTriangle size={12} /> {error}</span>
          <button type="button" data-testid="album-retry-button" onClick={reload} className="nl-tool h-7 px-2 text-[10px] flex items-center gap-1"><RefreshCw size={11} /> Retry</button>
        </div>
      )}
      {photos && !error && photos.length === 0 && <AlbumEmpty onOpenPhoto={openPhoto} />}
      {photos && !error && photos.length > 0 && (selected
        ? <Detail meta={selected} onBack={() => setOpenId(null)} onDeleted={onDeleted} />
        : (
          <div className="grid grid-cols-2 gap-2" data-testid="album-grid">
            {photos.map((p) => <Tile key={p.id} p={p} onOpen={(x) => setOpenId(x.id)} />)}
          </div>
        ))}
    </ScreenFrame>
  );
}
