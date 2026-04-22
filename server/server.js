require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
require('dotenv').config(); // fallback: server/.env
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT = path.join(__dirname, '..');

app.use(cors());
app.use(express.json({ strict: false }));

// Frontend статик файлуудыг serve хийх
app.use(express.static(path.join(ROOT, 'dist')));

// API routes
app.use('/api/orders',    require('./routes/orders'));
app.use('/api/qpay',      require('./routes/qpay'));
app.use('/api/admin',     require('./routes/admin'));
app.use('/api/my-orders', require('./routes/myorders'));

// Health check
app.get('/api/health', (_, res) => res.json({ status: 'ok', time: new Date() }));

// Admin fallback
app.get('/admin', (_, res) => res.sendFile(path.join(ROOT, 'dist/admin/index.html')));

// SPA fallback
app.get('*', (_, res) => {
  res.sendFile(path.join(ROOT, 'dist/index.html'));
});

// Локал дээр сервер эхлүүлэх, Vercel дээр export хийх
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Femmora сервер ажиллаж байна: http://localhost:${PORT}`);
  });
}

module.exports = app;
