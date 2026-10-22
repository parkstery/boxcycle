/**
 * 사용자 지표 계산 코어 — CLI(`cliRideMetrics`)와 관리자 화면(`getAdminDashboard`)이 함께 쓴다.
 * - 순수 집계: `aggregateRideMetrics` (입력만으로 계산, I/O 없음)
 * - 적재: `loadAuthAccounts` · `loadRideRows` · `loadExcludedUids` · `countPendingPublicRouteRequests` (읽기 전용)
 * 좌표·이메일·uid 목록은 결과에 싣지 않는다.
 */
import { getAuth } from "firebase-admin/auth";
import {
  Timestamp,
  type Firestore,
  type Query,
  type QueryDocumentSnapshot,
} from "firebase-admin/firestore";
import {
  isDiscardableRideRecord,
  MIN_MEANINGFUL_RIDE_DISTANCE_METERS,
  MIN_MEANINGFUL_RIDE_DURATION_SEC,
} from "./rideRecordPolicy.js";

export type Cohort = "guest" | "provider";

/** Auth 계정 1건 — 코호트와 가입 시각(ms, 없으면 null). */
export type AccountInfo = {
  cohort: Cohort;
  createdMs: number | null;
};

/** rides 문서에서 뽑은 원시 행. 폐기 기준 판정은 집계 함수가 한다. */
export type RideInputRow = {
  userId: string;
  /** endedAt ?? createdAt (ms). 읽을 수 없으면 null. */
  ms: number | null;
  distanceMeters: number;
  elapsedSec: number;
  newMeters: number;
};

type RideRow = {
  ms: number;
  day: string;
  distanceMeters: number;
  newMeters: number;
};

type UserAgg = {
  cohort: Cohort;
  rides: RideRow[];
};

export type CohortSummary = {
  accounts: number;
  accountsWithValidRide: number;
  firstRideCompletionRatePct: number | null;
  secondRideWithin72hRatePct: number | null;
  otherDayReuseRatePct: number | null;
  newRoadClaimRatio: number | null;
  avgNewRoadKmPerRide: number | null;
  validRides: number;
  totalDistanceKm: number;
  totalNewRoadKm: number;
};

export type RecentSummary = {
  signups: number;
  rides: number;
  distanceKm: number;
};

export type RideMetricsAggregate = {
  scannedRides: number;
  discardedRides: number;
  validRides: number;
  excludedAccounts: number;
  metrics: { all: CohortSummary; guest: CohortSummary; provider: CohortSummary };
  recent: { today: RecentSummary; last7Days: RecentSummary };
};

const DAY_MS = 24 * 3600 * 1000;

export function toMillis(raw: unknown): number | null {
  if (raw instanceof Timestamp) return raw.toMillis();
  if (typeof raw === "object" && raw !== null && typeof (raw as Timestamp).toMillis === "function") {
    const ms = (raw as Timestamp).toMillis();
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof raw === "string") {
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d.getTime();
  }
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  return null;
}

/** KST 달력 날짜 YYYY-MM-DD */
export function dayKeyKst(ms: number): string {
  return new Date(ms + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

function pct(n: number, d: number): number | null {
  if (d <= 0) return null;
  return Math.round((n / d) * 1000) / 10;
}

function summarize(users: Map<string, UserAgg>, cohort: Cohort | "all"): CohortSummary {
  const list = [...users.values()].filter((u) => cohort === "all" || u.cohort === cohort);
  const withRide = list.filter((u) => u.rides.length >= 1);
  const accountN = list.length;
  const firstComplete = withRide.length;

  let secondIn72h = 0;
  let otherDayReuse = 0;
  let totalDist = 0;
  let totalNew = 0;
  let rideCount = 0;

  for (const u of withRide) {
    const sorted = [...u.rides].sort((a, b) => a.ms - b.ms);
    const first = sorted[0]!;
    const second = sorted[1];
    if (second && second.ms - first.ms <= 72 * 3600 * 1000) secondIn72h += 1;
    if (sorted.some((r) => r.day !== first.day)) otherDayReuse += 1;
    for (const r of sorted) {
      totalDist += r.distanceMeters;
      totalNew += r.newMeters;
      rideCount += 1;
    }
  }

  return {
    accounts: accountN,
    accountsWithValidRide: firstComplete,
    firstRideCompletionRatePct: pct(firstComplete, accountN),
    secondRideWithin72hRatePct: pct(secondIn72h, firstComplete),
    otherDayReuseRatePct: pct(otherDayReuse, firstComplete),
    newRoadClaimRatio: totalDist > 0 ? Math.round((totalNew / totalDist) * 1000) / 1000 : null,
    avgNewRoadKmPerRide:
      rideCount > 0 ? Math.round((totalNew / rideCount / 1000) * 1000) / 1000 : null,
    validRides: rideCount,
    totalDistanceKm: Math.round((totalDist / 1000) * 10) / 10,
    totalNewRoadKm: Math.round((totalNew / 1000) * 10) / 10,
  };
}

/**
 * 순수 집계.
 * @param accounts Auth 계정(uid → 코호트·가입 시각)
 * @param rides rides 원시 행(userId 가 빈 행은 적재 단계에서 이미 뺀다)
 * @param excludeUids 내부 계정 — metrics·recent 모두에서 뺀다
 * @param nowMs 기준 시각(오늘·최근 7일 = KST 날짜 경계)
 * @param scannedRides 적재가 읽은 rides 문서 수(CLI 출력용). 생략하면 rides.length.
 */
export function aggregateRideMetrics(input: {
  accounts: Map<string, AccountInfo>;
  rides: RideInputRow[];
  excludeUids: ReadonlySet<string>;
  nowMs: number;
  scannedRides?: number;
}): RideMetricsAggregate {
  const { accounts, rides, excludeUids, nowMs } = input;

  const users = new Map<string, UserAgg>();
  let excludedAccounts = 0;
  for (const [uid, info] of accounts) {
    if (excludeUids.has(uid)) {
      excludedAccounts += 1;
      continue;
    }
    users.set(uid, { cohort: info.cohort, rides: [] });
  }

  let discarded = 0;
  let valid = 0;
  for (const r of rides) {
    if (isDiscardableRideRecord(r.distanceMeters, r.elapsedSec)) {
      discarded += 1;
      continue;
    }
    if (r.ms == null) continue;
    valid += 1;
    if (excludeUids.has(r.userId)) continue;
    if (!users.has(r.userId)) {
      // Auth 에 없는 uid(이미 삭제된 게스트 등) — provider 로 넣지 않고 guest 로 집계
      users.set(r.userId, { cohort: "guest", rides: [] });
    }
    users.get(r.userId)!.rides.push({
      ms: r.ms,
      day: dayKeyKst(r.ms),
      distanceMeters: r.distanceMeters,
      newMeters: Math.max(0, Number(r.newMeters) || 0),
    });
  }

  const todayKey = dayKeyKst(nowMs);
  const weekStartKey = dayKeyKst(nowMs - 6 * DAY_MS);
  const acc = {
    today: { signups: 0, rides: 0, meters: 0 },
    last7Days: { signups: 0, rides: 0, meters: 0 },
  };
  for (const [uid, info] of accounts) {
    if (excludeUids.has(uid) || info.createdMs == null) continue;
    const k = dayKeyKst(info.createdMs);
    if (k === todayKey) acc.today.signups += 1;
    if (k >= weekStartKey && k <= todayKey) acc.last7Days.signups += 1;
  }
  for (const u of users.values()) {
    for (const r of u.rides) {
      if (r.day === todayKey) {
        acc.today.rides += 1;
        acc.today.meters += r.distanceMeters;
      }
      if (r.day >= weekStartKey && r.day <= todayKey) {
        acc.last7Days.rides += 1;
        acc.last7Days.meters += r.distanceMeters;
      }
    }
  }
  const toRecent = (a: { signups: number; rides: number; meters: number }): RecentSummary => ({
    signups: a.signups,
    rides: a.rides,
    distanceKm: Math.round((a.meters / 1000) * 10) / 10,
  });

  return {
    scannedRides: input.scannedRides ?? rides.length,
    discardedRides: discarded,
    validRides: valid,
    excludedAccounts,
    metrics: {
      all: summarize(users, "all"),
      guest: summarize(users, "guest"),
      provider: summarize(users, "provider"),
    },
    recent: { today: toRecent(acc.today), last7Days: toRecent(acc.last7Days) },
  };
}

type DashboardCohortMetrics = Pick<
  CohortSummary,
  | "accounts"
  | "accountsWithValidRide"
  | "firstRideCompletionRatePct"
  | "secondRideWithin72hRatePct"
  | "otherDayReuseRatePct"
  | "newRoadClaimRatio"
  | "validRides"
  | "totalDistanceKm"
>;

export type AdminDashboardPayload = {
  generatedAt: string;
  excludedAccounts: number;
  rule: { minRideDistanceMeters: number; minRideDurationSec: number };
  metrics: {
    all: DashboardCohortMetrics;
    guest: DashboardCohortMetrics;
    provider: DashboardCohortMetrics;
  };
  recent: { today: RecentSummary; last7Days: RecentSummary };
  health: { pendingPublicRouteRequests: number };
};

function pickDashboardMetrics(s: CohortSummary): DashboardCohortMetrics {
  return {
    accounts: s.accounts,
    accountsWithValidRide: s.accountsWithValidRide,
    firstRideCompletionRatePct: s.firstRideCompletionRatePct,
    secondRideWithin72hRatePct: s.secondRideWithin72hRatePct,
    otherDayReuseRatePct: s.otherDayReuseRatePct,
    newRoadClaimRatio: s.newRoadClaimRatio,
    validRides: s.validRides,
    totalDistanceKm: s.totalDistanceKm,
  };
}

/** 계약(01-plan.md)의 200 응답 본문을 만든다. */
export function buildAdminDashboardPayload(
  agg: RideMetricsAggregate,
  nowMs: number,
  pendingPublicRouteRequests: number,
): AdminDashboardPayload {
  return {
    generatedAt: new Date(nowMs).toISOString(),
    excludedAccounts: agg.excludedAccounts,
    rule: {
      minRideDistanceMeters: MIN_MEANINGFUL_RIDE_DISTANCE_METERS,
      minRideDurationSec: MIN_MEANINGFUL_RIDE_DURATION_SEC,
    },
    metrics: {
      all: pickDashboardMetrics(agg.metrics.all),
      guest: pickDashboardMetrics(agg.metrics.guest),
      provider: pickDashboardMetrics(agg.metrics.provider),
    },
    recent: agg.recent,
    health: { pendingPublicRouteRequests },
  };
}

// ---------------------------------------------------------------------------
// 적재 (읽기 전용)
// ---------------------------------------------------------------------------

export async function loadAuthAccounts(): Promise<Map<string, AccountInfo>> {
  const auth = getAuth();
  const out = new Map<string, AccountInfo>();
  let pageToken: string | undefined;
  do {
    const page = await auth.listUsers(1000, pageToken);
    for (const u of page.users) {
      const isGuest = u.providerData.length === 0 || u.providerData.every((p) => p.providerId === "anonymous");
      out.set(u.uid, {
        cohort: isGuest ? "guest" : "provider",
        createdMs: toMillis(u.metadata.creationTime),
      });
    }
    pageToken = page.pageToken;
  } while (pageToken);
  return out;
}

/** rides 전량 스캔(페이지). 인덱스 없이 createdAt 정렬 실패 시 문서 id 순. */
export async function loadRideRows(
  db: Firestore,
): Promise<{ rows: RideInputRow[]; scanned: number }> {
  const rows: RideInputRow[] = [];
  let scanned = 0;
  const pageSize = 500;
  let lastDoc: QueryDocumentSnapshot | null = null;

  for (;;) {
    let q: Query = db.collection("rides").orderBy("createdAt", "asc").limit(pageSize);
    if (lastDoc) q = q.startAfter(lastDoc);
    let snap;
    try {
      snap = await q.get();
    } catch {
      // createdAt 인덱스 없으면 비정렬 페이지
      let q2: Query = db.collection("rides").limit(pageSize);
      if (lastDoc) q2 = q2.startAfter(lastDoc);
      snap = await q2.get();
    }
    if (snap.empty) break;
    for (const d of snap.docs) {
      scanned += 1;
      const data = d.data() as Record<string, unknown>;
      const userId = typeof data.userId === "string" ? data.userId : "";
      if (!userId) continue;
      const conquest = data.conquestResult as Record<string, unknown> | undefined;
      rows.push({
        userId,
        ms: toMillis(data.endedAt) ?? toMillis(data.createdAt),
        distanceMeters: Number(data.distanceMeters),
        elapsedSec: Number(data.elapsedSec),
        newMeters: Math.max(0, Number(conquest?.newMeters) || 0),
      });
    }
    lastDoc = snap.docs[snap.docs.length - 1]!;
    if (snap.size < pageSize) break;
  }
  return { rows, scanned };
}

function uidsOf(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string" && x.length > 0) : [];
}

/** 내부 계정 = `config/routeReviewers.uids` ∪ `config/adminDashboard.excludeUids` (문서가 없으면 빈 목록). */
export async function loadExcludedUids(db: Firestore): Promise<Set<string>> {
  const [reviewers, extra] = await Promise.all([
    db.doc("config/routeReviewers").get(),
    db.doc("config/adminDashboard").get(),
  ]);
  return new Set([
    ...uidsOf(reviewers.exists ? reviewers.data()?.uids : undefined),
    ...uidsOf(extra.exists ? extra.data()?.excludeUids : undefined),
  ]);
}

export async function countPendingPublicRouteRequests(db: Firestore): Promise<number> {
  const snap = await db
    .collection("publicRouteRequests")
    .where("status", "==", "pending")
    .count()
    .get();
  return snap.data().count;
}
