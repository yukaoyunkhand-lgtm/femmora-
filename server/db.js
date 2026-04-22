const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

let _db = null;

function getDb() {
  if (_db) return _db;

  if (!admin.apps.length) {
    let credential;

    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      if (sa.private_key) sa.private_key = sa.private_key.replace(/\\n/g, '\n');
      credential = admin.credential.cert(sa);
    } else {
      const keyPath = path.join(__dirname, 'serviceAccountKey.json');
      if (!fs.existsSync(keyPath)) throw new Error('Firebase credentials олдсонгүй');
      credential = admin.credential.cert(require(keyPath));
    }

    admin.initializeApp({ credential, projectId: 'femmoramn' });
  }

  _db = admin.firestore();
  return _db;
}

// Proxy: db.collection(...) автоматаар getDb() дуудна
module.exports = new Proxy({}, {
  get(_, prop) {
    const db = getDb();
    const val = db[prop];
    return typeof val === 'function' ? val.bind(db) : val;
  }
});
