const express = require('express');
const router = express.Router();
const db = require('../db');

const COL = 'reviews';

// GET /api/reviews
router.get('/', async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  try {
    let docs = [];
    try {
      const snap = await db.collection(COL).orderBy('created_at', 'desc').limit(50).get();
      docs = snap.docs.map(d => d.data());
    } catch (e) {
      // index бэлэн болоогүй бол санах ойд эрэмбэлнэ
      const snap = await db.collection(COL).limit(50).get();
      docs = snap.docs.map(d => d.data());
      docs.sort((a, b) => (b.created_at > a.created_at ? 1 : -1));
    }
    return res.json(docs);
  } catch (e) {
    return res.status(500).json({ error: 'Сэтгэгдэл ачаалахад алдаа гарлаа: ' + e.message });
  }
});

// POST /api/reviews
router.post('/', async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  try {
    const { name, rating, comment } = req.body || {};
    if (!name || !comment)
      return res.status(400).json({ error: 'Нэр болон сэтгэгдэл шаардлагатай' });
    const r = Number(rating);
    if (!r || r < 1 || r > 5)
      return res.status(400).json({ error: 'Үнэлгээ 1-5 хооронд байх ёстой' });

    const doc = {
      name: String(name).trim(),
      rating: r,
      comment: String(comment).trim(),
      created_at: new Date().toISOString(),
    };
    const ref = await db.collection(COL).add(doc);
    return res.json({ success: true, id: ref.id, ...doc });
  } catch (e) {
    return res.status(500).json({ error: 'Сэтгэгдэл хадгалахад алдаа гарлаа: ' + e.message });
  }
});

module.exports = router;
