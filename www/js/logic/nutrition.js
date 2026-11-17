// Food, water and supplement maths. Pure functions.
// DRI numbers come from www/data/targets.json (built from the R4 research). Nothing is hard-coded here.

export function dayTotals(entries) {
  const t = { kcal: 0, protein: 0, carbs: 0, fat: 0, count: 0 };
  for (const e of entries || []) {
    const q = Number.isFinite(Number(e.qty)) && Number(e.qty) > 0 ? Number(e.qty) : 1;
    t.kcal += (Number(e.kcal) || 0) * q;
    t.protein += (Number(e.protein) || 0) * q;
    t.carbs += (Number(e.carbs) || 0) * q;
    t.fat += (Number(e.fat) || 0) * q;
    t.count++;
  }
  return t;
}
export function waterTotal(entries) { return (entries || []).reduce((s, e) => s + (Number(e.ml) || 0), 0); }

// Averages over the dates that have at least one entry. logsByDate: {'YYYY-MM-DD': entries[]}
export function weekSummary(logsByDate, targets = {}) {
  const days = Object.keys(logsByDate || {}).filter(d => (logsByDate[d] || []).length);
  if (!days.length) return { days: 0, avgKcal: null, avgProtein: null, proteinDaysMet: 0 };
  let kcal = 0, protein = 0, met = 0;
  for (const d of days) {
    const t = dayTotals(logsByDate[d]);
    kcal += t.kcal; protein += t.protein;
    if (targets.proteinG && t.protein >= targets.proteinG) met++;
  }
  return { days: days.length, avgKcal: Math.round(kcal / days.length), avgProtein: Math.round(protein / days.length), proteinDaysMet: met };
}

// Reference value for one nutrient row from targets.json `dri` list, for this sex and age.
// row: {key, name, unit, kind:'RDA'|'AI', men, women, ul, ulNote}. men/women/ul are either a number,
// null, or age steps [[fromAge, value], ...] (the last step whose fromAge <= age applies).
function pickAge(steps, age) {
  if (steps === null || steps === undefined) return null;
  if (!Array.isArray(steps)) return steps;
  let v = steps[0][1];
  for (const [from, val] of steps) if (Number(age) >= from) v = val;
  return v;
}
export function driFor(row, sex, age) {
  return { value: pickAge(sex === 'female' ? row.women : row.men, age), ul: pickAge(row.ul, age), kind: row.kind, unit: row.unit, ulNote: row.ulNote || '' };
}

// Compare the day's supplement amounts with the upper limits.
// supplements: [{nutrientKey, amount}] (amount per day, in the DRI unit). Returns rows above their UL.
export function overUpperLimit(supplements, dri, sex, age) {
  const totals = new Map();
  for (const s of supplements || []) {
    if (!s.nutrientKey || !(Number(s.amount) > 0)) continue;
    totals.set(s.nutrientKey, (totals.get(s.nutrientKey) || 0) + Number(s.amount));
  }
  const out = [];
  for (const row of dri || []) {
    const total = totals.get(row.key);
    if (!total) continue;
    const ref = driFor(row, sex, age);
    if (ref.ul !== null && total > ref.ul) out.push({ key: row.key, name: row.name, unit: row.unit, total, ul: ref.ul, ulNote: ref.ulNote });
  }
  return out;
}
