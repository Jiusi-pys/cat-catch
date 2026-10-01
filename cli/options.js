export class UsageError extends Error {}

const shared = { '-H': 'header', '--header': 'header', '--referer': 'referer', '--user-agent': 'userAgent', '--timeout': 'timeout' };
const sniff = { '--wait': 'wait', '--format': 'format', '-o': 'output', '--output': 'output', '--type': 'type', '--match': 'match', '--max-results': 'maxResults', '--click': 'click', '--storage-state': 'storageState', '--cookies': 'cookies' };
const down = { '-o': 'output', '--output': 'output', '--mode': 'mode', '--from': 'from', '--id': 'id', '--ffmpeg': 'ffmpeg', '--duration': 'duration' };
const flags = { '--include-headers': 'includeHeaders', '--no-autoplay': 'noAutoplay', '--overwrite': 'overwrite' };

export function assertHttpUrl(value) {
  try { if (['http:', 'https:'].includes(new URL(value).protocol)) return; } catch { /* invalid */ }
  throw new UsageError('Expected an HTTP or HTTPS URL');
}

function positive(value, label, allowZero = false) {
  const n = Number(value);
  if (!Number.isFinite(n) || (allowZero ? n < 0 : n <= 0)) throw new UsageError(`${label} must be ${allowZero ? 'nonnegative' : 'positive'}`);
  return n;
}

export function parseArgs(argv) {
  if (!argv.length || argv[0] === '-h' || argv[0] === '--help') return { command: 'help' };
  if (argv[0] === '-V' || argv[0] === '--version') return { command: 'version' };
  const command = argv[0];
  if (!['sniff', 'download'].includes(command)) throw new UsageError(`Unknown command: ${command}`);
  const result = { command, header: [], click: [], timeout: 30 };
  const positional = [];
  const options = { ...shared, ...(command === 'sniff' ? sniff : down) };
  for (let i = 1; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') return { command: 'help', forCommand: command };
    if (flags[arg] && ((command === 'sniff') === (arg !== '--overwrite'))) { result[flags[arg]] = true; continue; }
    const key = options[arg];
    if (key) {
      const value = argv[++i];
      if (!value || value.startsWith('--')) throw new UsageError(`Missing value for ${arg}`);
      if (key === 'header' || key === 'click') result[key].push(value);
      else result[key] = value;
    } else if (arg.startsWith('-')) throw new UsageError(`Unknown option: ${arg}`);
    else positional.push(arg);
  }
  if (positional.length > 1) throw new UsageError('Expected one URL');
  result.url = positional[0];
  if (command === 'sniff') {
    if (!result.url) throw new UsageError('Page URL is required');
    assertHttpUrl(result.url);
    if (result.cookies && result.storageState) throw new UsageError('--cookies and --storage-state are mutually exclusive');
    result.wait = positive(result.wait ?? 15, '--wait', true);
    result.maxResults = positive(result.maxResults ?? 1000, '--max-results');
    if (!Number.isInteger(result.maxResults)) throw new UsageError('--max-results must be an integer');
    result.format ??= 'table';
    if (!['table', 'json'].includes(result.format)) throw new UsageError('--format must be table or json');
    result.type = result.type ? result.type.split(',') : ['video', 'audio', 'hls', 'dash', 'other'];
    if (result.type.some(t => !['video', 'audio', 'hls', 'dash', 'other'].includes(t))) throw new UsageError('Invalid --type');
    if (result.match) { try { result.match = new RegExp(result.match); } catch { throw new UsageError('Invalid --match regex'); } }
  } else {
    if (Boolean(result.url) === Boolean(result.from)) throw new UsageError('URL and --from are mutually exclusive; provide one');
    if (result.url) assertHttpUrl(result.url);
    if (result.from && !result.id || !result.from && result.id) throw new UsageError('--from requires --id and vice versa');
    if (!result.output) throw new UsageError('--output is required');
    result.mode ??= 'auto';
    if (!['auto', 'direct', 'hls', 'dash'].includes(result.mode)) throw new UsageError('Invalid --mode');
    if (result.id) { result.id = positive(result.id, '--id'); if (!Number.isInteger(result.id)) throw new UsageError('--id must be an integer'); }
    if (result.duration) result.duration = positive(result.duration, '--duration');
  }
  result.timeout = positive(result.timeout, '--timeout');
  result.headers = {};
  for (const h of result.header) {
    const split = h.indexOf(':');
    if (split < 1 || !/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(h.slice(0, split))) throw new UsageError('Invalid header; use Name: value');
    result.headers[h.slice(0, split).toLowerCase()] = h.slice(split + 1).trim();
  }
  if (result.referer) { assertHttpUrl(result.referer); result.headers.referer = result.referer; }
  if (result.userAgent) result.headers['user-agent'] = result.userAgent;
  return result;
}
