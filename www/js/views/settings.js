// Settings: look, backup and restore, disclaimer, about.
import { h, btn, card, banner, kv, select, checkbox, toast, confirmBox, infoLine } from '../ui.js';
import { db, getSetting, setSetting, exportAll, importAll, wipeAll, STORES } from '../db.js';
import { saveFile, pickFile, persistStorage, storageEstimate, isStandalone } from '../platform.js';
import { applyTheme, showDisclaimer } from '../app.js';
import { todayISO, fmtDate, daysBetween } from '../dates.js';
import { VERSION, DATA_NOTE } from '../version.js';

async function doExport(photos) {
  const data = await exportAll({ photos });
  const name = `doseday-backup-${todayISO()}${photos ? '-with-photos' : ''}.json`;
  const how = await saveFile(name, JSON.stringify(data), 'application/json', { share: true });
  if (how === 'cancelled') return;
  await setSetting('lastBackup', todayISO());
  toast(how === 'shared' ? 'Backup shared' : 'Backup saved to Downloads', 'ok');
}

async function doImport(ctx) {
  const file = await pickFile('application/json,.json');
  if (!file) return;
  let obj;
  try { obj = JSON.parse(await file.text()); } catch { return toast('That file is not valid JSON.', 'danger'); }
  if (!obj || obj.app !== 'DoseDay') return toast('That is not a DoseDay backup file.', 'danger');
  const when = obj.exportedAt ? fmtDate(obj.exportedAt, { year: true }) : 'an unknown date';
  const ok = await confirmBox(`Restore the backup from ${when}? This replaces the data now on this phone${obj.includesPhotos ? ', photos included' : ' (photos on this phone are kept)'}.`,
    { okText: 'Restore', danger: true, title: 'Restore backup' });
  if (!ok) return;
  try {
    const { counts } = await importAll(obj, { replace: true });
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    toast(`Restored ${total} records`, 'ok');
    await applyTheme();
    ctx.refresh();
  } catch (e) { toast('Restore failed: ' + (e && e.message ? e.message : e), 'danger', 6000); }
}

export async function render(root, ctx) {
  const [theme, big, lastBackup, est] = await Promise.all([getSetting('theme', 'dark'), getSetting('bigText', false), getSetting('lastBackup', null), storageEstimate()]);
  const persisted = navigator.storage && navigator.storage.persisted ? await navigator.storage.persisted() : false;
  let records = 0;
  for (const name of Object.keys(STORES)) records += await db.count(name);

  // Backup
  const age = lastBackup ? daysBetween(lastBackup, todayISO()) : null;
  const bcard = card('Backup');
  if (records > 20 && (age === null || age >= 7)) {
    bcard.append(banner('warn', age === null ? 'No backup yet' : `Last backup was ${age} days ago`,
      'Your data lives only on this phone. Clearing browser data or losing the phone would remove it.'));
  }
  bcard.append(
    kv('Last backup', lastBackup ? fmtDate(lastBackup, { year: true }) : 'Never'),
    kv('Records on this phone', String(records)),
    btn('Back up now', () => doExport(false), 'primary block'),
    btn('Back up with photos (larger file)', () => doExport(true), 'block'),
    btn('Restore from a backup file', () => doImport(ctx), 'block'),
    h('p', { class: 'source' }, 'The backup is one file. Keep a copy somewhere other than this phone, for example in your email or cloud drive. Always back up before an update.'));
  root.append(bcard);

  // Look
  const themeSel = select([{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }], theme);
  themeSel.addEventListener('change', async () => { await setSetting('theme', themeSel.value); await applyTheme(); });
  root.append(card('Look',
    h('label', { class: 'field' }, h('span', 'Theme'), themeSel),
    checkbox('Larger text', big, async v => { await setSetting('bigText', v); await applyTheme(); }),
    h('a', { class: 'btn', href: '#/profile' }, 'Weight units and targets')));

  // Storage
  root.append(card('Storage on this phone',
    kv('Installed as an app', isStandalone() ? 'Yes' : 'No (open the browser menu and choose Install app or Add to Home screen)'),
    kv('Protected from automatic clearing', persisted ? 'Yes' : 'Not yet'),
    est && est.usage ? kv('Space used', `${(est.usage / 1048576).toFixed(1)} MB`) : null,
    persisted ? null : btn('Ask the browser to protect this data', async () => {
      const ok = await persistStorage();
      toast(ok ? 'Protected' : 'The browser did not grant it yet. Installing the app usually helps.', ok ? 'ok' : 'warn', 5000);
      ctx.refresh();
    })));

  // About
  root.append(card('About',
    kv('Version', VERSION),
    h('p', { class: 'source' }, DATA_NOTE),
    h('p', { class: 'source' }, 'Reference updates arrive with new app versions. Each library entry shows the date it was last reviewed.'),
    btn('Read the disclaimer', () => showDisclaimer({ mustAccept: false })),
    h('a', { class: 'btn', href: '#/library' }, 'Reference library and sources')));

  // Danger zone
  root.append(card('Erase',
    btn('Erase all data on this phone', async () => {
      if (!(await confirmBox('Erase every record and photo in DoseDay on this phone? This cannot be undone. Back up first if you want to keep anything.', { okText: 'Erase', danger: true, title: 'Erase all data' }))) return;
      if (!(await confirmBox('Last check: erase everything now?', { okText: 'Yes, erase', danger: true, title: 'Are you sure?' }))) return;
      await wipeAll();
      toast('All data erased');
      location.hash = '#/home'; location.reload();
    }, 'danger block')));
  root.append(infoLine());
}
