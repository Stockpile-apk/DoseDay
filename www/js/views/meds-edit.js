import { h, btn, card, field, input, numberInput, select, kv, empty, toast, confirmBox, num, infoLine } from '../ui.js';
import { db } from '../db.js';
import { SCHEDULE_TYPES } from '../logic/schedule.js';
import { todayISO, WEEKDAYS, parseISODate } from '../dates.js';
import { loadRef, refName, statusBadge } from './meds-common.js';

const ROUTES = ['subcutaneous', 'intramuscular', 'oral', 'nasal', 'topical', 'other'];
const UNITS = ['mg', 'mcg', 'mL', 'units', 'IU', 'tablets'];
const lines = v => (Array.isArray(v) ? v : []).map(x => (x && typeof x === 'object' ? Object.values(x).join(': ') : String(x)));

function refCard(e) {
  const m = e.missedDose || {}, st = e.storage || {};
  return card('From the reference library (not filled in for you)',
    h('div', { class: 'stack' }, h('div', {}, statusBadge(e.status)),
      m.text ? kv('Missed dose (as listed)', m.text) : null, st.unopened ? kv('Storage, unopened', st.unopened) : null,
      st.inUse ? kv('Storage, in use', st.inUse) : null, h('a', { href: '#/library/' + e.id }, 'Open the library entry')));
}

export async function renderEdit(root, ctx) {
  const id = ctx.path[0] === 'edit' ? ctx.path[1] : null;
  const old = id ? await db.get('meds', id) : null;
  if (id && !old) { root.append(empty('Medicine not found.', btn('Back', () => ctx.go('#/meds')))); return; }
  const med = old || { active: true, route: 'subcutaneous', schedule: { type: 'weekly', time: '09:00', start: todayISO(), weekdays: [] }, titration: [], missed: {} };
  const s = med.schedule || {}, ms = med.missed || {};
  ctx.setTitle(old ? 'Edit medicine' : 'New medicine'); ctx.setAction(null);
  const refs = await loadRef();
  const name = input({ value: med.name || '' }), cls = input({ value: med.class || '' });
  const route = select(ROUTES, med.route || 'subcutaneous');
  const strength = numberInput({ value: med.strength ?? '' }), sUnit = select(UNITS, med.strengthUnit || 'mg');
  const dose = numberInput({ value: med.dose ?? '', placeholder: 'Type your dose' }), dUnit = select(UNITS, med.doseUnit || 'mg');
  const type = select(SCHEDULE_TYPES, s.type || 'weekly');
  let days = (s.weekdays || []).map(Number);
  const dayBox = h('div', { class: 'chips' });
  const nField = numberInput({ value: s.everyN ?? 2, min: 1, step: 1 });
  const time = input({ type: 'time', value: s.time || '09:00' }), start = input({ type: 'date', value: s.start || todayISO() }), end = input({ type: 'date', value: s.end || '' });
  const nWrap = field('Every how many days', nField), dWrap = h('div', {}, field('Days', dayBox));
  const syncType = () => {
    const t = type.value;
    nWrap.style.display = t === 'everyN' ? '' : 'none'; dWrap.style.display = t === 'weekly' || t === 'custom' ? '' : 'none';
    if (t === 'weekly' && days.length > 1) days = days.slice(0, 1);
    dayBox.replaceChildren(...WEEKDAYS.map((w, i) => h('button', { type: 'button', class: 'chip' + (days.includes(i) ? ' on' : ''), onclick: () => {
      days = t === 'weekly' ? [i] : days.includes(i) ? days.filter(x => x !== i) : [...days, i]; syncType(); } }, w)));
  };
  type.addEventListener('change', syncType); syncType();
  let tit = (med.titration || []).map(t => ({ ...t }));
  const titBox = h('div', { class: 'stack' });
  const drawTit = () => titBox.replaceChildren(...tit.map((t, i) => h('div', { class: 'row' },
    input({ type: 'date', value: t.from || '', 'aria-label': 'From date', onchange: e => { t.from = e.target.value; } }),
    numberInput({ value: t.dose ?? '', placeholder: 'Dose', 'aria-label': 'Dose', onchange: e => { t.dose = num(e.target); } }),
    btn('Remove', () => { tit.splice(i, 1); drawTit(); }, 'small'))));
  drawTit();
  const win = numberInput({ value: ms.windowHours ?? '' }), before = numberInput({ value: ms.minHoursBeforeNextDose ?? '' }), between = numberInput({ value: ms.minHoursBetweenDoses ?? '' });
  const notes = h('textarea', { rows: 3, value: med.notes || '' });
  const refSel = select([{ value: '', label: 'None' }, ...refs.map(e => ({ value: e.id, label: refName(e) }))], med.refId || '');
  const refHost = h('div');
  const drawRef = () => { const e = refs.find(x => x.id === refSel.value); refHost.replaceChildren(...(e ? [refCard(e)] : [])); };
  refSel.addEventListener('change', drawRef); drawRef();

  const save = async () => {
    if (!name.value.trim()) return toast('A name is required', 'warn');
    if (end.value && start.value && end.value < start.value) return toast('End date is before the start date', 'warn');
    if (type.value === 'weekly' && !days.length) days = [parseISODate(start.value || todayISO()).getDay()];
    if (type.value === 'custom' && !days.length) return toast('Choose at least one day', 'warn');
    const opt = el => { const v = num(el); return v === null ? undefined : v; };
    await db.put('meds', { ...med, name: name.value.trim(), class: cls.value.trim(), route: route.value, strength: num(strength), strengthUnit: sUnit.value,
      dose: num(dose), doseUnit: dUnit.value, schedule: { type: type.value, everyN: Math.max(1, Math.round(num(nField) || 1)), weekdays: days, time: time.value || '09:00', start: start.value || todayISO(), end: end.value || null },
      titration: tit.filter(t => t.from && t.dose !== null && t.dose !== undefined && t.dose !== '').sort((a, b) => (a.from < b.from ? -1 : 1)),
      missed: { windowHours: opt(win), minHoursBeforeNextDose: opt(before), minHoursBetweenDoses: opt(between) }, refId: refSel.value || '', notes: notes.value.trim() });
    toast('Saved', 'ok'); ctx.go('#/meds');
  };
  root.append(card('', h('div', { class: 'stack' }, field('Name', name), field('Class (optional)', cls), field('Route', route),
      h('div', { class: 'row' }, h('div', { class: 'grow' }, field('Strength', strength)), field('Unit', sUnit)),
      h('div', { class: 'row' }, h('div', { class: 'grow' }, field('Dose (you type this)', dose)), field('Unit', dUnit)))),
    card('Schedule', h('div', { class: 'stack' }, field('Type', type), dWrap, nWrap, field('Time', time), field('Start date', start), field('End date (optional)', end))),
    card('Dose by date', h('p', { class: 'muted small' }, 'The dose you typed for each date range. Used to pre-fill the log.'), titBox,
      btn('Add a step', () => { tit.push({ from: todayISO(), dose: null }); drawTit(); }, 'small mt')),
    card('Missed-dose rule', h('p', { class: 'muted small' }, 'From your product label or prescriber. Leave blank if unsure.'),
      h('div', { class: 'stack' }, field('May still be given within (hours)', win), field('Skip if the next dose is under (hours) away', before), field('Minimum hours between doses', between))),
    card('', h('div', { class: 'stack' }, field('Notes', notes), field('Link to a library entry', refSel))),
    refHost, btn('Save', save, 'primary block'));
  if (old) root.append(btn(old.active === false ? 'Unarchive' : 'Archive', async () => { await db.put('meds', { ...old, active: old.active === false }); ctx.go('#/meds'); }, 'block'),
    btn('Delete', async () => {
      if (!await confirmBox('Delete this medicine and all of its dose records? This cannot be undone.', { okText: 'Delete', danger: true })) return;
      for (const d of (await db.all('doses')).filter(d => d.medId === old.id)) await db.del('doses', d.id);
      await db.del('meds', old.id); toast('Deleted'); ctx.go('#/meds');
    }, 'danger block'));
  root.append(infoLine());
}
