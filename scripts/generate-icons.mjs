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
} catch (error) {
  console.error('Error generating icons:', error.message);
  process.exit(1);
}
