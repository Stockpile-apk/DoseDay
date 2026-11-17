import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  eer, mifflin, calorieFloors, calorieLevel, suggest, minGoalKg, effective, bmi, ageFrom,
} from '../www/js/logic/targets.js';

const near = (a, b, eps = 0.01) => assert.ok(Math.abs(a - b) <= eps, `expected ${a} to be within ${eps} of ${b}`);
const NOW = new Date(2026, 5, 1); // fixed "today" so ages are stable

describe('eer', () => {
  it('male, 36 y, 190.5 cm, 150 kg, low active', () => {
    near(eer({ sex: 'male', age: 36, heightCm: 190.5, kg: 150, activity: 'low' }),
      581.47 - 10.83 * 36 + 8.30 * 190.5 + 14.94 * 150); // 4013.74
    near(eer({ sex: 'male', age: 36, heightCm: 190.5, kg: 150, activity: 'low' }), 4013.74);
  });
  it('female, 30 y, 165 cm, 70 kg, inactive (default activity)', () => {
    // 584.90 - 7.01*30 + 5.72*165 + 11.71*70 = 584.9 - 210.3 + 943.8 + 819.7
    near(eer({ sex: 'female', age: 30, heightCm: 165, kg: 70 }), 2138.1);
  });
  it('is null for age under 19', () => {
    assert.equal(eer({ sex: 'male', age: 18, heightCm: 180, kg: 80 }), null);
    assert.ok(eer({ sex: 'male', age: 19, heightCm: 180, kg: 80 }) > 0);
  });
  it('is null for missing or invalid data', () => {
    assert.equal(eer({ sex: '', age: 30, heightCm: 180, kg: 80 }), null);
    assert.equal(eer({ sex: 'male', age: null, heightCm: 180, kg: 80 }), null);
    assert.equal(eer({ sex: 'male', age: 30, heightCm: null, kg: 80 }), null);
    assert.equal(eer({ sex: 'male', age: 30, heightCm: 180, kg: 0 }), null);
    assert.equal(eer({ sex: 'male', age: 30, heightCm: 180, kg: 80, activity: 'bogus' }), null);
  });
});

describe('mifflin', () => {
  it('male 40 y, 180 cm, 100 kg = 1000 + 1125 - 200 + 5', () => {
    assert.equal(mifflin({ sex: 'male', age: 40, heightCm: 180, kg: 100 }), 1930);
  });
  it('female 30 y, 165 cm, 60 kg = 600 + 1031.25 - 150 - 161', () => {
    near(mifflin({ sex: 'female', age: 30, heightCm: 165, kg: 60 }), 1320.25);
  });
  it('is null when sex or data is missing', () => {
    assert.equal(mifflin({ sex: '', age: 30, heightCm: 165, kg: 60 }), null);
    assert.equal(mifflin({ sex: 'male', age: 30, heightCm: 0, kg: 60 }), null);
  });
});

describe('calorieFloors and calorieLevel', () => {
  it('floors by sex; unknown sex uses the higher floor', () => {
    assert.deepEqual(calorieFloors('female'), { warn: 1200, strong: 800 });
    assert.deepEqual(calorieFloors('male'), { warn: 1500, strong: 800 });
    assert.deepEqual(calorieFloors(''), { warn: 1500, strong: 800 });
    assert.deepEqual(calorieFloors(undefined), { warn: 1500, strong: 800 });
  });
  it('female levels at 799 / 800 / 1199 / 1200', () => {
    assert.equal(calorieLevel(799, 'female'), 'strong');
    assert.equal(calorieLevel(800, 'female'), 'warn');
    assert.equal(calorieLevel(1199, 'female'), 'warn');
    assert.equal(calorieLevel(1200, 'female'), 'ok');
  });
  it('male levels at 799 / 800 / 1499 / 1500', () => {
    assert.equal(calorieLevel(799, 'male'), 'strong');
    assert.equal(calorieLevel(800, 'male'), 'warn');
    assert.equal(calorieLevel(1499, 'male'), 'warn');
    assert.equal(calorieLevel(1500, 'male'), 'ok');
  });
  it('unknown sex uses the male floor; no value is ok', () => {
    assert.equal(calorieLevel(1499, ''), 'warn');
    assert.equal(calorieLevel(1500, ''), 'ok');
    assert.equal(calorieLevel(null, 'male'), 'ok');
  });
});

describe('bmi, ageFrom, minGoalKg', () => {
  it('bmi = kg / m^2', () => {
    near(bmi(81, 180), 25, 1e-9); // 81 / 3.24
    assert.equal(bmi(0, 180), null);
  });
  it('ageFrom uses the calendar year', () => {
    assert.equal(ageFrom(1990, NOW), 36);
    assert.equal(ageFrom('abc', NOW), null);
    assert.equal(ageFrom(2030, NOW), null);
  });
  it('minGoalKg is BMI 18.5', () => {
    near(minGoalKg(180), 18.5 * 1.8 * 1.8, 1e-9); // 59.94
    near(bmi(minGoalKg(172), 172), 18.5, 1e-9);
    assert.equal(minGoalKg(0), null);
    assert.equal(minGoalKg(undefined), null);
  });
});

describe('suggest: protein', () => {
  const big = { sex: 'male', birthYear: 1990, heightCm: 190.5, activity: 'low' };
  it('BMI of 30 or more uses the absolute 80 to 120 g range', () => {
    const s = suggest(big, 150, NOW); // BMI 41.3
    assert.equal(s.protein.basis, 'absolute');
    assert.equal(s.protein.low, 80);
    assert.equal(s.protein.high, 120);
    assert.equal(s.protein.value, 100);
  });
  it('BMI just under 30 uses 1.2 to 1.6 g/kg', () => {
    // 180 cm: BMI 30 at 97.2 kg. 97 kg is 29.94
    const s = suggest({ sex: 'male', birthYear: 1990, heightCm: 180 }, 97, NOW);
    assert.equal(s.protein.basis, 'perKg');
    assert.equal(s.protein.low, Math.round(1.2 * 97)); // 116
    assert.equal(s.protein.high, Math.round(1.6 * 97)); // 155
    assert.equal(s.protein.value, Math.round(1.4 * 97)); // 136
  });
  it('BMI exactly at the threshold counts as 30 or more', () => {
    const s = suggest({ sex: 'male', birthYear: 1990, heightCm: 100 }, 30, NOW); // BMI 30.0
    assert.equal(s.protein.basis, 'absolute');
  });
  it('70 kg woman: 84 to 112 g, 98 g mid', () => {
    const s = suggest({ sex: 'female', birthYear: 1990, heightCm: 165 }, 70, NOW);
    assert.deepEqual([s.protein.low, s.protein.value, s.protein.high], [84, 98, 112]);
  });
  it('rdaG is 0.8 g/kg', () => {
    assert.equal(suggest({ sex: 'female', birthYear: 1990, heightCm: 165 }, 70, NOW).protein.rdaG, 56);
    assert.equal(suggest(big, 150, NOW).protein.rdaG, 120);
  });
});

describe('suggest: water and fibre', () => {
  it('water is 3700 for men and 2700 for women', () => {
    assert.equal(suggest({ sex: 'male', birthYear: 1990, heightCm: 180 }, 80, NOW).water.value, 3700);
    assert.equal(suggest({ sex: 'female', birthYear: 1990, heightCm: 165 }, 70, NOW).water.value, 2700);
  });
  it('fibre is 38/25 under 51 and 30/21 from 51', () => {
    const m = by => suggest({ sex: 'male', birthYear: by, heightCm: 180 }, 80, NOW).fibre.value;
    const f = by => suggest({ sex: 'female', birthYear: by, heightCm: 165 }, 70, NOW).fibre.value;
    assert.equal(m(1976), 38); // age 50
    assert.equal(m(1975), 30); // age 51
    assert.equal(f(1976), 25);
    assert.equal(f(1975), 21);
    assert.equal(m(1960), 30);
    assert.equal(f(1960), 21);
  });
});

describe('suggest: calories', () => {
  const woman = { sex: 'female', birthYear: 1990, heightCm: 165 };
  it('default is maintenance minus 500, rounded to 10', () => {
    // 584.90 - 7.01*36 + 5.72*165 + 11.71*70 = 2096.04 ; minus 500 = 1596.04 -> 1600
    const s = suggest(woman, 70, NOW);
    assert.equal(s.calories.maintenance, 2096);
    assert.equal(s.calories.deficit, 500);
    assert.equal(s.calories.value, 1600);
    assert.equal(s.calories.heldAtFloor, false);
    assert.equal(s.calories.resting, Math.round(10 * 70 + 6.25 * 165 - 5 * 36 - 161)); // 1371
  });
  it('big male example: maintenance 4014, target 3510', () => {
    const s = suggest({ sex: 'male', birthYear: 1990, heightCm: 190.5, activity: 'low' }, 150, NOW);
    assert.equal(s.calories.maintenance, 4014);
    assert.equal(s.calories.value, 3510); // 3513.74
    assert.equal(s.calories.resting, 2516); // 1500 + 1190.625 - 180 + 5
  });
  it('a custom deficit is used, and rounded to 10', () => {
    assert.equal(suggest({ ...woman, targets: { deficit: 600 } }, 70, NOW).calories.value, 1500); // 1496.04
  });
  it('a custom deficit is clamped to 0..750', () => {
    const hi = suggest({ ...woman, targets: { deficit: 1000 } }, 70, NOW).calories;
    assert.equal(hi.deficit, 750);
    assert.equal(hi.value, 1350); // 1346.04
    const lo = suggest({ ...woman, targets: { deficit: -100 } }, 70, NOW).calories;
    assert.equal(lo.deficit, 0);
    assert.equal(lo.value, 2100); // 2096.04
    assert.equal(suggest({ ...woman, targets: { deficit: 0 } }, 70, NOW).calories.deficit, 0);
  });
  it('a tiny person is held at the floor', () => {
    // age 40, 150 cm, 40 kg: 584.9 - 280.4 + 858 + 468.4 = 1630.9 ; minus 500 = 1130.9 < 1200
    const s = suggest({ sex: 'female', birthYear: 1986, heightCm: 150 }, 40, NOW).calories;
    assert.equal(s.value, 1200);
    assert.equal(s.heldAtFloor, true);
    assert.equal(s.floor, 1200);
    assert.ok(s.notes.some(n => /1200/.test(n)));
  });
  it('under 19 gets no calorie value and a note', () => {
    const s = suggest({ sex: 'male', birthYear: 2010, heightCm: 170 }, 60, NOW);
    assert.equal(s.calories.value, null);
    assert.ok(s.calories.notes.some(n => /19/.test(n)));
  });
});

describe('suggest: missing fields', () => {
  it('lists everything missing and gives null calories', () => {
    const s = suggest({}, null, NOW);
    assert.deepEqual(s.missing, ['sex', 'birth year', 'height', 'a weight']);
    assert.equal(s.calories.value, null);
    assert.equal(s.protein.value, null);
    assert.equal(s.protein.basis, 'none');
    assert.equal(s.minGoalKg, null);
  });
  it('lists only what is absent', () => {
    const s = suggest({ sex: 'male', birthYear: 1990 }, 80, NOW);
    assert.deepEqual(s.missing, ['height']);
    assert.equal(s.calories.value, null);
  });
  it('minGoalKg is returned when height is known', () => {
    near(suggest({ sex: 'male', birthYear: 1990, heightCm: 180 }, 80, NOW).minGoalKg, 59.94);
  });
});

describe('effective', () => {
  const profile = { sex: 'male', birthYear: 1990, heightCm: 180 };
  const sug = suggest(profile, 80, NOW);
  it('uses suggestions when there are no overrides', () => {
    assert.deepEqual(effective(profile, sug), {
      kcal: sug.calories.value, proteinG: sug.protein.value, waterMl: 3700, fibreG: 38,
    });
  });
  it('prefers the user own numbers', () => {
    const e = effective({ ...profile, targets: { kcal: 1800, proteinG: '130', waterMl: 3000, fibreG: 40 } }, sug);
    assert.deepEqual(e, { kcal: 1800, proteinG: 130, waterMl: 3000, fibreG: 40 });
  });
  it('ignores blank, zero and invalid overrides', () => {
    const e = effective({ ...profile, targets: { kcal: '', proteinG: 0, waterMl: 'x', fibreG: null } }, sug);
    assert.equal(e.kcal, sug.calories.value);
    assert.equal(e.proteinG, sug.protein.value);
    assert.equal(e.waterMl, 3700);
    assert.equal(e.fibreG, 38);
  });
  it('handles a missing profile', () => {
    assert.equal(effective(undefined, sug).waterMl, 3700);
  });
});
