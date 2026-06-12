const express  = require('express');
const router   = express.Router();
const db       = require('../db');
const requireAdmin = require('../middleware/adminAuth');
const { sendReviewNotification } = require('../mailer');

const COL = 'reviews';

// GET /api/reviews
router.get('/', async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  try {
    let docs = [];
    try {
      const snap = await db.collection(COL).orderBy('created_at', 'desc').limit(50).get();
      docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
      const snap = await db.collection(COL).limit(50).get();
      docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      docs.sort((a, b) => (b.created_at > a.created_at ? 1 : -1));
    }
    return res.json(docs);
  } catch (e) {
    return res.status(500).json({ error: 'Сэтгэгдэл ачаалахад алдаа гарлаа: ' + e.message });
  }
});

// POST /api/reviews  (JSON: name, rating, comment, imageData?)
router.post('/', async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  try {
    const { name, rating, comment, imageData } = req.body || {};
    if (!name || !comment)
      return res.status(400).json({ error: 'Нэр болон сэтгэгдэл шаардлагатай' });
    const r = Number(rating);
    if (!r || r < 1 || r > 5)
      return res.status(400).json({ error: 'Үнэлгээ 1-5 хооронд байх ёстой' });

    // imageData нь base64 data URL байна (data:image/jpeg;base64,...)
    // Firestore 1MB document хязгаарт багтахаар frontend compress хийсэн
    const doc = {
      name:       String(name).trim(),
      rating:     r,
      comment:    String(comment).trim(),
      imageUrl:   imageData || null,   // base64 data URL шууд хадгална
      created_at: new Date().toISOString(),
    };
    const ref = await db.collection(COL).add(doc);
    sendReviewNotification(doc).catch(() => {});
    return res.json({ success: true, id: ref.id, ...doc });
  } catch (e) {
    return res.status(500).json({ error: 'Сэтгэгдэл хадгалахад алдаа гарлаа: ' + e.message });
  }
});

// DELETE /api/reviews/:id (admin)
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await db.collection(COL).doc(req.params.id).delete();
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
