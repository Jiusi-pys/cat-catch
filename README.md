<p align="center">English | <a href="README_ZH.md">中文</a></p>

# Cat-Catch CLI

Capture media requests from websites with headless Chromium and download direct files, HLS, and DASH from a terminal. The original browser extension remains in this repository; see [its documentation](README_en.md). Use this software only for media you own or are authorized to download.

## Installation

Requires Node.js 22 or newer. HLS/DASH downloads require FFmpeg on PATH (or `--ffmpeg`). From the repository root:

```powershell
npm.cmd ci
npx.cmd playwright install chromium
npm.cmd link
cat-catch --help
```

On PowerShell, `npm.cmd` and `npx.cmd` avoid execution policy errors with `.ps1` wrappers. Without `npm link`, run `node cli/bin.js` from the repository root. If Chromium is installed in a custom directory, set the same absolute `PLAYWRIGHT_BROWSERS_PATH` during installation and execution.

## Examples

```powershell
cat-catch sniff "https://example.com/watch" --click ".play"
cat-catch sniff "https://example.com/watch" --format json --include-headers -o capture.json
cat-catch download --from capture.json --id 1 -o video.mp4
cat-catch download "https://example.com/video.mp4" -o video.mp4
cat-catch download "https://example.com/master.m3u8" -o video.mp4 --duration 60
```

`cat-catch sniff <page-url> [options]` opens an HTTP(S) page, observes responses from frames and new pages, tries muted playback of media elements, and lists media. Empty results exit successfully.

| Sniff option | Meaning and default |
|---|---|
| `--wait <seconds>` | Collection time after navigation and clicks; default `15`, accepts `0`. |
| `--format table\|json` | Result format; default `table`, columns ID, TYPE, SIZE, URL. |
| `-o, --output <file>` | Write a new file rather than stdout; fails if it already exists. |
| `--type <list>` | Comma separated `video,audio,hls,dash,other`; default all. |
| `--match <regex>` | Keep URLs matching a JavaScript regular expression. |
| `--max-results <count>` | Maximum unique results; default `1000`, positive integer. |
| `--click <css-selector>` | Click a matching element in the main page; repeatable, in order. |
| `--no-autoplay` | Skip the muted play attempt for `video`/`audio` elements. |
| `--storage-state <file>` | Import Playwright storage state JSON; exclusive with `--cookies`. |
| `--cookies <file>` | Import a JSON array of Playwright cookies; exclusive with `--storage-state`. |
| `--include-headers` | Include request headers in JSON results, potentially including credentials. |

`cat-catch download <media-url> -o <file> [options]` downloads an HTTP(S) URL. `cat-catch download --from <capture.json> --id <id> -o <file> [options]` selects one captured resource. The URL and `--from` are mutually exclusive; `--from` and `--id` must occur together.

| Download option | Meaning and default |
|---|---|
| `-o, --output <file>` | Required destination; existing files are protected. |
| `--from <capture.json>` | Load a schema version 1 capture file. |
| `--id <id>` | Select a positive integer resource ID from that file. |
| `--mode auto\|direct\|hls\|dash` | Method; default `auto`, selected by extension or MIME. |
| `--overwrite` | Permit replacing an existing destination after success. |
| `--ffmpeg <path>` | FFmpeg executable for HLS/DASH; default `ffmpeg`. |
| `--duration <seconds>` | Bound HLS/DASH output; required for live playlists. |

| Shared option | Meaning and default |
|---|---|
| `-H, --header "Name: value"` | Request header; repeatable, later values override earlier ones. |
| `--referer <url>` | Referer header; overrides `-H Referer: ...`. |
| `--user-agent <value>` | User-Agent header; overrides `-H User-Agent: ...`. |
| `--timeout <seconds>` | Navigation/action or network timeout; default `30`, positive. It is not a total download limit. |
| `-h, --help` | Show global or command help. |
| `-V, --version` | Show package version. |

Capture JSON has `schemaVersion: 1`, `pageUrl`, and `resources`. Each resource has `id`, `url`, `category`, `mimeType`, `filename`, `size` (bytes or `null`), and `pageUrl`. `headers` appears only with `--include-headers`. IDs are unique within a capture; signed URL query strings are preserved. For authenticated downloads, export a capture with `--include-headers` or pass headers explicitly. Treat session and capture files containing credentials as secrets.

Results go to stdout; errors go to stderr. Exit status: `0` success, `1` operational/download failure, `2` invalid arguments or input files, `130` interruption.

## Limits

Import a valid Playwright session or cookies for login sites; the CLI does not solve login challenges. Site playback may require `--click`. `blob:` media requires an underlying accessible network request. DRM decryption is unsupported. Signed media URLs can expire. FFmpeg copies streams without transcoding, so choose a compatible output container. Live HLS/DASH requires `--duration`. Without it, HLS verifies all referenced playlists are finite before FFmpeg starts; unverified, oversized (over 1 MiB), cyclic, or excessively deep playlists require `--duration`. Explicit or captured headers passed to FFmpeg may be sent to playlist and segment hosts.

The browser extension remains available through its manifests. Cat-Catch is licensed under GPL-3.0; see [LICENSE](LICENSE).
