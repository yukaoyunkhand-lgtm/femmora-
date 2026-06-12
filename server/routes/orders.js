const express = require('express');
const router = express.Router();
const db = require('../db');
const { createInvoice } = require('./qpay');
const { sendOrderNotification } = require('../mailer');

const PRICE_PER_UNIT = 61900;  // НӨАТ хассан нэгж үнэ
const DELIVERY_FEE  = 7000;   // Хүргэлтийн хөлс (тогтмол)
const COL = 'orders';

function genOrderNo() {
  const d = new Date();
  const ymd = d.toISOString().slice(2, 10).replace(/-/g, '');
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `FM${ymd}${rand}`;
}

// POST /api/orders
router.post('/', async (req, res) => {
  const { name, phone, address, quantity = 1, shade, email } = req.body;

  if (!name || !phone || !address)
    return res.status(400).json({ error: 'Нэр, утас, хаяг заавал шаардлагатай' });
  if (!/^[0-9]{8}$/.test(phone))
    return res.status(400).json({ error: 'Утасны дугаар 8 оронтой байх ёстой' });

  const qty    = Math.max(1, Math.min(10, Number(quantity)));
  const amount = PRICE_PER_UNIT * qty + DELIVERY_FEE;
  const order_no = genOrderNo();

  const order = {
    order_no,
    name,
    phone,
    address,
    quantity: qty,
    shade: shade || null,
    email: (email || '').trim() || null,
    unit_price:   PRICE_PER_UNIT,
    delivery_fee: DELIVERY_FEE,
    amount,
    status: 'pending',
    uid: req.body.uid || null,
    qpay_invoice_id: null,
    qpay_qr_text: null,
    created_at: new Date().toISOString(),
    paid_at: null,
  };

  await db.collection(COL).doc(order_no).set(order);
  sendOrderNotification(order).catch(() => {});

  // Lead-ийг "захиалга хийсэн" болгож тэмдэглэнэ
  if (order.email) {
    try { require('./leads').markConverted(order.email); } catch (_) {}
  }

  try {
    const qpay = await createInvoice({ order_no, amount, name });
    await db.collection(COL).doc(order_no).update({
      qpay_invoice_id: qpay.invoice_id,
      qpay_qr_text: qpay.qr_text,
    });
    res.json({ success: true, order_no, amount, qpay });
  } catch (err) {
    res.json({
      success: true, order_no, amount, qpay: null,
      warning: 'QPay тохиргоо хийгдээгүй: ' + err.message,
    });
  }
});

// GET /api/orders
router.get('/', async (req, res) => {
  const snap = await db.collection(COL).orderBy('created_at', 'desc').get();
  res.json(snap.docs.map(d => d.data()));
});

// GET /api/orders/:order_no
router.get('/:order_no', async (req, res) => {
  const doc = await db.collection(COL).doc(req.params.order_no).get();
  if (!doc.exists) return res.status(404).json({ error: 'Захиалга олдсонгүй' });
  res.json(doc.data());
});

// PATCH /api/orders/:order_no/status
router.patch('/:order_no/status', async (req, res) => {
  const { status } = req.body;
  const allowed = ['pending', 'paid', 'shipped', 'delivered', 'cancelled'];
  if (!allowed.includes(status)) return res.status(400).json({ error: 'Буруу статус' });
  await db.collection(COL).doc(req.params.order_no).update({ status });
  res.json({ success: true });
});

module.exports = router;
