import { getFirestore } from "firebase-admin/firestore";

const BATCH_LIMIT = 500;

type MileageAccumulator = {
  totalMeters: number;
  totalSec: number;
  count: number;
};

export type BackfillMileageResult = {
  usersUpdated: number;
  ridesScanned: number;
  ridesIncluded: number;
  totalKm: number;
};

/**
 * 마일리지 전기간 재계산 백필.
 *
 * mileageApplied 여부와 무관하게 전체 rides 를 다시 합산해 users 문서에
 * **절대값**으로 덮어쓴다(FieldValue.increment 를 쓰면 CF 가 이미 적용한 값과
 * 중복 집계되므로 set(merge:true) 로 절대값을 써야 한다).
 */
export async function backfillMileageCore(input: {
  dryRun?: boolean;
}): Promise<BackfillMileageResult> {
  const dryRun = input.dryRun === true;
  const db = getFirestore();

  const ridesSnap = await db.collection("rides").get();
  const byUser = new Map<string, MileageAccumulator>();
  const includedRideRefs: FirebaseFirestore.DocumentReference[] = [];

  let ridesScanned = 0;
  let ridesIncluded = 0;

  for (const doc of ridesSnap.docs) {
    ridesScanned += 1;
    const data = doc.data();
    const userId = typeof data.userId === "string" ? data.userId : "";
    const distanceMeters = Number(data.distanceMeters);
    if (!userId || !Number.isFinite(distanceMeters) || distanceMeters <= 0) continue;

    const elapsedSec = Number(data.elapsedSec);
    const acc = byUser.get(userId) ?? { totalMeters: 0, totalSec: 0, count: 0 };
    acc.totalMeters += distanceMeters;
    acc.totalSec += Number.isFinite(elapsedSec) && elapsedSec > 0 ? elapsedSec : 0;
    acc.count += 1;
    byUser.set(userId, acc);

    ridesIncluded += 1;
    includedRideRefs.push(doc.ref);
  }

  let usersUpdated = 0;
  let totalMeters = 0;

  if (!dryRun) {
    for (const [userId, acc] of byUser) {
      await db.doc(`users/${userId}`).set(
        {
          mileageTotalMeters: acc.totalMeters,
          mileageTotalSec: acc.totalSec,
          mileageRideCount: acc.count,
        },
        { merge: true },
      );
      usersUpdated += 1;
      totalMeters += acc.totalMeters;
    }

    for (let i = 0; i < includedRideRefs.length; i += BATCH_LIMIT) {
      const chunk = includedRideRefs.slice(i, i + BATCH_LIMIT);
      const batch = db.batch();
      for (const ref of chunk) {
        batch.update(ref, { mileageApplied: true });
      }
      await batch.commit();
    }
  } else {
    usersUpdated = byUser.size;
    for (const acc of byUser.values()) totalMeters += acc.totalMeters;
  }

  return {
    usersUpdated,
    ridesScanned,
    ridesIncluded,
    totalKm: Math.round((totalMeters / 1000) * 10) / 10,
  };
}
