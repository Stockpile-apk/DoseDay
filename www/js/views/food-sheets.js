// Sheets for logging food: quick add from a favourite, and manual add / edit.
import { h, btn, field, input, numberInput, checkbox, sheet, toast, num } from '../ui.js';
import { db } from '../db.js';
import { nowTime } from '../dates.js';
import { fmtNum } from './food-common.js';

export function stepper(start = 1) {
  let q = start;
  const out = h('span', { class: 'big', style: { minWidth: '64px', textAlign: 'center' } }, String(q));
  const set = v => { q = Math.max(0.5, v); out.textContent = String(q); };
  const node = h('div', { class: 'row', style: { justifyContent: 'center', gap: '16px' } },
    btn('−', () => set(q - 0.5), '', { 'aria-label': 'Less', style: { minWidth: '56px', minHeight: '56px' } }), out,
    btn('+', () => set(q + 0.5), '', { 'aria-label': 'More', style: { minWidth: '56px', minHeight: '56px' } }));
  return { node, get: () => q };
}

export function quickAddSheet(food, date, done) {
  const st = stepper(1);
  const s = sheet({ title: food.name || 'Food',
    body: h('div', { class: 'stack' },
      h('p', { class: 'muted' }, `Per serving${food.serving ? ' (' + food.serving + ')' : ''}: ${fmtNum(food.kcal)} kcal, ${fmtNum(food.protein)} g protein`),
      field('Servings', st.node)),
    actions: [btn('Cancel', () => s.close()), btn('Add', async () => {
      await db.put('foodLog', { date, time: nowTime(), foodId: food.id, name: food.name, qty: st.get(),
        kcal: Number(food.kcal) || 0, protein: Number(food.protein) || 0, carbs: Number(food.carbs) || 0, fat: Number(food.fat) || 0 });
      s.close(); toast('Added', 'ok'); done();
    }, 'primary')] });
}

// entry: existing foodLog record to edit, or null for new.
export function entrySheet(entry, date, done) {
  const e = entry || {};
  const name = input({ value: e.name || '', placeholder: 'e.g. Chicken wrap' });
  const kcal = numberInput({ value: e.kcal ?? '', min: 0, placeholder: 'kcal per serving' });
  const protein = numberInput({ value: e.protein ?? '', min: 0 });
  const carbs = numberInput({ value: e.carbs ?? '', min: 0 });
  const fat = numberInput({ value: e.fat ?? '', min: 0 });
  const qty = numberInput({ value: e.qty ?? 1, min: 0.5, step: 0.5 });
  const time = input({ type: 'time', value: e.time || nowTime() });
  const fav = checkbox('Save as a favourite', false);
  const err = h('p', { class: 'small', style: { color: 'var(--danger, #b00020)' } });
  const save = async () => {
    const nm = name.value.trim();
    if (!nm) { err.textContent = 'Name is required.'; name.focus(); return; }
    const rec = { ...e, date: e.date || date, time: time.value || nowTime(), name: nm, qty: num(qty) > 0 ? num(qty) : 1,
      kcal: num(kcal) || 0, protein: num(protein) || 0, carbs: num(carbs) || 0, fat: num(fat) || 0 };
    if (fav.querySelector('input').checked) {
      const f = await db.put('foods', { name: nm, kcal: rec.kcal, protein: rec.protein, carbs: rec.carbs, fat: rec.fat, serving: '' });
      rec.foodId = f.id;
    }
    await db.put('foodLog', rec);
    s.close(); toast('Saved', 'ok'); done();
  };
  const s = sheet({ title: entry ? 'Edit entry' : 'Add something else',
    body: h('div', { class: 'stack' }, field('Name', name),
      h('div', { class: 'grid2' }, field('Calories (kcal)', kcal), field('Protein (g)', protein)),
      h('div', { class: 'grid2' }, field('Carbs (g, optional)', carbs), field('Fat (g, optional)', fat)),
      h('div', { class: 'grid2' }, field('Quantity', qty), field('Time', time)),
      entry ? null : fav, err),
    actions: [btn('Cancel', () => s.close()), btn('Save', save, 'primary')] });
}
