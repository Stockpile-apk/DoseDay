// Meds section router and list.
import { h, btn, card, badge, banner, kv, empty, item, fold, sectionTitle, infoLine } from '../ui.js';
import { db, getSetting } from '../db.js';
import { describeSchedule, nextDue, adherence, streak } from '../logic/schedule.js';
import { fmtDateTime, relTime } from '../dates.js';
import { loadRef, statusBadge, doseText } from './meds-common.js';
import { logSheet } from './meds-log.js';

export async function render(root, ctx) {
  const sub = ctx.path[0];
  if (sub === 'new' || sub === 'edit') return (await import('./meds-edit.js')).renderEdit(root, ctx);
  if (sub === 'history') return (await import('./meds-history.js')).renderHistory(root, ctx);
  if (sub === 'effects') return (await import('./meds-effects.js')).renderEffects(root, ctx);
  if (sub === 'sites') return (await import('./meds-sites.js')).renderSites(root, ctx);
  ctx.setTitle('Medicines');
  ctx.setAction(btn('Add', () => ctx.go('#/meds/new'), 'primary small'));
  const meds = await db.all('meds');
  const doses = await db.all('doses');
  const refs = await loadRef();
  const now = new Date();
  const mk = med => {
    const mine = doses.filter(d => d.medId === med.id);
    const ref = med.refId ? refs.find(e => e.id === med.refId) : null;
    const slot = nextDue(med, mine, now);
    const ad = adherence(med, mine, now, 30);
    const c = card(med.name || 'Unnamed');
    c.append(h('div', { class: 'row wrap' }, h('span', { class: 'muted' }, [med.strength ? `${med.strength} ${med.strengthUnit || ''}`.trim() : '', describeSchedule(med)].filter(Boolean).join(' · ')),
      ref ? statusBadge(ref.status) : null));
    if (slot && slot.status === 'overdue') c.append(banner('warn', 'Overdue since ' + fmtDateTime(slot.scheduledAt), 'Dose in effect: ' + doseText(slot.dose)));
    else if (slot) c.append(h('p', {}, h('strong', 'Next: '), `${fmtDateTime(slot.scheduledAt)} (${relTime(slot.scheduledAt, now)}) · ${doseText(slot.dose)}`));
    else if (med.schedule && med.schedule.type === 'asNeeded') c.append(h('p', { class: 'muted' }, 'As needed: no scheduled doses.'));
    c.append(kv('30-day adherence', ad.pct === null ? 'No closed doses yet' : `${ad.pct}% (${ad.taken} of ${ad.expected})`), kv('Current streak', `${streak(med, mine, now)} in a row`));
    c.append(h('div', { class: 'row wrap mt' }, btn('Log dose', () => logSheet(med, slot && slot.status !== 'upcoming' ? slot : (slot || null), ctx), 'primary grow'),
      btn('History', () => ctx.go('#/meds/history/' + med.id)), btn('Edit', () => ctx.go('#/meds/edit/' + med.id))));
    return c;
  };
  const active = meds.filter(m => m.active !== false), archived = meds.filter(m => m.active === false);
  if (!active.length) root.append(empty('No medicines yet.', btn('Add a medicine', () => ctx.go('#/meds/new'), 'primary')));
  active.forEach(m => root.append(mk(m)));
  root.append(sectionTitle('Also here'), h('div', { class: 'list' },
    item({ title: 'Side effects', sub: 'Quick log', href: '#/meds/effects' }),
    item({ title: 'Injection sites', sub: 'Rotation list', href: '#/meds/sites' }),
    item({ title: 'Warning signs', sub: 'When to get help', href: '#/warning' })));
  if (archived.length) root.append(fold(`Archived (${archived.length})`, archived.map(m => item({ title: m.name || 'Unnamed', sub: describeSchedule(m), href: '#/meds/edit/' + m.id }))));
  root.append(infoLine());
  const logId = ctx.query && ctx.query.get('log');
  const target = logId && active.find(m => m.id === logId);
  if (target) logSheet(target, nextDue(target, doses.filter(d => d.medId === target.id), now), ctx);
}
