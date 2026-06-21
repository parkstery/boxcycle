import {
  getFirestore,
  Timestamp,
  type QueryDocumentSnapshot,
} from "firebase-admin/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { ROUTE_ACTIVITY_COLLECTION } from "./routeActivityConstants.js";

const RIDES_COLLECTION = "rides";
/** heat 배지용 — 최근 24h completed rides 만 집계 */
const HEAT_WINDOW_MS = 24 * 60 * 60 * 1000;
const PAGE_SIZE = 400;

/**
 * 선택적 백필 — ride increment 가 주 경로. updatedAt 미기록 heat 시계 오염 방지.
 */
export const routeActivityHeatReconcile = onSchedule(
  {
    schedule: "every 7 days",
    region: "asia-northeast3",
    timeZone: "Asia/Seoul",
  },
  async () => {
    const db = getFirestore();
    const since = Timestamp.fromMillis(Date.now() - HEAT_WINDOW_MS);
    const counts = new Map<string, number>();

    let last: QueryDocumentSnapshot | undefined;
    for (;;) {
      let q = db
        .collection(RIDES_COLLECTION)
        .where("status", "==", "completed")
        .where("endedAt", ">=", since)
        .orderBy("endedAt")
        .limit(PAGE_SIZE);
      if (last) q = q.startAfter(last);
      const snap = await q.get();
      if (snap.empty) break;
      for (const doc of snap.docs) {
        const publicationId = doc.get("publicationId");
        const raw =
          typeof publicationId === "string" && publicationId.trim().length > 0
            ? publicationId.trim()
            : "";
        if (!raw) continue;
        counts.set(raw, (counts.get(raw) ?? 0) + 1);
      }
      last = snap.docs[snap.docs.length - 1];
      if (snap.size < PAGE_SIZE) break;
    }

    const activitySnap = await db.collection(ROUTE_ACTIVITY_COLLECTION).get();
    const prevById = new Map<string, number>();
    for (const d of activitySnap.docs) {
      const prev =
        typeof d.data().recentRideCount7d === "number" && Number.isFinite(d.data().recentRideCount7d)
          ? Math.max(0, Math.floor(d.data().recentRideCount7d))
          : 0;
      prevById.set(d.id, prev);
    }

    const toUpdate = new Set<string>([...counts.keys()]);
    for (const [id, prev] of prevById) {
      if (prev > 0) toUpdate.add(id);
    }

    let batch = db.batch();
    let ops = 0;
    let changed = 0;
    for (const publicationId of toUpdate) {
      const next = counts.get(publicationId) ?? 0;
      const prev = prevById.get(publicationId) ?? 0;
      if (next === prev) continue;
      batch.set(
        db.doc(`${ROUTE_ACTIVITY_COLLECTION}/${publicationId}`),
        { recentRideCount7d: next },
        { merge: true },
      );
      ops += 1;
      changed += 1;
      if (ops >= 400) {
        await batch.commit();
        batch = db.batch();
        ops = 0;
      }
    }
    if (ops > 0) await batch.commit();

    console.info("[routeActivityHeatReconcile]", {
      publicationsWithRides24h: counts.size,
      publicationsChanged: changed,
    });
  },
);
