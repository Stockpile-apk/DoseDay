// Water tab and the shared water helpers.
import { h, btn, card, field, numberInput, item, empty, progress, toast, num } from '../ui.js';
import { db, getSetting, setSetting } from '../db.js';
import { nowTime, todayISO } from '../dates.js';
import { waterTotal } from '../logic/nutrition.js';
import { setupLink } from './food-common.js';

export async function addWater(date, ml) {
  await db.put('waterLog', { date, time: nowTime(), ml });
}

export async function renderWater(root, ctx, { t }) {
  const date = todayISO();
  const step = Number(await getSetting('waterStepMl', 250)) || 250;
  const entries = (await db.where('waterLog', 'date', date)).sort((a, b) => String(a.time).localeCompare(String(b.time)));
  const total = waterTotal(entries);
  const stepIn = numberInput({ value: step, min: 50, step: 50 });
  root.append(
    btn(`+${step} mL`, async () => { await addWater(date, step); ctx.refresh(); }, 'primary block', { style: { minHeight: '72px', fontSize: '1.4rem' } }),
    card('Today', progress('Water', total, t.waterMl || 0, 'mL'), !t.waterMl ? setupLink() : null,
      h('p', { class: 'small muted' }, 'The target is total water from food and all drinks (Health Canada). No GLP-1-specific target was found.')),
    card('Button size', field('Amount added per tap (mL)', stepIn),
      btn('Save amount', async () => { const v = num(stepIn); if (!(v > 0)) { toast('Enter a number above 0', 'warn'); return; } await setSetting('waterStepMl', v); toast('Saved', 'ok'); ctx.refresh(); })),
    card('Entries today', entries.length ? h('div', { class: 'list' }, entries.map(e => item({ title: `${e.ml} mL`, sub: e.time || '', chevron: false,
      right: btn('Delete', async () => { await db.del('waterLog', e.id); ctx.refresh(); }, 'small danger', { 'aria-label': `Delete ${e.ml} mL at ${e.time || ''}` }) }))) : empty('No water logged today.')));
}
