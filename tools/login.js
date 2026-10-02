#!/usr/bin/env node
// 打开有头 Chromium 供手动登录，登录成功后把 Playwright storage state 写入文件。
// 用法: node tools/login.js [输出文件] [等待分钟数]
// 生成的文件包含账号凭证，按密钥对待，不要提交到仓库。
import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const target = resolve(process.argv[2] || 'bilibili-login.json');
const minutes = Number(process.argv[3] || 10);
if (!Number.isFinite(minutes) || minutes <= 0) {
  process.stderr.write('等待分钟数必须是正数\n');
  process.exit(2);
}

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext();
const page = await context.newPage();

let closed = false;
browser.on('disconnected', () => { closed = true; });

await page.goto('https://www.bilibili.com/', { waitUntil: 'domcontentloaded' });
process.stdout.write(`请在打开的窗口里登录（扫码或账号密码），最多等待 ${minutes} 分钟。\n登录成功后会写入 ${target}\n`);

async function account() {
  try {
    const response = await context.request.get('https://api.bilibili.com/x/web-interface/nav', { timeout: 10000 });
    const body = await response.json();
    return body?.data?.isLogin ? body.data.uname || '(已登录)' : null;
  } catch {
    return null;
  }
}

const deadline = Date.now() + minutes * 60_000;
let state = null;
let uname = null;
while (!closed && Date.now() < deadline) {
  const cookies = await context.cookies('https://www.bilibili.com').catch(() => []);
  if (cookies.some(cookie => cookie.name === 'SESSDATA' && cookie.value)) {
    uname = await account();
    if (uname) { state = await context.storageState(); break; }
  }
  await new Promise(resolve => setTimeout(resolve, 2000));
}

const closedByUser = closed;
await browser.close();

if (!state) {
  process.stderr.write(closedByUser ? '浏览器在登录完成前被关闭。\n' : `等待超时（${minutes} 分钟）仍未检测到登录状态。\n`);
  process.exit(1);
}

await writeFile(target, JSON.stringify(state, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 });
process.stdout.write(`登录成功: ${uname}\n已写入 ${target}（${state.cookies.length} 个 cookie）。请勿提交此文件。\n`);
