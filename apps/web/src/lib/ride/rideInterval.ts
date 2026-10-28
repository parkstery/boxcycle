/** 주행 accumulatedMs를 공유한다. 독립 타이머·속도·RPM에 의존하지 않는다. */
export type RideIntervalPhase = "warmup" | "work" | "recovery" | "rest" | "cooldown" | "complete";

export type RideIntervalView = {
  phase: RideIntervalPhase;
  step: number;
  label: string;
  remainingSec: number;
  repeat: number;
  totalRepeats: number;
  round: number;
  totalRounds: number;
  nextLabel: string;
};

export type RideIntervalConfig = {
  highSec: number;
  lowSec: number;
  repeats: number;
  warmupSec?: number;
  cooldownSec?: number;
  rounds?: number;
  roundRestSec?: number;
};

const DEFAULT_WARMUP_SEC = 300;
const DEFAULT_COOLDOWN_SEC = 300;
const DEFAULT_ROUNDS = 1;
const DEFAULT_ROUND_REST_SEC = 0;

export const DEFAULT_RIDE_INTERVAL_CONFIG: Required<RideIntervalConfig> = Object.freeze({
  highSec: 60,
  lowSec: 120,
  repeats: 5,
  warmupSec: DEFAULT_WARMUP_SEC,
  cooldownSec: DEFAULT_COOLDOWN_SEC,
  rounds: DEFAULT_ROUNDS,
  roundRestSec: DEFAULT_ROUND_REST_SEC,
});

export type RideIntervalPresetId = "recovery" | "balanced" | "short" | "10min" | "15min" | "20min" | "25min" | "30min";

export const RIDE_INTERVAL_PRESETS: readonly {
  id: RideIntervalPresetId;
  label: string;
  config: Required<RideIntervalConfig>;
}[] = Object.freeze([
  { id: "10min", label: "10분", config: Object.freeze({ highSec: 30, lowSec: 30, repeats: 2, warmupSec: 240, cooldownSec: 240, rounds: 1, roundRestSec: 0 }) },
  { id: "15min", label: "15분", config: Object.freeze({ highSec: 30, lowSec: 30, repeats: 2, warmupSec: 300, cooldownSec: 300, rounds: 2, roundRestSec: 60 }) },
  { id: "20min", label: "20분", config: Object.freeze({ highSec: 30, lowSec: 30, repeats: 4, warmupSec: 300, cooldownSec: 300, rounds: 2, roundRestSec: 120 }) },
  { id: "25min", label: "25분", config: Object.freeze({ highSec: 30, lowSec: 30, repeats: 4, warmupSec: 300, cooldownSec: 300, rounds: 3, roundRestSec: 90 }) },
  { id: "30min", label: "30분", config: Object.freeze({ highSec: 30, lowSec: 30, repeats: 5, warmupSec: 300, cooldownSec: 300, rounds: 3, roundRestSec: 150 }) },
  {
    id: "recovery",
    label: "회복형 · 운동 1 : 회복 2",
    config: Object.freeze({
      highSec: 60, lowSec: 120, repeats: 5, warmupSec: 300, cooldownSec: 300, rounds: 1, roundRestSec: 0,
    }),
  },
  {
    id: "balanced",
    label: "균형형 · 운동 1 : 회복 1",
    config: Object.freeze({
      highSec: 60, lowSec: 60, repeats: 8, warmupSec: 300, cooldownSec: 300, rounds: 1, roundRestSec: 0,
    }),
  },
  {
    id: "short",
    label: "짧은 반복 · 20초 : 10초",
    config: Object.freeze({
      highSec: 20, lowSec: 10, repeats: 8, warmupSec: 600, cooldownSec: 300, rounds: 2, roundRestSec: 180,
    }),
  },
]);

function isIntInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}

function isOptionalIntInRange(value: unknown, min: number, max: number): boolean {
  return value === undefined || isIntInRange(value, min, max);
}

export function isRideIntervalConfig(value: unknown): value is RideIntervalConfig {
  if (value == null || typeof value !== "object") return false;
  const candidate = value as {
    highSec?: unknown;
    lowSec?: unknown;
    repeats?: unknown;
    warmupSec?: unknown;
    cooldownSec?: unknown;
    rounds?: unknown;
    roundRestSec?: unknown;
  };
  return (
    isIntInRange(candidate.highSec, 5, 600) &&
    isIntInRange(candidate.lowSec, 5, 600) &&
    isIntInRange(candidate.repeats, 1, 30) &&
    isOptionalIntInRange(candidate.warmupSec, 0, 1800) &&
    isOptionalIntInRange(candidate.cooldownSec, 0, 1800) &&
    isOptionalIntInRange(candidate.rounds, 1, 3) &&
    isOptionalIntInRange(candidate.roundRestSec, 0, 1800)
  );
}

export function normalizeRideIntervalConfig(value: unknown): Required<RideIntervalConfig> | null {
  if (!isRideIntervalConfig(value)) return null;
  return {
    highSec: value.highSec,
    lowSec: value.lowSec,
    repeats: value.repeats,
    warmupSec: value.warmupSec ?? DEFAULT_WARMUP_SEC,
    cooldownSec: value.cooldownSec ?? DEFAULT_COOLDOWN_SEC,
    rounds: value.rounds ?? DEFAULT_ROUNDS,
    roundRestSec: value.roundRestSec ?? DEFAULT_ROUND_REST_SEC,
  };
}

function resolveConfig(config?: RideIntervalConfig): Required<RideIntervalConfig> {
  return normalizeRideIntervalConfig(config) ?? normalizeRideIntervalConfig(DEFAULT_RIDE_INTERVAL_CONFIG)!;
}

export function copyRideIntervalConfig(config: Required<RideIntervalConfig>): Required<RideIntervalConfig> {
  return {
    highSec: config.highSec,
    lowSec: config.lowSec,
    repeats: config.repeats,
    warmupSec: config.warmupSec,
    cooldownSec: config.cooldownSec,
    rounds: config.rounds,
    roundRestSec: config.roundRestSec,
  };
}

export function sameRideIntervalConfig(a: Required<RideIntervalConfig>, b: Required<RideIntervalConfig>): boolean {
  return (
    a.highSec === b.highSec &&
    a.lowSec === b.lowSec &&
    a.repeats === b.repeats &&
    a.warmupSec === b.warmupSec &&
    a.cooldownSec === b.cooldownSec &&
    a.rounds === b.rounds &&
    a.roundRestSec === b.roundRestSec
  );
}

export function matchRideIntervalPreset(config: Required<RideIntervalConfig>): RideIntervalPresetId | "custom" {
  const found = RIDE_INTERVAL_PRESETS.find((preset) => sameRideIntervalConfig(preset.config, config));
  return found?.id ?? "custom";
}

export function getRideIntervalTotalSec(config?: RideIntervalConfig): number {
  const resolved = resolveConfig(config);
  const cycle = (resolved.highSec + resolved.lowSec) * resolved.repeats;
  const rest = resolved.roundRestSec * Math.max(0, resolved.rounds - 1);
  return resolved.warmupSec + resolved.cooldownSec + cycle * resolved.rounds + rest;
}

export function getRideIntervalTotalMs(config?: RideIntervalConfig): number {
  return getRideIntervalTotalSec(config) * 1000;
}

export const RIDE_INTERVAL_TOTAL_MS = getRideIntervalTotalMs();

export function formatRideIntervalClock(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}

function formatStepDuration(seconds: number): string {
  return seconds % 60 === 0 ? `${seconds / 60}분` : `${seconds}초`;
}

type IntervalStep = {
  phase: RideIntervalPhase;
  label: string;
  seconds: number;
  repeat: number;
  round: number;
};

function buildIntervalSteps(resolved: Required<RideIntervalConfig>): IntervalStep[] {
  const steps: IntervalStep[] = [];
  if (resolved.warmupSec > 0) {
    steps.push({ phase: "warmup", label: "준비", seconds: resolved.warmupSec, repeat: 0, round: 1 });
  }
  for (let round = 1; round <= resolved.rounds; round++) {
    for (let repeat = 1; repeat <= resolved.repeats; repeat++) {
      steps.push({ phase: "work", label: "운동", seconds: resolved.highSec, repeat, round });
      steps.push({ phase: "recovery", label: "회복", seconds: resolved.lowSec, repeat, round });
    }
    if (round < resolved.rounds && resolved.roundRestSec > 0) {
      steps.push({
        phase: "rest",
        label: "휴식",
        seconds: resolved.roundRestSec,
        repeat: resolved.repeats,
        round,
      });
    }
  }
  if (resolved.cooldownSec > 0) {
    steps.push({
      phase: "cooldown",
      label: "마무리",
      seconds: resolved.cooldownSec,
      repeat: resolved.repeats,
      round: resolved.rounds,
    });
  }
  return steps;
}

/** 준비 → (운동+회복)×repeats × rounds(라운드 사이 휴식) → 마무리. 0초 단계는 건너뛴다. */
export function getRideIntervalView(elapsedMs: number, config?: RideIntervalConfig): RideIntervalView {
  const resolved = resolveConfig(config);
  let remainingMs = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
  const steps = buildIntervalSteps(resolved);
  for (const [step, current] of steps.entries()) {
    if (remainingMs < current.seconds * 1000) {
      const next = steps[step + 1];
      return {
        phase: current.phase,
        step,
        label: current.label,
        remainingSec: Math.ceil((current.seconds * 1000 - remainingMs) / 1000),
        repeat: current.repeat,
        totalRepeats: resolved.repeats,
        round: current.round,
        totalRounds: resolved.rounds,
        nextLabel: next ? `다음 · ${next.label} ${formatStepDuration(next.seconds)}` : "다음 · 자유 주행",
      };
    }
    remainingMs -= current.seconds * 1000;
  }
  return {
    phase: "complete",
    step: steps.length,
    label: "인터벌",
    remainingSec: 0,
    repeat: resolved.repeats,
    totalRepeats: resolved.repeats,
    round: resolved.rounds,
    totalRounds: resolved.rounds,
    nextLabel: "자유 주행 계속",
  };
}
