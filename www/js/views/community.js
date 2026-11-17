// "Commonly reported": what the user's own peptide guide collects from community use.
// Never evidence, never a recommendation, never linked to forms.
import { h, banner, item, fold, empty, btn, badge } from '../ui.js';
import { statusBadge, loadJson, toText } from './library-common.js';
import { renderDetail } from './community-detail.js';

export async function render(root, ctx) {
  const [com, ref] = await Promise.all([loadJson('community.json'), loadJson('reference.json')]);
  const refById = new Map(((ref && ref.entries) || []).map(e => [e.id, e]));
  const path = ctx.path || [];
  if (!com) { root.append(empty('The community data could not be loaded.', btn('Back', () => ctx.go('#/more')))); return; }
  if (path[0]) return renderDetail(root, ctx, com, refById, decodeURIComponent(path[0]));

  ctx.setTitle('Commonly reported');
  root.append(banner('warn', 'Community-reported, not evidence',
    'What people commonly report using, collected from community guides. Not from trials. Not a recommendation. Many of these products are not authorized in Canada and may not contain what the label says.'));

  const rows = (com.entries || []).map(e => {
    const r = e.refId ? refById.get(e.refId) : null;
    const status = r ? statusBadge(r.status) : badge('Not in the reference library', '');
    const sub = h('div', r && r.evidenceLevel ? h('div', toText(r.evidenceLevel)) : null,
      h('div', { style: { marginTop: '6px' } }, status));
    return item({ title: e.name, sub, href: '#/community/' + encodeURIComponent(e.id) });
  });
  root.append(h('div', { class: 'list' }, rows));

  root.append(fold('Not included here',
    h('ul', { class: 'plain' },
      (com.excluded || []).map(x => h('li', h('strong', x.name), ': ', x.reason)),
      h('li', 'Prescription hormones (testosterone, hCG, clomiphene, anastrozole, growth hormone): see the Hormones part of the reference library, from Canadian monographs.'), h('li', 'Gym-only pages (MK-677, high-dose testosterone, oxandrolone, nandrolone, SARMs): kept in the printed guide only.'))));
}
