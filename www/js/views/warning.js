// Warning signs, using the data's own wording.
import { h, card, banner, badge, infoLine } from '../ui.js';
import { loadJson, renderValue, section, sourcesCard, srcTags, toText, notFound } from './library-common.js';

export async function render(root, ctx) {
  ctx.setTitle('Warning signs');
  const data = await loadJson('targets.json');
  const topics = (data && data.topics) || [];
  const w = topics.find(t => t.id === 'warning-signs');
  root.append(banner('danger', 'In an emergency call 911.', ''));
  if (!w) { root.append(notFound(ctx, 'The warning signs data could not be loaded.')); return; }
  if (toText(w.summary)) root.append(h('p', { class: 'muted' }, toText(w.summary)));
  const itemCard = i => card(toText(i.label),
    h('p', toText(i.value), srcTags(i.sourceIds || (i.sourceId ? [i.sourceId] : []))),
    i.population ? h('p', { class: 'small muted' }, 'Applies to: ' + toText(i.population)) : null,
    i.note ? h('p', { class: 'small' }, toText(i.note)) : null,
    h('p', { class: 'small' }, 'Contact your prescriber or pharmacist.'));
  for (const i of (w.items || [])) if (i && typeof i === 'object') root.append(itemCard(i));
  const wl = topics.find(t => t.id === 'weight-loss-rate');
  const gall = wl && (wl.items || []).find(i => /Gallstone/i.test(toText(i && i.label)));
  if (gall) root.append(itemCard(gall));
  root.append(section('Not confirmed yet', renderValue(w.statements), renderValue(w.openQuestions)));
  const src = [...(w.sources || [])];
  for (const s of ((wl && wl.sources) || [])) if (!src.some(x => x.id === s.id)) src.push(s);
  root.append(sourcesCard(src), infoLine());
}
