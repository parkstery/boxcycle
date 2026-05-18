import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";

const TRAILS_COLLECTION = "trails";
const MEMBERS_SUB = "members";
const LIVE_SUB = "liveCourseRides";

/** UI 목록에서 사라진 뒤 DB에 남기는 기간 */
const CLOSED_TO_ARCHIVED_MS = 24 * 60 * 60 * 1000;
/** archived 메타·서브컬렉션 정리 */
const ARCHIVED_PURGE_MS = 7 * 24 * 60 * 60 * 1000;
const BATCH_LIMIT = 400;

function timestampMs(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw === "object" && raw !== null && typeof (raw as Timestamp).toMillis === "function") {
    const ms = (raw as Timestamp).toMillis();
    return Number.isFinite(ms) ? ms : null;
  }
  return null;
}

async function deleteSubcollection(trailId: string, sub: string): Promise<number> {
  const db = getFirestore();
  const coll = db.collection(TRAILS_COLLECTION).doc(trailId).collection(sub);
  let deleted = 0;
  while (true) {
    const snap = await coll.limit(BATCH_LIMIT).get();
    if (snap.empty) break;
    const batch = db.batch();
    for (const d of snap.docs) {
      batch.delete(d.ref);
      deleted += 1;
    }
    await batch.commit();
    if (snap.size < BATCH_LIMIT) break;
  }
  return deleted;
}

/**
 * `closed` Trail → `archived` (24h) → 서브컬렉션·문서 삭제 (7d).
 * 클라이언트 open 목록은 `status == open` 만 조회.
 */
export const trailInstanceLifecycle = onSchedule(
  {
    schedule: "every 12 hours",
    region: "asia-northeast3",
    timeZone: "Asia/Seoul",
  },
  async () => {
    const db = getFirestore();
    const now = Date.now();
    const closedCutoff = now - CLOSED_TO_ARCHIVED_MS;
    const purgeCutoff = now - ARCHIVED_PURGE_MS;

    const closedSnap = await db
      .collection(TRAILS_COLLECTION)
      .where("status", "==", "closed")
      .limit(200)
      .get();

    let archivedCount = 0;
    for (const doc of closedSnap.docs) {
      const data = doc.data();
      const closedMs =
        timestampMs(data.closedAt) ?? timestampMs(data.lastActivityAt) ?? timestampMs(data.createdAt);
      if (closedMs == null || closedMs > closedCutoff) continue;
      await doc.ref.update({
        status: "archived",
        archivedAt: FieldValue.serverTimestamp(),
        lastActivityAt: FieldValue.serverTimestamp(),
      });
      archivedCount += 1;
    }

    const archivedSnap = await db
      .collection(TRAILS_COLLECTION)
      .where("status", "==", "archived")
      .limit(100)
      .get();

    let purgedCount = 0;
    for (const doc of archivedSnap.docs) {
      const data = doc.data();
      const archivedMs =
        timestampMs(data.archivedAt) ?? timestampMs(data.closedAt) ?? timestampMs(data.lastActivityAt);
      if (archivedMs == null || archivedMs > purgeCutoff) continue;
      const trailId = doc.id;
      if (trailId === "default") continue;
      await deleteSubcollection(trailId, MEMBERS_SUB);
      await deleteSubcollection(trailId, LIVE_SUB);
      await doc.ref.delete();
      purgedCount += 1;
    }

    console.info("[trailInstanceLifecycle]", { archivedCount, purgedCount });
  },
);
