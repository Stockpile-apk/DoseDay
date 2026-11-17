import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { dayTotals, waterTotal, weekSummary, driFor, overUpperLimit } from '../www/js/logic/nutrition.js';

const targets = JSON.parse(fs.readFileSync(new URL('../www/data/targets.json', import.meta.url), 'utf8'));
const row = key => {
  const r = targets.dri.find(x => x.key === key);
  assert.ok(r, `targets.json has no dri row "${key}"`);
  return r;
};

describe('dayTotals', () => {
  it('multiplies by qty, and a missing qty counts as 1', () => {
    const t = dayTotals([
      { kcal: 100, protein: 10, carbs: 5, fat: 2, qty: 2 },
      { kcal: 50, protein: 5, carbs: 1, fat: 1 },
      { kcal: 30, qty: 0.5 },
    ]);
    assert.deepEqual(t, { kcal: 200 + 50 + 15, protein: 20 + 5, carbs: 10 + 1, fat: 4 + 1, count: 3 });
  });
  it('invalid or non-positive qty counts as 1', () => {
    assert.equal(dayTotals([{ kcal: 100, qty: 0 }]).kcal, 100);
    assert.equal(dayTotals([{ kcal: 100, qty: -2 }]).kcal, 100);
    assert.equal(dayTotals([{ kcal: 100, qty: 'abc' }]).kcal, 100);
    assert.equal(dayTotals([{ kcal: 100, qty: '3' }]).kcal, 300);
  });
  it('treats missing numbers as zero and handles empty input', () => {
    assert.deepEqual(dayTotals([{}]), { kcal: 0, protein: 0, carbs: 0, fat: 0, count: 1 });
    assert.deepEqual(dayTotals([]), { kcal: 0, protein: 0, carbs: 0, fat: 0, count: 0 });
    assert.deepEqual(dayTotals(undefined), { kcal: 0, protein: 0, carbs: 0, fat: 0, count: 0 });
  });
});

describe('waterTotal', () => {
  it('sums ml, ignoring bad values', () => {
    assert.equal(waterTotal([{ ml: 250 }, { ml: '500' }, {}, { ml: 'x' }]), 750);
    assert.equal(waterTotal([]), 0);
    assert.equal(waterTotal(undefined), 0);
  });
});

describe('weekSummary', () => {
  const logs = {
    '2026-01-05': [{ kcal: 1000, protein: 60, qty: 2 }],         // 2000 kcal, 120 g
    '2026-01-06': [{ kcal: 900, protein: 50 }, { kcal: 900, protein: 50 }], // 1800 kcal, 100 g
    '2026-01-07': [],                                              // ignored: no entries
  };
  it('averages over days that have entries and counts protein days met', () => {
    assert.deepEqual(weekSummary(logs, { proteinG: 110 }), { days: 2, avgKcal: 1900, avgProtein: 110, proteinDaysMet: 1 });
  });
  it('protein target met is inclusive', () => {
    assert.equal(weekSummary(logs, { proteinG: 100 }).proteinDaysMet, 2);
    assert.equal(weekSummary(logs, { proteinG: 121 }).proteinDaysMet, 0);
  });
  it('no target means no days met', () => {
    assert.equal(weekSummary(logs).proteinDaysMet, 0);
    assert.equal(weekSummary(logs, {}).proteinDaysMet, 0);
  });
  it('rounds the averages', () => {
    const l = { a: [{ kcal: 1000 }], b: [{ kcal: 1001 }] };
    assert.equal(weekSummary(l).avgKcal, 1001); // 1000.5 rounds up
  });
  it('is empty-safe', () => {
    assert.deepEqual(weekSummary({}), { days: 0, avgKcal: null, avgProtein: null, proteinDaysMet: 0 });
    assert.deepEqual(weekSummary(undefined), { days: 0, avgKcal: null, avgProtein: null, proteinDaysMet: 0 });
    assert.equal(weekSummary({ '2026-01-05': [] }).days, 0);
  });
});

describe('driFor: plain numbers', () => {
  it('uses the number for each sex; ul and kind come through', () => {
    assert.deepEqual(driFor({ men: 11, women: 8, ul: 40, kind: 'RDA', unit: 'mg' }, 'male', 30),
      { value: 11, ul: 40, kind: 'RDA', unit: 'mg', ulNote: '' });
    assert.equal(driFor({ men: 11, women: 8, ul: 40 }, 'female', 30).value, 8);
  });
  it('null stays null', () => {
    const r = driFor({ men: 120, women: 90, ul: null, ulNote: 'none' }, 'male', 30);
    assert.equal(r.ul, null);
    assert.equal(r.ulNote, 'none');
    assert.equal(driFor({ men: null, women: null, ul: null }, 'male', 30).value, null);
  });
  it('shipped rows: zinc, vitamin K', () => {
    assert.equal(driFor(row('zinc'), 'male', 36).value, 11);
    assert.equal(driFor(row('zinc'), 'female', 36).value, 8);
    assert.equal(driFor(row('zinc'), 'male', 36).ul, 40);
    assert.equal(driFor(row('vitK'), 'male', 36).value, 120);
    assert.equal(driFor(row('vitK'), 'female', 36).value, 90);
    assert.equal(driFor(row('vitK'), 'male', 36).ul, null);
  });
});

describe('driFor: age steps (real rows from targets.json)', () => {
  it('calcium, woman of 45 vs 55 (step at 51)', () => {
    const a = driFor(row('calcium'), 'female', 45);
    const b = driFor(row('calcium'), 'female', 55);
    assert.equal(a.value, 1000);
    assert.equal(b.value, 1200);
    assert.equal(a.ul, 2500);
    assert.equal(b.ul, 2000);
    assert.equal(driFor(row('calcium'), 'female', 50).value, 1000);
    assert.equal(driFor(row('calcium'), 'female', 51).value, 1200);
  });
  it('calcium, man steps at 71', () => {
    assert.equal(driFor(row('calcium'), 'male', 70).value, 1000);
    assert.equal(driFor(row('calcium'), 'male', 71).value, 1200);
  });
  it('iron, woman of 30 vs 60 (18 mg then 8 mg), UL stays 45', () => {
    assert.equal(driFor(row('iron'), 'female', 30).value, 18);
    assert.equal(driFor(row('iron'), 'female', 60).value, 8);
    assert.equal(driFor(row('iron'), 'female', 30).ul, 45);
    assert.equal(driFor(row('iron'), 'male', 30).value, 8);
  });
  it('magnesium, man of 25 vs 40 (400 then 420)', () => {
    assert.equal(driFor(row('magnesium'), 'male', 25).value, 400);
    assert.equal(driFor(row('magnesium'), 'male', 40).value, 420);
    assert.equal(driFor(row('magnesium'), 'female', 25).value, 310);
    assert.equal(driFor(row('magnesium'), 'female', 40).value, 320);
    assert.equal(driFor(row('magnesium'), 'male', 40).ul, 350);
  });
  it('age steps work on a synthetic row too, using the last step whose age is reached', () => {
    const r = { men: [[19, 1], [31, 2], [51, 3]], women: 0, ul: null };
    assert.equal(driFor(r, 'male', 19).value, 1);
    assert.equal(driFor(r, 'male', 30).value, 1);
    assert.equal(driFor(r, 'male', 31).value, 2);
    assert.equal(driFor(r, 'male', 90).value, 3);
  });
});

describe('overUpperLimit', () => {
  const dri = targets.dri;
  it('flags zinc 50 mg (limit 40)', () => {
    const out = overUpperLimit([{ nutrientKey: 'zinc', amount: 50 }], dri, 'male', 36);
    assert.equal(out.length, 1);
    assert.equal(out[0].key, 'zinc');
    assert.equal(out[0].total, 50);
    assert.equal(out[0].ul, 40);
    assert.equal(out[0].unit, 'mg');
  });
  it('does not flag zinc 30 mg or exactly 40 mg', () => {
    assert.deepEqual(overUpperLimit([{ nutrientKey: 'zinc', amount: 30 }], dri, 'male', 36), []);
    assert.deepEqual(overUpperLimit([{ nutrientKey: 'zinc', amount: 40 }], dri, 'male', 36), []);
  });
  it('does not flag vitamin K, which has no limit, however large', () => {
    assert.deepEqual(overUpperLimit([{ nutrientKey: 'vitK', amount: 5000 }], dri, 'female', 40), []);
  });
  it('sums two supplements with the same nutrientKey', () => {
    const out = overUpperLimit([{ nutrientKey: 'zinc', amount: 25 }, { nutrientKey: 'zinc', amount: 25 }], dri, 'female', 40);
    assert.equal(out.length, 1);
    assert.equal(out[0].total, 50);
    assert.deepEqual(overUpperLimit([{ nutrientKey: 'zinc', amount: 15 }, { nutrientKey: 'zinc', amount: 15 }], dri, 'female', 40), []);
  });
  it('uses the age-specific limit: calcium 2200 mg is fine at 45 (2500) but over at 55 (2000)', () => {
    const s = [{ nutrientKey: 'calcium', amount: 2200 }];
    assert.deepEqual(overUpperLimit(s, dri, 'female', 45), []);
    const out = overUpperLimit(s, dri, 'female', 55);
    assert.equal(out.length, 1);
    assert.equal(out[0].ul, 2000);
  });
  it('flags several nutrients at once and carries ulNote', () => {
    const out = overUpperLimit([{ nutrientKey: 'zinc', amount: 45 }, { nutrientKey: 'magnesium', amount: 360 }], dri, 'male', 36);
    assert.deepEqual(out.map(o => o.key).sort(), ['magnesium', 'zinc']);
    assert.match(out.find(o => o.key === 'magnesium').ulNote, /supplements and medicines only/);
  });
  it('ignores entries without a key, zero or invalid amounts, and unknown keys', () => {
    assert.deepEqual(overUpperLimit([{ amount: 500 }, { nutrientKey: 'zinc', amount: 0 }, { nutrientKey: 'zinc', amount: 'x' }, { nutrientKey: 'nope', amount: 9999 }], dri, 'male', 36), []);
    assert.deepEqual(overUpperLimit(undefined, dri, 'male', 36), []);
    assert.deepEqual(overUpperLimit([{ nutrientKey: 'zinc', amount: 50 }], undefined, 'male', 36), []);
  });
});
