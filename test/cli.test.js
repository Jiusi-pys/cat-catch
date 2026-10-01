import test from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs } from '../cli/options.js';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('parses sniff options and validates combinations', () => {
  const p = parseArgs(['sniff', 'https://a.test', '--format', 'json', '--click', '.play', '--click', '#ok']);
  assert.equal(p.command, 'sniff');
  assert.deepEqual(p.click, ['.play', '#ok']);
  assert.throws(() => parseArgs(['sniff', 'https://a.test', '--cookies', 'a', '--storage-state', 'b']), /mutually exclusive/);
  assert.throws(() => parseArgs(['sniff', 'ftp://a.test']), /HTTP/);
  assert.throws(() => parseArgs(['sniff', 'https://a.test', '--bogus']), /Unknown option/);
});

test('parses direct and capture based downloads', () => {
  assert.equal(parseArgs(['download', 'https://a.test/a.mp4', '-o', 'a.mp4']).command, 'download');
  assert.equal(parseArgs(['download', '--from', 'a.json', '--id', '2', '-o', 'a.mp4']).id, 2);
  assert.throws(() => parseArgs(['download', 'https://a.test/a.mp4', '--from', 'a.json', '--id', '2', '-o', 'a.mp4']), /mutually exclusive/);
  assert.throws(() => parseArgs(['download', 'https://a.test/a.mp4']), /output/);
});

test('executable prints help and returns usage exit status', () => {
  const binary = fileURLToPath(new URL('../cli/bin.js', import.meta.url));
  const help = spawnSync(process.execPath, [binary, '--help'], { encoding: 'utf8' });
  assert.equal(help.status, 0);
  assert.match(help.stdout, /cat-catch sniff/);
  const bad = spawnSync(process.execPath, [binary, 'download', 'https://example.test/a.mp4'], { encoding: 'utf8' });
  assert.equal(bad.status, 2);
  assert.match(bad.stderr, /--output is required/);
});
