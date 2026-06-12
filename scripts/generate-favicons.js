// Лого (dist/images/img_01.png)-оос favicon багц үүсгэнэ. Нэг удаа ажиллуулна: npm run img:favicons
const sharp = require('sharp');
const pngToIcoMod = require('png-to-ico');
const pngToIco = pngToIcoMod.default || pngToIcoMod;
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const LOGO = path.join(DIST, 'images', 'img_01.png');
const BG = '#f9f5ee'; // брэндийн cream өнгө (--sp)

// Логог квадрат болгож, дэвсгэр өнгөн дээр голлуулж буулгана
async function square(size, padRatio) {
  const inner = Math.round(size * (1 - padRatio * 2));
  const logo = await sharp(LOGO)
    .resize(inner, inner, { fit: 'inside' })
    .toBuffer();
  return sharp({
    create: { width: size, height: size, channels: 4, background: BG }
  })
    .composite([{ input: logo, gravity: 'centre' }])
    .png()
    .toBuffer();
}

async function main() {
  const outputs = [
    ['favicon-16.png', 16, 0.05],
    ['favicon-32.png', 32, 0.05],
    ['apple-touch-icon.png', 180, 0.12], // iOS өөрөө булан дугуйлдаг, бага зэрэг padding
    ['icon-192.png', 192, 0.1],
    ['icon-512.png', 512, 0.1],
  ];
  for (const [name, size, pad] of outputs) {
    fs.writeFileSync(path.join(DIST, name), await square(size, pad));
    console.log(`${name} (${size}x${size})`);
  }

  const ico = await pngToIco([
    await square(16, 0.05),
    await square(32, 0.05),
    await square(48, 0.05),
  ]);
  fs.writeFileSync(path.join(DIST, 'favicon.ico'), ico);
  console.log('favicon.ico (16+32+48)');
  console.log('Дууслаа.');
}

main().catch(e => { console.error(e); process.exit(1); });
