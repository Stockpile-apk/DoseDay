// Weekly check-in: router and history list.
import { h, btn, card, banner, item, empty, sectionTitle, infoLine } from '../ui.js';
import { db, getProfile } from '../db.js';
import { todayISO, daysBetween, fmtDate } from '../dates.js';
import { fmtWeight, fmtDelta } from '../units.js';
import { storageEstimate } from '../platform.js';
import { revokeUrls, urlFor, sortedCheckins, unitsOf } from './checkin-shared.js';

export async function render(root, ctx) {
  revokeUrls();
  const sub = ctx.path[0];
  if (sub === 'new' || sub === 'edit') return (await import('./checkin-form.js')).renderForm(root, ctx, ctx.path[1]);
  if (sub === 'view') return (await import('./checkin-view.js')).renderView(root, ctx, ctx.path[1]);
  if (sub === 'compare') return (await import('./checkin-compare.js')).renderCompare(root, ctx);
  ctx.setTitle('Check-in');
  const profile = (await getProfile()) || {};
  const units = unitsOf(profile);
  const list = sortedCheckins(await db.all('checkins'));
  const photos = await db.all('photos');
  const today = todayISO();

  let status;
  if (!list.length) status = banner('info', 'No check-ins yet', 'A check-in is due now.');
  else {
    const age = daysBetween(list[0].date, today);
    const when = age <= 0 ? 'today' : age === 1 ? 'yesterday' : `${age} days ago`;
    status = age >= 7
      ? banner('warn', 'Check-in due', `Last check-in: ${fmtDate(list[0].date, { year: true })} (${when}).`)
      : banner('ok', 'Not due yet', `Last check-in: ${fmtDate(list[0].date, { year: true })} (${when}). Next one is due in ${7 - age} day${7 - age === 1 ? '' : 's'}.`);
  }
  root.append(btn("Start this week's check-in", () => ctx.go('#/checkin/new'), 'primary block'), status);

  const withPhotos = list.filter(c => (c.photoIds || []).length).length;
  if (withPhotos >= 2) root.append(btn('Compare photos', () => ctx.go('#/checkin/compare'), 'block'));

  const rows = list.map((c, i) => {
    const prev = list[i + 1];
    const delta = prev && Number.isFinite(c.weightKg) && Number.isFinite(prev.weightKg) ? c.weightKg - prev.weightKg : null;
    const mine = photos.filter(p => p.checkinId === c.id && p.blob).slice(0, 3);
    const thumbs = mine.length ? h('div', { class: 'row' }, mine.map(p => h('img', { src: urlFor(p.blob), alt: 'Check-in photo',
      style: { width: '36px', height: '48px', objectFit: 'cover', borderRadius: '6px' } }))) : null;
    const right = h('div', { class: 'row', style: { gap: '8px' } }, thumbs,
      delta !== null ? h('span', { class: 'small muted' }, (delta > 0 ? '+' : '') + fmtDelta(delta, units)) : null);
    return item({ title: `${fmtDate(c.date, { year: true })}: ${fmtWeight(c.weightKg, units)}`, right, href: `#/checkin/view/${c.id}`,
      sub: delta === null ? 'First check-in' : `Change since previous: ${delta > 0 ? '+' : ''}${fmtDelta(delta, units)}` });
  });
  root.append(sectionTitle('History'), list.length ? h('div', { class: 'list' }, rows) : empty('Your check-ins will show here.'));

  const est = await storageEstimate();
  const mb = est && Number.isFinite(est.usage) ? Math.max(0.1, est.usage / 1048576).toFixed(1) : null;
  root.append(card('Photo storage',
    h('p', `${photos.length} photo${photos.length === 1 ? '' : 's'} stored.`),
    mb ? h('p', `About ${mb} MB used on this device.`) : null,
    h('p', { class: 'small muted' }, 'Photos stay on this device. They are not included in the normal backup; export them from Settings.')),
    infoLine());
}
