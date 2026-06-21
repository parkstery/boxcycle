import type { ActivityWorldPollModeInput } from "./activityWorldPollPolicy";
import { ACTIVITY_WORLD_POST_RIDE_WATCH_MS } from "./rideSyncPolicy";

/** 여러 hook 간 adaptive mode 판정 공유(WO-A, onSnapshot 없음) */
let signals: ActivityWorldPollModeInput = {
  selfRideActive: false,
  worldLivePulseCount: 0,
  lastBatchLiveCount: 0,
  postRideWatchActive: false,
};

let postRideWatchUntilMs = 0;

export function armPostRideActivityWatch(durationMs = ACTIVITY_WORLD_POST_RIDE_WATCH_MS): void {
  postRideWatchUntilMs = Math.max(postRideWatchUntilMs, Date.now() + durationMs);
  signals = { ...signals, postRideWatchActive: true };
}

export function isPostRideActivityWatchActive(nowMs = Date.now()): boolean {
  const active = nowMs < postRideWatchUntilMs;
  if (!active && signals.postRideWatchActive) {
    signals = { ...signals, postRideWatchActive: false };
  }
  return active;
}

export function reportActivityWorldPollSignals(partial: Partial<ActivityWorldPollModeInput>): void {
  signals = { ...signals, ...partial };
}

export function getActivityWorldPollSignals(): Readonly<ActivityWorldPollModeInput> {
  return {
    ...signals,
    postRideWatchActive: isPostRideActivityWatchActive(),
  };
}

export function resetActivityWorldPollSignals(): void {
  postRideWatchUntilMs = 0;
  signals = {
    selfRideActive: false,
    worldLivePulseCount: 0,
    lastBatchLiveCount: 0,
    postRideWatchActive: false,
  };
}
