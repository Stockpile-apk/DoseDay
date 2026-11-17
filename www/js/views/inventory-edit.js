// Add / edit form for an inventory item (opens in a sheet).
import { h, btn, field, input, numberInput, select, segmented, sheet, toast, confirmBox, num } from '../ui.js';
import { db } from '../db.js';

export async function editItem(rec, meds, onDone) {
  const it = rec || {};
  let kind = it.kind || 'pen';
  const medSel = select([{ value: '', label: 'Not linked' }, ...meds.map(m => ({ value: m.id, label: m.name || 'Medicine' }))], it.medId || '');
  const label = input({ value: it.label || '', placeholder: 'e.g. Pen 1' });
  const strength = input({ value: it.strength || '', placeholder: 'e.g. 2.5 mg' });
  const unit = select([{ value: 'doses', label: 'Doses' }, { value: 'mg', label: 'mg' }], it.unit || 'doses');
  const total = numberInput({ value: it.total ?? '' });
  const remaining = numberInput({ value: it.remaining ?? '', placeholder: 'Same as total if blank' });
  const opened = input({ type: 'date', value: it.openedDate || '' });
  const mixed = input({ type: 'date', value: it.mixedDate || '' });
  const diluent = numberInput({ value: it.diluentMl ?? '' });
  const after = numberInput({ value: it.discardAfterDays ?? '', min: 0, step: 1 });
  const expiry = input({ type: 'date', value: it.expiry || '' });
  const cost = numberInput({ value: it.costCad ?? '', min: 0 });
  const penBox = h('div', { class: 'stack' }, field('Opened date', opened));
  const vialBox = h('div', { class: 'stack' }, field('Mixed date', mixed), field('Liquid added (mL)', diluent));
  const sync = () => { penBox.classList.toggle('hide', kind !== 'pen'); vialBox.classList.toggle('hide', kind !== 'vial'); };
  sync();
  const err = h('div', { class: 'banner danger hide', role: 'alert' });
  const body = h('div', { class: 'stack' },
    segmented([{ value: 'pen', label: 'Pen' }, { value: 'vial', label: 'Vial' }], kind, v => { kind = v; if (v === 'vial' && unit.value === 'doses' && !rec) unit.value = 'mg'; sync(); }),
    field('Linked medicine (optional)', medSel), field('Label', input_(label)), field('Strength', strength),
    field('Counted in', unit), field('Total', total), field('Remaining', remaining),
    penBox, vialBox,
    field('Discard after (days)', after, 'From your product label or pharmacist. Leave blank if unsure.'),
    field('Expiry date', expiry), field('Cost in CAD (optional)', cost), err);
  function input_(x) { return x; }
  const save = async () => {
    const t = num(total), r = num(remaining);
    const problems = [];
    if (!label.value.trim()) problems.push('Add a label.');
    if (t !== null && t < 0) problems.push('Total cannot be negative.');
    if (r !== null && r < 0) problems.push('Remaining cannot be negative.');
    if (problems.length) { err.textContent = problems.join(' '); err.classList.remove('hide'); return; }
    const d = num(diluent);
    const rec2 = { ...it, kind, medId: medSel.value, label: label.value.trim(), strength: strength.value.trim(), unit: unit.value,
      total: t, remaining: r ?? t, discardAfterDays: num(after), expiry: expiry.value || '', costCad: num(cost),
      openedDate: kind === 'pen' ? (opened.value || '') : (it.openedDate || ''), mixedDate: kind === 'vial' ? (mixed.value || '') : (it.mixedDate || ''),
      diluentMl: kind === 'vial' ? d : (it.diluentMl ?? null) };
    rec2.concMgMl = kind === 'vial' && t && d ? t / d : null;
    await db.put('inventory', rec2);
    s.close(); toast('Saved', 'ok'); onDone();
  };
  const actions = [btn('Cancel', () => s.close()), btn('Save', save, 'primary')];
  if (rec && rec.id) actions.unshift(btn('Delete', async () => {
    if (await confirmBox(`Delete "${it.label || 'this item'}"?`, { okText: 'Delete', danger: true })) { await db.del('inventory', rec.id); s.close(); toast('Deleted'); onDone(); }
  }, 'danger'));
  const s = sheet({ title: rec ? 'Edit item' : 'Add item', body, actions });
}
