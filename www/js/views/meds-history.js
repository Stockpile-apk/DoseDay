import { h, btn, badge, item, empty, field, input, select, sheet, confirmBox, toast, infoLine } from '../ui.js';
import { db, getSetting } from '../db.js';
import { timeline, DEFAULT_SITES } from '../logic/schedule.js';
import { fmtDateTime } from '../dates.js';
import { STATUS_BADGE, STATUS_LABEL, doseText, siteLabel, toLocalInput, fromLocalInput } from './meds-common.js';
import { logSheet } from './meds-log.js';

function editSheet(rec, ctx) {
  const when = input({ type: 'datetime-local', value: rec.takenAt ? toLocalInput(rec.takenAt) : '' });
  const note = input({ value: rec.note || '', placeholder: 'Optional note' });
  const st = select([{ value: 'taken', label: 'Taken' }, { value: 'late', label: 'Taken late' }, { value: 'skipped', label: 'Skipped' }], rec.status);
  const s = sheet({ title: 'Edit logged dose', body: h('div', { class: 'stack' }, field('Status', st), field('Time', when), field('Note', note)), actions: [
    btn('Delete', async () => { if (await confirmBox('Delete this dose record?', { okText: 'Delete', danger: true })) { await db.del('doses', rec.id); s.close(); toast('Deleted'); ctx.refresh(); } }, 'danger'),
    btn('Save', async () => { const d = fromLocalInput(when.value); await db.put('doses', { ...rec, status: st.value, note: note.value.trim(), takenAt: d ? d.toISOString() : rec.takenAt }); s.close(); toast('Saved', 'ok'); ctx.refresh(); }, 'primary')] });
}

export async function renderHistory(root, ctx) {
  const med = await db.get('meds', ctx.path[1]);
  if (!med) { root.append(empty('Medicine not found.', btn('Back', () => ctx.go('#/meds')))); return; }
  ctx.setTitle('History: ' + (med.name || ''));
  ctx.setAction(null);
  const sites = await getSetting('sites', DEFAULT_SITES);
  const mine = (await db.all('doses')).filter(d => d.medId === med.id);
  const now = new Date();
  const rows = timeline(med, mine, now, { daysBack: 60, daysAhead: 14 }).map(s => ({ at: s.scheduledAt, status: s.status, rec: s.record, dose: s.dose, slot: s }));
  for (const r of mine) if (!r.scheduledAt) rows.push({ at: new Date(r.takenAt), status: r.status, rec: r, dose: { amount: r.doseAmount, unit: r.doseUnit }, extra: true });
  rows.sort((a, b) => b.at - a.at);
  const from = new Date(now.getTime() - 60 * 86400000);
  const list = rows.filter(r => r.at >= from || r.extra).map(r => {
    const d = r.rec ? { amount: r.rec.doseAmount, unit: r.rec.doseUnit } : r.dose;
    const site = r.rec ? siteLabel(sites, r.rec.siteId) : '';
    const open = r.rec ? () => editSheet(r.rec, ctx) : (r.status === 'overdue' || r.status === 'due') ? () => logSheet(med, r.slot, ctx) : null;
    return item({ title: fmtDateTime(r.extra ? r.rec.takenAt : r.at) + (r.extra ? ' (extra)' : ''),
      sub: [doseText(d), site, r.rec && r.rec.note].filter(Boolean).join(' · '),
      right: badge(STATUS_LABEL[r.status] || r.status, STATUS_BADGE[r.status] || ''), onClick: open });
  });
  root.append(list.length ? h('div', { class: 'list' }, list) : empty('No doses in this window.'), infoLine());
}
