import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { collectResource } from './media.js';
import { UsageError } from './options.js';

export async function capture(options) {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (error) {
    throw new Error(`Chromium unavailable. Run "npx playwright install chromium". ${error.message}`);
  }
  try {
    let storageState;
    if (options.storageState) {
      try { storageState = JSON.parse(await readFile(options.storageState, 'utf8')); }
      catch (error) { throw new UsageError(`Cannot read storage state: ${error.message}`); }
    }
    const context = await browser.newContext({ storageState, extraHTTPHeaders: options.headers, serviceWorkers: 'allow' });
    if (options.cookies) {
      let cookies;
      try { cookies = JSON.parse(await readFile(options.cookies, 'utf8')); }
      catch (error) { throw new UsageError(`Cannot read cookies: ${error.message}`); }
      if (!Array.isArray(cookies)) throw new UsageError('Cookie file must contain a JSON array of Playwright cookies');
      try { await context.addCookies(cookies); } catch (error) { throw new UsageError(`Invalid cookie file: ${error.message}`); }
    }
    const seen = new Map();
    const pending = new Set();
    const accept = item => item && options.type.includes(item.category) && (!options.match || options.match.test(item.url));
    const onResponse = response => {
      const task = (async () => {
        if (seen.size >= options.maxResults) return;
        const url = response.url();
        if (!/^https?:/.test(url)) return;
        const headers = await response.allHeaders();
        const request = response.request();
        const requestHeaders = options.includeHeaders ? await request.allHeaders() : {};
        let pageUrl = options.url;
        try { pageUrl = request.frame()?.url() || options.url; } catch { /* service worker request */ }
        const candidate = collectResource(new Map(), { url, mimeType: headers['content-type'] || '', disposition: headers['content-disposition'] || '', size: headers['content-length'], pageUrl, resourceType: request.resourceType(), headers: requestHeaders, includeHeaders: options.includeHeaders });
        if (accept(candidate) && !seen.has(url) && seen.size < options.maxResults) {
          candidate.id = seen.size + 1;
          seen.set(url, candidate);
        }
      })().catch(() => {});
      pending.add(task);
      task.finally(() => pending.delete(task));
    };
    context.on('response', onResponse);
    const page = await context.newPage();
    page.setDefaultTimeout(options.timeout * 1000);
    await page.goto(options.url, { waitUntil: 'domcontentloaded', timeout: options.timeout * 1000 });
    for (const selector of options.click) await page.locator(selector).first().click({ timeout: options.timeout * 1000 });
    if (!options.noAutoplay) await page.evaluate(() => {
      for (const media of document.querySelectorAll('video, audio')) {
        media.muted = true;
        media.play().catch(() => {});
      }
    });
    await new Promise(resolve => setTimeout(resolve, options.wait * 1000));
    await Promise.allSettled([...pending]);
    return { schemaVersion: 1, pageUrl: options.url, resources: [...seen.values()] };
  } finally { await browser.close(); }
}
