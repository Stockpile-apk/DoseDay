// Reminders. Two ways: (A) notifications while the app is open or recently used,
// (B) a calendar file, so the phone's own calendar reminds you with the app closed. B is the reliable one.
import { h, btn, card, banner, kv, field, input, select, checkbox, toast, infoLine } from '../ui.js';
import { db, getSetting, setSetting } from '../db.js';
import { notify, requestNotify, notifyPermission, notifySupported, saveFile } from '../platform.js';
import { buildICS, rruleFor, firstWeekday } from '../logic/ics.js';
import { describeSchedule, doseOn } from '../logic/schedule.js';
import { atTime, todayISO, toISODate, WEEKDAYS, parseISODate } from '../dates.js';

const DEFAULTS = { enabled: true, quietFrom: '22:00', quietTo: '07:00', checkinDay: 0, checkinTime: '09:00', alarmMin: 0,
  backupWeekly: true, water: false, waterTimes: '10:00, 14:00, 18:00' };
export async function reminderSettings() { return { ...DEFAULTS, ...((await getSetting('notify', {})) || {}) }; }

// Events for the calendar file. Titles never contain a dose: the calendar may sync to other devices.
export async function calendarEvents(cfg, { includeMeds = true, includeVitamins = true } = {}) {
  const events = [];
  const now = new Date();
  if (includeMeds) {
    for (const med of (await db.all('meds')).filter(m => m.active !== false)) {
      const s = med.schedule || {};
      const rrule = rruleFor(s);
      if (!rrule || !s.start) continue;
      let start = atTime(s.start < todayISO() ? todayISO() : s.start, s.time || '09:00');
      if (s.type === 'weekly') {
        const wd = Array.isArray(s.weekdays) && s.weekdays.length ? Number(s.weekdays[0]) : parseISODate(s.start).getDay();
        start = atTime(toISODate(firstWeekday(start, wd)), s.time || '09:00');
      } else if (s.type === 'everyN') {
        start = atTime(s.start, s.time || '09:00'); // keep the original anchor so the N-day rhythm stays right
      } else if (s.type === 'custom' && Array.isArray(s.weekdays) && s.weekdays.length) {
        const days = s.weekdays.map(Number);
        const d = new Date(start); while (!days.includes(d.getDay())) d.setDate(d.getDate() + 1);
        start = atTime(toISODate(d), s.time || '09:00');
      }
      events.push({ uid: 'med-' + med.id, title: `DoseDay: ${med.name}`, description: 'Scheduled dose. Open DoseDay to log it. Information only, not medical advice.',
        start, durationMin: 15, rrule, alarmMin: cfg.alarmMin });
    }
  }
  const ci = atTime(toISODate(firstWeekday(now, Number(cfg.checkinDay) || 0)), cfg.checkinTime || '09:00');
  events.push({ uid: 'checkin', title: 'DoseDay: weekly check-in', description: 'Weight is required. Photos and notes are optional.', start: ci, durationMin: 10, rrule: 'FREQ=WEEKLY', alarmMin: 0 });
  if (includeVitamins) {
    const byTime = new Map();
    for (const v of (await db.all('vitamins')).filter(v => v.active !== false && v.time)) byTime.set(v.time, [...(byTime.get(v.time) || []), v.name]);
    for (const [time, names] of byTime) {
      events.push({ uid: 'vit-' + time.replace(':', ''), title: 'DoseDay: vitamins', description: names.join(', '), start: atTime(todayISO(), time), durationMin: 5, rrule: 'FREQ=DAILY', alarmMin: 0 });
    }
  }
  if (cfg.water) {
    for (const t of String(cfg.waterTimes || '').split(',').map(x => x.trim()).filter(x => /^\d{1,2}:\d{2}$/.test(x))) {
      events.push({ uid: 'water-' + t.replace(':', ''), title: 'DoseDay: water', description: 'Log a drink in DoseDay.', start: atTime(todayISO(), t.padStart(5, '0')), durationMin: 5, rrule: 'FREQ=DAILY', alarmMin: 0 });
    }
  }
  if (cfg.backupWeekly) {
    events.push({ uid: 'backup', title: 'DoseDay: back up your data', description: 'Settings and backup, then Back up now.', start: atTime(toISODate(firstWeekday(now, 0)), '18:00'), durationMin: 5, rrule: 'FREQ=WEEKLY', alarmMin: 0 });
  }
  return events;
}

export async function render(root, ctx) {
  const cfg = await reminderSettings();
  const save = async patch => { Object.assign(cfg, patch); await setSetting('notify', cfg); };
  const meds = (await db.all('meds')).filter(m => m.active !== false);

  root.append(banner('info', 'How reminders work here',
    'Browser notifications can be delayed or missed when the app is closed. For anything that matters, use the calendar export below: your phone’s own calendar then reminds you even with DoseDay closed.'));

  // B: calendar (reliable)
  const daySel = select(WEEKDAYS.map((d, i) => ({ value: i, label: d })), cfg.checkinDay);
  const ciTime = input({ type: 'time', value: cfg.checkinTime });
  const alarmSel = select([{ value: 0, label: 'At the time' }, { value: 15, label: '15 minutes before' }, { value: 60, label: '1 hour before' }], cfg.alarmMin);
  const waterTimes = input({ value: cfg.waterTimes, placeholder: '10:00, 14:00, 18:00' });
  const exportCal = async () => {
    await save({ checkinDay: Number(daySel.value), checkinTime: ciTime.value || '09:00', alarmMin: Number(alarmSel.value), waterTimes: waterTimes.value });
    const events = await calendarEvents(cfg);
    const how = await saveFile('doseday-reminders.ics', buildICS(events), 'text/calendar', { share: false });
    toast(`${events.length} reminders exported. Open the file to add them to your calendar.`, 'ok', 6000);
    return how;
  };
  root.append(card('Add to my calendar (reliable)',
    meds.length ? h('div', { class: 'stack' }, meds.map(m => kv(m.name, describeSchedule(m)))) : h('p', { class: 'muted' }, 'No medicines yet. Add one first to include its schedule.'),
    h('div', { class: 'grid2' }, field('Check-in day', daySel), field('Check-in time', ciTime)),
    field('Dose reminder', alarmSel),
    checkbox('Weekly "back up your data" reminder', cfg.backupWeekly, v => save({ backupWeekly: v })),
    checkbox('Water reminders', cfg.water, v => save({ water: v })),
    field('Water reminder times', waterTimes, 'Separate times with commas, 24-hour clock.'),
    btn('Export calendar file', exportCal, 'primary block'),
    h('p', { class: 'source' }, 'Calendar entries show the medicine name only, never a dose. If you change a schedule later, delete the old DoseDay events in your calendar and export again.')));

  // A: notifications while open
  const perm = notifyPermission();
  const ncard = card('Notifications while the app is open');
  ncard.append(kv('Permission', perm === 'granted' ? 'Allowed' : perm === 'denied' ? 'Blocked in browser settings' : perm === 'unsupported' ? 'Not supported here' : 'Not asked yet'));
  if (notifySupported() && perm !== 'granted') {
    ncard.append(btn('Allow notifications', async () => { const r = await requestNotify(); toast(r === 'granted' ? 'Notifications allowed' : 'Not allowed', r === 'granted' ? 'ok' : 'warn'); ctx.refresh(); }, 'primary'));
  }
  const qFrom = input({ type: 'time', value: cfg.quietFrom }), qTo = input({ type: 'time', value: cfg.quietTo });
  qFrom.addEventListener('change', () => save({ quietFrom: qFrom.value })); qTo.addEventListener('change', () => save({ quietTo: qTo.value }));
  ncard.append(checkbox('Show dose and check-in reminders in the app', cfg.enabled, v => save({ enabled: v })),
    h('div', { class: 'grid2' }, field('Quiet from', qFrom), field('Quiet until', qTo)),
    btn('Send a test notification', async () => {
      const ok = await notify('DoseDay test', 'Notifications are working while the app is open.', 'test');
      toast(ok ? 'Test sent' : 'Could not send. Check that notifications are allowed.', ok ? 'ok' : 'warn');
    }));
  root.append(ncard);
  root.append(infoLine());
}
