// Shared helpers for the Food section.
import { h } from '../ui.js';
import { db, getProfile } from '../db.js';
import { suggest, effective } from '../logic/targets.js';

let targetsCache = null;
export async function loadTargetsData() {
  if (!targetsCache) {
    try { targetsCache = await (await fetch('data/targets.json')).json(); } catch { targetsCache = { topics: [], dri: [] }; }
  }
  return targetsCache;
}

export async function loadTargets() {
  const profile = await getProfile();
  const weights = (await db.all('weights')).filter(w => Number(w.kg) > 0).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const kg = weights.length ? weights[weights.length - 1].kg : (Number(profile.startKg) || null);
  const t = effective(profile, suggest(profile, kg));
  return { profile, kg, t };
}

export function setupLink() {
  return h('a', { href: '#/profile', class: 'small', style: { display: 'inline-block', padding: '8px 0' } }, 'Set up your profile');
}

export const fmtNum = n => (Math.round((Number(n) || 0) * 10) / 10).toLocaleString('en-CA');
export const qtyText = q => (Number(q) > 0 ? Number(q) : 1);
