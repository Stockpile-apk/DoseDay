// In-app reminder check. Runs while the app is open: every minute and whenever the app comes back to the front.
// The calendar export (Reminders screen) is the reliable path with the app closed.
import { db, getSetting } from './db.js';
import { notify } from './platform.js';
import { toast } from './ui.js';
import { nextDue } from './logic/schedule.js';
import { todayISO, daysBetween, nowTime } from './dates.js';

const DEFAULTS = { enabled: true, quietFrom: '22:00', quietTo: '07:00' };
const seen = new Set(); // one alert per item per app session

function inQuiet(now, from, to) {
  if (!from || !to || from === to) return false;
  const t = nowTime(now);
  return from < to ? (t >= from && t < to) : (t >= from || t < to);
}

async function check() {
  try {
    const cfg = { ...DEFAULTS, ...((await getSetting('notify', {})) || {}) };
    if (!cfg.enabled) return;
    const now = new Date();
    if (inQuiet(now, cfg.quietFrom, cfg.quietTo)) return;
    const meds = (await db.all('meds')).filter(m => m.active !== false);
    const doses = await db.all('doses');
    for (const med of meds) {
      const slot = nextDue(med, doses.filter(d => d.medId === med.id), now);
      if (!slot || slot.status !== 'overdue') continue;
      const key = `dose-${med.id}-${slot.scheduledAt.toISOString()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const shown = await notify(`${med.name} is due`, 'Open DoseDay to log it.', key);
      if (!shown && document.visibilityState === 'visible') toast(`${med.name} is due. Log it from Home.`, 'warn', 6000);
    }
    const checkins = await db.all('checkins');
    if (checkins.length) {
      const last = checkins.map(c => c.date).sort().pop();
      const key = 'checkin-' + todayISO(now);
      if (daysBetween(last, todayISO(now)) >= 7 && !seen.has(key)) {
        seen.add(key);
        await notify('Weekly check-in is due', 'Weight is the only required part.', key);
      }
    }
  } catch (e) { console.warn('reminder check failed', e); }
}

export function start() {
  check();
  setInterval(check, 60000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
}
