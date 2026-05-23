/**
 * Generates Expo app icons and splash from assets/icon.svg
 * Run: node scripts/generate-assets.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const assetsDir = path.join(__dirname, '..', 'assets');
const svgPath = path.join(assetsDir, 'icon.svg');
const svg = fs.readFileSync(svgPath);

let sharp;
try {
  sharp = (await import('sharp')).default;
} catch {
  console.error('Run from repo root: npm install sharp --save-dev -w @logx/mobile');
  process.exit(1);
}

const icon1024 = await sharp(svg).resize(1024, 1024).png().toBuffer();
await sharp(icon1024).toFile(path.join(assetsDir, 'icon.png'));
console.log('Wrote assets/icon.png (1024)');

await sharp(icon1024).resize(1024, 1024).png().toFile(path.join(assetsDir, 'adaptive-icon.png'));
console.log('Wrote assets/adaptive-icon.png (1024)');

const splashW = 1284;
const splashH = 2778;
const logoSize = 280;
const logo = await sharp(svg).resize(logoSize, logoSize).png().toBuffer();

const splash = await sharp({
  create: {
    width: splashW,
    height: splashH,
    channels: 4,
    background: { r: 29, g: 78, b: 216, alpha: 1 },
  },
})
  .composite([{ input: logo, gravity: 'center' }])
  .png()
  .toFile(path.join(assetsDir, 'splash.png'));

console.log('Wrote assets/splash.png', splash);
