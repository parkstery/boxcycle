import type { DocumentReference, Firestore, Transaction } from "firebase-admin/firestore";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { isGuestLifecycleBlockedError, assertGuestLifecycleWritableInTx } from "./guestLifecycleGuard.js";
import { REGION } from "./region.js";

/**
 * 마일리지(누적 운동 이력) — rides 완주 저장 시 users/{uid} 에
 * 절대 감소하지 않는 누적 거리·시간·횟수를 서버에서 증가시킨다.
 *
 * conquest(「내 도로망」)와 달리 신규/재주행 구분 없이 distanceMeters>0 이면 전부 인정한다
 * (통계 용도라 악용 벡터가 없어 최소 거리 가드도 두지 않는다).
 *
 * 데이터: users/{uid} → mileageTotalMeters, mileageTotalSec, mileageRideCount
 *         rides/{rideId}.mileageApplied → 멱등 마킹(재시도 시 중복 집계 방지)
 *
 * 지연 trigger 경합(02-task-09 §2): rides 생성 event 가 Guest 정리 sweep 뒤에 도달해도
 * tombstone 뒤 users/{uid} 를 (merge)재생성하지 않는다. marker 를 쓰기 전 같은
 * transaction 으로 읽어 blocking 상태면 쓰기를 거절하고 그 transaction 의 쓰기를 전부 폐기한다.
 */
export const mileageOnRideCreated = onDocumentCreated(
  { document: "rides/{rideId}", region: REGION },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const data = snap.data() as Record<string, unknown>;

    const userId = typeof data.userId === "string" ? data.userId : "";
    const distanceMeters = Number(data.distanceMeters);
    const elapsedSec = Number(data.elapsedSec);
    if (!userId) return;
    if (!Number.isFinite(distanceMeters) || distanceMeters <= 0) return;

    const db = getFirestore();
    const rideId = event.params.rideId;

    try {
      await db.runTransaction(async (tx) => {
        await applyMileageInTransaction(tx, db, snap.ref, {
          rideId,
          userId,
          distanceMeters,
          elapsedSec,
        });
      });
    } catch (e) {
      if (isGuestLifecycleBlockedError(e)) {
        // tombstone 뒤 지연 도착 — 재생성 금지 계약의 정상 종료. 재시도 대상이 아니다.
        console.warn(
          "mileageOnRideCreated skipped behind guestLifecycle tombstone",
          rideId,
          userId,
          e.guestLifecycleStatus,
        );
        return;
      }
      console.error("mileageOnRideCreated failed", rideId, userId, e);
    }
  },
);

export type MileageRideInput = {
  rideId: string;
  userId: string;
  distanceMeters: number;
  elapsedSec: number;
};

/**
 * users 원장 증분 transaction 본문 — Admin trigger 와 지연 event 가 같은 계약을 쓴다.
 * marker 검문이 첫 동작: blocking 상태면 그 transaction 의 모든 쓰기(멱등 마킹 포함)가 폐기되고
 * sweep 의 arm/deleted 마커 쓰기와는 Firestore transaction 충돌 감지로 직렬화된다.
 */
export async function applyMileageInTransaction(
  tx: Transaction,
  db: Firestore,
  rideRef: DocumentReference,
  input: MileageRideInput,
): Promise<void> {
  await assertGuestLifecycleWritableInTx(tx, db, input.userId);
  const userRef = db.doc(`users/${input.userId}`);
  const rideSnap = await tx.get(rideRef);
  if (rideSnap.data()?.mileageApplied === true) return;

  tx.set(
    userRef,
    {
      mileageTotalMeters: FieldValue.increment(input.distanceMeters),
      mileageTotalSec: FieldValue.increment(
        Number.isFinite(input.elapsedSec) && input.elapsedSec > 0 ? input.elapsedSec : 0,
      ),
      mileageRideCount: FieldValue.increment(1),
    },
    { merge: true },
  );
  tx.update(rideRef, { mileageApplied: true });
}
