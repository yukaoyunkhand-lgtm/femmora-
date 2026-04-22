const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

if (!admin.apps.length) {
  let credential;

  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    // Vercel / Railway: env variable-д JSON string байна
    let saJson = process.env.FIREBASE_SERVICE_ACCOUNT;
    // Зарим системд private_key дотрх \n escaped байдаг — засна
    const sa = JSON.parse(saJson);
    if (sa.private_key) sa.private_key = sa.private_key.replace(/\\n/g, '\n');
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
