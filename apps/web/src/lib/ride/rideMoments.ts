import type { RideIntervalPhase, RideIntervalView } from "./rideInterval";

export type RideMomentKind =
  | "start"
  | "half"
  | "waypoint"
  | "intervalStart"
  | "intervalWarn"
  | "intervalHigh"
  | "intervalLow"
  | "intervalRest"
  | "intervalCooldown"
  | "intervalComplete"
  | "finish"
  | "stop";

export type RideMomentSoundKind = "start" | "warn" | "high" | "low" | "finish" | "stop";

export type RideMomentEvent = {
  kind: RideMomentKind;
  title: string;
  detail: string;
  coach: string;
  sound: RideMomentSoundKind;
  waypointIndex?: number;
};

type RideSessionStatus = "idle" | "running" | "paused";

export type RideMomentInput = {
  status: RideSessionStatus;
  elapsedMs: number;
  routeMeters: number;
  traveledMeters: number;
  waypointMeters: readonly number[];
  interval: RideIntervalView | null;
  newRoadKm: number | null;
  ended: { reason: "finish" | "stop"; sessionKm: number } | null;
  intervalRunKey?: string | number | null;
};

export type RideMomentMemory = {
  started: boolean;
  half: boolean;
  waypoints: number[];
  intervalStarted: boolean;
  intervalCompleted: boolean;
  warnedStep: number | null;
  lastPhase: RideIntervalPhase | null;
  lastElapsedMs: number;
  lastTraveledMeters: number;
  lastStatus: RideSessionStatus;
  ended: boolean;
  intervalRunKey: string | number | null;
};

export const RIDE_MOMENT_PRIORITY: Record<RideMomentKind, number> = {
  intervalWarn: 100,
  intervalHigh: 110,
  intervalLow: 110,
  intervalRest: 110,
  intervalCooldown: 110,
  intervalStart: 90,
  intervalComplete: 110,
  start: 70,
  finish: 120,
  stop: 120,
  waypoint: 40,
  half: 40,
};

const LARGE_JUMP_MS = 8000;
const LARGE_JUMP_METERS = 200;
const WAYPOINT_PASS_TOLERANCE_M = 12;
export const RIDE_MOMENT_DISPLAY_MS = 2400;

export function emptyRideMomentMemory(): RideMomentMemory {
  return {
    started: false,
    half: false,
    waypoints: [],
    intervalStarted: false,
    intervalCompleted: false,
    warnedStep: null,
    lastPhase: null,
    lastElapsedMs: 0,
    lastTraveledMeters: 0,
    lastStatus: "idle",
    ended: false,
    intervalRunKey: null,
  };
}

function formatKm(meters: number): string {
  const km = Math.max(0, meters) / 1000;
  return km < 10 ? km.toFixed(2) : km.toFixed(1);
}

function formatNewRoad(km: number | null): string | null {
  if (km == null || !Number.isFinite(km) || km <= 0) return null;
  return `새 도로 +${km < 10 ? km.toFixed(2) : km.toFixed(1)} km`;
}

function pickHighest(events: RideMomentEvent[]): RideMomentEvent | null {
  if (events.length === 0) return null;
  return events.reduce((best, next) => (RIDE_MOMENT_PRIORITY[next.kind] > RIDE_MOMENT_PRIORITY[best.kind] ? next : best));
}

function intervalTransitionEvent(phase: RideIntervalPhase): RideMomentEvent | null {
  if (phase === "warmup") {
    return {
      kind: "intervalStart",
      title: "인터벌 시작",
      detail: "준비부터 차근차근",
      coach: "준비부터 차근차근 시작해요.",
      sound: "start",
    };
  }
  if (phase === "work") {
    return {
      kind: "intervalHigh",
      title: "고강도",
      detail: "이번 구간",
      coach: "이번 구간, 힘을 내봐요!",
      sound: "high",
    };
  }
  if (phase === "rest") return { kind: "intervalRest", title: "긴 회복", detail: "편하게 페달을 밟아요", coach: "긴 회복입니다. 편하게 페달을 밟으세요.", sound: "low" };
  if (phase === "cooldown") return { kind: "intervalCooldown", title: "마무리", detail: "천천히 속도를 낮춰요", coach: "마무리 운동입니다. 천천히 속도를 낮추세요.", sound: "low" };
  if (phase === "recovery") {
    return {
      kind: "intervalLow",
      title: "회복",
      detail: "편하게 회복",
      coach: "잘했어요. 편하게 회복하세요.",
      sound: "low",
    };
  }
  return null;
}

function intervalStartEvent(interval: RideIntervalView): RideMomentEvent {
  const transition = intervalTransitionEvent(interval.phase);
  if (interval.phase === "warmup" || !transition) {
    return {
      kind: "intervalStart",
      title: "인터벌 시작",
      detail: interval.label,
      coach: "준비부터 차근차근 시작해요.",
      sound: "start",
    };
  }
  return {
    ...transition,
    kind: "intervalStart",
    title: "인터벌 시작",
    detail: interval.label,
  };
}

function consumeSkippedProgress(next: RideMomentMemory, input: RideMomentInput): void {
  if (input.routeMeters > 0 && input.traveledMeters >= input.routeMeters / 2) next.half = true;
  for (const [index, meters] of input.waypointMeters.entries()) {
    if (!Number.isFinite(meters) || meters <= 0) continue;
    if (next.waypoints.includes(index)) continue;
    if (input.traveledMeters + WAYPOINT_PASS_TOLERANCE_M < meters) continue;
    next.waypoints.push(index);
  }
  if (!input.interval) return;
  next.intervalStarted = true;
  if (input.interval.phase === "complete") next.intervalCompleted = true;
  if (input.interval.remainingSec <= 3) next.warnedStep = input.interval.step;
}

function nextIsHighOrLow(nextLabel: string): boolean {
  return nextLabel.includes("운동") || nextLabel.includes("회복") || nextLabel.includes("고강도");
}

/** 한 틱에서 후보를 모은 뒤 우선순위 하나만 남긴다. 큐에 쌓지 않는다. */
export function resolveRideMoments(
  memory: RideMomentMemory,
  input: RideMomentInput,
): { memory: RideMomentMemory; event: RideMomentEvent | null } {
  const newRide = input.status === "running" && (memory.lastStatus === "idle" || memory.ended);
  const source = newRide ? emptyRideMomentMemory() : memory;
  const next: RideMomentMemory = {
    ...source,
    waypoints: [...source.waypoints],
    lastElapsedMs: input.elapsedMs,
    lastTraveledMeters: input.traveledMeters,
    lastStatus: input.status,
    lastPhase: input.interval?.phase ?? null,
    intervalRunKey: input.intervalRunKey ?? source.intervalRunKey,
  };

  if (!newRide && input.status !== "running" && input.ended && !source.ended) {
    next.ended = true;
    next.warnedStep = null;
    const road = formatNewRoad(input.newRoadKm);
    const session = formatKm(input.ended.sessionKm * 1000);
    const event: RideMomentEvent = input.ended.reason === "finish"
      ? {
          kind: "finish",
          title: `${session} km 완주!`,
          detail: road ?? "목표 거리를 해냈어요",
          coach: road ? "달린 길이 내 도로망으로 쌓였어요." : "끝까지 해냈어요.",
          sound: "finish",
        }
      : {
          kind: "stop",
          title: `오늘 ${session} km`,
          detail: road ?? "오늘도 달렸어요",
          coach: "오늘도 달렸어요. 수고했어요.",
          sound: "stop",
        };
    return { memory: next, event };
  }

  if (input.status === "idle") {
    return {
      memory: {
        ...emptyRideMomentMemory(),
        lastStatus: "idle",
        ended: source.ended || Boolean(input.ended),
      },
      event: null,
    };
  }

  if (input.status === "paused") {
    return { memory: next, event: null };
  }

  if (input.status !== "running") {
    return { memory: next, event: null };
  }

  const fromIdle = source.lastStatus === "idle";
  const jumped = !fromIdle && source.lastStatus === "running" && (
    input.elapsedMs + 1 < source.lastElapsedMs
    || input.elapsedMs - source.lastElapsedMs > LARGE_JUMP_MS
    || input.traveledMeters - source.lastTraveledMeters > LARGE_JUMP_METERS
  );
  if (jumped) consumeSkippedProgress(next, input);
  const candidates: RideMomentEvent[] = [];

  if (fromIdle && !source.started) {
    next.started = true;
    const total = input.routeMeters > 0 ? `목표 ${formatKm(input.routeMeters)} km` : "새로운 길";
    candidates.push({
      kind: "start",
      title: "새로운 길로 출발",
      detail: total,
      coach: "오늘도 내 도로망을 넓혀 볼까요?",
      sound: "start",
    });
  }

  if (!jumped && !fromIdle && input.routeMeters > 0 && !source.half) {
    const half = input.routeMeters / 2;
    if (source.lastTraveledMeters < half && input.traveledMeters >= half) {
      next.half = true;
      const halfKm = formatKm(half);
      const totalKm = formatKm(input.routeMeters);
      candidates.push({
        kind: "half",
        title: "벌써 절반!",
        detail: `${halfKm} / ${totalKm} km`,
        coach: `지금까지 ${halfKm}km, 잘 달리고 있어요.`,
        sound: "start",
      });
    }
  }

  if (!jumped && !fromIdle) {
    for (const [index, meters] of input.waypointMeters.entries()) {
      if (!Number.isFinite(meters) || meters <= 0) continue;
      if (next.waypoints.includes(index)) continue;
      if (source.lastTraveledMeters >= meters) continue;
      if (input.traveledMeters + WAYPOINT_PASS_TOLERANCE_M < meters) continue;
      next.waypoints.push(index);
      candidates.push({
        kind: "waypoint",
        title: index === 0 ? "첫 경유지 통과" : `경유지 ${index + 1} 통과`,
        detail: "다음 목적지까지 이어 가요",
        coach: "한 구간을 해냈어요. 내 페이스로 계속!",
        sound: "start",
        waypointIndex: index,
      });
    }
  }

  const interval = input.interval;
  if (!interval) {
    next.intervalStarted = false;
    next.intervalCompleted = false;
    next.warnedStep = null;
    next.lastPhase = null;
    next.intervalRunKey = null;
    return { memory: next, event: pickHighest(candidates) };
  }

  // 인터벌 중에는 일반 주행 이벤트를 표시하지 않는다.
  if (interval.phase !== "complete") candidates.length = 0;

  const runKeyChanged = input.intervalRunKey != null && input.intervalRunKey !== source.intervalRunKey;
  if ((source.intervalCompleted && interval.phase !== "complete") || (runKeyChanged && interval.phase !== "complete")) {
    next.intervalStarted = false;
    next.intervalCompleted = false;
    next.warnedStep = null;
  }

  if (!jumped && !next.intervalStarted && interval.phase !== "complete") {
    next.intervalStarted = true;
    candidates.push(intervalStartEvent(interval));
  }

  if (
    !jumped &&
    next.intervalStarted &&
    source.lastPhase &&
    source.lastPhase !== interval.phase &&
    interval.phase !== "complete"
  ) {
    const transition = intervalTransitionEvent(interval.phase);
    if (transition) candidates.push(transition);
    next.warnedStep = null;
  }

  if (
    !jumped &&
    interval.phase !== "complete" &&
    interval.remainingSec === 3 &&
    nextIsHighOrLow(interval.nextLabel) &&
    next.warnedStep !== interval.step
  ) {
    next.warnedStep = interval.step;
    const toHigh = interval.nextLabel.includes("운동") || interval.nextLabel.includes("고강도");
    candidates.push({
      kind: "intervalWarn",
      title: "곧 전환",
      detail: interval.nextLabel,
      coach: toHigh ? "곧 고강도 구간이에요." : "곧 회복 구간이에요.",
      sound: "warn",
    });
  }

  if (!jumped && interval.phase === "complete" && !next.intervalCompleted) {
    next.intervalCompleted = true;
    next.warnedStep = null;
    candidates.push({
      kind: "intervalComplete",
      title: "인터벌 완료!",
      detail: "계획한 구간을 해냈어요",
      coach: "이제 자유롭게 달리세요.",
      sound: "finish",
    });
  }

  return { memory: next, event: pickHighest(candidates) };
}
