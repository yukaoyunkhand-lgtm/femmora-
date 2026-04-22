const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

if (!admin.apps.length) {
  let credential;

  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    // Vercel / Railway: env variable-д JSON string байна
    const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    credential = admin.credential.cert(sa);
  } else {
    // Локал: serviceAccountKey.json файл
    const keyPath = path.join(__dirname, 'serviceAccountKey.json');
    if (!fs.existsSync(keyPath)) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT env эсвэл server/serviceAccountKey.json байхгүй байна');
    }
    credential = admin.credential.cert(require(keyPath));
  }

  admin.initializeApp({ credential, projectId: 'femmoramn' });
}

module.exports = admin.firestore();
