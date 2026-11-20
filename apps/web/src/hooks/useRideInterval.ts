import { useEffect, useRef, useState, type RefObject } from "react";
import { IntervalWorkoutTracker, type WorkoutIntensity } from "../lib/ride/intervalWorkout";
import {
  copyRideIntervalConfig,
  DEFAULT_RIDE_INTERVAL_CONFIG,
  getRideIntervalView,
  normalizeRideIntervalConfig,
  sameRideIntervalConfig,
  type RideIntervalConfig,
} from "../lib/ride/rideInterval";

const CONFIG_STORAGE_KEY = "spinatlas.rideInterval.config.v1";

function fallbackConfig(): Required<RideIntervalConfig> {
  return copyRideIntervalConfig(DEFAULT_RIDE_INTERVAL_CONFIG);
}

function readStoredConfig(ownerUid?: string | null): Required<RideIntervalConfig> {
  try {
    const storage = globalThis.localStorage;
    if (!storage) return fallbackConfig();
    const raw = storage.getItem(ownerUid ? `${CONFIG_STORAGE_KEY}.${ownerUid}` : CONFIG_STORAGE_KEY);
    if (!raw) return fallbackConfig();
    const parsed: unknown = JSON.parse(raw);
    return normalizeRideIntervalConfig(parsed) ?? fallbackConfig();
  } catch {
    return fallbackConfig();
  }
}

function writeStoredConfig(config: Required<RideIntervalConfig>, ownerUid?: string | null): void {
  try {
    globalThis.localStorage?.setItem(ownerUid ? `${CONFIG_STORAGE_KEY}.${ownerUid}` : CONFIG_STORAGE_KEY, JSON.stringify(copyRideIntervalConfig(config)));
  } catch {
    // 저장 실패 시 메모리 선택값만 유지한다.
  }
}

function resolveInitialConfig(initialConfig?: RideIntervalConfig, ownerUid?: string | null): Required<RideIntervalConfig> {
  if (initialConfig !== undefined) {
    return normalizeRideIntervalConfig(initialConfig) ?? fallbackConfig();
  }
  return readStoredConfig(ownerUid);
}

type TrackingOptions = {
  ownerUid: string | null;
  weightKg: number | null;
  activeSecRef: RefObject<number | null>;
  signalGapRef: RefObject<boolean>;
};

function readIntensity(ownerUid?: string | null): WorkoutIntensity {
  try {
    const value = globalThis.localStorage?.getItem(`spinatlas.interval.intensity.v1.${ownerUid ?? "local"}`);
    return value === "light" || value === "vigorous" ? value : "moderate";
  } catch { return "moderate"; }
}

/** 주행의 활동시간을 공유하므로 일시정지·배경 복귀에서 별도 시계가 어긋나지 않는다. */
export function useRideInterval(
  status: "idle" | "running" | "paused",
  elapsedMs: number,
  initiallyEnabled = false,
  initialConfig?: RideIntervalConfig,
  tracking?: TrackingOptions,
) {
  const active = status !== "idle";
  const [selection, setSelection] = useState(() => ({
    enabled: initiallyEnabled,
    startMs: 0,
    active,
    config: resolveInitialConfig(initialConfig, tracking?.ownerUid),
  }));
  const [intensity, setIntensity] = useState<WorkoutIntensity>(() => readIntensity(tracking?.ownerUid));
  const trackerRef = useRef(new IntervalWorkoutTracker());
  const trackingRef = useRef(tracking);
  const elapsedRef = useRef(elapsedMs / 1000);
  const ownerRef = useRef(tracking?.ownerUid);
  useEffect(() => {
    trackingRef.current = tracking;
    elapsedRef.current = elapsedMs / 1000;
  }, [tracking, elapsedMs]);
  useEffect(() => {
    if (ownerRef.current === tracking?.ownerUid) return;
    ownerRef.current = tracking?.ownerUid;
    trackerRef.current.reset();
    setIntensity(readIntensity(tracking?.ownerUid));
    setSelection((previous) => ({ ...previous, enabled: false, startMs: 0, config: readStoredConfig(tracking?.ownerUid) }));
  }, [tracking?.ownerUid]);
  // 주행이 끝나거나 새로 시작할 때 구간 기준만 초기화하고 사용자의 선택은 유지한다.
  if (selection.active !== active) {
    setSelection({ ...selection, active, startMs: 0 });
  }
  const startMs = selection.active === active ? selection.startMs : 0;
  const config = normalizeRideIntervalConfig(selection.config) ?? fallbackConfig();
  const runKey = `${startMs}:${selection.enabled ? 1 : 0}:${config.highSec}:${config.lowSec}:${config.repeats}:${config.warmupSec}:${config.cooldownSec}:${config.rounds}:${config.roundRestSec}`;
  const previousActiveRef = useRef(false);
  useEffect(() => {
    if (active && !previousActiveRef.current) trackerRef.current.reset();
    previousActiveRef.current = active;
    if (!active || !trackingRef.current) return;
    const tracker = trackerRef.current;
    const options = trackingRef.current;
    tracker.finish({ elapsedSec: elapsedRef.current, activeSec: options.activeSecRef.current, signalGap: options.signalGapRef.current, status: selection.enabled ? "reconfigured" : "disabled" });
    if (selection.enabled) tracker.begin({
      id: crypto.randomUUID(), config, intensity,
      elapsedSec: elapsedRef.current, activeSec: options.activeSecRef.current,
      weightKg: options.weightKg,
    });
    // config identity is rebuilt by normalization; runKey is its stable value key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, runKey, intensity]);
  const sampleWorkouts = () => {
    const options = trackingRef.current;
    if (!options || ownerRef.current !== options.ownerUid) return;
    trackerRef.current.advance({ elapsedSec: elapsedRef.current, activeSec: options.activeSecRef.current, signalGap: options.signalGapRef.current });
  };
  const finishWorkouts = () => {
    const options = trackingRef.current;
    if (!options || ownerRef.current !== options.ownerUid) return [];
    trackerRef.current.finish({ elapsedSec: elapsedMs / 1000, activeSec: options.activeSecRef.current, signalGap: options.signalGapRef.current });
    return trackerRef.current.snapshot();
  };
  return {
    intensity,
    onIntensity: (value: WorkoutIntensity) => {
      if (value === intensity) return;
      setIntensity(value);
      // 설정창의 재시작 안내와 타이머·기록의 기준점을 일치시킨다.
      setSelection((previous) => ({ ...previous, startMs: previous.enabled && active ? elapsedMs : previous.startMs }));
      try { globalThis.localStorage?.setItem(`spinatlas.interval.intensity.v1.${tracking?.ownerUid ?? "local"}`, value); } catch { /* 메모리 선택 유지 */ }
    },
    sampleWorkouts,
    finishWorkouts,
    enabled: selection.enabled,
    runKey,
    // 이전 상태 기준으로 갱신한다 — 「설정 적용」이 저장(onConfig)과 켜기(onEnabled)를 한 번에 부르면
    // 같은 시점의 selection 을 펼친 두 갱신 중 뒤의 것이 앞의 것을 지웠다(Chief 11-03 A안).
    onEnabled: (enabled: boolean) => setSelection((prev) => ({ ...prev, enabled, startMs: active ? elapsedMs : 0, active })),
    view: selection.enabled && active ? getRideIntervalView(elapsedMs - startMs, config) : null,
    config,
    onConfig: (next: RideIntervalConfig): boolean => {
      const normalized = normalizeRideIntervalConfig(next);
      if (!normalized) return false;
      if (sameRideIntervalConfig(normalized, config)) return true;
      writeStoredConfig(normalized, tracking?.ownerUid);
      setSelection((prev) => ({
        ...prev,
        config: copyRideIntervalConfig(normalized),
        startMs: prev.enabled && active ? elapsedMs : prev.startMs,
        active,
      }));
      return true;
    },
  };
}
