// Visit summary: a plain, printable page to show a prescriber or pharmacist.
import { h, btn, card, kv, segmented, infoLine } from '../ui.js';
import { db, getProfile } from '../db.js';
import { todayISO, addDays, fmtDate, fmtDateTime } from '../dates.js';
import { fmtWeight, fmtDelta } from '../units.js';
import { clean, tier } from '../logic/rate.js';
import { adherence, describeSchedule } from '../logic/schedule.js';
import { dayTotals, waterTotal } from '../logic/nutrition.js';
import { VERSION } from '../version.js';

const table = (cols, rows) => h('div', { class: 'tblwrap' }, h('table', { class: 'tbl' },
  h('thead', h('tr', cols.map(c => h('th', c)))), h('tbody', rows.map(r => h('tr', r.map(c => h('td', c ?? '')))))));

export async function render(root, ctx) {
  const days = Number(ctx.query.get('days')) || 30;
  const today = todayISO(), from = addDays(today, -days + 1);
  const [p, weights, meds, doses, effects, checkins, food, water] = await Promise.all([getProfile(), db.all('weights'), db.all('meds'),
    db.all('doses'), db.range('sideEffects', 'date', from, today), db.range('checkins', 'date', from, today), db.range('foodLog', 'date', from, today), db.range('waterLog', 'date', from, today)]);
  const u = p.units || 'kg';
  const ws = clean(weights).filter(w => w.date >= from);
  const t = tier(weights, today, p.tiers, { stillEscalating: p.stillEscalating });

  root.append(h('div', { class: 'stack' },
    segmented([{ value: 14, label: '14 days' }, { value: 30, label: '30 days' }, { value: 90, label: '90 days' }], days, v => ctx.go(`#/report?days=${v}`)),
    btn('Print or save as PDF', () => window.print(), 'primary block')));

  root.append(card(`DoseDay summary: ${fmtDate(from, { year: true })} to ${fmtDate(today, { year: true })}`,
    h('p', { class: 'small muted' }, 'Self-recorded in a personal tracking app. Not a medical record.'),
    p.heightCm ? kv('Height', `${p.heightCm} cm`) : null,
    ws.length ? kv('Weight', `${fmtWeight(ws[0].kg, u)} → ${fmtWeight(ws[ws.length - 1].kg, u)} (${fmtDelta(ws[ws.length - 1].kg - ws[0].kg, u, 1)})`) : kv('Weight', 'No weigh-ins in this period'),
    t.rate ? kv('Pace, last 14 days', `${fmtDelta(t.rate.kgPerWk, u)} a week, ${t.rate.pctPerWk.toFixed(2)}% of body weight a week (${t.label})`) : null,
    p.goalKg ? kv('Goal', fmtWeight(p.goalKg, u)) : null));

  const active = meds.filter(m => m.active !== false);
  if (active.length) {
    root.append(card('Medicines (as entered by the user)', table(['Medicine', 'Schedule', 'Dose on file', 'Taken / due'], active.map(m => {
      const a = adherence(m, doses.filter(d => d.medId === m.id), new Date(), days);
      return [m.name, describeSchedule(m), m.dose ? `${m.dose} ${m.doseUnit || ''}` : '', a.expected ? `${a.taken} / ${a.expected}` : '—'];
    }))));
    const logged = doses.filter(d => d.takenAt && d.takenAt.slice(0, 10) >= from).sort((a, b) => (a.takenAt < b.takenAt ? 1 : -1));
    const name = id => (meds.find(m => m.id === id) || {}).name || '';
    if (logged.length) root.append(card('Dose log', table(['When', 'Medicine', 'Status', 'Amount', 'Site'],
      logged.map(d => [fmtDateTime(d.takenAt), name(d.medId), d.status, d.doseAmount ? `${d.doseAmount} ${d.doseUnit || ''}` : '', d.siteId || '']))));
  }

  if (effects.length) root.append(card('Side effects', table(['Date', 'Type', 'Severity (1-5)', 'Note'],
    [...effects].sort((a, b) => (a.date < b.date ? 1 : -1)).map(e => [fmtDate(e.date), e.type, String(e.severity), e.note || '']))));

  if (ws.length) root.append(card('Weigh-ins', table(['Date', 'Weight'], [...ws].reverse().map(w => [fmtDate(w.date), fmtWeight(w.kg, u)]))));

  const byDate = {};
  for (const f of food) (byDate[f.date] = byDate[f.date] || []).push(f);
  const fdays = Object.keys(byDate);
  if (fdays.length) {
    let kcal = 0, prot = 0;
    for (const d of fdays) { const x = dayTotals(byDate[d]); kcal += x.kcal; prot += x.protein; }
    root.append(card('Food and water (days with entries)',
      kv('Days logged', String(fdays.length)),
      kv('Average calories', `${Math.round(kcal / fdays.length).toLocaleString('en-CA')} kcal`),
      kv('Average protein', `${Math.round(prot / fdays.length)} g`),
      water.length ? kv('Average water logged', `${Math.round(waterTotal(water) / new Set(water.map(w => w.date)).size).toLocaleString('en-CA')} mL`) : null));
  }
  if (checkins.length) root.append(card('Check-in notes', table(['Date', 'Waist', 'Energy', 'Hunger', 'Note'],
    [...checkins].sort((a, b) => (a.date < b.date ? 1 : -1)).map(c => [fmtDate(c.date), c.waistCm ? `${c.waistCm} cm` : '', c.energy ? `${c.energy}/5` : '', c.hunger ? `${c.hunger}/5` : '', c.note || '']))));

  root.append(h('p', { class: 'source' }, `Made with DoseDay ${VERSION} on ${fmtDate(today, { year: true })}. Photos are never included.`));
  root.append(infoLine());
}
