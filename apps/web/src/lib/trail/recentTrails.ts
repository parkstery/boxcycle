/**
 * 「최근 내가 달린 Trail」 과 Trail 별 내 진행(2026-11-05 Chief D4·D5,
 * [묶음](../../../../../document/ops/20261105-trail-lifecycle/README.md)).
 *
 * **기기 안에만 둔다(사용자별 localStorage).** 나에게만 보이고 10분짜리 창구라 서버 문서가 필요 없다.
 * Trail 참가자 문서(`trails/{id}/members/{uid}`)는 presence 라 나갈 때 지워지므로 진행을 담을 수 없다.
 *
 * - 목록: 나온 뒤 {@link RECENT_TRAIL_GRACE_MS}(10분) 동안 보인다.
 * - 진행: {@link TRAIL_PROGRESS_KEEP_MS}(24시간) 동안 이어 달리기에 쓴다(지금 달리는 목록에서 다시 들어와도).
 * - 공개 Trail 만 적는다(비공개 = 내 경로 혼자 주행, 기존 「이어 달리기」 흐름이 따로 있다).
 */

export const RECENT_TRAIL_GRACE_MS = 600_000;
export const TRAIL_PROGRESS_KEEP_MS = 86_400_000;
const MAX_ENTRIES = 20;
const STORAGE_PREFIX = "rtw.recentTrails.v1.";

export type RecentTrailEntry = {
  trailId: string;
  displayNumber: number | null;
  regionLabel: string | null;
  distanceKm: number | null;
  publicationId: string | null;
  /** 경로상 내 위치(m) — 이어 달리기 시작점 */
  progressMeters: number;
  routeMeters: number;
  completed: boolean;
  /** 마지막으로 달린(종료) 시각 */
  lastRideAtMs: number;
  /** Trail 에서 나온 시각. 아직 안에 있으면 null */
  leftAtMs: number | null;
};

export type RecentTrailMeta = Pick<RecentTrailEntry, "trailId" | "displayNumber" | "regionLabel" | "distanceKm" | "publicationId">;

/** 완주 판정 — 결과 창의 완주 기준(0.98)과 같다 */
const COMPLETED_RATIO = 0.98;

function storage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function parseRecentTrails(raw: string | null): RecentTrailEntry[] {
  if (!raw) return [];
  try {
    const v: unknown = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    return v.filter(
      (e): e is RecentTrailEntry =>
        e != null && typeof e === "object" && typeof (e as RecentTrailEntry).trailId === "string" &&
        typeof (e as RecentTrailEntry).progressMeters === "number" && typeof (e as RecentTrailEntry).lastRideAtMs === "number",
    );
  } catch {
    return [];
  }
}

export function loadRecentTrails(uid: string): RecentTrailEntry[] {
  return parseRecentTrails(storage()?.getItem(STORAGE_PREFIX + uid) ?? null);
}

function saveRecentTrails(uid: string, entries: RecentTrailEntry[]): void {
  try {
    storage()?.setItem(STORAGE_PREFIX + uid, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
  } catch {
    /* 저장 실패(사생활 모드 등) — 최근 목록·이어 달리기만 빠진다 */
  }
}

/** 순수: 주행 종료 시 진행 반영(맨 앞으로) — 오래된 것은 버린다 */
export function withRideProgress(
  entries: RecentTrailEntry[],
  meta: RecentTrailMeta,
  progressMeters: number,
  routeMeters: number,
  nowMs: number,
): RecentTrailEntry[] {
  const p = Math.max(0, Number.isFinite(progressMeters) ? progressMeters : 0);
  const r = Math.max(0, Number.isFinite(routeMeters) ? routeMeters : 0);
  const prev = entries.find((e) => e.trailId === meta.trailId);
  const completed = (r > 0 && p >= r * COMPLETED_RATIO) || Boolean(prev?.completed && p <= 0);
  const next: RecentTrailEntry = {
    ...meta,
    progressMeters: completed ? r : p,
    routeMeters: r,
    completed,
    lastRideAtMs: nowMs,
    leftAtMs: null,
  };
  return [next, ...entries.filter((e) => e.trailId !== meta.trailId)].filter(
    (e) => nowMs - e.lastRideAtMs <= TRAIL_PROGRESS_KEEP_MS,
  );
}

/** 순수: Trail 에서 나온 시각 기록(그 Trail 에서 달린 적이 있을 때만) */
export function withTrailLeft(entries: RecentTrailEntry[], trailId: string, nowMs: number): RecentTrailEntry[] {
  return entries.map((e) => (e.trailId === trailId && e.leftAtMs == null ? { ...e, leftAtMs: nowMs } : e));
}

/** 순수: 「최근 내가 달린 Trail」 — 나온 지 10분 안, 지금 있는 Trail·지금 달리는 목록에 있는 Trail 은 뺀다 */
export function visibleRecentTrails(
  entries: RecentTrailEntry[],
  nowMs: number,
  exclude: ReadonlySet<string>,
): Array<RecentTrailEntry & { remainingMs: number }> {
  return entries
    .filter((e) => e.leftAtMs != null && !exclude.has(e.trailId))
    .map((e) => ({ ...e, remainingMs: RECENT_TRAIL_GRACE_MS - (nowMs - (e.leftAtMs as number)) }))
    .filter((e) => e.remainingMs > 0)
    .sort((a, b) => b.remainingMs - a.remainingMs);
}

/** 순수: 이어 달리기 후보 — 24시간 안 진행 */
export function trailProgressFor(entries: RecentTrailEntry[], trailId: string, nowMs: number): RecentTrailEntry | null {
  const e = entries.find((x) => x.trailId === trailId);
  if (!e || nowMs - e.lastRideAtMs > TRAIL_PROGRESS_KEEP_MS) return null;
  return e;
}

export function recordTrailRideProgress(uid: string, meta: RecentTrailMeta, progressMeters: number, routeMeters: number, nowMs = Date.now()): void {
  saveRecentTrails(uid, withRideProgress(loadRecentTrails(uid), meta, progressMeters, routeMeters, nowMs));
}

export function recordTrailLeft(uid: string, trailId: string, nowMs = Date.now()): void {
  const entries = loadRecentTrails(uid);
  if (!entries.some((e) => e.trailId === trailId)) return;
  saveRecentTrails(uid, withTrailLeft(entries, trailId, nowMs));
}

/** 「7분 남음」 — 올림(0분 남음은 보이지 않게) */
export function formatRemainingMinutes(remainingMs: number): string {
  return `${Math.max(1, Math.ceil(remainingMs / 60_000))}분 남음`;
}
