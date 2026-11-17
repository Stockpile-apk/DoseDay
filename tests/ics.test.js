process.env.TZ = 'America/Vancouver'; // must run before any Date is created

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { rruleFor, buildICS, firstWeekday } from '../www/js/logic/ics.js';

const NOW = new Date(Date.UTC(2026, 0, 1, 12, 30, 45));
const unfold = text => text.replace(/\r\n /g, '');
const lines = text => text.split('\r\n');

describe('rruleFor', () => {
  it('daily', () => assert.equal(rruleFor({ type: 'daily' }), 'FREQ=DAILY'));
  it('everyN uses INTERVAL', () => {
    assert.equal(rruleFor({ type: 'everyN', everyN: 3 }), 'FREQ=DAILY;INTERVAL=3');
    assert.equal(rruleFor({ type: 'everyN', everyN: '5' }), 'FREQ=DAILY;INTERVAL=5');
    assert.equal(rruleFor({ type: 'everyN' }), 'FREQ=DAILY;INTERVAL=1');
  });
  it('weekly uses the BYDAY code of weekdays[0]', () => {
    const codes = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
    codes.forEach((c, d) => assert.equal(rruleFor({ type: 'weekly', weekdays: [d] }), `FREQ=WEEKLY;BYDAY=${c}`));
  });
  it('weekly with no weekdays has no BYDAY (follows DTSTART)', () => {
    assert.equal(rruleFor({ type: 'weekly', weekdays: [] }), 'FREQ=WEEKLY');
  });
  it('custom lists BYDAY codes in week order', () => {
    assert.equal(rruleFor({ type: 'custom', weekdays: [5, 1, 3] }), 'FREQ=WEEKLY;BYDAY=MO,WE,FR');
    assert.equal(rruleFor({ type: 'custom', weekdays: [0, 6] }), 'FREQ=WEEKLY;BYDAY=SU,SA');
  });
  it('custom with no days is null', () => assert.equal(rruleFor({ type: 'custom', weekdays: [] }), null));
  it('adds UNTIL from the end date', () => {
    assert.equal(rruleFor({ type: 'daily', end: '2026-06-30' }), 'FREQ=DAILY;UNTIL=20260630T235900');
    assert.equal(rruleFor({ type: 'weekly', weekdays: [1], end: '2026-06-30' }), 'FREQ=WEEKLY;BYDAY=MO;UNTIL=20260630T235900');
    assert.equal(rruleFor({ type: 'everyN', everyN: 2, end: '2027-01-02' }), 'FREQ=DAILY;INTERVAL=2;UNTIL=20270102T235900');
    assert.equal(rruleFor({ type: 'custom', weekdays: [2], end: '2026-12-31' }), 'FREQ=WEEKLY;BYDAY=TU;UNTIL=20261231T235900');
  });
  it('is null for asNeeded, unknown and missing schedules', () => {
    assert.equal(rruleFor({ type: 'asNeeded' }), null);
    assert.equal(rruleFor({ type: 'asNeeded', end: '2026-06-30' }), null);
    assert.equal(rruleFor({ type: 'whatever' }), null);
    assert.equal(rruleFor(undefined), null);
  });
});

describe('buildICS structure', () => {
  const events = [
    { uid: 'med1-weekly', title: 'Take dose', description: 'Weekly dose', start: new Date(2026, 0, 5, 9, 0), durationMin: 15, rrule: 'FREQ=WEEKLY;BYDAY=MO', alarmMin: 10 },
    { uid: 'med2-daily', title: 'Vitamin D', start: new Date(2026, 0, 5, 20, 30), rrule: 'FREQ=DAILY', alarmMin: 0 },
  ];
  const ics = buildICS(events, NOW);

  it('starts with BEGIN:VCALENDAR and ends with END:VCALENDAR plus a final CRLF', () => {
    assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n'));
    assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
    assert.ok(ics.includes('VERSION:2.0\r\n'));
  });
  it('uses CRLF line endings only (no bare LF)', () => {
    assert.ok(!ics.replace(/\r\n/g, '').includes('\n'));
    assert.ok(!ics.replace(/\r\n/g, '').includes('\r'));
  });
  it('has one VEVENT and one VALARM per event', () => {
    assert.equal(lines(ics).filter(l => l === 'BEGIN:VEVENT').length, 2);
    assert.equal(lines(ics).filter(l => l === 'END:VEVENT').length, 2);
    assert.equal(lines(ics).filter(l => l === 'BEGIN:VALARM').length, 2);
    assert.equal(lines(ics).filter(l => l === 'END:VALARM').length, 2);
  });
  it('writes UID, DTSTAMP in UTC and DTSTART/DTEND as local floating time (no Z)', () => {
    const l = lines(ics);
    assert.ok(l.includes('UID:med1-weekly@doseday'));
    assert.ok(l.includes('UID:med2-daily@doseday'));
    assert.ok(l.includes('DTSTAMP:20260101T123045Z'));
    assert.ok(l.includes('DTSTART:20260105T090000'));
    assert.ok(l.includes('DTEND:20260105T091500')); // 15 minutes
    assert.ok(l.includes('DTSTART:20260105T203000'));
    assert.ok(l.includes('DTEND:20260105T204500')); // default duration is 15 minutes
    for (const x of l.filter(s => s.startsWith('DTSTART') || s.startsWith('DTEND'))) assert.ok(!x.endsWith('Z'), x);
  });
  it('writes the RRULE, summary and description', () => {
    const l = lines(ics);
    assert.ok(l.includes('RRULE:FREQ=WEEKLY;BYDAY=MO'));
    assert.ok(l.includes('RRULE:FREQ=DAILY'));
    assert.ok(l.includes('SUMMARY:Take dose'));
    assert.ok(l.includes('DESCRIPTION:Weekly dose'));
  });
  it('omits RRULE for a one-off event and DESCRIPTION when none is given', () => {
    const one = buildICS([{ uid: 'x', title: 'Once', start: new Date(2026, 0, 5, 9, 0) }], NOW);
    assert.ok(!one.includes('RRULE'));
    assert.equal(lines(one).filter(l => l.startsWith('DESCRIPTION')).length, 1); // only the alarm's
  });
  it('the VALARM displays and triggers alarmMin minutes before', () => {
    const l = lines(ics);
    assert.ok(l.includes('ACTION:DISPLAY'));
    assert.ok(l.includes('TRIGGER:-PT10M'));
    assert.ok(l.includes('TRIGGER:-PT0M'));
  });
  it('an empty list still gives a valid calendar', () => {
    assert.equal(buildICS([], NOW).split('\r\n').filter(l => l === 'BEGIN:VEVENT').length, 0);
    assert.ok(buildICS([], NOW).endsWith('END:VCALENDAR\r\n'));
  });
  it('the event time is the local wall-clock time even on a daylight-saving day', () => {
    const out = buildICS([{ uid: 'dst', title: 'DST', start: new Date(2026, 2, 8, 9, 0) }], NOW);
    assert.ok(lines(out).includes('DTSTART:20260308T090000'));
  });
});

describe('buildICS escaping and folding', () => {
  it('escapes commas, semicolons, backslashes and newlines in the title', () => {
    const out = buildICS([{ uid: 'e', title: 'Dose, 2; back\\slash\nnext line', start: new Date(2026, 0, 5, 9, 0) }], NOW);
    assert.ok(lines(out).includes('SUMMARY:Dose\\, 2\\; back\\\\slash\\nnext line'));
    assert.ok(lines(out).includes('DESCRIPTION:Dose\\, 2\\; back\\\\slash\\nnext line')); // alarm text too
    assert.ok(!out.replace(/\r\n/g, '').includes('\n'));
  });
  it('escapes CRLF newlines as well', () => {
    const out = buildICS([{ uid: 'e', title: 'a\r\nb', start: new Date(2026, 0, 5, 9, 0) }], NOW);
    assert.ok(lines(out).includes('SUMMARY:a\\nb'));
  });
  it('folds long lines to at most 75 characters and unfolding restores them', () => {
    const title = 'A'.repeat(200);
    const out = buildICS([{ uid: 'long', title, description: 'word '.repeat(60), start: new Date(2026, 0, 5, 9, 0) }], NOW);
    for (const l of lines(out)) assert.ok(l.length <= 75, `line of ${l.length}: ${l}`);
    assert.ok(lines(out).some(l => l.startsWith(' ')), 'at least one continuation line');
    assert.ok(lines(unfold(out)).includes(`SUMMARY:${title}`));
    assert.ok(lines(unfold(out)).includes(`DESCRIPTION:${'word '.repeat(60)}`));
  });
  it('continuation lines start with a single space', () => {
    const out = buildICS([{ uid: 'long', title: 'B'.repeat(150), start: new Date(2026, 0, 5, 9, 0) }], NOW);
    const cont = lines(out).filter(l => l.startsWith(' '));
    assert.ok(cont.length >= 1);
    for (const c of cont) assert.ok(!c.startsWith('  '));
  });
  it('a line of exactly 73 characters is not folded', () => {
    const title = 'C'.repeat(73 - 'SUMMARY:'.length);
    const out = buildICS([{ uid: 'f', title, start: new Date(2026, 0, 5, 9, 0) }], NOW);
    assert.ok(lines(out).includes(`SUMMARY:${title}`));
  });
  it('folded lines are at most 75 octets (RFC 5545) with non-ASCII text', () => {
    const out = buildICS([{ uid: 'u', title: 'é'.repeat(100), start: new Date(2026, 0, 5, 9, 0) }], NOW);
    for (const l of lines(out)) assert.ok(Buffer.byteLength(l, 'utf8') <= 75, `${Buffer.byteLength(l, 'utf8')} octets`);
  });
});

describe('firstWeekday', () => {
  it('returns the same day when it already matches', () => {
    const d = firstWeekday(new Date(2026, 0, 5, 15, 45), 1); // Monday
    assert.deepEqual([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()], [2026, 0, 5, 0]);
  });
  it('moves forward to the next matching weekday', () => {
    const d = firstWeekday(new Date(2026, 0, 7), 1); // Wed Jan 7 -> Mon Jan 12
    assert.deepEqual([d.getMonth(), d.getDate()], [0, 12]);
    const sun = firstWeekday(new Date(2026, 0, 31), 0); // Sat Jan 31 -> Sun Feb 1
    assert.deepEqual([sun.getMonth(), sun.getDate()], [1, 1]);
  });
});
