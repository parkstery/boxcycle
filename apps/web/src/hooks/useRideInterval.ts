import { useState } from "react";
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

function readStoredConfig(): Required<RideIntervalConfig> {
  try {
    const storage = globalThis.localStorage;
    if (!storage) return fallbackConfig();
    const raw = storage.getItem(CONFIG_STORAGE_KEY);
    if (!raw) return fallbackConfig();
    const parsed: unknown = JSON.parse(raw);
    return normalizeRideIntervalConfig(parsed) ?? fallbackConfig();
  } catch {
    return fallbackConfig();
  }
}

function writeStoredConfig(config: Required<RideIntervalConfig>): void {
  try {
    globalThis.localStorage?.setItem(CONFIG_STORAGE_KEY, JSON.stringify(copyRideIntervalConfig(config)));
  } catch {
    // 저장 실패 시 메모리 선택값만 유지한다.
  }
}

function resolveInitialConfig(initialConfig?: RideIntervalConfig): Required<RideIntervalConfig> {
  if (initialConfig !== undefined) {
    return normalizeRideIntervalConfig(initialConfig) ?? fallbackConfig();
  }
  return readStoredConfig();
}

/** 주행의 활동시간을 공유하므로 일시정지·배경 복귀에서 별도 시계가 어긋나지 않는다. */
export function useRideInterval(
  status: "idle" | "running" | "paused",
  elapsedMs: number,
  initiallyEnabled = false,
  initialConfig?: RideIntervalConfig,
) {
  const active = status !== "idle";
  const [selection, setSelection] = useState(() => ({
    enabled: initiallyEnabled,
    startMs: 0,
    active,
    config: resolveInitialConfig(initialConfig),
  }));
  // 주행이 끝나거나 새로 시작할 때 구간 기준만 초기화하고 사용자의 선택은 유지한다.
  if (selection.active !== active) {
    setSelection({ ...selection, active, startMs: 0 });
  }
  const startMs = selection.active === active ? selection.startMs : 0;
  const config = normalizeRideIntervalConfig(selection.config) ?? fallbackConfig();
  const runKey = `${startMs}:${selection.enabled ? 1 : 0}:${config.highSec}:${config.lowSec}:${config.repeats}:${config.warmupSec}:${config.cooldownSec}:${config.rounds}:${config.roundRestSec}`;
  return {
    enabled: selection.enabled,
    runKey,
    onEnabled: (enabled: boolean) => setSelection({ ...selection, enabled, startMs: active ? elapsedMs : 0, active }),
    view: selection.enabled && active ? getRideIntervalView(elapsedMs - startMs, config) : null,
    config,
    onConfig: (next: RideIntervalConfig): boolean => {
      const normalized = normalizeRideIntervalConfig(next);
      if (!normalized) return false;
      if (sameRideIntervalConfig(normalized, config)) return true;
      writeStoredConfig(normalized);
      const restart = selection.enabled && active;
      setSelection({
        ...selection,
        config: copyRideIntervalConfig(normalized),
        startMs: restart ? elapsedMs : selection.startMs,
        active,
      });
      return true;
    },
  };
}
