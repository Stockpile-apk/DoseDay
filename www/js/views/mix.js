// Mix and measure: static handling help, transcribed from the user's own reference sheet.
import { h, card, banner, btn, fold, infoLine } from '../ui.js';
import { table } from './library-common.js';

const ul = items => h('ul', { class: 'plain' }, items.map(t => h('li', t)));
const STEPS = [
  ['Warm up', 'Wash hands. Let a cold vial reach room temperature (about 10 to 15 minutes) to avoid condensation.'],
  ['Uncap and swab', 'Pop off the caps. Scrub both stoppers and let them air-dry about 30 seconds.'],
  ['Draw water', 'Inject an equal amount of air into the bacteriostatic water, then withdraw the amount of water you have chosen. Clear bubbles.'],
  ['Add slowly', 'Aim at the inside wall of the vial, not the powder. Let the vacuum pull it in.'],
  ['Swirl, do not shake', 'Gently roll the vial. Most dissolve in 1 to 5 minutes.'],
  ['Inspect', 'The liquid should be clear. Cloudy, gel or particles: discard.'],
  ['Label', 'Write the date mixed, the mL of water added and the concentration (mg/mL) on the vial.'],
  ['Refrigerate', 'Into the fridge (2 to 8 °C) right away. Needles go into the sharps bin.'],
];

export async function render(root, ctx) {
  ctx.setTitle('Mix and measure');
  root.append(banner('info', '', 'A handling reference copied from your own sheet. It does not tell you what dose to use.'));

  root.append(card('Before you start', ul([
    '“Research use only” means not approved for human use. Health Canada treats unauthorized injectable peptides as illegal to sell and unassessed for safety.',
    'The purity, dose and sterility of unauthorized vials are unverified. A COA (purity test report) checks purity, not sterility or endotoxins.',
    'Some peptides need a different diluent (for example dilute acetic acid). Check the product.',
    'Allergic to benzyl alcohol? Sterile water is used instead, and it is single use.',
    'Bacteriostatic water is not for infants or newborns.'])));

  root.append(card('What you need', ul([
    'Peptide vial (freeze-dried powder)',
    'Bacteriostatic water (0.9% benzyl alcohol, multi-use)',
    'Mixing syringe, 1 to 3 mL, 23 to 27 G',
    'Insulin syringes (U-100, for measuring)',
    'Alcohol swabs (70% isopropyl)',
    'Sharps container and a marker or label',
    'Clean hands and a clean workspace'])));

  root.append(card('Steps', h('ol', { class: 'plain', style: { paddingLeft: '22px' } },
    STEPS.map(([t, d]) => h('li', { style: { marginBottom: '10px' } }, h('strong', t + '. '), d)))));

  root.append(card('Syringe math',
    h('p', { class: 'muted' }, 'A 1 mL U-100 syringe: 100 units = 1 mL, and 1 unit = 0.01 mL. So 20 units = 0.20 mL.'),
    h('ol', { class: 'plain', style: { paddingLeft: '22px' } },
      h('li', 'Concentration (mg/mL) = mg in the vial ÷ mL of water'),
      h('li', 'mL to draw = amount wanted (mg) ÷ concentration'),
      h('li', 'Units = mL to draw × 100')),
    h('p', 'Example: 10 mg + 2 mL gives 5 mg/mL. For 1 mg: 1 ÷ 5 = 0.2 mL, which is 20 units.'),
    h('p', 'Convert first: 1 mg = 1,000 mcg.'),
    h('p', { class: 'small muted' }, 'Math only, not a recommended dose. More water gives a weaker mix, which is easier to measure in small amounts. Under about 5 units is hard to read accurately.'),
    btn('Open the calculator', () => ctx.go('#/calc'), 'primary block')));

  root.append(card('Drawing a dose', h('ol', { class: 'plain', style: { paddingLeft: '22px' } },
    ['Swab the stopper and use a new insulin syringe.', 'Pull air to your line, then push it into the vial.', 'Flip the vial and draw a little past the line.',
      'Tap out the bubbles and push to the exact line.'].map(t => h('li', t))),
    h('p', { class: 'small muted' }, 'Read at the top edge of the black rubber plunger tip.')));

  root.append(card('Site rotation (subcutaneous)', ul(['Belly, 2 in (5 cm) from the navel', 'Front of the thighs', 'Back of the upper arms']),
    ul(['Move each shot 1 in (2.5 cm) from the last.', 'Skip bruises, scars, moles and sore spots.'])));

  root.append(card('Storage',
    banner('info', '', 'From a general handling guide. These storage times are not yet checked against a primary source. Follow your product label or pharmacist.'),
    table(['Item', 'Where', 'How long'], [
      ['Powder, short term', 'Room temperature, dark, dry', 'Weeks'],
      ['Powder, long term', 'Freezer at −20 °C (or fridge)', 'Months to years'],
      ['Mixed peptide', 'Fridge 2 to 8 °C, dark. Do not freeze', 'About 2 to 4 weeks (varies)'],
      ['Bacteriostatic water, opened', 'Room temperature or fridge', '28 days max'],
      ['Sterile water, opened', 'No preservative', 'Single use']]),
    h('p', { class: 'small muted' }, 'Unopened bacteriostatic water: room temperature 15 to 30 °C until the printed expiry. Warm frozen powder to room temperature before opening. Heat and light speed breakdown.')));

  root.append(card('Best practices', ul(['New sterile needle for every vial entry', 'Swab the stopper before every draw',
    'Write the concentration and date on the vial', 'Do not mix different peptides in one vial', 'Never share needles or vials',
    'Full sharps bins: many BC pharmacies take them'])));

  root.append(h('section', { class: 'card', style: { borderLeft: '6px solid var(--danger, #c62828)' } }, h('h2', 'Stop and get help if'),
    banner('danger', 'Severe allergic reaction: call 911', ''),
    ul(['The solution is cloudy, discoloured or has particles: discard it.', 'Injection site is hot, has spreading redness, is very painful, swollen or has pus.',
      'Fever or chills after an injection.', 'Hives, face or throat swelling, wheezing or trouble breathing.']),
    h('p', { class: 'small' }, 'Contact your prescriber or pharmacist.')));

  const gl = [['Lyophilized', 'freeze-dried powder'], ['Reconstitute', 'dissolve in liquid'], ['Diluent', 'the liquid used'],
    ['Bacteriostatic', 'slows bacteria, does not sterilize'], ['U-100', '100 units per mL'], ['Gauge (G)', 'higher number = thinner needle'],
    ['COA', 'purity test report'], ['mcg', '1/1,000 of a mg']];
  root.append(card('Glossary', h('dl', gl.map(([t, d]) => [h('dt', { style: { fontWeight: '600' } }, t), h('dd', { style: { margin: '0 0 8px 0' } }, d)]))));

  root.append(infoLine('General handling reference. Not a dosing guide.'));
}
