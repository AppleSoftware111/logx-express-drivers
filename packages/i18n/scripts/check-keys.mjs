import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'locales');
const locales = ['pt', 'es', 'en'];
const base = 'pt';

function flatten(obj, prefix = '') {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(out, flatten(v, key));
    } else {
      out[key] = v;
    }
  }
  return out;
}

function loadLocale(locale) {
  const dir = join(root, locale);
  const merged = {};
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.json')) continue;
    const ns = file.replace('.json', '');
    const data = JSON.parse(readFileSync(join(dir, file), 'utf8'));
    merged[ns] = data;
  }
  return flatten(merged);
}

const baseKeys = loadLocale(base);
let failed = false;

for (const locale of locales) {
  if (locale === base) continue;
  const keys = loadLocale(locale);
  for (const key of Object.keys(baseKeys)) {
    if (!(key in keys)) {
      console.error(`[${locale}] missing key: ${key}`);
      failed = true;
    }
  }
}

if (failed) process.exit(1);
console.log('All locale keys match pt baseline.');
