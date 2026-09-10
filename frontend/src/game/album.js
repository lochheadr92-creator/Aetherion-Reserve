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

// ---- contact sheet: the whole album as one tall, printable JPEG ----
export const SHEET = { width: 1240, cols: 3, gutter: 40, thumbW: 360, cellText: 46, header: 132, footer: 56 };

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Chronological order for the sheet (oldest cycle first; same cycle by clock, then by save time). */
export function sheetOrder(photos) {
  return [...photos].sort((a, b) => (a.day - b.day) || String(a.clock || '').localeCompare(String(b.clock || '')) || String(a.created_at || '').localeCompare(String(b.created_at || '')));
}

/** Sheet geometry for n photos (pure; tests compare the exported image against it). */
export function sheetLayout(n) {
  const { width, cols, gutter, thumbW, cellText, header, footer } = SHEET;
  const thumbH = Math.round(thumbW * 9 / 16);
  const cellH = thumbH + cellText;
  const rows = Math.max(1, Math.ceil(n / cols));
  const height = header + rows * cellH + (rows - 1) * gutter + footer + gutter;
  return { width, height, cols, rows, gutter, thumbW, thumbH, cellH, header, footer };
}

/** Draw the whole album onto one canvas: header, 3 columns of thumbnails, caption + cycle under each. */
export async function buildContactSheetCanvas(photos, { parkName = null, now = new Date() } = {}) {
  const list = sheetOrder(photos);
  const L = sheetLayout(list.length);
  const imgs = await Promise.all(list.map((p) => loadImage(p.thumb)));
  const c = document.createElement('canvas');
  c.width = L.width; c.height = L.height;
  const ctx = c.getContext('2d');
  // page
  ctx.fillStyle = '#070A0F';
  ctx.fillRect(0, 0, L.width, L.height);
  ctx.textBaseline = 'alphabetic';
  // header: eyebrow, park name, provenance line
  const park = parkName || list[0]?.park_name || 'Aetherion Reserve';
  const days = list.map((p) => p.day).filter((d) => Number.isFinite(d));
  const range = days.length ? (Math.min(...days) === Math.max(...days) ? `Cycle ${days[0]}` : `Cycles ${Math.min(...days)}–${Math.max(...days)}`) : '';
  ctx.fillStyle = 'rgba(45,226,230,0.9)';
  ctx.font = `600 13px ${FONT_MONO}`;
  ctx.fillText('AETHERION INITIATIVE · FIELD PHOTOGRAPHS', L.gutter, 44);
  ctx.fillStyle = '#EAF1F8';
  ctx.font = `700 34px ${FONT_UI}`;
  ctx.fillText(ellipsize(ctx, park, L.width - L.gutter * 2 - 260), L.gutter, 86);
  ctx.fillStyle = '#8A9BB2';
  ctx.font = `13px ${FONT_MONO}`;
  ctx.textAlign = 'right';
  ctx.fillText(`${list.length} PHOTOGRAPH${list.length === 1 ? '' : 'S'}${range ? ` · ${range.toUpperCase()}` : ''}`, L.width - L.gutter, 60);
  ctx.fillText(`CONTACT SHEET · ${now.toISOString().slice(0, 10)}`, L.width - L.gutter, 82);
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(45,226,230,0.55)';
  ctx.fillRect(L.gutter, L.header - 22, L.width - L.gutter * 2, 2);
  // cells
  list.forEach((p, i) => {
    const col = i % L.cols, row = Math.floor(i / L.cols);
    const x = L.gutter + col * (L.thumbW + L.gutter);
    const y = L.header + row * (L.cellH + L.gutter);
    // frame
    ctx.fillStyle = '#0C121B';
    ctx.fillRect(x, y, L.thumbW, L.thumbH);
    const img = imgs[i];
    if (img) {
      // letterbox the thumbnail into the 16:9 slot
      const sc = Math.min(L.thumbW / img.width, L.thumbH / img.height);
      const w = Math.round(img.width * sc), h = Math.round(img.height * sc);
      ctx.drawImage(img, x + Math.round((L.thumbW - w) / 2), y + Math.round((L.thumbH - h) / 2), w, h);
    } else {
      ctx.fillStyle = '#4E5D72';
      ctx.font = `italic 12px ${FONT_UI}`;
      ctx.fillText('image unavailable', x + 12, y + L.thumbH / 2);
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, L.thumbW - 1, L.thumbH - 1);
    // provenance + caption
    ctx.fillStyle = '#8A9BB2';
    ctx.font = `11px ${FONT_MONO}`;
    ctx.fillText(`CYCLE ${p.day} · ${p.clock || ''}`.trim(), x, y + L.thumbH + 18);
    const caption = (p.caption || '').trim();
    ctx.fillStyle = caption ? '#EAF1F8' : '#4E5D72';
    ctx.font = caption ? `600 13px ${FONT_UI}` : `italic 12px ${FONT_UI}`;
    ctx.fillText(ellipsize(ctx, caption || 'Field photograph', L.thumbW), x, y + L.thumbH + 38);
  });
  // footer
  ctx.fillStyle = '#4E5D72';
  ctx.font = `11px ${FONT_MONO}`;
  ctx.fillText('AETHERION RESERVE · SITE-04 · PRINTED FROM THE PHOTO ALBUM', L.gutter, L.height - L.gutter + 8);
  return c;
}

/** JPEG data URL of the contact sheet (see buildContactSheetCanvas). */
export async function buildContactSheet(photos, opts) {
  const c = await buildContactSheetCanvas(photos, opts);
  return c.toDataURL('image/jpeg', 0.9);
}

export const sheetFileName = (parkName) => `aetherion-${(parkName || 'park').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-contact-sheet.jpg`;
