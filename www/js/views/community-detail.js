// Detail screen for one community entry. Risk first, then a one-time acknowledgment, then the numbers.
import { h, banner, card, btn, badge, kv, infoLine, sectionTitle, empty } from '../ui.js';
import { getSetting, setSetting } from '../db.js';
import { statusBadge, toText, renderValue, table } from './library-common.js';

const NUM_LABEL = 'Community-reported. Not from a trial. Not a recommendation.';
const list = items => h('ul', { class: 'plain' }, items.map(x => h('li', toText(x))));
const tag = () => h('p', { class: 'small', style: { fontWeight: '600', margin: '0 0 6px' } }, NUM_LABEL);

function referenceCard(entry, r) {
  if (!r) {
    return card('Reference library', badge('Not in the reference library', ''),
      h('p', { class: 'muted small' }, 'There is no reference library entry for this one, so no status or evidence is shown here.'));
  }
  const sd = r.statusDetail || {};
  const lists = [['Proven', r.proven], ['Unproven', r.unproven], ['Unknown', r.unknown]]
    .map(([t, v]) => Array.isArray(v) && v.length ? [sectionTitle(t), list(v)] : null);
  return card('What the reference library says',
    h('div', { class: 'row wrap' }, statusBadge(r.status)),
    r.evidenceLevel ? kv('Evidence level', toText(r.evidenceLevel)) : null,
    sd.healthCanada ? kv('Health Canada', toText(sd.healthCanada)) : null,
    lists,
    h('a', { href: '#/library/' + encodeURIComponent(r.id), style: { display: 'inline-block', padding: '12px 0' } }, 'Full reference entry'));
}

function numbers(e) {
  const out = [];
  if (e.commonlyReported.length) {
    out.push(h('section', { class: 'card' }, tag(), h('h2', 'What people commonly report'),
      h('div', e.commonlyReported.map(c => kv(c.label, c.value)))));
  }
  if (e.ramp.length) {
    out.push(h('section', { class: 'card' }, tag(), h('h2', 'Reported ramp'),
      table(['Step', 'Amount'], e.ramp.map(r => [r.step, r.amount]))));
  }
  if (e.cycle) out.push(h('section', { class: 'card' }, tag(), h('h2', 'Reported cycle'), h('p', e.cycle)));
  if (e.notes.length) out.push(h('section', { class: 'card' }, tag(), h('h2', 'Notes from the guide'), list(e.notes)));
  return out;
}

export async function renderDetail(root, ctx, com, refById, id) {
  const e = (com.entries || []).find(x => x.id === id);
  if (!e) { root.append(empty('That entry was not found.', btn('Back to list', () => ctx.go('#/community'), 'primary'))); return; }
  ctx.setTitle(e.name);
  const r = e.refId ? refById.get(e.refId) : null;
  const acks = (await getSetting('communityAck', {})) || {};

  root.append(banner('warn', 'Community-reported, not evidence', 'Not from trials. Not a recommendation.'));
  if (e.whatPeopleUseItFor) root.append(h('p', { class: 'muted' }, 'People use it for: ' + e.whatPeopleUseItFor));

  // (1) reference library first
  root.append(referenceCard(e, r));

  // (2) avoid-if and stop-and-get-help
  root.append(banner('danger', 'Avoid if',
    e.avoidIf.length ? '' : 'The guide lists nothing here.', e.avoidIf.length ? list(e.avoidIf) : null));
  root.append(banner('danger', 'Stop and get help if', '',
    list([...e.stopAndGetHelp, 'Severe allergic reaction: call 911.', 'Any severe or worsening symptom: contact your prescriber.'])));

  // (3) side effects
  if (e.sideEffectsReported.length) root.append(card('Side effects reported', list(e.sideEffectsReported)));

  // (4) acknowledgment, then (5) numbers
  if (acks[e.id]) {
    root.append(...numbers(e));
  } else {
    root.append(card('Before you continue',
      h('p', 'The next section is what people report using. It is not from a trial, it is not a recommendation, and DoseDay will never fill it into your forms.'),
      btn('I understand, show it', async () => {
        const cur = (await getSetting('communityAck', {})) || {};
        cur[e.id] = new Date().toISOString();
        await setSetting('communityAck', cur);
        ctx.refresh();
      }, 'primary block')));
  }
  root.append(h('p', { class: 'source' }, 'Source: community guides'), infoLine());
}
