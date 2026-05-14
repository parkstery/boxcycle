import type { StoredRideSession } from "./rideSessionsStorage";

export type RideStatsPeriod = "week" | "month" | "year";

export type AggregatedRideStats = {
  rides: number;
  distanceMeters: number;
  elapsedSec: number;
  caloriesEstimate: number;
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
  const start = startOfYearLocal(now);
  const endExclusive = endOfYearExclusiveLocal(now);
  return {
    start,
    endExclusive,
    labelKo: `${now.getFullYear()}년 1월 1일 ~ 12월 31일`,
  };
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
  for (const s of filtered) {
    distanceMeters += s.distanceMeters;
    elapsedSec += s.elapsedSec;
    caloriesEstimate += Number(s.caloriesEstimate ?? 0);
  }
  const rides = filtered.length;
  const avgSpeedKmh =
    elapsedSec > 0 ? (distanceMeters / 1000) / (elapsedSec / 3600) : 0;
  return { rides, distanceMeters, elapsedSec, caloriesEstimate, avgSpeedKmh };
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
