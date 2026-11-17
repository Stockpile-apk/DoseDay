// Renders the app icons from tools/icon.svg. Run: node tools/make-icons.mjs
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire('/opt/npm-tools/node_modules/');
const sharp = require('sharp');
const svg = readFileSync(new URL('./icon.svg', import.meta.url));
const out = new URL('../www/icons/', import.meta.url).pathname;
await sharp(svg).resize(192, 192).png().toFile(out + 'icon-192.png');
await sharp(svg).resize(512, 512).png().toFile(out + 'icon-512.png');
// Maskable: same art on a full-bleed background with safe padding.
const inner = await sharp(svg).resize(400, 400).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: '#0f1720' } })
  .composite([{ input: inner, left: 56, top: 56 }]).png().toFile(out + 'maskable-512.png');
console.log('icons written');
