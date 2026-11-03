import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
  type FirestoreError,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from "firebase/firestore";
import type { User } from "firebase/auth";
import { getPresenceDisplayName } from "../../identity/authDisplay";
import { getFirebaseFirestore } from "../../firebase/app";
import { DEFAULT_TRAIL_ID, sanitizeTrailId } from "../trailId";
import { isMemberRecentlySeen, TRAIL_PRESENCE_STALE_MS } from "../trailLivePolicy";
import { lastSeenAtToMillis } from "../../firebase/converters";
import {
  TRAIL_LIVE_PUBLICATION_RIDES_SUBCOLLECTION,
  TRAILS_COLLECTION,
} from "./firestoreTrailPaths";
import { resolvePublicationIdFromDoc } from "../../firebase/converters";
import { livePublicationRidesQuery } from "./livePublicationRidesQuery";
import {
  PEER_LIVE_RIDE_COMPLETED_VISIBLE_MS,
  PEER_LIVE_RIDE_FINAL_BURST_MS,
  PEER_LIVE_RIDE_STALE_MS,
} from "../trailLivePolicy";
import { trackUnderlyingReadSubscription } from "../../debug/readSubscriptionMeters";
import { noteListingRefreshRead } from "../../debug/touchActivityMeters";
import { trackVisibilityListener } from "../../debug/visibilityReadMeters";
import {
  noteFsLiveRideUnderlyingDocChanges,
  noteLivePublicationRideWriteAttempt,
  noteLivePublicationRideWriteError,
  noteLivePublicationRideWriteOk,
} from "../../debug/trafficPublishMeters";

// 타입 정의는 도메인 층이 갖는다 — 저장소끼리 타입을 주고받으면 순환이 된다(Phase 5 D1).
import type { TrailLiveRidePhase, TrailLivePublicationRideRow } from "../trailTypes";
export type { TrailLivePublicationRideRow };
export type { TrailLiveRidePhase };


function readPublicationIdFromDoc(data: Record<string, unknown>): string {
  return resolvePublicationIdFromDoc(data) ?? "";
}

function readRidePhase(data: Record<string, unknown>): TrailLiveRidePhase | null {
  const v = data.ridePhase;
  if (v === "live" || v === "paused" || v === "completed") return v;
  return null;
}

function liveRidesCollectionRef(trailId: string) {
  const db = getFirebaseFirestore();
  const rid = sanitizeTrailId(trailId);
  return collection(db, TRAILS_COLLECTION, rid, TRAIL_LIVE_PUBLICATION_RIDES_SUBCOLLECTION);
}

export function subscribeTrailLivePublicationRides(
  trailId: string,
  onChange: (rows: TrailLivePublicationRideRow[]) => void,
  onError?: (e: FirestoreError) => void,
  excludeUid?: string | null,
): Unsubscribe {
  const rid = sanitizeTrailId(trailId);
  return trackVisibilityListener(
    "trailLiveRides",
    trackUnderlyingReadSubscription(
      "trailOnSnapshot",
      onSnapshot(
        livePublicationRidesQuery(liveRidesCollectionRef(rid), excludeUid),
        (snap) => {
          noteFsLiveRideUnderlyingDocChanges(snap.docChanges().length);
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
              receivedAtLocalMs: Date.now(),
              displayName: typeof data.displayName === "string" ? data.displayName : null,
              speedMps,
              ridePhase: readRidePhase(data),
            });
          }
          onChange(rows);
        },
        (err) => onError?.(err),
      ),
    ),
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
  const db = getFirebaseFirestore();
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
  const writeTicket = noteLivePublicationRideWriteAttempt();
  try {
    await setDoc(ref, payload, { merge: true });
    noteLivePublicationRideWriteOk(writeTicket);
  } catch (e) {
    noteLivePublicationRideWriteError(writeTicket);
    throw e;
  }
}

export async function deleteTrailLivePublicationRide(uid: string, trailId: string): Promise<void> {
  const rid = sanitizeTrailId(trailId);
  const db = getFirebaseFirestore();
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
  /*
   * 2026-09-26 (Phase 6-③): 여기서 `deleteTrailMotion()` 도 불렀다 — Trail 저장소가
   * **동행 전송 저장소(RTDB)까지** 지우고 있었다. 두 저장소를 걸쳐 치우는 순서는
   * 조립 지점의 일이지 한쪽 저장소의 일이 아니다. 호출자(`useLiveLocationPublishSession`)가
   * 이 함수 **직후에** 같은 순서로 부른다 — 순서는 바뀌지 않았다.
   */
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
  noteListingRefreshRead();
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

function parseActiveLiveRideTrailIds(docs: readonly QueryDocumentSnapshot[]): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const d of docs) {
    const trailId = d.ref.parent?.parent?.id;
    if (!trailId || trailId === DEFAULT_TRAIL_ID || seen.has(trailId)) continue;
    seen.add(trailId);
    ids.push(trailId);
  }
  return ids;
}

/**
 * 주행 중 Trail 을 찾는 **안전망** 조회 주기(ms). 비용 절감 L2(document/ops/20261103-cost-squeeze/01-audit.md).
 *
 * 왜 실시간 구독이 아닌가 — 이 조회는 Trail id 만 필요한데, 실시간 collectionGroup 구독은
 * 라이더마다 4초 위치 쓰기를 **보는 사람 전원이 매번** 읽는다(보는 사람 × 라이더 × 900회/시간).
 * 새 Trail 은 서버가 갱신하는 `openTrailListings` 실시간 구독으로 바로 나타나므로, 이 안전망은
 * 목록에 아직 없는 Trail 을 늦게라도 줍는 역할만 한다. 60초면 읽기가 최대 80건/분으로 고정된다.
 */
const ACTIVE_LIVE_RIDE_TRAIL_POLL_MS = 60_000;

/** 주기 조회 — Trailhead·월드 맵이 주행 중 Trail 을 찾을 때 사용(구독처럼 해제 함수를 돌려준다) */
export function subscribeTrailIdsWithActiveLiveRides(
  onChange: (trailIds: string[]) => void,
  onError?: (e: FirestoreError) => void,
): Unsubscribe {
  const db = getFirebaseFirestore();
  let stopped = false;
  const poll = async () => {
    // cutoff 를 매번 다시 잡는다 — 실시간 구독 시절에는 구독 시점에 고정돼 범위가 계속 넓어졌다.
    const q = query(
      collectionGroup(db, TRAIL_LIVE_PUBLICATION_RIDES_SUBCOLLECTION),
      where("lastSeenAt", ">", liveRideFreshnessCutoff()),
      orderBy("lastSeenAt", "desc"),
      limit(ACTIVE_LIVE_RIDE_TRAIL_SCAN_LIMIT),
    );
    try {
      const snap = await getDocs(q);
      if (!stopped) onChange(parseActiveLiveRideTrailIds(snap.docs));
    } catch (err) {
      if (!stopped) onError?.(err as FirestoreError);
    }
  };
  void poll();
  const timer = setInterval(() => void poll(), ACTIVE_LIVE_RIDE_TRAIL_POLL_MS);
  return trackVisibilityListener(
    "collectionGroupLiveRides",
    trackUnderlyingReadSubscription("collectionGroup", () => {
      stopped = true;
      clearInterval(timer);
    }),
  );
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
