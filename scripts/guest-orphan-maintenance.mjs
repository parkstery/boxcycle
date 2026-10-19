/** Snapshot-based orphan cleanup. Never deletes Auth or shared documents.
 * npm run admin:guest-orphans -- --help
 * Raw snapshots and manifest must stay local; console output contains counts only.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(root, 'functions/package.json'));
const PROJECT = 'boxcycle-dc2df';
const ownedRoots = new Set(['users', 'userPrivate', 'conquest', 'livePresence']);
const ownedFields = { rides: 'userId', savedRoutes: 'userId', routeTokenLedger: 'userId', routeAutoRouteCache: 'userId', publicRouteRequests: 'applicantUid', nicknames: 'ownerUid', openTrailListings: 'hostUid' };

export function ownerOf(record) {
  const parts = record.path.split('/');
  if (ownedRoots.has(parts[0])) return parts[1];
  if (parts.length === 2 && ownedFields[parts[0]]) return record.data[ownedFields[parts[0]]];
  if (parts.length === 4 && ((parts[0] === 'trails' && ['members', 'livePublicationRides'].includes(parts[2])) || (parts[0] === 'publicationSessions' && parts[2] === 'members'))) return parts[3];
  return null;
}

export function canonical(value) {
  const plain = JSON.parse(JSON.stringify(value));
  function sort(v) { return Array.isArray(v) ? v.map(sort) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, sort(v[k])])) : v; }
  return JSON.stringify(sort(plain));
}
export function digest(value) { return crypto.createHash('sha256').update(canonical(value)).digest('hex'); }
export function orphanMotionUpdate(value, expectedHash) {
  return value == null || digest(value) === expectedHash ? null : undefined;
}
export function validateDatabaseURL(raw) {
  const url = new URL(raw);
  if (url.protocol !== 'https:' || !/^boxcycle-dc2df(?:-default-rtdb)?\.(?:firebaseio\.com|[a-z0-9-]+\.firebasedatabase\.app)$/.test(url.hostname) || url.pathname !== '/' || url.username || url.password || url.search || url.hash) throw Error('RTDB project mismatch');
}

export function planOrphans(snapshot, authUsers, rtdbSnapshot) {
  if (snapshot.projectId !== PROJECT) throw Error('snapshot project mismatch');
  const live = new Set(authUsers.map(u => u.uid));
  const documents = snapshot.records.filter(r => typeof ownerOf(r) === 'string' && ownerOf(r) && !live.has(ownerOf(r))).map(r => ({ path: r.path, uid: ownerOf(r), hash: digest(r.data) }));
  const motion = [];
  for (const [trailId, trail] of Object.entries(rtdbSnapshot?.data || {})) {
    for (const [uid, value] of Object.entries(trail.motion || {})) if (!live.has(uid)) motion.push({ path: `trails/${trailId}/motion/${uid}`, uid, hash: digest(value) });
  }
  return { projectId: PROJECT, createdAt: new Date().toISOString(), protectedUids: [...live].sort(), googleUids: authUsers.filter(u => u.providers.includes('google.com')).map(u => u.uid).sort(), documents, motion, rtdbUrl: rtdbSnapshot?.url };
}

async function listAuth(auth) {
  const users = []; let token;
  do { const page = await auth.listUsers(1000, token); users.push(...page.users.map(u => ({ uid: u.uid, providers: u.providerData.map(p => p.providerId) }))); token = page.pageToken; } while (token);
  return users;
}
async function absent(auth, uid) {
  try { await auth.getUser(uid); return false; } catch (e) { if (e.code === 'auth/user-not-found') return true; throw e; }
}

async function main() {
  const flag = name => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
  if (process.argv.includes('--help')) { console.log('기본은 dry-run. --dir=<로컬 스냅샷 폴더> [--apply --project=boxcycle-dc2df --max=50]. 필요: firestore-before.json/auth-before.json/rtdb-before.json. Auth·공용 문서는 삭제하지 않음.'); return; }
  const dir = path.resolve(flag('dir') || path.join(root, '.out/private-guest-lifecycle'));
  const read = name => JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
  const snapshot = read('firestore-before.json');
  const originalAuth = read('auth-before.json');
  const rtdb = read('rtdb-before.json');
  validateDatabaseURL(rtdb.url);
  const { initFirebaseAdminForCli } = require(path.join(root, 'functions/lib/initAdminForCli.js'));
  const { getAuth } = require('firebase-admin/auth');
  const { getFirestore } = require('firebase-admin/firestore');
  const { getDatabaseWithUrl } = require('firebase-admin/database');
  initFirebaseAdminForCli({ projectId: PROJECT });
  const auth = getAuth(); const db = getFirestore();
  const current = await listAuth(auth);
  const originalGoogle = originalAuth.users.filter(u => u.providers.includes('google.com')).map(u => u.uid).sort();
  const currentGoogle = current.filter(u => u.providers.includes('google.com')).map(u => u.uid).sort();
  if (originalGoogle.length !== 4 || canonical(originalGoogle) !== canonical(currentGoogle)) throw Error('Google protection mismatch');
  const manifestPath = path.join(dir, 'orphan-manifest.json');
  const apply = process.argv.includes('--apply');
  const expected = planOrphans(snapshot, current, rtdb);
  const manifest = apply ? read('orphan-manifest.json') : structuredClone(expected);
  if (!apply) {
    // The census snapshot provides ownership; a fresh read prevents already-cleaned
    // or subsequently modified records from being presented as pending deletions.
    const candidates = manifest.documents;
    const present = new Set();
    for (let i = 0; i < candidates.length; i += 100) {
      const chunk = candidates.slice(i, i + 100);
      const rows = await db.getAll(...chunk.map(r => db.doc(r.path)));
      for (let j = 0; j < rows.length; j++) if (rows[j].exists && digest(rows[j].data()) === chunk[j].hash) present.add(chunk[j].path);
    }
    manifest.documents = candidates.filter(r => present.has(r.path));
    if (manifest.motion.length) {
      const database = getDatabaseWithUrl(rtdb.url);
      try {
        const liveTrails = (await database.ref('trails').get()).val() || {};
        manifest.motion = manifest.motion.filter(r => {
          const parts = r.path.split('/'); const value = liveTrails[parts[1]]?.motion?.[r.uid];
          return value != null && digest(value) === r.hash;
        });
      } finally { database.goOffline(); }
    }
  }
  if (!apply) fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  // Validate every target against original snapshot and current Auth; edited manifests fail closed.
  const subset = (rows, allowed) => new Set(rows.map(r => r.path)).size === rows.length && rows.every(row => allowed.some(r => canonical(r) === canonical(row)));
  if (!subset(manifest.documents, expected.documents) || !subset(manifest.motion, expected.motion) || manifest.projectId !== PROJECT || manifest.rtdbUrl !== rtdb.url) throw Error('manifest mismatch; run fresh dry-run');
  const summary = { mode: apply ? 'apply' : 'dry-run', protectedGoogle: 4, protectedAuth: current.length, orphanUids: new Set([...manifest.documents, ...manifest.motion].map(r => r.uid)).size, firestore: manifest.documents.length, rtdb: manifest.motion.length };
  if (!apply) { console.log(JSON.stringify(summary)); await require('firebase-admin/app').deleteApp(require('firebase-admin/app').getApp()); return; }
  const max = Number(flag('max'));
  if (flag('project') !== PROJECT || !Number.isInteger(max) || max < 1 || manifest.documents.length + manifest.motion.length > max) throw Error('explicit project/max required or target cap exceeded');
  if (Date.now() - Date.parse(manifest.createdAt) > 24 * 60 * 60 * 1000) throw Error('manifest expired');
  const log = { ...summary, deleted: [], skippedChanged: [], protected: [], failures: [] };
  const live = new Set(current.map(u => u.uid));
  const database = getDatabaseWithUrl(rtdb.url);
  try {
    for (const target of manifest.documents) {
      try {
        if (live.has(target.uid) || !(await absent(auth, target.uid))) { log.protected.push(target.path); continue; }
        const ref = db.doc(target.path); const snap = await ref.get();
        if (!snap.exists) continue;
        if (ownerOf({ path: target.path, data: snap.data() }) !== target.uid || digest(snap.data()) !== target.hash) { log.skippedChanged.push(target.path); continue; }
        await ref.delete({ lastUpdateTime: snap.updateTime }); log.deleted.push(target.path);
      } catch (e) { log.failures.push({ path: target.path, code: e.code || 'unknown' }); }
    }
    for (const target of manifest.motion) {
      try {
        if (live.has(target.uid) || !(await absent(auth, target.uid))) { log.protected.push(target.path); continue; }
        // The first transaction callback can receive an uncached null; proposing null
        // lets the server supply current data and retry with the actual value.
        const result = await database.ref(target.path).transaction(value => orphanMotionUpdate(value, target.hash));
        if (result.committed) log.deleted.push(target.path); else log.skippedChanged.push(target.path);
      } catch (e) { log.failures.push({ path: target.path, code: e.code || 'unknown' }); }
    }
    const after = await listAuth(auth);
    if (canonical(after.map(u => u.uid).sort()) !== canonical(current.map(u => u.uid).sort())) throw Error('Auth changed during cleanup; inspect');
  } finally { fs.writeFileSync(path.join(dir, `orphan-apply-${Date.now()}.json`), JSON.stringify(log, null, 2)); database.goOffline(); await require('firebase-admin/app').deleteApp(require('firebase-admin/app').getApp()); }
  console.log(JSON.stringify({ ...summary, deleted: log.deleted.length, skippedChanged: log.skippedChanged.length, protected: log.protected.length, failures: log.failures.length }));
  if (log.failures.length) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(e => { console.error(e.message); process.exitCode = 1; });
