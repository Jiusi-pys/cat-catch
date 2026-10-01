import test from 'node:test';
import assert from 'node:assert/strict';
import { classify, collectResource } from '../cli/media.js';

test('classifies URL and MIME, including extensionless signed playlists', () => {
  assert.equal(classify('https://a.test/a.m3u8?token=1', ''), 'hls');
  assert.equal(classify('https://a.test/stream?token=1', 'application/dash+xml'), 'dash');
  assert.equal(classify('https://a.test/a.mp4', 'application/octet-stream'), 'video');
  assert.equal(classify('https://a.test/a.mp3', ''), 'audio');
  assert.equal(classify('https://a.test/a.ts', ''), null);
});

test('collects metadata and deduplicates exact URLs only', () => {
  const seen = new Map();
  const base = { mimeType: 'video/mp4', pageUrl: 'https://a.test/page', headers: {} };
  assert.equal(collectResource(seen, { ...base, url: 'https://a.test/a?sig=1' }).id, 1);
  assert.equal(collectResource(seen, { ...base, url: 'https://a.test/a?sig=1' }), null);
  assert.equal(collectResource(seen, { ...base, url: 'https://a.test/a?sig=2' }).id, 2);
});
