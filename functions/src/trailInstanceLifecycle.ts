import { FieldValue, getFirestore, Timestamp, type QueryDocumentSnapshot } from "firebase-admin/firestore";
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
  scanAllPages,
  shouldCloseQuietOpenTrail,
} from "./trailLifecycleCore.js";

const TRAILS_COLLECTION = "trails";
const MEMBERS_SUB = "members";
const LIVE_SUB = TRAIL_LIVE_PUBLICATION_RIDES_SUBCOLLECTION;

const BATCH_LIMIT = 400;
const PAGE_SIZE = 200;
/** 함수 제한 60초 — 남은 일은 다음 실행(12시간 뒤)이 이어 간다 */
const RUN_BUDGET_MS = 45_000;

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
    const startedMs = Date.now();
    const outOfTime = () => Date.now() - startedMs > RUN_BUDGET_MS;
    // 단계마다 문서를 끝까지 페이지로 훑는다 — 종전 limit 한 번은 기한 지난 것을 남겼다(scanAllPages 주석).
    const stage = (status: string) => (after: QueryDocumentSnapshot | null) => {
      let q = db.collection(TRAILS_COLLECTION).where("status", "==", status).limit(PAGE_SIZE);
      if (after) q = q.startAfter(after);
      return q.get().then((snap) => snap.docs);
    };

    /*
     * ① 아무도 없는 열린 Trail 을 닫는다.
     *
     * ⚠️ 닫힌 Trail 은 다시 열 수 없다. 기준을 짧게 줄이면 「쉬었다 돌아오려던 사람이
     *    쫓겨나는」 2026-09-27 의 결함이 그대로 돌아온다. 판정은 `trailLifecycleCore` 에 있다.
     */
    let quietClosedCount = 0;
    const openScan = await scanAllPages(stage("open"), PAGE_SIZE, async (doc) => {
      if (doc.id === "default") return;
      if (!shouldCloseQuietOpenTrail(doc.data(), timestampMs, now)) return;
      await doc.ref.update({
        status: "closed",
        closedAt: FieldValue.serverTimestamp(),
        lastActivityAt: FieldValue.serverTimestamp(),
      });
      quietClosedCount += 1;
    }, outOfTime);

    let archivedCount = 0;
    const closedScan = await scanAllPages(stage("closed"), PAGE_SIZE, async (doc) => {
      const closedMs = resolveClosedAtMs(doc.data(), timestampMs);
      if (closedMs == null || closedMs > closedCutoff) return;
      await doc.ref.update({
        status: "archived",
        archivedAt: FieldValue.serverTimestamp(),
        lastActivityAt: FieldValue.serverTimestamp(),
      });
      archivedCount += 1;
    }, outOfTime);

    let purgedCount = 0;
    const archivedScan = await scanAllPages(stage("archived"), PAGE_SIZE, async (doc) => {
      const archivedMs = resolveArchivedAtMs(doc.data(), timestampMs);
      if (archivedMs == null || archivedMs > purgeCutoff) return;
      const trailId = doc.id;
      if (trailId === "default") return;
      await db.collection(OPEN_TRAIL_LISTINGS_COLLECTION).doc(trailId).delete().catch(() => {});
      await deleteSubcollection(trailId, MEMBERS_SUB);
      await deleteSubcollection(trailId, LIVE_SUB);
      await doc.ref.delete();
      purgedCount += 1;
    }, outOfTime);

    console.info("[trailInstanceLifecycle]", {
      quietClosedCount,
      quietHours: Math.round(OPEN_QUIET_TO_CLOSED_MS / (60 * 60 * 1000)),
      archivedCount,
      purgedCount,
      // true 면 시간 예산에서 멈췄다 — 남은 것은 다음 실행이 이어 간다
      stoppedForTime: openScan.stopped || closedScan.stopped || archivedScan.stopped,
      elapsedMs: Date.now() - startedMs,
    });
  },
);
