import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { initializeApp, deleteApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator, doc, getDocFromServer, terminate } from 'firebase/firestore';
import { syncConquestRoadData, parseRoadSummaryToken } from '../../src/lib/conquest/conquestRoadSync.ts';
import { readConquestRoadRecords } from '../../src/lib/conquest/repo/firestoreConquest.ts';
const require = createRequire(new URL('../../../../functions/package.json', import.meta.url));
const admin = require('firebase-admin/app');
const { getFirestore: adminFirestore, Timestamp } = require('firebase-admin/firestore');
const { applyConquestInTransaction } = require('./lib/conquestOnRideCreated.js');
const projectId = 'demo-conquest-sync';
assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8080', 'emulator only');

test('actual server transaction and client range query: 411 baseline, 0 unchanged, 2 delta docs with owner Rules', { timeout: 60000 }, async () => {
  const backend = admin.initializeApp({ projectId }, 'conquest-sync-backend');
  const app = initializeApp({ projectId, apiKey: 'emulator' }, 'conquest-sync-owner');
  const otherApp = initializeApp({ projectId, apiKey: 'emulator' }, 'conquest-sync-other');
  const client = getFirestore(app), other = getFirestore(otherApp);
  connectFirestoreEmulator(client, '127.0.0.1', 8080, { mockUserToken: { sub: 'owner', user_id: 'owner' } });
  connectFirestoreEmulator(other, '127.0.0.1', 8080, { mockUserToken: { sub: 'other', user_id: 'other' } });
  try {
    const db = adminFirestore(backend), parent = db.doc('conquest/owner');
    const seed = db.batch();
    const updatedAt = Timestamp.fromMillis(1000);
    seed.set(parent, { totalMeters: 1000, totalCells: 69, updatedAt, roadSync: { schema: 1, epoch: 'initial', version: 1, updatedAt } });
    for (let i = 1; i <= 69; i++) seed.set(parent.collection('chunks').doc(`12_${i}_0`), { cells: { [`20_${i * 256}_1`]: '2026-11-19' } });
    for (let i = 1; i <= 342; i++) seed.set(parent.collection('traces').doc(`legacy-${i}`), { path: [127, 37, 127, 37.001], day: '2026-11-19', newMeters: 1 });
    await seed.commit();
    let cache = null, documentResults = 0, confirmations = 0;
    const ports = {
      readCache: async () => cache,
      writeCache: async value => { cache = structuredClone(value); },
      dropCache: async () => { cache = null; },
      readRemote: async (since, token) => {
        const rows = await readConquestRoadRecords(client, 'owner', since, token);
        documentResults += rows.chunks.length + rows.traces.length;
        return rows;
      },
      readToken: async () => { confirmations++; return parseRoadSummaryToken((await getDocFromServer(doc(client, 'conquest/owner'))).data()); },
    };
    const initialToken = parseRoadSummaryToken((await parent.get()).data());
    const first = await syncConquestRoadData('owner', initialToken, ports);
    assert.equal(documentResults, 411);
    assert.equal(first.traces.length, 342);
    documentResults = 0; confirmations = 0;
    await syncConquestRoadData('owner', initialToken, ports);
    assert.equal(documentResults, 0);
    assert.equal(confirmations, 0);

    const ride = db.doc('rides/new-road');
    await ride.set({ userId: 'owner' });
    await db.runTransaction(tx => applyConquestInTransaction(tx, db, ride, {
      rideId: 'new-road', userId: 'owner', cells: [{ id: '20_1_1', m: 100 }],
      path: [127, 37, 127, 37.001], tier: 't0', pedalSec: null,
      elapsedSec: 600, distanceMeters: 100, resolveRegion: () => null,
    }));
    const nextToken = parseRoadSummaryToken((await parent.get()).data());
    assert.deepEqual(nextToken, { schema: 1, epoch: 'initial', version: 2 });
    const next = await syncConquestRoadData('owner', nextToken, ports);
    assert.equal(documentResults, 2);
    assert.equal(confirmations, 1);
    assert.equal(next.chunks.length, 70);
    assert.equal(next.traces.length, 343);
    assert.ok(next.traces.some(t => t.id === 'legacy-342'));
    assert.ok(next.traces.some(t => t.id === 'new-road'));
    // A prior epoch with high versions must not leak into a new epoch's range.
    await parent.collection('chunks').doc('old-epoch').set({ cells: { '20_9_9': '2026-11-19' }, roadSyncCursor: 'earlier:9999999999999999' });
    const delta = await readConquestRoadRecords(client, 'owner', 1, nextToken);
    assert.deepEqual(delta.chunks.map(c => c.id), ['12_0_0']);
    await assert.rejects(readConquestRoadRecords(other, 'owner', 1, nextToken), error => error.code === 'permission-denied');
    await parent.update({ totalMeters: 9999, updatedAt: Timestamp.now() }); // simulate an old server revision
    assert.equal(parseRoadSummaryToken((await parent.get()).data()), null, 'old writer invalidates incremental protocol');
    console.log(JSON.stringify({ baselineDocuments: 411, unchangedDocuments: 0, deltaDocuments: 2, deltaParentVerification: 1, rules: 'owner-only' }));
  } finally {
    await terminate(client); await terminate(other);
    await deleteApp(app); await deleteApp(otherApp); await admin.deleteApp(backend);
  }
});
