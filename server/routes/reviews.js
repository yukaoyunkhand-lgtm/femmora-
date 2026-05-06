const express = require('express');
const router = express.Router();
const db = require('../db');

const COL = 'reviews';

// GET /api/reviews
router.get('/', async (req, res) => {
  try {
    let snap;
    try {
      snap = await db.collection(COL).orderBy('created_at', 'desc').limit(50).get();
    } catch (e) {
      // Firestore index бэлэн болоогүй бол санах ойд эрэмбэлнэ
      snap = await db.collection(COL).limit(50).get();
    }
    const docs = snap.docs.map(d => d.data());
    docs.sort((a, b) => (b.created_at > a.created_at ? 1 : -1));
    res.json(docs);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/reviews
router.post('/', async (req, res) => {
  try {
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
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
