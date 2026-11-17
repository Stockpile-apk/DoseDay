// Headless phone-size smoke test. Opens routes in Chrome and reports JavaScript errors.
// Usage: node tools/smoke.mjs "#/home" "#/meds" ...   [--shot=dir] [--seed] [--keep-disclaimer]
//   --shot=dir          save a screenshot of each route into dir
//   --seed              load tools/seed.mjs sample data first (if the file exists)
// Exit code 1 when any route logs an error.
import { createRequire } from 'node:module';
import { existsSync, mkdirSync } from 'node:fs';
const require = createRequire('/opt/npm-tools/node_modules/');
const { chromium } = require('playwright');
const args = process.argv.slice(2);
const routes = args.filter(a => !a.startsWith('--'));
const shotDir = (args.find(a => a.startsWith('--shot=')) || '').slice(7);
const seed = args.includes('--seed');
const port = 8100 + Math.floor(Math.random() * 800);
process.argv[2] = String(port);
const { server } = await import('./serve.mjs');
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
const ctx = await browser.newContext({ viewport: { width: 390, height: 800 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
const page = await ctx.newPage();
const errors = [];
let current = '';
page.on('pageerror', e => errors.push(`${current}: ${e.message}`));
page.on('console', m => { if (m.type() === 'error') errors.push(`${current}: console: ${m.text()}`); });
page.on('requestfailed', r => errors.push(`${current}: request failed ${r.url()}`));
page.on('response', r => { if (r.status() >= 400) errors.push(`${current}: HTTP ${r.status()} ${r.url()}`); });
const base = `http://localhost:${port}/index.html`;
current = 'boot';
await page.goto(base + '#/home');
await page.waitForTimeout(600);
// Accept the first-run disclaimer unless asked not to.
if (!args.includes('--keep-disclaimer')) {
  const agree = page.getByRole('button', { name: 'I understand and agree' });
  if (await agree.count()) await agree.click();
}
if (seed && existsSync(new URL('./seed.mjs', import.meta.url))) {
  const { seedScript } = await import('./seed.mjs');
  await page.evaluate(seedScript);
  await page.waitForTimeout(300);
}
if (shotDir) mkdirSync(shotDir, { recursive: true });
for (const r of routes.length ? routes : ['#/home']) {
  current = r;
  await page.goto(base + r);
  await page.evaluate(() => window.dispatchEvent(new HashChangeEvent('hashchange')));
  await page.waitForTimeout(700);
  const text = (await page.locator('#view').innerText()).replace(/\s+/g, ' ').slice(0, 160);
  console.log(`${r} -> ${text}`);
  if (shotDir) await page.screenshot({ path: `${shotDir}/${r.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'home'}.png`, fullPage: true });
}
await browser.close();
server.close();
if (errors.length) { console.log('\nERRORS:\n' + [...new Set(errors)].join('\n')); process.exit(1); }
console.log('\nno errors');
