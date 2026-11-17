// Weight log, trend chart and weekly-rate tier.
import { h, btn, card, banner, field, input, numberInput, kv, empty, item, segmented, toast, sheet, confirmBox, checkbox, num, infoLine } from '../ui.js';
import { db, getProfile, saveProfile } from '../db.js';
import { todayISO, addDays, fmtDate, daysBetween } from '../dates.js';
import { fmtWeight, fmtDelta, toKg, fromKg } from '../units.js';
import { tier, clean, trendWeight, weeksToGoal, WARN_KG } from '../logic/rate.js';

const SVG = 'http://www.w3.org/2000/svg';
const s = (tag, attrs = {}, ...kids) => {
  const el = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.append(...kids);
  return el;
};

// One box for kg or lb, two boxes for stone. Returns {el, read() -> kg|null}.
export function weightInput(units, kg = null) {
  if (units === 'st') {
    const v = fromKg(kg, 'st');
    const st = numberInput({ value: v.st, placeholder: 'st', 'aria-label': 'Stone', min: 0 });
    const lb = numberInput({ value: v.lb, placeholder: 'lb', 'aria-label': 'Pounds', min: 0, max: 13.9 });
    return { el: h('div', { class: 'grid2' }, st, lb), read: () => toKg({ st: st.value, lb: lb.value }, 'st') };
  }
  const box = numberInput({ value: fromKg(kg, units), placeholder: units, 'aria-label': 'Weight in ' + units, min: 0 });
  return { el: box, read: () => toKg(box.value, units) };
}
export const validKg = kg => kg !== null && kg >= 25 && kg <= 400;

function chart(weights, goalKg, days) {
  const all = clean(weights);
  if (all.length < 2) return null;
  const end = todayISO();
  const from = days ? addDays(end, -days) : all[0].date;
  const rows = all.filter(w => w.date >= from);
  if (rows.length < 2) return null;
  const W = 340, H = 190, L = 40, R = 8, T = 10, B = 24;
  const span = Math.max(1, daysBetween(rows[0].date, end));
  const trend = rows.map(w => ({ date: w.date, kg: trendWeight(all, w.date) }));
  let lo = Math.min(...rows.map(w => w.kg)), hi = Math.max(...rows.map(w => w.kg));
  if (goalKg && goalKg > lo - 15 && goalKg < lo) lo = goalKg;
  const padY = Math.max(0.5, (hi - lo) * 0.1); lo -= padY; hi += padY;
  const x = d => L + (daysBetween(rows[0].date, d) / span) * (W - L - R);
  const y = kg => T + (1 - (kg - lo) / (hi - lo)) * (H - T - B);
  const pts = arr => arr.map(p => `${x(p.date).toFixed(1)},${y(p.kg).toFixed(1)}`).join(' ');
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', 'aria-label': 'Weight over time with a 7-day trend line' });
  for (let i = 0; i <= 3; i++) {
    const v = lo + ((hi - lo) * i) / 3, yy = y(v);
    svg.append(s('line', { x1: L, x2: W - R, y1: yy, y2: yy, stroke: 'var(--line)', 'stroke-width': 1 }),
      Object.assign(s('text', { x: L - 5, y: yy + 4, 'text-anchor': 'end', 'font-size': 10, fill: 'var(--muted)' }), { textContent: v.toFixed(1) }));
  }
  if (goalKg && goalKg >= lo && goalKg <= hi) {
    svg.append(s('line', { x1: L, x2: W - R, y1: y(goalKg), y2: y(goalKg), stroke: 'var(--ok)', 'stroke-width': 1.5, 'stroke-dasharray': '5 4' }),
      Object.assign(s('text', { x: W - R, y: y(goalKg) - 4, 'text-anchor': 'end', 'font-size': 10, fill: 'var(--ok)' }), { textContent: 'goal' }));
  }
  svg.append(s('polyline', { points: pts(rows), fill: 'none', stroke: 'var(--muted)', 'stroke-width': 1, opacity: 0.7 }));
  for (const p of rows) svg.append(s('circle', { cx: x(p.date), cy: y(p.kg), r: 2.2, fill: 'var(--muted)' }));
  svg.append(s('polyline', { points: pts(trend), fill: 'none', stroke: 'var(--accent)', 'stroke-width': 2.5, 'stroke-linejoin': 'round' }));
  svg.append(Object.assign(s('text', { x: L, y: H - 6, 'font-size': 10, fill: 'var(--muted)' }), { textContent: fmtDate(rows[0].date, { weekday: false }) }),
    Object.assign(s('text', { x: W - R, y: H - 6, 'text-anchor': 'end', 'font-size': 10, fill: 'var(--muted)' }), { textContent: 'today' }));
  return svg;
}

// Tier banner with the numbers behind it. Used here and on Home.
export function tierBanner(t, units, { compact = false } = {}) {
  const lines = [];
  if (t.rate) {
    lines.push(h('span', { class: 'small' }, `${fmtDelta(t.rate.kgPerWk, units)} a week · ${t.rate.pctPerWk.toFixed(2)}% of body weight a week · from ${t.rate.n} weigh-ins in 14 days`));
  }
  if (t.note) lines.push(h('span', { class: 'small' }, t.note));
  const b = banner(t.kind, t.label, compact && t.key === 'typical' ? '' : t.text, ...lines);
  if (t.key === 'fast' || t.key === 'warning') b.append(h('a', { class: 'btn small', href: '#/warning' }, 'Warning signs'));
  return b;
}

export async function render(root, ctx) {
  const profile = await getProfile();
  const units = profile.units || 'kg';
  const weights = await db.all('weights');
  const all = clean(weights);
  const today = todayISO();
  const t = tier(weights, today, profile.tiers, { stillEscalating: profile.stillEscalating });

  root.append(tierBanner(t, units));

  // Quick add
  const wIn = weightInput(units, null);
  const dateIn = input({ type: 'date', value: today, max: today });
  const noteIn = input({ placeholder: 'Optional note' });
  const save = async () => {
    const kg = wIn.read();
    if (!validKg(kg)) return toast('Enter a weight between 25 and 400 kg.', 'warn');
    if (!dateIn.value || dateIn.value > today) return toast('Pick today or an earlier date.', 'warn');
    await db.put('weights', { date: dateIn.value, kg: Math.round(kg * 100) / 100, note: noteIn.value.trim() });
    toast('Weight saved', 'ok');
    ctx.refresh();
  };
  root.append(card('Add a weight',
    h('div', { class: 'grid2' }, field(`Weight (${units === 'st' ? 'st and lb' : units})`, wIn.el), field('Date', dateIn)),
    field('Note', noteIn), btn('Save weight', save, 'primary block')));

  // Numbers
  if (t.rate) {
    const wk = weeksToGoal(t.rate.trendKg, Number(profile.goalKg), t.rate.kgPerWk);
    root.append(card('Where you are',
      kv('Trend weight (7-day average)', fmtWeight(t.rate.trendKg, units)),
      profile.startKg ? kv('Change since start', fmtDelta(t.rate.trendKg - profile.startKg, units, 1)) : null,
      kv('Pace now', `${fmtDelta(t.rate.kgPerWk, units)} a week`),
      profile.goalKg ? kv('Goal', fmtWeight(profile.goalKg, units)) : null,
      wk ? kv('Weeks to goal at this pace', String(wk)) : null,
      h('p', { class: 'source' }, 'Pace is the slope across the last 14 days. Daily weight moves with water, salt and meals, so single days mean little.')));
  }

  // Chart
  let range = Number(ctx.query.get('r')) || 90;
  const chartHost = h('div');
  const draw = () => {
    const c = chart(weights, Number(profile.goalKg) || null, range === -1 ? 0 : range);
    chartHost.replaceChildren(c || empty('Add at least two weights to see the chart.'));
  };
  draw();
  root.append(card('Trend',
    segmented([{ value: 30, label: '30 days' }, { value: 90, label: '90 days' }, { value: -1, label: 'All' }], range, v => { range = v; draw(); }),
    chartHost, h('p', { class: 'source' }, 'Bold line: 7-day average. Dots: each weigh-in.')));

  // Tier settings shortcut
  root.append(card('Alert settings',
    checkbox("I'm still stepping up my dose", profile.stillEscalating, async v => { await saveProfile({ stillEscalating: v }); ctx.refresh(); }),
    h('p', { class: 'source' }, 'While this is on, the app does not show the "below trial average" note.'),
    kv('Typical range', `${profile.tiers.lowPct} to ${profile.tiers.fastPct}% a week, up to ${fmtDelta(profile.tiers.fastKg, units, 1)}`),
    kv('Warning (fixed)', `over ${fmtDelta(WARN_KG, units, 1)} a week for 2 weeks`),
    h('div', { class: 'row wrap' }, h('a', { class: 'btn small', href: '#/profile' }, 'Profile and targets'), h('a', { class: 'btn small', href: '#/checkin' }, 'Weekly check-in'))));

  // History
  const list = h('div', { class: 'list' });
  const recent = [...weights].filter(w => w && w.date).sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 60);
  for (const w of recent) {
    list.append(item({ title: fmtWeight(w.kg, units), sub: fmtDate(w.date, { year: true }) + (w.note ? ` · ${w.note}` : ''), onClick: () => editSheet(w, units, ctx) }));
  }
  root.append(card(`History (${all.length})`, recent.length ? list : empty('No weights yet.')));
  root.append(infoLine());
}

function editSheet(w, units, ctx) {
  const wIn = weightInput(units, w.kg);
  const dateIn = input({ type: 'date', value: w.date, max: todayISO() });
  const noteIn = input({ value: w.note || '' });
  const sh = sheet({ title: 'Edit weight',
    body: h('div', { class: 'stack' }, field(`Weight (${units === 'st' ? 'st and lb' : units})`, wIn.el), field('Date', dateIn), field('Note', noteIn)),
    actions: [btn('Delete', async () => {
      if (!(await confirmBox('Delete this weight?', { okText: 'Delete', danger: true }))) return;
      await db.del('weights', w.id); sh.close(); toast('Deleted'); ctx.refresh();
    }, 'danger'), btn('Save', async () => {
      const kg = wIn.read();
      if (!validKg(kg)) return toast('Enter a weight between 25 and 400 kg.', 'warn');
      await db.put('weights', { ...w, kg: Math.round(kg * 100) / 100, date: dateIn.value || w.date, note: noteIn.value.trim() });
      sh.close(); toast('Saved', 'ok'); ctx.refresh();
    }, 'primary')] });
}
