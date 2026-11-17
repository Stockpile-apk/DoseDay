// Optional PIN lock. Keeps casual eyes out of the app; it does not encrypt the data on the phone.
// The PIN is stored only as a salted PBKDF2 hash.
import { h, btn, card, banner, field, input, select, toast, confirmBox, infoLine } from '../ui.js';
import { getSetting, setSetting, wipeAll } from '../db.js';

const ITER = 150000;
const enc = new TextEncoder();
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');

async function hashPin(pin, saltHex) {
  const salt = Uint8Array.from(saltHex.match(/../g).map(x => parseInt(x, 16)));
  const key = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITER }, key, 256));
}
const validPin = p => /^\d{4,8}$/.test(p);
export async function lockConfig() { return (await getSetting('lock', null)) || null; }

let unlockedAt = 0, hiddenAt = 0;

// Shows a full-screen PIN pad when a lock is set. Resolves once unlocked.
export async function gate() {
  const cfg = await lockConfig();
  if (!cfg || !cfg.hash) return;
  if (unlockedAt && (!hiddenAt || Date.now() - hiddenAt < (cfg.afterMin ?? 1) * 60000)) return;
  await new Promise(resolve => {
    const pinIn = input({ type: 'password', inputmode: 'numeric', autocomplete: 'off', placeholder: 'PIN', 'aria-label': 'PIN', maxlength: 8 });
    const msg = h('p', { class: 'muted small center' }, '');
    let fails = 0;
    const tryIt = async () => {
      if ((await hashPin(pinIn.value, cfg.salt)) === cfg.hash) { unlockedAt = Date.now(); hiddenAt = 0; wrap.remove(); resolve(); return; }
      fails++; pinIn.value = '';
      msg.textContent = fails >= 5 ? 'Wrong PIN. Wait 30 seconds.' : 'Wrong PIN.';
      if (fails >= 5) { pinIn.disabled = true; setTimeout(() => { pinIn.disabled = false; pinIn.focus(); }, 30000); }
    };
    pinIn.addEventListener('keydown', e => { if (e.key === 'Enter') tryIt(); });
    const forgot = btn('Forgot PIN', async () => {
      if (!(await confirmBox('Without the PIN, the only way in is to erase all DoseDay data on this phone. You can then restore your last backup file. Erase everything?', { okText: 'Erase and reset', danger: true, title: 'Forgot PIN' }))) return;
      await wipeAll(); location.reload();
    }, 'ghost');
    const wrap = h('div', { class: 'overlay', style: { alignItems: 'center', background: 'var(--bg)', zIndex: 50 } },
      h('div', { class: 'stack', style: { width: 'min(320px, 90vw)' } },
        h('h2', { class: 'center' }, 'DoseDay is locked'), pinIn, btn('Unlock', tryIt, 'primary block'), msg, forgot));
    document.body.append(wrap);
    setTimeout(() => pinIn.focus(), 50);
  });
}
// Re-lock after the app has been in the background for the chosen time.
export function watch() {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') hiddenAt = Date.now();
    else gate();
  });
}

export async function render(root, ctx) {
  const cfg = await lockConfig();
  root.append(banner('info', 'What the lock does', 'It asks for a PIN when DoseDay opens. It does not encrypt your data, and anyone who can clear the browser’s data can remove it. If you forget the PIN, the only way back in is to erase the app’s data and restore a backup.'));
  const p1 = input({ type: 'password', inputmode: 'numeric', placeholder: '4 to 8 digits', maxlength: 8 });
  const p2 = input({ type: 'password', inputmode: 'numeric', placeholder: 'Type it again', maxlength: 8 });
  const after = select([{ value: 0, label: 'Every time I switch back' }, { value: 1, label: 'After 1 minute away' }, { value: 5, label: 'After 5 minutes away' }, { value: 30, label: 'After 30 minutes away' }], cfg ? cfg.afterMin ?? 1 : 1);
  const save = async () => {
    if (!validPin(p1.value)) return toast('Use 4 to 8 digits.', 'warn');
    if (p1.value !== p2.value) return toast('The two PINs do not match.', 'warn');
    const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
    await setSetting('lock', { hash: await hashPin(p1.value, salt), salt, afterMin: Number(after.value), setOn: new Date().toISOString() });
    unlockedAt = Date.now();
    toast('PIN lock is on', 'ok'); ctx.refresh();
  };
  root.append(card(cfg ? 'Change PIN' : 'Turn on PIN lock', field('New PIN', p1), field('Confirm PIN', p2), field('Lock again', after),
    btn(cfg ? 'Save new PIN' : 'Turn on', save, 'primary block')));
  if (cfg) {
    root.append(card('Turn off', btn('Turn off PIN lock', async () => {
      if (!(await confirmBox('Turn off the PIN lock?', { okText: 'Turn off', danger: true }))) return;
      await setSetting('lock', null); toast('PIN lock is off'); ctx.refresh();
    }, 'danger block')));
  }
  root.append(h('p', { class: 'source' }, 'Fingerprint unlock needs the Android app version (later section S3b).'));
  root.append(infoLine());
}
