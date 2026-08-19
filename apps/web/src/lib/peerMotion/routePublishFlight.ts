/**
 * S4-1 / S4-1R — Firestore route single-flight + latest-wins + epoch 수명주기.
 * motionPublishFlight 와 같은 관용구. motion 파일은 수정하지 않는다.
 */
import type { User } from "firebase/auth";
import type { LiveLocationSnapshot } from "../liveLocationSnapshot";
import { DEFAULT_TRAIL_ID } from "../firestoreTrail";
import { mergeTrailLivePublicationRideSnapshot } from "../firestoreTrailLivePublicationRides";
import { touchTrailInstanceActivity } from "../firestoreTrailInstance";
import { ROUTE_FLIGHT_DRAIN_TIMEOUT_MS } from "../rideSyncPolicy";
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
  epoch: number;
  onWriteStart?: () => void;
  onError?: (e: unknown) => void;
};

declare global {
  interface Window {
    __rtwRouteWriteFaultOnce?: number;
    __rtwRouteWriteDelayMs?: number;
    __rtwRouteFlightDebug?: {
      writing: boolean;
      hasSlot: boolean;
      inFlight: number;
      slotDiscardTotal: number;
      epochDiscardTotal: number;
      currentEpoch: number;
      routeErrorCount: number;
      deferredPending: number;
      deferredRunTotal: number;
      deferredSkipTotal: number;
    };
    __rtwRouteEpochStarts?: Array<{ epoch: number; sessionKey: string; at: number }>;
    __rtwRouteErrorEvents?: Array<{ at: number; message: string }>;
    __rtwLiveRideExists?: (trailId: string, uid: string) => Promise<boolean>;
    __rtwLastRouteUid?: string;
  }
}

let writing = false;
let slot: RouteFlightJob | null = null;
let slotDiscardCount = 0;
let epochDiscardCount = 0;
let routeErrorCount = 0;
let currentEpoch = 0;
const cancelledEpochs = new Set<number>();
const settleWaiters = new Set<() => void>();

/** S4-1R2 — epoch → 세션 키(uid|trailId). 같은 키의 새 세션이 살아 있으면 옛 정리를 하지 않는다. */
const sessionKeyByEpoch = new Map<number, string>();

/** S4-1R2 — 2 s 배수 시간 초과 뒤에도 「늦은 쓰기가 실제로 끝난 시점」에 실행할 정리 */
type DeferredRouteCleanup = { epoch: number; sessionKey: string; run: () => Promise<void> };
const deferredCleanups: DeferredRouteCleanup[] = [];
let deferredCleanupRunCount = 0;
let deferredCleanupSkipCount = 0;

export { ROUTE_FLIGHT_DRAIN_TIMEOUT_MS };

export function peekRouteSlotDiscardCount(): number {
  return slotDiscardCount;
}

export function peekRouteEpochDiscardCount(): number {
  return epochDiscardCount;
}

export function peekRoutePublishEpoch(): number {
  return currentEpoch;
}

/** 새 발행 세션 epoch. user/trail/publication 전환 시 호출. */
export function nextRoutePublishEpoch(sessionKey = ""): number {
  currentEpoch += 1;
  sessionKeyByEpoch.set(currentEpoch, sessionKey);
  if (import.meta.env.DEV && typeof window !== "undefined") {
    const prev = window.__rtwRouteEpochStarts ?? [];
    prev.push({ epoch: currentEpoch, sessionKey, at: Date.now() });
    window.__rtwRouteEpochStarts = prev;
  }
  syncRouteFlightDebug();
  return currentEpoch;
}

/** 같은 세션 키(uid|trailId)의 세션이 지금 살아 있는가 — 살아 있으면 옛 정리는 건너뛴다. */
export function isRouteSessionLive(sessionKey: string): boolean {
  if (!sessionKey) return false;
  if (cancelledEpochs.has(currentEpoch)) return false;
  return sessionKeyByEpoch.get(currentEpoch) === sessionKey;
}

export function peekRouteDeferredCleanupCounts(): { run: number; skipped: number; pending: number } {
  return { run: deferredCleanupRunCount, skipped: deferredCleanupSkipCount, pending: deferredCleanups.length };
}

/**
 * S4-1R2 — 배수 시간 초과 뒤의 안전 삭제.
 * 시간에 매달지 않고 **늦은 쓰기가 실제로 끝난 시점**에 실행하며,
 * 같은 세션 키의 새 세션이 살아 있으면 실행하지 않는다.
 */
export function requestRouteRowCleanup(req: DeferredRouteCleanup): void {
  if (!writing) {
    void runDeferredCleanup(req);
    return;
  }
  deferredCleanups.push(req);
  syncRouteFlightDebug();
}

async function runDeferredCleanup(req: DeferredRouteCleanup): Promise<void> {
  if (isRouteSessionLive(req.sessionKey)) {
    deferredCleanupSkipCount += 1;
    emitCleanupLog("skip-live-session", req);
    syncRouteFlightDebug();
    return;
  }
  await req.run().catch(() => {});
  deferredCleanupRunCount += 1;
  emitCleanupLog("run", req);
  syncRouteFlightDebug();
}

function emitCleanupLog(reason: string, req: DeferredRouteCleanup): void {
  if (!import.meta.env.DEV) return;
  peerSyncChainLog(9, null, {
    ok: 1,
    deferredCleanup: 1,
    reason,
    epoch: req.epoch,
    sessionKey: req.sessionKey,
    deferredRunTotal: deferredCleanupRunCount,
    deferredSkipTotal: deferredCleanupSkipCount,
  });
}

function drainDeferredCleanups(): void {
  if (deferredCleanups.length === 0) return;
  const pending = deferredCleanups.splice(0, deferredCleanups.length);
  for (const req of pending) void runDeferredCleanup(req);
}

export function cancelRoutePublish(epoch: number): { hadInFlight: boolean; droppedSlot: boolean } {
  cancelledEpochs.add(epoch);
  let droppedSlot = false;
  if (slot && slot.epoch === epoch) {
    slot = null;
    droppedSlot = true;
    slotDiscardCount += 1;
  }
  syncRouteFlightDebug();
  return { hadInFlight: writing, droppedSlot };
}

export function awaitRouteFlightSettled(timeoutMs = ROUTE_FLIGHT_DRAIN_TIMEOUT_MS): Promise<boolean> {
  if (!writing) return Promise.resolve(true);
  return new Promise((resolve) => {
    let done = false;
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      settleWaiters.delete(onSettle);
      clearTimeout(timer);
      resolve(ok);
    };
    const onSettle = () => finish(true);
    const timer = setTimeout(() => finish(false), timeoutMs);
    settleWaiters.add(onSettle);
  });
}

function notifySettled(): void {
  for (const w of [...settleWaiters]) w();
  settleWaiters.clear();
}

function isEpochLive(epoch: number): boolean {
  return epoch === currentEpoch && !cancelledEpochs.has(epoch);
}

function discardEpochJob(reason: string, job: RouteFlightJob): void {
  epochDiscardCount += 1;
  if (import.meta.env.DEV) {
    peerSyncChainLog(9, null, {
      ok: 0,
      epochDiscard: 1,
      epochDiscardTotal: epochDiscardCount,
      epoch: job.epoch,
      reason,
      uid: job.user.uid.slice(0, 6),
      trailId: job.trailId,
    });
  }
  syncRouteFlightDebug();
}

function syncRouteFlightDebug(): void {
  if (!import.meta.env.DEV || typeof window === "undefined") return;
  window.__rtwRouteFlightDebug = {
    writing,
    hasSlot: slot != null,
    inFlight: peekRouteInFlight(),
    slotDiscardTotal: slotDiscardCount,
    epochDiscardTotal: epochDiscardCount,
    currentEpoch,
    routeErrorCount,
    deferredPending: deferredCleanups.length,
    deferredRunTotal: deferredCleanupRunCount,
    deferredSkipTotal: deferredCleanupSkipCount,
  };
}

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

export function enqueueRoutePublish(job: RouteFlightJob): { accepted: "write" | "slot" | "reject"; overwrite: boolean } {
  if (import.meta.env.DEV && typeof window !== "undefined") {
    window.__rtwLastRouteUid = job.user.uid;
  }
  if (!isEpochLive(job.epoch)) {
    discardEpochJob("enqueue-stale", job);
    return { accepted: "reject", overwrite: false };
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
    if (!isEpochLive(job.epoch)) {
      discardEpochJob("before-write", job);
      return;
    }
    const delayMs = readDevDelayMs();
    if (delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
    if (!isEpochLive(job.epoch)) {
      discardEpochJob("after-delay", job);
      return;
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
        epoch: job.epoch,
        uid: user.uid.slice(0, 6),
        trailId: snapshot.trailId,
        distM: snapshot.distMetersAlongRoute,
      });
    }
    if (snapshot.trailId !== DEFAULT_TRAIL_ID) {
      const touchStartAt = Date.now();
      void touchTrailInstanceActivity(snapshot.trailId, "routePublish").then(
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
        epoch: job.epoch,
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
    if (next && isEpochLive(next.epoch)) {
      syncRouteFlightDebug();
      void runRouteJob(next);
    } else {
      if (next && !isEpochLive(next.epoch)) {
        discardEpochJob("slot-stale", next);
      }
      writing = false;
      syncRouteFlightDebug();
      notifySettled();
      // S4-1R2 — 늦은 쓰기가 「실제로」 끝난 지금이 안전 삭제 시점이다
      drainDeferredCleanups();
    }
  }
}
