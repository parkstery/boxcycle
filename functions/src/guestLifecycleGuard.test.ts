/**
 * Admin 개인자료 writer 공용 guard — guestLifecycle tombstone 경합 계약.
 *
 * 실제 Firestore/RTDB emulator 는 Supervisor 전용이므로, 이 파일은 가짜 Firestore
 * transaction(runTransaction 재시도 충돌 감지 흉내)과 가짜 Auth 로 같은 계약을
 * 함수 단위로 고정한다:
 *
 * 1. blocking 5상태(deletionScheduled·disabling·deleting·failed·deleted)는 transaction
 *    안·밖 게이트 모두 차단한다.
 * 2. marker 가 없는 정상 Google 계정은 mergeUserAuthMeta 가 기존 patch 그대로 동작하고
 *    guestLifecycle 문서를 만들지 않는다.
 * 3. writer transaction read 집합에 marker 가 있으므로, marker 읽은 뒤에 arm 되면
 *    충돌 재시도가 blocking marker 를 만나 쓰기를 거절한다(예약 race).
 * 4. group 스캔 경로 검증 — conquest 고아·members 류 혼입 계약.
 *
 * 실행: functions 에서 `node --test lib/guestLifecycleGuard.test.js`
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import type { Firestore } from "firebase-admin/firestore";
import {
  GUEST_WRITE_BLOCK_STATUSES,
  type GuestWriteBlockStatus,
} from "./guestLifecycleCore.js";
import {
  GuestLifecycleBlockedError,
  assertGuestLifecycleWritable,
  assertGuestLifecycleWritableInTx,
  guestWriteBlockStatusOf,
  isGuestLifecycleBlockedError,
} from "./guestLifecycleGuard.js";
import { mergeUserAuthMeta } from "./userTierCore.js";
import { conquestOrphanUidFromDocPath, membershipUidFromDocPath } from "./guestLifecycleAdmin.js";
import {
  FakeAdminFirestore,
  fakeAdminDeps,
  fakeAdminDepsWithProviders,
  markerStatusOf,
  seedMarker,
  type FakeTx,
} from "./guestAdminFakeFirestore.js";

const UID = "guest-fixture-1";

test("guard 는 blocking 5상태를 transaction 안 게이트에서 전부 차단한다", async () => {
  for (const status of GUEST_WRITE_BLOCK_STATUSES) {
    const db = new FakeAdminFirestore();
    seedMarker(db, UID, status);
    // 여기서 get 은 검문 대상만 보는 최소 tx — set 이 있어도 폐기 전부다.
    let writes = 0;
    await assert.rejects(
      (db as unknown as { runTransaction: (fn: (tx: FakeTx) => Promise<void>) => Promise<void> }).runTransaction(async (tx) => {
        await assertGuestLifecycleWritableInTx(tx as never, db as unknown as Firestore, UID);
        tx.set({ path: `users/${UID}` } as never, { recreated: true });
        writes += 1;
      }),
      (error: unknown) => {
        assert.ok(isGuestLifecycleBlockedError(error), `${status} 은 GuestLifecycleBlockedError 로 분류된다`);
        assert.equal(error.guestLifecycleStatus, status);
        assert.equal(error.code, "guest-lifecycle/blocked");
        return true;
      },
    );
    assert.equal(writes, 0, `${status} 차단은 그 transaction 의 쓰기를 전부 폐기한다`);
  }
});

test("guard 는 marker 가 없거나 active·linking·exempt 면 통과시킨다(정상 계약 유지)", async () => {
  for (const status of [null, "active", "linking", "exempt", "not-a-status"]) {
    const db = new FakeAdminFirestore();
    if (status) seedMarker(db, UID, status as GuestWriteBlockStatus);
    const dbLike = db as unknown as Firestore;
    await dbLike.runTransaction(async (tx) => {
      await assertGuestLifecycleWritableInTx(tx as never, dbLike, UID);
    });
    assert.equal(db.attempts, 1, "차단이 아니면 재시도를 돌지 않는다");
  }
});

test("transaction 밖 게이트도 5상태를 차단하고 일시 읽기 실패는 통과시키지 않는다", async () => {
  for (const status of GUEST_WRITE_BLOCK_STATUSES) {
    const db = new FakeAdminFirestore();
    seedMarker(db, UID, status);
    await assert.rejects(
      assertGuestLifecycleWritable(db as unknown as Firestore, UID),
      GuestLifecycleBlockedError,
      `${status}`,
    );
  }
  const clean = new FakeAdminFirestore();
  await assertGuestLifecycleWritable(clean as unknown as Firestore, UID);
  assert.ok(!["deletionScheduled", "disabling", "deleting", "failed", "deleted"].includes(String(markerStatusOf(clean, UID))));
});

test("guard는 marker 문서를 절대 쓰지 않는다 — guestWriteBlockStatusOf 도 모르는 값을 막는다", () => {
  assert.equal(guestWriteBlockStatusOf("deleting"), "deleting");
  assert.equal(guestWriteBlockStatusOf("DELETING"), null);
  assert.equal(guestWriteBlockStatusOf(undefined), null);
  assert.equal(guestWriteBlockStatusOf("exempt"), null);
});

test("정상 Google 계정 merge 는 기존 patch 그대로이고 marker 문서를 만들지 않는다", async () => {
  const db = new FakeAdminFirestore();
  db.docs.set(`users/${UID}`, { tier: "registered_free" });
  const result = await mergeUserAuthMeta(UID, fakeAdminDepsWithProviders(db, 1));
  assert.equal(result.isAnonymous, false);
  const user = db.docs.get(`users/${UID}`)!;
  assert.equal(user.isAnonymous, false);
  assert.equal(user.tier, "registered_free", "클라이언트 승격 tier 는 건드리지 않는다");
  assert.ok("updatedAt" in user);
  assert.equal(markerStatusOf(db, UID), undefined, "guard 는 marker 의 읽기만 한다");
});

test("정상 익명 Guest merge 는 tier anonymous 를 채워 넣는다(기존 계약)", async () => {
  const db = new FakeAdminFirestore();
  const result = await mergeUserAuthMeta(UID, fakeAdminDeps(db));
  assert.equal(result.isAnonymous, true);
  const user = db.docs.get(`users/${UID}`)!;
  assert.equal(user.tier, "anonymous");
});

test("삭제 예약 뒤 merge 는 users 문서를 만들지 않고 거절한다(Admin 재생성 방지)", async () => {
  for (const status of GUEST_WRITE_BLOCK_STATUSES) {
    const fresh = new FakeAdminFirestore();
    seedMarker(fresh, UID, status);
    await assert.rejects(
      mergeUserAuthMeta(UID, fakeAdminDeps(fresh)),
      (error: unknown) => isGuestLifecycleBlockedError(error) && error.guestLifecycleStatus === status,
      `${status}`,
    );
    assert.equal(fresh.docs.get(`users/${UID}`), undefined, `${status} 차단 뒤 users 재생성은 없다`);
  }
});

test("merge read 뒤에 삭제가 예약되면 충돌 재시도가 blocking marker 를 만나 차단한다(예약 race)", async () => {
  /*
   * 함수 입구 확인만으로 해결 주장 금지에 대한 재현: writer transaction 이 marker 를
   * active 로 읽은 직후 sweep 이 arm(deletionScheduled) 으로 버전을 올리고, writer 가
   * 커밋하려면 충돌 감지로 재시도가 돌아 다시 marker 를 읽는다. 그때 blocking 이므로
   * users 쓰기 없이 거절된다 — read 집합 안 marker 가 경합을 직렬화하는 근거다.
   */
  const db = new FakeAdminFirestore();
  db.onMarkerReadHook = () => seedMarker(db, UID, "deletionScheduled");
  const before = db.attempts;
  await assert.rejects(
    mergeUserAuthMeta(UID, fakeAdminDeps(db)),
    (error: unknown) => isGuestLifecycleBlockedError(error) && error.guestLifecycleStatus === "deletionScheduled",
  );
  assert.ok(db.attempts >= before + 2, "재시도가 실제로 돌았다");
  assert.equal(db.docs.get(`users/${UID}`), undefined);
  assert.equal(markerStatusOf(db, UID), "deletionScheduled", "sweep 마커는 writer 가 되돌리지 않는다");
});

test("marker 읽은 뒤 deleted 가 되어도 같은 직렬화로 차단된다", async () => {
  const db = new FakeAdminFirestore();
  db.onMarkerReadHook = () => seedMarker(db, UID, "deleted");
  await assert.rejects(
    mergeUserAuthMeta(UID, fakeAdminDeps(db)),
    (error: unknown) => isGuestLifecycleBlockedError(error) && error.guestLifecycleStatus === "deleted",
  );
  assert.equal(db.docs.get(`users/${UID}`), undefined);
});

test("group 스캔 경로 검증 — conquest 고아·membership 귀속만 후보가 된다", () => {
  assert.equal(conquestOrphanUidFromDocPath("conquest/orphan-uid/chunks/f_1_x"), "orphan-uid");
  assert.equal(conquestOrphanUidFromDocPath("conquest/orphan-uid/traces/ride-1"), "orphan-uid");
  // 다른 루트 컬렉션의 chunks·traces 는 conquest 귀속 근거가 아니다.
  assert.equal(conquestOrphanUidFromDocPath("rooms/a/members/b"), null);
  assert.equal(conquestOrphanUidFromDocPath("trails/a/b/c"), null);
  assert.equal(conquestOrphanUidFromDocPath("conquest/a/members/b"), null);
  assert.equal(conquestOrphanUidFromDocPath("conquest/a/chunks"), null);

  assert.equal(membershipUidFromDocPath("trails/t1/members/guest-1"), "guest-1");
  assert.equal(membershipUidFromDocPath("publicationSessions/p1/members/guest-2"), "guest-2");
  assert.equal(membershipUidFromDocPath("trails/t1/livePublicationRides/guest-3"), "guest-3");
  // rooms(구 시대)·coursePresence 는 개인귀속 삭제 경로가 아니다.
  assert.equal(membershipUidFromDocPath("rooms/t1/members/guest-1"), null);
  assert.equal(membershipUidFromDocPath("coursePresence/p1/members/guest-1"), null);
  assert.equal(membershipUidFromDocPath("trails/t1/othernames/guest-1"), null);
});
