// One saved check-in, with this week's context.
import { h, btn, card, kv, banner, sheet, confirmBox, toast } from '../ui.js';
import { db, getProfile } from '../db.js';
import { addDays, fmtDate } from '../dates.js';
import { fmtWeight, fmtDelta } from '../units.js';
import { tier } from '../logic/rate.js';
import { POSES, poseLabel, unitsOf, urlFor, deleteCheckin } from './checkin-shared.js';

const avg = (arr, f) => arr.length ? arr.reduce((s, x) => s + f(x), 0) / arr.length : null;

async function weekFacts(date) {
  const from = addDays(date, -6);
  const days = {};
  for (const r of await db.range('foodLog', 'date', from, date)) { const d = days[r.date] ||= { p: 0, w: 0 }; d.p += (Number(r.protein) || 0) * (Number(r.qty) || 1); d.food = true; }
  for (const r of await db.range('waterLog', 'date', from, date)) { const d = days[r.date] ||= { p: 0, w: 0 }; d.w += Number(r.ml) || 0; d.water = true; }
  const vals = Object.values(days);
  const pr = vals.filter(d => d.food), wa = vals.filter(d => d.water);
  const doses = (await db.all('doses')).filter(d => {
    const day = (d.takenAt || '').slice(0, 10); return (d.status === 'taken' || d.status === 'late') && day >= from && day <= date; });
  return { protein: avg(pr, d => d.p), water: avg(wa, d => d.w), doses: doses.length };
}

export async function renderView(root, ctx, id) {
  const ci = await db.get('checkins', id);
  if (!ci) { root.append(banner('warn', 'Not found', 'That check-in no longer exists.'), btn('Back to check-ins', () => ctx.go('#/checkin'))); return; }
  ctx.setTitle('Check-in');
  const profile = (await getProfile()) || {};
  const units = unitsOf(profile);
  const photos = [];
  for (const pid of ci.photoIds || []) { const p = await db.get('photos', pid); if (p && p.blob) photos.push(p); }
  const has = v => Number.isFinite(v);

  const rows = [kv('Date', fmtDate(ci.date, { year: true })), kv('Weight', fmtWeight(ci.weightKg, units)),
    has(ci.waistCm) ? kv('Waist', ci.waistCm + ' cm') : null, has(ci.hipsCm) ? kv('Hips', ci.hipsCm + ' cm') : null,
    has(ci.chestCm) ? kv('Chest', ci.chestCm + ' cm') : null, ci.energy ? kv('Energy', ci.energy + ' of 5') : null,
    ci.hunger ? kv('Hunger', ci.hunger + ' of 5') : null, has(ci.sleepH) ? kv('Sleep', ci.sleepH + ' hours a night') : null,
    (ci.flags || []).length ? kv('Side effects', ci.flags.join(', ')) : null, ci.note ? kv('Note', ci.note) : null];
  root.append(card('Check-in', rows));

  if (photos.length) {
    const order = p => POSES.findIndex(x => x.value === p.pose);
    root.append(card('Photos', h('div', { class: 'grid2' }, photos.sort((a, b) => order(a) - order(b)).map(p => {
      const src = urlFor(p.blob);
      return h('button', { type: 'button', class: 'btn', style: { padding: '4px', height: 'auto' }, 'aria-label': `View ${poseLabel(p.pose)} photo large`,
        onclick: () => sheet({ title: poseLabel(p.pose), body: h('img', { src, alt: poseLabel(p.pose) + ' photo', style: { width: '100%', borderRadius: '8px' } }) }) },
        h('div', { class: 'small' }, poseLabel(p.pose)), h('img', { src, alt: '', style: { width: '100%', maxHeight: '220px', objectFit: 'cover', borderRadius: '6px' } }));
    }))));
  }

  const weights = await db.all('weights');
  const t = tier(weights, ci.date, profile.tiers, { stillEscalating: !!profile.stillEscalating });
  const ctxCard = [banner(t.kind, t.label, t.text)];
  if (t.rate) {
    ctxCard.push(kv('Rate', `${fmtDelta(t.rate.kgPerWk, units)} a week`), kv('Share of body weight', `${t.rate.pctPerWk.toFixed(2)}% of body weight a week`));
  }
  if (t.note) ctxCard.push(h('p', t.note));
  if (t.key === 'fast' || t.key === 'warning') ctxCard.push(btn('Warning signs', () => ctx.go('#/warning'), 'block'));
  const f = await weekFacts(ci.date);
  ctxCard.push(h('div', { class: 'section-title' }, 'Last 7 days'));
  if (f.protein !== null) ctxCard.push(kv('Average protein', `${Math.round(f.protein)} g a day`));
  if (f.water !== null) ctxCard.push(kv('Average water', `${Math.round(f.water)} ml a day`));
  ctxCard.push(kv('Doses logged', String(f.doses)));
  root.append(card('This week', ctxCard));

  root.append(h('div', { class: 'grid2' }, btn('Edit', () => ctx.go('#/checkin/edit/' + ci.id), 'block'),
    btn('Delete', async () => {
      if (!await confirmBox('Delete this check-in and its photos?', { okText: 'Delete', danger: true })) return;
      await deleteCheckin(ci); toast('Check-in deleted'); ctx.go('#/checkin');
    }, 'danger block')), btn('Back to check-ins', () => ctx.go('#/checkin'), 'ghost block'));
}
