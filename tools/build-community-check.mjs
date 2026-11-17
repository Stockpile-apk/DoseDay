// Validates www/data/community.json. Exits 1 on any failure.
// Usage: node tools/build-community-check.mjs
import { readFileSync } from 'node:fs';
const read = p => JSON.parse(readFileSync(new URL('../www/data/' + p, import.meta.url), 'utf8'));
const com = read('community.json');
const ref = read('reference.json');
const refIds = new Set(ref.entries.map(e => e.id));
const errors = [];
const err = m => errors.push(m);

if (com.format !== 1) err('format must be 1');
if (!com.source) err('missing source');
if (!/^\d{4}-\d{2}-\d{2}$/.test(com.builtOn || '')) err('builtOn must be YYYY-MM-DD');
if (!Array.isArray(com.entries) || !com.entries.length) err('entries must be a non-empty array');
if (!Array.isArray(com.excluded)) err('excluded must be an array');

// generic names of approved_ca entries that must never appear as community entries
const approved = new Set();
for (const e of ref.entries) if (e.status === 'approved_ca') approved.add(String(e.names?.generic || '').toLowerCase().split(/[ (]/)[0]);
for (const n of ['semaglutide', 'tirzepatide']) approved.add(n);

const ARR = ['aka', 'commonlyReported', 'ramp', 'avoidIf', 'stopAndGetHelp', 'sideEffectsReported', 'notes'];
const BAD_SUB = ['http', 'www.', '.com', '$', 'CAD', 'USD'];
const BAD_WORDS = /\b(price|prices|purity|COA|vendor|vendors|buy|shop|order)\b/i;
const ids = new Set();

function scan(path, v) {
  if (typeof v === 'string') {
    for (const b of BAD_SUB) if (v.toLowerCase().includes(b.toLowerCase()) && !(b === 'CAD' || b === 'USD') ) err(`${path}: contains "${b}": ${v}`);
    if (/\b(CAD|USD)\b/.test(v)) err(`${path}: contains currency: ${v}`);
    if (BAD_WORDS.test(v)) err(`${path}: banned word: ${v}`);
  } else if (Array.isArray(v)) v.forEach((x, i) => scan(`${path}[${i}]`, x));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) scan(`${path}.${k}`, x);
}

for (const [i, e] of (com.entries || []).entries()) {
  const p = `entries[${i}](${e.id})`;
  for (const f of ['id', 'name', 'whatPeopleUseItFor', 'cycle']) if (typeof e[f] !== 'string' || (f !== 'cycle' && !e[f])) err(`${p}: missing string ${f}`);
  for (const f of ARR) if (!Array.isArray(e[f])) err(`${p}: ${f} must be an array`);
  if (!('refId' in e)) err(`${p}: missing refId`);
  if (e.refId !== null && !refIds.has(e.refId)) err(`${p}: refId "${e.refId}" not in reference.json`);
  if (ids.has(e.id)) err(`${p}: duplicate id`);
  ids.add(e.id);
  if (approved.has(String(e.id).toLowerCase()) || approved.has(String(e.name).toLowerCase())) err(`${p}: approved_ca product must be excluded`);
  for (const c of e.commonlyReported || []) if (!c.label || !c.value) err(`${p}: commonlyReported needs label and value`);
  for (const r of e.ramp || []) if (!r.step || !r.amount) err(`${p}: ramp needs step and amount`);
  if (!(e.commonlyReported || []).length) err(`${p}: commonlyReported empty`);
  scan(p, e);
}
for (const x of com.excluded || []) { if (!x.name || !x.reason) err('excluded item needs name and reason'); scan('excluded', x); }
scan('source', com.source);

if (errors.length) { console.error(errors.join('\n')); console.error(`FAILED: ${errors.length} problem(s)`); process.exit(1); }
console.log(`community.json OK: ${com.entries.length} entries, ${com.entries.filter(e => !e.refId).length} without refId, ${com.excluded.length} excluded`);
