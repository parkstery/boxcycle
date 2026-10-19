/**
 * 지연 Admin trigger 의 guestLifecycle tombstone 계약 — mileage·conquest·routeToken
 * trigger transaction 본문이 marker 를 같은 transaction 으로 읽는지를 격리 fake DB 로 고정한다.
 *
 * 실제 emulator 는 Supervisor 전용(scripts/guest-rules-supervisor.test.mjs)이므로, 이 파일은
 * 각 trigger transaction 본문을 격리 DB 로 직접 실행한다:
 * - marker 가 없는 대상은 기존 지급·증분·집계 수치 그대로다(정상 Google/Guest 영향 없음).
 * - blocking 5상태(deletionScheduled·disabling·deleting·failed·deleted) 뒤 지연 도착은
 *   지급·적립·증분·posting 없이 거절되고 users·routeTokenLedger·conquest 를 만들지 않는다.
 *
 * 실행: functions 에서 `node --test lib/guestLifecycleTriggersGuard.test.js`
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { GUEST_WRITE_BLOCK_STATUSES } from "./guestLifecycleCore.js";
import {
  FakeAdminFirestore,
  fakeAdminDeps,
  markerStatusOf,
  seedMarker,
} from "./guestAdminFakeFirestore.js";
import { applyConquestInTransaction } from "./conquestOnRideCreated.js";
import { applyMileageInTransaction } from "./mileageOnRideCreated.js";
import {
  DEFAULT_ROUTE_TOKEN_ECONOMY,
  earnRouteTokenForCompletedRide,
  ensureRouteTokenOnboarding,
} from "./routeTokenCore.js";

const UID = "orphan-guest-1";

/** 격리 fake db + 그 db 를 Auth·Firestore deps 로 꽂은 조합. */
function fixture(): { db: FakeAdminFirestore; deps: ReturnType<typeof fakeAdminDeps> } {
  const db = new FakeAdminFirestore();
  return { db, deps: fakeAdminDeps(db) };
}

/** deps.db 는 격리 fake db — ref 생성도 같은 표면을 쓴다. */
function rideRef(deps: { db: unknown }, path: string): { path: string } {
  return (deps.db as { doc(p: string): { path: string } }).doc(path);
}

test("지연 mileage trigger — marker 없으면 기존 증분·rides 멱등 마킹 그대로다", async () => {
  const { db, deps } = fixture();
  const userRefPath = `users/${UID}`;
  await deps.db.runTransaction(async (tx) => {
    await applyMileageInTransaction(
      tx as never,
      deps.db,
      rideRef(deps, "rides/fixture-ride-1") as never,
      { rideId: "fixture-ride-1", userId: UID, distanceMeters: 1000, elapsedSec: 100 },
    );
  });
  const user = db.docs.get(userRefPath);
  assert.ok(user, "tombstone 없는 대상에는 users 원장이 쓰인다");
  assert.ok("mileageTotalMeters" in user, "increment 는 그 transaction 이 처리한다");
  assert.equal(user.mileageRideCount, 1);
});

test("지연 mileage trigger — blocking 5상태 뒤 도착은 users 원장을 만들지 않는다", async () => {
  for (const status of GUEST_WRITE_BLOCK_STATUSES) {
    const { db, deps } = fixture();
    seedMarker(db, UID, status);
    await assert.rejects(
      deps.db.runTransaction(async (tx) => {
        await applyMileageInTransaction(
          tx as never,
          deps.db,
          rideRef(deps, "rides/fixture-ride-1") as never,
          { rideId: "fixture-ride-1", userId: UID, distanceMeters: 1000, elapsedSec: 100 },
        );
      }),
      /tombstone/,
      `${status}`,
    );
    assert.equal(db.docs.get(`users/${UID}`), undefined, `${status} 뒤 users 재생성 금지`);
  }
});

test("지연 conquest trigger — marker 없으면 chunks·traces·summary·rides 마킹을 쓴다(이동 본문 그대로)", async () => {
  const { db, deps } = fixture();
  await deps.db.runTransaction(async (tx) => {
    await applyConquestInTransaction(
      tx as never,
      deps.db,
      rideRef(deps, "rides/fixture-conquest-1") as never,
      {
        rideId: "fixture-conquest-1",
        userId: UID,
        cells: [{ id: "20_100_200", m: 500 }],
        path: [127, 37, 127.001, 37.001],
        tier: "t0",
        pedalSec: null,
        elapsedSec: 600,
        distanceMeters: 500,
      },
    );
  });
  const summary = db.docs.get(`conquest/${UID}`);
  assert.ok(summary, "tombstone 없는 대상에는 conquest 요약이 쓰인다");
  assert.equal(summary.totalMeters, 500);
  assert.ok(db.docs.get(`conquest/${UID}/chunks/12_0_0`), "chunk 소유 표시");
  assert.ok(db.docs.get(`conquest/${UID}/traces/fixture-conquest-1`), "「내 도로망」 궤적");
  const ride = db.docs.get("rides/fixture-conquest-1")!;
  assert.ok(ride.conquestResult, "rides.conquestResult 마킹");
});

test("지연 conquest trigger — blocking 5상태 뒤 도착은 conquest 하위 전체를 만들지 않는다", async () => {
  for (const status of GUEST_WRITE_BLOCK_STATUSES) {
    const { db, deps } = fixture();
    seedMarker(db, UID, status);
    await assert.rejects(
      deps.db.runTransaction(async (tx) => {
        await applyConquestInTransaction(
          tx as never,
          deps.db,
          rideRef(deps, "rides/fixture-conquest-1") as never,
          {
            rideId: "fixture-conquest-1",
            userId: UID,
            cells: [{ id: "20_100_200", m: 500 }],
            path: [127, 37, 127.001, 37.001],
            tier: "t0",
            pedalSec: null,
            elapsedSec: 600,
            distanceMeters: 500,
          },
        );
      }),
      /tombstone/,
      `${status}`,
    );
    assert.equal(db.docs.get(`conquest/${UID}`), undefined, `${status} 뒤 conquest 재생성 금지`);
  }
});

test("온보딩 지급 — marker 없는 Guest 는 기존 수치(guest 10)를 그대로 받는다", async () => {
  const { db, deps } = fixture();
  const balance = await ensureRouteTokenOnboarding(UID, true, deps as never);
  assert.equal(balance, DEFAULT_ROUTE_TOKEN_ECONOMY.guestOnboardingGrant);
  const user = db.docs.get(`users/${UID}`)!;
  assert.equal(user.routeTokenBalance, DEFAULT_ROUTE_TOKEN_ECONOMY.guestOnboardingGrant);
  assert.equal(user.routeTokenOnboardingGranted, true);
  assert.ok(db.docs.get(`routeTokenLedger/onboarding:${UID}`), "지급 원장 기록(멱등키)");
});

test("온보딩 지급 — blocking 5상태 뒤 재요청은 users·routeTokenLedger 를 만들지 않는다", async () => {
  for (const status of GUEST_WRITE_BLOCK_STATUSES) {
    const { db, deps } = fixture();
    seedMarker(db, UID, status);
    await assert.rejects(
      ensureRouteTokenOnboarding(UID, true, deps as never),
      /tombstone/,
      `${status}`,
    );
    assert.equal(db.docs.get(`users/${UID}`), undefined, `${status} 뒤 users 원장`);
    assert.equal(db.docs.get(`routeTokenLedger/onboarding:${UID}`), undefined, `${status} 뒤 지급 원장`);
    assert.equal(markerStatusOf(db, UID), status, `${status} 마커 자체는 건드리지 않는다`);
  }
});

test("완주 적립 — blocking 5상태 뒤 원장·잔액이 없다", async () => {
  for (const status of GUEST_WRITE_BLOCK_STATUSES) {
    const { db, deps } = fixture();
    seedMarker(db, UID, status);
    await assert.rejects(
      earnRouteTokenForCompletedRide({
        userId: UID,
        rideId: "fixture-earn-1",
        courseId: null,
        distanceMeters: 10_000,
        elapsedSec: 600,
        status: "completed",
        isAnonymous: true,
      }, deps as never),
      /tombstone/,
      `${status}`,
    );
    assert.equal(db.docs.get(`users/${UID}`), undefined, `${status} 뒤 users 원장`);
    assert.equal(db.docs.get("routeTokenLedger/ride_complete:fixture-earn-1"), undefined, `${status} 뒤 적립 원장`);
  }
});

test("완주 적립 — marker 없으면 기존 계산(거리×rate) 그대로다", async () => {
  const { db, deps } = fixture();
  db.seed(`users/${UID}`, { isAnonymous: true, routeTokenBalance: 2, routeTokenOnboardingGranted: true });
  const balance = await earnRouteTokenForCompletedRide({
    userId: UID,
    rideId: "fixture-earn-2",
    courseId: null,
    distanceMeters: 10_000,
    elapsedSec: 600,
    status: "completed",
    isAnonymous: true,
  }, deps as never);
  const expectedEarn = Math.floor(10 * DEFAULT_ROUTE_TOKEN_ECONOMY.earnPerKm);
  assert.ok(expectedEarn > 0, "fixture 는 적립이 0 이 되는 경계가 아니게 한다");
  assert.equal(balance, 2 + expectedEarn);
  const ledgerEntry = db.docs.get("routeTokenLedger/ride_complete:fixture-earn-2")!;
  assert.equal(ledgerEntry.balanceAfter, 2 + expectedEarn);
});
