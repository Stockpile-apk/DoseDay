import { h, btn, card, input, item, toast, confirmBox, infoLine } from '../ui.js';
import { db, getSetting, setSetting, uid } from '../db.js';
import { DEFAULT_SITES } from '../logic/schedule.js';
import { fmtDate } from '../dates.js';

export async function renderSites(root, ctx) {
  ctx.setTitle('Injection sites'); ctx.setAction(null);
  const sites = (await getSetting('sites', DEFAULT_SITES)).map(s => ({ ...s }));
  const last = new Map();
  for (const d of await db.all('doses')) if (d.siteId && d.takenAt && d.status !== 'skipped' && (!last.has(d.siteId) || last.get(d.siteId) < d.takenAt)) last.set(d.siteId, d.takenAt);
  const persist = async () => { await setSetting('sites', sites); ctx.refresh(); };
  const move = (i, k) => { const j = i + k; if (j < 0 || j >= sites.length) return; [sites[i], sites[j]] = [sites[j], sites[i]]; persist(); };
  const rows = sites.map((s, i) => {
    const lab = input({ value: s.label, 'aria-label': 'Site name', onchange: () => { const v = lab.value.trim(); if (v) { s.label = v; persist(); } } });
    return h('div', { class: 'stack', style: { borderBottom: '1px solid var(--line)', paddingBottom: '10px' } }, lab,
      h('div', { class: 'row wrap between' }, h('span', { class: 'muted small' }, last.has(s.id) ? 'Last used ' + fmtDate(last.get(s.id)) : 'Not used yet'),
        h('span', { class: 'row' }, btn('Up', () => move(i, -1), 'small', { disabled: i === 0 }), btn('Down', () => move(i, 1), 'small', { disabled: i === sites.length - 1 }),
          btn('Remove', async () => { if (await confirmBox(`Remove "${s.label}"? Past records keep it.`, { okText: 'Remove', danger: true })) { sites.splice(i, 1); persist(); } }, 'small danger'))));
  });
  const nu = input({ placeholder: 'New site name' });
  root.append(card('Rotation list', h('p', { class: 'muted small' }, 'The next site suggested is the one used longest ago.'), h('div', { class: 'stack' }, rows)),
    card('Add a site', h('div', { class: 'stack' }, nu, btn('Add', () => { const v = nu.value.trim(); if (!v) return toast('Type a name', 'warn'); sites.push({ id: uid(), label: v }); persist(); }, 'primary'))),
    btn('Reset to default', async () => { if (await confirmBox('Reset the list to the default sites?', { okText: 'Reset' })) { sites.splice(0, sites.length, ...DEFAULT_SITES.map(s => ({ ...s }))); persist(); } }), infoLine());
}
