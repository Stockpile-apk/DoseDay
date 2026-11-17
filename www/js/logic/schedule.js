// Dose schedules, missed-dose rules, adherence and site rotation. Pure functions: no DOM, no storage.
// The app never decides a dose. Everything here works on numbers the user typed.
import { addDays, atTime, daysBetween, parseISODate, toISODate } from '../dates.js';

// med.schedule = {type:'daily'|'everyN'|'weekly'|'custom'|'asNeeded', everyN, weekdays:[0-6], time:'HH:MM', start:'YYYY-MM-DD', end}
// med.missed   = {windowHours, minHoursBeforeNextDose, minHoursBetweenDoses}  (all optional, user-entered)
// med.titration = [{from:'YYYY-MM-DD', dose}]  dose applies from that date on

export const SCHEDULE_TYPES = [
  { value: 'weekly', label: 'Weekly (pick the day)' },
  { value: 'daily', label: 'Every day' },
  { value: 'everyN', label: 'Every N days' },
  { value: 'custom', label: 'Chosen days of the week' },
  { value: 'asNeeded', label: 'As needed (no schedule)' },
];

export function isDueOn(med, dateStr) {
  const s = med && med.schedule;
  if (!s || !s.start || s.type === 'asNeeded') return false;
  if (dateStr < s.start) return false;
  if (s.end && dateStr > s.end) return false;
  const wd = parseISODate(dateStr).getDay();
  switch (s.type) {
    case 'daily': return true;
    case 'everyN': { const n = Math.max(1, Math.round(Number(s.everyN) || 1)); return daysBetween(s.start, dateStr) % n === 0; }
    case 'weekly': {
      const days = Array.isArray(s.weekdays) && s.weekdays.length ? s.weekdays : [parseISODate(s.start).getDay()];
      return wd === Number(days[0]);
    }
    case 'custom': return Array.isArray(s.weekdays) && s.weekdays.map(Number).includes(wd);
    default: return false;
  }
}

// Scheduled date-times (local) with fromDate <= date <= toDate.
export function dueTimes(med, fromDate, toDate) {
  const out = [];
  if (!med || !med.schedule || !med.schedule.start) return out;
  let d = fromDate < med.schedule.start ? med.schedule.start : fromDate;
  let guard = 0;
  while (d <= toDate && guard++ < 4000) {
    if (isDueOn(med, d)) out.push(atTime(d, med.schedule.time || '09:00'));
    d = addDays(d, 1);
  }
  return out;
}

// Dose in effect on a date: the latest titration step on or before it, else the med's default dose.
export function doseOn(med, dateStr) {
  let amount = med.dose ?? null;
  const steps = (med.titration || []).filter(s => s && s.from && s.dose !== '' && s.dose !== null && s.dose !== undefined)
    .sort((a, b) => (a.from < b.from ? -1 : 1));
  for (const s of steps) if (s.from <= dateStr) amount = s.dose;
  return { amount, unit: med.doseUnit || '' };
}

// After this moment an unlogged dose counts as missed. Uses whichever missed-dose fields are set:
//   windowHours: may still be given within N hours of the scheduled time
//   minHoursBeforeNextDose: skipped once the next dose is under N hours away
// With neither set, a dose stays open until the next scheduled dose.
export function missedCutoff(med, scheduledAt, nextScheduledAt) {
  const m = med.missed || {};
  const limits = [];
  if (Number(m.windowHours) > 0) limits.push(scheduledAt.getTime() + Number(m.windowHours) * 3600000);
  if (nextScheduledAt) {
    const before = Number(m.minHoursBeforeNextDose) > 0 ? Number(m.minHoursBeforeNextDose) : 0;
    limits.push(nextScheduledAt.getTime() - before * 3600000);
  }
  if (!limits.length) limits.push(scheduledAt.getTime() + 24 * 3600000);
  return new Date(Math.max(scheduledAt.getTime(), Math.min(...limits)));
}

const key = d => new Date(d).toISOString();

// timeline(med, doses, now, {daysBack, daysAhead}) -> slots sorted by time:
//   {scheduledAt:Date, status, record|null, dose:{amount,unit}, cutoff:Date}
// status: taken | late | skipped | missed | overdue (can still be logged) | due (today, not yet time) | upcoming
// `doses` are this med's log records: {scheduledAt ISO|null, takenAt ISO, status:'taken'|'late'|'skipped'}
export function timeline(med, doses, now = new Date(), { daysBack = 35, daysAhead = 14 } = {}) {
  const today = toISODate(now);
  const from = addDays(today, -daysBack), to = addDays(today, daysAhead);
  const times = dueTimes(med, from, addDays(to, 40)); // look past the window so the last slot has a "next"
  const bySlot = new Map();
  for (const r of doses || []) if (r.scheduledAt) bySlot.set(key(r.scheduledAt), r);
  const out = [];
  for (let i = 0; i < times.length; i++) {
    const at = times[i];
    if (toISODate(at) > to) break;
    const next = times[i + 1] || null;
    const cutoff = missedCutoff(med, at, next);
    const record = bySlot.get(key(at)) || null;
    let status;
    if (record) status = record.status === 'skipped' ? 'skipped' : record.status === 'late' ? 'late' : 'taken';
    else if (now >= cutoff) status = 'missed';
    else if (now >= at) status = 'overdue';
    else status = toISODate(at) === today ? 'due' : 'upcoming';
    out.push({ scheduledAt: at, status, record, dose: doseOn(med, toISODate(at)), cutoff });
  }
  return out;
}

// The slot the user should see next: the oldest overdue one, else the next due/upcoming one.
export function nextDue(med, doses, now = new Date()) {
  const slots = timeline(med, doses, now);
  return slots.find(s => s.status === 'overdue') || slots.find(s => s.status === 'due' || s.status === 'upcoming') || null;
}

export function lastTaken(doses) {
  const taken = (doses || []).filter(r => r.status !== 'skipped' && r.takenAt).sort((a, b) => (a.takenAt < b.takenAt ? 1 : -1));
  return taken[0] || null;
}
export function hoursSinceLast(doses, now = new Date()) {
  const last = lastTaken(doses);
  return last ? (now.getTime() - new Date(last.takenAt).getTime()) / 3600000 : null;
}
// Information for the log screen: is this sooner than the user's own "minimum hours between doses"?
export function tooSoon(med, doses, now = new Date()) {
  const min = Number(med.missed && med.missed.minHoursBetweenDoses);
  const since = hoursSinceLast(doses, now);
  if (!(min > 0) || since === null) return null;
  return since < min ? { minHours: min, hoursSince: since } : null;
}

// Adherence over the last `days` days: taken (incl. late) out of slots that are no longer open.
export function adherence(med, doses, now = new Date(), days = 30) {
  const slots = timeline(med, doses, now, { daysBack: days, daysAhead: 0 })
    .filter(s => ['taken', 'late', 'skipped', 'missed'].includes(s.status));
  const taken = slots.filter(s => s.status === 'taken' || s.status === 'late').length;
  return { taken, expected: slots.length, pct: slots.length ? Math.round((taken / slots.length) * 100) : null };
}

// Consecutive most-recent closed slots that were taken.
export function streak(med, doses, now = new Date()) {
  const slots = timeline(med, doses, now, { daysBack: 365, daysAhead: 0 })
    .filter(s => ['taken', 'late', 'skipped', 'missed'].includes(s.status)).reverse();
  let n = 0;
  for (const s of slots) { if (s.status === 'taken' || s.status === 'late') n++; else break; }
  return n;
}

export const DEFAULT_SITES = [
  { id: 'abd-l', label: 'Abdomen, left' }, { id: 'abd-r', label: 'Abdomen, right' },
  { id: 'thigh-l', label: 'Thigh, left' }, { id: 'thigh-r', label: 'Thigh, right' },
  { id: 'arm-l', label: 'Upper arm, left' }, { id: 'arm-r', label: 'Upper arm, right' },
];
// Next site in the rotation: the one used longest ago (never-used first, in list order).
export function nextSite(sites, allDoses) {
  const list = sites && sites.length ? sites : DEFAULT_SITES;
  const last = new Map();
  for (const r of allDoses || []) {
    if (!r.siteId || !r.takenAt || r.status === 'skipped') continue;
    if (!last.has(r.siteId) || last.get(r.siteId) < r.takenAt) last.set(r.siteId, r.takenAt);
  }
  let best = list[0], bestT = last.get(list[0].id) || '';
  for (const s of list) {
    const t = last.get(s.id) || '';
    if (t < bestT) { best = s; bestT = t; }
  }
  return best;
}

export function describeSchedule(med) {
  const s = med.schedule || {};
  const WD = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const t = s.time ? ` at ${s.time}` : '';
  switch (s.type) {
    case 'daily': return `Every day${t}`;
    case 'everyN': return `Every ${Math.max(1, Math.round(Number(s.everyN) || 1))} days${t}`;
    case 'weekly': {
      const d = Array.isArray(s.weekdays) && s.weekdays.length ? Number(s.weekdays[0]) : (s.start ? parseISODate(s.start).getDay() : 0);
      return `Weekly on ${WD[d]}${t}`;
    }
    case 'custom': return `${(s.weekdays || []).map(Number).sort().map(d => WD[d].slice(0, 3)).join(', ') || 'No days chosen'}${t}`;
    case 'asNeeded': return 'As needed';
    default: return 'No schedule';
  }
}
