const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');
const db = require('../db');

async function verifyToken(req, res, next) {
  const auth = req.headers['authorization'];
  if (!auth || !auth.startsWith('Bearer '))
    return res.status(401).json({ error: 'Нэвтрэх шаардлагатай' });
  try {
    const decoded = await admin.auth().verifyIdToken(auth.slice(7));
    req.uid   = decoded.uid;
    req.email = decoded.email;
    next();
  } catch {
    res.status(401).json({ error: 'Token хүчингүй' });
  }
}

// GET /api/my-orders — нэвтэрсэн хэрэглэгчийн захиалгууд
router.get('/', verifyToken, async (req, res) => {
  const snap = await db.collection('orders')
    .where('uid', '==', req.uid)
    .orderBy('created_at', 'desc')
    .get();
  res.json(snap.docs.map(d => d.data()));
});

module.exports = router;
