/**
 * Firebase Storage Rules тохируулах скрипт
 * Service account ашиглан Firebase Rules API-д хандана
 */
const { GoogleAuth } = require('./node_modules/google-auth-library');
const https = require('https');

const PROJECT_ID = 'femmoramn';
const BUCKET     = 'femmoramn.appspot.com';

const RULES_SOURCE = `rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /reviews/{file} {
      allow read: if true;
      allow write: if false;
    }
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}`;

async function run() {
  // Service account-аар authenticate хийх
  const auth = new GoogleAuth({
    keyFile: './server/serviceAccountKey.json',
    scopes: ['https://www.googleapis.com/auth/firebase', 'https://www.googleapis.com/auth/cloud-platform'],
  });
  const client = await auth.getClient();
  const { token } = await client.getAccessToken();

  // 1. Ruleset үүсгэх
  const rulesetBody = JSON.stringify({
    source: {
      files: [{
        name:    'storage.rules',
        content: RULES_SOURCE,
      }],
    },
  });

  const ruleset = await apiCall(token, 'POST',
    `/v1/projects/${PROJECT_ID}/rulesets`,
    rulesetBody
  );
  console.log('Ruleset үүсгэгдлээ:', ruleset.name);

  // 2. Release update — PATCH болон PUT аргаар оролдоно
  const releaseName = `projects/${PROJECT_ID}/releases/firebase.storage/${BUCKET}`;
  const releaseBody = JSON.stringify({
    name:        releaseName,
    rulesetName: ruleset.name,
  });

  let released = false;
  // PATCH оролдох
  try {
    const rel = await apiCall(token, 'PATCH',
      `/v1/${encodeURIComponent(releaseName)}`,
      releaseBody
    );
    console.log('Release шинэчлэгдлээ (PATCH):', rel.name);
    released = true;
  } catch(e) { console.log('PATCH дуусгаагүй, POST оролдож байна...'); }

  // POST оролдох
  if (!released) {
    try {
      const rel = await apiCall(token, 'POST',
        `/v1/projects/${PROJECT_ID}/releases`,
        releaseBody
      );
      console.log('Release үүсгэгдлээ (POST):', rel.name);
      released = true;
    } catch(e) { console.log('POST алдаа:', e.message); }
  }

  if (!released) throw new Error('Release үүсгэж чадсангүй — service account-д "Firebase Rules Admin" эрх шаардлагатай');

  console.log('✅ Firebase Storage Rules амжилттай тохируулагдлаа!');
}

function apiCall(token, method, path, body) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'firebaserules.googleapis.com',
      path,
      method,
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type':  'application/json',
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (res.statusCode >= 400) return reject(new Error(JSON.stringify(json)));
          resolve(json);
        } catch(e) { reject(new Error(data)); }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

run().catch(e => { console.error('Алдаа:', e.message); process.exit(1); });
