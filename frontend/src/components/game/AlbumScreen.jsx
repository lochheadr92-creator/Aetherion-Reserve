import { useState, useEffect, useCallback, useRef } from 'react';
import { Images, Download, Trash2, ChevronLeft, Camera, RefreshCw, AlertTriangle, Pencil, Check, X } from 'lucide-react';
import { on } from '@/game/state';
import { listPhotos, getPhoto, deletePhoto, updateCaption, stampedPhoto, photoFileName, CAPTION_MAX } from '@/game/album';
import { ScreenFrame } from '@/components/game/ScreenFrame';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';

// ---- Photo Album: every photo-mode capture, browsable and re-downloadable (Ops Deck drawer 'album') ----
// Read-only over the save service's per-player photo collection apart from captions and deletes.
// Downloads are stamped: the JPEG gains a bar underneath with park · cycle · caption.

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
      {p.caption && <div className="px-2 pb-1.5 -mt-1 text-[10px] text-[var(--text-2)] truncate" data-testid="album-tile-caption">{p.caption}</div>}
    </button>
  );
}

// Inline caption editor: click the caption (or "Add a caption") to edit; Enter saves, Esc cancels.
function CaptionEditor({ meta, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(meta.caption || '');
  const [status, setStatus] = useState('idle'); // idle | saving | saved | failed
  const inputRef = useRef(null);
  useEffect(() => { if (!editing) setDraft(meta.caption || ''); }, [meta.caption, editing]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);
  useEffect(() => {
    if (status !== 'saved') return undefined;
    const t = setTimeout(() => setStatus('idle'), 1800);
    return () => clearTimeout(t);
  }, [status]);
  const save = async () => {
    const text = draft.replace(/\s+/g, ' ').trim();
    if (text === (meta.caption || '')) { setEditing(false); return; }
    setStatus('saving');
    try {
      const updated = await updateCaption(meta.id, text);
      onSaved(updated);
      setStatus('saved'); setEditing(false);
    } catch (e) { setStatus('failed'); }
  };
  const cancel = () => { setDraft(meta.caption || ''); setEditing(false); setStatus('idle'); };
  if (editing) {
    return (
      <div className="space-y-1" data-testid="album-caption-editor">
        <div className="flex items-center gap-1.5">
          <Input ref={inputRef} data-testid="album-caption-input" value={draft} maxLength={CAPTION_MAX} placeholder="Caption this photograph…"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); save(); } else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancel(); } }}
            className="h-8 text-[12px] bg-[var(--panel-2)] border-[var(--line)] text-[var(--text-1)] placeholder:text-[var(--text-3)] focus-visible:ring-[var(--focus-ring)] focus-visible:border-[var(--accent-cyan)]" />
          <button type="button" data-testid="album-caption-save" onClick={save} disabled={status === 'saving'} aria-label="Save caption"
            className="nl-tool h-8 w-8 flex items-center justify-center !text-[var(--accent-cyan)] disabled:opacity-50"><Check size={13} /></button>
          <button type="button" data-testid="album-caption-cancel" onClick={cancel} aria-label="Cancel"
            className="nl-tool h-8 w-8 flex items-center justify-center text-[var(--text-2)]"><X size={13} /></button>
        </div>
        <div className="flex items-center justify-between mono text-[9px] text-[var(--text-3)]">
          <span data-testid="album-caption-status" data-status={status}>{status === 'saving' ? 'Saving…' : status === 'failed' ? 'Could not save — try again' : 'Enter to save · Esc to cancel'}</span>
          <span>{draft.length}/{CAPTION_MAX}</span>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 min-w-0" data-testid="album-caption-block">
      <button type="button" data-testid="album-caption-edit" onClick={() => setEditing(true)} title="Edit caption"
        className={`min-w-0 flex-1 text-left flex items-center gap-1.5 rounded px-1 -mx-1 py-0.5 hover:bg-[var(--panel-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${meta.caption ? 'text-[12px] text-[var(--text-1)]' : 'text-[11px] italic text-[var(--text-3)]'}`}>
        <span className="truncate" data-testid="album-caption-text">{meta.caption || 'Add a caption…'}</span>
        <Pencil size={11} className="shrink-0 text-[var(--text-3)]" />
      </button>
      {status === 'saved' && <span className="mono text-[9px] text-[var(--success)] shrink-0" data-testid="album-caption-status" data-status="saved">Saved</span>}
    </div>
  );
}

function Detail({ meta, onBack, onDeleted, onMetaChanged }) {
  const [full, setFull] = useState(null);
  const [error, setError] = useState(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stamped, setStamped] = useState(null); // download-ready JPEG with the caption bar
  useEffect(() => {
    let live = true;
    setFull(null); setError(null); setConfirm(false); setStamped(null);
    getPhoto(meta.id).then((p) => live && setFull(p)).catch(() => live && setError('Could not load this photograph'));
    return () => { live = false; };
  }, [meta.id]);
  // re-stamp whenever the frame or its caption changes
  const { caption, park_name: parkName, day, clock } = meta;
  useEffect(() => {
    if (!full) return undefined;
    let live = true;
    setStamped(null);
    stampedPhoto(full.image, { park_name: parkName, day, clock, caption }).then((url) => live && setStamped(url));
    return () => { live = false; };
  }, [full, caption, parkName, day, clock]);
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
      <div className="space-y-1">
        <div className="text-[12px] font-semibold text-[var(--text-1)]" data-testid="album-detail-title">{meta.park_name} · Cycle {meta.day} · {meta.clock}</div>
        <CaptionEditor meta={meta} onSaved={onMetaChanged} />
        <div className="mono text-[9px] text-[var(--text-3)]">{meta.width}×{meta.height} · {meta.mode} · taken {isNaN(when) ? '' : when.toLocaleString()}</div>
      </div>
      <div className="flex items-center gap-2">
        <a data-testid="album-download-button" href={full ? (stamped || full.image) : undefined} download={photoFileName(meta)}
          aria-disabled={!full} data-stamped={stamped ? 'true' : 'false'} title="JPEG with the park · cycle · caption bar stamped underneath"
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
  const onMetaChanged = (updated) => setPhotos((list) => (list || []).map((p) => (p.id === updated.id ? { ...p, ...updated } : p)));
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
        ? <Detail meta={selected} onBack={() => setOpenId(null)} onDeleted={onDeleted} onMetaChanged={onMetaChanged} />
        : (
          <div className="grid grid-cols-2 gap-2" data-testid="album-grid">
            {photos.map((p) => <Tile key={p.id} p={p} onOpen={(x) => setOpenId(x.id)} />)}
          </div>
        ))}
    </ScreenFrame>
  );
}
