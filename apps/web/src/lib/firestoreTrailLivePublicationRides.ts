import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
  type FirestoreError,
  type Unsubscribe,
} from "firebase/firestore";
import type { User } from "firebase/auth";
import { getPresenceDisplayName } from "./authDisplay";
import { getFirebaseApp } from "./firebase";
import {
  DEFAULT_TRAIL_ID,
  isMemberRecentlySeen,
  lastSeenAtToMillis,
  sanitizeTrailId,
  TRAIL_PRESENCE_STALE_MS,
} from "./firestoreTrail";
import {
  TRAIL_LIVE_PUBLICATION_RIDES_SUBCOLLECTION,
  TRAILS_COLLECTION,
} from "./firestoreTrailPaths";
import { resolvePublicationIdFromDoc } from "./resolvePublicationIdFromDoc";
import {
  PEER_LIVE_RIDE_COMPLETED_VISIBLE_MS,
  PEER_LIVE_RIDE_FINAL_BURST_MS,
  PEER_LIVE_RIDE_STALE_MS,
} from "./rideSyncPolicy";

/** publication 진행률만 주기적으로 올려 부담을 줄임 (좌표·geometry 미전송). */
export const TRAIL_LIVE_PUBLICATION_RIDE_WRITE_INTERVAL_MS = 4_000;

export type TrailLiveRidePhase = "live" | "paused" | "completed";

export type TrailLivePublicationRideRow = {
  uid: string;
  /** 출판 ID — 레거시 문서의 `courseId` 와 동일 값 */
  publicationId: string;
  progressRatio: number;
  /** geometry 위 주행 거리(m) — progressRatio 변환 오차 제거 */
  distMeters: number | null;
  lastSeenAtMs: number | null;
  displayName: string | null;
  /** m/s — 송신 측 속도(없으면 수신 측 delta 추정) */
  speedMps: number | null;
  ridePhase: TrailLiveRidePhase | null;
};

function readPublicationIdFromDoc(data: Record<string, unknown>): string {
  return resolvePublicationIdFromDoc(data) ?? "";
}

function readRidePhase(data: Record<string, unknown>): TrailLiveRidePhase | null {
  const v = data.ridePhase;
  if (v === "live" || v === "paused" || v === "completed") return v;
  return null;
}

function liveRidesCollectionRef(trailId: string) {
  const db = getFirestore(getFirebaseApp());
  const rid = sanitizeTrailId(trailId);
  return collection(db, TRAILS_COLLECTION, rid, TRAIL_LIVE_PUBLICATION_RIDES_SUBCOLLECTION);
}

export function subscribeTrailLivePublicationRides(
  trailId: string,
  onChange: (rows: TrailLivePublicationRideRow[]) => void,
  onError?: (e: FirestoreError) => void,
): Unsubscribe {
  const rid = sanitizeTrailId(trailId);
  return onSnapshot(
    liveRidesCollectionRef(rid),
    (snap) => {
      const rows: TrailLivePublicationRideRow[] = [];
      for (const d of snap.docs) {
        const data = d.data() as Record<string, unknown>;
        const publicationId = readPublicationIdFromDoc(data);
        const pr = data.progressRatio;
        const progressRatio =
          typeof pr === "number" && Number.isFinite(pr) ? Math.max(0, Math.min(1, pr)) : Number.NaN;
        const dm = data.distMeters;
        const distMeters =
          typeof dm === "number" && Number.isFinite(dm) ? Math.max(0, dm) : null;
        const sm = data.speedMps;
        const speedMps =
          typeof sm === "number" && Number.isFinite(sm) ? Math.max(0, sm) : null;
        if (!publicationId || Number.isNaN(progressRatio)) continue;
        rows.push({
          uid: d.id,
          publicationId,
          progressRatio,
          distMeters,
          lastSeenAtMs: lastSeenAtToMillis(data.lastSeenAt),
          displayName: typeof data.displayName === "string" ? data.displayName : null,
          speedMps,
          ridePhase: readRidePhase(data),
        });
      }
      onChange(rows);
    },
    (err) => onError?.(err),
  );
}

export type TrailLivePublicationRideSnapshotInput = {
  publicationId: string;
  progressRatio: number;
  distMeters?: number;
  speedMps?: number;
  ridePhase?: TrailLiveRidePhase;
};

export async function mergeTrailLivePublicationRideSnapshot(
  user: User,
  trailId: string,
  input: TrailLivePublicationRideSnapshotInput,
): Promise<void> {
  const rid = sanitizeTrailId(trailId);
  const db = getFirestore(getFirebaseApp());
  const ref = doc(db, TRAILS_COLLECTION, rid, TRAIL_LIVE_PUBLICATION_RIDES_SUBCOLLECTION, user.uid);
  const payload: Record<string, unknown> = {
    publicationId: input.publicationId.trim(),
    progressRatio: Math.max(0, Math.min(1, input.progressRatio)),
    displayName: getPresenceDisplayName(user),
    lastSeenAt: serverTimestamp(),
    ridePhase: input.ridePhase ?? "live",
    speedMps:
      typeof input.speedMps === "number" && Number.isFinite(input.speedMps)
        ? Math.round(Math.max(0, input.speedMps) * 100) / 100
        : 0,
  };
  if (typeof input.distMeters === "number" && Number.isFinite(input.distMeters)) {
    payload.distMeters = Math.round(Math.max(0, input.distMeters) * 10) / 10;
  }
  await setDoc(ref, payload, { merge: true });
}

export async function deleteTrailLivePublicationRide(uid: string, trailId: string): Promise<void> {
  const rid = sanitizeTrailId(trailId);
  const db = getFirestore(getFirebaseApp());
  await deleteDoc(doc(db, TRAILS_COLLECTION, rid, TRAIL_LIVE_PUBLICATION_RIDES_SUBCOLLECTION, uid));
}

/** 완주 final burst — completed 기록 후 잠시 유지하고 삭제 */
export async function finalizeAndDeleteTrailLivePublicationRide(
  user: User,
  trailId: string,
  input: Omit<TrailLivePublicationRideSnapshotInput, "ridePhase" | "speedMps">,
): Promise<void> {
  try {
    await mergeTrailLivePublicationRideSnapshot(user, trailId, {
      ...input,
      speedMps: 0,
      ridePhase: "completed",
    });
    await new Promise((r) => window.setTimeout(r, PEER_LIVE_RIDE_FINAL_BURST_MS));
  } catch {
    /* noop */
  }
  await deleteTrailLivePublicationRide(user.uid, trailId).catch(() => {});
}

function liveRideFreshnessCutoff(): Timestamp {
  return Timestamp.fromMillis(Date.now() - TRAIL_PRESENCE_STALE_MS);
}

const LIVE_RIDES_COUNT_SCAN_LIMIT = 48;

/** Trail 에서 최근 활동(`lastSeenAt`) 있는 `livePublicationRides` — aggregation 없이 소량 getDocs */
export async function countTrailLiveRidersFresh(trailId: string): Promise<number> {
  const coll = liveRidesCollectionRef(trailId);
  const cutoffMs = Date.now() - TRAIL_PRESENCE_STALE_MS;
  const snap = await getDocs(query(coll, limit(LIVE_RIDES_COUNT_SCAN_LIMIT)));
  let n = 0;
  for (const d of snap.docs) {
    const ms = lastSeenAtToMillis((d.data() as Record<string, unknown>).lastSeenAt);
    if (ms != null && ms >= cutoffMs) n += 1;
  }
  return n;
}

/** Trail 에서 `livePublicationRides` 문서 수(레거시·stale 포함) */
export async function countTrailLiveRiders(trailId: string): Promise<number> {
  const snap = await getDocs(query(liveRidesCollectionRef(trailId), limit(LIVE_RIDES_COUNT_SCAN_LIMIT)));
  return snap.size;
}

const ACTIVE_LIVE_RIDE_TRAIL_SCAN_LIMIT = 80;

/**
 * 지금 주행 중인 Trail ID — `livePublicationRides` collection group 기준(최근 lastSeenAt).
 */
export async function fetchTrailIdsWithActiveLiveRides(): Promise<string[]> {
  const db = getFirestore(getFirebaseApp());
  const q = query(
    collectionGroup(db, TRAIL_LIVE_PUBLICATION_RIDES_SUBCOLLECTION),
    where("lastSeenAt", ">", liveRideFreshnessCutoff()),
    orderBy("lastSeenAt", "desc"),
    limit(ACTIVE_LIVE_RIDE_TRAIL_SCAN_LIMIT),
  );
  const snap = await getDocs(q);
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const d of snap.docs) {
    const trailId = d.ref.parent.parent?.id;
    if (!trailId || trailId === DEFAULT_TRAIL_ID || seen.has(trailId)) continue;
    seen.add(trailId);
    ids.push(trailId);
  }
  return ids;
}

/** 멤버·카운트용 — TRAIL_PRESENCE_STALE_MS(240s) */
export function isTrailLivePublicationRideRowFresh(row: TrailLivePublicationRideRow): boolean {
  return isMemberRecentlySeen(row.lastSeenAtMs);
}

/** 맵 peer 표시용 — live 4s, completed 15s */
export function isTrailLivePublicationRideRowPeerVisible(
  row: TrailLivePublicationRideRow,
  nowMs = Date.now(),
): boolean {
  const ms = row.lastSeenAtMs;
  if (ms == null) {
    return row.ridePhase !== "completed";
  }
  if (row.ridePhase === "completed") {
    return nowMs - ms <= PEER_LIVE_RIDE_COMPLETED_VISIBLE_MS;
  }
  return nowMs - ms <= PEER_LIVE_RIDE_STALE_MS;
}
