/**
 * S4-1 — Firestore route 단일 슬롯(single-flight) + latest-wins.
 * motionPublishFlight 와 같은 관용구. motion 파일은 수정하지 않는다.
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

let writing = false;
let slot: RouteFlightJob | null = null;
let slotDiscardCount = 0;

export function peekRouteSlotDiscardCount(): number {
  return slotDiscardCount;
}

export function enqueueRoutePublish(job: RouteFlightJob): { accepted: "write" | "slot"; overwrite: boolean } {
  if (writing) {
    const overwrite = slot != null;
    if (overwrite) {
      slotDiscardCount += 1;
    }
    slot = job;
    return { accepted: "slot", overwrite };
  }
  writing = true;
  void runRouteJob(job);
  return { accepted: "write", overwrite: false };
}

async function runRouteJob(job: RouteFlightJob): Promise<void> {
  const { user, snapshot } = job;
  const fsWriteStartAt = Date.now();
  beginRouteInFlight();
  try {
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
      });
    }
    job.onError?.(e);
  } finally {
    endRouteInFlight();
    const next = slot;
    slot = null;
    if (next) {
      void runRouteJob(next);
    } else {
      writing = false;
    }
  }
}
