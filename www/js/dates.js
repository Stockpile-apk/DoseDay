// Date helpers. Dates are stored as local 'YYYY-MM-DD' strings; date-times as ISO strings.
// Pure functions: safe to import in Node tests.

const pad = n => String(n).padStart(2, '0');

export function toISODate(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
export function todayISO(now = new Date()) { return toISODate(now); }
export function nowTime(now = new Date()) { return `${pad(now.getHours())}:${pad(now.getMinutes())}`; }

// 'YYYY-MM-DD' -> Date at local midnight (never UTC, so the day does not shift).
export function parseISODate(s) {
  const [y, m, d] = String(s).slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}
// Local date + 'HH:MM' -> Date. Handles daylight-saving changes because it builds a local time.
export function atTime(dateStr, time = '00:00') {
  const d = parseISODate(dateStr);
  const [hh, mm] = String(time || '00:00').split(':').map(Number);
  d.setHours(hh || 0, mm || 0, 0, 0);
  return d;
}
export function addDays(dateStr, n) {
  const d = parseISODate(dateStr);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}
// Whole calendar days from a to b (b - a). Uses UTC math so DST never gives a fraction.
export function daysBetween(a, b) {
  const da = parseISODate(a), db = parseISODate(b);
  return Math.round((Date.UTC(db.getFullYear(), db.getMonth(), db.getDate()) - Date.UTC(da.getFullYear(), da.getMonth(), da.getDate())) / 86400000);
}
export function hoursBetween(a, b) { return (new Date(b).getTime() - new Date(a).getTime()) / 3600000; }

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const WEEKDAYS = WD;

export function fmtDate(v, { year = false, weekday = true } = {}) {
  const d = v instanceof Date ? v : (String(v).length <= 10 ? parseISODate(v) : new Date(v));
  return `${weekday ? WD[d.getDay()] + ', ' : ''}${MO[d.getMonth()]} ${d.getDate()}${year ? ', ' + d.getFullYear() : ''}`;
}
export function fmtTime(v) {
  const d = v instanceof Date ? v : new Date(v);
  let hh = d.getHours(); const ap = hh >= 12 ? 'p.m.' : 'a.m.';
  hh = hh % 12 || 12;
  return `${hh}:${pad(d.getMinutes())} ${ap}`;
}
export function fmtDateTime(v) { const d = v instanceof Date ? v : new Date(v); return `${fmtDate(d)} ${fmtTime(d)}`; }

// "in 3 h", "2 days ago", "now"
export function relTime(target, now = new Date()) {
  const ms = new Date(target).getTime() - now.getTime();
  const abs = Math.abs(ms), mins = Math.round(abs / 60000);
  let txt;
  if (mins < 1) return 'now';
  if (mins < 60) txt = `${mins} min`;
  else if (mins < 48 * 60) txt = `${Math.round(mins / 60)} h`;
  else txt = `${Math.round(mins / 1440)} days`;
  return ms >= 0 ? `in ${txt}` : `${txt} ago`;
}
