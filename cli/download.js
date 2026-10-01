import { createWriteStream } from 'node:fs';
import { access, readFile, rename, rm } from 'node:fs/promises';
import { dirname, basename, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { classify, sanitizeHeaders } from './media.js';
import { assertHttpUrl, UsageError } from './options.js';

async function exists(path) { try { await access(path); return true; } catch { return false; } }

export async function resolveInput(options) {
  if (!options.from) return { url: options.url, headers: {} };
  let data;
  try { data = JSON.parse(await readFile(options.from, 'utf8')); }
  catch (error) { throw new UsageError(`Cannot read capture JSON: ${error.message}`); }
  if (data?.schemaVersion !== 1 || !Array.isArray(data.resources)) throw new UsageError('Unsupported capture JSON schema');
  const resource = data.resources.find(item => item.id === options.id);
  if (!resource) throw new UsageError(`Capture ID ${options.id} not found`);
  assertHttpUrl(resource.url);
  return { url: resource.url, headers: sanitizeHeaders(resource.headers) };
}

async function request(url, headers, timeout, signal, method = 'GET') {
  let current = url;
  let currentHeaders = { ...headers };
  for (let redirects = 0; redirects < 6; redirects++) {
    const response = await fetch(current, { method, headers: currentHeaders, redirect: 'manual', signal: AbortSignal.any([signal, AbortSignal.timeout(timeout * 1000)]) });
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    const location = response.headers.get('location');
    if (!location) return response;
    const next = new URL(location, current).href;
    assertHttpUrl(next);
    if (new URL(next).origin !== new URL(current).origin) {
      for (const key of Object.keys(currentHeaders)) if (['authorization', 'cookie', 'proxy-authorization'].includes(key.toLowerCase())) delete currentHeaders[key];
    }
    await response.body?.cancel();
    current = next;
  }
  throw new Error('Too many redirects');
}

async function readPlaylist(response) {
  const chunks = [];
  let size = 0;
  for await (const chunk of Readable.fromWeb(response.body)) {
    size += chunk.length;
    if (size > 1024 * 1024) throw new UsageError('HLS playlist exceeds 1 MiB; use --duration');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function requireFiniteHls(url, headers, timeout, signal) {
  const pending = [{ url, depth: 0, parents: new Set() }];
  const visited = new Set();
  while (pending.length) {
    const item = pending.shift();
    if (visited.has(item.url)) continue;
    if (visited.size >= 32 || item.depth > 8) throw new UsageError('HLS playlist graph is too large; use --duration');
    visited.add(item.url);
    const response = await request(item.url, headers, timeout, signal);
    if (!response.ok) throw new Error(`HTTP ${response.status} reading HLS playlist`);
    const lines = (await readPlaylist(response)).split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    if (lines[0] !== '#EXTM3U') throw new UsageError('Invalid HLS playlist');
    const children = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith('#EXT-X-STREAM-INF:')) {
        const next = lines[i + 1];
        if (!next || next.startsWith('#')) throw new UsageError('Invalid HLS variant playlist');
        children.push(next);
        i++;
      } else if (line.startsWith('#EXT-X-MEDIA:') || line.startsWith('#EXT-X-I-FRAME-STREAM-INF:')) {
        const uri = line.match(/\bURI="([^"]+)"/i)?.[1];
        if (uri) children.push(uri);
      }
    }
    if (!children.length && !lines.includes('#EXT-X-ENDLIST')) throw new UsageError('Live HLS requires --duration');
    for (const child of children) {
      const childUrl = new URL(child, response.url).href;
      assertHttpUrl(childUrl);
      if (childUrl === item.url || item.parents.has(childUrl)) throw new UsageError('Cyclic HLS playlists require --duration');
      pending.push({ url: childUrl, depth: item.depth + 1, parents: new Set([...item.parents, item.url]) });
    }
  }
}

async function runFfmpeg({ url, output, ffmpeg = 'ffmpeg', duration, headers, timeout, signal }) {
  const args = ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y', '-rw_timeout', String(timeout * 1e6)];
  if (headers['user-agent']) args.push('-user_agent', headers['user-agent']);
  if (headers.referer) args.push('-referer', headers.referer);
  const extra = Object.entries(headers).filter(([k]) => !['user-agent', 'referer'].includes(k.toLowerCase())).map(([k, v]) => `${k}: ${v}\r\n`).join('');
  if (extra) args.push('-headers', extra);
  args.push('-i', url);
  if (duration) args.push('-t', String(duration));
  args.push('-c', 'copy', output);
  await new Promise((resolve, reject) => {
    const child = spawn(ffmpeg, args, { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });
    let errorText = '';
    child.stderr.on('data', chunk => { errorText = (errorText + chunk).slice(-4096); });
    const abort = () => child.kill();
    signal.addEventListener('abort', abort, { once: true });
    child.once('error', error => { signal.removeEventListener('abort', abort); reject(new Error(`Cannot start FFmpeg: ${error.message}`)); });
    child.once('close', code => {
      signal.removeEventListener('abort', abort);
      if (signal.aborted) reject(signal.reason || new Error('Interrupted'));
      else if (code !== 0) reject(new Error(`FFmpeg failed (${code}): ${errorText.trim()}`));
      else resolve();
    });
  });
}

export async function download(options) {
  const input = await resolveInput(options);
  const url = input.url;
  assertHttpUrl(url);
  const headers = sanitizeHeaders({ ...input.headers, ...options.headers });
  const output = options.output;
  if (!output) throw new UsageError('--output is required');
  if (!options.overwrite && await exists(output)) throw new Error(`Output already exists: ${output}`);
  const temp = join(dirname(output), `.${basename(output)}.${randomUUID()}.part${basename(output).match(/\.[^.]+$/)?.[0] || ''}`);
  const controller = new AbortController();
  const interrupt = () => controller.abort(new Error('Interrupted'));
  process.once('SIGINT', interrupt);
  process.once('SIGTERM', interrupt);
  try {
    let mode = options.mode || 'auto';
    const category = classify(url, '');
    if (mode === 'auto' && ['hls', 'dash'].includes(category)) mode = category;
    if (mode === 'auto') {
      const head = await request(url, headers, options.timeout || 30, controller.signal, 'HEAD');
      if (head.ok) mode = classify(url, head.headers.get('content-type') || '') || 'direct';
      else mode = 'direct';
      await head.body?.cancel();
    }
    if (['hls', 'dash'].includes(mode)) {
      if (!options.duration) {
        if (mode === 'hls') await requireFiniteHls(url, headers, options.timeout || 30, controller.signal);
        else {
          const response = await request(url, headers, options.timeout || 30, controller.signal);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const text = await response.text();
          if (/<MPD\b[^>]*type=["']dynamic["']/i.test(text)) throw new UsageError('Live DASH requires --duration');
        }
      }
      await runFfmpeg({ url, output: temp, ffmpeg: options.ffmpeg, duration: options.duration, headers, timeout: options.timeout || 30, signal: controller.signal });
    } else {
      const response = await request(url, headers, options.timeout || 30, controller.signal);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (!response.body) throw new Error('Empty response');
      let inactivity;
      const resetInactivity = () => {
        clearTimeout(inactivity);
        inactivity = setTimeout(() => controller.abort(new Error('Network inactivity timeout')), (options.timeout || 30) * 1000);
      };
      resetInactivity();
      try {
        const stream = Readable.fromWeb(response.body);
        stream.on('data', resetInactivity);
        await pipeline(stream, createWriteStream(temp), { signal: controller.signal });
      } finally { clearTimeout(inactivity); }
    }
    if (!options.overwrite && await exists(output)) throw new Error(`Output already exists: ${output}`);
    await rename(temp, output);
    return output;
  } catch (error) {
    if (controller.signal.aborted) throw controller.signal.reason;
    throw error;
  } finally {
    process.removeListener('SIGINT', interrupt);
    process.removeListener('SIGTERM', interrupt);
    await rm(temp, { force: true });
  }
}
