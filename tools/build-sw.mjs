// Rewrites the file list and cache version inside www/sw.js. Run after adding files or bumping the version.
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative } from 'node:path';
const root = new URL('../www/', import.meta.url).pathname;
const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (name !== 'sw.js') files.push(relative(root, p).split('\\').join('/'));
  }
})(root);
const hash = createHash('sha256');
for (const f of files) hash.update(f).update(readFileSync(join(root, f)));
const version = readFileSync(join(root, 'js/version.js'), 'utf8').match(/VERSION = '([^']+)'/)[1];
const tag = `${version}-${hash.digest('hex').slice(0, 8)}`;
const swPath = join(root, 'sw.js');
let sw = readFileSync(swPath, 'utf8');
sw = sw.replace(/const CACHE = '[^']*';/, `const CACHE = 'doseday-${tag}';`)
  .replace(/const FILES = \[[\s\S]*?\];/, `const FILES = ${JSON.stringify(['./', ...files], null, 0)};`);
writeFileSync(swPath, sw);
console.log(`sw.js: cache doseday-${tag}, ${files.length} files`);
