// Merges research/r6/r6_*.json into research/ref_R6_hormones.json, meta_R6.json and sources_R6.md.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
const D = new URL('./', import.meta.url).pathname, R = new URL('../', import.meta.url).pathname;
const files = readdirSync(D).filter(f => /^r6_.*\.json$/.test(f)).sort();
const all = files.flatMap(f => JSON.parse(readFileSync(D + f, 'utf8')));
writeFileSync(R + 'ref_R6_hormones.json', JSON.stringify(all, null, 1));
const groups = [...new Set(all.map(e => e.group))];
writeFileSync(R + 'meta_R6.json', JSON.stringify({ pass: 'R6', title: 'Prescription hormones', checkedOn: '2026-11-17', groupOrder: groups,
  useFilters: [...new Set(all.flatMap(e => e.usedFor || []))],
  notes: ['Prescription medicines, from Canadian product monographs. Doses are listed only for the uses each Canadian monograph covers.',
    'Uses outside the monograph (for example clomiphene, hCG or anastrozole in men) have no dose rows here.',
    'Testosterone and other anabolic steroids are controlled substances in Canada (Schedule IV). Not yet independently verified (R5).'],
  openQuestions: [], excluded: [{ name: 'MK-677, oxandrolone, nandrolone, SARMs, high-dose testosterone', reason: 'Gym-only uses: kept out of the app by choice (2026-11-17).' }] }, null, 1));
let md = '# Sources: R6 prescription hormones (accessed 2026-11-17)\n';
for (const e of all) { md += `\n## ${e.names.generic}\n`; for (const s of e.sources) md += `- [${s.id}] ${s.title}. ${s.publisher || ''} ${s.publishedOrRevised || ''}. ${s.url}\n`; }
writeFileSync(R + 'sources_R6.md', md);
console.log(`R6: ${all.length} entries from ${files.join(', ')}`);
