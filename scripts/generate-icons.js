import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');

const svgContent = readFileSync(join(publicDir, 'icon.svg'), 'utf-8');

async function generateIcons() {
  console.log('Generating PWA icons...');
  
  // Generate 512x512
  await sharp(Buffer.from(svgContent))
    .resize(512, 512)
    .png()
    .toFile(join(publicDir, 'icon-512.png'));
  console.log('✓ icon-512.png created');
  
  // Generate 192x192
  await sharp(Buffer.from(svgContent))
    .resize(192, 192)
    .png()
    .toFile(join(publicDir, 'icon-192.png'));
  console.log('✓ icon-192.png created');
  
  // Generate apple-touch-icon (180x180)
  await sharp(Buffer.from(svgContent))
    .resize(180, 180)
    .png()
    .toFile(join(publicDir, 'apple-touch-icon.png'));
  console.log('✓ apple-touch-icon.png created');
  
  // Generate favicon (32x32)
  await sharp(Buffer.from(svgContent))
    .resize(32, 32)
    .png()
    .toFile(join(publicDir, 'favicon-32x32.png'));
  console.log('✓ favicon-32x32.png created');
  
  console.log('\n✅ All icons generated successfully!');
}

generateIcons().catch(console.error);

