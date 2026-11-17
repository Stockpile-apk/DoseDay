// Profile, suggested targets (with sources) and the alert-tier bounds.
import { h, btn, card, banner, field, numberInput, select, kv, toast, fold, num, infoLine, sectionTitle } from '../ui.js';
import { db, getProfile, saveProfile } from '../db.js';
import { UNIT_OPTIONS, fmtWeight, fmtDelta, cmToFtIn } from '../units.js';
import { ACTIVITY, suggest, effective, calorieFloors, calorieLevel, DEFICIT_MIN, DEFICIT_MAX } from '../logic/targets.js';
import { clean, sanitizeTiers, DEFAULT_TIERS, WARN_KG } from '../logic/rate.js';
import { weightInput, validKg } from './weight.js';

export async function latestKg(profile) {
  const ws = clean(await db.all('weights'));
  return ws.length ? ws[ws.length - 1].kg : (Number(profile.startKg) || null);
}

export async function render(root, ctx) {
  const p = await getProfile();
  const units = p.units || 'kg';
  const kgNow = await latestKg(p);

  // ---- About you ----
  const sex = select([{ value: '', label: 'Prefer not to say' }, { value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }], p.sex);
  const birth = numberInput({ value: p.birthYear ?? '', placeholder: 'e.g. 1990', min: 1900, max: new Date().getFullYear(), step: 1, inputmode: 'numeric' });
  const height = numberInput({ value: p.heightCm ?? '', placeholder: 'cm', min: 100, max: 250 });
  const heightHint = h('span', { class: 'hint' });
  const showFt = () => { const v = num(height); heightHint.textContent = v ? `${cmToFtIn(v).ft} ft ${cmToFtIn(v).inch} in` : '6 ft 3 in is 190.5 cm'; };
  height.addEventListener('input', showFt); showFt();
  const unitSel = select(UNIT_OPTIONS, units);
  const act = select(ACTIVITY.map(a => ({ value: a.value, label: `${a.label} (PAL ${a.pal})` })), p.activity || 'inactive');
  const start = weightInput(units, p.startKg);
  const goal = weightInput(units, p.goalKg);

  const saveAbout = async () => {
    const hCm = num(height), by = num(birth);
    const startKg = start.read(), goalKg = goal.read();
    if (by !== null && (by < 1900 || by > new Date().getFullYear())) return toast('Check the birth year.', 'warn');
    if (hCm !== null && (hCm < 100 || hCm > 250)) return toast('Height should be in centimetres, between 100 and 250.', 'warn');
    if (startKg !== null && !validKg(startKg)) return toast('Check the starting weight.', 'warn');
    if (goalKg !== null) {
      if (!validKg(goalKg)) return toast('Check the goal weight.', 'warn');
      if (hCm) {
        const min = 18.5 * (hCm / 100) ** 2;
        if (goalKg < min) return toast(`Goal is under a BMI of 18.5 for your height. The lowest goal the app accepts is ${fmtWeight(min, unitSel.value)}.`, 'warn', 6000);
      }
    }
    await saveProfile({ sex: sex.value, birthYear: by, heightCm: hCm, units: unitSel.value, activity: act.value, startKg, goalKg });
    toast('Profile saved', 'ok');
    ctx.refresh();
  };
  root.append(card('About you',
    h('div', { class: 'grid2' }, field('Sex (used for calorie and nutrient tables)', sex), field('Birth year', birth)),
    h('div', { class: 'grid2' }, h('label', { class: 'field' }, h('span', 'Height (cm)'), height, heightHint), field('Weight units', unitSel)),
    h('div', { class: 'grid2' }, field('Starting weight', start.el), field('Goal weight', goal.el)),
    field('Usual activity (Health Canada categories)', act, 'Inactive: daily living only. Low active: about 30 to 60 minutes of moderate activity a day. Active: an hour or more.'),
    btn('Save profile', saveAbout, 'primary block')));

  // ---- Suggested targets ----
  const s = suggest(p, kgNow);
  const eff = effective(p, s);
  const own = p.targets || {};
  const tcard = card('Suggested starting targets');
  if (s.missing.length) tcard.append(banner('info', 'Add a few details for a full estimate', `Missing: ${s.missing.join(', ')}.`));
  const c = s.calories;
  if (c.value) {
    tcard.append(sectionTitle('Calories'),
      kv('Suggested', `${c.value.toLocaleString('en-CA')} kcal a day`),
      kv('Estimated daily need', `${c.maintenance.toLocaleString('en-CA')} kcal`),
      kv('Deficit used', `${c.deficit} kcal a day`),
      kv('Resting estimate (Mifflin-St Jeor)', `${c.resting.toLocaleString('en-CA')} kcal`),
      kv('Floor', `${c.floor.toLocaleString('en-CA')} kcal (strong warning under 800)`),
      ...c.notes.map(n => h('p', { class: 'source' }, n)),
      h('p', { class: 'source' }, `Source: ${c.source} Confidence: ${c.confidence}.`));
  }
  if (s.protein.value) {
    tcard.append(sectionTitle('Protein'),
      kv('Suggested', `${s.protein.value} g a day (range ${s.protein.low} to ${s.protein.high} g)`),
      s.protein.rdaG ? kv('RDA minimum (0.8 g per kg)', `${s.protein.rdaG} g${s.bmi >= 30 ? ' (actual weight can overestimate)' : ''}`) : null,
      h('p', { class: 'source' }, `${s.protein.note} Source: ${s.protein.source}. Confidence: ${s.protein.confidence}.`));
  }
  tcard.append(sectionTitle('Water and fibre'),
    kv('Total water', `${s.water.value.toLocaleString('en-CA')} mL a day`),
    h('p', { class: 'source' }, `${s.water.note} Source: ${s.water.source}. Confidence: ${s.water.confidence}.`),
    kv('Fibre', `${s.fibre.value} g a day`),
    h('p', { class: 'source' }, `${s.fibre.note} Source: ${s.fibre.source}. Confidence: ${s.fibre.confidence}.`));
  if (s.bmi) tcard.append(kv('BMI now', s.bmi.toFixed(1)));
  root.append(tcard);

  // ---- Your own targets ----
  const kcalIn = numberInput({ value: own.kcal ?? '', placeholder: c.value ? String(c.value) : 'kcal', min: 0, step: 10 });
  const protIn = numberInput({ value: own.proteinG ?? '', placeholder: s.protein.value ? String(s.protein.value) : 'g', min: 0 });
  const waterIn = numberInput({ value: own.waterMl ?? '', placeholder: String(s.water.value), min: 0, step: 50 });
  const fibreIn = numberInput({ value: own.fibreG ?? '', placeholder: String(s.fibre.value), min: 0 });
  const defSel = select([{ value: 500, label: '500 kcal (default)' }, { value: 600, label: '600 kcal' }, { value: 750, label: '750 kcal' }, { value: 0, label: 'No deficit (maintain)' }],
    Number.isFinite(Number(own.deficit)) ? Math.min(DEFICIT_MAX, Math.max(0, Number(own.deficit))) : DEFICIT_MIN);
  const floorNote = h('div');
  const showFloor = () => {
    const v = num(kcalIn);
    const lvl = v ? calorieLevel(v, p.sex) : 'ok';
    const f = calorieFloors(p.sex);
    floorNote.replaceChildren(lvl === 'strong'
      ? banner('danger', 'Under 800 kcal a day', 'Guidelines say intake this low needs medical supervision. Talk to your prescriber before using a target like this.')
      : lvl === 'warn' ? banner('warn', `Under ${f.warn.toLocaleString('en-CA')} kcal a day`, 'This is below the usual lower range in the guideline. The risk of missing nutrients goes up at low intakes.') : '');
  };
  kcalIn.addEventListener('input', showFloor); showFloor();
  const saveTargets = async () => {
    const t = { kcal: num(kcalIn), proteinG: num(protIn), waterMl: num(waterIn), fibreG: num(fibreIn), deficit: Number(defSel.value) };
    for (const k of Object.keys(t)) if (t[k] === null) delete t[k];
    await saveProfile({ targets: t });
    toast('Targets saved', 'ok');
    ctx.refresh();
  };
  root.append(card('Your targets',
    h('p', { class: 'muted small' }, 'Leave a box empty to use the suggestion. Your own numbers always win.'),
    kv('In use now', `${eff.kcal ? eff.kcal.toLocaleString('en-CA') + ' kcal' : 'no calorie target'} · ${eff.proteinG ?? '?'} g protein · ${eff.waterMl} mL water · ${eff.fibreG} g fibre`),
    h('div', { class: 'grid2' }, field('Calories (kcal)', kcalIn), field('Protein (g)', protIn)),
    floorNote,
    h('div', { class: 'grid2' }, field('Water (mL)', waterIn), field('Fibre (g)', fibreIn)),
    field('Calorie deficit for the suggestion', defSel, 'The guideline range is 500 to 750 kcal a day.'),
    btn('Save targets', saveTargets, 'primary block')));

  // ---- Alert tiers ----
  const lowIn = numberInput({ value: p.tiers.lowPct, min: 0, max: 0.5, step: 0.05 });
  const fastIn = numberInput({ value: p.tiers.fastPct, min: 0.3, max: 1, step: 0.05 });
  const fastKgIn = numberInput({ value: p.tiers.fastKg, min: 0.3, max: WARN_KG, step: 0.1 });
  const saveTiers = async () => {
    const t = sanitizeTiers({ lowPct: num(lowIn), fastPct: num(fastIn), fastKg: num(fastKgIn) });
    await saveProfile({ tiers: t });
    toast('Alert bounds saved', 'ok');
    ctx.refresh();
  };
  root.append(fold('Weight-loss alert bounds',
    h('p', { class: 'muted small' }, 'Defaults come from trial averages and guideline pace. The app never suggests changing a dose at any tier.'),
    h('div', { class: 'grid2' }, field('Typical from (% a week)', lowIn), field('Fast above (% a week)', fastIn)),
    field('Fast above (kg a week)', fastKgIn),
    kv('Warning (cannot be changed)', `over ${WARN_KG} kg (${fmtDelta(WARN_KG, 'lb', 1)}) a week for 2 weeks or more`),
    h('div', { class: 'row' }, btn('Save bounds', saveTiers, 'primary'),
      btn('Use defaults', async () => { await saveProfile({ tiers: { ...DEFAULT_TIERS } }); toast('Defaults restored', 'ok'); ctx.refresh(); })),
    h('p', { class: 'source' }, 'Sources: NIH guidance on dieting and gallstones (0.5 to 2 lb a week; over 3 lb a week raises gallstone risk); semaglutide and tirzepatide trial averages of about 0.2 to 0.3% a week. See Library, Nutrition, weight-loss rate.')));

  root.append(h('a', { class: 'btn block', href: '#/library/topic/weight-loss-rate' }, 'Where these numbers come from'));
  root.append(infoLine());
}
