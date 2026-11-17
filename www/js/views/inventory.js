// Inventory: pens and vials the user has. All numbers are typed by the user.
import { h, mount, btn, card, badge, banner, kv, empty, progress, infoLine, sheet, toast, numberInput, field, num } from '../ui.js';
import { db } from '../db.js';
import { todayISO, fmtDate } from '../dates.js';
import { fmt } from '../logic/calc.js';
import { discardBy, concentration, flags } from './inventory-rules.js';
import { editItem } from './inventory-edit.js';

// For the Home screen: [{id, label, kind:'low'|'empty'|'discard'|'expired'|'expiring', text}]
export async function inventoryAlerts() {
  const today = todayISO();
  const items = await db.all('inventory').catch(() => []);
  const out = [];
  for (const it of items) for (const f of flags(it, today)) out.push({ id: it.id, label: it.label || 'Item', kind: f.kind, text: f.text });
  return out;
}

async function useOne(it, refresh) {
  if (it.unit !== 'mg') {
    await db.put('inventory', { ...it, remaining: Math.max(0, Number(it.remaining || 0) - 1) });
    toast('Used one', 'ok'); refresh(); return;
  }
  const amt = numberInput({ placeholder: 'mg used' });
  const s = sheet({ title: 'How many mg?', body: field('Amount used (mg)', amt, 'Type the amount you used.'), actions: [btn('Cancel', () => s.close()),
    btn('Subtract', async () => {
      const v = num(amt); if (v === null || v <= 0) { toast('Enter an amount', 'warn'); return; }
      await db.put('inventory', { ...it, remaining: Math.max(0, Number(it.remaining || 0) - v) }); s.close(); toast('Updated', 'ok'); refresh();
    }, 'primary')] });
}

function itemCard(it, today, ctx, medName, meds) {
  const fl = flags(it, today);
  const unit = it.unit === 'mg' ? 'mg' : 'doses';
  const rem = Number.isFinite(Number(it.remaining)) && it.remaining !== null && it.remaining !== '' ? Number(it.remaining) : null;
  const tot = Number.isFinite(Number(it.total)) && it.total !== null && it.total !== '' ? Number(it.total) : null;
  const conc = concentration(it), dby = discardBy(it);
  const refresh = () => ctx.refresh();
  return h('section', { class: 'card' },
    h('div', { class: 'row between wrap' }, h('h2', { style: { margin: 0 } }, it.label || 'Item'), badge(it.kind === 'vial' ? 'Vial' : 'Pen', 'info')),
    fl.length ? h('div', { class: 'row wrap', style: { gap: '6px' } }, fl.map(f => badge(f.text, f.level))) : null,
    it.strength ? kv('Strength', it.strength) : null,
    rem !== null && tot ? progress('Remaining', rem, tot, unit) : (rem !== null ? kv('Remaining', `${fmt(rem, 2)} ${unit}`) : null),
    it.kind === 'pen' && it.openedDate ? kv('Opened', fmtDate(it.openedDate, { year: true })) : null,
    it.kind === 'vial' && it.mixedDate ? kv('Mixed', fmtDate(it.mixedDate, { year: true })) : null,
    it.kind === 'vial' && Number(it.diluentMl) > 0 ? kv('Liquid added', `${fmt(it.diluentMl, 2)} mL`) : null,
    conc ? kv('Concentration', `${fmt(conc, 3)} mg/mL`) : null,
    dby ? kv('Discard by', fmtDate(dby, { year: true })) : null,
    it.expiry ? kv('Expiry', fmtDate(it.expiry, { year: true })) : null,
    h('div', { class: 'row wrap', style: { gap: '8px' } },
      btn('Use one', () => useOne(it, refresh), '', { style: { minHeight: '48px' } }),
      btn('Edit', () => editItem(it, meds, refresh), '', { style: { minHeight: '48px' } }),
      it.kind === 'vial' ? btn('Calculator', () => ctx.go('#/calc?inv=' + encodeURIComponent(it.id)), '', { style: { minHeight: '48px' } }) : null));
}

export async function render(root, ctx) {
  ctx.setTitle && ctx.setTitle('Inventory');
  const [items, meds] = await Promise.all([db.all('inventory'), db.all('meds')]);
  const today = todayISO();
  const refresh = () => ctx.refresh();
  const add = () => editItem(null, meds, refresh);
  ctx.setAction(btn('Add', add));
  const alerts = items.flatMap(it => flags(it, today).map(f => ({ it, f })));
  const count = k => new Set(alerts.filter(a => k.includes(a.f.kind)).map(a => a.it.id)).size;
  const low = count(['low', 'empty']), disc = count(['discard']), exp = count(['expired']);
  const plural = n => `${n} item${n === 1 ? '' : 's'}`;
  const groups = new Map();
  for (const it of items) { const k = meds.find(m => m.id === it.medId) ? it.medId : ''; (groups.get(k) || groups.set(k, []).get(k)).push(it); }
  const order = [...groups.keys()].sort((a, b) => (a === '' ) - (b === '') || String(medNm(a)).localeCompare(String(medNm(b))));
  function medNm(id) { const m = meds.find(x => x.id === id); return m ? (m.name || 'Medicine') : 'Not linked'; }
  if (ctx.path && ctx.path[0] === 'new') setTimeout(add, 0);
  else if (ctx.path && ctx.path[0] === 'edit') { const r = items.find(x => x.id === ctx.path[1]); if (r) setTimeout(() => editItem(r, meds, () => ctx.go('#/inventory')), 0); }
  mount(root,
    low ? banner('warn', `${plural(low)} low or empty`) : null,
    disc ? banner('danger', `${plural(disc)} past or near the discard date`) : null,
    exp ? banner('danger', `${plural(exp)} expired`) : null,
    items.length ? order.map(k => h('div', { class: 'stack' }, h('h3', { class: 'section-title' }, medNm(k)), groups.get(k).map(it => itemCard(it, today, ctx, medNm(k), meds)))) :
      empty('No pens or vials yet', btn('Add', add, 'primary')),
    infoLine());
}
