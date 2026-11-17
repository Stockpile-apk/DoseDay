import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const ref = JSON.parse(readFileSync(new URL('../www/data/reference.json', import.meta.url)));
const tgt = JSON.parse(readFileSync(new URL('../www/data/targets.json', import.meta.url)));
const STATUSES = ['approved_ca', 'approved_elsewhere', 'investigational', 'not_approved_limited_evidence'];
function walk(o, fn) { if (Array.isArray(o)) o.forEach(x => walk(x, fn)); else if (o && typeof o === 'object') { fn(o); Object.values(o).forEach(x => walk(x, fn)); } }

describe('reference.json', () => {
  it('39 entries, unique ids', () => { assert.equal(ref.entries.length, 39); assert.equal(new Set(ref.entries.map(e => e.id)).size, 39); });
  it('statuses are allowed values', () => { for (const e of ref.entries) assert.ok(STATUSES.includes(e.status), e.id); });
  it('every entry has http sources and no dangling source ids', () => {
    for (const e of ref.entries) {
      assert.ok(e.sources.length && e.sources.every(s => /^https?:\/\//.test(s.url)), e.id);
      const ids = new Set(e.sources.map(s => s.id));
      walk(e, o => { if (Array.isArray(o.sourceIds)) for (const id of o.sourceIds) assert.ok(ids.has(id), `${e.id}: ${id}`); });
    }
  });
  it('approved in Canada entries carry monograph dosing; bases are monograph or trial', () => {
    for (const e of ref.entries) {
      for (const d of e.doseInfo || []) assert.ok(['monograph', 'trial'].includes(d.basis), e.id);
      if (e.status === 'approved_ca') assert.ok((e.doseInfo || []).some(d => d.basis === 'monograph'), e.id);
    }
  });
  it('no buying language anywhere', () => {
    const s = JSON.stringify(ref).toLowerCase();
    for (const w of ['buy now', 'buy from', 'where to buy', 'coupon', 'discount code', 'for sale at', 'promo code', 'add to cart']) assert.ok(!s.includes(w), w);
  });
});
describe('targets.json', () => {
  it('6 topics and 20 DRI rows', () => { assert.equal(tgt.topics.length, 6); assert.equal(tgt.dri.length, 20); });
  it('DRI rows are well formed', () => { for (const r of tgt.dri) { assert.ok(r.key && r.name && r.unit); assert.ok(['RDA', 'AI'].includes(r.kind)); } });
});
