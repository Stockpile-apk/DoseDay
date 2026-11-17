import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  clean, trendWeight, slope, weeklyRate, tier, weeksToGoal, sanitizeTiers,
  TIERS, WARN_KG, DEFAULT_TIERS,
} from '../www/js/logic/rate.js';
import { addDays } from '../www/js/dates.js';

const END = '2026-03-31';
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `expected ${a} to be within ${eps} of ${b}`);

// Exact linear loss: `days` calendar days ending on endDate, one entry every `step` days,
// oldest entry weighs startKg and weight falls by kgPerWk/7 per day.
function series(startKg, kgPerWk, days, { endDate = END, step = 1 } = {}) {
  const out = [];
  for (let i = 0; i < days; i += step) {
    out.push({ date: addDays(endDate, -(days - 1) + i), kg: startKg - (kgPerWk / 7) * i });
  }
  return out;
}

describe('clean', () => {
  it('drops bad rows, keeps good ones, sorts by date', () => {
    const rows = clean([
      { date: '2026-03-03', kg: 80 },
      { date: '2026-03-01', kg: '81.5' },
      { date: '2026-03-02', kg: 0 },
      { date: '2026-03-02', kg: -3 },
      { date: '2026-03-02', kg: 'abc' },
      { date: '2026-03-02', kg: null },
      { date: 20260302, kg: 80 },
      null,
      { kg: 80 },
    ]);
    assert.deepEqual(rows, [{ date: '2026-03-01', kg: 81.5 }, { date: '2026-03-03', kg: 80 }]);
  });
  it('handles undefined and trims datetime strings to the date', () => {
    assert.deepEqual(clean(undefined), []);
    assert.deepEqual(clean([{ date: '2026-03-01T10:00:00', kg: 70 }]), [{ date: '2026-03-01', kg: 70 }]);
  });
});

describe('trendWeight', () => {
  it('averages the entries in the 7 days ending on the date (inclusive)', () => {
    const w = [
      { date: '2026-03-24', kg: 100 }, // outside: 7 days before the end is the 24th, window starts on the 25th
      { date: '2026-03-25', kg: 90 },
      { date: '2026-03-31', kg: 80 },
    ];
    assert.equal(trendWeight(w, '2026-03-31'), 85);
  });
  it('is null when there are no entries in the window', () => {
    assert.equal(trendWeight([{ date: '2026-01-01', kg: 80 }], '2026-03-31'), null);
    assert.equal(trendWeight([], '2026-03-31'), null);
  });
});

describe('slope and weeklyRate', () => {
  it('recovers an exact daily loss of 0.7 kg/wk', () => {
    const r = weeklyRate(series(100, 0.7, 14), END);
    near(r.kgPerWk, 0.7);
    assert.equal(r.n, 14);
  });
  it('recovers the exact slope from every-other-day entries', () => {
    const r = weeklyRate(series(100, 0.5, 14, { step: 2 }), END);
    near(r.kgPerWk, 0.5);
    assert.equal(r.n, 7);
  });
  it('pctPerWk equals kgPerWk / trendKg * 100, with trend worked out by hand', () => {
    // daily, 100 kg falling 0.1 kg/day: last 7 entries are i=7..13, mean = 100 - 0.1*10 = 99
    const r = weeklyRate(series(100, 0.7, 14), END);
    near(r.trendKg, 99);
    near(r.pctPerWk, (0.7 / 99) * 100);
  });
  it('gives a negative kgPerWk when weight goes up', () => {
    near(weeklyRate(series(80, -0.5, 14), END).kgPerWk, -0.5);
  });
  it('is null with fewer than 4 points', () => {
    assert.equal(weeklyRate(series(80, 0.5, 3), END), null);
    assert.equal(slope(series(80, 0.5, 3), END), null);
  });
});

describe('tier: insufficient and gaining', () => {
  it('fewer than 4 points in 14 days is insufficient', () => {
    assert.equal(tier(series(80, 0.5, 14, { step: 5 }), END).key, 'insufficient'); // 3 points
    assert.equal(tier([], END).key, 'insufficient');
    assert.equal(tier(undefined, END).key, 'insufficient');
  });
  it('4 points but older than the 14-day window is insufficient', () => {
    const old = series(80, 0.5, 14, { endDate: addDays(END, -30) });
    assert.equal(tier(old, END).key, 'insufficient');
  });
  it('all points on one day is insufficient', () => {
    const w = [80, 80.1, 79.9, 80.2, 80].map(kg => ({ date: END, kg }));
    assert.equal(tier(w, END).key, 'insufficient');
  });
  it('weight going up is gaining', () => {
    const t = tier(series(80, -0.5, 14), END);
    assert.equal(t.key, 'gaining');
    assert.ok(t.rate.kgPerWk < 0);
  });
  it('result carries label, text and rate', () => {
    const t = tier(series(80, 0.5, 14), END);
    assert.equal(t.label, TIERS.typical.label);
    assert.equal(t.text, TIERS.typical.text);
    assert.ok(t.rate);
  });
});

describe('tier: percent rule at about 80 kg (0.2%/wk = 0.16 kg, 0.75%/wk = 0.6 kg)', () => {
  it('just under 0.2%/wk with under 4 weeks of data is slow', () => {
    assert.equal(tier(series(80, 0.15, 14), END).key, 'slow');
    assert.equal(tier(series(80, 0.15, 21), END).key, 'slow'); // span 20 days is still under 24
  });
  it('just under 0.2%/wk with 28+ days of steady data is below', () => {
    const w = series(80, 0.15, 28);
    assert.equal(tier(w, END, DEFAULT_TIERS, { stillEscalating: false }).key, 'below');
    assert.equal(tier(w, END).key, 'below');
  });
  it('the same 28+ days of data while still escalating is slow', () => {
    assert.equal(tier(series(80, 0.15, 28), END, DEFAULT_TIERS, { stillEscalating: true }).key, 'slow');
  });
  it('just over 0.2%/wk is typical', () => {
    assert.equal(tier(series(80, 0.18, 14), END).key, 'typical');
    assert.equal(tier(series(80, 0.18, 28), END).key, 'typical');
  });
  it('just under 0.75%/wk is typical', () => {
    assert.equal(tier(series(80, 0.55, 14), END).key, 'typical');
  });
  it('just over 0.75%/wk is fast', () => {
    const t = tier(series(80, 0.65, 14), END);
    assert.equal(t.key, 'fast');
    assert.ok(t.rate.pctPerWk > 0.75);
  });
  it('a loss under 0.9 kg/wk and under 0.75% at 100 kg is typical', () => {
    assert.equal(tier(series(100, 0.7, 14), END).key, 'typical');
  });
});

describe('tier: kg rule beats the percent rule at high body weight', () => {
  it('at about 150 kg, 1.0 kg/wk is under 0.75% but over 0.9 kg, so fast', () => {
    const t = tier(series(150, 1.0, 14), END);
    assert.ok(t.rate.pctPerWk < 0.75, `pct ${t.rate.pctPerWk}`);
    assert.ok(t.rate.kgPerWk > 0.9);
    assert.equal(t.key, 'fast');
  });
  it('at about 150 kg, 0.8 kg/wk is typical (under both limits)', () => {
    assert.equal(tier(series(150, 0.8, 14), END).key, 'typical');
  });
});

describe('tier: warning pace over 1.4 kg/wk', () => {
  it('over 1.4 kg/wk in both the latest window and the window 7 days earlier is warning', () => {
    const t = tier(series(100, 2.0, 28), END);
    assert.equal(t.key, 'warning');
    assert.ok(t.rate.kgPerWk > WARN_KG);
  });
  it('over 1.4 kg/wk only in the latest window is fast with a note', () => {
    // flat for days 0..20, then 3 kg/day; the window ending 7 days earlier is flat
    const w = [];
    for (let d = 0; d < 28; d++) w.push({ date: addDays(END, -27 + d), kg: d <= 20 ? 100 : 100 - 3 * (d - 20) });
    const t = tier(w, END);
    assert.ok(t.rate.kgPerWk > WARN_KG);
    assert.equal(t.key, 'fast');
    assert.ok(t.note.length > 0);
  });
  it('just under 1.4 kg/wk is never the warning tier', () => {
    assert.notEqual(tier(series(150, 1.3, 28), END).key, 'warning');
  });
  it('a custom fastKg cannot switch the warning off', () => {
    assert.equal(tier(series(100, 2.0, 28), END, { fastKg: 5, fastPct: 50 }).key, 'warning');
  });
  it('WARN_KG is 1.4', () => assert.equal(WARN_KG, 1.4));
});

describe('tier: custom bounds', () => {
  it('a lower fastPct moves the fast/typical boundary down', () => {
    const w = series(80, 0.45, 14); // about 0.56%/wk
    assert.equal(tier(w, END).key, 'typical');
    assert.equal(tier(w, END, { fastPct: 0.5 }).key, 'fast');
  });
  it('a higher fastPct moves it up', () => {
    const w = series(80, 0.65, 14); // about 0.81%/wk, 0.65 kg
    assert.equal(tier(w, END).key, 'fast');
    assert.equal(tier(w, END, { fastPct: 1.0 }).key, 'typical');
  });
  it('a lower fastKg makes a heavy person trip fast sooner', () => {
    const w = series(150, 0.8, 14);
    assert.equal(tier(w, END).key, 'typical');
    assert.equal(tier(w, END, { fastKg: 0.7 }).key, 'fast');
  });
  it('a higher lowPct makes more losses fall under the low bound', () => {
    const w = series(80, 0.18, 14); // about 0.22%/wk
    assert.equal(tier(w, END).key, 'typical');
    assert.equal(tier(w, END, { lowPct: 0.3 }).key, 'slow');
  });
});

describe('sanitizeTiers', () => {
  it('returns the defaults for empty input', () => {
    assert.deepEqual(sanitizeTiers(), DEFAULT_TIERS);
    assert.deepEqual(sanitizeTiers({}), DEFAULT_TIERS);
  });
  it('falls back to defaults for silly values', () => {
    const t = sanitizeTiers({ lowPct: -1, fastPct: 99, fastKg: 5 });
    assert.deepEqual(t, { lowPct: 0.2, fastPct: 0.75, fastKg: 0.9 });
    assert.deepEqual(sanitizeTiers({ lowPct: 'x', fastPct: NaN, fastKg: 'abc' }), DEFAULT_TIERS);
  });
  it('keeps sensible custom values', () => {
    assert.deepEqual(sanitizeTiers({ lowPct: 0.3, fastPct: 0.6, fastKg: 0.8 }), { lowPct: 0.3, fastPct: 0.6, fastKg: 0.8 });
  });
  it('fastKg is never above WARN_KG', () => {
    for (const v of [1.4, 1.41, 1.5, 2, 10, 1e9, Infinity]) {
      assert.ok(sanitizeTiers({ fastKg: v }).fastKg <= WARN_KG, `fastKg ${v}`);
    }
    assert.equal(sanitizeTiers({ fastKg: 1.4 }).fastKg, 1.4);
    assert.equal(sanitizeTiers({ fastKg: 1.5 }).fastKg, DEFAULT_TIERS.fastKg);
  });
  it('fastPct cannot sit below lowPct or below 0.3', () => {
    assert.equal(sanitizeTiers({ fastPct: 0.1 }).fastPct, 0.75);
    assert.equal(sanitizeTiers({ lowPct: 0.4, fastPct: 0.35 }).fastPct, 0.75);
  });
});

describe('weeksToGoal', () => {
  it('rounds up whole weeks', () => {
    assert.equal(weeksToGoal(90, 80, 0.8), 13); // 10 / 0.8 = 12.5
    assert.equal(weeksToGoal(90, 80, 1), 10);
  });
  it('is null when gaining, flat, or already at goal', () => {
    assert.equal(weeksToGoal(90, 80, -0.5), null);
    assert.equal(weeksToGoal(90, 80, 0), null);
    assert.equal(weeksToGoal(80, 80, 0.5), null);
    assert.equal(weeksToGoal(75, 80, 0.5), null);
  });
  it('is null for non-numbers', () => {
    assert.equal(weeksToGoal(NaN, 80, 1), null);
    assert.equal(weeksToGoal(90, undefined, 1), null);
  });
});

describe('TIERS wording', () => {
  it('no tier text talks about changing a dose, except the warning tier telling the user not to', () => {
    for (const [key, t] of Object.entries(TIERS)) {
      const text = t.text.replace("Don't change your dose on your own", '');
      assert.ok(!/increase|raise|lower|adjust|titrat/i.test(text), `${key}: ${text}`);
      // labels are checked as whole words: "Slower" is a speed word, not the verb "lower"
      assert.ok(!/\b(increase|raise|lower|adjust|titrat\w*)\b/i.test(t.label), `${key} label: ${t.label}`);
    }
    assert.ok(TIERS.warning.text.includes("Don't change your dose on your own"));
  });
  it('every tier the function can return exists in TIERS', () => {
    for (const k of ['insufficient', 'gaining', 'slow', 'below', 'typical', 'fast', 'warning']) assert.ok(TIERS[k], k);
  });
});
