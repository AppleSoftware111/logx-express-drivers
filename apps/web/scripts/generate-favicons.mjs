/**
 * Generates static favicon assets from public/favicon.svg.
 * Run: node scripts/generate-favicons.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const publicDir = path.join(root, 'public');

const svgPath = path.join(publicDir, 'favicon.svg');
const svg = fs.readFileSync(svgPath);

let sharp;
try {
  sharp = (await import('sharp')).default;
} catch {
  console.error('Install sharp: npm install sharp --save-dev -w @logx/web');
  process.exit(1);
}

const sizes = [
  { name: 'favicon-16x16.png', size: 16 },
  { name: 'favicon-32x32.png', size: 32 },
  { name: 'android-chrome-192x192.png', size: 192 },
  { name: 'android-chrome-512x512.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180 },
];

for (const { name, size } of sizes) {
  const out = path.join(publicDir, name);
  await sharp(svg).resize(size, size).png().toFile(out);
  console.log('Wrote', name);
}

// favicon.ico (16 + 32)
const png16 = await sharp(svg).resize(16, 16).png().toBuffer();
const png32 = await sharp(svg).resize(32, 32).png().toBuffer();

const { default: pngToIco } = await import('png-to-ico');
const ico = await pngToIco([png16, png32]);

const icoPublic = path.join(publicDir, 'favicon.ico');
fs.writeFileSync(icoPublic, ico);
console.log('Wrote favicon.ico');

const manifest = {
  name: 'LOGX BioPoli',
  short_name: 'BioPoli',
  description: 'Healthcare logistics for recurring collection and delivery operations',
  icons: [
    { src: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
    { src: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
  ],
  theme_color: '#2563eb',
  background_color: '#1d4ed8',
  display: 'standalone',
};

fs.writeFileSync(
  path.join(publicDir, 'site.webmanifest'),
  JSON.stringify(manifest, null, 2)
);
console.log('Wrote site.webmanifest');
