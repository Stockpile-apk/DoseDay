// Side by side and before/after slider for check-in photos.
import { h, btn, card, select, segmented, empty } from '../ui.js';
import { db } from '../db.js';
import { fmtDate } from '../dates.js';
import { POSES, urlFor, revokeUrls } from './checkin-shared.js';

export async function renderCompare(root, ctx) {
  ctx.setTitle('Compare photos');
  const photos = (await db.all('photos')).filter(p => p.blob && p.date);
  if (photos.length < 2) { root.append(empty('Add photos to at least two check-ins to compare them.', btn('Back', () => ctx.go('#/checkin')))); return; }
  let pose = (POSES.find(p => photos.filter(x => x.pose === p.value).length >= 2) || POSES[0]).value;
  const out = h('div', { class: 'stack' });
  let dA = '', dB = '';

  function draw() {
    revokeUrls();
    const mine = photos.filter(p => p.pose === pose).sort((a, b) => (a.date < b.date ? -1 : 1));
    if (mine.length < 2) { out.replaceChildren(empty('You need this pose in at least two check-ins.')); return; }
    if (!mine.some(p => p.date === dA)) dA = mine[0].date;
    if (!mine.some(p => p.date === dB)) dB = mine[mine.length - 1].date;
    const opts = mine.map(p => ({ value: p.date, label: fmtDate(p.date, { year: true }) }));
    const A = mine.find(p => p.date === dA), B = mine.find(p => p.date === dB);
    const ua = urlFor(A.blob), ub = urlFor(B.blob);
    const img = (src, alt, extra = {}) => h('img', { src, alt, style: { width: '100%', display: 'block', borderRadius: '8px', ...extra } });
    const top = img(ua, `Before: ${fmtDate(dA, { year: true })}`, { position: 'absolute', inset: '0', height: '100%', objectFit: 'cover', clipPath: 'inset(0 50% 0 0)' });
    const slider = h('input', { type: 'range', min: 0, max: 100, value: 50, 'aria-label': 'Before and after slider', style: { width: '100%', minHeight: '48px' },
      oninput: () => { top.style.clipPath = `inset(0 ${100 - slider.value}% 0 0)`; } });
    const stack = h('div', { style: { position: 'relative' } }, img(ub, `After: ${fmtDate(dB, { year: true })}`, { aspectRatio: '3 / 4', objectFit: 'cover' }), top);
    out.replaceChildren(
      h('div', { class: 'grid2' },
        h('label', { class: 'field' }, h('span', 'Earlier'), select(opts, dA, { onchange: e => { dA = e.target.value; draw(); } })),
        h('label', { class: 'field' }, h('span', 'Later'), select(opts, dB, { onchange: e => { dB = e.target.value; draw(); } }))),
      card('Side by side', h('div', { class: 'grid2' },
        h('div', h('div', { class: 'small' }, 'Earlier: ' + fmtDate(dA, { year: true })), img(ua, 'Earlier photo')),
        h('div', h('div', { class: 'small' }, 'Later: ' + fmtDate(dB, { year: true })), img(ub, 'Later photo')))),
      card('Before and after', stack, slider,
        h('div', { class: 'row between small muted' }, h('span', 'Left: ' + fmtDate(dA)), h('span', 'Right: ' + fmtDate(dB)))));
  }
  root.append(segmented(POSES, pose, v => { pose = v; draw(); }), out, btn('Back to check-ins', () => ctx.go('#/checkin'), 'ghost block'));
  draw();
}
