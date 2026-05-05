const express = require('express');
const router = express.Router();
const db = require('../db');

const COL = 'reviews';

// GET /api/reviews
router.get('/', async (req, res) => {
  try {
    const snap = await db.collection(COL).orderBy('created_at', 'desc').limit(50).get();
    res.json(snap.docs.map(d => d.data()));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/reviews
router.post('/', async (req, res) => {
  const { name, rating, comment } = req.body;
  if (!name || !comment) return res.status(400).json({ error: 'Нэр болон сэтгэгдэл шаардлагатай' });
  const r = Number(rating);
  if (!r || r < 1 || r > 5) return res.status(400).json({ error: 'Үнэлгээ 1-5 хооронд байх ёстой' });
  const doc = {
    name: name.trim(),
    rating: r,
    comment: comment.trim(),
    created_at: new Date().toISOString(),
  };
  const ref = await db.collection(COL).add(doc);
  res.json({ success: true, id: ref.id, ...doc });
});

module.exports = router;
