// Suggested starting targets. Pure functions: no DOM, no storage.
// Every number comes from the R4 research file (ref_R4_nutrition.json). Do not add numbers without a source.
//   Energy: Health Canada EER equations (issued 2023-12-18), activity categories by PAL.
//   Resting estimate: Mifflin-St Jeor 1990, with ACTUAL body weight.
//   Calorie floors: 2013 AHA/ACC/TOS guideline ranges; under 800 kcal needs medical supervision.
//   Protein: RDA 0.8 g/kg; 1.2-1.6 g/kg proposed during loss (low confidence);
//            80-120 g/day absolute option avoids overestimating with obesity (2025 joint advisory).
//   Water and fibre: Health Canada Adequate Intakes.

export const ACTIVITY = [
  { value: 'inactive', label: 'Inactive', pal: '1.00-1.53' },
  { value: 'low', label: 'Low active', pal: '1.53-1.68' },
  { value: 'active', label: 'Active', pal: '1.68-1.85' },
  { value: 'very', label: 'Very active', pal: '1.85-2.50' },
];

// kcal/day = c0 + cAge*age + cH*heightCm + cW*kg
const EER = {
  male: { inactive: [753.07, -10.83, 6.50, 14.10], low: [581.47, -10.83, 8.30, 14.94], active: [1004.82, -10.83, 6.52, 15.91], very: [-517.88, -10.83, 15.61, 19.11] },
  female: { inactive: [584.90, -7.01, 5.72, 11.71], low: [575.77, -7.01, 6.60, 12.14], active: [710.25, -7.01, 6.54, 12.34], very: [511.83, -7.01, 9.07, 12.56] },
};

export const SOURCES = {
  eer: 'Health Canada, Dietary Reference Intakes: equations to estimate energy requirement',
  mifflin: 'Mifflin MD et al., Am J Clin Nutr 1990 (actual body weight)',
  floors: '2013 AHA/ACC/TOS obesity guideline; under 800 kcal only with medical supervision',
  deficit: '2013 AHA/ACC/TOS obesity guideline: 500 to 750 kcal a day deficit',
  protein: 'Joint advisory on nutrition with GLP-1 therapy (Am J Clin Nutr 2025); Health Canada RDA',
  water: 'Health Canada Adequate Intake for total water (includes food and all drinks)',
  fibre: 'Health Canada Adequate Intake for fibre',
};

export const DEFICIT_MIN = 500, DEFICIT_MAX = 750;

export function ageFrom(birthYear, now = new Date()) {
  const y = Number(birthYear);
  if (!Number.isFinite(y) || y < 1900 || y > now.getFullYear()) return null;
  return now.getFullYear() - y;
}
export function bmi(kg, heightCm) {
  if (!(kg > 0) || !(heightCm > 0)) return null;
  const m = heightCm / 100;
  return kg / (m * m);
}
// Lowest goal weight the app accepts: BMI 18.5.
export function minGoalKg(heightCm) {
  if (!(heightCm > 0)) return null;
  const m = heightCm / 100;
  return 18.5 * m * m;
}
export function eer({ sex, age, heightCm, kg, activity = 'inactive' }) {
  const c = EER[sex] && EER[sex][activity];
  if (!c || !(age >= 19) || !(heightCm > 0) || !(kg > 0)) return null;
  return c[0] + c[1] * age + c[2] * heightCm + c[3] * kg;
}
export function mifflin({ sex, age, heightCm, kg }) {
  if (!(age > 0) || !(heightCm > 0) || !(kg > 0) || (sex !== 'male' && sex !== 'female')) return null;
  return 10 * kg + 6.25 * heightCm - 5 * age + (sex === 'male' ? 5 : -161);
}
// Floors. With sex not given, the higher (safer) floor is used.
export function calorieFloors(sex) {
  return { warn: sex === 'female' ? 1200 : 1500, strong: 800 };
}
// 'ok' | 'warn' (below the floor) | 'strong' (below 800: needs medical supervision)
export function calorieLevel(kcal, sex) {
  const f = calorieFloors(sex);
  if (!(kcal > 0)) return 'ok';
  if (kcal < f.strong) return 'strong';
  if (kcal < f.warn) return 'warn';
  return 'ok';
}

// suggest(profile, currentKg, now) -> suggested targets with source and confidence for each.
// profile: {sex:'male'|'female'|'', birthYear, heightCm, activity, targets:{deficit}}
export function suggest(profile, currentKg, now = new Date()) {
  const sex = profile.sex === 'male' || profile.sex === 'female' ? profile.sex : '';
  const age = ageFrom(profile.birthYear, now);
  const heightCm = Number(profile.heightCm) || null;
  const kg = Number(currentKg) || null;
  const b = bmi(kg, heightCm);
  const missing = [];
  if (!sex) missing.push('sex');
  if (!age) missing.push('birth year');
  if (!heightCm) missing.push('height');
  if (!kg) missing.push('a weight');

  // Calories
  const floors = calorieFloors(sex);
  let calories = { value: null, maintenance: null, resting: null, deficit: null, heldAtFloor: false, floor: floors.warn,
    source: `${SOURCES.eer}. ${SOURCES.deficit}.`, confidence: 'High (equation) / Moderate (deficit)', notes: [] };
  const maint = sex && age && heightCm && kg ? eer({ sex, age, heightCm, kg, activity: profile.activity || 'inactive' }) : null;
  if (maint) {
    let deficit = Number(profile.targets && profile.targets.deficit);
    if (!Number.isFinite(deficit)) deficit = DEFICIT_MIN;
    deficit = Math.min(DEFICIT_MAX, Math.max(0, deficit));
    let value = maint - deficit;
    let held = false;
    if (value < floors.warn) { value = floors.warn; held = true; }
    calories = { ...calories, value: Math.round(value / 10) * 10, maintenance: Math.round(maint), deficit, heldAtFloor: held,
      resting: Math.round(mifflin({ sex, age, heightCm, kg })) };
    calories.notes.push('An estimate, not a measurement. Health Canada has no separate adult equation for obesity.');
    if (held) calories.notes.push(`Held at the ${floors.warn} kcal floor.`);
  } else if (age !== null && age < 19) calories.notes.push('These equations are for adults 19 and over.');

  // Protein
  let protein;
  if (b !== null && b >= 30) {
    protein = { value: 100, low: 80, high: 120, basis: 'absolute', confidence: 'Moderate',
      note: 'With a BMI of 30 or more, grams per kg of actual weight can overestimate needs, so an absolute range is used.' };
  } else if (kg) {
    protein = { value: Math.round(1.4 * kg), low: Math.round(1.2 * kg), high: Math.round(1.6 * kg), basis: 'perKg', confidence: 'Low',
      note: 'An expert proposal of 1.2 to 1.6 g per kg a day during weight loss; not a formal recommendation.' };
  } else {
    protein = { value: null, low: null, high: null, basis: 'none', confidence: '', note: '' };
  }
  protein.rdaG = kg ? Math.round(0.8 * kg) : null;
  protein.source = SOURCES.protein;

  // Water (total water, includes food and all drinks) and fibre
  const waterMl = sex === 'male' ? 3700 : 2700;
  const water = { value: waterMl, source: SOURCES.water, confidence: 'High',
    note: 'Total water from food and all drinks. No GLP-1-specific target was found.' + (sex ? '' : ' Shown for women until sex is set (men: 3,700 mL).') };
  const older = age !== null && age >= 51;
  const fibreG = sex === 'male' ? (older ? 30 : 38) : (older ? 21 : 25);
  const fibre = { value: fibreG, source: SOURCES.fibre, confidence: 'High', note: sex ? '' : 'Shown for women until sex is set.' };

  return { missing, bmi: b, age, calories, protein, water, fibre, minGoalKg: minGoalKg(heightCm) };
}

// Targets actually in use: the user's own numbers win over the suggestions.
export function effective(profile, suggestion) {
  const o = (profile && profile.targets) || {};
  const pick = (own, sug) => (Number.isFinite(Number(own)) && Number(own) > 0 ? Number(own) : sug);
  return {
    kcal: pick(o.kcal, suggestion.calories.value),
    proteinG: pick(o.proteinG, suggestion.protein.value),
    waterMl: pick(o.waterMl, suggestion.water.value),
    fibreG: pick(o.fibreG, suggestion.fibre.value),
  };
}
