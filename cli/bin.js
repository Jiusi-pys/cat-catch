#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';
import { parseArgs, UsageError } from './options.js';
import { capture } from './capture.js';
import { download } from './download.js';
import { readFile } from 'node:fs/promises';

const help = `Cat-Catch CLI
Usage:
  cat-catch sniff <page-url> [options]
  cat-catch download <media-url> -o <file> [options]
  cat-catch download --from <capture.json> --id <id> -o <file> [options]

Shared: -H, --header "Name: value" (repeatable); --referer <url>;
        --user-agent <value>; --timeout <seconds> (default 30)
Sniff: --wait <seconds> (15); --format table|json (table);
       -o, --output <file>; --type <video,audio,hls,dash,other>;
       --match <regex>; --max-results <count> (1000);
       --click <css-selector> (repeatable); --no-autoplay;
       --storage-state <file> | --cookies <file>; --include-headers
Download: --mode auto|direct|hls|dash (auto); --overwrite;
          --ffmpeg <path> (ffmpeg); --duration <seconds>;
          --from <capture.json> --id <id>
Global: -h, --help; -V, --version
`;

function table(result) {
  const rows = [['ID', 'TYPE', 'SIZE', 'URL'], ...result.resources.map(r => [String(r.id), r.category, r.size == null ? '-' : String(r.size), r.url])];
  return rows.map(row => row.join('\t')).join('\n') + '\n';
}

async function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.command === 'help') { process.stdout.write(help); return; }
    if (options.command === 'version') {
      const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
      process.stdout.write(pkg.version + '\n'); return;
    }
    if (options.command === 'sniff') {
      const result = await capture(options);
      const text = options.format === 'json' ? JSON.stringify(result, null, 2) + '\n' : table(result);
      if (options.output) await writeFile(options.output, text, { flag: 'wx' });
      else process.stdout.write(text);
      return;
    }
    const output = await download(options);
    process.stdout.write(`${output}\n`);
  } catch (error) {
    process.stderr.write(`cat-catch: ${error.message}\n`);
    process.exitCode = error instanceof UsageError ? 2 : error.message === 'Interrupted' ? 130 : 1;
  }
}

await main();
