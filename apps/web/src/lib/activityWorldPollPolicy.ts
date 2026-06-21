import { isRouteActivityLive, type RouteActivitySnapshot } from "./firestoreRouteActivity";
import {
  ACTIVITY_WORLD_POLL_ACTIVE_MS,
  ACTIVITY_WORLD_POLL_IDLE_MS,
} from "./rideSyncPolicy";

export type ActivityWorldPollMode = "idle" | "active";

export type ActivityWorldPollModeInput = {
  selfRideActive: boolean;
  worldLivePulseCount: number;
  lastBatchLiveCount: number;
  postRideWatchActive?: boolean;
};

export function resolveActivityWorldPollMode(input: ActivityWorldPollModeInput): ActivityWorldPollMode {
  if (input.selfRideActive) return "active";
  if (input.postRideWatchActive) return "active";
  if (input.worldLivePulseCount > 0) return "active";
  if (input.lastBatchLiveCount > 0) return "active";
  return "idle";
}

export function activityWorldPollIntervalMs(mode: ActivityWorldPollMode): number {
  return mode === "active" ? ACTIVITY_WORLD_POLL_ACTIVE_MS : ACTIVITY_WORLD_POLL_IDLE_MS;
}

/** batch 결과에서 `isRouteActivityLive` 건수(exclude 제외) */
export function countRouteActivityLiveInBatch(
  map: ReadonlyMap<string, RouteActivitySnapshot | null>,
  excludePublicationId?: string | null,
): number {
  const exclude = excludePublicationId?.trim() ?? "";
  let count = 0;
  for (const [id, row] of map) {
    if (!row || !isRouteActivityLive(row)) continue;
    if (exclude && id === exclude) continue;
    count += 1;
  }
  return count;
}

/** @deprecated {@link countRouteActivityLiveInBatch} */
export const countCourseActivityLiveInBatch = countRouteActivityLiveInBatch;

/** P0 — mode·interval 결정 */
export function runActivityWorldPollPolicyChecks(): void {
  if (resolveActivityWorldPollMode({ selfRideActive: true, worldLivePulseCount: 0, lastBatchLiveCount: 0 }) !== "active") {
    throw new Error("[ActivityWorldPoll] selfRideActive must force active");
  }
  if (resolveActivityWorldPollMode({ selfRideActive: false, worldLivePulseCount: 2, lastBatchLiveCount: 0 }) !== "active") {
    throw new Error("[ActivityWorldPoll] worldLivePulseCount must force active");
  }
  if (resolveActivityWorldPollMode({ selfRideActive: false, worldLivePulseCount: 0, lastBatchLiveCount: 1 }) !== "active") {
    throw new Error("[ActivityWorldPoll] lastBatchLiveCount must force active");
  }
  if (resolveActivityWorldPollMode({ selfRideActive: false, worldLivePulseCount: 0, lastBatchLiveCount: 0 }) !== "idle") {
    throw new Error("[ActivityWorldPoll] all zero must be idle");
  }
  if (
    resolveActivityWorldPollMode({
      selfRideActive: false,
      worldLivePulseCount: 0,
      lastBatchLiveCount: 0,
      postRideWatchActive: true,
    }) !== "active"
  ) {
    throw new Error("[ActivityWorldPoll] postRideWatchActive must force active");
  }
  if (activityWorldPollIntervalMs("idle") !== ACTIVITY_WORLD_POLL_IDLE_MS) {
    throw new Error("[ActivityWorldPoll] idle interval mismatch");
  }
  if (activityWorldPollIntervalMs("active") !== ACTIVITY_WORLD_POLL_ACTIVE_MS) {
    throw new Error("[ActivityWorldPoll] active interval mismatch");
  }
}
