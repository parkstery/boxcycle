/**
 * 리더보드 누적 점수 — 순수 계산부. 계약: document/ops/20261103-global-geo-data/02-task-g3-leaderboard-scores.md.
 *
 * 왜 — 기존 getLeaderboard 는 캐시가 비면 기간 안 rides 를 전부 훑었다(비용 절감 L6). 이제 주행이 끝날 때
 * 사용자별 점수 문서에 더해 두고, 요청은 상위 N·내 순위만 읽는다. 순위 규칙은 leaderboardCore.ts 와 같다.
 *
 * 컬렉션(모두 클라이언트 접근 없음 — firestore.rules 에 match 없음)
 * - leaderboardScores/{board}_{periodKey}_{scopeType}_{scopeCode}_{uid}   사용자·판·기간별 누적
 * - leaderboardUses/{periodKey}_{ownerUid}                               개척판 「내 길 이용」 합계
 * - leaderboardUseMarks/{periodKey}_{ownerUid}_{riderUid}                 라이더가 처음 달릴 때만 riders +1
 * - leaderboardScoreApplied/{rideId}                                      한 주행을 두 번 더하지 않는 원장
 *
 * 인정 갈래: 센서 인정 주행(t1)은 T1·All 양쪽에, t0 는 All 에만 쌓는다. 읽을 때 LEADERBOARD_SENSOR_ONLY 에 따라
 * 한쪽을 고르므로 출시 전 true 복원이 데이터 재계산 없이 즉시 된다.
 */
import { LEADERBOARD_BOARDS, tenthsOf, type LeaderboardBoard, type LeaderboardPeriod } from "./leaderboardCore.js";

export const LEADERBOARD_SCORES_COLLECTION = "leaderboardScores";
export const LEADERBOARD_USES_COLLECTION = "leaderboardUses";
export const LEADERBOARD_USE_MARKS_COLLECTION = "leaderboardUseMarks";
export const LEADERBOARD_SCORE_APPLIED_COLLECTION = "leaderboardScoreApplied";

/** 지금은 전세계 하나. 대륙·국가·행정구역은 G3-2 에서 붙이므로 필드만 둔다. */
export const WORLD_SCOPE_TYPE = "world";
export const WORLD_SCOPE_CODE = "-";

/** `rides.timeZone` 이 없거나 잘못되면 쓰는 시간대(D11). 기존 KST 기간 경계와 같다. */
export const DEFAULT_LEADERBOARD_TIME_ZONE = "Asia/Seoul";

export type ScoreTrack = "T1" | "All";
export type ScoreScope = { scopeType: string; scopeCode: string };
export const WORLD_SCOPE: ScoreScope = { scopeType: WORLD_SCOPE_TYPE, scopeCode: WORLD_SCOPE_CODE };

// ---------------------------------------------------------------------------
// 기간 키 (W 주 · M 월 · Y 연 · all)
// ---------------------------------------------------------------------------

const formatterByTz = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let f = formatterByTz.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
    formatterByTz.set(timeZone, f);
  }
  return f;
}

/** 그 시간대의 달력 날짜. 모르는 시간대는 기본(Asia/Seoul)으로 떨어뜨린다. */
export function localYmd(ms: number, timeZone: string | null | undefined): { y: number; m: number; d: number } {
  let f: Intl.DateTimeFormat;
  try {
    f = formatterFor(timeZone?.trim() || DEFAULT_LEADERBOARD_TIME_ZONE);
  } catch {
    f = formatterFor(DEFAULT_LEADERBOARD_TIME_ZONE);
  }
  const parts = f.formatToParts(new Date(ms));
  const pick = (type: string): number => Number(parts.find((p) => p.type === type)?.value);
  return { y: pick("year"), m: pick("month"), d: pick("day") };
}

const DAY_MS = 24 * 3600 * 1000;

/** ISO 8601 주(월요일 시작, 그 주의 목요일이 속한 해가 ISO 연도). */
export function isoWeekOf(y: number, m: number, d: number): { isoYear: number; week: number } {
  const date = Date.UTC(y, m - 1, d);
  const mondayBased = (new Date(date).getUTCDay() + 6) % 7;
  const thursday = date + (3 - mondayBased) * DAY_MS;
  const isoYear = new Date(thursday).getUTCFullYear();
  const week = Math.floor((thursday - Date.UTC(isoYear, 0, 1)) / DAY_MS / 7) + 1;
  return { isoYear, week };
}

const pad2 = (n: number): string => String(n).padStart(2, "0");

export type PeriodKeys = { week: string; month: string; year: string; all: string };

/** 시각 → 네 기간 키. `W2026-43` · `M2026-10` · `Y2026` · `all`. */
export function periodKeysOf(ms: number, timeZone?: string | null): PeriodKeys {
  const { y, m, d } = localYmd(ms, timeZone);
  const { isoYear, week } = isoWeekOf(y, m, d);
  return { week: `W${isoYear}-${pad2(week)}`, month: `M${y}-${pad2(m)}`, year: `Y${y}`, all: "all" };
}

/** 읽는 쪽 — 응답 period(week·month·all) → 지금 기준 기간 키. 연(Y)은 쌓기만 하고 응답에는 아직 안 나간다(D14). */
export function periodKeyForRequest(period: LeaderboardPeriod, nowMs: number): string {
  const keys = periodKeysOf(nowMs);
  return period === "week" ? keys.week : period === "month" ? keys.month : keys.all;
}

// ---------------------------------------------------------------------------
// 문서 id
// ---------------------------------------------------------------------------

export function scoreDocId(
  board: LeaderboardBoard,
  periodKey: string,
  uid: string,
  scope: ScoreScope = WORLD_SCOPE,
): string {
  return `${board}_${periodKey}_${scope.scopeType}_${scope.scopeCode}_${uid}`;
}

export const usesDocId = (periodKey: string, ownerUid: string): string => `${periodKey}_${ownerUid}`;
export const useMarkDocId = (periodKey: string, ownerUid: string, riderUid: string): string =>
  `${periodKey}_${ownerUid}_${riderUid}`;

// ---------------------------------------------------------------------------
// 한 주행 → 어느 문서에 얼마를 더하나
// ---------------------------------------------------------------------------

export type RideScoreInput = {
  rideId: string;
  userId: string;
  endedAtMs: number | null;
  /** `rides.timeZone` — 아직 없으면 null/undefined(→ Asia/Seoul). */
  timeZone?: string | null;
  /** `conquestResult.tier` */
  tier: string | null;
  distanceMeters: number;
  /** `conquestResult.newMeters` */
  newMeters: number;
  publicationId: string | null;
  /** routePublications/{publicationId}.applicantUid — 없거나 익명화되면 null. */
  publicationOwnerUid: string | null;
};

export type ScoreIncrement = {
  docId: string;
  board: LeaderboardBoard;
  periodKey: string;
  uid: string;
  /** 센서 인정(t1) 주행일 때만 > 0 */
  addT1: number;
  addAll: number;
};

export type UseIncrement = {
  usesDocId: string;
  markDocId: string;
  periodKey: string;
  ownerUid: string;
  riderUid: string;
  /** 이 주행의 distanceMeters(개척 이용 거리 — newMeters 가 아니다) */
  meters: number;
  /** 센서 인정(t1) 주행인가 — false 면 All 갈래에만 더한다 */
  t1: boolean;
};

export type RidePlan = { scores: ScoreIncrement[]; uses: UseIncrement[] };

function finiteNonNegative(n: unknown): number {
  const v = Number(n);
  return Number.isFinite(v) && v > 0 ? v : 0;
}

/**
 * 순수 계획. 인정 대상이 아니면(tier 가 t0/t1 이 아님, 시각 없음, uid 없음) 빈 계획.
 * 값이 0 인 판은 문서를 만들지 않는다(기존 집계도 0 이하 계정은 순위에 넣지 않았다).
 * 개척 이용은 newMeters 와 무관하게 센다(기존 computeBoardSnapshot 과 같다).
 */
export function planRideScoreWrites(input: RideScoreInput, scope: ScoreScope = WORLD_SCOPE): RidePlan {
  const empty: RidePlan = { scores: [], uses: [] };
  const t1 = input.tier === "t1";
  if (!t1 && input.tier !== "t0") return empty;
  if (!input.userId) return empty;
  if (input.endedAtMs == null || !Number.isFinite(input.endedAtMs)) return empty;

  const keys = periodKeysOf(input.endedAtMs, input.timeZone);
  const periodKeys = [keys.week, keys.month, keys.year, keys.all];

  const scores: ScoreIncrement[] = [];
  for (const board of LEADERBOARD_BOARDS) {
    const value = finiteNonNegative(board === "distance" ? input.distanceMeters : input.newMeters);
    if (value <= 0) continue;
    for (const periodKey of periodKeys) {
      scores.push({
        docId: scoreDocId(board, periodKey, input.userId, scope),
        board,
        periodKey,
        uid: input.userId,
        addT1: t1 ? value : 0,
        addAll: value,
      });
    }
  }

  const uses: UseIncrement[] = [];
  const owner = input.publicationOwnerUid;
  if (input.publicationId && owner && owner !== input.userId) {
    for (const periodKey of periodKeys) {
      uses.push({
        usesDocId: usesDocId(periodKey, owner),
        markDocId: useMarkDocId(periodKey, owner, input.userId),
        periodKey,
        ownerUid: owner,
        riderUid: input.userId,
        meters: finiteNonNegative(input.distanceMeters),
        t1,
      });
    }
  }
  return { scores, uses };
}

// ---------------------------------------------------------------------------
// 증분 적용 (기존 문서 + 증분 → 새 문서 데이터). updatedAt 은 호출 측이 붙인다.
// ---------------------------------------------------------------------------

export type ScoreDocData = {
  board: LeaderboardBoard;
  periodKey: string;
  scopeType: string;
  scopeCode: string;
  uid: string;
  member: boolean;
  /** 정수로 반올림하기 전 합 — 증분을 정확히 쌓기 위한 원본 */
  metersT1: number;
  metersAll: number;
  /** Math.round(meters) — 기존 집계가 합을 한 번 반올림해 meters 로 썼으므로 정렬은 이 값으로 한다 */
  roundedT1: number;
  roundedAll: number;
  tenthsT1: number;
  tenthsAll: number;
};

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

export function applyScoreIncrement(
  prev: Record<string, unknown> | undefined,
  inc: ScoreIncrement,
  member: boolean,
  scope: ScoreScope = WORLD_SCOPE,
): ScoreDocData {
  const metersT1 = num(prev?.metersT1) + inc.addT1;
  const metersAll = num(prev?.metersAll) + inc.addAll;
  const roundedT1 = Math.round(metersT1);
  const roundedAll = Math.round(metersAll);
  return {
    board: inc.board,
    periodKey: inc.periodKey,
    scopeType: scope.scopeType,
    scopeCode: scope.scopeCode,
    uid: inc.uid,
    member,
    metersT1,
    metersAll,
    roundedT1,
    roundedAll,
    tenthsT1: tenthsOf(roundedT1),
    tenthsAll: tenthsOf(roundedAll),
  };
}

export type UsesDocData = {
  periodKey: string;
  ownerUid: string;
  ridersT1: number;
  metersT1: number;
  ridersAll: number;
  metersAll: number;
};

export type UseMarkDocData = { periodKey: string; ownerUid: string; riderUid: string; t1: boolean; all: boolean };

/** 표식은 처음 생길 때만 riders +1 — 갈래(T1·All)마다 따로 본다. meters 는 매 주행 더한다. */
export function applyUseIncrement(
  prevUses: Record<string, unknown> | undefined,
  prevMark: Record<string, unknown> | undefined,
  inc: UseIncrement,
): { uses: UsesDocData; mark: UseMarkDocData } {
  const hadT1 = prevMark?.t1 === true;
  const hadAll = prevMark?.all === true;
  const uses: UsesDocData = {
    periodKey: inc.periodKey,
    ownerUid: inc.ownerUid,
    ridersT1: num(prevUses?.ridersT1) + (inc.t1 && !hadT1 ? 1 : 0),
    metersT1: num(prevUses?.metersT1) + (inc.t1 ? inc.meters : 0),
    ridersAll: num(prevUses?.ridersAll) + (hadAll ? 0 : 1),
    metersAll: num(prevUses?.metersAll) + inc.meters,
  };
  const mark: UseMarkDocData = {
    periodKey: inc.periodKey,
    ownerUid: inc.ownerUid,
    riderUid: inc.riderUid,
    t1: hadT1 || inc.t1,
    all: true,
  };
  return { uses, mark };
}

// ---------------------------------------------------------------------------
// 읽기 쪽 필드 이름
// ---------------------------------------------------------------------------

export function trackOf(sensorOnly: boolean): ScoreTrack {
  return sensorOnly ? "T1" : "All";
}

export const tenthsField = (track: ScoreTrack): `tenths${ScoreTrack}` => `tenths${track}`;
export const roundedField = (track: ScoreTrack): `rounded${ScoreTrack}` => `rounded${track}`;
