// Reference library: list, detail (library/<id>) and nutrition topic (library/topic/<id>).
import { h, banner, input, segmented, item, sectionTitle, fold, empty, badge } from '../ui.js';
import { statusBadge, STATUS, loadJson, toText, renderValue, notFound } from './library-common.js';
import { renderEntry } from './library-detail.js';
import { renderTopic } from './library-topic.js';

const PARTS = [{ value: 'R1', label: 'Approved' }, { value: 'R2', label: 'In trials' }, { value: 'R3', label: 'Other peptides' }, { value: 'N', label: 'Nutrition' }];

export async function render(root, ctx) {
  const path = ctx.path || [];
  if (path[0] === 'topic' && path[1]) return renderTopic(root, ctx, path[1]);
  if (path[0]) return renderEntry(root, ctx, path[0]);
  ctx.setTitle('Reference library');
  const [ref, tg] = await Promise.all([loadJson('reference.json'), loadJson('targets.json')]);
  if (!ref) { root.append(notFound(ctx, 'The reference data could not be loaded.')); return; }
  let part = ctx.query.get('p'); if (!PARTS.some(p => p.value === part)) part = 'R1';
  let q = ''; let statusF = '';
  const entries = ref.entries || [];
  if (ref.verified === false) root.append(banner('info', '', `Reference data checked ${toText(ref.checkedOn)}. Not yet independently verified.`));
  const results = h('div', { class: 'stack' });
  const chips = h('div', { class: 'chips' });
  const search = input({ type: 'search', placeholder: 'Search name, brand, class, use', 'aria-label': 'Search the library', oninput: e => { q = e.target.value.trim().toLowerCase(); draw(); } });
  const seg = segmented(PARTS, part, v => {
    part = v; statusF = '';
    try { history.replaceState(null, '', '#/library?p=' + v); } catch (e) { /* ignore */ }
    draw();
  });
  root.append(search, seg, chips, results);

  const hay = e => [e.names && e.names.generic, ...((e.names && e.names.brands) || []), e.class, ...(e.usedFor || [])].map(toText).join(' ').toLowerCase();
  function drawChips(pool) {
    chips.replaceChildren();
    const present = Object.keys(STATUS).filter(s => pool.some(e => e.status === s));
    if (present.length < 2) { statusF = ''; return; }
    for (const s of [''].concat(present)) {
      chips.append(h('button', { type: 'button', class: 'chip' + (statusF === s ? ' on' : ''), 'aria-pressed': statusF === s ? 'true' : 'false',
        onclick: () => { statusF = s; draw(); } }, s ? STATUS[s][0] : 'All'));
    }
  }
  function row(e) {
    const n = e.names || {}; const brands = (n.brands || []).filter(Boolean).join(', ');
    const use = e.pass === 'R1' && (e.usedFor || []).length ? ` (${toText(e.usedFor[0]).toLowerCase()})` : '';
    return item({ title: toText(n.generic) + use, sub: h('div', [brands || toText(e.class), toText(e.evidenceLevel)].filter(Boolean).join(' · '), h('div', { style: { marginTop: '6px' } }, statusBadge(e.status))), href: '#/library/' + encodeURIComponent(e.id) });
  }
  function draw() {
    results.replaceChildren();
    if (part === 'N') { chips.replaceChildren(); return drawTopics(); }
    const pass = (ref.passes || []).find(p => p.pass === part) || {};
    const pool = entries.filter(e => e.pass === part);
    drawChips(pool);
    const list = pool.filter(e => (!statusF || e.status === statusF) && (!q || hay(e).includes(q)));
    const order = pass.groupOrder || [];
    const groups = [...new Set(list.map(e => e.group || 'Other'))].sort((a, b) => {
      const ia = order.indexOf(a), ib = order.indexOf(b); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
    if (!list.length) results.append(empty('Nothing matches.'));
    for (const g of groups) results.append(sectionTitle(g), h('div', { class: 'list' }, list.filter(e => (e.group || 'Other') === g).map(row)));
    const notes = renderValue(pass.notes);
    if (notes) results.append(fold('About this list', notes));
  }
  function drawTopics() {
    const topics = ((tg && tg.topics) || []).filter(t => !q || (toText(t.topic) + ' ' + toText(t.summary)).toLowerCase().includes(q));
    if (!topics.length) { results.append(empty('Nothing matches.')); return; }
    results.append(h('div', { class: 'list' }, topics.map(t => item({ title: toText(t.topic), sub: toText(t.group), href: '#/library/topic/' + encodeURIComponent(t.id) }))));
  }
  draw();
}
