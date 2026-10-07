import { isDiscardableRideRecord } from "./rideRecordPolicy";
import { rideSessionFingerprint, type StoredRideSession } from "./rideSessionsStorage";

/**
 * 주행 스토리 — 주행 기록의 사실을 사람의 노력을 알아주는 한두 문장으로 건넨다.
 * 원칙·문장 견본 SoT: document/reference/product/261007-RTW-주행-스토리-원칙.md
 *
 * > Claim 은 도로를 인정하고, 스토리는 사람의 노력을 인정한다.
 *
 * 여기는 순수 함수만 둔다(N10) — 기록과 시각을 받아 문장을 돌려준다. 화면은 그리기만 한다.
 * 문장을 바꿀 땐 원칙 문서 §5 를 먼저 고친다(C6).
 */

export type RideStoryFacts = {
  /** 이번 주행 거리(세션) */
  thisRideMeters: number;
  /** 경로 전체 거리. 경로 없이 달렸으면 0 */
  routeMeters: number;
  /** 이번 주행 전 경로 진행률 0..1 */
  previousProgressRatio: number;
  /** 이번 주행을 마친 뒤 경로 진행률 0..1 */
  progressRatio: number;
  routeCompleted: boolean;
  /** 오늘(기기 로컬 달력) 유효 주행 수 — 이번 주행 포함 */
  todayRides: number;
  /** 오늘 유효 주행 거리 합 — 이번 주행 포함 */
  todayMeters: number;
  /** 오늘까지 이어진 연속 주행 일수(오늘 포함, 최소 1) */
  streakDays: number;
  /** 이번 주행 전까지의 유효 주행 수 */
  previousRides: number;
  /** 직전 유효 주행에서 이번 주행까지 쉰 날 수(달력 기준). 직전 주행이 없으면 null */
  daysSincePreviousRide: number | null;
  /** 지난 주행 거리의 중앙값(최근 30회) — 5건 미만이면 null(N3) */
  typicalMeters: number | null;
};

/** 헤드라인 문형 — 원칙 문서 §5 M3 우선순위 표의 행 */
export type RideStoryKind =
  | "completed"
  | "first"
  | "comeback"
  | "halfway"
  | "streak"
  | "todayAgain"
  | "farther"
  | "default";

export type RideStory = {
  kind: RideStoryKind;
  /** 따뜻한 한 줄 — 칭찬·인정 */
  headline: string;
  /** 사실 한 줄 — 경로 진행, 오늘 합계. 말할 것이 없으면 null */
  detail: string | null;
};

/** 복귀 기준 — 7일 이상 쉬고 다시(C7). 공백 길이는 말하지 않는다(N4) */
export const RIDE_STORY_COMEBACK_DAYS = 7;
/** 「평소」를 말하려면 본인 기록이 이만큼은 있어야 한다(N3) */
export const RIDE_STORY_TYPICAL_MIN_SAMPLES = 5;
const TYPICAL_WINDOW = 30;
const STREAK_MIN_DAYS = 3;
const FARTHER_RATIO = 1.25;

const ORDINALS = ["첫", "두", "세", "네", "다섯", "여섯", "일곱", "여덟", "아홉", "열"];

/** 1 → 「첫 번째」, 2 → 「두 번째」 … 11 이상은 「11번째」 */
export function koreanOrdinal(n: number): string {
  return n >= 1 && n <= ORDINALS.length ? `${ORDINALS[n - 1]!} 번째` : `${n}번째`;
}

/** 100km 미만은 소수 한 자리 */
export function formatStoryKm(meters: number): string {
  const km = Math.max(0, meters) / 1000;
  return `${km < 100 ? km.toFixed(1) : km.toFixed(0)}km`;
}

function localDayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function localDayStartMs(d: Date): number {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

/**
 * 기록 + 이번 주행 → 스토리 사실.
 *
 * 사실이 틀리면 칭찬이 거짓말이 된다(§4). 이번 주행은 기록 안에 로컬 id·서버 id·지문
 * (끝난 시각+거리) 어느 모습으로든 들어 있을 수 있어 셋 다로 뺀다. 지난 기록끼리도
 * 지문이 같으면 한 번만 센다.
 */
export function buildRideStoryFacts(input: {
  sessions: readonly StoredRideSession[];
  thisRide: {
    id: string;
    serverRideId?: string | null;
    distanceMeters: number;
    endedAtIso: string;
    routeMeters: number;
    previousProgressRatio: number;
    progressRatio: number;
    routeCompleted: boolean;
  };
  now: Date;
}): RideStoryFacts {
  const { thisRide, now } = input;
  const thisFp = rideSessionFingerprint({
    endedAt: thisRide.endedAtIso,
    distanceMeters: thisRide.distanceMeters,
  });
  const thisIds = new Set([thisRide.id, thisRide.serverRideId].filter((v): v is string => !!v));

  const seen = new Set<string>();
  const past: StoredRideSession[] = [];
  for (const s of input.sessions) {
    if (isDiscardableRideRecord(s.distanceMeters, s.elapsedSec)) continue;
    if (thisIds.has(s.id) || (s.serverRideId && thisIds.has(s.serverRideId))) continue;
    const fp = rideSessionFingerprint(s);
    if (fp && fp === thisFp) continue;
    const key = fp ?? s.id;
    if (seen.has(key)) continue;
    seen.add(key);
    past.push(s);
  }

  const todayKey = localDayKey(now);
  const todayPast = past.filter((s) => localDayKey(new Date(s.endedAt)) === todayKey);

  // 연속 일수 — 오늘(이번 주행)부터 하루씩 거슬러 올라가며 주행한 날을 센다
  const days = new Set(past.map((s) => localDayKey(new Date(s.endedAt))));
  days.add(todayKey);
  let streakDays = 0;
  const cursor = new Date(now);
  cursor.setHours(12, 0, 0, 0);
  while (days.has(localDayKey(cursor))) {
    streakDays += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  const byRecent = [...past].sort((a, b) => Date.parse(b.endedAt) - Date.parse(a.endedAt));
  const last = byRecent[0];
  const daysSincePreviousRide = last
    ? Math.round((localDayStartMs(now) - localDayStartMs(new Date(last.endedAt))) / 86_400_000)
    : null;
  const recent = byRecent.slice(0, TYPICAL_WINDOW).map((s) => s.distanceMeters);

  return {
    thisRideMeters: thisRide.distanceMeters,
    routeMeters: thisRide.routeMeters,
    previousProgressRatio: thisRide.previousProgressRatio,
    progressRatio: thisRide.progressRatio,
    routeCompleted: thisRide.routeCompleted,
    todayRides: todayPast.length + 1,
    todayMeters: todayPast.reduce((sum, s) => sum + s.distanceMeters, 0) + thisRide.distanceMeters,
    streakDays,
    previousRides: past.length,
    daysSincePreviousRide,
    typicalMeters: recent.length >= RIDE_STORY_TYPICAL_MIN_SAMPLES ? median(recent) : null,
  };
}

function clamp01(v: number): number {
  return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;
}

/** §5 M3 우선순위 표 — 맞는 문형을 위에서부터 */
function headlineCandidates(f: RideStoryFacts): { kind: RideStoryKind; headline: string }[] {
  const out: { kind: RideStoryKind; headline: string }[] = [];
  const hasRoute = f.routeMeters > 0;
  if (hasRoute && f.routeCompleted) {
    out.push({ kind: "completed", headline: `${formatStoryKm(f.routeMeters)} 완주! 끝까지 해내셨어요.` });
  }
  if (f.previousRides === 0) {
    out.push({ kind: "first", headline: "첫 라이딩을 마치셨어요. 시작이 가장 어려운 법이에요." });
  }
  if (f.daysSincePreviousRide != null && f.daysSincePreviousRide >= RIDE_STORY_COMEBACK_DAYS) {
    out.push({ kind: "comeback", headline: "다시 돌아오셨어요. 반가워요." });
  }
  if (hasRoute && !f.routeCompleted && clamp01(f.previousProgressRatio) < 0.5 && clamp01(f.progressRatio) >= 0.5) {
    out.push({ kind: "halfway", headline: "경로의 절반을 넘으셨어요." });
  }
  if (f.streakDays >= STREAK_MIN_DAYS) {
    out.push({ kind: "streak", headline: `${f.streakDays}일째 페달을 밟고 계세요.` });
  }
  if (f.todayRides >= 2) {
    out.push({
      kind: "todayAgain",
      headline: `오늘 ${koreanOrdinal(f.todayRides)} 라이딩이에요. 다시 페달을 밟으셨네요.`,
    });
  }
  if (f.typicalMeters != null && f.thisRideMeters > f.typicalMeters * FARTHER_RATIO) {
    out.push({ kind: "farther", headline: "평소보다 더 멀리 달리셨어요." });
  }
  out.push({ kind: "default", headline: `오늘도 ${formatStoryKm(f.thisRideMeters)}를 달리셨어요.` });
  return out;
}

/**
 * 주행을 끝낸 순간의 스토리(M3) — 결과 시트 맨 위.
 * @param previousKind 직전 주행에서 보인 문형. 같으면 다음 순위로 넘긴다(N7).
 *   완주·첫 라이딩은 사건 자체가 다르므로 반복이어도 그대로 말한다.
 */
export function composeRideEndStory(f: RideStoryFacts, previousKind: RideStoryKind | null = null): RideStory {
  const candidates = headlineCandidates(f);
  const pick =
    candidates.find(
      (c) => c.kind !== previousKind || c.kind === "completed" || c.kind === "first" || c.kind === "default",
    ) ?? candidates[candidates.length - 1]!;

  // 사실 줄 — 해낸 것이 먼저, 남은 거리는 그 뒤(N2)
  const parts: string[] = [];
  if (f.routeMeters > 0 && !f.routeCompleted) {
    const ridden = f.routeMeters * clamp01(f.progressRatio);
    const left = f.routeMeters - ridden;
    parts.push(`${formatStoryKm(f.routeMeters)} 중 ${formatStoryKm(ridden)} · 남은 ${formatStoryKm(left)}`);
  }
  if (f.todayRides >= 2) {
    parts.push(`오늘 ${f.todayRides}번 · 합계 ${formatStoryKm(f.todayMeters)}`);
  }
  return { kind: pick.kind, headline: pick.headline, detail: parts.length ? parts.join(" · ") : null };
}
