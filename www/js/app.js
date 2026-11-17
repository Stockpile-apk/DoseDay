// Boot, router and shell. Routes are hash based: #/meds/edit/abc -> view 'meds', path ['edit','abc'].
import { h, mount, toast, sheet, btn, banner } from './ui.js';
import { open, getSetting, setSetting } from './db.js';
import { persistStorage } from './platform.js';
import { VERSION } from './version.js';

// route -> { load, title, tab } ; tab = which bottom-nav button lights up
const ROUTES = {
  home: { load: () => import('./views/home.js'), title: 'DoseDay', tab: 'home' },
  meds: { load: () => import('./views/meds.js'), title: 'Meds', tab: 'meds' },
  food: { load: () => import('./views/food.js'), title: 'Food and water', tab: 'food' },
  weight: { load: () => import('./views/weight.js'), title: 'Weight', tab: 'weight' },
  more: { load: () => import('./views/more.js'), title: 'More', tab: 'more' },
  checkin: { load: () => import('./views/checkin.js'), title: 'Weekly check-in', tab: 'weight' },
  profile: { load: () => import('./views/profile.js'), title: 'Profile and targets', tab: 'more' },
  library: { load: () => import('./views/library.js'), title: 'Reference library', tab: 'more' },
  warning: { load: () => import('./views/warning.js'), title: 'Warning signs', tab: 'more' },
  mix: { load: () => import('./views/mix.js'), title: 'Mix and measure', tab: 'more' },
  calc: { load: () => import('./views/calc.js'), title: 'Syringe calculator', tab: 'more' },
  inventory: { load: () => import('./views/inventory.js'), title: 'Inventory', tab: 'more' },
  reminders: { load: () => import('./views/reminders.js'), title: 'Reminders', tab: 'more' },
  settings: { load: () => import('./views/settings.js'), title: 'Settings and backup', tab: 'more' },
};
const TABS = ['home', 'meds', 'food', 'weight', 'more'];

const view = document.getElementById('view');
const titleEl = document.getElementById('title');
const backBtn = document.getElementById('back');
const topRight = document.getElementById('top-right');
let renderToken = 0;

export function go(hash) { if (location.hash === hash) render(); else location.hash = hash; }

function parse() {
  const raw = (location.hash || '#/home').replace(/^#\/?/, '');
  const [pathPart, queryPart = ''] = raw.split('?');
  const segs = pathPart.split('/').filter(Boolean).map(decodeURIComponent);
  return { name: segs[0] || 'home', path: segs.slice(1), query: new URLSearchParams(queryPart) };
}

async function render() {
  const token = ++renderToken;
  const { name, path, query } = parse();
  const route = ROUTES[name] || ROUTES.home;
  const routeName = ROUTES[name] ? name : 'home';
  document.querySelectorAll('#nav a').forEach(a => a.classList.toggle('on', a.dataset.tab === route.tab));
  titleEl.textContent = route.title;
  mount(topRight);
  const deep = !TABS.includes(routeName) || path.length > 0;
  backBtn.hidden = !deep;
  const ctx = {
    path, query, go,
    refresh: () => render(),
    setTitle: t => { if (token === renderToken) titleEl.textContent = t; },
    setAction: node => { if (token === renderToken) mount(topRight, node); },
    back: () => goBack(),
  };
  try {
    const mod = await route.load();
    if (token !== renderToken) return;
    const root = h('div', { class: 'stack' });
    await mod.render(root, ctx);
    if (token !== renderToken) return;
    mount(view, root);
    view.scrollTop = 0;
  } catch (err) {
    console.error(err);
    if (token !== renderToken) return;
    mount(view, banner('danger', 'Something went wrong on this screen', String(err && err.message ? err.message : err)),
      btn('Go to Home', () => go('#/home'), 'primary mt'));
  }
}

function goBack() {
  const { name, path } = parse();
  if (path.length > 0) go('#/' + [name, ...path.slice(0, -1)].join('/'));
  else if (history.length > 1) history.back();
  else go('#/' + (ROUTES[name] ? ROUTES[name].tab : 'home'));
}
backBtn.addEventListener('click', goBack);
window.addEventListener('hashchange', render);

// ---- Theme ----
export async function applyTheme() {
  const theme = await getSetting('theme', 'dark');
  const big = await getSetting('bigText', false);
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.big = big ? 'on' : 'off';
  const meta = document.querySelector('meta[name=theme-color]');
  if (meta) meta.content = theme === 'light' ? '#ffffff' : '#0f1720';
}

// ---- First-run disclaimer ----
export const DISCLAIMER = [
  'DoseDay is a personal tracking tool. It gives information only. It is not medical advice and it is not a medical device.',
  'It never recommends a dose and never fills in a dose for you. Every dose you see in a form is one you typed.',
  'The reference library describes what product labels and published trials report. It can be out of date. Each entry shows the date it was last reviewed.',
  'Many peptides are not authorized for sale in Canada. Health Canada warns that unauthorized injectable products may differ in purity and dose from what the label says.',
  'Follow your prescriber and the product label. Talk to a doctor or pharmacist before starting, stopping or changing any medicine.',
  'In an emergency call 911.',
];
export function showDisclaimer({ mustAccept = false } = {}) {
  return new Promise(resolve => {
    const body = h('div', { class: 'stack' }, DISCLAIMER.map(t => h('p', t)));
    const s = sheet({ title: 'Before you start', body, dismissable: !mustAccept, onClose: () => resolve(false),
      actions: [btn(mustAccept ? 'I understand and agree' : 'Close', async () => {
        if (mustAccept) await setSetting('disclaimerAck', new Date().toISOString());
        s.close(); resolve(true);
      }, 'primary')] });
  });
}

// ---- Service worker: offline + safe updates ----
function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('sw.js').then(reg => {
    const offer = worker => {
      const t = toast('Update ready. Tap to reload.', 'ok', 20000);
      t.style.cursor = 'pointer';
      t.addEventListener('click', () => worker.postMessage('skipWaiting'));
    };
    if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const nw = reg.installing;
      if (!nw) return;
      nw.addEventListener('statechange', () => { if (nw.state === 'installed' && navigator.serviceWorker.controller) offer(nw); });
    });
  }).catch(() => {});
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloaded) { reloaded = true; location.reload(); } });
}

async function boot() {
  await open();
  await applyTheme();
  await setSetting('version', VERSION);
  persistStorage();
  registerSW();
  if (!location.hash) history.replaceState(null, '', '#/home');
  await render();
  if (!(await getSetting('disclaimerAck'))) await showDisclaimer({ mustAccept: true });
  // Due-reminder check while the app is open (the calendar export is the reliable path).
  try { const r = await import('./reminders-run.js'); r.start(); } catch (e) { console.warn('reminders not started', e); }
}
boot().catch(err => {
  console.error(err);
  mount(view, banner('danger', 'DoseDay could not start', String(err && err.message ? err.message : err)));
});
