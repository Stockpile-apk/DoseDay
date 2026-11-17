// End-to-end checks in headless Chrome at phone size. Run: node tools/e2e.mjs
// Covers the flows that matter most: log a dose from Home, add a weight, calculator, backup round trip, goal floor.
import { createRequire } from 'node:module';
const require = createRequire('/opt/npm-tools/node_modules/');
const { chromium } = require('playwright');
const port = 8100 + Math.floor(Math.random() * 800);
process.argv[2] = String(port);
const { server } = await import('./serve.mjs');
const { seedScript } = await import('./seed.mjs');
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
const ctx = await browser.newContext({ viewport: { width: 390, height: 800 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
const base = `http://localhost:${port}/index.html`;
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  (' + detail + ')' : ''}`); };
const nav = async hash => { await page.goto(base + hash); await page.evaluate(() => window.dispatchEvent(new HashChangeEvent('hashchange'))); await page.waitForTimeout(600); };
const count = store => page.evaluate(async s => (await (await import('./js/db.js')).db.all(s)).length, store);
const get = (store, id) => page.evaluate(async ([s, i]) => (await import('./js/db.js')).db.get(s, i), [store, id]);

await page.goto(base + '#/home'); await page.waitForTimeout(600);
check('first run shows the disclaimer and blocks dismissal', await page.getByRole('button', { name: 'I understand and agree' }).count() === 1
  && await page.getByRole('button', { name: 'Close' }).count() === 0);
await page.getByRole('button', { name: 'I understand and agree' }).click();
await page.evaluate(seedScript); await page.waitForTimeout(300);

// 1. Log a dose from Home in two taps; inventory goes down by one.
await nav('#/home');
const dosesBefore = await count('doses');
await page.getByRole('button', { name: 'Log dose' }).first().click();
await page.waitForTimeout(400);
const doseField = page.locator('.sheet input[type=number]').first();
check('log sheet pre-fills only the user\'s own dose (0.5)', (await doseField.inputValue()) === '0.5');
await page.locator('.sheet').getByRole('button', { name: 'Taken', exact: true }).click();
await page.waitForTimeout(600);
check('dose record saved', (await count('doses')) === dosesBefore + 1);
check('pen inventory decremented 2 -> 1', (await get('inventory', 'inv1')).remaining === 1);

// 2. Add a weight.
await nav('#/weight');
const wBefore = await count('weights');
await page.locator('input[aria-label="Weight in kg"]').fill('146.5');
await page.getByRole('button', { name: 'Save weight' }).click();
await page.waitForTimeout(500);
check('weight saved', (await count('weights')) === wBefore + 1);
await page.locator('input[aria-label="Weight in kg"]').fill('5');
await page.getByRole('button', { name: 'Save weight' }).click();
await page.waitForTimeout(300);
check('implausible weight rejected', (await count('weights')) === wBefore + 1);

// 3. Calculator: no result until a unit is chosen; then 10 mg + 2 mL, 1 mg -> 20 units.
await nav('#/calc');
const nums = page.locator('#view input[type=number]');
await nums.nth(0).fill('10'); await nums.nth(1).fill('2'); await nums.nth(2).fill('1');
await page.waitForTimeout(200);
check('calculator shows no units before mg/mcg is chosen', !/\b20 units\b/.test(await page.locator('#view').innerText()));
await page.locator('#view').getByRole('button', { name: 'mg', exact: true }).click();
await page.waitForTimeout(200);
check('calculator: 10 mg + 2 mL, 1 mg = 20 units', /\b20 units\b/.test(await page.locator('#view').innerText()));

// 4. Goal weight under BMI 18.5 is refused.
await nav('#/profile');
const goalBox = page.locator('input[aria-label="Weight in kg"]').nth(1);
await goalBox.fill('50');
await page.getByRole('button', { name: 'Save profile' }).click();
await page.waitForTimeout(400);
const prof = await page.evaluate(async () => (await import('./js/db.js')).getProfile());
check('goal under BMI 18.5 refused (still 110)', prof.goalKg === 110, 'goalKg=' + prof.goalKg);

// 5. Backup round trip restores every record.
const round = await page.evaluate(async () => {
  const m = await import('./js/db.js');
  const before = {}; for (const s of Object.keys(m.STORES)) before[s] = (await m.db.all(s)).length;
  const dump = JSON.parse(JSON.stringify(await m.exportAll({ photos: true })));
  await m.wipeAll();
  const emptied = (await m.db.all('weights')).length;
  await m.importAll(dump, { replace: true });
  const after = {}; for (const s of Object.keys(m.STORES)) after[s] = (await m.db.all(s)).length;
  return { same: JSON.stringify(before) === JSON.stringify(after), emptied, total: Object.values(after).reduce((a, b) => a + b, 0) };
});
check('backup export, wipe, restore gives the same record counts', round.same && round.emptied === 0, `${round.total} records`);
const bad = await page.evaluate(async () => { try { await (await import('./js/db.js')).importAll({ app: 'Other', stores: {} }); return 'accepted'; } catch (e) { return 'rejected'; } });
check('foreign backup file rejected', bad === 'rejected');

// 6. Calendar file builds from the stored schedule.
const ics = await page.evaluate(async () => {
  const r = await import('./js/views/reminders.js'); const i = await import('./js/logic/ics.js');
  const ev = await r.calendarEvents(await r.reminderSettings());
  return { n: ev.length, text: i.buildICS(ev) };
});
check('calendar export has the med, check-in, vitamins and backup events', ics.n >= 4 && ics.text.includes('RRULE:FREQ=WEEKLY;BYDAY=') && !/0\.5 ?mg/.test(ics.text), ics.n + ' events');

check('no JavaScript errors during the run', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close(); server.close();
const failed = results.filter(r => !r.ok).length;
console.log(`\n${results.length - failed} of ${results.length} checks passed`);
process.exit(failed ? 1 : 0);
