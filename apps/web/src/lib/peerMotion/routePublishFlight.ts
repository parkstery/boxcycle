/**
 * S4-1 / S4-1R — Firestore route single-flight + latest-wins + epoch 수명주기.
 * motionPublishFlight 와 같은 관용구 — 공통부는 publishFlightCore.
 */
import type { User } from "firebase/auth";
import type { LiveLocationSnapshot } from "./types";
import { DEFAULT_TRAIL_ID } from "../trail/trailId";
import { installDevLiveRideProbe } from "../debug/installLiveRideExistsDebug";
import type { TrailLiveRideSink } from "./trailLiveRidePort";
import { ROUTE_FLIGHT_DRAIN_TIMEOUT_MS } from "./peerSyncPolicy";
import { createPublishFlightCore, type DeferredCleanup } from "./publishFlightCore";
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
  /**
   * Trail 라이브 주행 기록 구현(D6). **필수**다 — 전역 등록으로 두면 배선을 빠뜨렸을 때
   * 아무 에러 없이 동행 기록만 멈춘다. 필수 필드면 `tsc` 가 조립을 강제한다.
   */
  sink: TrailLiveRideSink;
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
    __rtwLastRouteUid?: string;
  }
}

let writing = false;
let slot: RouteFlightJob | null = null;
let slotDiscardCount = 0;
let routeErrorCount = 0;

/** S4-1R2 — 2 s 배수 시간 초과 뒤에도 「늦은 쓰기가 실제로 끝난 시점」에 실행할 정리 */
type DeferredRouteCleanup = DeferredCleanup;

const core = createPublishFlightCore({ syncDebug: () => syncRouteFlightDebug() });

export { ROUTE_FLIGHT_DRAIN_TIMEOUT_MS };

/** 새 발행 세션 epoch. user/trail/publication 전환 시 호출. */
export function nextRoutePublishEpoch(sessionKey = ""): number {
  const epoch = core.nextEpoch(sessionKey);
  if (import.meta.env.DEV && typeof window !== "undefined") {
    const prev = window.__rtwRouteEpochStarts ?? [];
    prev.push({ epoch, sessionKey, at: Date.now() });
    window.__rtwRouteEpochStarts = prev;
  }
  syncRouteFlightDebug();
  return epoch;
}

/** 같은 세션 키(uid|trailId)의 세션이 지금 살아 있는가 — 살아 있으면 옛 정리는 건너뛴다. */
export function isRouteSessionLive(sessionKey: string): boolean {
  return core.isSessionLive(sessionKey);
}

/**
 * S4-1R2 — 배수 시간 초과 뒤의 안전 삭제.
 * 시간에 매달지 않고 **늦은 쓰기가 실제로 끝난 시점**에 실행하며,
 * 같은 세션 키의 새 세션이 살아 있으면 실행하지 않는다.
 */
export function requestRouteRowCleanup(req: DeferredRouteCleanup): void {
  core.requestCleanup(req, !writing);
}

export function cancelRoutePublish(epoch: number): { hadInFlight: boolean; droppedSlot: boolean } {
  core.cancelEpoch(epoch);
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
  return core.awaitSettled(!writing, timeoutMs);
}

function isEpochLive(epoch: number): boolean {
  return core.isEpochLive(epoch);
}

function discardEpochJob(reason: string, job: RouteFlightJob): void {
  core.discardEpochJob(reason, job);
}

function syncRouteFlightDebug(): void {
  if (!import.meta.env.DEV || typeof window === "undefined") return;
  window.__rtwRouteFlightDebug = {
    writing,
    hasSlot: slot != null,
    inFlight: peekRouteInFlight(),
    slotDiscardTotal: slotDiscardCount,
    epochDiscardTotal: core.peekEpochDiscardCount(),
    currentEpoch: core.peekEpoch(),
    routeErrorCount,
    deferredPending: core.deferredStats().pending,
    deferredRunTotal: core.deferredStats().run,
    deferredSkipTotal: core.deferredStats().skip,
  };
}



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
    await job.sink.publish(user, snapshot.trailId, {
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
      void job.sink.touchActivity(snapshot.trailId).then(
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
      core.notifySettled();
      // S4-1R2 — 늦은 쓰기가 「실제로」 끝난 지금이 안전 삭제 시점이다
      core.drainDeferredCleanups();
    }
  }
}

// DEV 진단 프로브(계측 말단). e2e `peer-sync-s41r` 가 이 전역을 기다린다.
void installDevLiveRideProbe();
