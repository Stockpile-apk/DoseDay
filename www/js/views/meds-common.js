// Shared helpers for the Meds section.
import { badge } from '../ui.js';

export const STATUS = {
  approved_ca: ['Approved in Canada', 'ok'],
  approved_elsewhere: ['Approved elsewhere', 'info'],
  investigational: ['Investigational', 'warn'],
  not_approved_limited_evidence: ['Not approved, limited evidence', 'danger'],
};
export function statusBadge(status) {
  const s = STATUS[status];
  return s ? badge(s[0], s[1]) : null;
}
let refPromise = null;
export function loadRef() {
  if (!refPromise) refPromise = fetch('data/reference.json').then(r => r.json()).then(d => d.entries || []).catch(() => []);
  return refPromise;
}
export function refName(e) {
  const n = (e && e.names) || {};
  return [n.generic, (n.brands || []).length ? '(' + n.brands.slice(0, 3).join(', ') + ')' : ''].filter(Boolean).join(' ') || e.id;
}
export function doseText(d) {
  if (!d || d.amount === null || d.amount === undefined || d.amount === '') return 'dose not entered';
  return `${d.amount} ${d.unit || ''}`.trim();
}
export function siteLabel(sites, id) {
  const s = (sites || []).find(x => x.id === id);
  return s ? s.label : '';
}
export const STATUS_BADGE = { taken: 'ok', late: 'warn', skipped: '', missed: 'danger', overdue: 'warn', due: 'info', upcoming: '' };
export const STATUS_LABEL = { taken: 'Taken', late: 'Taken late', skipped: 'Skipped', missed: 'Missed', overdue: 'Overdue', due: 'Due today', upcoming: 'Upcoming' };
// ISO -> value for <input type="datetime-local"> (local time)
export function toLocalInput(v) {
  const d = new Date(v), p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
export function fromLocalInput(s) { const d = new Date(s); return isNaN(d) ? null : d; }
