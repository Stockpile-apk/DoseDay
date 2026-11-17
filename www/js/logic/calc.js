// Reconstitution and syringe math on numbers the user typed. Pure functions.
// Math only. It never suggests a dose.
//   concentration (mg/mL) = mg in vial / mL of diluent
//   mL to draw            = dose (mg) / concentration
//   units on a U-100 syringe = mL x 100

const pos = v => Number.isFinite(Number(v)) && Number(v) > 0;
export const toMg = (dose, unit) => (unit === 'mcg' ? Number(dose) / 1000 : Number(dose));

// reconstitute({vialMg, diluentMl, dose, doseUnit:'mg'|'mcg', syringeMl:1})
// -> {ok, errors[], warnings[], concMgMl, doseMg, drawMl, units, dosesPerVial, formulas[]}
export function reconstitute({ vialMg, diluentMl, dose, doseUnit, syringeMl = 1 }) {
  const errors = [], warnings = [];
  if (!pos(vialMg)) errors.push('Enter the amount in the vial (mg).');
  if (!pos(diluentMl)) errors.push('Enter how much liquid was added (mL).');
  if (!pos(dose)) errors.push('Enter the dose.');
  if (doseUnit !== 'mg' && doseUnit !== 'mcg') errors.push('Choose mg or mcg for the dose.');
  if (errors.length) return { ok: false, errors, warnings };

  const V = Number(vialMg), D = Number(diluentMl), doseMg = toMg(dose, doseUnit);
  const concMgMl = V / D;
  const drawMl = doseMg / concMgMl;
  const units = drawMl * 100;
  const dosesPerVial = V / doseMg;

  if (doseMg > V) errors.push('The dose is more than the whole vial holds. Check mg and mcg.');
  if (units > syringeMl * 100) warnings.push(`This is ${fmt(units, 1)} units, more than a ${syringeMl} mL U-100 syringe holds.`);
  if (units < 5 && units > 0) warnings.push('Under about 5 units is hard to read accurately on a U-100 syringe. More diluent makes small doses easier to measure.');
  if (units >= 5 && units < 10) warnings.push('Amounts between 10 and 50 units are easier to measure.');
  if (D > 10) warnings.push('More than 10 mL of diluent is unusual. Check the number.');
  if (D < 0.2) warnings.push('Less than 0.2 mL of diluent is unusual. Check the number.');
  if (V > 500) warnings.push('More than 500 mg in one vial is unusual. Check mg and mcg.');
  if (doseUnit === 'mg' && Number(dose) >= 100) warnings.push('A dose of 100 mg or more is unusual for an injection of this kind. Did you mean mcg?');
  if (doseUnit === 'mcg' && Number(dose) < 1) warnings.push('A dose under 1 mcg is unusual. Did you mean mg?');

  const formulas = [
    `Concentration = ${fmt(V)} mg ÷ ${fmt(D)} mL = ${fmt(concMgMl, 3)} mg/mL`,
    `mL to draw = ${fmt(doseMg, 4)} mg ÷ ${fmt(concMgMl, 3)} mg/mL = ${fmt(drawMl, 3)} mL`,
    `Units (U-100) = ${fmt(drawMl, 3)} mL × 100 = ${fmt(units, 1)} units`,
  ];
  return { ok: errors.length === 0, errors, warnings, concMgMl, doseMg, drawMl, units, dosesPerVial, formulas };
}

// Reverse: units drawn -> dose. {vialMg, diluentMl, units}
export function unitsToDose({ vialMg, diluentMl, units }) {
  const errors = [];
  if (!pos(vialMg)) errors.push('Enter the amount in the vial (mg).');
  if (!pos(diluentMl)) errors.push('Enter how much liquid was added (mL).');
  if (!pos(units)) errors.push('Enter the units drawn.');
  if (errors.length) return { ok: false, errors, warnings: [] };
  const concMgMl = Number(vialMg) / Number(diluentMl);
  const drawMl = Number(units) / 100;
  const doseMg = drawMl * concMgMl;
  const warnings = [];
  if (drawMl > Number(diluentMl)) warnings.push('That is more liquid than was added to the vial.');
  return { ok: true, errors, warnings, concMgMl, drawMl, doseMg, doseMcg: doseMg * 1000,
    formulas: [`Concentration = ${fmt(Number(vialMg))} mg ÷ ${fmt(Number(diluentMl))} mL = ${fmt(concMgMl, 3)} mg/mL`,
      `Dose = ${fmt(drawMl, 3)} mL × ${fmt(concMgMl, 3)} mg/mL = ${fmt(doseMg, 4)} mg`] };
}

// How long a vial lasts: {vialMg, doseMg, dosesPerWeek} -> {doses, days}
export function vialLife({ vialMg, doseMg, dosesPerWeek }) {
  if (!pos(vialMg) || !pos(doseMg)) return null;
  const doses = Math.floor(Number(vialMg) / Number(doseMg) + 1e-9);
  const days = pos(dosesPerWeek) ? Math.floor((doses / Number(dosesPerWeek)) * 7) : null;
  return { doses, days };
}

// Tidy number: up to dp decimals, no trailing zeros.
export function fmt(n, dp = 2) {
  if (!Number.isFinite(Number(n))) return '—';
  return String(Number(Number(n).toFixed(dp)));
}
