const express = require('express');
const router = express.Router();
const axios = require('axios');
const db = require('../db');

const BASE = process.env.QPAY_BASE_URL || 'https://merchant.qpay.mn/v2';
const COL = 'orders';
let _token = null;
let _tokenExpiry = 0;

async function getToken() {
  if (_token && Date.now() < _tokenExpiry) return _token;
  if (!process.env.QPAY_USERNAME || !process.env.QPAY_PASSWORD)
    throw new Error('QPAY_USERNAME / QPAY_PASSWORD тохируулаагүй');
  const res = await axios.post(`${BASE}/auth/token`, {}, {
    auth: { username: process.env.QPAY_USERNAME, password: process.env.QPAY_PASSWORD }
  });
  _token = res.data.access_token;
  _tokenExpiry = Date.now() + (res.data.expires_in - 60) * 1000;
  return _token;
}

async function createInvoice({ order_no, amount, name }) {
  const token = await getToken();
  const res = await axios.post(`${BASE}/invoice`, {
    invoice_code: process.env.QPAY_INVOICE_CODE,
    sender_invoice_no: order_no,
    invoice_receiver_code: 'terminal',
    invoice_description: `Femmora Silver Edition - ${name}`,
    amount,
    callback_url: `${process.env.CALLBACK_URL || 'http://localhost:3000/api/qpay/callback'}?order_no=${order_no}`,
  }, { headers: { Authorization: `Bearer ${token}` } });
  return {
    invoice_id: res.data.invoice_id,
    qr_text: res.data.qr_text,
    qr_image: res.data.qr_image,
    urls: res.data.urls,
  };
}

router.get('/check/:invoice_id', async (req, res) => {
  try {
    const token = await getToken();
    const resp = await axios.get(`${BASE}/payment/check/${req.params.invoice_id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const paid = resp.data.count > 0;
    if (paid) {
      const snap = await db.collection(COL).where('qpay_invoice_id', '==', req.params.invoice_id).get();
      snap.forEach(async doc => {
        if (doc.data().status === 'pending')
          await doc.ref.update({ status: 'paid', paid_at: new Date().toISOString() });
      });
    }
    res.json({ paid, data: resp.data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/callback', express.raw({ type: '*/*' }), async (req, res) => {
  const order_no = req.query.order_no;
  if (order_no) {
    const doc = await db.collection(COL).doc(order_no).get();
    if (doc.exists && doc.data().status === 'pending')
      await doc.ref.update({ status: 'paid', paid_at: new Date().toISOString() });
  }
  res.sendStatus(200);
});

module.exports = router;
module.exports.createInvoice = createInvoice;
