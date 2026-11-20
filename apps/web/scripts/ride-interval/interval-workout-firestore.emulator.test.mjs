import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { initializeApp, deleteApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator, doc, getDoc, updateDoc, deleteDoc, terminate } from 'firebase/firestore';

const projectId = 'demo-boxcycle-interval';
const host = process.env.FIRESTORE_EMULATOR_HOST ?? '';
assert.match(host, /^(127\.0\.0\.1|localhost):\d+$/, 'local emulator required');
process.env.RTW_VITE_ENV_OVERRIDES = JSON.stringify({ VITE_FIREBASE_API_KEY: 'emulator', VITE_FIREBASE_AUTH_DOMAIN: 'demo.invalid', VITE_FIREBASE_PROJECT_ID: projectId, VITE_FIREBASE_APP_ID: 'emulator', VITE_USE_EMULATOR: '' });
await import('../s42/register-vite-env.mjs');
const { getFirebaseFirestore, getFirebaseApp } = await import('../../src/lib/firebase/app.ts');
const { loadRideSessionsInRangeFromFirestore, saveRideSessionToFirestore, saveIntervalWorkoutFeedback } = await import('../../src/lib/ride/repo/firestoreRides.ts');
const { IntervalWorkoutTracker } = await import('../../src/lib/ride/intervalWorkout.ts');
const require = createRequire(new URL('../../../../functions/package.json', import.meta.url));
const adminApp = require('firebase-admin/app');
const adminFirestore = require('firebase-admin/firestore');

test('real repository pagination, interval persistence and owner-only feedback Rules', { timeout: 90000 }, async t => {
  const backend = adminApp.initializeApp({ projectId }, 'interval-workout-tests');
  const db = adminFirestore.getFirestore(backend);
  const own = getFirebaseFirestore();
  connectFirestoreEmulator(own, '127.0.0.1', Number(host.split(':')[1]), { mockUserToken: { sub: 'owner', user_id: 'owner' } });
  const otherApp = initializeApp({ projectId, apiKey: 'emulator' }, 'interval-other');
  const other = getFirestore(otherApp);
  connectFirestoreEmulator(other, '127.0.0.1', Number(host.split(':')[1]), { mockUserToken: { sub: 'other', user_id: 'other' } });
  try {
    const endedAt = new Date('2026-11-20T01:00:00Z');
    const start = new Date('2026-11-01T00:00:00Z');
    const end = new Date('2026-12-01T00:00:00Z');
    const batch = db.batch();
    for (let i = 0; i < 401; i++) batch.set(db.doc(`rides/history-${String(i).padStart(3, '0')}`), { userId: 'owner', endedAt, distanceMeters: 1000, elapsedSec: 300 });
    batch.set(db.doc('rides/other'), { userId: 'other', endedAt, distanceMeters: 1000, elapsedSec: 300 });
    batch.set(db.doc('rides/outside'), { userId: 'owner', endedAt: end, distanceMeters: 1000, elapsedSec: 300 });
    await batch.commit();
    await t.test('more than 400 equal-timestamp rows are paginated once, in-range and owner-only', async () => {
      const rows = await loadRideSessionsInRangeFromFirestore('owner', start, end);
      assert.equal(rows.length, 401);
      assert.equal(new Set(rows.map(row => row.id)).size, 401);
      assert.equal(rows[0].intervalWorkouts, undefined, 'old history is unknown, not fabricated non-interval history');
      assert.equal((await loadRideSessionsInRangeFromFirestore('owner', end, new Date('2027-01-01'))).length, 1);
    });
    const tracker = new IntervalWorkoutTracker();
    tracker.begin({ id: 'workout-1', config: { highSec: 30, lowSec: 30, repeats: 3, warmupSec: 0, cooldownSec: 0 }, intensity: 'moderate', elapsedSec: 0, activeSec: 0, weightKg: 70 });
    tracker.advance({ elapsedSec: 180, activeSec: 180 });
    let rideId;
    await t.test('short virtual-distance workout survives save/read roundtrip', async () => {
      rideId = await saveRideSessionToFirestore({ userId: 'owner', trailId: null, profile: 'cycling', session: {
        id: 'local-workout-ride', endedAt: endedAt.toISOString(), elapsedSec: 180, distanceMeters: 0,
        avgSpeedKmh: 0, caloriesEstimate: 17, routeDistanceMeters: 1000, routeDurationSec: 300,
        intervalWorkouts: tracker.snapshot(),
      } });
      assert.ok(rideId);
      const rows = await loadRideSessionsInRangeFromFirestore('owner', start, end);
      assert.equal(rows.length, 402);
      assert.equal(rows.find(row => row.id === rideId).intervalWorkouts[0].status, 'completed');
    });
    await t.test('feedback persists through real repository without modifying measured fields', async () => {
      await saveIntervalWorkoutFeedback(rideId, 'workout-1', 'as-planned');
      const row = (await loadRideSessionsInRangeFromFirestore('owner', start, end)).find(row => row.id === rideId);
      assert.equal(row.intervalWorkouts[0].feedback, 'as-planned');
      assert.equal(row.caloriesEstimate, 17);
      await assert.rejects(updateDoc(doc(own, 'rides', rideId), { elapsedSec: 999 }), e => e.code === 'permission-denied');
      await assert.rejects(updateDoc(doc(own, 'rides', rideId), { intervalFeedback: { 'workout-1': 'invalid' } }), e => e.code === 'permission-denied');
      await assert.rejects(updateDoc(doc(other, 'rides', rideId), { intervalFeedback: { 'workout-1': 'harder' } }), e => e.code === 'permission-denied');
      await assert.rejects(getDoc(doc(other, 'rides', rideId)), e => e.code === 'permission-denied');
      await assert.rejects(deleteDoc(doc(own, 'rides', rideId)), e => e.code === 'permission-denied');
    });
    await t.test('account deletion gate also blocks feedback metadata', async () => {
      await db.doc('guestLifecycle/owner').set({ status: 'deleting' });
      await assert.rejects(saveIntervalWorkoutFeedback(rideId, 'workout-1', 'harder'), e => e.code === 'permission-denied');
    });
  } finally {
    await terminate(own); await terminate(other);
    await deleteApp(getFirebaseApp()); await deleteApp(otherApp);
    await adminApp.deleteApp(backend);
  }
});
