const express = require('express');
const router  = express.Router();
const axios   = require('axios');
const db      = require('../db');

const BASE         = process.env.QPAY_BASE_URL   || 'https://merchant.qpay.mn/v2';
const USERNAME     = process.env.QPAY_USERNAME    || 'FEMMORA_BEAUTY';
const PASSWORD     = process.env.QPAY_PASSWORD    || 'mhLeN9I2';
const INVOICE_CODE = process.env.QPAY_INVOICE_CODE|| 'FEMMORA_BEAUTY_INVOICE';
const COL          = 'orders';

// Token cache — нэг timestamp-д нэг л удаа авна (QPay-н шаардлага)
let _cache = { access_token: null, refresh_token: null, expiry: 0 };

async function getToken() {
  const now = Date.now();

  // Access token хүчинтэй байвал шууд буцаана
  if (_cache.access_token && now < _cache.expiry) return _cache.access_token;

  // Refresh token байвал refresh хийнэ
  if (_cache.refresh_token) {
    try {
      const res = await axios.post(`${BASE}/auth/refresh`, {}, {
        headers: { Authorization: `Bearer ${_cache.refresh_token}` }
      });
      _setCache(res.data);
      return _cache.access_token;
    } catch (e) {
      // Refresh token хүчингүй — дахин нэвтрэнэ
      _cache = { access_token: null, refresh_token: null, expiry: 0 };
    }
  }

  // Шинэ token авна
  const res = await axios.post(`${BASE}/auth/token`, {}, {
    auth: { username: USERNAME, password: PASSWORD }
  });
  _setCache(res.data);
  return _cache.access_token;
}

function _setCache(data) {
  const expiresIn = (data.expires_in || 3600) - 60; // 1 мин өмнө шинэчилнэ
  _cache = {
    access_token:  data.access_token,
    refresh_token: data.refresh_token || null,
    expiry:        Date.now() + expiresIn * 1000,
  };
}

async function authHeader() {
  return { Authorization: `Bearer ${await getToken()}` };
}

// Invoice үүсгэх
async function createInvoice({ order_no, amount, name }) {
  const callbackUrl = `${process.env.CALLBACK_URL || 'https://www.femmorabeauty.mn/api/qpay/callback'}?order_no=${order_no}`;
  const res = await axios.post(`${BASE}/invoice`, {
    invoice_code:          INVOICE_CODE,
    sender_invoice_no:     order_no,
    invoice_receiver_code: 'terminal',
    invoice_description:   `Femmora Silver Edition - ${name}`,
    amount,
    callback_url:          callbackUrl,
  }, { headers: await authHeader() });

  return {
    invoice_id: res.data.invoice_id,
    qr_text:    res.data.qr_text,
    qr_image:   res.data.qr_image,
    urls:       res.data.urls || [],
  };
}

// Төлбөр шалгах — QPay-н зөв API: POST /payment/check
async function checkPayment(invoice_id) {
  const res = await axios.post(`${BASE}/payment/check`, {
    object_type: 'INVOICE',
    object_id:   invoice_id,
    offset:      { page_number: 1, page_limit: 100 },
  }, { headers: await authHeader() });
  return { paid: res.data.count > 0, data: res.data };
}

// GET /api/qpay/check/:invoice_id — frontend-с polling хийнэ
router.get('/check/:invoice_id', async (req, res) => {
  try {
    const result = await checkPayment(req.params.invoice_id);
    if (result.paid) {
      const snap = await db.collection(COL)
        .where('qpay_invoice_id', '==', req.params.invoice_id).get();
      for (const doc of snap.docs) {
        if (doc.data().status === 'pending')
          await doc.ref.update({ status: 'paid', paid_at: new Date().toISOString() });
      }
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/qpay/callback — QPay-с автомат дуудах
router.post('/callback', express.raw({ type: '*/*' }), async (req, res) => {
  try {
    const order_no = req.query.order_no;
    if (!order_no) return res.sendStatus(200);

    const doc = await db.collection(COL).doc(order_no).get();
    if (!doc.exists || doc.data().status !== 'pending')
      return res.sendStatus(200);

    const invoice_id = doc.data().qpay_invoice_id;
    if (invoice_id) {
      // Callback ирсний дараа check хийж баталгаажуулна (QPay-н шаардлага)
      const result = await checkPayment(invoice_id);
      if (result.paid)
        await doc.ref.update({ status: 'paid', paid_at: new Date().toISOString() });
    } else {
      await doc.ref.update({ status: 'paid', paid_at: new Date().toISOString() });
    }
  } catch (e) {
    console.error('QPay callback error:', e.message);
  }
  res.sendStatus(200);
});

module.exports = router;
module.exports.createInvoice = createInvoice;
