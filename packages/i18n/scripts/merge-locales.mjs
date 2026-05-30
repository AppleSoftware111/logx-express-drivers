import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'locales');

function deepMerge(target, source) {
  for (const [k, v] of Object.entries(source)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      target[k] = target[k] ?? {};
      deepMerge(target[k], v);
    } else if (!(k in target)) {
      target[k] = v;
    }
  }
}

for (const loc of ['es', 'en']) {
  for (const f of readdirSync(join(root, 'pt'))) {
    if (!f.endsWith('.json')) continue;
    const pt = JSON.parse(readFileSync(join(root, 'pt', f), 'utf8'));
    const target = join(root, loc, f);
    const cur = existsSync(target) ? JSON.parse(readFileSync(target, 'utf8')) : {};
    deepMerge(cur, pt);
    writeFileSync(target, JSON.stringify(cur, null, 2) + '\n');
  }
}

console.log('Merged pt keys into es/en');
