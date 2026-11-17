// R5 for pass R1: copies ref_R1_approved.json to ref_R1_approved_verified.json with the corrections
// found in the 2026-11-17 check (see verification_report_R1.md). Run from the repo root.
import { readFileSync, writeFileSync } from 'node:fs';
const R = 'research/';
const a = JSON.parse(readFileSync(R + 'ref_R1_approved.json', 'utf8'));
const DAY = '2026-11-17';
const add = (e, src) => { const n = 's' + (e.sources.length + 1); e.sources.push({ id: n, accessed: DAY, ...src }); return n; };
for (const e of a) {
  e.lastReviewed = DAY;
  e.verifiedR5 = DAY;
  if (e.id === 'liraglutide-t2d') {
    const sid = add(e, { title: 'Discontinuation report: VICTOZA (DIN 02351064)', publisher: 'Drug Shortages Canada', url: 'https://healthproductshortages.ca/shortage/240246', publishedOrRevised: '2025-10-06', type: 'regulator' });
    e.statusDetail.healthCanada += ' Novo Nordisk Canada has filed a discontinuation report for Victoza (DIN 02351064): discontinuation anticipated 2027-01-01, for business reasons (report last updated 2025-10-06).';
    e.statusDetail.sourceIds = [...new Set([...e.statusDetail.sourceIds, sid])];
    e.statusDetail.checkedOn = DAY;
    e.warnings = [...(e.warnings || []), 'Supply note: Victoza is expected to be discontinued in Canada on 2027-01-01 (Drug Shortages Canada report). Ask your pharmacist or prescriber what replaces it.'];
  }
}
writeFileSync(R + 'ref_R1_approved_verified.json', JSON.stringify(a, null, 2) + '\n');
console.log('wrote', a.length, 'entries');
