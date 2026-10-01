<p align="center"><a href="README.md">English</a> | 中文</p>

# 猫抓命令行工具

在终端通过无界面的 Chromium 捕获网页媒体请求，并下载直链文件、HLS 与 DASH。原浏览器扩展仍在仓库中，见 [扩展文档](README_en.md)。仅用于下载自己拥有或已获授权的媒体。

## 安装

需要 Node.js 22 或更高版本。HLS/DASH 下载需要 PATH 中的 FFmpeg，也可使用 `--ffmpeg` 指定。在仓库根目录执行：

```powershell
npm.cmd ci
npx.cmd playwright install chromium
npm.cmd link
cat-catch --help
```

PowerShell 如果阻止 `.ps1`，请使用 `npm.cmd` 和 `npx.cmd`。不执行 `npm link` 时，可在仓库根目录运行 `node cli/bin.js`。如需自定义 Chromium 安装位置，安装和运行时应设置相同的绝对路径 `PLAYWRIGHT_BROWSERS_PATH`。

## 示例

```powershell
cat-catch sniff "https://example.com/watch" --click ".play"
cat-catch sniff "https://example.com/watch" --format json --include-headers -o capture.json
cat-catch download --from capture.json --id 1 -o video.mp4
cat-catch download "https://example.com/video.mp4" -o video.mp4
cat-catch download "https://example.com/master.m3u8" -o video.mp4 --duration 60
```

`cat-catch sniff <page-url> [options]` 打开 HTTP(S) 网页，观察主页面、子框架和新页面的响应，尝试静音播放媒体元素，并列出媒体。没有结果时也以成功状态退出。

| 嗅探选项 | 作用和默认值 |
|---|---|
| `--wait <seconds>` | 导航和点击后收集的秒数；默认 `15`，允许 `0`。 |
| `--format table\|json` | 结果格式；默认 `table`，列为 ID、TYPE、SIZE、URL。 |
| `-o, --output <file>` | 写入新文件而非标准输出；文件已存在时失败。 |
| `--type <list>` | 逗号分隔的 `video,audio,hls,dash,other`；默认全部。 |
| `--match <regex>` | 仅保留 URL 符合 JavaScript 正则表达式的资源。 |
| `--max-results <count>` | 不同资源的最大条数；默认 `1000`，须为正整数。 |
| `--click <css-selector>` | 点击主页面中的匹配元素；可多次使用，按顺序执行。 |
| `--no-autoplay` | 跳过对 `video`/`audio` 元素的静音播放尝试。 |
| `--storage-state <file>` | 导入 Playwright 存储状态 JSON；不能与 `--cookies` 同用。 |
| `--cookies <file>` | 导入 Playwright Cookie 数组 JSON；不能与 `--storage-state` 同用。 |
| `--include-headers` | 在 JSON 中写入请求头，可能包含身份凭据。 |

`cat-catch download <media-url> -o <file> [options]` 下载 HTTP(S) URL。`cat-catch download --from <capture.json> --id <id> -o <file> [options]` 下载一条捕获记录。URL 与 `--from` 互斥；`--from` 和 `--id` 必须一起使用。

| 下载选项 | 作用和默认值 |
|---|---|
| `-o, --output <file>` | 必填目标文件；默认保护现有文件。 |
| `--from <capture.json>` | 读取格式版本为 1 的捕获文件。 |
| `--id <id>` | 从该文件选择正整数资源 ID。 |
| `--mode auto\|direct\|hls\|dash` | 下载方式；默认 `auto`，根据后缀或 MIME 判断。 |
| `--overwrite` | 成功后允许替换现有目标文件。 |
| `--ffmpeg <path>` | HLS/DASH 使用的 FFmpeg 程序；默认 `ffmpeg`。 |
| `--duration <seconds>` | 限制 HLS/DASH 输出时长；直播清单必须指定。 |

| 共用选项 | 作用和默认值 |
|---|---|
| `-H, --header "Name: value"` | 添加请求头；可重复，后面的同名项覆盖前项。 |
| `--referer <url>` | Referer 请求头；覆盖 `-H Referer: ...`。 |
| `--user-agent <value>` | User-Agent 请求头；覆盖 `-H User-Agent: ...`。 |
| `--timeout <seconds>` | 导航/操作或网络超时秒数；默认 `30`，须为正数；不是总下载时限。 |
| `-h, --help` | 查看全局或命令帮助。 |
| `-V, --version` | 查看软件包版本。 |

捕获 JSON 包含 `schemaVersion: 1`、`pageUrl` 和 `resources`。每条资源含 `id`、`url`、`category`、`mimeType`、`filename`、`size`（字节或 `null`）和 `pageUrl`。只有指定 `--include-headers` 才包含 `headers`。ID 在单次捕获中唯一；带签名的 URL 查询参数原样保留。需要身份验证时，用 `--include-headers` 导出捕获文件，或手动传入请求头。包含身份信息的会话及捕获文件应按密钥保护。

结果输出到标准输出，错误输出到标准错误。退出码：`0` 成功，`1` 运行或下载失败，`2` 参数或输入文件无效，`130` 被中断。

## 限制

登录网站需导入有效的 Playwright 会话或 Cookie；工具不会处理登录挑战。部分网站需要 `--click` 才开始播放。`blob:` 媒体需要找到底层可访问的网络请求。不支持 DRM 解密。签名 URL 可能过期。FFmpeg 只复制流，不转码，因此输出容器须兼容。直播 HLS/DASH 须指定 `--duration`。传给 FFmpeg 的显式或捕获请求头可能发送给清单及分片主机。

浏览器扩展仍可通过仓库中的 manifest 使用。猫抓采用 GPL-3.0 许可，见 [LICENSE](LICENSE)。
