const express = require('express');
const router = express.Router();
const db = require('../db');

const COL = 'leads';

// Имэйлээс Firestore doc ID үүсгэнэ
function leadId(email) {
  return email.toLowerCase().trim().replace(/[\/\\.#$\[\]]/g, '_');
}

// POST /api/leads — маягт бөглөж буй зочны имэйлийг хадгална
router.post('/', async (req, res) => {
  const { email, name, phone } = req.body;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({ error: 'Имэйл буруу байна' });

  const id = leadId(email);
  const ref = db.collection(COL).doc(id);
  const doc = await ref.get();

  if (doc.exists) {
    // Нэр/утас шинэчлэгдсэн бол update хийнэ, converted статусыг хадгална
    await ref.set({
      name:  name  || doc.data().name  || null,
      phone: phone || doc.data().phone || null,
    }, { merge: true });
  } else {
    await ref.set({
      email: email.toLowerCase().trim(),
      name:  name  || null,
      phone: phone || null,
      created_at: new Date().toISOString(),
      converted: false,
      followup_sent_at: null,
    });
  }
  res.json({ success: true });
});

// Захиалга амжилттай болоход converted болгоно (orders.js-ээс дуудна)
async function markConverted(email) {
  if (!email) return;
  try {
    await db.collection(COL).doc(leadId(email)).set(
      { converted: true, converted_at: new Date().toISOString() },
      { merge: true }
    );
  } catch (_) {}
}

module.exports = router;
module.exports.markConverted = markConverted;
module.exports.leadId = leadId;
