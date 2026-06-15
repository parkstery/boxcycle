import type { ActivityWorldPollModeInput } from "./activityWorldPollPolicy";

/** 여러 hook 간 adaptive mode 판정 공유(WO-A, onSnapshot 없음) */
let signals: ActivityWorldPollModeInput = {
  selfRideActive: false,
  worldLivePulseCount: 0,
  lastBatchLiveCount: 0,
};

export function reportActivityWorldPollSignals(partial: Partial<ActivityWorldPollModeInput>): void {
  signals = { ...signals, ...partial };
}

export function getActivityWorldPollSignals(): Readonly<ActivityWorldPollModeInput> {
  return signals;
}

export function resetActivityWorldPollSignals(): void {
  signals = {
    selfRideActive: false,
    worldLivePulseCount: 0,
    lastBatchLiveCount: 0,
  };
}
