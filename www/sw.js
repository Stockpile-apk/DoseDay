// DoseDay service worker: works offline, updates safely.
// The two lines below are rewritten by tools/build-sw.mjs. Do not edit them by hand.
const CACHE = 'doseday-0.7.0-2e9501e2';
const FILES = ["./","css/app.css","data/community.json","data/reference.json","data/targets.json","icons/icon-192.png","icons/icon-512.png","icons/maskable-512.png","index.html","js/app.js","js/dates.js","js/db.js","js/logic/calc.js","js/logic/ics.js","js/logic/nutrition.js","js/logic/rate.js","js/logic/schedule.js","js/logic/targets.js","js/platform.js","js/reminders-run.js","js/ui.js","js/units.js","js/version.js","js/views/calc-syringe.js","js/views/calc.js","js/views/checkin-compare.js","js/views/checkin-form.js","js/views/checkin-shared.js","js/views/checkin-view.js","js/views/checkin.js","js/views/community-detail.js","js/views/community.js","js/views/food-common.js","js/views/food-favs.js","js/views/food-sheets.js","js/views/food-today.js","js/views/food-vitamins.js","js/views/food-water.js","js/views/food.js","js/views/home.js","js/views/inventory-edit.js","js/views/inventory-rules.js","js/views/inventory.js","js/views/library-common.js","js/views/library-detail.js","js/views/library-topic.js","js/views/library.js","js/views/lock.js","js/views/meds-common.js","js/views/meds-edit.js","js/views/meds-effects.js","js/views/meds-history.js","js/views/meds-log.js","js/views/meds-sites.js","js/views/meds.js","js/views/mix.js","js/views/more.js","js/views/profile.js","js/views/reminders.js","js/views/report.js","js/views/settings.js","js/views/warning.js","js/views/weight.js","manifest.webmanifest"];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('doseday-') && k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});
// The page asks the waiting worker to take over when the user taps "Update ready".
self.addEventListener('message', event => { if (event.data === 'skipWaiting') self.skipWaiting(); });

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      return res;
    } catch {
      if (req.mode === 'navigate') return (await cache.match('./')) || Response.error();
      return Response.error();
    }
  })());
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (all.length) return all[0].focus();
    return self.clients.openWindow('./index.html#/home');
  })());
});
