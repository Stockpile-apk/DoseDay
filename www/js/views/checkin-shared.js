// Shared bits for the check-in screens: object-URL tracking, labels, weight sync.
import { db } from '../db.js';

export const POSES = [{ value: 'front', label: 'Front' }, { value: 'side', label: 'Side' }, { value: 'back', label: 'Back' }];
export const FLAGS = ['Nausea', 'Vomiting', 'Diarrhea', 'Constipation', 'Heartburn', 'Fatigue', 'Dizziness', 'Injection-site reaction'];
export const poseLabel = p => (POSES.find(x => x.value === p) || { label: String(p || '') }).label;

let urls = [];
export function revokeUrls() { for (const u of urls) URL.revokeObjectURL(u); urls = []; }
export function urlFor(blob) { const u = URL.createObjectURL(blob); urls.push(u); return u; }

export const unitsOf = p => (p && ['kg', 'lb', 'st'].includes(p.units) ? p.units : 'kg');

// Keep the weight log in step with a check-in. Leaves another weight on the same date alone.
export async function syncWeight(ci) {
  const id = 'ci-' + ci.id;
  const same = (await db.where('weights', 'date', ci.date)).find(w => w.id !== id);
  if (same) { await db.del('weights', id); return; }
  await db.put('weights', { id, date: ci.date, kg: ci.weightKg, note: 'Check-in' });
}

export async function deleteCheckin(ci) {
  for (const pid of ci.photoIds || []) await db.del('photos', pid);
  await db.del('weights', 'ci-' + ci.id);
  await db.del('checkins', ci.id);
}

export const sortedCheckins = list => [...list].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
