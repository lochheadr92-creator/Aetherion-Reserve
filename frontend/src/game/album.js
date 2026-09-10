// ---- Photo album client (UI layer): per-player persistence of photo-mode captures ----
// Photos are JPEG data URLs (full frame + small thumbnail) stored by the save service under the same
// X-Player-Token the saves use. Everything here is best-effort UI plumbing; the sim never sees it.
import axios from 'axios';
import { emit } from './state';
import { playerToken } from './controller';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const http = axios.create({ baseURL: API, timeout: 20000 });
http.interceptors.request.use((cfg) => {
  const t = playerToken();
  if (t) cfg.headers['X-Player-Token'] = t;
  return cfg;
});

export const THUMB_WIDTH = 360;
export const JPEG_QUALITY = 0.86;

/** Full-frame JPEG + thumbnail from a composed shot canvas. */
export function albumAssets(canvas) {
  const image = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  const tw = Math.min(THUMB_WIDTH, canvas.width), th = Math.max(1, Math.round(canvas.height * (tw / canvas.width)));
  const t = document.createElement('canvas');
  t.width = tw; t.height = th;
  t.getContext('2d').drawImage(canvas, 0, 0, tw, th);
  const thumb = t.toDataURL('image/jpeg', 0.74);
  return { image, thumb, width: canvas.width, height: canvas.height };
}

export async function listPhotos() {
  const { data } = await http.get('/photos', { params: { limit: 200 } });
  return data;
}

export async function getPhoto(id) {
  const { data } = await http.get(`/photos/${id}`);
  return data;
}

export async function savePhoto(meta, assets) {
  const { data } = await http.post('/photos', { ...meta, ...assets });
  emit('albumChanged', { kind: 'saved', id: data.id });
  return data;
}

export async function deletePhoto(id) {
  await http.delete(`/photos/${id}`);
  emit('albumChanged', { kind: 'deleted', id });
}

export const CAPTION_MAX = 140;

/** Save a caption (single line, <= CAPTION_MAX chars); returns the updated meta. */
export async function updateCaption(id, caption) {
  const text = String(caption || '').replace(/\s+/g, ' ').trim().slice(0, CAPTION_MAX);
  const { data } = await http.patch(`/photos/${id}`, { caption: text });
  emit('albumChanged', { kind: 'caption', id, caption: data.caption });
  return data;
}

// ---- download stamp: park · cycle · caption bar under the frame ----
const FONT_UI = '"Space Grotesk", "Segoe UI", ui-sans-serif, sans-serif';
const FONT_MONO = '"IBM Plex Mono", ui-monospace, Menlo, monospace';

function ellipsize(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let lo = 0, hi = text.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (ctx.measureText(text.slice(0, mid) + '…').width <= maxWidth) lo = mid; else hi = mid - 1;
  }
  return text.slice(0, lo).trimEnd() + '…';
}

/** Draw the caption bar onto a canvas holding the frame; returns the taller canvas. Pure canvas work. */
export function stampCanvas(img, meta) {
  const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
  const bar = Math.max(44, Math.round(h * 0.075));
  const c = document.createElement('canvas');
  c.width = w; c.height = h + bar;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);
  ctx.fillStyle = '#070A0F';
  ctx.fillRect(0, h, w, bar);
  ctx.fillStyle = 'rgba(45,226,230,0.6)';
  ctx.fillRect(0, h, w, Math.max(1, Math.round(bar * 0.04)));
  const pad = Math.round(bar * 0.4), mid = h + bar / 2;
  const fs = Math.round(bar * 0.34);
  ctx.textBaseline = 'middle';
  // right: mono provenance
  ctx.font = `${Math.round(fs * 0.82)}px ${FONT_MONO}`;
  ctx.textAlign = 'right';
  ctx.fillStyle = '#8A9BB2';
  const prov = `${(meta.park_name || 'AETHERION').toUpperCase()} · CYCLE ${meta.day} · ${meta.clock || ''}`.trim().replace(/ · $/, '');
  ctx.fillText(prov, w - pad, mid);
  const provW = ctx.measureText(prov).width;
  // left: the caption (or a quiet placeholder mark)
  const caption = (meta.caption || '').trim();
  ctx.textAlign = 'left';
  ctx.font = caption ? `600 ${fs}px ${FONT_UI}` : `italic ${Math.round(fs * 0.9)}px ${FONT_UI}`;
  ctx.fillStyle = caption ? '#EAF1F8' : '#4E5D72';
  ctx.fillText(ellipsize(ctx, caption || 'Field photograph', Math.max(40, w - provW - pad * 3)), pad, mid);
  return c;
}

/** JPEG data URL of the photo with its caption bar stamped on (falls back to the raw image on error). */
export function stampedPhoto(imageDataUrl, meta) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => { try { resolve(stampCanvas(img, meta).toDataURL('image/jpeg', 0.9)); } catch (e) { resolve(imageDataUrl); } };
    img.onerror = () => resolve(imageDataUrl);
    img.src = imageDataUrl;
  });
}

export const photoFileName = (p, ext = 'jpg') => `aetherion-${(p.park_name || 'park').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-cycle${p.day}-${(p.clock || '').replace(':', '')}.${ext}`;
