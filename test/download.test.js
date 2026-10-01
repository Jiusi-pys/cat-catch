import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { download } from '../cli/download.js';

test('streams exact bytes, follows redirects and protects existing files', async () => {
  const server = createServer((req, res) => {
    if (req.url === '/redirect') { res.writeHead(302, { Location: '/file' }).end(); return; }
    if (req.headers.authorization !== 'Bearer test') { res.writeHead(401).end(); return; }
    res.writeHead(200, { 'Content-Type': 'video/mp4' }).end(Buffer.from([0, 1, 2, 255]));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const dir = await mkdtemp(join(tmpdir(), 'cat-catch-'));
  const file = join(dir, 'clip.mp4');
  try {
    const url = `http://127.0.0.1:${server.address().port}/redirect`;
    await download({ url, output: file, mode: 'direct', headers: { authorization: 'Bearer test' }, timeout: 5 });
    assert.deepEqual(await readFile(file), Buffer.from([0, 1, 2, 255]));
    await assert.rejects(download({ url, output: file, mode: 'direct', headers: {}, timeout: 5 }), /exists/);
    await writeFile(file, 'old');
    await assert.rejects(download({ url, output: file, mode: 'direct', headers: {}, timeout: 5, overwrite: true }), /401/);
    assert.equal(await readFile(file, 'utf8'), 'old');
  } finally {
    server.close();
    await rm(dir, { recursive: true, force: true });
  }
});
