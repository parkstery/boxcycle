import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MemoryGuestStore, MemoryGuestAuth, MemoryGuestRtdb,
  runGuestLifecycleSweep, beginGuestLinkLease, guestLifecyclePath,
  blankGuestLifecycleDoc, GUEST_INACTIVITY_MS,
} from '../functions/src/guestLifecycleCore.ts';

function fixture(user, options = {}) {
  const auth = new MemoryGuestAuth(); auth.users.set(user.uid, { ...user });
  const store = new MemoryGuestStore(); const rtdb = new MemoryGuestRtdb();
  const ports = {
    nowMs: 1_900_000_000_000, auth, store, rtdb, protectedUids: new Set(),
    listAuthUsers: async () => auth.list(), listProfileUids: async () => [],
    listRetryUids: async () => [], readUserProfile: async () => null,
    recentRideOrPresence: async () => false, deleteAccountData: async () => {}, ...options,
  };
  return { auth, store, rtdb, ports };
}
const registered = { uid: 'google-fixture', anonymous: false, disabled: true, admin: false, email: 'fixture@example.invalid' };
const guest = { uid: 'guest-fixture', anonymous: true, disabled: false, admin: false, email: null };

test('daily cleanup preserves an administratively disabled Google account', async () => {
  const f = fixture(registered);
  await runGuestLifecycleSweep(f.ports);
  assert.equal(f.auth.users.get(registered.uid).disabled, true);
  assert.deepEqual(f.auth.disabled, []);
});
test('daily cleanup preserves an administratively disabled protected Guest', async () => {
  const f = fixture({ ...guest, disabled: true }, { protectedUids: new Set([guest.uid]) });
  await runGuestLifecycleSweep(f.ports);
  assert.equal(f.auth.users.get(guest.uid).disabled, true);
  assert.deepEqual(f.auth.disabled, []);
});
test('transient lifecycle read failure cannot block a valid Guest before deletion is reserved', async () => {
  const f = fixture(guest);
  f.ports.store = { ...f.store, get: async () => { throw Error('unavailable'); }, runTransaction: f.store.runTransaction.bind(f.store) };
  await runGuestLifecycleSweep(f.ports);
  assert.notEqual(f.rtdb.blocked.get(guest.uid), true);
  assert.deepEqual(f.auth.disabled, []);
});
test('starting Google connection counts as new Guest activity', async () => {
  const f = fixture(guest);
  const old = f.ports.nowMs - GUEST_INACTIVITY_MS - 1;
  await f.store.runTransaction(async tx => tx.set(guestLifecyclePath(guest.uid), { ...blankGuestLifecycleDoc(), observedAtMs: old, lastActivityAtMs: old }));
  const result = await beginGuestLinkLease(f.ports, guest.uid, f.ports.nowMs);
  assert.equal(result.ok, true);
  const doc = await f.store.get(guestLifecyclePath(guest.uid));
  assert.equal(doc.lastActivityAtMs, f.ports.nowMs);
});
test('Guest data whose Auth account was already deleted is cleaned without a new 30-day grace', async () => {
  let cleaned = 0;
  const f = fixture(guest, {
    listProfileUids: async () => [guest.uid],
    readUserProfile: async () => ({ tier: 'anonymous', isAnonymous: true }),
    deleteAccountData: async () => { cleaned++; },
  });
  f.auth.users.delete(guest.uid);
  const result = await runGuestLifecycleSweep(f.ports);
  assert.equal(cleaned, 1);
  assert.equal(result.authAlreadyGone, 1);
});
test('overlapping daily workers delete the expired Guest once', async () => {
  let cleaned = 0;
  const f = fixture(guest, { deleteAccountData: async () => { cleaned++; await new Promise(resolve => setTimeout(resolve, 10)); } });
  const old = f.ports.nowMs - GUEST_INACTIVITY_MS - 1;
  await f.store.runTransaction(async tx => tx.set(guestLifecyclePath(guest.uid), { ...blankGuestLifecycleDoc(), observedAtMs: old, lastActivityAtMs: old }));
  await Promise.all([runGuestLifecycleSweep({ ...f.ports, workerId: 'worker-a' }), runGuestLifecycleSweep({ ...f.ports, workerId: 'worker-b' })]);
  assert.equal(cleaned, 1);
  assert.equal(f.auth.deleted.length, 1);
});
test('RTDB block failure prevents private data and Auth deletion', async () => {
  let cleaned = 0;
  const f = fixture(guest, { deleteAccountData: async () => { cleaned++; } });
  const old = f.ports.nowMs - GUEST_INACTIVITY_MS - 1;
  await f.store.runTransaction(async tx => tx.set(guestLifecyclePath(guest.uid), { ...blankGuestLifecycleDoc(), observedAtMs: old, lastActivityAtMs: old }));
  f.ports.rtdb = { setBlocked: async () => { throw Error('RTDB unavailable'); } };
  await runGuestLifecycleSweep(f.ports);
  assert.equal(cleaned, 0);
  assert.equal(f.auth.deleted.length, 0);
  assert.ok(f.auth.users.has(guest.uid));
});
