/**
 * Task12 HTTP 오류경로·후보 보완 계약(02-task-12 §1~§3, 08-supervisor-admin-review):
 *
 * 1. transientStoreHttpsError — 문자열 동의어(unavailable·aborted·deadline-exceeded)와
 *    Admin gRPC 숫자 코드 4(DEADLINE_EXCEEDED)·10(ABORTED)·14(UNAVAILABLE)를 같은 503으로
 *    분류한다. 모르는 코드는 null — 호출 측 기존 처리(500 등)로 둔다.
 * 2. permanentAuthHttpsError — verifyIdToken 뒤 삭제경합으로 mergeUserAuthMeta(Admin
 *    getUser)가 auth/user-not-found 를 나면 401(unauthenticated)로 분류한다. 무조건 200 /
 *    Guest hint fallback / 500 축소는 금지 계약이다.
 * 3. metadata 실패 삼킴 제거의 구조 보증 — mergeUserAuthMeta 가 Auth 실패로 거절되면
 *    users 원장 쓰기가 아예 일어나지 않는다(정상 Google·Guest 보존은 guestLifecycleGuard.test 참조).
 * 4. openTrailListings.hostUid 후보 — `openTrailListings/{docId}` 최상위 경로만 개인귀속
 *    근거로 인정하고, 같은 이름의 subcollection 문자(예: trails/{id}/openTrailListings/…)
 *    는 거절한다(정책 delete·실제 정리 purge 모두 최상위 컬렉션만 감). trails.hostUid
 *    공용역사 제외 원칙은 여전히 유지한다.
 *
 * 실행: functions 에서 `node --test lib/guestLifecycleHttpGate.test.js`
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import type { Firestore } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import {
  isOpenTrailListingOwnershipPath,
  membershipUidFromDocPath,
} from "./guestLifecycleAdmin.js";
import { GuestLifecycleBlockedError } from "./guestLifecycleGuard.js";
import { mergeUserAuthMeta } from "./userTierCore.js";
import {
  permanentAuthHttpsError,
  transientStoreHttpsError,
} from "./guestLifecycleHttp.js";
import {
  FakeAdminFirestore,
  fakeAdminDeps,
  fakeAdminDepsWithProviders,
} from "./guestAdminFakeFirestore.js";

const UID = "orphan-guest-1";

function statusOf(error: HttpsError | null): number | null {
  return error ? error.httpErrorCode.status : null;
}

function errorWith(code: string | number): Error & { code: string | number } {
  const e = new Error(`synthetic-${code}`) as Error & { code: string | number };
  e.code = code;
  return e;
}

test("transientStoreHttpsError — 문자열 코드는 종래 계약 그대로 503이다", () => {
  for (const code of ["unavailable", "aborted", "deadline-exceeded"]) {
    assert.equal(statusOf(transientStoreHttpsError(errorWith(code))), 503, `${code} 은 503`);
  }
});

test("transientStoreHttpsError — Admin gRPC 숫자 코드 4·10·14 도 같은 503으로 분류한다", () => {
  for (const code of [4, 10, 14]) {
    assert.equal(statusOf(transientStoreHttpsError(errorWith(code))), 503, `${code} 은 문자열 계열과 같은 503`);
  }
  // 나머지 숫자는 일시 집합 밖 — null(호출 측 500 등 기존 처리)로 남는다.
  for (const code of [3, 5, 9, 16]) {
    assert.equal(transientStoreHttpsError(errorWith(code)), null, `${code} 은 503 으로 줄이지 않는다`);
  }
});

test("permanentAuthHttpsError — 삭제경합 user-not-found 를 401로 분류한다", () => {
  const notFound = permanentAuthHttpsError(errorWith("auth/user-not-found"));
  assert.equal(statusOf(notFound), 401);
  assert.ok(notFound instanceof HttpsError && notFound.code === "unauthenticated");

  const disabled = permanentAuthHttpsError(errorWith("auth/user-disabled"));
  assert.equal(statusOf(disabled), 401);

  // 알수없는 실패는 영구로 분류하지 않는다 — null 이면 호출 측이 500 으로 정직 종료한다.
  assert.equal(permanentAuthHttpsError(errorWith("auth/too-many-requests")), null);
  assert.equal(permanentAuthHttpsError(new Error("plain")), null);
});

test("metadata Auth 실패 뒤 users 원장 쓰기 없음 — 삼키지 않고 401/503으로 끊긴다", async () => {
  /* mergeUserAuthMeta 가 Auth 실패(getUser user-not-found → 401 / 일시 unavailable → 503)를 그대로
   * 전파하고, transaction 을 아예 열지 않으므로 users 원장·ledger 가 (재)생성될 여지가 없다. */
  const permanent = errorWith("auth/user-not-found");
  const dbPermanent = new FakeAdminFirestore();
  await assert.rejects(
    mergeUserAuthMeta(UID, {
      auth: { getUser: async () => { throw permanent; } },
      db: dbPermanent as unknown as Firestore,
    }),
    permanent,
  );
  assert.equal(dbPermanent.docs.get(`users/${UID}`), undefined, "삭제경합 getUser 실패 뒤 users 재생성 금지");
  assert.equal(dbPermanent.attempts, 0, "실패는 transaction 을 열지도 않는다");
  assert.equal(statusOf(permanentAuthHttpsError(permanent)), 401);

  const transient = errorWith("unavailable");
  const dbTransient = new FakeAdminFirestore();
  await assert.rejects(
    mergeUserAuthMeta(UID, {
      auth: { getUser: async () => { throw transient; } },
      db: dbTransient as unknown as Firestore,
    }),
    transient,
  );
  assert.equal(dbTransient.docs.get(`users/${UID}`), undefined, "일시 장애 뒤 users 재생성 금지");
  assert.equal(statusOf(transientStoreHttpsError(transient)), 503);
  assert.equal(statusOf(transientStoreHttpsError(errorWith(14))), 503);
});

test("metadata 통과 뒤의 정상 merge 는 기존 계약을 그대로다(정상 Google 보존 회귀 확인)", async () => {
  const db = new FakeAdminFirestore();
  db.seed(`users/${UID}`, { tier: "registered_free" });
  const result = await mergeUserAuthMeta(UID, fakeAdminDepsWithProviders(db, 1));
  assert.equal(result.isAnonymous, false);
  const user = db.docs.get(`users/${UID}`)!;
  assert.equal(user.tier, "registered_free", "클라이언트 승격 tier 는 건드리지 않는다");
  assert.ok("updatedAt" in user);
  await mergeUserAuthMeta(UID, fakeAdminDeps(db));
});

test("openTrailListings hostUid 후보 — 최상위 귀속 경로만 인정한다", () => {
  assert.equal(isOpenTrailListingOwnershipPath("openTrailListings"), false, "문서 경로가 아니면 근거가 없다");
  assert.equal(isOpenTrailListingOwnershipPath("openTrailListings/tr_1"), true);
  // 같은 이름이라도 subcollection 문자는 정리 purge 대상(최상위 스캔)과 다르다 — 귀속 근거가 아니다.
  assert.equal(isOpenTrailListingOwnershipPath("trails/t1/openTrailListings/tr_1"), false);
  assert.equal(isOpenTrailListingOwnershipPath("rooms/a/openTrailListings/tr_1"), false);
  assert.equal(isOpenTrailListingOwnershipPath("trails/t1/members/guest-1"), false);

  // trails.hostUid 공용역사 제외 원칙 — trails 문서 자체·hostUid 필드 경로는 귀속 근거가 아니다.
  assert.equal(membershipUidFromDocPath("trails/t1/hostUid/g"), null);
});

test("guard 차단 오류는 영구 Auth mapper 로 바꿔치기 하지 않는다 — 403 계약은 blocked mapper 가 유지한다", () => {
  const blockedError = new GuestLifecycleBlockedError("deleted", UID);
  assert.equal(permanentAuthHttpsError(blockedError), null);
});
