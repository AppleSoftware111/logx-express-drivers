import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'locales');
const locales = ['pt', 'es', 'en'];
const suspiciousPortuguese = /\b(n[aã]o|nenhum|endere[cç]o|falha|dados|motorista|motoristas|removida|painel|voc[eê])\b/i;

function flatten(value, prefix = '', output = {}) {
  for (const [key, child] of Object.entries(value)) {
    const nextKey = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === 'object' && !Array.isArray(child)) {
      flatten(child, nextKey, output);
    } else {
      output[nextKey] = String(child);
    }
  }
  return output;
}

function readLocale(locale) {
  const localeDir = join(root, locale);
  const flattened = {};

  for (const file of readdirSync(localeDir)) {
    if (!file.endsWith('.json')) continue;
    const payload = JSON.parse(readFileSync(join(localeDir, file), 'utf8'));
    flatten(payload, file.replace('.json', ''), flattened);
  }

  return flattened;
}

const pt = readLocale('pt');
let failed = false;

for (const locale of locales) {
  if (locale === 'pt') continue;
  const current = readLocale(locale);

  for (const [key, value] of Object.entries(current)) {
    if (value === pt[key] && suspiciousPortuguese.test(value)) {
      console.error(`[${locale}] suspicious untranslated Portuguese copy at ${key}: ${value}`);
      failed = true;
      continue;
    }

    if (suspiciousPortuguese.test(value) && locale !== 'pt') {
      console.error(`[${locale}] suspicious Portuguese wording at ${key}: ${value}`);
      failed = true;
    }
  }
}

if (failed) {
  process.exit(1);
}

console.log('Translation quality checks passed.');
