import { h, btn, card, field, input, numberInput, select, item, badge, empty, toast, confirmBox, infoLine } from '../ui.js';
import { db } from '../db.js';
import { todayISO, fmtDate } from '../dates.js';

const TYPES = ['Nausea', 'Vomiting', 'Diarrhea', 'Constipation', 'Heartburn', 'Fatigue', 'Headache', 'Dizziness', 'Injection-site reaction', 'Other'];

export async function renderEffects(root, ctx) {
  ctx.setTitle('Side effects'); ctx.setAction(null);
  const meds = (await db.all('meds')).filter(m => m.active !== false);
  const entries = (await db.all('sideEffects')).sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 30);
  let type = '', sev = 0;
  const other = input({ placeholder: 'Describe it', style: { display: 'none' } });
  const typeChips = h('div', { class: 'chips' }), sevChips = h('div', { class: 'chips' });
  const draw = () => {
    typeChips.replaceChildren(...TYPES.map(t => h('button', { type: 'button', class: 'chip' + (t === type ? ' on' : ''), onclick: () => { type = t; other.style.display = t === 'Other' ? '' : 'none'; draw(); } }, t)));
    sevChips.replaceChildren(...[1, 2, 3, 4, 5].map(n => h('button', { type: 'button', class: 'chip' + (n === sev ? ' on' : ''), style: { minWidth: '48px', minHeight: '48px' }, onclick: () => { sev = n; draw(); } }, String(n))));
  };
  draw();
  const medSel = select([{ value: '', label: 'Not linked to a medicine' }, ...meds.map(m => ({ value: m.id, label: m.name || 'Unnamed' }))], '');
  const date = input({ type: 'date', value: todayISO() });
  const note = input({ placeholder: 'Optional note' });
  const save = async () => {
    if (!type) return toast('Choose a type', 'warn');
    if (!sev) return toast('Choose a severity from 1 to 5', 'warn');
    const label = type === 'Other' && other.value.trim() ? other.value.trim() : type;
    await db.put('sideEffects', { date: date.value || todayISO(), type: label, severity: sev, note: note.value.trim(), medId: medSel.value });
    toast('Saved', 'ok'); ctx.refresh();
  };
  root.append(btn('Warning signs: when to get help', () => ctx.go('#/warning'), 'danger block'),
    card('Log a side effect', h('div', { class: 'stack' }, field('Type', h('div', { class: 'stack' }, typeChips, other)), field('Severity (1 mild, 5 severe)', sevChips),
      field('Medicine (optional)', medSel), field('Date', date), field('Note', note), btn('Save', save, 'primary block'))),
    card('Recent entries', entries.length ? h('div', { class: 'list' }, entries.map(e => {
      const m = meds.find(x => x.id === e.medId);
      return item({ title: `${e.type || 'Entry'} · severity ${e.severity ?? '?'}`, sub: [fmtDate(e.date), m && m.name, e.note].filter(Boolean).join(' · '),
        right: btn('Delete', async () => { if (await confirmBox('Delete this entry?', { okText: 'Delete', danger: true })) { await db.del('sideEffects', e.id); ctx.refresh(); } }, 'small') });
    })) : empty('No entries yet.')), infoLine());
}
