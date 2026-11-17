// Log-dose sheet for one scheduled slot or an unscheduled dose.
import { h, btn, banner, field, input, numberInput, sheet, toast, num } from '../ui.js';
import { db, getSetting } from '../db.js';
import { DEFAULT_SITES, nextSite, doseOn, tooSoon } from '../logic/schedule.js';
import { toISODate, fmtDateTime } from '../dates.js';
import { toLocalInput, fromLocalInput } from './meds-common.js';

async function decrementInventory(med, amount, unit) {
  const inv = (await db.all('inventory')).filter(i => i.medId === med.id && Number(i.remaining) > 0)
    .sort((a, b) => String(a.openedDate || a.mixedDate || '').localeCompare(String(b.openedDate || b.mixedDate || '')));
  const rec = inv[0];
  if (!rec) return;
  let sub = 0;
  if (rec.unit === 'doses') sub = 1;
  else if (rec.unit === 'mg' && Number(amount) > 0) sub = unit === 'mg' ? Number(amount) : unit === 'mcg' ? Number(amount) / 1000 : 0;
  if (sub > 0) await db.put('inventory', { ...rec, remaining: Math.max(0, Math.round((Number(rec.remaining) - sub) * 1000) / 1000) });
}

export const logSheet = (med, slot, ctx) => openLogSheet(med, slot, () => ctx.refresh());

export async function openLogSheet(med, slot, onDone) {
  const all = await db.all('doses');
  const mine = all.filter(d => d.medId === med.id);
  const sites = await getSetting('sites', DEFAULT_SITES);
  const now = new Date();
  const eff = slot ? slot.dose : doseOn(med, toISODate(now));
  const amount = numberInput({ value: eff.amount ?? '', placeholder: 'Type your dose' });
  const unit = input({ value: eff.unit || med.doseUnit || '', style: { maxWidth: '110px' } });
  let site = (nextSite(sites, all) || {}).id || '';
  const chips = h('div', { class: 'chips' });
  const drawChips = () => { chips.replaceChildren(...sites.map(s => h('button', { type: 'button', class: 'chip' + (s.id === site ? ' on' : ''),
    onclick: () => { site = site === s.id ? '' : s.id; drawChips(); } }, s.label))); };
  drawChips();
  const when = input({ type: 'datetime-local', value: toLocalInput(now) });
  const note = input({ placeholder: 'Optional note' });
  const body = h('div', { class: 'stack' });
  body.append(h('p', { class: 'muted' }, slot ? 'Scheduled: ' + fmtDateTime(slot.scheduledAt) : 'Extra / unscheduled dose'));
  const ts = tooSoon(med, mine, now);
  if (ts) body.append(banner('info', '', `Your entry for this medicine says at least ${ts.minHours} hours between doses. The last dose was logged ${Math.round(ts.hoursSince * 10) / 10} hours ago.`));
  body.append(h('div', { class: 'row' }, h('div', { class: 'grow' }, field('Dose amount (your own number)', amount)), field('Unit', unit)),
    field('Site', chips), field('Time taken', when), field('Note', note));
  let s;
  const save = async status => {
    const taken = fromLocalInput(when.value) || new Date();
    await db.put('doses', { medId: med.id, scheduledAt: slot ? slot.scheduledAt.toISOString() : null, takenAt: taken.toISOString(), status,
      doseAmount: num(amount), doseUnit: unit.value.trim(), siteId: status === 'skipped' ? '' : site, note: note.value.trim() });
    if (status !== 'skipped') await decrementInventory(med, num(amount), unit.value.trim());
    s.close(); toast(status === 'skipped' ? 'Skipped dose logged' : 'Dose logged', 'ok'); onDone && onDone();
  };
  if (slot) body.append(btn('Log an extra / unscheduled dose instead', () => { s.close(); openLogSheet(med, null, onDone); }, 'ghost small'));
  const big = { style: { minHeight: '56px' } };
  s = sheet({ title: 'Log dose: ' + (med.name || ''), body, actions: [
    btn('Skipped', () => save('skipped'), '', big), btn('Taken late', () => save('late'), '', big), btn('Taken', () => save('taken'), 'primary', big)] });
}
