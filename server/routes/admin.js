const express = require('express');
const router = express.Router();
const db = require('../db');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'femmora2025';
const COL = 'orders';
const sessions = new Set();

function requireAuth(req, res, next) {
  const token = req.headers['x-admin-token'];
  if (!token || !sessions.has(token)) return res.status(401).json({ error: 'Нэвтрэх шаардлагатай' });
  next();
}

router.post('/login', (req, res) => {
  if (req.body.password !== ADMIN_PASSWORD)
    return res.status(401).json({ error: 'Нууц үг буруу' });
  const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
  sessions.add(token);
  res.json({ token });
});

router.post('/logout', (req, res) => {
  sessions.delete(req.headers['x-admin-token']);
  res.json({ success: true });
});

router.get('/stats', requireAuth, async (req, res) => {
  const snap = await db.collection(COL).get();
  const orders = snap.docs.map(d => d.data());

  const paid = orders.filter(o => ['paid','shipped','delivered'].includes(o.status));
  const revenue = paid.reduce((s, o) => s + o.amount, 0);

  const daily = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    daily[d.toISOString().slice(0, 10)] = 0;
  }
  paid.forEach(o => {
    const day = o.created_at.slice(0, 10);
    if (day in daily) daily[day] += o.amount;
  });

  res.json({
    total: orders.length,
    paid: paid.length,
    revenue,
    pending:   orders.filter(o => o.status === 'pending').length,
    shipped:   orders.filter(o => o.status === 'shipped').length,
    delivered: orders.filter(o => o.status === 'delivered').length,
    daily,
  });
});

router.get('/orders', requireAuth, async (req, res) => {
  const { status, search } = req.query;
  let snap = await db.collection(COL).orderBy('created_at', 'desc').get();
  let orders = snap.docs.map(d => d.data());

  if (status && status !== 'all') orders = orders.filter(o => o.status === status);
  if (search) {
    const q = search.toLowerCase();
    orders = orders.filter(o =>
      o.order_no.toLowerCase().includes(q) ||
      o.name.toLowerCase().includes(q) ||
      o.phone.includes(q)
    );
  }
  res.json(orders);
});

router.patch('/orders/:order_no', requireAuth, async (req, res) => {
  const { status } = req.body;
  const allowed = ['pending','paid','shipped','delivered','cancelled'];
  if (!allowed.includes(status)) return res.status(400).json({ error: 'Буруу статус' });

  const update = { status };
  if (status === 'paid') {
    const doc = await db.collection(COL).doc(req.params.order_no).get();
    if (doc.exists && !doc.data().paid_at) update.paid_at = new Date().toISOString();
  }
  await db.collection(COL).doc(req.params.order_no).update(update);
  res.json({ success: true });
});

router.delete('/orders/:order_no', requireAuth, async (req, res) => {
  await db.collection(COL).doc(req.params.order_no).delete();
  res.json({ success: true });
});

module.exports = router;
