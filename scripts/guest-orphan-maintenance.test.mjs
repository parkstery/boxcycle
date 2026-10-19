import test from 'node:test';
import assert from 'node:assert/strict';
import { ownerOf, planOrphans, digest, orphanMotionUpdate, validateDatabaseURL } from './guest-orphan-maintenance.mjs';

test('shared Trail and publication are preserved; nested UID records discovered without users', () => {
  const records = [
    { path: 'trails/t1', data: { hostUid: 'missing' } },
    { path: 'routePublications/p1', data: { applicantUid: 'missing' } },
    { path: 'trails/t1/members/missing', data: {} },
    { path: 'publicationSessions/p1/members/missing', data: {} },
    { path: 'conquest/missing/traces/day', data: { cells: [1] } },
    { path: 'rides/r1', data: { userId: 'google' } },
    { path: 'userPrivate/newGuest', data: { weightKg: 70 } },
  ];
  const p = planOrphans({ projectId: 'boxcycle-dc2df', records }, [{ uid: 'google', providers: ['google.com'] }, { uid: 'newGuest', providers: [] }], { data: { t1: { motion: { missing: { p: 'p1' }, google: { p: 'p1' } } } } });
  assert.equal(p.documents.length, 3);
  assert.equal(p.motion.length, 1);
  assert.ok(p.documents.every(r => r.uid === 'missing'));
  assert.equal(ownerOf(records[0]), null);
});
test('canonical snapshot hash tolerates key order but detects changed data', () => {
  assert.equal(digest({ b: 2, a: { x: 1 } }), digest({ a: { x: 1 }, b: 2 }));
  assert.notEqual(digest({ b: 2 }), digest({ b: 3 }));
});
test('project mismatch fails closed', () => {
  assert.throws(() => planOrphans({ projectId: 'other', records: [] }, []), /project/);
});
test('RTDB CAS handles uncached initial null and aborts on concurrent updates', () => {
  const data = { p: 'p1', t: 123 };
  assert.equal(orphanMotionUpdate(null, digest(data)), null);
  assert.equal(orphanMotionUpdate(data, digest(data)), null);
  assert.equal(orphanMotionUpdate({ ...data, t: 124 }, digest(data)), undefined);
});
test('RTDB URL cannot target a different project or emulator', () => {
  validateDatabaseURL('https://boxcycle-dc2df-default-rtdb.firebaseio.com');
  validateDatabaseURL('https://boxcycle-dc2df-default-rtdb.asia-southeast1.firebasedatabase.app');
  assert.throws(() => validateDatabaseURL('https://other-default-rtdb.firebaseio.com'), /mismatch/);
  assert.throws(() => validateDatabaseURL('http://127.0.0.1:9000'), /mismatch/);
});
