// Том зургуудыг вэбэд тохирох хэмжээнд шахна. Нэг удаа ажиллуулна: npm run img:optimize
// Эх хувь нь assets-original/ дотор хадгалагдана (git-д орохгүй).
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const IMG = path.join(ROOT, 'dist', 'images');
const BACKUP = path.join(ROOT, 'assets-original');

// [файл, max өргөн, чанар]
const TARGETS = [
  ['img_02.jpg', 1920, 80], // hero (LCP)
  ['img_08.jpg', 1600, 78],
  ['img_34.jpg', 1600, 78],
  ['img_35.jpg', 1600, 78],
  ['product_2.jpg', 1600, 80],
];

async function main() {
  fs.mkdirSync(BACKUP, { recursive: true });

  for (const [name, width, quality] of TARGETS) {
    const src = path.join(IMG, name);
    if (!fs.existsSync(src)) { console.log(`алгассан (байхгүй): ${name}`); continue; }

    const bak = path.join(BACKUP, name);
    if (!fs.existsSync(bak)) fs.copyFileSync(src, bak);

    const before = fs.statSync(src).size;
    const buf = await sharp(bak)
      .rotate() // EXIF orientation хадгална
      .resize({ width, withoutEnlargement: true })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();
    fs.writeFileSync(src, buf);
    console.log(`${name}: ${(before / 1048576).toFixed(1)}MB → ${(buf.length / 1024).toFixed(0)}KB`);
  }

  // OG cover: product_2 эхээс 1200x630 center-crop
  const ogSrc = path.join(BACKUP, 'product_2.jpg');
  if (fs.existsSync(ogSrc)) {
    const og = path.join(IMG, 'og-cover.jpg');
    const buf = await sharp(ogSrc)
      .rotate()
      .resize(1200, 630, { fit: 'cover', position: 'centre' })
      .jpeg({ quality: 80, mozjpeg: true })
      .toBuffer();
    fs.writeFileSync(og, buf);
    console.log(`og-cover.jpg: ${(buf.length / 1024).toFixed(0)}KB`);
  }

  // product_1.jpg — хаана ч ашиглагдаагүй 16.8MB файл, bundle-ээс хасна
  const p1 = path.join(IMG, 'product_1.jpg');
  if (fs.existsSync(p1)) {
    const bak = path.join(BACKUP, 'product_1.jpg');
    if (!fs.existsSync(bak)) fs.copyFileSync(p1, bak);
    fs.unlinkSync(p1);
    console.log('product_1.jpg: устгав (backup: assets-original/)');
  }

  console.log('Дууслаа.');
}

main().catch(e => { console.error(e); process.exit(1); });
