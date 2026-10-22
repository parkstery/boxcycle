/**
 * S3A / S4-M1R — RTDB motion 단일 슬롯(single-flight) + latest-wins + epoch 수명주기.
 * 배열 큐를 쓰지 않는다. 진행 중 쓰기가 있으면 대기 슬롯 1칸만 최신 스냅샷으로 덮는다.
 * routePublishFlight 와 같은 계약(epoch·배수·소유권·지연삭제·오류전달) — 공통부는 publishFlightCore.
 */
import type { User } from "firebase/auth";
import type { LiveLocationSnapshot } from "./types";
import {
  mergeTrailMotionSnapshot,
  snapshotToRtdbTrailMotionSnapshot,
} from "./repo/rtdbTrailMotion";
import { MOTION_FLIGHT_DRAIN_TIMEOUT_MS, MOTION_MAX_IN_FLIGHT } from "./peerSyncPolicy";
import { installDevMotionProbe } from "../debug/installMotionExistsDebug";
import { nextPeerSyncChainSeq, peerSyncChainLog } from "./peerSyncChainLog";
import { createPublishFlightCore, type DeferredCleanup } from "./publishFlightCore";

export type MotionFlightJob = {
  user: User;
  trailId: string;
  snapshot: LiveLocationSnapshot;
  epoch: number;
  onWriteStart?: () => void;
  onError?: (e: unknown) => void;
};

declare global {
  interface Window {
    __rtwMotionWriteFaultOnce?: number;
    __rtwMotionWriteDelayMs?: number;
    __rtwMotionFlightDebug?: {
      writing: boolean;
      /** 지금 날아가고 있는 쓰기 수 — 겹쳐 보내기가 실제로 도는지 보는 값 */
      inFlight: number;
      inFlightMax: number;
      hasSlot: boolean;
      slotDiscardTotal: number;
      epochDiscardTotal: number;
      currentEpoch: number;
      motionErrorCount: number;
      deferredPending: number;
      deferredRunTotal: number;
      deferredSkipTotal: number;
      w2?: { lateWriteDoneAt: number; deleteDoneAt: number };
    };
    __rtwMotionEpochStarts?: Array<{ epoch: number; sessionKey: string; at: number }>;
    __rtwMotionErrorEvents?: Array<{ at: number; message: string }>;
    __rtwLastMotionUid?: string;
  }
}

/** 지금 서버로 날아가고 있는 쓰기 수. 종전의 `writing: boolean` 을 대체한다. */
let inFlight = 0;
let slot: MotionFlightJob | null = null;
let slotDiscardCount = 0;
let motionErrorCount = 0;

type DeferredMotionCleanup = DeferredCleanup;
let lastLateWriteDoneAt = 0;
let lastDeleteDoneAt = 0;

const core = createPublishFlightCore({
  syncDebug: () => syncMotionFlightDebug(),
  onDeferredCleanupDone: () => {
    lastDeleteDoneAt = Date.now();
  },
});

export { MOTION_FLIGHT_DRAIN_TIMEOUT_MS };

export function peekMotionSlotDiscardCount(): number {
  return slotDiscardCount;
}

export function peekMotionPublishEpoch(): number {
  return core.peekEpoch();
}

export function nextMotionPublishEpoch(sessionKey = ""): number {
  const epoch = core.nextEpoch(sessionKey);
  if (import.meta.env.DEV && typeof window !== "undefined") {
    const prev = window.__rtwMotionEpochStarts ?? [];
    prev.push({ epoch, sessionKey, at: Date.now() });
    window.__rtwMotionEpochStarts = prev;
  }
  syncMotionFlightDebug();
  return epoch;
}

export function isMotionSessionLive(sessionKey: string): boolean {
  return core.isSessionLive(sessionKey);
}

export function requestMotionNodeCleanup(req: DeferredMotionCleanup): void {
  core.requestCleanup(req, inFlight === 0);
}

export function cancelMotionPublish(epoch: number): { hadInFlight: boolean; droppedSlot: boolean } {
  core.cancelEpoch(epoch);
  let droppedSlot = false;
  if (slot && slot.epoch === epoch) {
    slot = null;
    droppedSlot = true;
    slotDiscardCount += 1;
  }
  syncMotionFlightDebug();
  return { hadInFlight: inFlight > 0, droppedSlot };
}

export function awaitMotionFlightSettled(timeoutMs = MOTION_FLIGHT_DRAIN_TIMEOUT_MS): Promise<boolean> {
  return core.awaitSettled(inFlight === 0, timeoutMs);
}

function isEpochLive(epoch: number): boolean {
  return core.isEpochLive(epoch);
}

function discardEpochJob(reason: string, job: MotionFlightJob): void {
  core.discardEpochJob(reason, job);
}

function syncMotionFlightDebug(): void {
  if (!import.meta.env.DEV || typeof window === "undefined") return;
  window.__rtwMotionFlightDebug = {
    writing: inFlight > 0,
    inFlight,
    inFlightMax: MOTION_MAX_IN_FLIGHT,
    hasSlot: slot != null,
    slotDiscardTotal: slotDiscardCount,
    epochDiscardTotal: core.peekEpochDiscardCount(),
    currentEpoch: core.peekEpoch(),
    motionErrorCount,
    deferredPending: core.deferredStats().pending,
    deferredRunTotal: core.deferredStats().run,
    deferredSkipTotal: core.deferredStats().skip,
    ...(lastLateWriteDoneAt > 0 && lastDeleteDoneAt > 0
      ? { w2: { lateWriteDoneAt: lastLateWriteDoneAt, deleteDoneAt: lastDeleteDoneAt } }
      : {}),
  };
}

/* DEV 프로브는 계측 말단(`debug`)이 갖는다 — Phase 6-③B. */
void installDevMotionProbe();

function readDevDelayMs(): number {
  if (!import.meta.env.DEV || typeof window === "undefined") return 0;
  const n = Number(window.__rtwMotionWriteDelayMs);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function enqueueMotionPublish(
  job: MotionFlightJob,
): { accepted: "write" | "slot" | "reject"; overwrite: boolean } {
  if (import.meta.env.DEV && typeof window !== "undefined") {
    window.__rtwLastMotionUid = job.user.uid;
  }
  if (!isEpochLive(job.epoch)) {
    discardEpochJob("enqueue-stale", job);
    return { accepted: "reject", overwrite: false };
  }
  if (inFlight >= MOTION_MAX_IN_FLIGHT) {
    const overwrite = slot != null;
    if (overwrite) {
      slotDiscardCount += 1;
      if (import.meta.env.DEV) {
        peerSyncChainLog(2, null, {
          slotDiscard: 1,
          slotDiscardTotal: slotDiscardCount,
          uid: job.user.uid.slice(0, 6),
        });
      }
    }
    slot = job;
    syncMotionFlightDebug();
    return { accepted: "slot", overwrite };
  }
  inFlight += 1;
  syncMotionFlightDebug();
  void runMotionJob(job);
  return { accepted: "write", overwrite: false };
}

async function runMotionJob(job: MotionFlightJob): Promise<void> {
  const delayMs = readDevDelayMs();
  try {
    if (!isEpochLive(job.epoch)) {
      discardEpochJob("before-write", job);
      return;
    }
    let seq: number | undefined;
    let snapshotCapturedAt: number | undefined;
    if (import.meta.env.DEV) {
      seq = nextPeerSyncChainSeq();
      const cap = job.snapshot.diagCapture;
      snapshotCapturedAt = cap?.snapshotCapturedAt;
      peerSyncChainLog(1, seq, {
        capturedAt: cap?.snapshotCapturedAt ?? null,
        authDist: cap?.authDistAtCapture ?? null,
        snapshotDist: cap?.snapshotDistAtCapture ?? null,
        appliedKmh: cap?.appliedKmh ?? null,
        targetKmh: cap?.targetKmh ?? null,
        uid: job.user.uid.slice(0, 6),
      });
      peerSyncChainLog(2, seq, {
        capturedAt: cap?.snapshotCapturedAt ?? null,
        dist: cap?.snapshotDistAtCapture ?? job.snapshot.distMetersAlongRoute,
        authDist: cap?.authDistAtCapture ?? null,
        routeReady: job.snapshot.routeReady,
        routeLen: cap?.routeLen ?? null,
        geoLen: cap?.geoLen ?? null,
        fsAhead: 0,
        motionFirst: 1,
        slotDiscardTotal: slotDiscardCount,
        epoch: job.epoch,
        uid: job.user.uid.slice(0, 6),
      });
    }
    if (delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
    if (!isEpochLive(job.epoch)) {
      discardEpochJob("after-delay", job);
      return;
    }
    job.onWriteStart?.();
    await mergeTrailMotionSnapshot(
      job.user,
      job.trailId,
      snapshotToRtdbTrailMotionSnapshot(job.snapshot),
      { seq, snapshotCapturedAt, epoch: job.epoch },
    );
  } catch (e) {
    motionErrorCount += 1;
    if (import.meta.env.DEV) {
      const message = e instanceof Error ? e.message : String(e);
      if (typeof window !== "undefined") {
        const prev = window.__rtwMotionErrorEvents ?? [];
        prev.push({ at: Date.now(), message });
        window.__rtwMotionErrorEvents = prev;
      }
      console.debug("[LiveLocationPublish] motionError", message);
    }
    job.onError?.(e);
  } finally {
    if (delayMs > 0) {
      lastLateWriteDoneAt = Date.now();
    }
    inFlight -= 1;
    // 계기를 **줄이자마자** 갱신한다. 아래 정리 분기가 이 값을 보고 판단하고, 시험·디버그도
    // 이 값을 읽는다. 뒤에서 한 번에 갱신하면 그 사이 읽는 쪽이 **낡은 값**을 본다.
    syncMotionFlightDebug();
    const next = slot;
    slot = null;
    // 취소된 epoch 의 늦은 쓰기가 **전부** 끝난 지금이 지연 삭제(또는 skip-live-session) 시점이다.
    // 새 세션 job 이 슬롯에 있어도 먼저 처리해야 M4 가드가 산다.
    //
    // ⚠️ `inFlight === 0` 이 꼭 필요하다 (2026-09-27, s4m1 M6 이 잡았다). 겹쳐 보내기 전에는
    // 내가 끝나면 날아가는 것이 없었으므로 이 조건이 저절로 참이었다. 이제는 아니다 —
    // 하나가 끝나도 다른 하나가 아직 날아가는 중일 수 있고, 그때 삭제하면 **늦게 도착한
    // 쓰기가 지운 노드를 되살린다.** 주행을 끝냈는데 상대 화면에 내가 남는다.
    // 실측 반례: deleteDoneAt 이 lateWriteDoneAt 보다 86ms 빨랐다.
    if (inFlight === 0 && !isEpochLive(job.epoch)) {
      core.drainDeferredCleanups();
    }
    if (next && isEpochLive(next.epoch)) {
      inFlight += 1;
      syncMotionFlightDebug();
      void runMotionJob(next);
    } else {
      if (next && !isEpochLive(next.epoch)) {
        discardEpochJob("slot-stale", next);
      }
      syncMotionFlightDebug();
      // 마지막 한 개가 끝났을 때만 「배수 완료」다 — 겹쳐 보내면 남은 것이 있을 수 있다.
      if (inFlight === 0) {
        core.notifySettled();
        core.drainDeferredCleanups();
      }
    }
  }
}
