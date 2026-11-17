// Builds a calendar file (.ics) so the phone's own calendar fires reminders with the app closed.
// Pure functions. Times are written as floating local times (no time zone), which calendars treat as local.

const pad = n => String(n).padStart(2, '0');
const stamp = d => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
const utcStamp = d => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
const esc = s => String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

// Long lines must be folded at 75 octets (UTF-8 bytes, not characters), never splitting a character.
const enc = new TextEncoder();
function fold(line) {
  const out = [];
  let cur = '', bytes = 0, limit = 75;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    if (bytes + b > limit) { out.push(cur); cur = ' '; bytes = 1; limit = 75; }
    cur += ch; bytes += b;
  }
  out.push(cur);
  return out.join('\r\n');
}

// rrule for a med schedule (see logic/schedule.js). null for as-needed or unknown.
export function rruleFor(schedule) {
  const s = schedule || {};
  const until = s.end ? `;UNTIL=${s.end.replace(/-/g, '')}T235900` : '';
  switch (s.type) {
    case 'daily': return `FREQ=DAILY${until}`;
    case 'everyN': return `FREQ=DAILY;INTERVAL=${Math.max(1, Math.round(Number(s.everyN) || 1))}${until}`;
    case 'weekly': {
      const d = Array.isArray(s.weekdays) && s.weekdays.length ? Number(s.weekdays[0]) : null;
      return `FREQ=WEEKLY${d === null ? '' : ';BYDAY=' + BYDAY[d]}${until}`;
    }
    case 'custom': {
      const days = (s.weekdays || []).map(Number).sort().map(d => BYDAY[d]);
      return days.length ? `FREQ=WEEKLY;BYDAY=${days.join(',')}${until}` : null;
    }
    default: return null;
  }
}

// events: [{uid, title, description, start:Date, durationMin, rrule, alarmMin}]
export function buildICS(events, now = new Date()) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//DoseDay//Reminders//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  for (const e of events) {
    const end = new Date(e.start.getTime() + (e.durationMin || 15) * 60000);
    lines.push('BEGIN:VEVENT', `UID:${esc(e.uid)}@doseday`, `DTSTAMP:${utcStamp(now)}`, `DTSTART:${stamp(e.start)}`, `DTEND:${stamp(end)}`,
      `SUMMARY:${esc(e.title)}`);
    if (e.description) lines.push(`DESCRIPTION:${esc(e.description)}`);
    if (e.rrule) lines.push(`RRULE:${e.rrule}`);
    lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(e.title)}`, `TRIGGER:-PT${Math.max(0, Math.round(e.alarmMin ?? 0))}M`, 'END:VALARM', 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

// First date on or after `from` that falls on weekday wd (0 = Sunday).
export function firstWeekday(from, wd) {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  while (d.getDay() !== wd) d.setDate(d.getDate() + 1);
  return d;
}
