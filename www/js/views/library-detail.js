// Detail page for one reference entry.
import { h, card, badge, banner, kv, btn, infoLine } from '../ui.js';
import { statusBadge, renderValue, section, sourcesCard, srcTags, toText, idsOf, notFound, loadJson } from './library-common.js';

function doseTable(rows) {
  const list = (rows || []).filter(r => r && typeof r === 'object');
  if (!list.length) return null;
  const none = list.filter(r => /No established human dose/i.test(toText(r.regimen) + toText(r.population)));
  const real = list.filter(r => !none.includes(r));
  return card('Dose information',
    banner('warn', '', 'Reference only. What labels and published trials report. Not a recommendation, and never filled into your forms.'),
    none.map(r => h('div', { class: 'mt' }, badge('No established human dose', 'danger'),
      h('p', toText(r.regimen) || toText(r.population), srcTags(r.sourceIds)))),
    real.length ? h('div', { class: 'tblwrap mt' }, h('table', { class: 'tbl' },
      h('thead', h('tr', ['Basis', 'Population', 'Regimen', 'Max dose', 'Context'].map(c => h('th', c)))),
      h('tbody', real.map(r => h('tr',
        h('td', r.basis === 'monograph' ? badge('Monograph', 'ok') : badge('Trial', 'warn'), srcTags(r.sourceIds)),
        h('td', toText(r.population)), h('td', toText(r.regimen)), h('td', toText(r.maxDose)), h('td', toText(r.durationOrContext))))))) : null);
}

export async function renderEntry(root, ctx, id) {
  const data = await loadJson('reference.json');
  const e = data && (data.entries || []).find(x => x.id === id);
  if (!e) { root.append(notFound(ctx, 'That entry was not found.')); return; }
  const n = e.names || {}; const sd = e.statusDetail || {};
  ctx.setTitle(toText(n.generic) || 'Reference');
  const brands = (n.brands || []).filter(Boolean).join(', ');
  const R3 = e.pass === 'R3';
  const box = (t, v, kind) => { const c = renderValue(v); return c ? card(t, h('div', badge(t === 'Proven' ? 'Shown in humans' : t === 'Unproven' ? 'Not shown' : 'Not known', kind)), c) : null; };

  root.append(card('',
    h('div', { class: 'row wrap' }, statusBadge(e.status)),
    e.evidenceLevel ? kv('Evidence level', toText(e.evidenceLevel)) : null,
    h('h2', toText(n.generic)),
    kv('Class', toText(e.class) || '-'),
    e.route && e.route.length ? kv('Route', toText(e.route)) : null,
    brands ? kv('Brands', brands) : null,
    e.lastReviewed ? kv('Last reviewed', toText(e.lastReviewed)) : null,
    [['Health Canada', sd.healthCanada], ['US FDA', sd.fda], ['Other', sd.other]].filter(x => toText(x[1])).map(x =>
      h('div', { class: 'mt' }, h('strong', x[0]), h('p', toText(x[1])))),
    srcTags(sd.sourceIds)));

  if (R3) {
    root.append(box('Proven', e.proven, 'ok'), box('Unproven', e.unproven, 'warn'), box('Unknown', e.unknown, 'danger'),
      e.wada && toText(e.wada.text || e.wada) ? card('Sport (WADA)', renderValue(e.wada.text || e.wada, idsOf(e.wada))) : null,
      section('Human evidence', renderValue(e.humanEvidence)), section('Safety concerns', renderValue(e.safetyConcerns)));
  }
  if (!R3 && e.wada && toText(e.wada.text || e.wada)) root.append(card('Sport (WADA)', renderValue(e.wada.text || e.wada, idsOf(e.wada))));
  if (e.pass === 'R6') root.append(banner('warn', 'Prescription only', 'These medicines need a prescription and medical monitoring in Canada. Doses below are only for the uses the Canadian monograph covers.'));
  const used = (e.usedFor && e.usedFor.length) ? e.usedFor : e.indications;
  root.append(section('Used for', renderValue(used), toText(e.mechanism) ? h('p', { class: 'muted' }, toText(e.mechanism)) : null));
  root.append(doseTable(e.doseInfo));

  const prods = (e.products || []).filter(p => p && typeof p === 'object');
  root.append(section('Products and devices', prods.map(p => h('div', { class: 'mt' },
    h('strong', toText(p.brand)), p.din ? kv('DIN', toText(p.din)) : null,
    (p.strengths || []).length ? kv('Strengths', toText(p.strengths)) : null,
    p.device ? kv('Device', toText(p.device)) : null)), renderValue(e.deviceNotes)));

  const md = e.missedDose || {};
  root.append(section('Missed dose', renderValue(md.text, md.sourceIds)));
  const st = e.storage || {};
  root.append(section('Storage', st.unopened ? kv('Unopened', toText(st.unopened)) : null, st.inUse ? kv('In use', toText(st.inUse)) : null,
    st.discardAfterDays ? kv('Discard after', st.discardAfterDays + ' days') : null, srcTags(st.sourceIds)));
  for (const [t, k] of [['Common side effects', 'commonSideEffects'], ['Warnings', 'warnings'], ['Contraindications', 'contraindications'],
    ['Interactions', 'interactions'], ['Nutrition notes', 'nutritionNotes'], ['Special populations', 'specialPopulations']]) {
    root.append(section(t, renderValue(e[k])));
  }
  if (e.pass === 'R2') {
    const tl = (e.statusTimeline || []).filter(x => x && typeof x === 'object');
    root.append(section('Regulatory timeline', tl.length ? h('ul', { class: 'plain' }, tl.map(x => h('li', h('strong', toText(x.date) + ' '), toText([x.regulator, x.event].filter(Boolean).join(': ')), srcTags(x.sourceIds)))) : null),
      section('Trial programme', renderValue(e.trialProgramme)), section('Reported results', renderValue(e.efficacySummary)),
      section('Not published yet', renderValue(e.unpublished)));
  }
  root.append(section('Not confirmed yet', renderValue(e.openQuestions)));
  root.append(sourcesCard(e.sources), infoLine());
}
