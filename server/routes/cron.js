const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');
const db = require('../db');
const { sendAbandonedFormEmail, sendPaymentReminder } = require('../mailer');

const HOURS_24 = 24 * 60 * 60 * 1000;

// Vercel Cron-оос ирсэн хүсэлтийг шалгана (CRON_SECRET тохируулсан бол)
function checkCronAuth(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // secret байхгүй бол нээлттэй (туршилт)
  if (req.headers['authorization'] === `Bearer ${secret}`) return true;
  res.status(401).json({ error: 'Unauthorized' });
  return false;
}

// GET /api/cron/followups — өдөр бүр Vercel Cron дуудна
router.get('/followups', async (req, res) => {
  if (!checkCronAuth(req, res)) return;
  const now = Date.now();
  const results = { leads_sent: 0, leads_skipped: 0, reminders_sent: 0, reminders_skipped: 0, errors: [] };

  // ── 1. Маягт орхисон lead-үүд (24+ цаг, converted биш, имэйл аваагүй) ──
  try {
    const snap = await db.collection('leads').get();
    for (const doc of snap.docs) {
      const lead = doc.data();
      if (lead.converted) continue;
      if (lead.followup_sent_at) continue;
      if (now - new Date(lead.created_at).getTime() < HOURS_24) continue;

      const r = await sendAbandonedFormEmail(lead);
      if (r.ok) {
        await doc.ref.update({ followup_sent_at: new Date().toISOString() });
        results.leads_sent++;
      } else {
        results.leads_skipped++;
        results.errors.push(`lead ${lead.email}: ${r.reason}`);
      }
    }
  } catch (e) { results.errors.push('leads: ' + e.message); }

  // ── 2. Төлбөр төлөөгүй захиалгууд (24+ цаг pending, сануулга аваагүй) ──
  try {
    const snap = await db.collection('orders').where('status', '==', 'pending').get();
    for (const doc of snap.docs) {
      const order = doc.data();
      if (order.reminded_at) continue;
      if (now - new Date(order.created_at).getTime() < HOURS_24) continue;

      let email = order.email || null;
      if (!email && order.uid) {
        try { const u = await admin.auth().getUser(order.uid); if (u.email) email = u.email; } catch (_) {}
      }
      if (!email) { results.reminders_skipped++; continue; }

      const r = await sendPaymentReminder({ ...order, email });
      if (r.ok) {
        await doc.ref.update({ reminded_at: new Date().toISOString() });
        results.reminders_sent++;
      } else {
        results.reminders_skipped++;
        results.errors.push(`order ${order.order_no}: ${r.reason}`);
      }
    }
  } catch (e) { results.errors.push('orders: ' + e.message); }

  console.log('[cron] followups:', JSON.stringify(results));
  res.json({ success: true, ...results });
});

module.exports = router;
