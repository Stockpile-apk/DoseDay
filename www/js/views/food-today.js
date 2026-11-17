// Today tab: date switcher, progress, quick add, entries, notices, low appetite mode, last 7 days.
import { h, btn, card, banner, item, empty, progress, sectionTitle, checkbox, confirmBox, kv } from '../ui.js';
import { db, getSetting, setSetting } from '../db.js';
import { todayISO, addDays, fmtDate, nowTime } from '../dates.js';
import { dayTotals, waterTotal, weekSummary } from '../logic/nutrition.js';
import { calorieLevel, calorieFloors } from '../logic/targets.js';
import { loadTargetsData, setupLink, fmtNum } from './food-common.js';
import { quickAddSheet, entrySheet } from './food-sheets.js';
import { addWater } from './food-water.js';

function notices(date, totals, count, profile, t) {
  const today = todayISO();
  const past = date < today;
  if (!(count > 0) || !(past || (date === today && nowTime() >= '18:00'))) return [];
  const out = [];
  const lvl = calorieLevel(totals.kcal, profile.sex);
  const floor = calorieFloors(profile.sex).warn;
  if (lvl === 'warn') out.push(banner('warn', 'Low logged intake', `Logged intake is under ${floor} kcal. Guidelines use ${floor} kcal as the usual lower range during weight loss.`));
  if (lvl === 'strong') out.push(banner('danger', 'Very low logged intake', 'Logged intake is under 800 kcal. Guidelines say intake this low needs medical supervision. Contact your prescriber if this is your usual intake.'));
  if (t.proteinG && totals.protein < 0.6 * t.proteinG) out.push(banner('info', 'Protein', `Protein is at ${fmtNum(totals.protein)} of ${fmtNum(t.proteinG)} g today.`));
  return out;
}

async function lowAppetiteCard(foods) {
  const data = await loadTargetsData();
  const topic = (data.topics || []).find(x => x.id === 'fluids-fibre-gi');
  const pat = topic && (topic.items || []).find(i => String(i.label || '').startsWith('Meal pattern for nausea'));
  const top = foods.filter(f => Number(f.kcal) > 0 && Number(f.protein) > 0)
    .sort((a, b) => b.protein / b.kcal - a.protein / a.kcal).slice(0, 5);
  return card('Low appetite mode',
    sectionTitle('Protein first, from your favourites'),
    top.length ? h('div', { class: 'list' }, top.map(f => item({ title: f.name, chevron: false, sub: `${fmtNum(f.protein)} g protein, ${fmtNum(f.kcal)} kcal per serving` })))
      : h('p', { class: 'muted small' }, 'Add favourites with calories and protein to see them here.'),
    pat ? [sectionTitle('Meal pattern'), h('p', pat.value || ''), pat.confidence ? h('p', { class: 'small muted' }, `Confidence: ${pat.confidence}`) : null,
      h('p', { class: 'source small' }, 'Source: 2025 joint advisory on nutrition with GLP-1 therapy')] : null);
}

export async function renderToday(root, ctx, { profile, t }) {
  const today = todayISO();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(ctx.query.get('d') || '') ? ctx.query.get('d') : today;
  const goDate = d => ctx.go(d === today ? '#/food' : `#/food?d=${d}`);
  const entries = (await db.where('foodLog', 'date', date)).sort((a, b) => String(a.time).localeCompare(String(b.time)));
  const water = waterTotal(await db.where('waterLog', 'date', date));
  const foods = (await db.all('foods')).sort((a, b) => String(a.name).localeCompare(String(b.name)));
  const totals = dayTotals(entries);
  const refresh = () => ctx.refresh();

  root.append(h('div', { class: 'row between' },
    btn('‹ Prev', () => goDate(addDays(date, -1)), '', { 'aria-label': 'Previous day' }),
    h('div', { class: 'center' }, h('strong', date === today ? 'Today' : fmtDate(date)), date !== today ? h('div', null, btn('Today', () => goDate(today), 'small ghost')) : null),
    btn('Next ›', () => goDate(addDays(date, 1)), '', { 'aria-label': 'Next day', disabled: date >= today })));

  const missing = !t.kcal || !t.proteinG || !t.waterMl;
  root.append(card('', progress('Calories', totals.kcal, t.kcal || 0, 'kcal'), progress('Protein', totals.protein, t.proteinG || 0, 'g'),
    progress('Water', water, t.waterMl || 0, 'mL'), missing ? setupLink() : null,
    date === today ? btn('+ water', async () => { const s = Number(await getSetting('waterStepMl', 250)) || 250; await addWater(date, s); refresh(); }, 'block', { style: { marginTop: '8px' } }) : null));

  root.append(...notices(date, totals, entries.length, profile, t));

  root.append(card('Quick add', foods.length ? h('div', { class: 'list' }, foods.map(f => item({ title: f.name || 'Unnamed', sub: `${fmtNum(f.kcal)} kcal, ${fmtNum(f.protein)} g protein`, onClick: () => quickAddSheet(f, date, refresh) })))
    : h('p', { class: 'muted small' }, 'No favourites yet. Add some on the Favourites tab.'),
    btn('Add something else', () => entrySheet(null, date, refresh), 'block', { style: { marginTop: '8px' } })));

  root.append(card('Logged food', entries.length ? h('div', { class: 'list' }, entries.map(e => item({
    title: e.name || 'Unnamed', sub: `${e.time || ''} · qty ${e.qty || 1} · ${fmtNum((e.kcal || 0) * (e.qty || 1))} kcal · ${fmtNum((e.protein || 0) * (e.qty || 1))} g protein`,
    onClick: () => entrySheet(e, date, refresh), chevron: false,
    right: btn('Delete', async (ev) => { ev.stopPropagation(); if (await confirmBox('Delete this entry?', { okText: 'Delete', danger: true })) { await db.del('foodLog', e.id); refresh(); } }, 'small danger', { 'aria-label': 'Delete ' + (e.name || 'entry') }) })))
    : empty('Nothing logged for this day.')));

  const low = await getSetting('lowAppetite', false);
  root.append(checkbox('Low appetite mode', low, async v => { await setSetting('lowAppetite', v); refresh(); }));
  if (low) root.append(await lowAppetiteCard(foods));

  const logs = {}, waters = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays(date, -i);
    logs[d] = await db.where('foodLog', 'date', d);
    waters.push(waterTotal(await db.where('waterLog', 'date', d)));
  }
  const ws = weekSummary(logs, t);
  const avgW = Math.round(waters.reduce((a, b) => a + b, 0) / 7);
  root.append(card('Last 7 days', ws.days ? [kv('Average calories', `${fmtNum(ws.avgKcal)} kcal (${ws.days} days logged)`), kv('Average protein', `${fmtNum(ws.avgProtein)} g`),
    kv('Protein target met', t.proteinG ? `${ws.proteinDaysMet} of ${ws.days} days` : 'No target set')] : h('p', { class: 'muted small' }, 'No food logged in the last 7 days.'),
    kv('Average water', `${fmtNum(avgW)} mL a day`)));
}
