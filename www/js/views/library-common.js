// Shared helpers for the library, topic and warning views.
import { h, card, badge, btn, infoLine, sectionTitle } from '../ui.js';

export const STATUS = {
  approved_ca: ['Approved in Canada', 'ok'],
  approved_elsewhere: ['Approved elsewhere', 'info'],
  investigational: ['Investigational', 'warn'],
  not_approved_limited_evidence: ['Not approved, limited evidence', 'danger'],
};
export function statusBadge(s) { const x = STATUS[s]; return x ? badge(x[0], x[1]) : null; }

export async function loadJson(name) {
  try { const r = await fetch('data/' + name); if (!r.ok) throw new Error(r.status); return await r.json(); }
  catch (e) { return null; }
}

const str = v => (v === null || v === undefined) ? '' : String(v).trim();

// Turn any value into plain text: strings as-is, objects as their values joined with ": ".
export function toText(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') {
    if (Array.isArray(v)) return v.map(toText).filter(Boolean).join('; ');
    return Object.entries(v).filter(([k]) => k !== 'sourceIds' && k !== 'sourceId')
      .map(([, x]) => toText(x)).filter(Boolean).join(': ');
  }
  return str(v);
}
export function idsOf(v) {
  if (!v || typeof v !== 'object') return [];
  return Array.isArray(v.sourceIds) ? v.sourceIds : (v.sourceId ? [v.sourceId] : []);
}

// Small [s1] tags that scroll to the source in the list (no hash links: the app uses hash routing).
export function srcTags(ids) {
  const list = (Array.isArray(ids) ? ids : []).filter(Boolean);
  if (!list.length) return null;
  return h('span', { class: 'small muted' }, ' ', list.map(id => h('button', {
    type: 'button', 'aria-label': 'Go to source ' + id,
    style: { background: 'none', border: '0', padding: '4px 3px', minHeight: '32px', color: 'var(--accent, #2563eb)', font: 'inherit', cursor: 'pointer' },
    onclick: () => { const el = document.getElementById('src-' + id); if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.style.outline = '2px solid currentColor'; setTimeout(() => { el.style.outline = ''; }, 1600); } },
  }, '[' + id + ']')));
}

// One tolerant renderer: string, array of strings, array of objects, object, or missing -> node or null.
export function renderValue(v, ids) {
  if (v === null || v === undefined || v === '') return null;
  if (Array.isArray(v)) {
    const rows = v.filter(x => toText(x));
    if (!rows.length) return null;
    return h('ul', { class: 'plain' }, rows.map(x => h('li', toText(x), srcTags(idsOf(x)))));
  }
  const t = toText(v);
  if (!t) return null;
  return h('p', t, srcTags(ids || idsOf(v)));
}

// card that is skipped when it has nothing to show
export function section(title, ...kids) {
  const k = kids.flat().filter(Boolean);
  return k.length ? card(title, k) : null;
}

export function sourcesCard(sources, title = 'Sources') {
  const list = (Array.isArray(sources) ? sources : []).filter(s => s && typeof s === 'object');
  if (!list.length) return null;
  return card(title, h('ol', { class: 'plain', style: { paddingLeft: '0', listStyle: 'none' } }, list.map((s, i) => {
    const dates = [s.publishedOrRevised && 'Published/revised ' + toText(s.publishedOrRevised), s.accessed && 'Accessed ' + toText(s.accessed)].filter(Boolean).join(' · ');
    return h('li', { id: 'src-' + s.id, class: 'source', style: { marginBottom: '12px', padding: '2px' } },
      h('div', h('strong', `${i + 1}. [${toText(s.id)}] `), toText(s.title)),
      s.publisher ? h('div', { class: 'small muted' }, toText(s.publisher)) : null,
      dates ? h('div', { class: 'small muted' }, dates) : null,
      /^https?:\/\//.test(str(s.url)) ? h('a', { href: s.url, target: '_blank', rel: 'noopener noreferrer', style: { display: 'inline-block', padding: '8px 0' } }, 'Open source (new tab)') : null);
  })));
}

export function table(columns, rows) {
  return h('div', { class: 'tblwrap' }, h('table', { class: 'tbl' },
    h('thead', h('tr', (columns || []).map(c => h('th', toText(c))))),
    h('tbody', (rows || []).map(r => h('tr', (Array.isArray(r) ? r : [r]).map(c => h('td', toText(c))))))));
}

export function notFound(ctx, text) {
  return h('div', { class: 'empty' }, h('p', text), btn('Back to library', () => ctx.go('#/library'), 'primary'));
}
export { sectionTitle, infoLine };
