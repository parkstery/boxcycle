/** Read-only cache cleanup verification; output anonymized counts only. */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { canonical, digest } from './guest-orphan-maintenance.mjs';
const require = createRequire(new URL('../functions/package.json', import.meta.url));
const dir = '.out/private-guest-lifecycle/cache-cleanup';
const before = JSON.parse(fs.readFileSync(`${dir}/firestore-before.json`));
const manifest = JSON.parse(fs.readFileSync(`${dir}/orphan-manifest.json`));
if (before.projectId !== 'boxcycle-dc2df' || manifest.projectId !== before.projectId) throw Error('project mismatch');
require('../functions/lib/initAdminForCli.js').initFirebaseAdminForCli({ projectId: before.projectId });
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const { getApp, deleteApp } = require('firebase-admin/app');
try {
  const targets = new Set(manifest.documents.map(row => row.path));
  const protectedRows = before.records.filter(row => !targets.has(row.path));
  let missingProtected = 0, changedProtected = 0, remainingTargets = 0;
  for (let offset = 0; offset < before.records.length; offset += 100) {
    const chunk = before.records.slice(offset, offset + 100);
    const docs = await getFirestore().getAll(...chunk.map(row => getFirestore().doc(row.path)));
    docs.forEach((doc, i) => {
      const row = chunk[i];
      if (targets.has(row.path)) { if (doc.exists) remainingTargets++; }
      else if (!doc.exists) missingProtected++;
      else if (digest(doc.data()) !== digest(row.data)) changedProtected++;
    });
  }
  const users = (await getAuth().listUsers(1000)).users;
  const original = JSON.parse(fs.readFileSync(`${dir}/auth-before.json`));
  const google = users.filter(u => u.providerData.some(p => p.providerId === 'google.com')).map(u => u.uid).sort();
  const baseline = original.users.filter(u => u.providers.includes('google.com')).map(u => u.uid).sort();
  const result = { at: new Date().toISOString(), targets: targets.size, remainingTargets, protectedCacheDocuments: protectedRows.length, missingProtected, changedProtected, googleUsers: google.length, googleSetPreserved: google.length === 4 && canonical(google) === canonical(baseline), authUsers: users.length };
  fs.writeFileSync('document/ops/20261019-guest-lifecycle/evidence/cache-cleanup-verification.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
  if (remainingTargets || missingProtected || changedProtected || !result.googleSetPreserved) process.exitCode = 1;
} finally { await deleteApp(getApp()); }
