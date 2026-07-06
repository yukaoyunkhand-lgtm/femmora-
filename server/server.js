require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
require('dotenv').config(); // fallback: server/.env
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT = path.join(__dirname, '..');

app.use(cors());
app.use(express.json({ strict: false, limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Frontend статик файлуудыг serve хийх
// index:false — нүүр хуудас catch-all-аар дамжиж rating injection хийгдэнэ
app.use(express.static(path.join(ROOT, 'dist'), {
  index: false,
  setHeaders(res, filePath) {
    if (/[\\/]admin[\\/]/.test(filePath)) {
      res.setHeader('X-Robots-Tag', 'noindex, nofollow');
      res.setHeader('Cache-Control', 'no-store');
    } else if (/\.(jpe?g|png|webp|avif|ico|woff2?)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=2592000, immutable');
    } else if (/\.(css|js)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
    }
  }
}));

// API routes — алдаа барьж сервер унахаас сэргийлнэ
try {
  app.use('/api/orders',    require('./routes/orders'));
  app.use('/api/qpay',      require('./routes/qpay'));
  app.use('/api/admin',     require('./routes/admin'));
  app.use('/api/my-orders', require('./routes/myorders'));
  app.use('/api/reviews',   require('./routes/reviews'));
  app.use('/api/b2b',       require('./routes/b2b'));
  app.use('/api/b2b-sales', require('./routes/b2bsales'));
  app.use('/api/leads',     require('./routes/leads'));
  app.use('/api/cron',      require('./routes/cron'));
} catch (e) {
  console.error('Route load error:', e.message);
  app.use('/api', (_, res) => res.status(500).json({ error: e.message }));
}

// Health check
app.get('/api/health', (_, res) => res.json({ status: 'ok', time: new Date(), env: !!process.env.FIREBASE_SERVICE_ACCOUNT }));

// Admin fallback
app.get('/admin', (_, res) => {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.sendFile(path.join(ROOT, 'dist/admin/index.html'));
});

// SEO: сэтгэгдлүүдийн дундаж үнэлгээг JSON-LD-д шигтгэнэ (6 цагийн кэш)
let htmlCache = null;
let agg = { json: '', ts: 0 };

async function getAgg() {
  if (agg.json && Date.now() - agg.ts < 6 * 3600e3) return agg.json;
  try {
    const db = require('./db');
    const snap = await db.collection('reviews').limit(50).get();
    const ratings = snap.docs.map(d => Number(d.data().rating)).filter(r => r >= 1 && r <= 5);
    agg.json = ratings.length >= 3
      ? `"aggregateRating": {"@type":"AggregateRating","ratingValue":"${(ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)}","reviewCount":${ratings.length}}`
      : '"x-agg": "none"';
    agg.ts = Date.now();
  } catch (e) {
    console.error('AggregateRating fetch error:', e.message);
  }
  return agg.json;
}

// SPA fallback
app.get('*', async (req, res) => {
  if (req.path.startsWith('/admin')) res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  if (!htmlCache) htmlCache = fs.readFileSync(path.join(ROOT, 'dist/index.html'), 'utf8');
  const replacement = (await getAgg()) || '"x-agg": "none"';
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=600, stale-while-revalidate=86400');
  res.send(htmlCache.replace('"x-agg": "__AGG__"', replacement));
});

// Локал дээр сервер эхлүүлэх, Vercel дээр export хийх
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Femmora сервер ажиллаж байна: http://localhost:${PORT}`);
  });
}

module.exports = app;
