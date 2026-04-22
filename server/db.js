const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

if (!admin.apps.length) {
  const keyPath = path.join(__dirname, 'serviceAccountKey.json');

  if (fs.existsSync(keyPath)) {
    const serviceAccount = require(keyPath);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  } else {
    // Railway / env-д credential байвал тэрийг ашиглана
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: process.env.FIREBASE_PROJECT_ID || 'femmoramn',
    });
  }
}

const db = admin.firestore();
module.exports = db;
