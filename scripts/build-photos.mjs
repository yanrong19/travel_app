// Makes web-sized copies of the source photos: a large hero size and a card size.
// Run with: node scripts/build-photos.mjs
import { readdirSync, mkdirSync, copyFileSync } from 'node:fs';
import sharp from 'sharp';

const src = new URL('../photos-src/', import.meta.url);
const out = new URL('../public/photos/', import.meta.url);
mkdirSync(out, { recursive: true });

for (const file of readdirSync(src).filter((f) => f.endsWith('.jpg'))) {
  const name = file.replace(/\.jpg$/, '');
  const input = new URL(file, src).pathname.replace(/^\/([A-Z]:)/, '$1');
  await sharp(input).resize({ width: 1600 }).webp({ quality: 72 }).toFile(new URL(`${name}-1600.webp`, out).pathname.replace(/^\/([A-Z]:)/, '$1'));
  await sharp(input).resize({ width: 720 }).webp({ quality: 70 }).toFile(new URL(`${name}-720.webp`, out).pathname.replace(/^\/([A-Z]:)/, '$1'));
  console.log('ok', name);
}
// Credits travel with the app so every photo can be attributed.
copyFileSync(new URL('credits.json', src), new URL('../src/data/photo-credits.json', import.meta.url));
