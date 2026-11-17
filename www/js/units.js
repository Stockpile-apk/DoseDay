// Weight units. Everything is stored in kg; the user picks kg, lb or stone for display and entry.
// Pure functions: safe to import in Node tests.

export const LB_PER_KG = 2.2046226218;
export const LB_PER_ST = 14;
export const UNIT_OPTIONS = [{ value: 'kg', label: 'kg' }, { value: 'lb', label: 'lb' }, { value: 'st', label: 'stone' }];

export function kgToLb(kg) { return kg * LB_PER_KG; }
export function lbToKg(lb) { return lb / LB_PER_KG; }
export function kgToStLb(kg) {
  const totalLb = Math.round(kgToLb(kg) * 10) / 10;
  let st = Math.floor(totalLb / LB_PER_ST);
  let lb = Math.round((totalLb - st * LB_PER_ST) * 10) / 10;
  if (lb >= LB_PER_ST) { st += 1; lb = 0; }
  return { st, lb };
}
export function stLbToKg(st, lb = 0) { return lbToKg((Number(st) || 0) * LB_PER_ST + (Number(lb) || 0)); }

const r1 = n => (Math.round(n * 10) / 10).toFixed(1);

// fmtWeight(150, 'lb') -> '330.7 lb'
export function fmtWeight(kg, units = 'kg') {
  if (kg === null || kg === undefined || !Number.isFinite(Number(kg))) return '—';
  kg = Number(kg);
  if (units === 'lb') return `${r1(kgToLb(kg))} lb`;
  if (units === 'st') { const { st, lb } = kgToStLb(kg); return `${st} st ${r1(lb)} lb`; }
  return `${r1(kg)} kg`;
}
// A change or rate (can be negative), never shown in stone: stone users see lb.
export function fmtDelta(kg, units = 'kg', dp = 2) {
  if (kg === null || kg === undefined || !Number.isFinite(Number(kg))) return '—';
  const f = n => n.toFixed(dp);
  return units === 'kg' ? `${f(Number(kg))} kg` : `${f(kgToLb(Number(kg)))} lb`;
}
// toKg(330, 'lb') or toKg({st:23, lb:8}, 'st'). Returns null when not a positive number.
export function toKg(value, units = 'kg') {
  let kg;
  if (units === 'st') {
    const st = typeof value === 'object' && value ? value.st : value;
    const lb = typeof value === 'object' && value ? value.lb : 0;
    if ((st === null || st === '' || st === undefined) && (lb === null || lb === '' || lb === undefined)) return null;
    kg = stLbToKg(st, lb);
  } else {
    if (value === null || value === '' || value === undefined) return null;
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    kg = units === 'lb' ? lbToKg(n) : n;
  }
  return Number.isFinite(kg) && kg > 0 ? kg : null;
}
// Value to put in an entry box for a stored kg (numbers only).
export function fromKg(kg, units = 'kg') {
  if (kg === null || kg === undefined) return units === 'st' ? { st: '', lb: '' } : '';
  if (units === 'lb') return Math.round(kgToLb(kg) * 10) / 10;
  if (units === 'st') return kgToStLb(kg);
  return Math.round(kg * 10) / 10;
}

export function cmToFtIn(cm) { const totalIn = cm / 2.54; return { ft: Math.floor(totalIn / 12), inch: Math.round(totalIn % 12) }; }
export function ftInToCm(ft, inch = 0) { return ((Number(ft) || 0) * 12 + (Number(inch) || 0)) * 2.54; }
