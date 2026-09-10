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

export const photoFileName = (p, ext = 'jpg') => `aetherion-${(p.park_name || 'park').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-cycle${p.day}-${(p.clock || '').replace(':', '')}.${ext}`;
