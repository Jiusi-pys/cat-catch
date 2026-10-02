const extKinds = new Map(Object.entries({
  m3u8: 'hls', m3u: 'hls', mpd: 'dash', mp4: 'video', webm: 'video', mov: 'video', mkv: 'video',
  flv: 'video', m4v: 'video', avi: 'video', ogv: 'video', mp3: 'audio', m4a: 'audio',
  aac: 'audio', wav: 'audio', wma: 'audio', oga: 'audio', ogg: 'audio', opus: 'audio', weba: 'audio'
}));
const hlsTypes = new Set(['application/vnd.apple.mpegurl', 'application/x-mpegurl', 'application/mpegurl', 'audio/mpegurl']);

export function classify(url, mimeType = '', disposition = '', resourceType = '') {
  const mime = mimeType.split(';')[0].trim().toLowerCase();
  let pathname;
  try { pathname = new URL(url).pathname; } catch { return null; }
  const ext = pathname.split('/').pop()?.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();
  if (hlsTypes.has(mime) || ext === 'm3u8' || ext === 'm3u') return 'hls';
  if (mime === 'application/dash+xml' || ext === 'mpd') return 'dash';
  if (extKinds.has(ext)) return extKinds.get(ext);
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  const name = disposition.match(/filename\*?=(?:UTF-8''|["']?)([^"';]+)/i)?.[1];
  const attachmentExt = name?.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();
  if (extKinds.has(attachmentExt)) return extKinds.get(attachmentExt);
  if (resourceType === 'media') return 'other';
  return null;
}

export function collectResource(seen, { url, mimeType = '', disposition = '', size, pageUrl, resourceType = '', headers = {}, includeHeaders = false }) {
  const category = classify(url, mimeType, disposition, resourceType);
  if (!category || seen.has(url)) return null;
  const path = new URL(url).pathname;
  let filename = path.split('/').pop() || null;
  try { filename = decodeURIComponent(filename); } catch { /* keep raw filename */ }
  const item = { id: seen.size + 1, url, category, mimeType: mimeType || null, filename, size: Number.isFinite(Number(size)) && size !== undefined ? Number(size) : null, pageUrl };
  if (includeHeaders) item.headers = sanitizeHeaders(headers);
  seen.set(url, item);
  return item;
}

export function sanitizeHeaders(headers) {
  const excluded = new Set(['host', 'content-length', 'range', 'connection', 'accept-encoding']);
  return Object.fromEntries(Object.entries(headers || {}).filter(([name]) => {
    const lower = name.toLowerCase();
    return !lower.startsWith(':') && !excluded.has(lower);
  }));
}
