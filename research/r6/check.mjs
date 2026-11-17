// Validates an R6 research file. Usage: node research/r6/check.mjs file.json
import { readFileSync } from 'node:fs';
const f = process.argv[2]; const list = JSON.parse(readFileSync(f, 'utf8'));
const S = ['approved_ca', 'approved_elsewhere', 'investigational', 'not_approved_limited_evidence'];
const REQ = ['id', 'names', 'class', 'group', 'usedFor', 'route', 'status', 'statusDetail', 'indications', 'mechanism', 'products', 'doseInfo', 'missedDose', 'storage',
  'commonSideEffects', 'warnings', 'contraindications', 'interactions', 'evidenceLevel', 'sources', 'lastReviewed', 'openQuestions'];
const bad = /\b(buy|order now|coupon|price|\$\d|vendor|research chemical|bodybuilding|forum|reddit|cycle on|stack with)\b/i;
let errs = 0; const err = m => { errs++; console.log('ERROR ' + m); };
if (!Array.isArray(list)) err('not an array');
for (const e of list) {
  for (const k of REQ) if (!(k in e)) err(`${e.id}: missing ${k}`);
  if (!S.includes(e.status)) err(`${e.id}: bad status`);
  const ids = new Set((e.sources || []).map(s => s.id));
  for (const s of e.sources || []) { if (!/^https?:\/\//.test(s.url || '')) err(`${e.id}: source ${s.id} has no url`); if (!s.accessed) err(`${e.id}: source ${s.id} no accessed date`); }
  JSON.stringify(e, (k, v) => { if (k === 'sourceIds' && Array.isArray(v)) for (const x of v) if (!ids.has(x)) err(`${e.id}: dangling ${x}`); return v; });
  for (const d of e.doseInfo || []) if (!['monograph', 'trial'].includes(d.basis)) err(`${e.id}: bad basis`);
  if (e.status === 'approved_ca' && !(e.doseInfo || []).some(d => d.basis === 'monograph')) err(`${e.id}: approved_ca without monograph dose`);
  const txt = JSON.stringify({ ...e, sources: [] }); const m = txt.match(bad); if (m) err(`${e.id}: wording "${m[0]}"`);
}
console.log(errs ? `${errs} errors` : `OK: ${list.length} entries`); process.exit(errs ? 1 : 0);
