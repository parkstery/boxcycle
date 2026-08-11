/**
 * S3A — RTDB motion 단일 슬롯(single-flight) + latest-wins.
 * 배열 큐를 쓰지 않는다. 진행 중 쓰기가 있으면 대기 슬롯 1칸만 최신 스냅샷으로 덮는다.
 */
import type { User } from "firebase/auth";
import type { LiveLocationSnapshot } from "../liveLocationSnapshot";
import {
  mergeTrailMotionSnapshot,
  snapshotToRtdbTrailMotionSnapshot,
} from "../rtdbTrailMotion";
import { nextPeerSyncChainSeq, peerSyncChainLog } from "./peerSyncChainLog";

export type MotionFlightJob = {
  user: User;
  trailId: string;
  snapshot: LiveLocationSnapshot;
  onWriteStart?: () => void;
};

let writing = false;
let slot: MotionFlightJob | null = null;
let slotDiscardCount = 0;

export function peekMotionSlotDiscardCount(): number {
  return slotDiscardCount;
}

export function enqueueMotionPublish(job: MotionFlightJob): { accepted: "write" | "slot"; overwrite: boolean } {
  if (writing) {
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
    return { accepted: "slot", overwrite };
  }
  writing = true;
  void runMotionJob(job);
  return { accepted: "write", overwrite: false };
}

async function runMotionJob(job: MotionFlightJob): Promise<void> {
  try {
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
        uid: job.user.uid.slice(0, 6),
      });
    }
    job.onWriteStart?.();
    await mergeTrailMotionSnapshot(
      job.user,
      job.trailId,
      snapshotToRtdbTrailMotionSnapshot(job.snapshot),
      { seq, snapshotCapturedAt },
    );
  } finally {
    const next = slot;
    slot = null;
    if (next) {
      void runMotionJob(next);
    } else {
      writing = false;
    }
  }
}
