// Favourites tab.
import { h, btn, field, input, numberInput, item, empty, sheet, toast, confirmBox, num } from '../ui.js';
import { db } from '../db.js';
import { fmtNum } from './food-common.js';

export function favSheet(food, done) {
  const f = food || {};
  const name = input({ value: f.name || '' });
  const serving = input({ value: f.serving || '', placeholder: 'e.g. 175 g or 1 cup' });
  const kcal = numberInput({ value: f.kcal ?? '', min: 0 });
  const protein = numberInput({ value: f.protein ?? '', min: 0 });
  const carbs = numberInput({ value: f.carbs ?? '', min: 0 });
  const fat = numberInput({ value: f.fat ?? '', min: 0 });
  const err = h('p', { class: 'small' });
  const s = sheet({ title: food ? 'Edit favourite' : 'New favourite',
    body: h('div', { class: 'stack' }, field('Name', name), field('Serving size (optional)', serving),
      h('div', { class: 'grid2' }, field('Calories per serving', kcal), field('Protein g per serving', protein)),
      h('div', { class: 'grid2' }, field('Carbs g (optional)', carbs), field('Fat g (optional)', fat)), err),
    actions: [
      food ? btn('Delete', async () => { if (await confirmBox('Delete this favourite? Logged entries stay.', { okText: 'Delete', danger: true })) { await db.del('foods', f.id); s.close(); done(); } }, 'danger') : null,
      btn('Save', async () => {
        if (!name.value.trim()) { err.textContent = 'Name is required.'; return; }
        await db.put('foods', { ...f, name: name.value.trim(), serving: serving.value.trim(), kcal: num(kcal) || 0, protein: num(protein) || 0, carbs: num(carbs) || 0, fat: num(fat) || 0 });
        s.close(); toast('Saved', 'ok'); done();
      }, 'primary')].filter(Boolean) });
}

export async function renderFavs(root, ctx) {
  const foods = (await db.all('foods')).sort((a, b) => String(a.name).localeCompare(String(b.name)));
  const add = () => favSheet(null, () => ctx.refresh());
  root.append(btn('Add a favourite', add, 'primary block'));
  if (!foods.length) { root.append(empty('No favourites yet. Add foods you eat often to log them in one tap.')); return; }
  root.append(h('div', { class: 'list' }, foods.map(f => item({ title: f.name || 'Unnamed',
    sub: `${fmtNum(f.kcal)} kcal, ${fmtNum(f.protein)} g protein${f.serving ? ' per ' + f.serving : ' per serving'}`,
    onClick: () => favSheet(f, () => ctx.refresh()) }))));
}
