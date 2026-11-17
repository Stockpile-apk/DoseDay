// Weekly weight-loss rate and alert tiers. Pure functions: no DOM, no storage.
// Tier bounds are the evidence-based defaults from the R4 research (ref_R4_nutrition.json):
//   Below trial average (information only): under 0.2%/wk averaged over 4 or more weeks, after dose escalation
//   Typical: 0.2 to 0.75%/wk AND no more than 0.9 kg/wk
//   Fast, notice: over 0.75%/wk OR over 0.9 kg/wk
//   Warning: over 1.4 kg/wk sustained for 2 or more weeks (NIH gallstone-risk pace)
// No tier ever mentions changing a dose.
import { addDays, daysBetween } from '../dates.js';

export const DEFAULT_TIERS = { lowPct: 0.2, fastPct: 0.75, fastKg: 0.9 };
export const WARN_KG = 1.4; // fixed: cannot be raised or switched off
export const MIN_POINTS = 4;

// weights: [{date:'YYYY-MM-DD', kg}] in any order -> sorted copy, bad rows dropped
export function clean(weights) {
  return (weights || [])
    .filter(w => w && typeof w.date === 'string' && Number.isFinite(Number(w.kg)) && Number(w.kg) > 0)
    .map(w => ({ date: w.date.slice(0, 10), kg: Number(w.kg) }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

// Average of the entries in the 7 days ending on endDate (inclusive). null if none.
export function trendWeight(weights, endDate) {
  const from = addDays(endDate, -6);
  const rows = clean(weights).filter(w => w.date >= from && w.date <= endDate);
  if (!rows.length) return null;
  return rows.reduce((s, w) => s + w.kg, 0) / rows.length;
}

// Least-squares slope over the window ending on endDate. Positive kgPerWk means losing weight.
export function slope(weights, endDate, windowDays = 14, minPoints = MIN_POINTS) {
  const from = addDays(endDate, -(windowDays - 1));
  const rows = clean(weights).filter(w => w.date >= from && w.date <= endDate);
  if (rows.length < minPoints) return null;
  const xs = rows.map(w => daysBetween(from, w.date));
  const ys = rows.map(w => w.kg);
  const n = rows.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let sxx = 0, sxy = 0;
  for (let i = 0; i < n; i++) { sxx += (xs[i] - mx) ** 2; sxy += (xs[i] - mx) * (ys[i] - my); }
  if (sxx === 0) return null; // all entries on one day
  const perDay = sxy / sxx;
  const spanDays = xs[n - 1] - xs[0];
  return { kgPerWk: -perDay * 7, n, spanDays };
}

// Rate at endDate: {kgPerWk, pctPerWk, trendKg, n} or null when there is not enough data.
export function weeklyRate(weights, endDate, windowDays = 14) {
  const s = slope(weights, endDate, windowDays);
  if (!s) return null;
  const rows = clean(weights).filter(w => w.date <= endDate);
  const trendKg = trendWeight(weights, endDate) ?? rows[rows.length - 1].kg;
  return { kgPerWk: s.kgPerWk, pctPerWk: (s.kgPerWk / trendKg) * 100, trendKg, n: s.n, spanDays: s.spanDays };
}

export const TIERS = {
  insufficient: { label: 'Not enough data', kind: '', colour: 'neutral',
    text: 'Log at least 4 weights across 2 weeks to see your weekly rate. The first 2 to 3 weeks often include water weight.' },
  gaining: { label: 'Weight is up', kind: '', colour: 'neutral',
    text: 'Your trend is up over the last 2 weeks. Day-to-day weight moves with water, salt and meals.' },
  slow: { label: 'Slower than 0.2% a week so far', kind: '', colour: 'neutral',
    text: 'The app needs 4 weeks of weights at a steady dose before it says more. Plateaus are common.' },
  below: { label: 'Below trial average', kind: 'info', colour: 'blue',
    text: 'Your average loss is below what the trials saw on average (about 0.2 to 0.3% a week). Plateaus are common. Information only.' },
  typical: { label: 'Typical range', kind: 'ok', colour: 'green',
    text: 'In the range seen in trials and guidelines.' },
  fast: { label: 'Fast: notice', kind: 'warn', colour: 'yellow',
    text: 'Faster than the guideline pace of about 0.9 kg a week. Check that protein, calories and fluids are on target, and how you feel.' },
  warning: { label: 'Warning: very fast', kind: 'danger', colour: 'red',
    text: "Over 1.4 kg a week for 2 weeks or more. Guidance links this pace to a higher risk of gallstones. Contact your prescriber. Don't change your dose on your own. Get urgent care for fainting, severe vomiting or signs of dehydration." },
};

// tier(weights, endDate, tiers, {stillEscalating}) -> {key, ...TIERS[key], rate, note}
export function tier(weights, endDate, tiers = DEFAULT_TIERS, { stillEscalating = false } = {}) {
  const t = { ...DEFAULT_TIERS, ...(tiers || {}) };
  const rate = weeklyRate(weights, endDate);
  const out = key => ({ key, ...TIERS[key], rate, note: '' });
  if (!rate) return out('insufficient');
  if (rate.kgPerWk < 0) return out('gaining');
  if (rate.kgPerWk > WARN_KG) {
    const prev = weeklyRate(weights, addDays(endDate, -7));
    if (prev && prev.kgPerWk > WARN_KG) return out('warning');
    const r = out('fast');
    r.note = 'This week is above 1.4 kg. If next week is too, this becomes a warning.';
    return r;
  }
  if (rate.pctPerWk > t.fastPct || rate.kgPerWk > t.fastKg) return out('fast');
  if (rate.pctPerWk >= t.lowPct) return out('typical');
  // Under the low bound: only call it "below trial average" with 4 weeks of data and a steady dose.
  const long = slope(weights, endDate, 28, MIN_POINTS);
  if (!stillEscalating && long && long.spanDays >= 24) {
    const pct28 = (long.kgPerWk / rate.trendKg) * 100;
    if (pct28 < t.lowPct && long.kgPerWk >= 0) return out('below');
    if (long.kgPerWk < 0) return out('gaining');
    return out('typical');
  }
  return out('slow');
}

// Whole weeks to reach goalKg at the current pace; null when not losing or already there.
export function weeksToGoal(trendKg, goalKg, kgPerWk) {
  if (!Number.isFinite(trendKg) || !Number.isFinite(goalKg) || !Number.isFinite(kgPerWk)) return null;
  if (kgPerWk <= 0 || trendKg <= goalKg) return null;
  return Math.ceil((trendKg - goalKg) / kgPerWk);
}

// Clamp user-edited tier bounds to sane values. The warning bound is not editable.
export function sanitizeTiers(t = {}) {
  const pick = (v, def, lo, hi) => (Number.isFinite(Number(v)) && Number(v) >= lo && Number(v) <= hi ? Number(v) : def);
  const lowPct = pick(t.lowPct, DEFAULT_TIERS.lowPct, 0, 0.5);
  const fastPct = pick(t.fastPct, DEFAULT_TIERS.fastPct, Math.max(lowPct, 0.3), 1.0);
  const fastKg = pick(t.fastKg, DEFAULT_TIERS.fastKg, 0.3, WARN_KG);
  return { lowPct, fastPct, fastKg };
}
