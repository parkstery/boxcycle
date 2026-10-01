import {
  armPairedCapture,
  clearPairedCapture,
  getPairedCapture,
  type PairedCapturePlan,
  type PairedCaptureState,
} from "./trafficPairedCapture";
import {
  deltaTrafficPublishMeters,
  resetTrafficPublishMeters,
  snapshotTrafficPublishMeters,
  type TrafficPublishMetersSnapshot,
} from "./trafficPublishMeters";

export type TrafficPublishMetersApi = {
  snapshot: typeof snapshotTrafficPublishMeters;
  reset: typeof resetTrafficPublishMeters;
  delta: typeof deltaTrafficPublishMeters;
  /** Arm in-page start/end snaps at absolute deadlines (TASK-31B-R). */
  armPairedCapture: (plan: PairedCapturePlan) => PairedCapturePlan;
  getPairedCapture: () => PairedCaptureState | null;
  clearPairedCapture: () => void;
};

/**
 * DEV — window API for TASK-28/31B controlled emulator traffic harness.
 * - `__rtwTrafficMeters()` → snapshot
 * - `__rtwTrafficMetersApi.reset()` / `.snapshot()` / `.delta(start, end)`
 * - `__rtwTrafficMetersApi.armPairedCapture(plan)` / `.getPairedCapture()`
 */
export function installTrafficPublishDebug(): void {
  if (!import.meta.env.DEV) return;
  if (typeof window === "undefined") return;
  const api: TrafficPublishMetersApi = {
    snapshot: snapshotTrafficPublishMeters,
    reset: resetTrafficPublishMeters,
    delta: deltaTrafficPublishMeters,
    armPairedCapture,
    getPairedCapture,
    clearPairedCapture,
  };
  (
    window as Window & {
      __rtwTrafficMeters?: () => TrafficPublishMetersSnapshot;
      __rtwTrafficMetersApi?: TrafficPublishMetersApi;
    }
  ).__rtwTrafficMeters = snapshotTrafficPublishMeters;
  (
    window as Window & {
      __rtwTrafficMetersApi?: TrafficPublishMetersApi;
    }
  ).__rtwTrafficMetersApi = api;
}
