import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { download } from '../cli/download.js';

test('FFmpeg downloads and remuxes a real VOD HLS playlist', { skip: spawnSync('ffmpeg', ['-version']).status !== 0 }, async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cat-hls-'));
  const result = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc=size=32x32:rate=2', '-t', '2', '-c:v', 'mpeg2video', '-f', 'hls', '-hls_time', '1', join(dir, 'master.m3u8')]);
  assert.equal(result.status, 0, result.stderr?.toString());
  const server = createServer(async (req, res) => {
    const name = req.url === '/master.m3u8' ? 'master.m3u8' : 'master0.ts';
    try { res.setHeader('Content-Type', name.endsWith('m3u8') ? 'application/vnd.apple.mpegurl' : 'video/mp2t'); res.end(await readFile(join(dir, name))); }
    catch { res.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const output = join(dir, 'out.ts');
    await download({ url: `http://127.0.0.1:${server.address().port}/master.m3u8`, output, mode: 'hls', headers: {}, timeout: 10 });
    assert.ok((await stat(output)).size > 0);
  } finally { server.close(); await rm(dir, { recursive: true, force: true }); }
});
