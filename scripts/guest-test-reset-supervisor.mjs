/** Explicit Chief-requested Guest test reset. Default dry-run, no Google/registered deletion. */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { canonical, digest, ownerOf, validateDatabaseURL } from './guest-orphan-maintenance.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(root, 'functions/package.json'));
const PROJECT = 'boxcycle-dc2df';
const dir = path.join(root, '.out/private-guest-lifecycle/test-reset');
const flag = name => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const apply = process.argv.includes('--apply');
const verify = process.argv.includes('--verify');
if (apply && verify) throw Error('choose apply or verify');
for (const key of ['FIREBASE_AUTH_EMULATOR_HOST', 'FIRESTORE_EMULATOR_HOST', 'FIREBASE_DATABASE_EMULATOR_HOST']) if (process.env[key]) throw Error('emulator variables forbidden');
const baseline = JSON.parse(fs.readFileSync(path.join(root, '.out/private-guest-lifecycle/auth-before.json')));
const originalGoogle = baseline.users.filter(u => u.providers.includes('google.com')).map(u => u.uid).sort();
if (originalGoogle.length !== 4) throw Error('Google protection baseline mismatch');
require('../functions/lib/initAdminForCli.js').initFirebaseAdminForCli({ projectId: PROJECT });
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');
const { getDatabaseWithUrl } = require('firebase-admin/database');
const { getApp, deleteApp } = require('firebase-admin/app');
const { deleteAccountData } = require('../functions/lib/accountDeletionCore.js');
const auth = getAuth(); const db = getFirestore();
const databaseURL = JSON.parse(fs.readFileSync(path.join(root, '.out/private-guest-lifecycle/rtdb-before.json'))).url;
validateDatabaseURL(databaseURL); const rtdb = getDatabaseWithUrl(databaseURL);
const anonymous = user => user.providerData.length === 0 && !user.email && !user.phoneNumber;
const admin = user => Object.entries(user.customClaims || {}).some(([key, value]) => /admin/i.test(key) && value !== false && value != null);
async function users() { const out = []; let token; do { const page = await auth.listUsers(1000, token); out.push(...page.users); token = page.pageToken; } while (token); return out; }
function protect(rows) {
  const google = rows.filter(u => u.providerData.some(p => p.providerId === 'google.com')).map(u => u.uid).sort();
  if (canonical(google) !== canonical(originalGoogle)) throw Error('Google protection mismatch');
  for (const original of baseline.users.filter(u => u.providers.includes('google.com'))) {
    const current = rows.find(u => u.uid === original.uid);
    if (!current || current.disabled !== original.disabled || canonical(current.providerData.map(p => p.providerId).sort()) !== canonical([...original.providers].sort())) throw Error('Google provider/disabled state changed');
  }
}
async function census() {
  const rootNames = ['users','userPrivate','conquest','livePresence','nicknames','rides','savedRoutes','routeTokenLedger','routeAutoRouteCache','publicRouteRequests','openTrailListings','routePublications','trails','publicationSessions'];
  const snaps = await Promise.all([...rootNames.map(name => db.collection(name).get()), ...['members','livePublicationRides','chunks','traces'].map(name => db.collectionGroup(name).get())]);
  const unique = new Map(); for (const snap of snaps) for (const doc of snap.docs) unique.set(doc.ref.path, { path: doc.ref.path, data: doc.data() });
  return [...unique.values()];
}
try {
  fs.mkdirSync(dir, { recursive: true });
  const beforeAuth = await users(); protect(beforeAuth);
  const manifestPath = path.join(dir, 'manifest.json');
  if (verify) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath));
    if (manifest.projectId !== PROJECT || canonical(manifest.protectedGoogle) !== canonical(originalGoogle)) throw Error('verification manifest mismatch');
    const targets = new Set(manifest.targets.map(row => row.uid));
    const records = await census(); const byPath = new Map(records.map(row => [row.path, row]));
    const googleMissing = manifest.googleDocuments.filter(row => !byPath.has(row.path)).length;
    const googleChanged = manifest.googleDocuments.filter(row => byPath.has(row.path) && digest(byPath.get(row.path).data) !== row.hash).length;
    const trails = (await rtdb.ref('trails').get()).val() || {};
    const remainingMotion = Object.values(trails).reduce((sum, trail) => sum + Object.keys(trail?.motion || {}).filter(uid => targets.has(uid)).length, 0);
    const summary = { at: new Date().toISOString(), mode: 'verify', googleUsers: 4, googleAuthStatePreserved: true, protectedGoogleDocuments: manifest.googleDocuments.length, googleMissing, googleChanged, authUsers: beforeAuth.length, guestUsers: beforeAuth.filter(anonymous).length, deletedGuestAccountsRecreated: beforeAuth.filter(row => targets.has(row.uid)).length, recreatedPersonalDocuments: records.filter(row => targets.has(ownerOf(row))).length, remainingGuestMotion: remainingMotion };
    fs.writeFileSync(path.join(root, 'document/ops/20261019-guest-lifecycle/evidence/test-reset-verification.json'), JSON.stringify(summary, null, 2));
    console.log(JSON.stringify(summary));
    if (googleMissing || summary.deletedGuestAccountsRecreated || summary.recreatedPersonalDocuments || remainingMotion) process.exitCode = 1;
  } else if (!apply) {
    const targets = beforeAuth.filter(u => anonymous(u) && !admin(u) && !u.disabled).map(u => ({ uid: u.uid, createdAt: u.metadata.creationTime }));
    const records = await census(); const targetSet = new Set(targets.map(u => u.uid));
    const googleSet = new Set(originalGoogle);
    const protectedRecords = records.filter(row => googleSet.has(ownerOf(row)));
    fs.writeFileSync(path.join(dir, 'firestore-before.json'), JSON.stringify({ projectId: PROJECT, at: new Date().toISOString(), records }));
    fs.writeFileSync(path.join(dir, 'rtdb-before.json'), JSON.stringify({ url: databaseURL, data: (await rtdb.ref('trails').get()).val() || {} }));
    const manifest = { projectId: PROJECT, at: new Date().toISOString(), targets, protectedGoogle: originalGoogle, googleDocuments: protectedRecords.map(row => ({ path: row.path, hash: digest(row.data) })), guestDocuments: records.filter(row => targetSet.has(ownerOf(row))).length };
    fs.writeFileSync(manifestPath, JSON.stringify(manifest));
    console.log(JSON.stringify({ mode: 'dry-run', googleUsers: 4, authUsers: beforeAuth.length, targetGuests: targets.length, guestDocuments: manifest.guestDocuments, protectedGoogleDocuments: protectedRecords.length }));
  } else {
    const manifest = JSON.parse(fs.readFileSync(manifestPath));
    const max = Number(flag('max'));
    if (flag('project') !== PROJECT || manifest.projectId !== PROJECT || canonical(manifest.protectedGoogle) !== canonical(originalGoogle) || !Number.isInteger(max) || max < 1 || manifest.targets.length > max || Date.now() - Date.parse(manifest.at) > 60 * 60 * 1000) throw Error('invalid/expired explicit reset manifest');
    const result = { deleted: [], skipped: [], failed: [] };
    for (const target of manifest.targets) {
      let disabledByThisRun = false;
      try {
        let user = await auth.getUser(target.uid);
        const profile = await db.doc(`users/${target.uid}`).get();
        if (!anonymous(user) || admin(user) || user.disabled || originalGoogle.includes(user.uid) || user.metadata.creationTime !== target.createdAt || profile.get('tier') === 'admin') { result.skipped.push(target.uid); continue; }
        const marker = db.doc(`guestLifecycle/${user.uid}`);
        const runId = `chief-test-reset-${Date.now()}`;
        await db.runTransaction(async tx => {
          const snap = await tx.get(marker); const data = snap.data() || {};
          if (data.status === 'exempt' || (data.status === 'linking' && data.linkLeaseUntilMs > Date.now())) throw Error('link-in-progress-or-exempt');
          tx.set(marker, { ...data, status: 'deletionScheduled', resetRun: runId, resetRequestedAtMs: Date.now(), generation: (Number(data.generation) || 0) + 1 });
        });
        await auth.updateUser(user.uid, { disabled: true }); disabledByThisRun = true;
        await rtdb.ref(`guestLifecycle/${user.uid}/blocked`).set(true);
        user = await auth.getUser(user.uid);
        if (!anonymous(user) || admin(user)) {
          await auth.updateUser(user.uid, { disabled: false }); disabledByThisRun = false;
          await marker.set({ status: 'exempt', resetRun: runId }, { merge: true });
          await rtdb.ref(`guestLifecycle/${user.uid}/blocked`).set(false);
          result.skipped.push(user.uid); continue;
        }
        await marker.set({ status: 'deleting', disabledByLifecycle: true }, { merge: true });
        const report = await deleteAccountData(db, rtdb, user.uid);
        const finalUser = await auth.getUser(user.uid);
        if (!anonymous(finalUser) || admin(finalUser)) throw Error('provider-changed-after-disable');
        await auth.deleteUser(user.uid);
        await marker.set({ status: 'deleted', deletedAtMs: Date.now(), disabledByLifecycle: false, resetRun: runId }, { merge: true });
        result.deleted.push({ uid: user.uid, report });
      } catch (error) {
        result.failed.push({ uid: target.uid, code: error.code || 'reset-failed', disabledByThisRun });
      }
      fs.writeFileSync(path.join(dir, 'result-private.json'), JSON.stringify(result));
    }
    const afterAuth = await users(); protect(afterAuth);
    const allAfter = await census(); const deleted = new Set(result.deleted.map(row => row.uid));
    let googleMissing = 0, googleChanged = 0;
    const byPath = new Map(allAfter.map(row => [row.path, row]));
    for (const row of manifest.googleDocuments) { const current = byPath.get(row.path); if (!current) googleMissing++; else if (digest(current.data) !== row.hash) googleChanged++; }
    const summary = { at: new Date().toISOString(), mode: 'apply', requested: manifest.targets.length, deletedGuests: result.deleted.length, skipped: result.skipped.length, failures: result.failed.length, googleUsers: 4, protectedGoogleDocuments: manifest.googleDocuments.length, googleMissing, googleChanged, remainingAuthUsers: afterAuth.length, remainingGuestUsers: afterAuth.filter(u => anonymous(u)).length, recreatedPersonalDocuments: allAfter.filter(row => deleted.has(ownerOf(row))).length };
    fs.writeFileSync(path.join(root, 'document/ops/20261019-guest-lifecycle/evidence/test-reset-summary.json'), JSON.stringify(summary, null, 2));
    console.log(JSON.stringify(summary));
    if (summary.failures || googleMissing || summary.recreatedPersonalDocuments) process.exitCode = 1;
  }
} finally { rtdb.goOffline(); await deleteApp(getApp()); }
