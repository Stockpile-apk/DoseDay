// Hand-drawn 1 mL U-100 syringe, laid horizontally. Needle on the left (0 units), plunger on the right (100).
const NS = 'http://www.w3.org/2000/svg';
function s(tag, attrs, text) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, String(v));
  if (text !== undefined) el.textContent = text;
  return el;
}
const X0 = 30, W = 300, TOP = 44, BOT = 84; // barrel box; 3 px per unit

// units: number or null. label: text for the marker.
export function syringeSvg(units, label) {
  const svg = s('svg', { viewBox: '0 0 360 120', class: 'chart', role: 'img', 'aria-label': units == null ? 'U-100 syringe' : `U-100 syringe showing ${label}`, style: 'color:var(--text)' });
  const x = u => X0 + u * 3;
  const over = units != null && units > 100;
  const fillTo = units == null ? 0 : Math.max(0, Math.min(100, units));
  // needle and plunger
  svg.append(s('line', { x1: 4, y1: 64, x2: X0, y2: 64, stroke: 'currentColor', 'stroke-width': 2 }));
  svg.append(s('rect', { x: X0 + W, y: 60, width: 14, height: 8, fill: 'var(--line)', stroke: 'currentColor', 'stroke-width': 1.5 }));
  svg.append(s('line', { x1: X0 + W + 14, y1: 48, x2: X0 + W + 14, y2: 80, stroke: 'currentColor', 'stroke-width': 3 }));
  // fill
  if (fillTo > 0) svg.append(s('rect', { x: X0, y: TOP, width: fillTo * 3, height: BOT - TOP, fill: 'var(--accent)', opacity: over ? 0.55 : 0.35 }));
  // barrel
  svg.append(s('rect', { x: X0, y: TOP, width: W, height: BOT - TOP, rx: 3, fill: 'none', stroke: 'currentColor', 'stroke-width': 2 }));
  // ticks: every 2 units, longer + numbers every 10
  for (let u = 0; u <= 100; u += 2) {
    const major = u % 10 === 0;
    svg.append(s('line', { x1: x(u), y1: BOT, x2: x(u), y2: BOT - (major ? 16 : 8), stroke: 'currentColor', 'stroke-width': major ? 1.5 : 1, opacity: major ? 1 : 0.7 }));
    if (major) svg.append(s('text', { x: x(u), y: BOT + 15, 'text-anchor': 'middle', 'font-size': 10, fill: 'var(--muted)' }, u));
  }
  if (units != null && !over) {
    const mx = x(fillTo);
    svg.append(s('line', { x1: mx, y1: TOP - 10, x2: mx, y2: BOT + 2, stroke: 'var(--accent)', 'stroke-width': 3.5, 'stroke-linecap': 'round' }));
    const anchor = mx < 70 ? 'start' : mx > 290 ? 'end' : 'middle';
    svg.append(s('text', { x: mx, y: TOP - 16, 'text-anchor': anchor, 'font-size': 14, 'font-weight': 700, fill: 'currentColor' }, label));
  } else if (over) {
    svg.append(s('text', { x: X0 + W / 2, y: TOP - 16, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, fill: 'currentColor' }, 'Syringe full: ' + label + ' does not fit'));
  }
  svg.append(s('text', { x: X0, y: 112, 'font-size': 10, fill: 'var(--muted)' }, '1 mL U-100 insulin syringe (100 units = 1 mL)'));
  return svg;
}
