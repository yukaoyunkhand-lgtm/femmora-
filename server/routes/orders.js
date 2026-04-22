const express = require('express');
const router = express.Router();
const db = require('../db');
const { createInvoice } = require('./qpay');

const PRICE_EXCL = 61110;
const PRICE_INCL = 67900;

function genOrderNo() {
  const d = new Date();
  const ymd = d.toISOString().slice(2, 10).replace(/-/g, '');
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `FM${ymd}${rand}`;
}

// POST /api/orders — шинэ захиалга
router.post('/', async (req, res) => {
  const { name, phone, address, quantity = 1, include_vat = false } = req.body;

  if (!name || !phone || !address) {
    return res.status(400).json({ error: 'Нэр, утас, хаяг заавал шаардлагатай' });
  }
  if (!/^[0-9]{8}$/.test(phone)) {
    return res.status(400).json({ error: 'Утасны дугаар 8 оронтой байх ёстой' });
  }

  const unitPrice = include_vat ? PRICE_INCL : PRICE_EXCL;
  const amount = unitPrice * Number(quantity);
  const order_no = genOrderNo();

  const order = {
    id: Date.now(),
    order_no,
    name,
    phone,
    address,
    quantity: Number(quantity),
    include_vat: !!include_vat,
    amount,
    status: 'pending',
    qpay_invoice_id: null,
    qpay_qr_text: null,
    created_at: new Date().toISOString(),
    paid_at: null,
  };

  db.get('orders').push(order).write();

  try {
    const qpay = await createInvoice({ order_no, amount, name });
    db.get('orders').find({ order_no }).assign({
      qpay_invoice_id: qpay.invoice_id,
      qpay_qr_text: qpay.qr_text,
    }).write();

    res.json({
      success: true,
      order_no,
      amount,
      qpay: {
        invoice_id: qpay.invoice_id,
        qr_text: qpay.qr_text,
        qr_image: qpay.qr_image,
        urls: qpay.urls,
      }
    });
  } catch (err) {
    res.json({
      success: true,
      order_no,
      amount,
      qpay: null,
      warning: 'QPay тохиргоо хийгдээгүй — захиалга хадгалагдлаа: ' + err.message,
    });
  }
});

// GET /api/orders — бүх захиалга (admin)
router.get('/', (req, res) => {
  const orders = db.get('orders').value().slice().reverse();
  res.json(orders);
});

// GET /api/orders/:order_no — нэг захиалга
router.get('/:order_no', (req, res) => {
  const order = db.get('orders').find({ order_no: req.params.order_no }).value();
  if (!order) return res.status(404).json({ error: 'Захиалга олдсонгүй' });
  res.json(order);
});

// PATCH /api/orders/:order_no/status
router.patch('/:order_no/status', (req, res) => {
  const { status } = req.body;
  const allowed = ['pending', 'paid', 'shipped', 'delivered', 'cancelled'];
  if (!allowed.includes(status)) return res.status(400).json({ error: 'Буруу статус' });
  db.get('orders').find({ order_no: req.params.order_no }).assign({ status }).write();
  res.json({ success: true });
});

module.exports = router;
