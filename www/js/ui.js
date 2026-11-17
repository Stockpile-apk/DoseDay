// Small DOM helpers shared by every view. No framework.
// h('div', {class:'card', onclick: fn}, child, 'text', [more]) -> element

export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  if (props && (props instanceof Node || typeof props !== 'object' || Array.isArray(props))) {
    kids.unshift(props); props = null;
  }
  for (const [k, v] of Object.entries(props || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'value' || k === 'checked' || k === 'disabled' || k === 'selected' || k === 'open') el[k] = v;
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  append(el, kids);
  return el;
}

function append(el, kids) {
  for (const kid of kids) {
    if (kid === null || kid === undefined || kid === false) continue;
    if (Array.isArray(kid)) append(el, kid);
    else el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
}

export function clear(el) { el.replaceChildren(); return el; }
export function mount(el, ...kids) { clear(el); append(el, kids); return el; }

export const INFO_TEXT = 'Information only. Not medical advice. Follow your prescriber and the product label.';
export function infoLine(extra) { return h('p', { class: 'infoline' }, INFO_TEXT, extra ? ' ' + extra : ''); }

export function btn(label, onClick, kind = '', props = {}) {
  return h('button', { type: 'button', class: ('btn ' + kind).trim(), onclick: onClick, ...props }, label);
}
export function card(title, ...kids) {
  return h('section', { class: 'card' }, title ? h('h2', title) : null, kids);
}
export function badge(text, kind = '') { return h('span', { class: ('badge ' + kind).trim() }, text); }
export function banner(kind, title, text, ...kids) {
  return h('div', { class: ('banner ' + kind).trim(), role: kind === 'danger' || kind === 'warn' ? 'alert' : null },
    title ? h('strong', title) : null, text ? h('span', text) : null, kids);
}
export function field(label, control, hint) {
  return h('label', { class: 'field' }, h('span', label), control, hint ? h('span', { class: 'hint' }, hint) : null);
}
export function input(props = {}) { return h('input', { type: 'text', autocomplete: 'off', ...props }); }
export function numberInput(props = {}) {
  return h('input', { type: 'number', inputmode: 'decimal', step: 'any', autocomplete: 'off', ...props });
}
export function select(options, value, props = {}) {
  const el = h('select', props, options.map(o => {
    const opt = typeof o === 'string' ? { value: o, label: o } : o;
    return h('option', { value: opt.value }, opt.label);
  }));
  if (value !== undefined && value !== null) el.value = String(value);
  return el;
}
export function checkbox(label, checked, onChange) {
  const box = h('input', { type: 'checkbox', checked: !!checked, onchange: e => onChange && onChange(e.target.checked) });
  return h('label', { class: 'check' }, box, h('span', label));
}
export function kv(label, value) { return h('div', { class: 'kv' }, h('span', label), h('span', value)); }
export function empty(text, action) { return h('div', { class: 'empty' }, h('p', text), action || null); }
export function sectionTitle(text) { return h('h3', { class: 'section-title' }, text); }

// progress('Protein', 62, 100, 'g')
export function progress(label, value, max, unit = '') {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  const round = n => (Math.round(n * 10) / 10).toLocaleString('en-CA');
  return h('div', { class: 'progress' + (max > 0 && value > max * 1.15 ? ' over' : '') },
    h('div', { class: 'lab' }, h('span', label), h('span', { class: 'muted' }, `${round(value)} / ${max > 0 ? round(max) : '?'} ${unit}`)),
    h('div', { class: 'bar', role: 'progressbar', 'aria-valuenow': Math.round(pct), 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-label': label },
      h('i', { style: { width: pct + '%' } })));
}

// item({title, sub, right, onClick, href}) -> tappable list row
export function item({ title, sub, right, onClick, href, chevron = true }) {
  const inner = [h('div', { class: 'grow' }, h('div', { class: 't' }, title), sub ? h('div', { class: 's' }, sub) : null),
    right || null, (onClick || href) && chevron ? h('span', { class: 'chev', 'aria-hidden': 'true' }, '›') : null];
  if (href) return h('a', { class: 'item', href }, inner);
  if (onClick) return h('button', { type: 'button', class: 'item', onclick: onClick }, inner);
  return h('div', { class: 'item' }, inner);
}

// segmented([{value,label}], current, onChange) -> tab-like switch
export function segmented(options, value, onChange) {
  const wrap = h('div', { class: 'seg', role: 'tablist' });
  for (const o of options) {
    const b = h('button', { type: 'button', role: 'tab', class: o.value === value ? 'on' : '', 'aria-selected': o.value === value ? 'true' : 'false',
      onclick: () => { [...wrap.children].forEach(c => { c.classList.remove('on'); c.setAttribute('aria-selected', 'false'); });
        b.classList.add('on'); b.setAttribute('aria-selected', 'true'); onChange(o.value); } }, o.label);
    wrap.append(b);
  }
  return wrap;
}

export function fold(summary, ...kids) {
  return h('details', { class: 'fold' }, h('summary', summary), h('div', { class: 'inner' }, kids));
}

export function toast(msg, kind = '', ms = 2800) {
  const t = h('div', { class: ('toast ' + kind).trim(), role: 'status' }, msg);
  document.getElementById('toasts').append(t);
  setTimeout(() => t.remove(), ms);
  return t;
}

// sheet({title, body, actions:[button nodes], onClose}) -> {el, close}
export function sheet({ title, body, actions = [], onClose, dismissable = true }) {
  const host = document.getElementById('overlays');
  const close = () => { overlay.remove(); document.removeEventListener('keydown', onKey); onClose && onClose(); };
  const onKey = e => { if (e.key === 'Escape' && dismissable) close(); };
  const overlay = h('div', { class: 'overlay', onclick: e => { if (e.target === overlay && dismissable) close(); } },
    h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
      h('header', h('h2', title), dismissable ? h('button', { type: 'button', class: 'iconbtn', 'aria-label': 'Close', onclick: close }, '×') : null),
      h('div', { class: 'body' }, body),
      actions.length ? h('footer', actions) : null));
  host.append(overlay);
  document.addEventListener('keydown', onKey);
  return { el: overlay, close };
}

export function confirmBox(message, { okText = 'OK', cancelText = 'Cancel', danger = false, title = 'Please confirm' } = {}) {
  return new Promise(resolve => {
    let done = false;
    const finish = v => { if (done) return; done = true; s.close(); resolve(v); };
    const s = sheet({ title, body: h('p', message), onClose: () => { if (!done) { done = true; resolve(false); } },
      actions: [btn(cancelText, () => finish(false)), btn(okText, () => finish(true), danger ? 'danger' : 'primary')] });
  });
}

// Read a number from an input; returns null when blank or not a finite number.
export function num(el) {
  const v = typeof el === 'string' ? el : el.value;
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}
export function round(n, dp = 1) { const f = 10 ** dp; return Math.round(n * f) / f; }
