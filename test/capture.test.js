import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { capture } from '../cli/capture.js';

test('headless capture sees clicked JavaScript media requests and preserves signed URLs', async () => {
  const server = createServer((req, res) => {
    if (req.url === '/') {
      res.setHeader('Content-Type', 'text/html');
      res.end('<button id="play">Play</button><script>document.querySelector("#play").onclick = () => fetch("/media?sig=123")</script>');
      return;
    }
    res.setHeader('Content-Type', 'video/mp4');
    res.end('media');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const url = `http://127.0.0.1:${server.address().port}/`;
    const result = await capture({ url, click: ['#play'], wait: .2, timeout: 5, maxResults: 100, type: ['video'], headers: {}, includeHeaders: false });
    assert.equal(result.schemaVersion, 1);
    assert.equal(result.resources.length, 1);
    assert.match(result.resources[0].url, /media\?sig=123/);
    assert.equal(result.resources[0].category, 'video');
    assert.equal('headers' in result.resources[0], false);
  } finally { server.close(); }
});
