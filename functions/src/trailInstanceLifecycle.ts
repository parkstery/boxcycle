import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { OPEN_TRAIL_LISTINGS_COLLECTION } from "./openTrailListingCore.js";

import { TRAIL_LIVE_PUBLICATION_RIDES_SUBCOLLECTION } from "./trailPaths.js";
import { REGION } from "./region.js";
import {
  ARCHIVED_PURGE_MS,
  CLOSED_TO_ARCHIVED_MS,
  OPEN_QUIET_TO_CLOSED_MS,
  resolveArchivedAtMs,
  resolveClosedAtMs,
  shouldCloseQuietOpenTrail,
} from "./trailLifecycleCore.js";

const TRAILS_COLLECTION = "trails";
const MEMBERS_SUB = "members";
const LIVE_SUB = TRAIL_LIVE_PUBLICATION_RIDES_SUBCOLLECTION;

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
 * 아무도 없는 `open` → `closed` (24h 조용) → `archived` (24h) → 삭제 (7d).
 * 클라이언트 open 목록은 `status == open` 만 조회.
 *
 * 첫 단계가 2026-09-27 에 붙었다. 그전까지 Trail 이 닫히는 경우는 **「개설자가 주행
 * 종료」 한 곳뿐**이었고, 그것이 개설자를 자기 Trail 에서 쫓아내는 결함이라 제거했다.
 * 제거만 하면 **아무것도 정리 줄에 서지 못한다** — 실측으로 열린 Trail 147개 중 145개가
 * 이미 하루 넘게 죽어 있었고 가장 오래된 것은 131일이었다.
 *
 * 그래서 기준을 「누가 Stop 을 눌렀나」에서 **「아무도 안 달리나」**로 옮긴다.
 * 사람의 행동이 아니라 상태로 판단하므로, 탭만 닫고 사라진 Trail 도 함께 치워진다.
 */
export const trailInstanceLifecycle = onSchedule(
  {
    schedule: "every 12 hours",
    region: REGION,
    timeZone: "Asia/Seoul",
  },
  async () => {
    const db = getFirestore();
    const now = Date.now();
    const closedCutoff = now - CLOSED_TO_ARCHIVED_MS;
    const purgeCutoff = now - ARCHIVED_PURGE_MS;

    /*
     * ① 아무도 없는 열린 Trail 을 닫는다.
     *
     * ⚠️ 닫힌 Trail 은 다시 열 수 없다. 기준을 짧게 줄이면 「쉬었다 돌아오려던 사람이
     *    쫓겨나는」 2026-09-27 의 결함이 그대로 돌아온다. 판정은 `trailLifecycleCore` 에 있다.
     */
    const quietSnap = await db
      .collection(TRAILS_COLLECTION)
      .where("status", "==", "open")
      .limit(200)
      .get();

    let quietClosedCount = 0;
    for (const doc of quietSnap.docs) {
      if (doc.id === "default") continue;
      if (!shouldCloseQuietOpenTrail(doc.data(), timestampMs, now)) continue;
      await doc.ref.update({
        status: "closed",
        closedAt: FieldValue.serverTimestamp(),
        lastActivityAt: FieldValue.serverTimestamp(),
      });
      quietClosedCount += 1;
    }

    const closedSnap = await db
      .collection(TRAILS_COLLECTION)
      .where("status", "==", "closed")
      .limit(200)
      .get();

    let archivedCount = 0;
    for (const doc of closedSnap.docs) {
      const data = doc.data();
      const closedMs = resolveClosedAtMs(data, timestampMs);
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
      const archivedMs = resolveArchivedAtMs(data, timestampMs);
      if (archivedMs == null || archivedMs > purgeCutoff) continue;
      const trailId = doc.id;
      if (trailId === "default") continue;
      await db.collection(OPEN_TRAIL_LISTINGS_COLLECTION).doc(trailId).delete().catch(() => {});
      await deleteSubcollection(trailId, MEMBERS_SUB);
      await deleteSubcollection(trailId, LIVE_SUB);
      await doc.ref.delete();
      purgedCount += 1;
    }

    console.info("[trailInstanceLifecycle]", {
      quietClosedCount,
      quietHours: Math.round(OPEN_QUIET_TO_CLOSED_MS / (60 * 60 * 1000)),
      archivedCount,
      purgedCount,
    });
  },
);
