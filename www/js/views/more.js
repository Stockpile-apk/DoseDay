// More: everything that is not on the bottom bar.
import { h, card, item, infoLine } from '../ui.js';
import { VERSION, DATA_NOTE } from '../version.js';

const GROUPS = [
  ['Track', [
    ['Weekly check-in', 'Weight, optional photos and notes', '#/checkin'],
    ['Inventory', 'Pens and vials, discard and expiry dates', '#/inventory'],
    ['Side effects', 'Quick log', '#/meds/effects'],
    ['Visit summary', 'Printable page for your prescriber or pharmacist', '#/report'],
  ]],
  ['Tools', [
    ['Syringe calculator', 'Math on your own numbers', '#/calc'],
    ['Reminders and calendar', 'Notifications and calendar export', '#/reminders'],
    ['Profile and targets', 'Units, goal, calories, protein, alert bounds', '#/profile'],
  ]],
  ['Reference', [
    ['Warning signs', 'When to contact someone or get urgent help', '#/warning'],
    ['Reference library', 'Labels, trials and status in Canada, with sources', '#/library'],
    ['Mix and measure', 'Handling steps, storage and safety', '#/mix'],
    ['Commonly reported', 'Community-reported use, kept apart from the evidence', '#/community'],
  ]],
  ['App', [
    ['Settings and backup', 'Theme, backup, restore, disclaimer', '#/settings'],
    ['App lock', 'PIN to open the app', '#/lock'],
  ]],
];

export async function render(root) {
  for (const [title, rows] of GROUPS) {
    root.append(card(title, h('div', { class: 'list' }, rows.map(([t, s, href]) => item({ title: t, sub: s, href })))));
  }
  root.append(infoLine());
  root.append(h('p', { class: 'center muted small' }, `DoseDay ${VERSION} · ${DATA_NOTE}`));
}
