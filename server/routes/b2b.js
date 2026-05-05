const express = require('express');
const router = express.Router();
const db = require('../db');

const COL = 'b2b_inquiries';

// POST /api/b2b
router.post('/', async (req, res) => {
  const { company, contact_name, phone, email, message } = req.body;
  if (!company || !contact_name || !phone)
    return res.status(400).json({ error: 'Байгууллага, холбоо барих хүний нэр, утас шаардлагатай' });
  const doc = {
    company: company.trim(),
    contact_name: contact_name.trim(),
    phone: phone.trim(),
    email: (email || '').trim(),
    message: (message || '').trim(),
    status: 'new',
    created_at: new Date().toISOString(),
  };
  await db.collection(COL).add(doc);
  res.json({ success: true });
});

// GET /api/b2b (admin)
router.get('/', async (req, res) => {
  try {
    const snap = await db.collection(COL).orderBy('created_at', 'desc').get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
