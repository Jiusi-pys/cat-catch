import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('both CLI readmes document every public option', async () => {
  const files = await Promise.all(['README.md', 'README_ZH.md'].map(file => readFile(new URL(`../${file}`, import.meta.url), 'utf8')));
  const options = ['--help', '--version', '--wait', '--format', '--output', '--type', '--match', '--max-results', '--click', '--no-autoplay', '--storage-state', '--cookies', '--include-headers', '--from', '--id', '--mode', '--overwrite', '--ffmpeg', '--duration', '--header', '--referer', '--user-agent', '--timeout'];
  for (const text of files) for (const option of options) assert.ok(text.includes(option), `${option} missing from README`);
});
