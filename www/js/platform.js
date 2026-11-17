// Everything that touches the device (notifications, files, sharing, camera) goes through here,
// so a later Android (Capacitor) build only has to swap this one file.

export const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

export function notifySupported() { return 'Notification' in window; }
export function notifyPermission() { return notifySupported() ? Notification.permission : 'unsupported'; }
export async function requestNotify() {
  if (!notifySupported()) return 'unsupported';
  if (Notification.permission === 'default') return Notification.requestPermission();
  return Notification.permission;
}
// Shows a notification while the app is open or recently active. Returns true when shown.
export async function notify(title, body, tag) {
  if (!notifySupported() || Notification.permission !== 'granted') return false;
  try {
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : null;
    const opts = { body, tag, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png' };
    if (reg && reg.showNotification) await reg.showNotification(title, opts);
    else new Notification(title, opts);
    return true;
  } catch { return false; }
}

// Save a file to the device. Uses the share sheet when asked for and available.
export async function saveFile(filename, content, mime = 'application/json', { share = false } = {}) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  if (share && navigator.canShare) {
    try {
      const file = new File([blob], filename, { type: mime });
      if (navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: filename }); return 'shared'; }
    } catch (e) { if (e && e.name === 'AbortError') return 'cancelled'; }
  }
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return 'downloaded';
}

// Ask the user to pick a file. Resolves with a File, or null if cancelled.
export function pickFile(accept = '', { capture = null } = {}) {
  return new Promise(resolve => {
    const inp = Object.assign(document.createElement('input'), { type: 'file', accept });
    if (capture) inp.setAttribute('capture', capture);
    inp.style.display = 'none';
    inp.addEventListener('change', () => { resolve(inp.files && inp.files[0] ? inp.files[0] : null); inp.remove(); });
    inp.addEventListener('cancel', () => { resolve(null); inp.remove(); });
    document.body.append(inp); inp.click();
  });
}
export const takePhoto = () => pickFile('image/*', { capture: 'environment' });

// Shrink a photo to at most maxPx on its long side. Returns a JPEG Blob.
export async function resizeImage(file, maxPx = 1280, quality = 0.8) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxPx / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale), hgt = Math.round(bmp.height * scale);
  const canvas = Object.assign(document.createElement('canvas'), { width: w, height: hgt });
  canvas.getContext('2d').drawImage(bmp, 0, 0, w, hgt);
  return new Promise(res => canvas.toBlob(res, 'image/jpeg', quality));
}

export async function persistStorage() {
  try { return navigator.storage && navigator.storage.persist ? await navigator.storage.persist() : false; } catch { return false; }
}
export async function storageEstimate() {
  try { return navigator.storage && navigator.storage.estimate ? await navigator.storage.estimate() : null; } catch { return null; }
}
