const express = require('express');
const router = express.Router();
const db = require('../db');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'femmora2025';

// Simple token store (in-memory, resets on server restart)
const sessions = new Set();

function requireAuth(req, res, next) {
  const token = req.headers['x-admin-token'];
  if (!token || !sessions.has(token)) {
    return res.status(401).json({ error: 'Нэвтрэх шаардлагатай' });
  }
  next();
}

// POST /api/admin/login
router.post('/login', (req, res) => {
  const { password } = req.body;
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Нууц үг буруу' });
  }
  const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
  sessions.add(token);
  res.json({ token });
});

// POST /api/admin/logout
router.post('/logout', (req, res) => {
  const token = req.headers['x-admin-token'];
  sessions.delete(token);
  res.json({ success: true });
});

// GET /api/admin/stats
router.get('/stats', requireAuth, (req, res) => {
  const orders = db.get('orders').value();
  const total   = orders.length;
  const paid    = orders.filter(o => ['paid','shipped','delivered'].includes(o.status)).length;
  const revenue = orders.filter(o => ['paid','shipped','delivered'].includes(o.status))
                        .reduce((s, o) => s + o.amount, 0);
  const pending  = orders.filter(o => o.status === 'pending').length;
  const shipped  = orders.filter(o => o.status === 'shipped').length;
  const delivered = orders.filter(o => o.status === 'delivered').length;

  // Last 7 days daily revenue
  const daily = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    daily[d.toISOString().slice(0, 10)] = 0;
  }
  orders.filter(o => ['paid','shipped','delivered'].includes(o.status)).forEach(o => {
    const day = o.created_at.slice(0, 10);
    if (day in daily) daily[day] += o.amount;
  });

  res.json({ total, paid, revenue, pending, shipped, delivered, daily });
});

// GET /api/admin/orders
router.get('/orders', requireAuth, (req, res) => {
  const { status, search } = req.query;
  let orders = db.get('orders').value().slice().reverse();
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

// PATCH /api/admin/orders/:order_no
router.patch('/orders/:order_no', requireAuth, (req, res) => {
  const { status } = req.body;
  const allowed = ['pending', 'paid', 'shipped', 'delivered', 'cancelled'];
  if (!allowed.includes(status)) return res.status(400).json({ error: 'Буруу статус' });
  const order = db.get('orders').find({ order_no: req.params.order_no }).value();
  if (!order) return res.status(404).json({ error: 'Захиалга олдсонгүй' });
  const update = { status };
  if (status === 'paid' && !order.paid_at) update.paid_at = new Date().toISOString();
  db.get('orders').find({ order_no: req.params.order_no }).assign(update).write();
  res.json({ success: true });
});

// DELETE /api/admin/orders/:order_no
router.delete('/orders/:order_no', requireAuth, (req, res) => {
  db.get('orders').remove({ order_no: req.params.order_no }).write();
  res.json({ success: true });
});

module.exports = router;
