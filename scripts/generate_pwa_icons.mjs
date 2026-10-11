import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const publicDir = 'd:/vs.code/Lottery/public';
const iconsDir = path.join(publicDir, 'icons');

if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

const sourceLogo = path.join(publicDir, 'logo.png');

async function generateIcons() {
  console.log('Generating PWA Icons...');

  // 1. Regular 192x192
  await sharp(sourceLogo)
    .resize(192, 192, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(path.join(iconsDir, 'icon-192x192.png'));
  console.log('Created icon-192x192.png');

  // 2. Regular 512x512
  await sharp(sourceLogo)
    .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(path.join(iconsDir, 'icon-512x512.png'));
  console.log('Created icon-512x512.png');

  // 3. Apple Touch Icon (180x180) on dark luxury background
  const appleBg = await sharp({
    create: {
      width: 180,
      height: 180,
      channels: 4,
      background: { r: 11, g: 14, b: 20, alpha: 1 } // #0b0e14
    }
  }).png().toBuffer();

  const logoForApple = await sharp(sourceLogo)
    .resize(144, 144, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  await sharp(appleBg)
    .composite([{ input: logoForApple, gravity: 'center' }])
    .png()
    .toFile(path.join(iconsDir, 'apple-touch-icon.png'));
  console.log('Created apple-touch-icon.png');

  // Also copy to root public for iOS standard discovery
  await sharp(appleBg)
    .composite([{ input: logoForApple, gravity: 'center' }])
    .png()
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));

  // 4. Maskable 192x192 (safe area requires ~80% inner size with dark background)
  const maskable192Bg = await sharp({
    create: {
      width: 192,
      height: 192,
      channels: 4,
      background: { r: 11, g: 14, b: 20, alpha: 1 }
    }
  }).png().toBuffer();

  const logoFor192Maskable = await sharp(sourceLogo)
    .resize(150, 150, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  await sharp(maskable192Bg)
    .composite([{ input: logoFor192Maskable, gravity: 'center' }])
    .png()
    .toFile(path.join(iconsDir, 'icon-maskable-192x192.png'));
  console.log('Created icon-maskable-192x192.png');

  // 5. Maskable 512x512
  const maskable512Bg = await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 11, g: 14, b: 20, alpha: 1 }
    }
  }).png().toBuffer();

  const logoFor512Maskable = await sharp(sourceLogo)
    .resize(400, 400, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  await sharp(maskable512Bg)
    .composite([{ input: logoFor512Maskable, gravity: 'center' }])
    .png()
    .toFile(path.join(iconsDir, 'icon-maskable-512x512.png'));
  console.log('Created icon-maskable-512x512.png');

  console.log('All PWA icons generated successfully!');
}

generateIcons().catch(err => {
  console.error(err);
  process.exit(1);
});
