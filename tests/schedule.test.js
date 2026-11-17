process.env.TZ = 'America/Vancouver'; // must run before any Date is created

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isDueOn, dueTimes, doseOn, missedCutoff, timeline, nextDue, tooSoon, adherence, streak,
  nextSite, describeSchedule, DEFAULT_SITES, lastTaken, hoursSinceLast,
} from '../www/js/logic/schedule.js';
import { atTime } from '../www/js/dates.js';

// Calendar facts used below (2026): Jan 5 is a Monday, Mar 8 is a Sunday (spring forward),
// Nov 1 is a Sunday (fall back).
const med = (schedule, extra = {}) => ({ id: 'm1', dose: 0.25, doseUnit: 'mg', schedule, ...extra });
const iso = (date, time) => atTime(date, time).toISOString();

describe('time zone is forced for these tests', () => {
  it('process TZ is America/Vancouver', () => {
    assert.equal(new Date(2026, 6, 1, 12).getTimezoneOffset(), 420); // PDT
    assert.equal(new Date(2026, 0, 1, 12).getTimezoneOffset(), 480); // PST
  });
});

describe('isDueOn', () => {
  it('daily: due every day from the start, not before', () => {
    const m = med({ type: 'daily', start: '2026-01-05' });
    assert.equal(isDueOn(m, '2026-01-04'), false);
    assert.equal(isDueOn(m, '2026-01-05'), true);
    assert.equal(isDueOn(m, '2026-01-06'), true);
    assert.equal(isDueOn(m, '2026-12-31'), true);
  });
  it('everyN with N=3 anchors on the start date', () => {
    const m = med({ type: 'everyN', everyN: 3, start: '2026-01-05' });
    const due = ['2026-01-05', '2026-01-08', '2026-01-11', '2026-01-14'];
    for (const d of due) assert.equal(isDueOn(m, d), true, d);
    for (const d of ['2026-01-06', '2026-01-07', '2026-01-09', '2026-01-10', '2026-01-12']) assert.equal(isDueOn(m, d), false, d);
  });
  it('everyN is anchored on start across a month end', () => {
    const m = med({ type: 'everyN', everyN: 3, start: '2026-01-30' });
    assert.equal(isDueOn(m, '2026-02-02'), true);
    assert.equal(isDueOn(m, '2026-02-01'), false);
  });
  it('weekly uses the weekday in weekdays[0]', () => {
    const m = med({ type: 'weekly', weekdays: [3], start: '2026-01-05' }); // Wednesday
    assert.equal(isDueOn(m, '2026-01-05'), false);
    assert.equal(isDueOn(m, '2026-01-07'), true);
    assert.equal(isDueOn(m, '2026-01-14'), true);
    assert.equal(isDueOn(m, '2026-01-13'), false);
  });
  it('weekly with no weekdays uses the weekday of the start date', () => {
    const m = med({ type: 'weekly', weekdays: [], start: '2026-01-05' }); // Monday
    assert.equal(isDueOn(m, '2026-01-05'), true);
    assert.equal(isDueOn(m, '2026-01-12'), true);
    assert.equal(isDueOn(m, '2026-01-13'), false);
    assert.equal(isDueOn(med({ type: 'weekly', start: '2026-01-05' }), '2026-01-19'), true);
  });
  it('custom days: Mon, Wed, Fri', () => {
    const m = med({ type: 'custom', weekdays: [1, 3, 5], start: '2026-01-05' });
    const want = { '2026-01-05': true, '2026-01-06': false, '2026-01-07': true, '2026-01-08': false, '2026-01-09': true, '2026-01-10': false, '2026-01-11': false, '2026-01-12': true };
    for (const [d, v] of Object.entries(want)) assert.equal(isDueOn(m, d), v, d);
  });
  it('custom with no days is never due', () => {
    assert.equal(isDueOn(med({ type: 'custom', weekdays: [], start: '2026-01-05' }), '2026-01-07'), false);
  });
  it('asNeeded is never due', () => {
    const m = med({ type: 'asNeeded', start: '2026-01-05' });
    assert.equal(isDueOn(m, '2026-01-05'), false);
    assert.equal(isDueOn(m, '2026-01-06'), false);
  });
  it('is not due after the end date (inclusive)', () => {
    const m = med({ type: 'daily', start: '2026-01-05', end: '2026-01-10' });
    assert.equal(isDueOn(m, '2026-01-10'), true);
    assert.equal(isDueOn(m, '2026-01-11'), false);
  });
  it('is false with no schedule or no start', () => {
    assert.equal(isDueOn({}, '2026-01-05'), false);
    assert.equal(isDueOn(med({ type: 'daily' }), '2026-01-05'), false);
    assert.equal(isDueOn(null, '2026-01-05'), false);
  });
});

describe('dueTimes', () => {
  it('weekly Monday at 08:30 across January', () => {
    const m = med({ type: 'weekly', weekdays: [1], start: '2026-01-05', time: '08:30' });
    const t = dueTimes(m, '2026-01-01', '2026-01-31');
    assert.deepEqual(t.map(d => d.getDate()), [5, 12, 19, 26]);
    assert.ok(t.every(d => d.getHours() === 8 && d.getMinutes() === 30 && d.getMonth() === 0));
  });
  it('defaults to 09:00 when there is no time', () => {
    const t = dueTimes(med({ type: 'daily', start: '2026-01-05' }), '2026-01-05', '2026-01-05');
    assert.equal(t.length, 1);
    assert.equal(t[0].getHours(), 9);
  });
  it('starts at the schedule start when fromDate is earlier, and stops at toDate and end', () => {
    const m = med({ type: 'daily', start: '2026-01-05', end: '2026-01-07' });
    assert.equal(dueTimes(m, '2025-12-01', '2026-02-01').length, 3);
    assert.equal(dueTimes(m, '2026-01-06', '2026-01-06').length, 1);
  });
  it('everyN 3 gives every third day', () => {
    const t = dueTimes(med({ type: 'everyN', everyN: 3, start: '2026-01-05' }), '2026-01-05', '2026-01-14');
    assert.deepEqual(t.map(d => d.getDate()), [5, 8, 11, 14]);
  });
  it('asNeeded gives nothing', () => {
    assert.deepEqual(dueTimes(med({ type: 'asNeeded', start: '2026-01-05' }), '2026-01-01', '2026-02-01'), []);
  });
});

describe('daylight saving (America/Vancouver)', () => {
  it('weekly 09:00 stays at 09:00 local across the 2026-03-08 spring-forward', () => {
    const m = med({ type: 'weekly', weekdays: [0], start: '2026-02-22', time: '09:00' });
    const t = dueTimes(m, '2026-02-22', '2026-03-22');
    assert.deepEqual(t.map(d => `${d.getMonth() + 1}/${d.getDate()}`), ['2/22', '3/1', '3/8', '3/15', '3/22']);
    for (const d of t) { assert.equal(d.getHours(), 9); assert.equal(d.getMinutes(), 0); assert.equal(d.getDay(), 0); }
    // the week that loses an hour is 167 hours long, the others 168
    const hrs = (a, b) => (b - a) / 3600000;
    assert.equal(hrs(t[1], t[2]), 167);
    assert.equal(hrs(t[0], t[1]), 168);
    assert.equal(hrs(t[2], t[3]), 168);
  });
  it('weekly 09:00 stays at 09:00 local across 2026-11-01 (America/Vancouver)', () => {
    // NOTE: recent tzdata releases (as in this Node build) make BC stay on UTC-7 after 2026-11-01, so
    // Vancouver may have no fall-back here. The 09:00-local rule must hold either way.
    const m = med({ type: 'weekly', weekdays: [0], start: '2026-10-25', time: '09:00' });
    const t = dueTimes(m, '2026-10-25', '2026-11-15');
    assert.deepEqual(t.map(d => `${d.getMonth() + 1}/${d.getDate()}`), ['10/25', '11/1', '11/8', '11/15']);
    for (const d of t) { assert.equal(d.getHours(), 9); assert.equal(d.getMinutes(), 0); }
  });
  it('weekly 09:00 stays at 09:00 local across a real fall-back (2026-11-01, US Pacific rules)', () => {
    const saved = process.env.TZ;
    process.env.TZ = 'America/Los_Angeles'; // same rules as Vancouver historically; still has the Nov 1 change
    try {
      const m = med({ type: 'weekly', weekdays: [0], start: '2026-10-25', time: '09:00' });
      const t = dueTimes(m, '2026-10-25', '2026-11-15');
      assert.deepEqual(t.map(d => `${d.getMonth() + 1}/${d.getDate()}`), ['10/25', '11/1', '11/8', '11/15']);
      for (const d of t) { assert.equal(d.getHours(), 9); assert.equal(d.getMinutes(), 0); }
      const hrs = (x, y) => (y - x) / 3600000;
      assert.equal(hrs(t[0], t[1]), 169); // Oct 25 (PDT) to Nov 1 (PST): the week that gains an hour
      assert.equal(hrs(t[1], t[2]), 168);
    } finally {
      process.env.TZ = saved;
    }
  });
  it('daily schedule keeps the same local time on the spring-forward day', () => {
    const t = dueTimes(med({ type: 'daily', start: '2026-03-06', time: '07:15' }), '2026-03-06', '2026-03-10');
    assert.equal(t.length, 5);
    assert.ok(t.every(d => d.getHours() === 7 && d.getMinutes() === 15));
  });
  it('everyN anchoring is not thrown off by DST', () => {
    const m = med({ type: 'everyN', everyN: 2, start: '2026-03-01' });
    assert.equal(isDueOn(m, '2026-03-09'), true);
    assert.equal(isDueOn(m, '2026-03-08'), false);
    const f = med({ type: 'everyN', everyN: 2, start: '2026-10-30' });
    assert.equal(isDueOn(f, '2026-11-01'), true);
    assert.equal(isDueOn(f, '2026-11-02'), false);
  });
  it('timeline slots across DST are still at 09:00', () => {
    const m = med({ type: 'weekly', weekdays: [0], start: '2026-02-22', time: '09:00' });
    const slots = timeline(m, [], atTime('2026-03-10', '12:00'), { daysBack: 20, daysAhead: 10 });
    assert.ok(slots.length >= 4);
    assert.ok(slots.every(s => s.scheduledAt.getHours() === 9));
  });
});

describe('doseOn', () => {
  const m = {
    dose: 0.25, doseUnit: 'mg',
    titration: [{ from: '2026-03-01', dose: 1 }, { from: '2026-02-01', dose: 0.5 }, { from: '2026-04-01', dose: '' }],
  };
  it('uses the default dose before any step', () => {
    assert.deepEqual(doseOn(m, '2026-01-31'), { amount: 0.25, unit: 'mg' });
  });
  it('picks the latest step on or before the date (steps given out of order)', () => {
    assert.equal(doseOn(m, '2026-02-01').amount, 0.5);
    assert.equal(doseOn(m, '2026-02-28').amount, 0.5);
    assert.equal(doseOn(m, '2026-03-01').amount, 1);
    assert.equal(doseOn(m, '2026-12-01').amount, 1); // blank step ignored
  });
  it('without titration returns the default; with no dose returns null', () => {
    assert.equal(doseOn({ dose: 2 }, '2026-01-01').amount, 2);
    assert.deepEqual(doseOn({}, '2026-01-01'), { amount: null, unit: '' });
  });
});

describe('missedCutoff', () => {
  const at = atTime('2026-01-05', '09:00');
  const next = atTime('2026-01-12', '09:00');
  const H = 3600000;
  it('windowHours only: scheduled time plus the window', () => {
    const c = missedCutoff({ missed: { windowHours: 12 } }, at, next);
    assert.equal(c.getTime(), at.getTime() + 12 * H);
  });
  it('minHoursBeforeNextDose only: next dose minus the hours', () => {
    const c = missedCutoff({ missed: { minHoursBeforeNextDose: 48 } }, at, next);
    assert.equal(c.getTime(), next.getTime() - 48 * H);
  });
  it('both set: the earlier limit wins', () => {
    const early = missedCutoff({ missed: { windowHours: 12, minHoursBeforeNextDose: 48 } }, at, next);
    assert.equal(early.getTime(), at.getTime() + 12 * H); // window is earlier
    const late = missedCutoff({ missed: { windowHours: 200, minHoursBeforeNextDose: 48 } }, at, next);
    assert.equal(late.getTime(), next.getTime() - 48 * H); // next-dose limit is earlier
  });
  it('neither set: stays open until the next scheduled dose', () => {
    assert.equal(missedCutoff({}, at, next).getTime(), next.getTime());
    assert.equal(missedCutoff({ missed: {} }, at, next).getTime(), next.getTime());
  });
  it('neither set and no next dose: open for 24 hours', () => {
    assert.equal(missedCutoff({}, at, null).getTime(), at.getTime() + 24 * H);
  });
  it('windowHours with no next dose uses just the window', () => {
    assert.equal(missedCutoff({ missed: { windowHours: 6 } }, at, null).getTime(), at.getTime() + 6 * H);
  });
  it('never earlier than the scheduled time', () => {
    const c = missedCutoff({ missed: { minHoursBeforeNextDose: 500 } }, at, next);
    assert.equal(c.getTime(), at.getTime());
  });
});

describe('timeline statuses (weekly Monday 09:00, window 12 h)', () => {
  const m = med({ type: 'weekly', weekdays: [1], start: '2025-12-29', time: '09:00' }, { missed: { windowHours: 12 } });
  const rec = (date, status) => ({ scheduledAt: iso(date, '09:00'), takenAt: iso(date, '09:20'), status });
  const doses = [rec('2025-12-29', 'skipped'), rec('2026-01-12', 'taken'), rec('2026-01-19', 'late')];
  const status = (slots, date) => slots.find(s => s.scheduledAt.getTime() === atTime(date, '09:00').getTime())?.status;

  it('taken, late, skipped, missed, due, upcoming on a Monday morning before the dose', () => {
    const slots = timeline(m, doses, atTime('2026-01-26', '07:00'));
    assert.equal(status(slots, '2025-12-29'), 'skipped');
    assert.equal(status(slots, '2026-01-05'), 'missed'); // past cutoff, no record
    assert.equal(status(slots, '2026-01-12'), 'taken');
    assert.equal(status(slots, '2026-01-19'), 'late');
    assert.equal(status(slots, '2026-01-26'), 'due'); // later today
    assert.equal(status(slots, '2026-02-02'), 'upcoming');
  });
  it('overdue: past the time, before the cutoff, no record', () => {
    const slots = timeline(m, doses, atTime('2026-01-26', '10:00'));
    assert.equal(status(slots, '2026-01-26'), 'overdue');
  });
  it('turns missed once the cutoff passes', () => {
    assert.equal(status(timeline(m, doses, atTime('2026-01-26', '20:59')), '2026-01-26'), 'overdue');
    assert.equal(status(timeline(m, doses, atTime('2026-01-26', '21:00')), '2026-01-26'), 'missed');
  });
  it('slots are sorted by time and carry dose, cutoff and record', () => {
    const slots = timeline(m, doses, atTime('2026-01-26', '07:00'));
    for (let i = 1; i < slots.length; i++) assert.ok(slots[i].scheduledAt > slots[i - 1].scheduledAt);
    const taken = slots.find(s => s.status === 'taken');
    assert.equal(taken.record.status, 'taken');
    assert.deepEqual(taken.dose, { amount: 0.25, unit: 'mg' });
    assert.equal(taken.cutoff.getTime(), taken.scheduledAt.getTime() + 12 * 3600000);
  });
  it('records match by scheduledAt ISO string only', () => {
    const wrong = [{ scheduledAt: iso('2026-01-12', '09:01'), takenAt: iso('2026-01-12', '09:01'), status: 'taken' },
      { scheduledAt: null, takenAt: iso('2026-01-12', '09:00'), status: 'taken' }];
    const slots = timeline(m, wrong, atTime('2026-01-26', '07:00'));
    assert.equal(status(slots, '2026-01-12'), 'missed');
  });
  it('with no missed rules a dose stays overdue until the next scheduled dose', () => {
    const plain = med({ type: 'weekly', weekdays: [1], start: '2026-01-05', time: '09:00' });
    const slots = timeline(plain, [], atTime('2026-01-11', '23:00'));
    assert.equal(status(slots, '2026-01-05'), 'overdue');
    assert.equal(status(timeline(plain, [], atTime('2026-01-12', '09:00')), '2026-01-05'), 'missed');
  });
  it('asNeeded has no slots', () => {
    assert.deepEqual(timeline(med({ type: 'asNeeded', start: '2026-01-05' }), [], atTime('2026-01-26', '07:00')), []);
  });
});

describe('nextDue', () => {
  const m = med({ type: 'weekly', weekdays: [1], start: '2025-12-29', time: '09:00' }, { missed: { windowHours: 12 } });
  it('returns the overdue slot before any upcoming one', () => {
    const n = nextDue(m, [], atTime('2026-01-26', '10:00'));
    assert.equal(n.status, 'overdue');
    assert.equal(n.scheduledAt.getTime(), atTime('2026-01-26', '09:00').getTime());
  });
  it('returns the due slot later today', () => {
    const n = nextDue(m, [], atTime('2026-01-26', '07:00'));
    assert.equal(n.status, 'due');
    assert.equal(n.scheduledAt.getTime(), atTime('2026-01-26', '09:00').getTime());
  });
  it('skips closed slots and returns the next upcoming one', () => {
    const n = nextDue(m, [], atTime('2026-01-26', '22:00')); // Jan 26 is now missed
    assert.equal(n.status, 'upcoming');
    assert.equal(n.scheduledAt.getTime(), atTime('2026-02-02', '09:00').getTime());
  });
  it('is null for an as-needed med', () => {
    assert.equal(nextDue(med({ type: 'asNeeded', start: '2026-01-05' }), []), null);
  });
});

describe('lastTaken, hoursSinceLast, tooSoon', () => {
  const doses = [
    { takenAt: '2026-01-20T17:00:00.000Z', status: 'taken' },
    { takenAt: '2026-01-26T17:00:00.000Z', status: 'late' },
    { takenAt: '2026-01-27T17:00:00.000Z', status: 'skipped' },
  ];
  const now = new Date('2026-01-26T21:00:00.000Z');
  it('lastTaken ignores skipped records', () => {
    assert.equal(lastTaken(doses).takenAt, '2026-01-26T17:00:00.000Z');
    assert.equal(lastTaken([]), null);
  });
  it('hoursSinceLast', () => {
    assert.equal(hoursSinceLast(doses, now), 4);
    assert.equal(hoursSinceLast([], now), null);
  });
  it('tooSoon reports when under minHoursBetweenDoses', () => {
    assert.deepEqual(tooSoon({ missed: { minHoursBetweenDoses: 48 } }, doses, now), { minHours: 48, hoursSince: 4 });
  });
  it('tooSoon is null when enough time has passed, no rule, or no history', () => {
    assert.equal(tooSoon({ missed: { minHoursBetweenDoses: 48 } }, doses, new Date('2026-01-28T17:00:00.000Z')), null); // exactly 48 h
    assert.equal(tooSoon({ missed: {} }, doses, now), null);
    assert.equal(tooSoon({}, doses, now), null);
    assert.equal(tooSoon({ missed: { minHoursBetweenDoses: 48 } }, [], now), null);
  });
});

describe('adherence and streak', () => {
  const m = med({ type: 'weekly', weekdays: [1], start: '2025-12-29', time: '09:00' }, { missed: { windowHours: 12 } });
  const rec = (date, status) => ({ scheduledAt: iso(date, '09:00'), takenAt: iso(date, '09:20'), status });
  const doses = [rec('2025-12-29', 'skipped'), rec('2026-01-12', 'taken'), rec('2026-01-19', 'late')];
  const now = atTime('2026-01-26', '10:00'); // Jan 26 slot is overdue (still open), so it does not count
  it('adherence counts taken+late over closed slots (skipped and missed count against)', () => {
    // 30 days back from Jan 26 is Dec 27: Dec 29 skipped, Jan 5 missed, Jan 12 taken, Jan 19 late
    assert.deepEqual(adherence(m, doses, now), { taken: 2, expected: 4, pct: 50 });
  });
  it('adherence is null pct with no closed slots', () => {
    assert.deepEqual(adherence(m, [], atTime('2025-12-29', '07:00')), { taken: 0, expected: 0, pct: null });
  });
  it('adherence rounds the percentage', () => {
    const daily = med({ type: 'daily', start: '2026-01-01', time: '09:00' });
    const d3 = ['2026-01-01', '2026-01-02'].map(d => rec(d, 'taken'));
    // no window set: the Jan 3 slot closes (missed) when the Jan 4 slot arrives, so Jan 1..3 are closed at Jan 4 10:00
    const a = adherence(daily, d3, atTime('2026-01-04', '10:00'));
    assert.equal(a.expected, 3);
    assert.equal(a.taken, 2);
    assert.equal(a.pct, 67);
  });
  it('streak counts the most recent consecutive taken/late slots', () => {
    assert.equal(streak(m, doses, now), 2); // Jan 19 late, Jan 12 taken, then Jan 5 missed
  });
  it('streak is 0 when the latest closed slot was missed or skipped', () => {
    assert.equal(streak(m, [rec('2026-01-12', 'taken'), rec('2026-01-19', 'skipped')], now), 0);
    assert.equal(streak(m, [], now), 0);
  });
  it('streak counts every slot when all were taken', () => {
    const all = ['2025-12-29', '2026-01-05', '2026-01-12', '2026-01-19'].map(d => rec(d, 'taken'));
    assert.equal(streak(m, all, now), 4);
  });
});

describe('nextSite', () => {
  const dose = (siteId, takenAt, status = 'taken') => ({ siteId, takenAt, status });
  it('returns the first site in the list when nothing was ever used', () => {
    assert.equal(nextSite(DEFAULT_SITES, []).id, 'abd-l');
    assert.equal(nextSite(undefined, undefined).id, 'abd-l');
  });
  it('returns a never-used site before any used one, in list order', () => {
    const used = [dose('abd-l', '2026-01-01T10:00:00Z'), dose('abd-r', '2026-01-08T10:00:00Z')];
    assert.equal(nextSite(DEFAULT_SITES, used).id, 'thigh-l');
  });
  it('when all are used, returns the least recently used', () => {
    const used = [
      dose('abd-l', '2026-01-06T10:00:00Z'), dose('abd-r', '2026-01-02T10:00:00Z'), dose('thigh-l', '2026-01-03T10:00:00Z'),
      dose('thigh-r', '2026-01-01T10:00:00Z'), dose('arm-l', '2026-01-04T10:00:00Z'), dose('arm-r', '2026-01-05T10:00:00Z'),
    ];
    assert.equal(nextSite(DEFAULT_SITES, used).id, 'thigh-r');
  });
  it('uses the most recent use of each site, and ignores skipped records and records without a site', () => {
    const used = [
      dose('abd-l', '2026-01-01T10:00:00Z'), dose('abd-l', '2026-02-01T10:00:00Z'),
      dose('abd-r', '2026-01-10T10:00:00Z'), dose('thigh-l', '2026-01-11T10:00:00Z'),
      dose('thigh-r', '2026-01-12T10:00:00Z'), dose('arm-l', '2026-01-13T10:00:00Z'), dose('arm-r', '2026-01-14T10:00:00Z'),
      dose('abd-r', '2026-03-01T10:00:00Z', 'skipped'), { takenAt: '2026-03-02T10:00:00Z', status: 'taken' },
    ];
    assert.equal(nextSite(DEFAULT_SITES, used).id, 'abd-r'); // abd-l was reused on Feb 1; abd-r last really used Jan 10
  });
  it('works with a custom site list', () => {
    const sites = [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }];
    assert.equal(nextSite(sites, [dose('a', '2026-01-01T10:00:00Z')]).id, 'b');
  });
});

describe('describeSchedule', () => {
  it('daily and everyN', () => {
    assert.equal(describeSchedule(med({ type: 'daily', time: '09:00' })), 'Every day at 09:00');
    assert.equal(describeSchedule(med({ type: 'everyN', everyN: 3, time: '08:00' })), 'Every 3 days at 08:00');
    assert.equal(describeSchedule(med({ type: 'daily' })), 'Every day');
  });
  it('weekly from weekdays[0] or from the start date', () => {
    assert.equal(describeSchedule(med({ type: 'weekly', weekdays: [1], time: '09:00' })), 'Weekly on Monday at 09:00');
    assert.equal(describeSchedule(med({ type: 'weekly', weekdays: [], start: '2026-01-07', time: '20:00' })), 'Weekly on Wednesday at 20:00');
  });
  it('custom days in week order', () => {
    assert.equal(describeSchedule(med({ type: 'custom', weekdays: [5, 1, 3], time: '09:00' })), 'Mon, Wed, Fri at 09:00');
    assert.equal(describeSchedule(med({ type: 'custom', weekdays: [] })), 'No days chosen');
  });
  it('as needed and no schedule', () => {
    assert.equal(describeSchedule(med({ type: 'asNeeded' })), 'As needed');
    assert.equal(describeSchedule({}), 'No schedule');
  });
});
