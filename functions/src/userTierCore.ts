import type { Firestore } from "firebase-admin/firestore";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { assertGuestLifecycleWritableInTx } from "./guestLifecycleGuard.js";

export type ServerUserTier = "anonymous" | "registered_free" | "registered_paid" | "admin";

/**
 * 이 모듈의 Admin 포트. 운영은 initializeApp 뒤의 Auth·Firestore 기본값 — 시험만 교체한다.
 * guestLifecycle guard 는 transaction 안 marker read가 Auth/Firestore 와 다른 원자성을 가지므로
 * 대체 포트로도 같은 계약을 검증한다.
 */
export type UserTierAdminDeps = {
  /** Auth. getUser 결과의 providerData 길이만 익명 판정에 쓰는 구조 계약. */
  auth: { getUser(uid: string): Promise<{ providerData: readonly unknown[] }> };
  db: Firestore;
};

/** 운영 기본값 — initializeApp 뒤가 보증되는 입구(HTTP handler·trigger 본문)에서만 늦게 만든다. */
export function userTierDefaultDeps(): UserTierAdminDeps {
  return { auth: getAuth(), db: getFirestore() };
}

/**
 * Auth·users 문서 동기 — 익명은 tier anonymous(미설정 시만), 연동 계정은 tier 클라이언트 승격에 맡김.
 *
 * set(Merge) 을 transaction 으로 바꿨다(02-task-09 §1). 비transaction set 은
 * guestLifecycle tombstone(deletionScheduled·disabling·deleting·failed·deleted) 뒤에서도
 * users/{uid} 를 되살릴 수 있었다. 이제 marker를 **같은 transaction 안에서 먼저 읽어**
 * blocking 상태면 GuestLifecycleBlockedError 로 쓰기를 거절한다 — sweep 의 arm·deleted 마커
 * 쓰기와 Firestore transaction 충돌 감지로 직렬화된다. marker 가 없는 정상
 * Google/Guest 는 기존 patch 내용 그대로다.
 */
export async function mergeUserAuthMeta(
  uid: string,
  deps: UserTierAdminDeps = userTierDefaultDeps(),
): Promise<{ isAnonymous: boolean }> {
  const userRecord = await deps.auth.getUser(uid);
  const isAnonymous = userRecord.providerData.length === 0;

  return deps.db.runTransaction(async (tx) => {
    await assertGuestLifecycleWritableInTx(tx, deps.db, uid);

    const ref = deps.db.doc(`users/${uid}`);
    const snap = await tx.get(ref);
    const existingTier = snap.data()?.tier as string | undefined;

    const patch: Record<string, unknown> = {
      isAnonymous,
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (isAnonymous) {
      if (!existingTier || existingTier.length === 0) {
        patch.tier = "anonymous" satisfies ServerUserTier;
        patch.tierUpdatedAt = FieldValue.serverTimestamp();
      }
    }

    tx.set(ref, patch, { merge: true });
    return { isAnonymous };
  });
}
