import sharp from 'sharp';
import { mkdirSync, existsSync } from 'fs';

if (!existsSync('public/logo.png')) {
  console.error('Error: public/logo.png not found');
  process.exit(1);
}

try {
  mkdirSync('public/icons', { recursive: true });

  const sizes = [192, 512];
  for (const size of sizes) {
    await sharp('public/logo.png')
      .resize(size, size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .png()
      .toFile(`public/icons/icon-${size}.png`);
    console.log(`Generated icon-${size}.png`);
  }

  // Maskable: logo diperkecil ke 65% kanvas (safe zone) supaya tidak
  // terpotong saat Android menerapkan mask adaptive-icon (crop+zoom ke
  // lingkaran/squircle). Tanpa ini, tepi logo yang mepet kanvas kepotong.
  const safeZoneScale = 0.65;
  for (const size of sizes) {
    const logoSize = Math.round(size * safeZoneScale);
    const padding = Math.round((size - logoSize) / 2);
    const resizedLogo = await sharp('public/logo.png')
      .resize(logoSize, logoSize, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      })
      .toBuffer();
    await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      },
    })
      .composite([{ input: resizedLogo, left: padding, top: padding }])
      .png()
      .toFile(`public/icons/icon-${size}-maskable.png`);
    console.log(`Generated icon-${size}-maskable.png`);
  }

  // Favicon tab browser (app/icon.png, konvensi Next.js App Router) — latar
  // transparan (bukan putih seperti ikon PWA di atas) supaya menyatu dengan
  // tab bar terang/gelap, bukan kotak putih.
  const faviconSize = 64;
  await sharp('public/logo.png')
    .resize(faviconSize, faviconSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile('app/icon.png');
  console.log('Generated app/icon.png');
} catch (error) {
  console.error('Error generating icons:', error.message);
  process.exit(1);
}
