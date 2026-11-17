// Sample data for smoke tests only. Runs inside the page. Never shipped to users.
export const seedScript = `(async () => {
  const { db, saveProfile, setSetting } = await import('./js/db.js');
  const pad = n => String(n).padStart(2, '0');
  const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const day = n => { const d = new Date(); d.setDate(d.getDate() + n); return d; };
  await saveProfile({ sex: 'male', birthYear: 1990, heightCm: 190.5, startKg: 150, goalKg: 110, activity: 'low', units: 'kg' });
  for (let i = 35; i >= 0; i -= 2) await db.put('weights', { id: 'w' + i, date: iso(day(-i)), kg: Math.round((150 - (35 - i) * 0.09 + (i % 3) * 0.2) * 10) / 10, note: '' });
  const start = day(-28);
  const med = { id: 'med1', name: 'Sample weekly pen', class: 'GLP-1 receptor agonist', route: 'subcutaneous', strength: 1, strengthUnit: 'mg',
    dose: 0.5, doseUnit: 'mg', active: true, schedule: { type: 'weekly', weekdays: [start.getDay()], time: '09:00', start: iso(start), end: null },
    titration: [{ from: iso(start), dose: 0.25 }, { from: iso(day(-14)), dose: 0.5 }], missed: { windowHours: 120 }, refId: 'semaglutide-injection-t2d', notes: '' };
  await db.put('meds', med);
  for (const back of [28, 21, 7]) {
    const at = day(-back); at.setHours(9, 0, 0, 0);
    await db.put('doses', { id: 'd' + back, medId: 'med1', scheduledAt: at.toISOString(), takenAt: new Date(at.getTime() + 1800000).toISOString(),
      status: 'taken', doseAmount: back > 14 ? 0.25 : 0.5, doseUnit: 'mg', siteId: back === 21 ? 'abd-r' : 'abd-l', note: '' });
  }
  await db.put('inventory', { id: 'inv1', medId: 'med1', kind: 'pen', label: 'Pen 1', strength: '1 mg', total: 4, remaining: 2, unit: 'doses', openedDate: iso(day(-14)), discardAfterDays: 56, expiry: iso(day(200)), costCad: null });
  await db.put('inventory', { id: 'inv2', medId: '', kind: 'vial', label: 'Sample vial', strength: '10 mg', total: 10, remaining: 6, unit: 'mg', mixedDate: iso(day(-10)), diluentMl: 2, concMgMl: 5, discardAfterDays: 28, expiry: '' });
  await db.put('foods', { id: 'f1', name: 'Greek yogurt cup', kcal: 150, protein: 17, carbs: 9, fat: 4, serving: '175 g' });
  await db.put('foods', { id: 'f2', name: 'Chicken breast', kcal: 220, protein: 40, carbs: 0, fat: 5, serving: '140 g' });
  const today = iso(new Date());
  await db.put('foodLog', { id: 'fl1', date: today, time: '08:10', foodId: 'f1', name: 'Greek yogurt cup', qty: 1, kcal: 150, protein: 17, carbs: 9, fat: 4 });
  await db.put('foodLog', { id: 'fl2', date: today, time: '12:30', foodId: 'f2', name: 'Chicken breast', qty: 1.5, kcal: 220, protein: 40, carbs: 0, fat: 5 });
  await db.put('waterLog', { id: 'wl1', date: today, time: '09:00', ml: 500 });
  await db.put('waterLog', { id: 'wl2', date: today, time: '13:00', ml: 750 });
  await db.put('vitamins', { id: 'v1', name: 'Vitamin D', amount: 25, unit: '\\u00B5g', nutrientKey: 'vitD', time: '08:00', active: true });
  await db.put('vitamins', { id: 'v2', name: 'Zinc (high dose)', amount: 50, unit: 'mg', nutrientKey: 'zinc', time: '08:00', active: true });
  await db.put('sideEffects', { id: 'se1', date: iso(day(-6)), type: 'Nausea', severity: 2, note: '', medId: 'med1' });
  await db.put('checkins', { id: 'c1', date: iso(day(-7)), weightKg: 147.6, photoIds: [], waistCm: 132, energy: 3, hunger: 2, sleepH: 7, flags: [], note: '' });
  await setSetting('seeded', true);
})()`;
