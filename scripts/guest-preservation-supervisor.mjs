/** Read-only production preservation check. Raw snapshots remain local; output counts only. */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { canonical, digest, ownerOf, validateDatabaseURL } from './guest-orphan-maintenance.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(root, 'functions/package.json'));
const dir = path.join(root, '.out/private-guest-lifecycle');
const read = file => JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
const before = read('auth-before.json'); const snapshot = read('firestore-after.json'); const motion = read('rtdb-after.json');
const projectId = 'boxcycle-dc2df';
if (before.projectId !== projectId || snapshot.projectId !== projectId) throw Error('project mismatch');
validateDatabaseURL(motion.url);
for (const key of ['FIRESTORE_EMULATOR_HOST', 'FIREBASE_AUTH_EMULATOR_HOST', 'FIREBASE_DATABASE_EMULATOR_HOST']) if (process.env[key]) throw Error('production read-only check must not use emulator');
require('../functions/lib/initAdminForCli.js').initFirebaseAdminForCli({ projectId });
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');
const { getDatabaseWithUrl } = require('firebase-admin/database');
const { getApp, deleteApp } = require('firebase-admin/app');
let database;
try {
  const users = []; let token;
  do { const page = await getAuth().listUsers(1000, token); users.push(...page.users); token = page.pageToken; } while (token);
  const ids = users.map(u => u.uid).sort(); const originalIds = before.users.map(u => u.uid).sort();
  const google = users.filter(u => u.providerData.some(p => p.providerId === 'google.com')).map(u => u.uid).sort();
  const originalGoogle = before.users.filter(u => u.providers.includes('google.com')).map(u => u.uid).sort();
  const live = new Set(ids); const db = getFirestore();
  const googleSet = new Set(google);
  let missing = 0, changed = 0, personal = 0, shared = 0;
  let googleDocuments = 0, missingGoogleDocuments = 0, changedGoogleDocuments = 0;
  const changedCollections = {};
  const missingDetails = [];
  const changedGoogleFields = [];
  for (let offset = 0; offset < snapshot.records.length; offset += 100) {
    const chunk = snapshot.records.slice(offset, offset + 100);
    const docs = await db.getAll(...chunk.map(r => db.doc(r.path)));
    docs.forEach((doc, i) => {
      const row = chunk[i]; const owner = ownerOf(row);
      if (googleSet.has(owner)) googleDocuments++;
      if (owner && live.has(owner)) personal++; else if (!owner) shared++;
      if (!doc.exists) {
        missing++; if (googleSet.has(owner)) missingGoogleDocuments++;
        missingDetails.push({ collection: row.path.split('/')[0], subcollection: row.path.split('/').length === 4 ? row.path.split('/')[2] : null, ownedByCurrentAuth: live.has(owner), ownedByGoogle: googleSet.has(owner) });
      }
      else if (digest(doc.data()) !== digest(row.data)) {
        changed++; if (googleSet.has(owner)) changedGoogleDocuments++;
        const collection = row.path.split('/')[0]; changedCollections[collection] = (changedCollections[collection] || 0) + 1;
        if (googleSet.has(owner)) {
          const current = doc.data();
          const fields = [...new Set([...Object.keys(row.data), ...Object.keys(current)])].filter(key => !(key in row.data) || !(key in current) || digest(row.data[key]) !== digest(current[key]));
          changedGoogleFields.push({ collection, fields, removedFields: fields.filter(key => !(key in current)).length });
        }
      }
    });
  }
  database = getDatabaseWithUrl(motion.url);
  const trails = (await database.ref('trails').get()).val() || {};
  let protectedMotion = 0, missingMotion = 0, changedMotion = 0;
  for (const [trailId, trail] of Object.entries(motion.data || {})) for (const [uid, value] of Object.entries(trail.motion || {})) {
    if (!live.has(uid)) continue;
    protectedMotion++;
    const current = trails[trailId]?.motion?.[uid];
    if (current == null) missingMotion++; else if (digest(current) !== digest(value)) changedMotion++;
  }
  const originalAuthPreserved = originalIds.every(uid => live.has(uid));
  const originalGoogleStatePreserved = before.users.filter(u => u.providers.includes('google.com')).every(u => {
    const current = users.find(row => row.uid === u.uid);
    return current && current.disabled === u.disabled && canonical(current.providerData.map(p => p.providerId).sort()) === canonical([...u.providers].sort());
  });
  const summary = { at: new Date().toISOString(), readOnly: true, googleUsers: google.length, googleSetUnchanged: google.length === 4 && canonical(google) === canonical(originalGoogle), originalGoogleStatePreserved, authUsers: ids.length, authSetUnchanged: canonical(ids) === canonical(originalIds), originalAuthPreserved, addedAuthUsers: ids.filter(uid => !originalIds.includes(uid)).length, checkedDocuments: snapshot.records.length, protectedPersonalDocuments: personal, nonPersonalDocuments: shared, missingDocuments: missing, missingDetails, changedDocuments: changed, changedCollections, googleDocuments, missingGoogleDocuments, changedGoogleDocuments, changedGoogleFields, protectedMotion, missingMotion, changedMotion };
  fs.writeFileSync(path.join(root, 'document/ops/20261019-guest-lifecycle/evidence/preservation-latest.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary));
  if (!summary.googleSetUnchanged || !originalGoogleStatePreserved || !originalAuthPreserved || missing || missingMotion) process.exitCode = 1;
} finally { database?.goOffline(); await deleteApp(getApp()); }
