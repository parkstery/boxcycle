import { isDiscardableRideRecord } from "./rideRecordPolicy";
import type { StoredRideSession } from "./rideSessionsStorage";
import type { IntervalWorkoutRecord } from "./intervalWorkout";

/**
 * 통계 기간 축. `day` 는 2026-09-15 에 합류했다 — 종전에는 「일일 주행」이 탭 밖에서
 * 별도 블록으로 그려져 같은 타일 세트가 두 벌 쌓였다. 일일도 기간의 하나이므로
 * 같은 축에 넣어 통계 블록을 하나로 만든다.
 */
export type RideStatsPeriod = "day" | "week" | "month" | "quarter" | "year";

export type AggregatedRideStats = {
  rides: number;
  distanceMeters: number;
  elapsedSec: number;
  /** 추정값이 있는 주행만 합산(null→0 강제 합산 금지) */
  caloriesEstimate: number;
  /** caloriesEstimate == null 인 유효 주행 수 */
  caloriesUnknownCount: number;
  /** 총 거리·총 시간으로 환산한 평균 속도(km/h) */
  avgSpeedKmh: number;
};

/** 기기 로컬 달력 기준 월요일 00:00:00.000 (한국 등에서 일반적인 주 시작) */
function startOfMondayWeekLocal(ref: Date): Date {
  const d = new Date(ref);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const delta = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + delta);
  return d;
}

function endOfWeekExclusiveLocal(ref: Date): Date {
  const s = startOfMondayWeekLocal(ref);
  const e = new Date(s);
  e.setDate(e.getDate() + 7);
  return e;
}

function startOfMonthLocal(ref: Date): Date {
  return new Date(ref.getFullYear(), ref.getMonth(), 1, 0, 0, 0, 0);
}

function endOfMonthExclusiveLocal(ref: Date): Date {
  return new Date(ref.getFullYear(), ref.getMonth() + 1, 1, 0, 0, 0, 0);
}

function startOfDayLocal(ref: Date): Date {
  return new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), 0, 0, 0, 0);
}

function endOfDayExclusiveLocal(ref: Date): Date {
  return new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() + 1, 0, 0, 0, 0);
}

function startOfYearLocal(ref: Date): Date {
  return new Date(ref.getFullYear(), 0, 1, 0, 0, 0, 0);
}

function endOfYearExclusiveLocal(ref: Date): Date {
  return new Date(ref.getFullYear() + 1, 0, 1, 0, 0, 0, 0);
}

function formatKoShort(d: Date): string {
  return d.toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" });
}

export type PeriodRange = {
  start: Date;
  endExclusive: Date;
  labelKo: string;
};

export function getRideStatsPeriodRange(period: RideStatsPeriod, now: Date = new Date()): PeriodRange {
  if (period === "day") return getLocalDayRange(now);
  if (period === "week") {
    const start = startOfMondayWeekLocal(now);
    const endExclusive = endOfWeekExclusiveLocal(now);
    const lastInclusive = new Date(endExclusive.getTime() - 1);
    return {
      start,
      endExclusive,
      labelKo: `${formatKoShort(start)} ~ ${formatKoShort(lastInclusive)}`,
    };
  }
  if (period === "month") {
    const start = startOfMonthLocal(now);
    const endExclusive = endOfMonthExclusiveLocal(now);
    const lastInclusive = new Date(endExclusive.getTime() - 1);
    return {
      start,
      endExclusive,
      labelKo: `${now.getFullYear()}년 ${now.getMonth() + 1}월 (${formatKoShort(start)} ~ ${formatKoShort(lastInclusive)})`,
    };
  }
  if (period === "quarter") {
    const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
    const start = new Date(now.getFullYear(), quarterMonth, 1);
    const endExclusive = new Date(now.getFullYear(), quarterMonth + 3, 1);
    return {
      start,
      endExclusive,
      labelKo: `${now.getFullYear()}년 ${quarterMonth / 3 + 1}분기 (${quarterMonth + 1}~${quarterMonth + 3}월)`,
    };
  }
  const start = startOfYearLocal(now);
  const endExclusive = endOfYearExclusiveLocal(now);
  return {
    start,
    endExclusive,
    labelKo: `${now.getFullYear()}년 1월 1일 ~ 12월 31일`,
  };
}

/** 기간 시작점을 먼저 구해 월말·윤년의 날짜 넘침 없이 이전/다음 기간으로 이동한다. */
export function shiftRideStatsReference(period: RideStatsPeriod, reference: Date, offset: number): Date {
  const result = new Date(getRideStatsPeriodRange(period, reference).start);
  const steps = Number.isFinite(offset) ? Math.trunc(offset) : 0;
  if (period === "day") result.setDate(result.getDate() + steps);
  else if (period === "week") result.setDate(result.getDate() + 7 * steps);
  else if (period === "month") result.setMonth(result.getMonth() + steps);
  else if (period === "quarter") result.setMonth(result.getMonth() + 3 * steps);
  else result.setFullYear(result.getFullYear() + steps);
  return result;
}

export function aggregateRideStatsInRange(
  sessions: StoredRideSession[],
  start: Date,
  endExclusive: Date,
): AggregatedRideStats {
  const t0 = start.getTime();
  const t1 = endExclusive.getTime();
  const filtered = sessions.filter((s) => {
    const t = new Date(s.endedAt).getTime();
    return !Number.isNaN(t) && t >= t0 && t < t1;
  });
  let distanceMeters = 0;
  let elapsedSec = 0;
  let caloriesEstimate = 0;
  let caloriesUnknownCount = 0;
  for (const s of filtered) {
    distanceMeters += s.distanceMeters;
    elapsedSec += s.elapsedSec;
    if (s.caloriesEstimate == null) {
      caloriesUnknownCount += 1;
    } else {
      const v = Number(s.caloriesEstimate);
      if (Number.isFinite(v) && v >= 0) caloriesEstimate += v;
    }
  }
  const rides = filtered.length;
  const avgSpeedKmh =
    elapsedSec > 0 ? (distanceMeters / 1000) / (elapsedSec / 3600) : 0;
  return {
    rides,
    distanceMeters,
    elapsedSec,
    caloriesEstimate,
    caloriesUnknownCount,
    avgSpeedKmh,
  };
}

export function aggregateRideStatsForPeriod(
  sessions: StoredRideSession[],
  period: RideStatsPeriod,
  now: Date = new Date(),
): { stats: AggregatedRideStats; range: PeriodRange } {
  const range = getRideStatsPeriodRange(period, now);
  const stats = aggregateRideStatsInRange(sessions, range.start, range.endExclusive);
  return { stats, range };
}

/** 통계·마지막 주행 — 폐기 기준과 동일하게 유효 Ride 만 남긴다 */
export function filterValidRideSessions(sessions: StoredRideSession[]): StoredRideSession[] {
  return sessions.filter((s) => !isDiscardableRideRecord(s.distanceMeters, s.elapsedSec, s.intervalWorkouts));
}

export function getLocalDayRange(now: Date = new Date()): PeriodRange {
  const start = startOfDayLocal(now);
  const endExclusive = endOfDayExclusiveLocal(now);
  return {
    start,
    endExclusive,
    labelKo: `${formatKoShort(start)} (오늘)`,
  };
}

/** endedAt 최신 유효 Ride 1건 — 없으면 null */
export function pickLastRide(sessions: StoredRideSession[]): StoredRideSession | null {
  let best: StoredRideSession | null = null;
  let bestTime = -Infinity;
  for (const s of filterValidRideSessions(sessions)) {
    const t = new Date(s.endedAt).getTime();
    if (Number.isNaN(t)) continue;
    if (t > bestTime) {
      bestTime = t;
      best = s;
    }
  }
  return best;
}

/** 기기 로컬 달력 오늘 00:00 ~ 내일 00:00 집계 */
export function aggregateRideStatsForLocalDay(
  sessions: StoredRideSession[],
  now: Date = new Date(),
): { stats: AggregatedRideStats; range: PeriodRange } {
  const range = getLocalDayRange(now);
  const stats = aggregateRideStatsInRange(sessions, range.start, range.endExclusive);
  return { stats, range };
}

type IntervalWorkoutStats = {
  started: number;
  completed: number;
  elapsedSec: number;
  activeSec: number;
  activeUnknownCount: number;
  caloriesEstimate: number;
  caloriesUnknownCount: number;
  signalGapCount: number;
  activityDays: number;
  unclassifiedRideCount: number;
  intensitySeconds: Record<IntervalWorkoutRecord["intensity"], number>;
  entries: { key: string; endedAt: string; workout: IntervalWorkoutRecord }[];
};

/** 원본 운동 기록만 집계한다. 지역별 거리 비율로 수행 시간을 나누지 않으며 주행 종료일에 귀속한다. */
export function aggregateIntervalWorkoutStatsInRange(
  sessions: readonly StoredRideSession[],
  start: Date,
  endExclusive: Date,
): IntervalWorkoutStats {
  const stats: IntervalWorkoutStats = {
    started: 0, completed: 0, elapsedSec: 0, activeSec: 0, activeUnknownCount: 0,
    caloriesEstimate: 0, caloriesUnknownCount: 0, signalGapCount: 0, activityDays: 0,
    unclassifiedRideCount: 0, intensitySeconds: { light: 0, moderate: 0, vigorous: 0 }, entries: [],
  };
  const seenRides = new Set<string>();
  const seenWorkouts = new Set<string>();
  const days = new Set<string>();
  const t0 = start.getTime();
  const t1 = endExclusive.getTime();
  const safeSeconds = (value: number) => Number.isFinite(value) ? Math.max(0, value) : 0;
  for (const session of sessions) {
    const ended = new Date(session.endedAt);
    const time = ended.getTime();
    if (!Number.isFinite(time) || time < t0 || time >= t1) continue;
    const rideKey = session.serverRideId ?? session.id;
    if (!Array.isArray(session.intervalWorkouts)) {
      if (!seenRides.has(rideKey)) stats.unclassifiedRideCount += 1;
      seenRides.add(rideKey);
      continue;
    }
    seenRides.add(rideKey);
    for (const workout of session.intervalWorkouts) {
      const key = `${rideKey}:${workout.id}`;
      if (seenWorkouts.has(key) || safeSeconds(workout.elapsedSec) === 0) continue;
      seenWorkouts.add(key);
      stats.started += 1;
      if (workout.status === "completed") stats.completed += 1;
      const elapsedSec = safeSeconds(workout.elapsedSec);
      stats.elapsedSec += elapsedSec;
      stats.intensitySeconds[workout.intensity] += elapsedSec;
      if (workout.activeSec == null) stats.activeUnknownCount += 1;
      else stats.activeSec += Math.min(elapsedSec, safeSeconds(workout.activeSec));
      if (workout.caloriesEstimate == null) stats.caloriesUnknownCount += 1;
      else stats.caloriesEstimate += safeSeconds(workout.caloriesEstimate);
      if (workout.signalGap) stats.signalGapCount += 1;
      days.add(`${ended.getFullYear()}-${ended.getMonth()}-${ended.getDate()}`);
      stats.entries.push({ key, endedAt: session.endedAt, workout });
    }
  }
  stats.activityDays = days.size;
  stats.entries.sort((a, b) => new Date(b.endedAt).getTime() - new Date(a.endedAt).getTime()
    || b.workout.startElapsedSec - a.workout.startElapsedSec);
  return stats;
}
