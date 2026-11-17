// Vitamins tab: own supplement list, daily checklist, upper-limit check, reference table.
import { h, btn, card, banner, field, input, numberInput, select, checkbox, item, empty, fold, sheet, toast, confirmBox, infoLine, num, badge } from '../ui.js';
import { db } from '../db.js';
import { todayISO } from '../dates.js';
import { ageFrom } from '../logic/targets.js';
import { driFor, overUpperLimit } from '../logic/nutrition.js';
import { loadTargetsData } from './food-common.js';

function vitSheet(v, dri, done) {
  const f = v || {};
  const name = input({ value: f.name || '' });
  const amount = numberInput({ value: f.amount ?? '', min: 0 });
  const unit = input({ value: f.unit || '', placeholder: 'mg, µg, IU' });
  const key = select([{ value: '', label: 'Not linked' }, ...dri.map(r => ({ value: r.key, label: `${r.name} (${r.unit})` }))], f.nutrientKey || '');
  const time = input({ type: 'time', value: f.time || '08:00' });
  const active = checkbox('Active (counts in the checklist and limit check)', f.active !== false);
  const err = h('p', { class: 'small' });
  const s = sheet({ title: v ? 'Edit supplement' : 'Add a supplement',
    body: h('div', { class: 'stack' }, field('Name', name),
      h('div', { class: 'grid2' }, field('Amount per day', amount), field('Unit', unit)),
      field('Linked nutrient', key, 'The unit must match the nutrient unit in the table for the limit check to work.'),
      field('Usual time', time), active, err),
    actions: [
      v ? btn('Delete', async () => { if (await confirmBox('Delete this supplement?', { okText: 'Delete', danger: true })) { await db.del('vitamins', f.id); s.close(); done(); } }, 'danger') : null,
      btn('Save', async () => {
        if (!name.value.trim()) { err.textContent = 'Name is required.'; return; }
        await db.put('vitamins', { ...f, name: name.value.trim(), amount: num(amount) || 0, unit: unit.value.trim(), nutrientKey: key.value, time: time.value || '', active: active.querySelector('input').checked });
        s.close(); toast('Saved', 'ok'); done();
      }, 'primary')].filter(Boolean) });
}

export async function renderVitamins(root, ctx, { profile }) {
  const dri = (await loadTargetsData()).dri || [];
  const date = todayISO();
  const vits = (await db.all('vitamins')).sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')));
  const logs = await db.where('vitaminLog', 'date', date);
  const active = vits.filter(v => v.active !== false);
  const age = ageFrom(profile.birthYear), sex = profile.sex;

  const over = overUpperLimit(active.map(v => ({ nutrientKey: v.nutrientKey, amount: v.amount })), dri, sex, age);
  for (const o of over) {
    root.append(banner('warn', 'Above upper limit',
      `${o.name}: ${o.total} ${o.unit} a day from your list is above the Health Canada upper limit of ${o.ul} ${o.unit}.${o.ulNote ? ' ' + o.ulNote + '.' : ''} Ask your pharmacist.`));
  }

  root.append(btn('Add a supplement', () => vitSheet(null, dri, () => ctx.refresh()), 'primary block'));

  const checklist = active.length ? h('div', { class: 'list' }, active.map(v => {
    const log = logs.find(l => l.vitaminId === v.id);
    return item({ title: v.name || 'Unnamed', sub: `${v.amount || ''} ${v.unit || ''}${v.time ? ' at ' + v.time : ''}`.trim(), chevron: false,
      right: h('span', { class: 'row' }, badge(log ? 'Taken' : 'Not yet', log ? 'ok' : ''), log ? '✓' : null),
      onClick: async () => { if (log) await db.del('vitaminLog', log.id); else await db.put('vitaminLog', { date, vitaminId: v.id, takenAt: new Date().toISOString() }); ctx.refresh(); } });
  })) : empty('No active supplements. Add the ones you take.');
  root.append(card('Today’s checklist', checklist, active.length ? h('p', { class: 'small muted' }, 'Tap a row to mark it taken. Tap again to undo.') : null));

  if (vits.length) root.append(card('Your supplement list', h('div', { class: 'list' }, vits.map(v => item({ title: v.name || 'Unnamed',
    sub: `${v.amount || ''} ${v.unit || ''}${v.active === false ? ' (inactive)' : ''}`.trim(),
    onClick: () => vitSheet(v, dri, () => ctx.refresh()) })))));

  const rows = dri.map(r => {
    const ref = driFor(r, sex, age);
    return h('tr', h('td', `${r.name} (${r.unit})`), h('td', ref.value === null || ref.value === undefined ? '–' : `${ref.value} ${ref.kind || ''}`),
      h('td', ref.ul === null || ref.ul === undefined ? 'No upper limit set' : String(ref.ul)));
  });
  root.append(fold('Daily reference intakes (Health Canada)',
    h('p', { class: 'small muted' }, 'RDA is a recommended intake; AI is an adequate intake. The limit check only works when your supplement units match the units in this table.'),
    h('div', { class: 'tblwrap' }, h('table', { class: 'tbl' }, h('thead', h('tr', h('th', 'Nutrient'), h('th', 'Your reference'), h('th', 'Upper limit'))), h('tbody', rows)))),
    infoLine());
}
