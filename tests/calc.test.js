import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { reconstitute, unitsToDose, vialLife, fmt, toMg } from '../www/js/logic/calc.js';

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `expected ${a} to be within ${eps} of ${b}`);
const has = (list, re) => list.some(x => re.test(x));

describe('reconstitute: worked examples', () => {
  it('10 mg + 2 mL, 1 mg dose -> 5 mg/mL, 0.2 mL, 20 units, 10 doses', () => {
    const r = reconstitute({ vialMg: 10, diluentMl: 2, dose: 1, doseUnit: 'mg' });
    assert.equal(r.ok, true);
    assert.deepEqual(r.errors, []);
    near(r.concMgMl, 5);
    near(r.drawMl, 0.2);
    near(r.units, 20);
    near(r.dosesPerVial, 10);
    assert.deepEqual(r.warnings, []);
    assert.equal(r.formulas.length, 3);
  });
  it('5 mg + 2 mL, 250 mcg -> 10 units', () => {
    const r = reconstitute({ vialMg: 5, diluentMl: 2, dose: 250, doseUnit: 'mcg' });
    near(r.concMgMl, 2.5);
    near(r.units, 10);
    assert.deepEqual(r.warnings, []); // exactly 10 units needs no small-dose hint
  });
  it('10 mg + 3 mL, 1 mg -> 30 units', () => {
    const r = reconstitute({ vialMg: 10, diluentMl: 3, dose: 1, doseUnit: 'mg' });
    near(r.units, 30);
    near(r.drawMl, 0.3);
  });
  it('20 mg + 3 mL, 1 mg -> 15 units', () => {
    near(reconstitute({ vialMg: 20, diluentMl: 3, dose: 1, doseUnit: 'mg' }).units, 15);
  });
  it('accepts numeric strings as typed', () => {
    near(reconstitute({ vialMg: '10', diluentMl: '2', dose: '1', doseUnit: 'mg' }).units, 20);
  });
});

describe('reconstitute: mg and mcg', () => {
  it('250 mcg is 0.25 mg', () => {
    assert.equal(toMg(250, 'mcg'), 0.25);
    assert.equal(toMg(2, 'mg'), 2);
    near(reconstitute({ vialMg: 5, diluentMl: 2, dose: 250, doseUnit: 'mcg' }).doseMg, 0.25);
  });
  it('250 mcg and 0.25 mg give the same answer', () => {
    const a = reconstitute({ vialMg: 5, diluentMl: 2, dose: 250, doseUnit: 'mcg' });
    const b = reconstitute({ vialMg: 5, diluentMl: 2, dose: 0.25, doseUnit: 'mg' });
    near(a.units, b.units);
    near(a.drawMl, b.drawMl);
  });
  it('a missing or invalid unit is an error', () => {
    for (const u of [undefined, '', 'g', 'MG', null]) {
      const r = reconstitute({ vialMg: 10, diluentMl: 2, dose: 1, doseUnit: u });
      assert.equal(r.ok, false, String(u));
      assert.ok(has(r.errors, /mg or mcg/), String(u));
    }
  });
  it('a dose larger than the vial is an error', () => {
    const r = reconstitute({ vialMg: 5, diluentMl: 2, dose: 10, doseUnit: 'mg' });
    assert.equal(r.ok, false);
    assert.ok(has(r.errors, /more than the whole vial/));
    const m = reconstitute({ vialMg: 0.5, diluentMl: 1, dose: 1000, doseUnit: 'mcg' }); // 1 mg > 0.5 mg
    assert.equal(m.ok, false);
  });
  it('a dose equal to the vial is allowed', () => {
    assert.equal(reconstitute({ vialMg: 5, diluentMl: 2, dose: 5000, doseUnit: 'mcg' }).ok, true);
  });
});

describe('reconstitute: warnings', () => {
  it('under 5 units', () => {
    const r = reconstitute({ vialMg: 10, diluentMl: 4, dose: 0.1, doseUnit: 'mg' }); // conc 2.5, 0.04 mL = 4 units
    near(r.units, 4);
    assert.ok(has(r.warnings, /Under about 5 units/));
    assert.ok(!has(r.warnings, /between 10 and 50/));
  });
  it('5 to under 10 units gives the easier-to-measure hint', () => {
    const r = reconstitute({ vialMg: 10, diluentMl: 2, dose: 0.35, doseUnit: 'mg' }); // 7 units
    near(r.units, 7);
    assert.ok(has(r.warnings, /between 10 and 50/));
    assert.ok(!has(r.warnings, /Under about 5/));
    const edge = reconstitute({ vialMg: 10, diluentMl: 2, dose: 0.25, doseUnit: 'mg' }); // 5 units: no "under 5"
    assert.ok(!has(edge.warnings, /Under about 5/));
    assert.ok(has(edge.warnings, /between 10 and 50/));
  });
  it('more than 100 units on a 1 mL syringe', () => {
    const r = reconstitute({ vialMg: 10, diluentMl: 5, dose: 5, doseUnit: 'mg' }); // 2.5 mL = 250 units
    near(r.units, 250);
    assert.ok(has(r.warnings, /more than a 1 mL U-100 syringe/));
    assert.ok(has(r.warnings, /250 units/));
  });
  it('exactly 100 units is fine for a 1 mL syringe', () => {
    const r = reconstitute({ vialMg: 10, diluentMl: 2, dose: 5, doseUnit: 'mg' });
    near(r.units, 100);
    assert.ok(!has(r.warnings, /syringe holds/));
  });
  it('a larger syringe raises the limit', () => {
    const r = reconstitute({ vialMg: 10, diluentMl: 5, dose: 5, doseUnit: 'mg', syringeMl: 3 });
    assert.ok(!has(r.warnings, /syringe holds/));
  });
  it('diluent over 10 mL', () => {
    const r = reconstitute({ vialMg: 100, diluentMl: 12, dose: 5, doseUnit: 'mg' });
    assert.ok(has(r.warnings, /More than 10 mL of diluent/));
    assert.ok(!has(reconstitute({ vialMg: 100, diluentMl: 10, dose: 5, doseUnit: 'mg' }).warnings, /More than 10 mL/));
  });
  it('unusual mg dose of 100 or more: "Did you mean mcg"', () => {
    const r = reconstitute({ vialMg: 500, diluentMl: 5, dose: 100, doseUnit: 'mg' });
    assert.equal(r.ok, true);
    assert.ok(has(r.warnings, /Did you mean mcg/));
    assert.ok(!has(reconstitute({ vialMg: 500, diluentMl: 5, dose: 99, doseUnit: 'mg' }).warnings, /Did you mean mcg/));
  });
  it('tiny mcg dose: "Did you mean mg"', () => {
    assert.ok(has(reconstitute({ vialMg: 5, diluentMl: 2, dose: 0.5, doseUnit: 'mcg' }).warnings, /Did you mean mg/));
  });
});

describe('reconstitute: bad inputs never throw', () => {
  const good = { vialMg: 10, diluentMl: 2, dose: 1, doseUnit: 'mg' };
  const bads = [0, -1, NaN, '', 'abc', null, undefined, Infinity];
  for (const field of ['vialMg', 'diluentMl', 'dose']) {
    for (const bad of bads) {
      it(`${field} = ${String(bad)} gives ok:false with errors`, () => {
        const r = reconstitute({ ...good, [field]: bad });
        assert.equal(r.ok, false);
        assert.ok(r.errors.length >= 1);
        assert.ok(Array.isArray(r.warnings));
      });
    }
  }
  it('empty object does not throw', () => {
    const r = reconstitute({});
    assert.equal(r.ok, false);
    assert.equal(r.errors.length, 4);
  });
});

describe('unitsToDose', () => {
  it('10 mg in 2 mL, 20 units -> 1 mg (1000 mcg)', () => {
    const r = unitsToDose({ vialMg: 10, diluentMl: 2, units: 20 });
    assert.equal(r.ok, true);
    near(r.concMgMl, 5);
    near(r.drawMl, 0.2);
    near(r.doseMg, 1);
    near(r.doseMcg, 1000);
  });
  it('reverses reconstitute', () => {
    for (const [vialMg, diluentMl, dose, doseUnit] of [[5, 2, 250, 'mcg'], [10, 3, 1, 'mg'], [20, 3, 1, 'mg'], [30, 2.5, 0.75, 'mg']]) {
      const f = reconstitute({ vialMg, diluentMl, dose, doseUnit });
      const back = unitsToDose({ vialMg, diluentMl, units: f.units });
      near(back.doseMg, f.doseMg, 1e-9);
    }
  });
  it('warns when more liquid is drawn than was added', () => {
    const r = unitsToDose({ vialMg: 10, diluentMl: 1, units: 150 });
    assert.ok(has(r.warnings, /more liquid than was added/));
  });
  it('bad inputs give ok:false', () => {
    for (const bad of [0, -5, NaN, '', 'x']) {
      assert.equal(unitsToDose({ vialMg: 10, diluentMl: 2, units: bad }).ok, false);
      assert.equal(unitsToDose({ vialMg: bad, diluentMl: 2, units: 20 }).ok, false);
      assert.equal(unitsToDose({ vialMg: 10, diluentMl: bad, units: 20 }).ok, false);
    }
  });
});

describe('vialLife', () => {
  it('10 mg vial, 0.5 mg doses -> 20 doses, no days without a frequency', () => {
    assert.deepEqual(vialLife({ vialMg: 10, doseMg: 0.5 }), { doses: 20, days: null });
  });
  it('1 dose a week -> 140 days', () => {
    assert.deepEqual(vialLife({ vialMg: 10, doseMg: 0.5, dosesPerWeek: 1 }), { doses: 20, days: 140 });
  });
  it('2 doses a week -> 70 days', () => {
    assert.equal(vialLife({ vialMg: 10, doseMg: 0.5, dosesPerWeek: 2 }).days, 70);
  });
  it('whole doses only: 10 / 0.3 -> 33', () => {
    assert.equal(vialLife({ vialMg: 10, doseMg: 0.3 }).doses, 33);
  });
  it('is null for invalid vial or dose', () => {
    assert.equal(vialLife({ vialMg: 0, doseMg: 0.5 }), null);
    assert.equal(vialLife({ vialMg: 10, doseMg: -1 }), null);
    assert.equal(vialLife({ vialMg: 10, doseMg: NaN }), null);
  });
});

describe('fmt', () => {
  it('trims trailing zeros and rounds to dp (default 2)', () => {
    assert.equal(fmt(1.5), '1.5');
    assert.equal(fmt(2), '2');
    assert.equal(fmt(1.2345), '1.23');
    assert.equal(fmt(0.12345, 3), '0.123');
    assert.equal(fmt(1234.5678), '1234.57');
    assert.equal(fmt(3.0001, 1), '3');
  });
  it('shows a dash for non-numbers', () => {
    assert.equal(fmt(NaN), '—');
    assert.equal(fmt('abc'), '—');
    assert.equal(fmt(Infinity), '—');
    assert.equal(fmt(undefined), '—');
  });
});
