/**
 * S4-1 — Firestore route 단일 슬롯(single-flight) + latest-wins.
 * motionPublishFlight 와 같은 관용구. motion 파일은 수정하지 않는다.
 *
 * S4-1R ① — DEV 주입점만 추가 (수명주기 계약은 아직 없음).
 */
import type { User } from "firebase/auth";
import type { LiveLocationSnapshot } from "../liveLocationSnapshot";
import { DEFAULT_TRAIL_ID } from "../firestoreTrail";
import { mergeTrailLivePublicationRideSnapshot } from "../firestoreTrailLivePublicationRides";
import { touchTrailInstanceActivity } from "../firestoreTrailInstance";
import {
  beginRouteInFlight,
  endRouteInFlight,
  peerSyncChainLog,
  peekRouteInFlight,
  peekRouteInFlightMax,
} from "./peerSyncChainLog";

export type RouteFlightJob = {
  user: User;
  trailId: string;
  snapshot: LiveLocationSnapshot;
  onWriteStart?: () => void;
  onError?: (e: unknown) => void;
};

declare global {
  interface Window {
    /** DEV — 다음 route 쓰기 1회를 강제 실패 (소모성) */
    __rtwRouteWriteFaultOnce?: number;
    /** DEV — route 쓰기 앞에 강제 지연(ms). in-flight+slot 상태를 만들기. */
    __rtwRouteWriteDelayMs?: number;
    /** DEV — flight 관측 스냅샷 */
    __rtwRouteFlightDebug?: {
      writing: boolean;
      hasSlot: boolean;
      inFlight: number;
      slotDiscardTotal: number;
      routeErrorCount: number;
    };
    /** DEV — onError 경로 호출 기록 */
    __rtwRouteErrorEvents?: Array<{ at: number; message: string }>;
    /** DEV — livePublicationRides 행 존재 여부 */
    __rtwLiveRideExists?: (trailId: string, uid: string) => Promise<boolean>;
    /** DEV — 최근 route 발행 uid */
    __rtwLastRouteUid?: string;
  }
}

let writing = false;
let slot: RouteFlightJob | null = null;
let slotDiscardCount = 0;
let routeErrorCount = 0;

export function peekRouteSlotDiscardCount(): number {
  return slotDiscardCount;
}

function syncRouteFlightDebug(): void {
  if (!import.meta.env.DEV || typeof window === "undefined") return;
  window.__rtwRouteFlightDebug = {
    writing,
    hasSlot: slot != null,
    inFlight: peekRouteInFlight(),
    slotDiscardTotal: slotDiscardCount,
    routeErrorCount,
  };
}

/** DEV — e2e 가 인증된 클라이언트로 행 존재 여부를 확인 */
async function installDevLiveRideProbe(): Promise<void> {
  if (!import.meta.env.DEV || typeof window === "undefined") return;
  if (window.__rtwLiveRideExists) return;
  const { doc, getDoc } = await import("firebase/firestore");
  const { getFirebaseFirestore } = await import("../firebase");
  const { TRAILS_COLLECTION, TRAIL_LIVE_PUBLICATION_RIDES_SUBCOLLECTION } = await import(
    "../firestoreTrailPaths"
  );
  const { sanitizeTrailId } = await import("../firestoreTrail");
  window.__rtwLiveRideExists = async (trailId: string, uid: string) => {
    const snap = await getDoc(
      doc(
        getFirebaseFirestore(),
        TRAILS_COLLECTION,
        sanitizeTrailId(trailId),
        TRAIL_LIVE_PUBLICATION_RIDES_SUBCOLLECTION,
        uid,
      ),
    );
    return snap.exists();
  };
}

void installDevLiveRideProbe();

function readDevDelayMs(): number {
  if (!import.meta.env.DEV || typeof window === "undefined") return 0;
  const n = Number(window.__rtwRouteWriteDelayMs);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function consumeDevFaultOnce(): boolean {
  if (!import.meta.env.DEV || typeof window === "undefined") return false;
  const n = Number(window.__rtwRouteWriteFaultOnce);
  if (!(Number.isFinite(n) && n > 0)) return false;
  window.__rtwRouteWriteFaultOnce = n - 1;
  return true;
}

export function enqueueRoutePublish(job: RouteFlightJob): { accepted: "write" | "slot"; overwrite: boolean } {
  if (import.meta.env.DEV && typeof window !== "undefined") {
    window.__rtwLastRouteUid = job.user.uid;
  }
  if (writing) {
    const overwrite = slot != null;
    if (overwrite) {
      slotDiscardCount += 1;
    }
    slot = job;
    syncRouteFlightDebug();
    return { accepted: "slot", overwrite };
  }
  writing = true;
  syncRouteFlightDebug();
  void runRouteJob(job);
  return { accepted: "write", overwrite: false };
}

async function runRouteJob(job: RouteFlightJob): Promise<void> {
  const { user, snapshot } = job;
  const fsWriteStartAt = Date.now();
  beginRouteInFlight();
  syncRouteFlightDebug();
  try {
    const delayMs = readDevDelayMs();
    if (delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
    if (consumeDevFaultOnce()) {
      throw new Error("rtw-route-write-fault-once");
    }
    job.onWriteStart?.();
    await mergeTrailLivePublicationRideSnapshot(user, snapshot.trailId, {
      publicationId: snapshot.publicationId!,
      progressRatio: snapshot.progressRatio,
      distMeters: snapshot.distMetersAlongRoute,
      speedMps: snapshot.speedMps,
      ridePhase: snapshot.routeRidePhase,
    });
    if (import.meta.env.DEV) {
      const fsWriteDoneAt = Date.now();
      peerSyncChainLog(9, null, {
        fsWriteStartAt,
        fsWriteDoneAt,
        fsWriteRttMs: fsWriteDoneAt - fsWriteStartAt,
        ok: 1,
        inFlight: peekRouteInFlight(),
        inFlightMax: peekRouteInFlightMax(),
        uid: user.uid.slice(0, 6),
        trailId: snapshot.trailId,
        distM: snapshot.distMetersAlongRoute,
      });
    }
    if (snapshot.trailId !== DEFAULT_TRAIL_ID) {
      const touchStartAt = Date.now();
      void touchTrailInstanceActivity(snapshot.trailId).then(
        () => {
          if (!import.meta.env.DEV) return;
          const touchDoneAt = Date.now();
          peerSyncChainLog(11, null, {
            fsWriteStartAt: touchStartAt,
            fsWriteDoneAt: touchDoneAt,
            fsWriteRttMs: touchDoneAt - touchStartAt,
            ok: 1,
            uid: user.uid.slice(0, 6),
          });
        },
        () => {
          if (!import.meta.env.DEV) return;
          const touchDoneAt = Date.now();
          peerSyncChainLog(11, null, {
            fsWriteStartAt: touchStartAt,
            fsWriteDoneAt: touchDoneAt,
            fsWriteRttMs: touchDoneAt - touchStartAt,
            ok: 0,
            uid: user.uid.slice(0, 6),
          });
        },
      );
    }
  } catch (e) {
    if (import.meta.env.DEV) {
      const fsWriteDoneAt = Date.now();
      peerSyncChainLog(9, null, {
        fsWriteStartAt,
        fsWriteDoneAt,
        fsWriteRttMs: fsWriteDoneAt - fsWriteStartAt,
        ok: 0,
        inFlight: peekRouteInFlight(),
        inFlightMax: peekRouteInFlightMax(),
        uid: user.uid.slice(0, 6),
        trailId: snapshot.trailId,
        distM: snapshot.distMetersAlongRoute,
      });
      routeErrorCount += 1;
      const message = e instanceof Error ? e.message : String(e);
      if (typeof window !== "undefined") {
        const prev = window.__rtwRouteErrorEvents ?? [];
        prev.push({ at: Date.now(), message });
        window.__rtwRouteErrorEvents = prev;
      }
      console.debug("[LiveLocationPublish] routeError", message);
    }
    job.onError?.(e);
  } finally {
    endRouteInFlight();
    const next = slot;
    slot = null;
    if (next) {
      syncRouteFlightDebug();
      void runRouteJob(next);
    } else {
      writing = false;
      syncRouteFlightDebug();
    }
  }
}
