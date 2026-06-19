import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { liveAnchorFromCourseData } from "./courseGeometryAnchor.js";
import { ROUTE_ACTIVITY_COLLECTION } from "./routeActivityConstants.js";

export const WORLD_ACTIVITY_COLLECTION = "worldActivity";
export const WORLD_GLOBAL_ID = "global";

function routeActivityDocRef(db: FirebaseFirestore.Firestore, publicationId: string) {
  return db.doc(`${ROUTE_ACTIVITY_COLLECTION}/${publicationId.trim()}`);
}

async function mergeRouteActivityDoc(
  publicationId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const id = publicationId.trim();
  if (!id) return;
  await routeActivityDocRef(getFirestore(), id).set(patch, { merge: true });
}

export function pulseLevelFromProgress(progressRatio: number): number {
  if (!Number.isFinite(progressRatio)) return 1;
  const r = Math.max(0, Math.min(1, progressRatio));
  if (r >= 0.75) return 3;
  if (r >= 0.4) return 2;
  return 1;
}

export async function bumpCourseLiveSessionStarted(publicationId: string): Promise<void> {
  const id = publicationId.trim();
  if (!id) return;
  const db = getFirestore();
  const patch = {
    activeRiderCount: FieldValue.increment(1),
    liveNow: true,
    pulseLevel: 1,
    updatedAt: FieldValue.serverTimestamp(),
  };
  await mergeRouteActivityDoc(id, patch);
  await db.doc(`${WORLD_ACTIVITY_COLLECTION}/${WORLD_GLOBAL_ID}`).set(
    {
      livePulseCount: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

export async function bumpCourseLiveSessionEnded(publicationId: string): Promise<void> {
  const id = publicationId.trim();
  if (!id) return;
  const db = getFirestore();
  const routeRef = routeActivityDocRef(db, id);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(routeRef);
    const cur =
      typeof snap.data()?.activeRiderCount === "number" && Number.isFinite(snap.data()!.activeRiderCount)
        ? Math.max(0, Math.floor(snap.data()!.activeRiderCount as number))
        : 0;
    const next = Math.max(0, cur - 1);
    const endedPatch: Record<string, unknown> = {
      activeRiderCount: next,
      liveNow: next > 0,
      pulseLevel: next > 0 ? 1 : 0,
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (next === 0) {
      endedPatch.liveAnchorLngLat = FieldValue.delete();
      endedPatch.liveAnchorProgressRatio = FieldValue.delete();
    }
    tx.set(routeRef, endedPatch, { merge: true });
  });
  const worldRef = db.doc(`${WORLD_ACTIVITY_COLLECTION}/${WORLD_GLOBAL_ID}`);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(worldRef);
    const cur =
      typeof snap.data()?.livePulseCount === "number" && Number.isFinite(snap.data()!.livePulseCount)
        ? Math.max(0, Math.floor(snap.data()!.livePulseCount as number))
        : 0;
    const next = Math.max(0, cur - 1);
    tx.set(
      worldRef,
      {
        livePulseCount: next,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  });
}

/** 진행률·pulse만 반영 — geometry 읽기 없음 (하트비트·소폭 progress 갱신용) */
export async function touchCourseLiveProgressPulseOnly(
  publicationId: string,
  progressRatio: number,
): Promise<void> {
  const id = publicationId.trim();
  if (!id) return;
  const patch = {
    liveNow: true,
    pulseLevel: pulseLevelFromProgress(progressRatio),
    liveAnchorProgressRatio: Math.max(0, Math.min(1, progressRatio)),
    updatedAt: FieldValue.serverTimestamp(),
  };
  await mergeRouteActivityDoc(id, patch);
}

/** 세션 시작·전환 — geometry anchor 포함 (`courses` 또는 `routePublications` 1회 읽기) */
export async function touchCourseLiveProgressWithAnchor(
  publicationId: string,
  progressRatio: number,
): Promise<void> {
  const id = publicationId.trim();
  if (!id) return;
  const db = getFirestore();
  const patch: Record<string, unknown> = {
    liveNow: true,
    pulseLevel: pulseLevelFromProgress(progressRatio),
    updatedAt: FieldValue.serverTimestamp(),
  };

  const pubSnap = await db.doc(`routePublications/${id}`).get();
  const anchorSource = pubSnap.exists
    ? (pubSnap.data() as Record<string, unknown>)
    : null;
  if (anchorSource) {
    const anchor = liveAnchorFromCourseData(anchorSource, progressRatio);
    if (anchor) {
      patch.liveAnchorLngLat = anchor.lngLat;
      patch.liveAnchorProgressRatio = anchor.progressRatio;
    }
  }

  await mergeRouteActivityDoc(id, patch);
}

/** @deprecated 내부 호환 — anchor 포함 전체 갱신 */
export async function touchCourseLiveProgress(publicationId: string, progressRatio: number): Promise<void> {
  await touchCourseLiveProgressWithAnchor(publicationId, progressRatio);
}

const HIGHLIGHTED_PUBLICATIONS_MAX = 24;

/** 라이브 publication 상위 N개를 `worldActivity/global.highlightedCourses`에 반영 */
export async function refreshWorldHighlightedCourses(): Promise<void> {
  const db = getFirestore();
  const snap = await db
    .collection(ROUTE_ACTIVITY_COLLECTION)
    .where("liveNow", "==", true)
    .orderBy("activeRiderCount", "desc")
    .limit(32)
    .get();

  const ranked = snap.docs
    .map((d) => {
      const data = d.data();
      const count =
        typeof data.activeRiderCount === "number" && Number.isFinite(data.activeRiderCount)
          ? Math.max(0, Math.floor(data.activeRiderCount))
          : 0;
      return { id: d.id, count };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, HIGHLIGHTED_PUBLICATIONS_MAX)
    .map((r) => r.id);

  let livePulseCount = 0;
  for (const d of snap.docs) {
    const c =
      typeof d.data().activeRiderCount === "number" && Number.isFinite(d.data().activeRiderCount)
        ? Math.max(0, Math.floor(d.data().activeRiderCount))
        : 0;
    livePulseCount += c;
  }

  await db.doc(`${WORLD_ACTIVITY_COLLECTION}/${WORLD_GLOBAL_ID}`).set(
    {
      highlightedCourses: ranked,
      activeCourseCount: snap.size,
      livePulseCount,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}
