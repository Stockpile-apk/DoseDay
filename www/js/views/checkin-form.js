// Check-in form (new and edit).
import { h, btn, card, field, input, numberInput, num, toast, banner } from '../ui.js';
import { db, getProfile } from '../db.js';
import { todayISO } from '../dates.js';
import { toKg, fromKg } from '../units.js';
import { takePhoto, resizeImage } from '../platform.js';
import { POSES, FLAGS, poseLabel, unitsOf, urlFor, syncWeight } from './checkin-shared.js';

function chips(options, selected, multi, onChange) {
  const wrap = h('div', { class: 'chips' });
  const draw = () => [...wrap.children].forEach(c => {
    const on = selected.has(c.dataset.v); c.classList.toggle('on', on); c.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
  for (const o of options) {
    wrap.append(h('button', { type: 'button', class: 'chip', dataset: { v: String(o) }, style: { minHeight: '48px' }, onclick: () => {
      const k = String(o);
      if (selected.has(k)) selected.delete(k); else { if (!multi) selected.clear(); selected.add(k); }
      draw(); onChange && onChange();
    } }, String(o)));
  }
  draw();
  return wrap;
}

export async function renderForm(root, ctx, id) {
  const profile = (await getProfile()) || {};
  const units = unitsOf(profile);
  const old = id ? await db.get('checkins', id) : null;
  if (id && !old) { root.append(banner('warn', 'Not found', 'That check-in no longer exists.'), btn('Back to check-ins', () => ctx.go('#/checkin'))); return; }
  ctx.setTitle(old ? 'Edit check-in' : 'New check-in');

  // photos: pose -> {blob, id?}
  const photos = {};
  if (old) for (const pid of old.photoIds || []) { const p = await db.get('photos', pid); if (p && p.blob) photos[p.pose] = { blob: p.blob, id: p.id }; }
  const removedIds = [];

  const date = input({ type: 'date', value: old ? old.date : todayISO() });
  const wv = old ? fromKg(old.weightKg, units) : (units === 'st' ? { st: '', lb: '' } : '');
  const kgBox = units !== 'st' ? numberInput({ value: wv, placeholder: units, 'aria-label': `Weight in ${units}` }) : null;
  const stBox = units === 'st' ? numberInput({ value: wv.st, placeholder: 'st', 'aria-label': 'Weight, stone' }) : null;
  const lbBox = units === 'st' ? numberInput({ value: wv.lb, placeholder: 'lb', 'aria-label': 'Weight, pounds' }) : null;
  const err = h('div', { class: 'hide' });
  const showErr = msg => { err.replaceChildren(banner('danger', 'Cannot save yet', msg)); err.className = ''; err.scrollIntoView({ block: 'center' }); };

  const opt = v => (Number.isFinite(v) ? v : '');
  const waist = numberInput({ value: opt(old && old.waistCm), placeholder: 'cm', 'aria-label': 'Waist in cm' });
  const hips = numberInput({ value: opt(old && old.hipsCm), placeholder: 'cm', 'aria-label': 'Hips in cm' });
  const chest = numberInput({ value: opt(old && old.chestCm), placeholder: 'cm', 'aria-label': 'Chest in cm' });
  const sleep = numberInput({ value: opt(old && old.sleepH), placeholder: 'hours', 'aria-label': 'Sleep in hours' });
  const energy = new Set(old && old.energy ? [String(old.energy)] : []);
  const hunger = new Set(old && old.hunger ? [String(old.hunger)] : []);
  const flags = new Set((old && old.flags) || []);
  const note = h('textarea', { rows: 3, 'aria-label': 'Note' }, (old && old.note) || '');

  const photoBox = h('div', { class: 'stack' });
  const drawPhotos = () => photoBox.replaceChildren(...POSES.map(p => {
    const cur = photos[p.value];
    const pick = async () => {
      let file; try { file = await takePhoto(); } catch { file = null; }
      if (!file) return;
      try { const blob = await resizeImage(file, 1280, 0.8); if (!blob) throw new Error('no blob');
        if (photos[p.value] && photos[p.value].id) removedIds.push(photos[p.value].id);
        photos[p.value] = { blob }; drawPhotos();
      } catch { toast('That photo could not be read. Try another one.', 'warn'); }
    };
    return h('div', { class: 'row', style: { gap: '12px' } },
      cur ? h('img', { src: urlFor(cur.blob), alt: p.label + ' photo', style: { width: '60px', height: '80px', objectFit: 'cover', borderRadius: '8px' } }) : null,
      h('div', { class: 'grow' }, btn(cur ? `Retake ${p.label}` : `Add ${p.label} photo`, pick, 'block')),
      cur ? btn('Remove', () => { if (cur.id) removedIds.push(cur.id); delete photos[p.value]; drawPhotos(); }, 'small', { 'aria-label': `Remove ${p.label} photo` }) : null);
  }));
  drawPhotos();

  async function save() {
    const kg = units === 'st' ? toKg({ st: stBox.value, lb: lbBox.value }, 'st') : toKg(num(kgBox), units);
    if (!date.value) return showErr('Pick a date.');
    if (kg === null) return showErr('Enter your weight. A check-in cannot be saved without it.');
    if (kg < 25 || kg > 400) return showErr('That weight looks wrong. It must be between 25 kg and 400 kg.');
    const body = {
      id: old ? old.id : undefined, date: date.value, weightKg: Math.round(kg * 100) / 100,
      waistCm: num(waist), hipsCm: num(hips), chestCm: num(chest),
      energy: energy.size ? Number([...energy][0]) : null, hunger: hunger.size ? Number([...hunger][0]) : null,
      sleepH: num(sleep), flags: FLAGS.filter(f => flags.has(f)), note: note.value.trim(), photoIds: [],
    };
    const ci = await db.put('checkins', body);
    for (const pid of removedIds) await db.del('photos', pid);
    const ids = [];
    for (const p of POSES) {
      const cur = photos[p.value]; if (!cur) continue;
      const rec = await db.put('photos', { id: cur.id, checkinId: ci.id, date: ci.date, pose: p.value, blob: cur.blob });
      ids.push(rec.id);
    }
    ci.photoIds = ids; await db.put('checkins', ci);
    await syncWeight(ci);
    toast('Check-in saved', 'ok');
    ctx.go('#/checkin/view/' + ci.id);
  }

  root.append(
    card('Date and weight', field('Date', date),
      units === 'st' ? h('div', { class: 'grid2' }, field('Weight (st) *', stBox), field('Weight (lb)', lbBox)) : field(`Weight (${units}) *`, kgBox, 'Required')),
    err,
    card('Photos (optional)', photoBox, h('p', { class: 'small muted' }, 'Photos stay on this device.')),
    card('Measurements (optional)', h('div', { class: 'grid2' }, field('Waist (cm)', waist), field('Hips (cm)', hips)), field('Chest (cm)', chest)),
    card('How you feel (optional)',
      h('div', { class: 'stack' }, h('strong', 'Energy (1 low, 5 high)'), chips([1, 2, 3, 4, 5], energy, false),
        h('strong', 'Hunger (1 low, 5 high)'), chips([1, 2, 3, 4, 5], hunger, false)), field('Sleep (hours a night)', sleep)),
    card('Side effects this week (optional)', chips(FLAGS, flags, true)),
    card('Note (optional)', note),
    btn('Save check-in', save, 'primary block'),
    btn('Cancel', () => ctx.go(old ? '#/checkin/view/' + old.id : '#/checkin'), 'ghost block'));
}
