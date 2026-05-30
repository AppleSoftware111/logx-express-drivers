import { cpSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dest = join(root, 'dist', 'locales');
const src = join(root, 'locales');

if (!existsSync(src)) {
  console.warn('[i18n] no locales folder to copy');
  process.exit(0);
}

mkdirSync(dirname(dest), { recursive: true });
cpSync(src, dest, { recursive: true });
console.log('[i18n] copied locales to dist/locales');
