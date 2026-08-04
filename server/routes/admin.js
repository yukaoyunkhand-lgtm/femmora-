const express = require('express');
const router  = express.Router();
const admin   = require('firebase-admin');
const db      = require('../db');
const requireAuth = require('../middleware/adminAuth');

const COL = 'orders';
const CRM = 'customers';
const DORMANT_DAYS = 60;

// Stats
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
    const day = (o.created_at || '').slice(0, 10);
    if (day in daily) daily[day] += o.amount;
  });

  const monthly = {};
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    monthly[d.toISOString().slice(0, 10)] = 0;
  }
  paid.forEach(o => {
    const day = (o.created_at || '').slice(0, 10);
    if (day in monthly) monthly[day] += o.amount;
  });

  // By-month aggregation from 2026-05 onwards
  const byMonth = {};
  const startMonth = '2026-05';
  const now = new Date();
  const endMonth = now.toISOString().slice(0, 7);
  let cur = startMonth;
  while (cur <= endMonth) {
    byMonth[cur] = 0;
    const [y, m] = cur.split('-').map(Number);
    const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
    cur = next;
  }
  paid.forEach(o => {
    const mo = (o.created_at || '').slice(0, 7);
    if (mo in byMonth) byMonth[mo] += o.amount;
  });

  const shades = {};
  orders.forEach(o => {
    const s = o.shade || '—';
    if (!shades[s]) shades[s] = { orders: 0, qty: 0 };
    shades[s].orders++;
    shades[s].qty += Number(o.quantity) || 1;
  });

  res.json({
    total:     orders.length,
    paid:      paid.length,
    revenue,
    pending:   orders.filter(o => o.status === 'pending').length,
    shipped:   orders.filter(o => o.status === 'shipped').length,
    delivered: orders.filter(o => o.status === 'delivered').length,
    daily,
    monthly,
    byMonth,
    shades,
  });
});

// Orders list
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

// Update order status + delivery info
router.patch('/orders/:order_no', requireAuth, async (req, res) => {
  const { status, delivery_person, delivery_note, expected_delivery_date } = req.body;
  const allowed = ['pending','paid','shipped','delivered','cancelled'];
  if (status && !allowed.includes(status)) return res.status(400).json({ error: 'Буруу статус' });

  const update = {};
  if (status) update.status = status;
  if (delivery_person !== undefined) update.delivery_person = delivery_person;
  if (delivery_note   !== undefined) update.delivery_note   = delivery_note;
  if (expected_delivery_date !== undefined) update.expected_delivery_date = expected_delivery_date;

  if (status === 'paid') {
    const doc = await db.collection(COL).doc(req.params.order_no).get();
    if (doc.exists && !doc.data().paid_at)
      update.paid_at = new Date().toISOString();
  }
  if (status === 'shipped') update.shipped_at = new Date().toISOString();
  if (status === 'delivered') update.delivered_at = new Date().toISOString();

  await db.collection(COL).doc(req.params.order_no).update(update);
  res.json({ success: true });
});

// Delete order
router.delete('/orders/:order_no', requireAuth, async (req, res) => {
  await db.collection(COL).doc(req.params.order_no).delete();
  res.json({ success: true });
});

// ── Payment reminder email ────────────────────────────────
router.post('/orders/:order_no/remind', requireAuth, async (req, res) => {
  const { sendPaymentReminder } = require('../mailer');
  const doc = await db.collection(COL).doc(req.params.order_no).get();
  if (!doc.exists) return res.status(404).json({ error: 'Захиалга олдсонгүй' });
  const order = doc.data();

  // Admin-аас шууд дамжуулсан имэйл → захиалгын имэйл → Firebase Auth имэйл
  let email = req.body.email || order.email || null;
  if (!email && order.uid) {
    try {
      const u = await admin.auth().getUser(order.uid);
      if (u.email) { email = u.email; }
    } catch(_) {}
  }
  if (!email) return res.status(400).json({ error: 'Имэйл хаяг байхгүй байна' });

  // Admin-аас өгсөн имэйлийг захиалганд хадгална
  if (req.body.email && req.body.email !== order.email) {
    await db.collection(COL).doc(req.params.order_no).update({ email: req.body.email });
  }

  const orderWithEmail = { ...order, email };
  const result = await sendPaymentReminder(orderWithEmail);
  if (!result.ok) return res.status(500).json({ error: result.reason });

  // Сануулга явуулсан цагийг тэмдэглэнэ
  await db.collection(COL).doc(req.params.order_no).update({ reminded_at: new Date().toISOString() });
  res.json({ success: true, email });
});

// ── Bulk remind (pending бүгдэд) ─────────────────────────
router.post('/remind-all', requireAuth, async (req, res) => {
  const { sendPaymentReminder } = require('../mailer');
  const snap = await db.collection(COL).where('status', '==', 'pending').get();
  const orders = snap.docs.map(d => d.data());
  let sent = 0, skipped = 0;
  for (const order of orders) {
    let email = order.email || null;
    if (!email && order.uid) {
      try { const u = await admin.auth().getUser(order.uid); if (u.email) email = u.email; } catch(_) {}
    }
    if (!email) { skipped++; continue; }
    const result = await sendPaymentReminder({ ...order, email });
    if (result.ok) {
      await db.collection(COL).doc(order.order_no).update({ reminded_at: new Date().toISOString() });
      sent++;
    } else skipped++;
  }
  res.json({ success: true, sent, skipped, total: orders.length });
});

// ── Customers ────────────────────────────────────────────
// Захиалгуудаас үйлчлүүлэгчдийг phone-оор бүлэглэнэ
function buildCustomers(orders) {
  const map = {};
  for (const o of orders) {
    const key = o.phone;
    if (!map[key]) {
      map[key] = {
        phone:       o.phone,
        name:        o.name,
        uid:         o.uid || null,
        orders:      [],
        total_spent: 0,
        first_order: o.created_at,
        last_order:  o.created_at,
      };
    }
    const c = map[key];
    c.orders.push(o);
    if (['paid','shipped','delivered'].includes(o.status)) c.total_spent += o.amount;
    if (o.created_at < c.first_order) c.first_order = o.created_at;
    if (o.created_at > c.last_order)  { c.last_order = o.created_at; c.name = o.name; }
  }
  return Object.values(map).map(c => ({
    ...c,
    order_count: c.orders.length,
    tier: c.total_spent >= 200000 ? 'vip'
        : c.orders.length >= 3    ? 'regular'
        : 'new',
  }));
}

// GET /api/admin/customers
router.get('/customers', requireAuth, async (req, res) => {
  const snap   = await db.collection(COL).orderBy('created_at', 'desc').get();
  const orders = snap.docs.map(d => d.data());
  const customers = buildCustomers(orders)
    .sort((a, b) => b.total_spent - a.total_spent);
  const now = Date.now();
  res.json(customers.map(({ orders: _, ...c }) => ({
    ...c,
    is_dormant: c.last_order
      ? (now - new Date(c.last_order).getTime()) / 86400000 > DORMANT_DAYS
      : false,
  })));
});

// GET /api/admin/customers/:phone
router.get('/customers/:phone', requireAuth, async (req, res) => {
  const snap   = await db.collection(COL)
    .where('phone', '==', req.params.phone).get();
  const orders = snap.docs.map(d => d.data())
    .sort((a, b) => (b.created_at || '') > (a.created_at || '') ? 1 : -1);
  if (!orders.length) return res.status(404).json({ error: 'Үйлчлүүлэгч олдсонгүй' });

  const [customer] = buildCustomers(orders);
  let firebaseUser = null;
  if (customer.uid) {
    try {
      const u = await admin.auth().getUser(customer.uid);
      firebaseUser = { email: u.email, photoURL: u.photoURL, displayName: u.displayName };
    } catch(_) {}
  }
  const crmDoc  = await db.collection(CRM).doc(req.params.phone).get();
  const crmData = crmDoc.exists ? crmDoc.data() : {};
  res.json({ ...customer, firebaseUser, notes: crmData.notes || [], tags: crmData.tags || [] });
});

// ── CRM Stats ────────────────────────────────────────────
router.get('/crm-stats', requireAuth, async (req, res) => {
  const snap   = await db.collection(COL).orderBy('created_at', 'desc').get();
  const orders = snap.docs.map(d => d.data());
  const customers = buildCustomers(orders);
  const now  = Date.now();
  const thisMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  res.json({
    total:         customers.length,
    vip:           customers.filter(c => c.tier === 'vip').length,
    dormant:       customers.filter(c => c.last_order && (now - new Date(c.last_order).getTime()) / 86400000 > DORMANT_DAYS).length,
    new_this_month: customers.filter(c => c.first_order >= thisMonthStart).length,
  });
});

// ── Customer Notes ───────────────────────────────────────
router.post('/customers/:phone/notes', requireAuth, async (req, res) => {
  const { text } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: 'Тэмдэглэл хоосон байна' });
  const note = { id: Date.now().toString(), text: text.trim(), created_at: new Date().toISOString(), author: 'admin' };
  await db.collection(CRM).doc(req.params.phone).set(
    { notes: admin.firestore.FieldValue.arrayUnion(note) }, { merge: true }
  );
  res.json({ success: true, note });
});

router.delete('/customers/:phone/notes/:id', requireAuth, async (req, res) => {
  const docRef = db.collection(CRM).doc(req.params.phone);
  const doc = await docRef.get();
  if (doc.exists) {
    const notes = (doc.data().notes || []).filter(n => n.id !== req.params.id);
    await docRef.update({ notes });
  }
  res.json({ success: true });
});

// ── Customer Tags ────────────────────────────────────────
router.post('/customers/:phone/tags', requireAuth, async (req, res) => {
  const { tag } = req.body;
  if (!tag || !tag.trim()) return res.status(400).json({ error: 'Таг хоосон байна' });
  await db.collection(CRM).doc(req.params.phone).set(
    { tags: admin.firestore.FieldValue.arrayUnion(tag.trim()) }, { merge: true }
  );
  res.json({ success: true });
});

router.delete('/customers/:phone/tags/:tag', requireAuth, async (req, res) => {
  await db.collection(CRM).doc(req.params.phone).set(
    { tags: admin.firestore.FieldValue.arrayRemove(decodeURIComponent(req.params.tag)) }, { merge: true }
  );
  res.json({ success: true });
});

// Change password via Firebase Admin
router.post('/change-password', requireAuth, async (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 6)
    return res.status(400).json({ error: 'Хамгийн багадаа 6 тэмдэгт байх ёстой' });
  try {
    await admin.auth().updateUser(req.adminUid, { password });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
