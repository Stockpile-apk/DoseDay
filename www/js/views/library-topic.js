// One nutrition topic page.
import { h, card, badge, infoLine } from '../ui.js';
import { renderValue, section, sourcesCard, srcTags, table, toText, notFound, loadJson } from './library-common.js';

const CONF = { high: 'ok', moderate: 'info', low: 'warn' };

export async function renderTopic(root, ctx, id) {
  const data = await loadJson('targets.json');
  const t = data && (data.topics || []).find(x => x.id === id);
  if (!t) { root.append(notFound(ctx, 'That topic was not found.')); return; }
  ctx.setTitle(toText(t.topic).split(':')[0] || 'Nutrition');
  root.append(card(toText(t.topic), renderValue(t.summary)));
  const items = (t.items || []).filter(i => i && typeof i === 'object');
  if (items.length) root.append(card('Details', items.map(i => h('div', { class: 'mt' },
    h('div', { class: 'row wrap' }, h('strong', toText(i.label)), i.confidence ? badge('Confidence: ' + toText(i.confidence), CONF[String(i.confidence).toLowerCase()] || '') : null),
    h('p', toText(i.value), srcTags(i.sourceIds || (i.sourceId ? [i.sourceId] : []))),
    i.population ? h('p', { class: 'small muted' }, 'Applies to: ' + toText(i.population)) : null,
    i.note ? h('p', { class: 'small muted' }, toText(i.note)) : null))));
  for (const tb of (t.tables || [])) {
    root.append(card(toText(tb.title), table(tb.columns, tb.rows), tb.note ? h('p', { class: 'small muted' }, toText(tb.note)) : null, srcTags(tb.sourceIds)));
  }
  root.append(section('Statements', renderValue(t.statements)), section('Not confirmed yet', renderValue(t.openQuestions)),
    sourcesCard(t.sources), infoLine());
}
