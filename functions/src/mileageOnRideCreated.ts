import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { onDocumentCreated } from "firebase-functions/v2/firestore";

/**
 * 마일리지(누적 운동 이력) — rides 완주 저장 시 users/{uid} 에
 * 절대 감소하지 않는 누적 거리·시간·횟수를 서버에서 증가시킨다.
 *
 * conquest(「내 도로망」)와 달리 신규/재주행 구분 없이 distanceMeters>0 이면 전부 인정한다
 * (통계 용도라 악용 벡터가 없어 최소 거리 가드도 두지 않는다).
 *
 * 데이터: users/{uid} → mileageTotalMeters, mileageTotalSec, mileageRideCount
 *         rides/{rideId}.mileageApplied → 멱등 마킹(재시도 시 중복 집계 방지)
 */
export const mileageOnRideCreated = onDocumentCreated(
  { document: "rides/{rideId}", region: "asia-northeast3" },
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
    const userRef = db.doc(`users/${userId}`);

    try {
      await db.runTransaction(async (tx) => {
        const rideSnap = await tx.get(snap.ref);
        if (rideSnap.data()?.mileageApplied === true) return;

        tx.set(
          userRef,
          {
            mileageTotalMeters: FieldValue.increment(distanceMeters),
            mileageTotalSec: FieldValue.increment(
              Number.isFinite(elapsedSec) && elapsedSec > 0 ? elapsedSec : 0,
            ),
            mileageRideCount: FieldValue.increment(1),
          },
          { merge: true },
        );
        tx.update(snap.ref, { mileageApplied: true });
      });
    } catch (e) {
      console.error("mileageOnRideCreated failed", rideId, userId, e);
    }
  },
);
