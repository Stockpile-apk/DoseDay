// S6 merge: builds www/data/reference.json and www/data/targets.json from the research files in research/.
// No research is done here. Run: npm run data
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const R = new URL('../research/', import.meta.url).pathname;
const OUT = new URL('../www/data/', import.meta.url).pathname;
const DOCS = new URL('../docs/', import.meta.url).pathname;
const read = f => JSON.parse(readFileSync(R + f, 'utf8'));
const pick = (a, b) => (existsSync(R + a) ? a : b); // prefer R5-verified files when present

const PASSES = [
  { pass: 'R1', title: 'Approved in Canada', file: pick('ref_R1_approved_verified.json', 'ref_R1_approved.json'), meta: 'meta_R1.json' },
  { pass: 'R2', title: 'In trials or under review', file: pick('ref_R2_investigational_verified.json', 'ref_R2_investigational.json'), meta: 'meta_R2.json' },
  { pass: 'R3', title: 'Other peptides', file: pick('ref_R3_peptides_verified.json', 'ref_R3_peptides.json'), meta: 'meta_R3.json' },
];
const STATUSES = ['approved_ca', 'approved_elsewhere', 'investigational', 'not_approved_limited_evidence'];
const verified = PASSES.every(p => p.file.includes('_verified'));

const entries = [], passes = [], ids = new Set();
for (const p of PASSES) {
  const meta = read(p.meta);
  const list = read(p.file);
  for (const e of list) {
    if (ids.has(e.id)) throw new Error('duplicate id ' + e.id);
    if (!STATUSES.includes(e.status)) throw new Error(`bad status ${e.status} on ${e.id}`);
    if (!Array.isArray(e.sources) || !e.sources.length) throw new Error('no sources on ' + e.id);
    const srcIds = new Set(e.sources.map(s => s.id));
    for (const m of JSON.stringify(e).matchAll(/"sourceIds":\s*\[([^\]]*)\]/g))
      for (const x of m[1].matchAll(/"([^"]+)"/g)) if (!srcIds.has(x[1])) throw new Error(`dangling source ${x[1]} on ${e.id}`);
    ids.add(e.id);
    entries.push({ ...e, pass: p.pass });
  }
  passes.push({ pass: p.pass, title: p.title, checkedOn: meta.checkedOn, groupOrder: meta.groupOrder || [], useFilters: meta.useFilters || [],
    notes: meta.notes || [], openQuestions: meta.openQuestions || [], excluded: meta.excluded || [], count: list.length });
}
writeFileSync(OUT + 'reference.json', JSON.stringify({ format: 1, verified, checkedOn: '2026-11-15', passes, entries }));

// ---- targets.json from R4 ----
const r4file = pick('ref_R4_nutrition_verified.json', 'ref_R4_nutrition.json');
const r4 = read(r4file);
const driTable = r4.find(t => t.id === 'micronutrients').tables[0];
const rowFor = name => driTable.rows.find(r => r[0].startsWith(name));
// Structured copy of the DRI table. `check` lists the number strings that must appear in the source row,
// so a typing mistake here fails the build.
const DRI = [
  { key: 'vitA', name: 'Vitamin A', unit: 'µg RAE', kind: 'RDA', men: 900, women: 700, ul: 3000, ulNote: 'preformed vitamin A only', row: 'Vitamin A', check: ['900', '700', '3,000'] },
  { key: 'vitC', name: 'Vitamin C', unit: 'mg', kind: 'RDA', men: 90, women: 75, ul: 2000, ulNote: 'smokers need 35 mg more', row: 'Vitamin C', check: ['90', '75', '2,000'] },
  { key: 'vitD', name: 'Vitamin D', unit: 'µg', kind: 'RDA', men: 15, women: 15, ul: 100, ulNote: '15 µg = 600 IU; 100 µg = 4,000 IU', row: 'Vitamin D', check: ['15', '600 IU', '100', '4,000 IU'] },
  { key: 'vitE', name: 'Vitamin E', unit: 'mg', kind: 'RDA', men: 15, women: 15, ul: 1000, ulNote: 'synthetic or supplement forms', row: 'Vitamin E', check: ['15', '1,000'] },
  { key: 'vitK', name: 'Vitamin K', unit: 'µg', kind: 'AI', men: 120, women: 90, ul: null, ulNote: 'no upper limit determined', row: 'Vitamin K', check: ['120', '90', 'Not determined'] },
  { key: 'b1', name: 'Thiamin (B1)', unit: 'mg', kind: 'RDA', men: 1.2, women: 1.1, ul: null, ulNote: 'no upper limit determined', row: 'Thiamin', check: ['1.2', '1.1', 'Not determined'] },
  { key: 'b2', name: 'Riboflavin (B2)', unit: 'mg', kind: 'RDA', men: 1.3, women: 1.1, ul: null, ulNote: 'no upper limit determined', row: 'Riboflavin', check: ['1.3', '1.1', 'Not determined'] },
  { key: 'niacin', name: 'Niacin', unit: 'mg NE', kind: 'RDA', men: 16, women: 14, ul: 35, ulNote: 'synthetic forms only', row: 'Niacin', check: ['16', '14', '35'] },
  { key: 'b6', name: 'Vitamin B6', unit: 'mg', kind: 'RDA', men: [[19, 1.3], [51, 1.7]], women: [[19, 1.3], [51, 1.5]], ul: 100, ulNote: '', row: 'Vitamin B6', check: ['1.3 (19-50); 1.7 (51+)', '1.3 (19-50); 1.5 (51+)', '100'] },
  { key: 'folate', name: 'Folate', unit: 'µg DFE', kind: 'RDA', men: 400, women: 400, ul: 1000, ulNote: 'limit applies to synthetic folic acid', row: 'Folate', check: ['400', '1,000'] },
  { key: 'b12', name: 'Vitamin B12', unit: 'µg', kind: 'RDA', men: 2.4, women: 2.4, ul: null, ulNote: 'no upper limit determined; from age 51 mainly from fortified foods or a supplement', row: 'Vitamin B12', check: ['2.4', 'Not determined'] },
  { key: 'calcium', name: 'Calcium', unit: 'mg', kind: 'RDA', men: [[19, 1000], [71, 1200]], women: [[19, 1000], [51, 1200]], ul: [[19, 2500], [51, 2000]], ulNote: '', row: 'Calcium', check: ['1,000 (19-70); 1,200 (71+)', '1,000 (19-50); 1,200 (51+)', '2,500 (19-50); 2,000 (51+)'] },
  { key: 'iron', name: 'Iron', unit: 'mg', kind: 'RDA', men: 8, women: [[19, 18], [51, 8]], ul: 45, ulNote: 'vegetarians need 1.8 times more', row: 'Iron', check: ['RDA 8', '18 (19-50); 8 (51+)', '45'] },
  { key: 'magnesium', name: 'Magnesium', unit: 'mg', kind: 'RDA', men: [[19, 400], [31, 420]], women: [[19, 310], [31, 320]], ul: 350, ulNote: 'limit applies to supplements and medicines only, not food', row: 'Magnesium', check: ['400 (19-30); 420 (31+)', '310 (19-30); 320 (31+)', '350'] },
  { key: 'zinc', name: 'Zinc', unit: 'mg', kind: 'RDA', men: 11, women: 8, ul: 40, ulNote: '', row: 'Zinc', check: ['11', 'RDA 8', '40'] },
  { key: 'selenium', name: 'Selenium', unit: 'µg', kind: 'RDA', men: 55, women: 55, ul: 400, ulNote: '', row: 'Selenium', check: ['55', '400'] },
  { key: 'iodine', name: 'Iodine', unit: 'µg', kind: 'RDA', men: 150, women: 150, ul: 1100, ulNote: '', row: 'Iodine', check: ['150', '1,100'] },
  { key: 'potassium', name: 'Potassium', unit: 'mg', kind: 'AI', men: 3400, women: 2600, ul: null, ulNote: 'no upper limit determined', row: 'Potassium', check: ['3,400', '2,600', 'Not determined'] },
  { key: 'sodium', name: 'Sodium', unit: 'mg', kind: 'AI', men: 1500, women: 1500, ul: null, ulNote: 'no upper limit; reduce intake if above 2,300 mg a day', row: 'Sodium', check: ['1,500', '2,300'] },
  { key: 'omega3', name: 'Omega-3 (ALA)', unit: 'g', kind: 'AI', men: 1.6, women: 1.1, ul: null, ulNote: 'no upper limit; no DRI for EPA or DHA', row: 'Alpha-linolenic', check: ['1.6', '1.1'] },
];
for (const d of DRI) {
  const row = rowFor(d.row);
  if (!row) throw new Error('DRI source row not found: ' + d.row);
  const text = row.join(' | ');
  for (const c of d.check) if (!text.includes(c)) throw new Error(`DRI check failed for ${d.name}: "${c}" not in "${text}"`);
}
if (DRI.length !== driTable.rows.length) throw new Error(`DRI rows ${DRI.length} != source rows ${driTable.rows.length}`);
const driSourceIds = driTable.sourceIds || [];
const micro = r4.find(t => t.id === 'micronutrients');
writeFileSync(OUT + 'targets.json', JSON.stringify({
  format: 1, verified: r4file.includes('_verified'), checkedOn: '2026-11-15',
  topics: r4,
  dri: DRI.map(({ row, check, ...d }) => d),
  driSources: micro.sources.filter(s => !driSourceIds.length || driSourceIds.includes(s.id)),
}));

// ---- docs/sources.md ----
let md = '# DoseDay reference sources\n\nBuilt from the research pack (passes R1 to R4, checked 2026-11-15).' +
  (verified ? '' : ' Not yet independently verified (R5).') + '\n';
for (const n of [1, 2, 3, 4]) if (existsSync(R + `sources_R${n}.md`)) md += '\n\n' + readFileSync(R + `sources_R${n}.md`, 'utf8').trim() + '\n';
writeFileSync(DOCS + 'sources.md', md);

const count = s => entries.filter(e => e.status === s).length;
console.log(`reference.json: ${entries.length} entries (${STATUSES.map(s => `${s} ${count(s)}`).join(', ')}), verified=${verified}`);
console.log(`targets.json: ${r4.length} topics, ${DRI.length} DRI rows`);
