require('../db'); // Firebase Admin SDK-г эхлүүлэхийг баталгаажуулна
const admin = require('firebase-admin');

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'info@femmorabeauties.com')
  .split(',').map(e => e.trim().toLowerCase());

module.exports = async function requireAdmin(req, res, next) {
  const token = req.headers['x-admin-token'];
  if (!token) return res.status(401).json({ error: 'Нэвтрэх шаардлагатай' });
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    if (!ADMIN_EMAILS.includes((decoded.email || '').toLowerCase()))
      return res.status(403).json({ error: 'Зөвшөөрөлгүй хэрэглэгч' });
    req.adminUid   = decoded.uid;
    req.adminEmail = decoded.email;
    next();
  } catch {
    res.status(401).json({ error: 'Token хүчингүй. Дахин нэвтэрнэ үү.' });
  }
};
