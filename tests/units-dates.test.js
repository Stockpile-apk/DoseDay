import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { kgToLb, toKg, fromKg, fmtWeight, kgToStLb, stLbToKg } from '../www/js/units.js';
import { addDays, daysBetween, parseISODate, atTime, toISODate } from '../www/js/dates.js';
process.env.TZ = 'America/Vancouver';

describe('units', () => {
  it('kg to lb', () => assert.equal(Math.round(kgToLb(150) * 10) / 10, 330.7));
  it('stone round trip', () => { const kg = stLbToKg(23, 8); assert.ok(Math.abs(kg - 149.69) < 0.05); assert.deepEqual(kgToStLb(kg), { st: 23, lb: 8 }); });
  it('fmtWeight in each unit', () => {
    assert.equal(fmtWeight(150, 'kg'), '150.0 kg');
    assert.equal(fmtWeight(150, 'lb'), '330.7 lb');
    assert.match(fmtWeight(150, 'st'), /^23 st 8\.7 lb$/);
    assert.equal(fmtWeight(null), '—');
  });
  it('toKg rejects blanks, zero and words', () => {
    for (const v of ['', null, undefined, 0, -3, 'abc']) assert.equal(toKg(v, 'kg'), null);
    assert.equal(toKg({ st: '', lb: '' }, 'st'), null);
    assert.ok(Math.abs(toKg(330.7, 'lb') - 150) < 0.01);
  });
  it('fromKg', () => { assert.equal(fromKg(150, 'kg'), 150); assert.equal(fromKg(150, 'lb'), 330.7); });
});

describe('dates', () => {
  it('addDays across month and year ends', () => {
    assert.equal(addDays('2026-01-31', 1), '2026-02-01');
    assert.equal(addDays('2026-12-31', 1), '2027-01-01');
    assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  });
  it('daysBetween is whole days across DST', () => {
    assert.equal(daysBetween('2026-03-07', '2026-03-09'), 2);
    assert.equal(daysBetween('2026-10-31', '2026-11-02'), 2);
  });
  it('parseISODate keeps the day', () => assert.equal(toISODate(parseISODate('2026-11-16')), '2026-11-16'));
  it('atTime keeps local clock time across DST', () => {
    assert.equal(atTime('2026-03-08', '09:00').getHours(), 9);
    assert.equal(atTime('2026-11-01', '09:30').getMinutes(), 30);
  });
});
