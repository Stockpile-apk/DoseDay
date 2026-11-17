// Pure status rules for inventory items. Same rules for the list and for Home alerts.
import { addDays, daysBetween } from '../dates.js';

const has = v => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));
const date = v => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null);

export function discardBy(it) {
  const base = date(it.kind === 'vial' ? it.mixedDate : it.openedDate);
  if (!base || !has(it.discardAfterDays) || Number(it.discardAfterDays) <= 0) return null;
  return addDays(base, Math.round(Number(it.discardAfterDays)));
}

export function concentration(it) {
  return has(it.total) && has(it.diluentMl) && Number(it.diluentMl) > 0 && Number(it.total) > 0 ? Number(it.total) / Number(it.diluentMl) : null;
}

// -> [{kind:'empty'|'low'|'discard'|'expired'|'expiring', level:'warn'|'danger', text}]
export function flags(it, today) {
  const out = [];
  const rem = has(it.remaining) ? Number(it.remaining) : null;
  const total = has(it.total) ? Number(it.total) : null;
  if (rem !== null && rem <= 0) out.push({ kind: 'empty', level: 'danger', text: 'Empty' });
  else if (rem !== null) {
    const low = (it.unit === 'doses' && rem <= 1) || (total && total > 0 && rem <= total * 0.2);
    if (low) out.push({ kind: 'low', level: 'warn', text: 'Low' });
  }
  const dby = discardBy(it);
  if (dby) {
    const left = daysBetween(today, dby);
    if (left < 0) out.push({ kind: 'discard', level: 'danger', text: 'Past discard date' });
    else if (left < 7) out.push({ kind: 'discard', level: 'warn', text: left === 0 ? 'Discard today' : `Discard in ${left} day${left === 1 ? '' : 's'}` });
  }
  const exp = date(it.expiry);
  if (exp) {
    const left = daysBetween(today, exp);
    if (left < 0) out.push({ kind: 'expired', level: 'danger', text: 'Expired' });
    else if (left < 14) out.push({ kind: 'expiring', level: 'warn', text: left === 0 ? 'Expires today' : `Expires in ${left} day${left === 1 ? '' : 's'}` });
  }
  return out;
}
