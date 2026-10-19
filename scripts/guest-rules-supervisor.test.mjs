/** Emulator-only integration: real ID token + real Firestore/RTDB Rules. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
const require = createRequire(new URL('../functions/package.json', import.meta.url));
const PROJECT = 'demo-boxcycle-guest';
const hosts = ['FIREBASE_AUTH_EMULATOR_HOST', 'FIRESTORE_EMULATOR_HOST', 'FIREBASE_DATABASE_EMULATOR_HOST'];
for (const key of hosts) assert.match(process.env[key] || '', /^(127\.0\.0\.1|localhost):\d+$/, `${key}: emulator required`);
const { initializeApp, deleteApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getDatabase } = require('firebase-admin/database');
const { getAuth } = require('firebase-admin/auth');
const app = initializeApp({ projectId: PROJECT, databaseURL: `https://${PROJECT}-default-rtdb.firebaseio.com` });
const db = getFirestore(app);
const rtdb = getDatabase(app);

async function identity() {
  const r = await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=emulator-key`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ returnSecureToken: true }) });
  assert.equal(r.status, 200); const j = await r.json(); return { uid: j.localId, token: j.idToken };
}
async function firestoreWrite(user, collection = 'userPrivate', data = { weightKg: { integerValue: '70' } }) {
  const r = await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/v1/projects/${PROJECT}/databases/(default)/documents/${collection}/${user.uid}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.token}` }, body: JSON.stringify({ fields: data }) });
  await r.text(); return r.status;
}
async function motionWrite(user) {
  const r = await fetch(`http://${process.env.FIREBASE_DATABASE_EMULATOR_HOST}/trails/fixture/motion/${user.uid}.json?ns=${PROJECT}-default-rtdb&auth=${encodeURIComponent(user.token)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ p: 'fixture-publication', d: 1, v: 2, ph: 'live', t: Date.now() }) });
  await r.text(); return r.status;
}

test('Rules block expired token writes without blocking another active identity', { timeout: 60000 }, async t => {
  try {
    const expired = await identity(); const active = await identity();
    await t.test('real HTTP registration validates emulator tokens, activity and link lease', async () => {
      const express = require('express');
      const { guestActivityHttp, guestLinkHttp } = require('../functions/lib/guestLifecycleHttp.js');
      const { ensureRouteTokenOnboardingHttp } = require('../functions/lib/routeTokenEnsureOnboarding.js');
      const api = express(); api.use(express.json());
      api.all('/activity', guestActivityHttp); api.all('/link', guestLinkHttp);
      api.all('/onboarding', ensureRouteTokenOnboardingHttp);
      const server = createServer(api);
      await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
      const base = `http://127.0.0.1:${server.address().port}`;
      async function post(path, token, body = {}) {
        const response = await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
        return { status: response.status, body: await response.json() };
      }
      try {
        assert.equal((await post('/activity', null)).status, 401);
        assert.equal((await post('/activity', active.token)).status, 200);
        const lease = await post('/link', active.token, { action: 'begin' });
        assert.equal(lease.status, 200); assert.ok(lease.body.result.leaseToken);
        assert.equal((await post('/link', active.token, { action: 'cancel', leaseToken: lease.body.result.leaseToken })).status, 200);
        await db.doc(`guestLifecycle/${active.uid}`).set({ status: 'deletionScheduled' });
        assert.equal((await post('/activity', active.token)).status, 409);
        await db.doc(`guestLifecycle/${active.uid}`).delete();
        const deleted = await identity(); await getAuth(app).deleteUser(deleted.uid);
        assert.equal((await post('/activity', deleted.token)).status, 401, 'revocation check rejects deleted Auth user with old token');
        const race = await identity(); const auth = getAuth(app); const original = auth.getUser;
        let calls = 0;
        try {
          auth.getUser = async function(uid) {
            if (uid === race.uid && ++calls === 2) throw Object.assign(new Error('fixture: Auth gone after token verification'), { code: 'auth/user-not-found' });
            return original.call(this, uid);
          };
          const out = await post('/onboarding', race.token);
          assert.ok(calls >= 2, 'fixture must reach post-verification Auth metadata lookup');
          assert.notEqual(out.status, 200, 'Auth metadata failure must stop onboarding');
          assert.equal((await db.doc(`users/${race.uid}`).get()).exists, false, 'metadata failure cannot recreate a profile');
          assert.equal((await db.collection('routeTokenLedger').where('userId', '==', race.uid).get()).empty, true);
        } finally { auth.getUser = original; }
      } finally { await new Promise(resolve => server.close(resolve)); }
    });
    await t.test('baseline real anonymous token can write private settings and motion', async () => {
      assert.equal(await firestoreWrite(expired), 200);
      assert.equal(await motionWrite(expired), 200);
    });
    for (const status of ['deletionScheduled', 'disabling', 'deleting', 'failed', 'deleted']) {
      await t.test(`${status} blocks client write and marker forgery`, async () => {
        await db.doc(`guestLifecycle/${expired.uid}`).set({ status });
        await rtdb.ref(`guestLifecycle/${expired.uid}/blocked`).set(true);
        assert.equal(await firestoreWrite(expired), 403);
        assert.equal(await firestoreWrite(expired, 'guestLifecycle', { status: { stringValue: 'active' } }), 403);
        assert.ok([401, 403].includes(await motionWrite(expired)));
        assert.equal(await firestoreWrite(active), 200);
        assert.equal(await motionWrite(active), 200);
      });
    }
    await t.test('already issued token cannot recreate data after Auth deletion', async () => {
      await getAuth(app).deleteUser(expired.uid);
      await db.doc(`userPrivate/${expired.uid}`).delete();
      assert.equal(await firestoreWrite(expired), 403);
      assert.ok([401, 403].includes(await motionWrite(expired)));
      assert.equal((await db.doc(`userPrivate/${expired.uid}`).get()).exists, false);
    });
    await t.test('Admin numeric and string transient store failures map to retryable HTTP 503', async () => {
      const { transientStoreHttpsError } = require('../functions/lib/guestLifecycleHttp.js');
      for (const code of [4, 10, 14, 'deadline-exceeded', 'aborted', 'unavailable']) {
        assert.equal(transientStoreHttpsError({ code })?.httpErrorCode.status, 503, `transient store code ${code}`);
      }
    });
    await t.test('Admin token onboarding cannot recreate deleted Guest documents', async () => {
      const { ensureRouteTokenOnboarding } = require('../functions/lib/routeTokenCore.js');
      const uid = 'fixture-deleted-admin-writer';
      await db.doc(`guestLifecycle/${uid}`).set({ status: 'deleted' });
      await ensureRouteTokenOnboarding(uid, true).catch(() => undefined);
      assert.equal((await db.doc(`users/${uid}`).get()).exists, false, 'Admin writer must honor deletion marker inside its transaction');
      assert.equal((await db.collection('routeTokenLedger').where('userId', '==', uid).get()).empty, true);
    });
    await t.test('in-flight route calculation cannot recreate a personal cache behind tombstone', async () => {
      const { writeRouteAutoRouteCache } = require('../functions/lib/distanceAutoRouteHttp.js');
      const uid = 'fixture-deleted-cache-writer';
      for (const status of ['deletionScheduled', 'disabling', 'deleting', 'failed', 'deleted']) {
        await db.doc(`guestLifecycle/${uid}`).set({ status });
        await assert.rejects(writeRouteAutoRouteCache(db, uid, 'fixture', { userId: uid, requestId: 'fixture' }));
        assert.equal((await db.collection('routeAutoRouteCache').where('userId', '==', uid).get()).empty, true);
      }
    });
    await t.test('delayed mileage trigger cannot recreate deleted Guest data', async () => {
      const { mileageOnRideCreated } = require('../functions/lib/mileageOnRideCreated.js');
      const uid = 'fixture-deleted-delayed-ride';
      const ref = db.doc('rides/fixture-delayed-ride');
      await ref.set({ userId: uid, distanceMeters: 100, elapsedSec: 60 });
      const snapshot = await ref.get();
      await db.doc(`guestLifecycle/${uid}`).set({ status: 'deleted' });
      await mileageOnRideCreated.run({ data: snapshot, params: { rideId: ref.id } });
      assert.equal((await db.doc(`users/${uid}`).get()).exists, false, 'delayed Admin trigger must honor deletion marker in transaction');
    });
    await t.test('Admin adapter discovers and cleans rides-only and RTDB-only orphan data', async () => {
      const { guestLifecyclePortsFromAdmin } = require('../functions/lib/guestLifecycleAdmin.js');
      const { runGuestLifecycleSweep } = require('../functions/lib/guestLifecycleCore.js');
      const uid = 'fixture-orphan-no-auth';
      const motionUid = 'fixture-orphan-motion-only';
      const traceUid = 'fixture-orphan-traces-only';
      const ledgerUid = 'fixture-orphan-ledger-only';
      const cacheUid = 'fixture-orphan-cache-only';
      const listingUid = 'fixture-orphan-listing-only';
      const googleUids = Array.from({ length: 4 }, (_, i) => `fixture-protected-google-${i}`);
      const imported = await getAuth(app).importUsers(googleUids.map((uid, i) => ({
        uid, email: `fixture-google-${i}@example.invalid`, disabled: i === 0,
        providerData: [{ providerId: 'google.com', uid: `fixture-google-provider-${i}`, email: `fixture-google-${i}@example.invalid` }],
      })));
      assert.equal(imported.successCount, 4);
      await db.doc('config/guestLifecycle').set({ protectedUids: googleUids });
      for (const uid of googleUids) await db.doc(`users/${uid}`).set({ nickname: uid, totalDistanceMeters: 12345 });
      const beforeGoogle = await Promise.all(googleUids.map(async uid => ({ user: (await getAuth(app).getUser(uid)).toJSON(), data: (await db.doc(`users/${uid}`).get()).data() })));
      await db.doc('rides/orphan-ride').set({ userId: uid, endedAt: new Date(0) });
      await db.doc(`conquest/${traceUid}/traces/fixture`).set({ cells: [], createdAt: new Date(0) });
      await db.doc('routeTokenLedger/orphan-ledger').set({ userId: ledgerUid, delta: 1 });
      await db.doc('routeAutoRouteCache/orphan-cache').set({ userId: cacheUid, requestId: 'fixture' });
      await db.doc('openTrailListings/orphan-listing').set({ hostUid: listingUid });
      await rtdb.ref(`trails/orphan-trail/motion/${motionUid}`).set({ p: 'fixture', d: 0, v: 0, ph: 'paused', t: 1 });
      const ports = await guestLifecyclePortsFromAdmin(db, getAuth(app), rtdb, Date.now());
      const candidates = await ports.listProfileUids();
      assert.ok(candidates.includes(uid), 'rides-only orphan must be discovered');
      assert.ok(candidates.includes(motionUid), 'motion-only orphan must be discovered');
      assert.ok(candidates.includes(traceUid), 'missing-parent traces-only orphan must be discovered');
      assert.ok(candidates.includes(ledgerUid), 'ledger-only orphan must be discovered');
      assert.ok(candidates.includes(cacheUid), 'private route cache-only orphan must be discovered');
      assert.ok(candidates.includes(listingUid), 'personal open listing-only orphan must be discovered');
      await runGuestLifecycleSweep(ports);
      assert.equal((await db.doc('rides/orphan-ride').get()).exists, false);
      assert.equal((await rtdb.ref(`trails/orphan-trail/motion/${motionUid}`).get()).exists(), false);
      assert.equal((await db.doc(`conquest/${traceUid}/traces/fixture`).get()).exists, false);
      assert.equal((await db.doc('routeTokenLedger/orphan-ledger').get()).exists, false);
      assert.equal((await db.doc('routeAutoRouteCache/orphan-cache').get()).exists, false);
      assert.equal((await db.doc('openTrailListings/orphan-listing').get()).exists, false);
      for (let i = 0; i < googleUids.length; i++) {
        const uid = googleUids[i];
        assert.deepEqual((await db.doc(`users/${uid}`).get()).data(), beforeGoogle[i].data, 'protected Google data must be identical');
        const user = await getAuth(app).getUser(uid);
        assert.equal(user.disabled, i === 0, 'administrative disabled state must remain unchanged');
        assert.deepEqual(JSON.parse(JSON.stringify(user.providerData)), JSON.parse(JSON.stringify(beforeGoogle[i].user.providerData)));
      }
    });
  } finally { rtdb.goOffline(); await deleteApp(app); }
});
