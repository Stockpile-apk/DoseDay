// Syringe calculator. Math on numbers the user typed. Never pre-fills from reference data, never suggests a dose.
import { h, mount, btn, card, banner, field, numberInput, segmented, kv, item, infoLine, num } from '../ui.js';
import { db } from '../db.js';
import { reconstitute, unitsToDose, vialLife, fmt } from '../logic/calc.js';
import { syringeSvg } from './calc-syringe.js';

export async function render(root, ctx) {
  ctx.setTitle && ctx.setTitle('Syringe calculator');
  let mode = 'dose';
  let unit = null; // 'mg' | 'mcg' | null: the user must choose
  let filled = null;
  const invId = ctx.query && ctx.query.get('inv');
  const vial = numberInput({ placeholder: 'e.g. 10' });
  const liquid = numberInput({ placeholder: 'e.g. 2' });
  const dose = numberInput({ placeholder: 'Type your dose' });
  const units = numberInput({ placeholder: 'Type the units drawn' });
  const perWeek = numberInput({ placeholder: 'Optional' });
  if (invId) {
    const rec = await db.get('inventory', invId).catch(() => null);
    if (rec && rec.kind === 'vial') {
      if (Number(rec.total) > 0) vial.value = String(rec.total);
      if (Number(rec.diluentMl) > 0) liquid.value = String(rec.diluentMl);
      filled = rec.label || 'Vial';
    }
  }
  const out = h('div', { class: 'stack' });
  const chips = h('div', { class: 'chips', role: 'group', 'aria-label': 'Dose unit' });
  const chipBtns = ['mg', 'mcg'].map(u => h('button', { type: 'button', class: 'chip', 'aria-pressed': 'false', style: { minHeight: '48px', minWidth: '72px' },
    onclick: () => { unit = u; chipBtns.forEach(b => { const on = b.textContent === u; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); }); update(); } }, u));
  chips.append(...chipBtns);
  const doseBlock = h('div', { class: 'stack' }, field('Dose', dose), h('div', { class: 'stack', style: { gap: '6px' } }, h('span', { class: 'muted small' }, 'Dose unit (tap one)'), chips));
  const unitsBlock = h('div', { class: 'stack hide' }, field('Units drawn (U-100)', units));
  const seg = segmented([{ value: 'dose', label: 'Dose to units' }, { value: 'units', label: 'Units to dose' }], mode, v => {
    mode = v; doseBlock.classList.toggle('hide', v !== 'dose'); unitsBlock.classList.toggle('hide', v !== 'units'); update();
  });
  for (const el of [vial, liquid, dose, units]) el.addEventListener('input', update);

  function update() {
    const typed = mode === 'dose' ? [vial, liquid, dose].every(e => e.value !== '') : [vial, liquid, units].every(e => e.value !== '');
    const args = { vialMg: num(vial), diluentMl: num(liquid) };
    const kids = [];
    if (mode === 'dose') {
      if (!typed || !unit) { out.replaceChildren(typed && !unit ? banner('info', 'Choose mg or mcg', 'Tap mg or mcg next to the dose to see the result.') : ''); return; }
      const r = reconstitute({ ...args, dose: num(dose), doseUnit: unit });
      if (!r.ok) { out.replaceChildren(banner('danger', 'Check your numbers', null, h('ul', { class: 'plain' }, r.errors.map(e => h('li', e))))); return; }
      const u = r.units, label = `${fmt(u, 1)} units`;
      kids.push(resultCard(label, r, [['In the vial', `${fmt(args.vialMg)} mg`], ['Liquid added', `${fmt(args.diluentMl)} mL`], ['Dose', `${fmt(num(dose), 4)} ${unit}`]], u));
      kids.push(lifeCard(r));
    } else {
      if (!typed) { out.replaceChildren(''); return; }
      const r = unitsToDose({ ...args, units: num(units) });
      if (!r.ok) { out.replaceChildren(banner('danger', 'Check your numbers', null, h('ul', { class: 'plain' }, r.errors.map(e => h('li', e))))); return; }
      const label = `${fmt(r.doseMg, 4)} mg`;
      kids.push(resultCard(label, r, [['In the vial', `${fmt(args.vialMg)} mg`], ['Liquid added', `${fmt(args.diluentMl)} mL`], ['Units drawn', `${fmt(num(units), 1)} units`]], num(units), `That is ${fmt(r.doseMcg, 1)} mcg`));
      kids.push(lifeCard(r));
    }
    out.replaceChildren(...kids);
  }

  function resultCard(big, r, echo, unitsVal, extra) {
    const unitsLabel = `${fmt(unitsVal, 1)} units`;
    return card('Result',
      h('div', { class: 'big center', style: { fontSize: '2rem', fontWeight: '800' } }, big),
      extra ? h('p', { class: 'center muted' }, extra) : null,
      h('div', { class: 'kv-list' }, kv('mL to draw', `${fmt(r.drawMl, 3)} mL`), kv('Concentration', `${fmt(r.concMgMl, 3)} mg/mL`)),
      (r.warnings || []).map(w => banner('warn', null, w)),
      syringeSvg(unitsVal, unitsLabel),
      h('h3', { class: 'section-title' }, 'Your numbers'), echo.map(([a, b]) => kv(a, b)),
      h('h3', { class: 'section-title' }, 'How it was worked out'), h('ul', { class: 'plain' }, r.formulas.map(f => h('li', f))));
  }

  function lifeCard(r) {
    const doseMg = r.doseMg;
    const body = h('div', { class: 'stack' });
    const draw = () => {
      const life = vialLife({ vialMg: num(vial), doseMg, dosesPerWeek: num(perWeek) });
      body.replaceChildren(life ? h('div', { class: 'big', style: { fontWeight: '700' } }, `${life.doses} doses per vial`) : h('p', { class: 'muted' }, 'Not enough information.'),
        life && life.days != null ? h('p', {}, `About ${life.days} days`) : null);
    };
    draw();
    const wk = field('Doses per week (optional)', perWeek);
    perWeek.oninput = draw;
    return card('How long the vial lasts', body, wk);
  }

  mount(root,
    seg,
    filled ? banner('info', null, `Filled from your inventory item: ${filled}`) : null,
    card('Type your numbers', field('In the vial (mg)', vial), field('Liquid added (mL)', liquid), doseBlock, unitsBlock),
    out,
    card('', h('p', { style: { fontWeight: '700' } }, 'Math only. Not a recommended dose.'), h('p', 'Check this with your pharmacist or prescriber.')),
    h('div', { class: 'list' }, item({ title: 'Mix and measure help', href: '#/mix' })),
    infoLine());
  update();
}
