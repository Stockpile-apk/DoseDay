// Home: what needs doing today, in one column. Order: dose, rate, intake, check-in, stock, recent.
import { h, btn, card, banner, badge, progress, kv, toast, infoLine } from '../ui.js';
import { db, getProfile, getSetting } from '../db.js';
import { todayISO, addDays, fmtDate, fmtTime, relTime, daysBetween, nowTime } from '../dates.js';
import { tier, clean } from '../logic/rate.js';
import { suggest, effective } from '../logic/targets.js';
import { dayTotals, waterTotal } from '../logic/nutrition.js';
import { nextDue, adherence, describeSchedule } from '../logic/schedule.js';
import { tierBanner } from './weight.js';
import { VERSION, DATA_NOTE } from '../version.js';

const fmtDose = d => (d && d.amount !== null && d.amount !== undefined && d.amount !== '' ? `${d.amount} ${d.unit || ''}`.trim() : '');

export async function render(root, ctx) {
  const now = new Date();
  const today = todayISO(now);
  const [profile, meds, doses, weights, foodToday, waterToday, checkins, effects] = await Promise.all([
    getProfile(), db.all('meds'), db.all('doses'), db.all('weights'), db.where('foodLog', 'date', today),
    db.where('waterLog', 'date', today), db.all('checkins'), db.range('sideEffects', 'date', addDays(today, -14), today)]);
  const units = profile.units || 'kg';
  const ws = clean(weights);
  const active = meds.filter(m => m.active !== false);

  // First-run help
  if (!ws.length && !active.length) {
    root.append(card('Welcome to DoseDay',
      h('p', 'Three quick steps get the app working for you. Everything stays on this phone.'),
      h('div', { class: 'list' },
        h('a', { class: 'item', href: '#/profile' }, h('div', { class: 'grow' }, h('div', { class: 't' }, '1. Set up your profile'), h('div', { class: 's' }, 'Height, weight, units and targets')), h('span', { class: 'chev' }, '›')),
        h('a', { class: 'item', href: '#/meds/new' }, h('div', { class: 'grow' }, h('div', { class: 't' }, '2. Add a medicine'), h('div', { class: 's' }, 'Your schedule and your own dose')), h('span', { class: 'chev' }, '›')),
        h('a', { class: 'item', href: '#/weight' }, h('div', { class: 'grow' }, h('div', { class: 't' }, '3. Log your first weight'), h('div', { class: 's' }, 'The weekly rate appears after 4 weigh-ins')), h('span', { class: 'chev' }, '›')))));
  }

  // (a) Today: doses
  if (active.length) {
    const sec = card('Today');
    let logSheet = null;
    try { logSheet = (await import('./meds-log.js')).openLogSheet; } catch { /* meds screen handles logging */ }
    for (const med of active) {
      const mine = doses.filter(d => d.medId === med.id);
      const slot = nextDue(med, mine, now);
      const log = () => (logSheet ? logSheet(med, slot, () => ctx.refresh()) : ctx.go(`#/meds?log=${encodeURIComponent(med.id)}`));
      if (!slot) {
        sec.append(h('div', { class: 'row between' }, h('div', { class: 'grow' }, h('strong', med.name), h('div', { class: 'muted small' }, describeSchedule(med))),
          btn('Log', log, 'small')));
        continue;
      }
      const when = `${fmtDate(slot.scheduledAt)} ${fmtTime(slot.scheduledAt)}`;
      const dose = fmtDose(slot.dose);
      if (slot.status === 'overdue') {
        sec.append(banner('warn', `${med.name}: overdue`, `Was due ${when} (${relTime(slot.scheduledAt, now)}).${dose ? ' Your dose on file: ' + dose + '.' : ''}`,
          btn('Log dose', log, 'primary')));
      } else {
        const dueToday = slot.status === 'due';
        sec.append(h('div', { class: 'row between' },
          h('div', { class: 'grow' }, h('strong', med.name), ' ', dueToday ? badge('Due today', 'info') : null,
            h('div', { class: 'muted small' }, `${when} · ${relTime(slot.scheduledAt, now)}${dose ? ' · ' + dose : ''}`)),
          btn(dueToday ? 'Log dose' : 'Log', log, dueToday ? 'primary' : 'small')));
      }
    }
    root.append(sec);
  }

  // (b) Weekly rate
  const t = tier(weights, today, profile.tiers, { stillEscalating: profile.stillEscalating });
  if (ws.length) {
    const last = ws[ws.length - 1];
    const b = tierBanner(t, units, { compact: true });
    b.append(h('div', { class: 'row between small' }, h('span', { class: 'muted' }, `Last weigh-in ${fmtDate(last.date)}`), h('a', { href: '#/weight' }, 'Weight')));
    root.append(b);
  }

  // (c) Intake today
  const kgNow = ws.length ? ws[ws.length - 1].kg : (Number(profile.startKg) || null);
  const targets = effective(profile, suggest(profile, kgNow, now));
  const food = dayTotals(foodToday), water = waterTotal(waterToday);
  const step = await getSetting('waterStepMl', 250);
  root.append(card('Food and water today',
    progress('Protein', food.protein, targets.proteinG || 0, 'g'),
    progress('Calories', food.kcal, targets.kcal || 0, 'kcal'),
    progress('Water', water, targets.waterMl || 0, 'mL'),
    h('div', { class: 'row' },
      h('a', { class: 'btn grow', href: '#/food' }, 'Add food'),
      btn(`+ ${step} mL water`, async () => { await db.put('waterLog', { date: today, time: nowTime(), ml: step }); toast('Water added', 'ok'); ctx.refresh(); }, 'grow'))));

  // (d) Weekly check-in
  const lastCheck = [...checkins].sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  const since = lastCheck ? daysBetween(lastCheck.date, today) : null;
  if (ws.length || active.length) {
    if (since === null || since >= 7) {
      root.append(banner(since !== null && since >= 10 ? 'warn' : 'info', since === null ? 'Weekly check-in' : `Check-in due (last one ${since} days ago)`,
        'Weight is the only required part. Photos and notes are optional.', h('a', { class: 'btn primary', href: '#/checkin/new' }, 'Start check-in')));
    }
  }

  // (e) Stock
  try {
    const inv = await import('./inventory.js');
    const alerts = inv.inventoryAlerts ? await inv.inventoryAlerts() : [];
    if (alerts.length) {
      root.append(card('Stock', ...alerts.slice(0, 4).map(a => h('div', { class: 'row between' }, h('span', a.label),
        badge(a.text, a.kind === 'low' || a.kind === 'expiring' ? 'warn' : 'danger'))), h('a', { class: 'btn small', href: '#/inventory' }, 'Open inventory')));
    }
  } catch { /* inventory screen not available */ }

  // (f) Adherence and recent side effects
  if (active.length) {
    const rows = active.map(med => {
      const a = adherence(med, doses.filter(d => d.medId === med.id), now, 30);
      return kv(med.name, a.expected ? `${a.taken} of ${a.expected} doses (${a.pct}%)` : 'No doses due yet');
    });
    const recent = [...effects].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 3);
    root.append(card('Last 30 days', ...rows,
      recent.length ? h('p', { class: 'muted small' }, 'Recent side effects: ' + recent.map(e => `${e.type} (${e.severity}/5, ${fmtDate(e.date, { weekday: false })})`).join('; ')) : null,
      h('a', { class: 'btn small', href: '#/meds/effects' }, 'Log a side effect')));
  }

  root.append(h('a', { class: 'btn danger block', href: '#/warning' }, 'Warning signs: when to get help'));
  root.append(infoLine());
  root.append(h('p', { class: 'center muted small' }, `DoseDay ${VERSION} · ${DATA_NOTE}`));
}
