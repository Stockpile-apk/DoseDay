// IndexedDB wrapper. All data stays on this device. Flat stores, every record has an `id`.
const DB_NAME = 'doseday';
const DB_VERSION = 1;

// store -> list of indexed fields
export const STORES = {
  profile: [], settings: [],
  weights: ['date'], checkins: ['date'], photos: ['checkinId', 'date'],
  meds: [], doses: ['medId', 'scheduledAt'], inventory: ['medId'],
  foods: [], foodLog: ['date'], waterLog: ['date'],
  vitamins: [], vitaminLog: ['date'], sideEffects: ['date'],
};

let _db = null;
export function open() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const d = req.result;
      for (const [name, indexes] of Object.entries(STORES)) {
        const store = d.objectStoreNames.contains(name) ? req.transaction.objectStore(name) : d.createObjectStore(name, { keyPath: 'id' });
        for (const ix of indexes) if (!store.indexNames.contains(ix)) store.createIndex(ix, ix, { unique: false });
      }
    };
    req.onsuccess = () => { _db = req.result; _db.onversionchange = () => { _db.close(); _db = null; }; resolve(_db); };
    req.onerror = () => reject(req.error);
  });
}

function wrap(req) { return new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); }); }
async function store(name, mode = 'readonly') { const d = await open(); return d.transaction(name, mode).objectStore(name); }

export function uid() {
  return (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
}

export const db = {
  async get(name, id) { return (await wrap((await store(name)).get(id))) || null; },
  async all(name) { return wrap((await store(name)).getAll()); },
  // put(name, obj): adds an id if missing, stamps updatedAt, returns the saved object.
  async put(name, obj) {
    const rec = { ...obj };
    if (!rec.id) rec.id = uid();
    rec.updatedAt = new Date().toISOString();
    await wrap((await store(name, 'readwrite')).put(rec));
    return rec;
  },
  async del(name, id) { await wrap((await store(name, 'readwrite')).delete(id)); },
  async clear(name) { await wrap((await store(name, 'readwrite')).clear()); },
  // where(name, 'date', '2026-11-16') -> records whose indexed field equals value
  async where(name, index, value) { return wrap((await store(name)).index(index).getAll(value)); },
  // range(name, 'date', lo, hi) -> records with lo <= field <= hi (strings compare fine for ISO dates)
  async range(name, index, lo, hi) { return wrap((await store(name)).index(index).getAll(IDBKeyRange.bound(lo, hi))); },
  async count(name) { return wrap((await store(name)).count()); },
};

// Settings: small key/value pairs.
export async function getSetting(key, fallback = null) {
  const rec = await db.get('settings', key);
  return rec ? rec.value : fallback;
}
export async function setSetting(key, value) { await db.put('settings', { id: key, value }); return value; }

// Profile: one record with id 'main'.
export const DEFAULT_PROFILE = {
  id: 'main', sex: '', birthYear: null, heightCm: null, startKg: null, goalKg: null,
  activity: 'inactive', units: 'kg', stillEscalating: false,
  tiers: { lowPct: 0.2, fastPct: 0.75, fastKg: 0.9 },
  targets: {}, // user overrides: { kcal, proteinG, waterMl, fibreG, deficit }
};
export async function getProfile() {
  const p = await db.get('profile', 'main');
  return { ...DEFAULT_PROFILE, ...(p || {}), tiers: { ...DEFAULT_PROFILE.tiers, ...((p && p.tiers) || {}) }, targets: { ...((p && p.targets) || {}) } };
}
export async function saveProfile(patch) {
  const cur = await getProfile();
  return db.put('profile', { ...cur, ...patch, id: 'main' });
}

// ---- Backup ----
function blobToDataURL(blob) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(blob); });
}
async function dataURLToBlob(url) { return (await fetch(url)).blob(); }

// exportAll({photos:false}) -> plain object ready for JSON.stringify
export async function exportAll({ photos = false } = {}) {
  const out = { app: 'DoseDay', format: 1, exportedAt: new Date().toISOString(), includesPhotos: !!photos, stores: {} };
  for (const name of Object.keys(STORES)) {
    if (name === 'photos') {
      if (!photos) continue;
      const rows = await db.all('photos');
      out.stores.photos = [];
      for (const p of rows) out.stores.photos.push({ ...p, blob: p.blob ? await blobToDataURL(p.blob) : null });
    } else out.stores[name] = await db.all(name);
  }
  return out;
}
// importAll(obj, {replace:true}) -> {counts}. replace clears each store present in the file first.
export async function importAll(obj, { replace = true } = {}) {
  if (!obj || obj.app !== 'DoseDay' || !obj.stores) throw new Error('This is not a DoseDay backup file.');
  const counts = {};
  for (const [name, rows] of Object.entries(obj.stores)) {
    if (!(name in STORES) || !Array.isArray(rows)) continue;
    // Convert first: awaiting anything else inside an IndexedDB transaction would close it.
    const recs = [];
    for (const row of rows) {
      if (!row || !row.id) continue;
      const rec = { ...row };
      if (name === 'photos' && typeof rec.blob === 'string') rec.blob = await dataURLToBlob(rec.blob);
      recs.push(rec);
    }
    if (replace) await db.clear(name);
    const s = await store(name, 'readwrite');
    const done = new Promise((res, rej) => { s.transaction.oncomplete = res; s.transaction.onerror = () => rej(s.transaction.error); });
    for (const rec of recs) s.put(rec);
    await done;
    counts[name] = rows.length;
  }
  return { counts };
}
export async function wipeAll() { for (const name of Object.keys(STORES)) await db.clear(name); }
