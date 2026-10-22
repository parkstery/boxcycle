/**
 * 리더보드 집계 코어 — `getLeaderboard`(leaderboard.ts)가 쓴다. 계약: document/ops/20261023-leaderboard/01-plan.md.
 * - 순수 집계: `computeBoardSnapshot`(전체 순위 재료) · `layoutLeaderboard` · `renderLeaderboard` · `buildLeaderboardResponse`
 * - 적재(읽기 전용): `loadLeaderboardRideRows` · `loadMemberUids` · `loadPublicationOwners` · `loadNicknames` · `loadLiveTrails`
 * - 캐시: `leaderboardCache/{board}_{period}` 5분 (규칙에 match 가 없어 클라이언트는 읽을 수 없다)
 * 응답에는 uid 를 싣지 않는다(닉네임만). uid 는 스냅샷·캐시 안에서만 쓴다.
 */
import { getAuth } from "firebase-admin/auth";
import {
  Timestamp,
  type Firestore,
  type Query,
  type QueryDocumentSnapshot,
} from "firebase-admin/firestore";
import { toMillis } from "./rideMetricsCore.js";

export type LeaderboardBoard = "distance" | "pioneer";
export type LeaderboardPeriod = "week" | "month" | "all";

export const LEADERBOARD_BOARDS: readonly LeaderboardBoard[] = ["distance", "pioneer"];
export const LEADERBOARD_PERIODS: readonly LeaderboardPeriod[] = ["week", "month", "all"];

export const LEADERBOARD_CACHE_COLLECTION = "leaderboardCache";
export const LEADERBOARD_CACHE_TTL_MS = 5 * 60 * 1000;
export const LEADERBOARD_LIVE_WINDOW_MS = 30 * 1000;
export const LEADERBOARD_TOP_N = 10;
const AROUND_SPAN = 2;
const FALLBACK_NICKNAME = "라이더";

const HOUR_MS = 3600 * 1000;
const DAY_MS = 24 * HOUR_MS;
const KST_OFFSET_MS = 9 * HOUR_MS;

/** rides 문서에서 뽑은 원시 행. t1 판정·기간 판정은 집계 함수가 한다. */
export type LeaderboardRideRow = {
  uid: string;
  endedAtMs: number | null;
  distanceMeters: number;
  newMeters: number;
  /** `conquestResult.tier` — 아직 트리거가 안 돌았거나 없으면 null */
  tier: string | null;
  publicationId: string | null;
};

export type BoardEntry = { uid: string; meters: number; member: boolean };

/** 캐시에 저장되는 전체 순위 재료(uid 포함 — 응답으로는 나가지 않는다). */
export type BoardSnapshot = {
  board: LeaderboardBoard;
  period: LeaderboardPeriod;
  /** 기간 시작 KST 날짜(YYYY-MM-DD). `all` 은 null. */
  periodStartKst: string | null;
  generatedAtMs: number;
  /** 기간 안 t1 값이 0 보다 큰 모든 계정(게스트 포함 — 예상 순위 계산용). */
  entries: BoardEntry[];
  /** pioneer 만: 개척자 uid → 그 사람의 퍼블릭을 다른 사람이 기간 안에 달린 사람 수·거리(m). */
  uses: Record<string, { riders: number; meters: number }>;
};

export type LeaderboardRow = {
  rank: number;
  nickname: string;
  valueKm: number;
  uses: null;
  liveTrailId: string | null;
  isMe: boolean;
};

export type LeaderboardResponse = {
  generatedAt: string;
  board: LeaderboardBoard;
  period: LeaderboardPeriod;
  scope: "world";
  periodStartKst: string | null;
  rule: { sensorOnly: true };
  top: LeaderboardRow[];
  me: {
    status: "ranked" | "unranked" | "guest";
    rank: number | null;
    valueKm: number;
    gapToNextKm: number | null;
    projectedRank: number | null;
    uses: { riders: number; km: number } | null;
    around: LeaderboardRow[];
  };
};

// ---------------------------------------------------------------------------
// 기간 경계 (KST)
// ---------------------------------------------------------------------------

/** 기간 시작 시각(UTC ms). `all` 은 null. 주 = 월요일 00:00 KST, 월 = 1일 00:00 KST. */
export function periodStartMs(period: LeaderboardPeriod, nowMs: number): number | null {
  if (period === "all") return null;
  const kst = new Date(nowMs + KST_OFFSET_MS);
  if (period === "month") {
    return Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), 1) - KST_OFFSET_MS;
  }
  const dayStartKst = Math.floor((nowMs + KST_OFFSET_MS) / DAY_MS) * DAY_MS;
  const sinceMonday = (kst.getUTCDay() + 6) % 7;
  return dayStartKst - sinceMonday * DAY_MS - KST_OFFSET_MS;
}

function kstDateKey(ms: number): string {
  return new Date(ms + KST_OFFSET_MS).toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// 순수 집계
// ---------------------------------------------------------------------------

function finiteNonNegative(n: unknown): number {
  const v = Number(n);
  return Number.isFinite(v) && v > 0 ? v : 0;
}

/**
 * 기간 안 t1 주행만 모아 계정별 값(m)과 개척 이용(uses)을 만든다. 회원 여부는 `memberUids` 로 표시만 하고 거르지 않는다.
 * @param publicationOwners 퍼블릭 id → applicantUid (탈퇴로 익명화된 퍼블릭은 빈 문자열이거나 없음)
 */
export function computeBoardSnapshot(input: {
  rows: readonly LeaderboardRideRow[];
  memberUids: ReadonlySet<string>;
  publicationOwners: ReadonlyMap<string, string>;
  board: LeaderboardBoard;
  period: LeaderboardPeriod;
  nowMs: number;
}): BoardSnapshot {
  const { board, period, nowMs } = input;
  const startMs = periodStartMs(period, nowMs);

  const totals = new Map<string, number>();
  const useRiders = new Map<string, Set<string>>();
  const useMeters = new Map<string, number>();

  for (const r of input.rows) {
    if (r.tier !== "t1" || !r.uid) continue;
    if (r.endedAtMs == null || !Number.isFinite(r.endedAtMs)) continue;
    if (startMs != null && r.endedAtMs < startMs) continue;

    const value = finiteNonNegative(board === "distance" ? r.distanceMeters : r.newMeters);
    totals.set(r.uid, (totals.get(r.uid) ?? 0) + value);

    if (board === "pioneer" && r.publicationId) {
      const owner = input.publicationOwners.get(r.publicationId);
      if (owner && owner !== r.uid) {
        let riders = useRiders.get(owner);
        if (!riders) useRiders.set(owner, (riders = new Set()));
        riders.add(r.uid);
        useMeters.set(owner, (useMeters.get(owner) ?? 0) + finiteNonNegative(r.distanceMeters));
      }
    }
  }

  const entries: BoardEntry[] = [];
  for (const [uid, meters] of totals) {
    if (meters <= 0) continue;
    entries.push({ uid, meters: Math.round(meters), member: input.memberUids.has(uid) });
  }

  const uses: BoardSnapshot["uses"] = {};
  for (const [owner, riders] of useRiders) {
    uses[owner] = { riders: riders.size, meters: Math.round(useMeters.get(owner) ?? 0) };
  }

  return {
    board,
    period,
    periodStartKst: startMs == null ? null : kstDateKey(startMs),
    generatedAtMs: nowMs,
    entries,
    uses,
  };
}

/** 표시 단위(0.1 km) 정수. 순위 비교는 표시 값 기준 — 같은 숫자로 보이면 같은 순위다. */
function tenthsOf(meters: number): number {
  return Math.round(meters / 100);
}

function kmOfTenths(tenths: number): number {
  return tenths / 10;
}

type RankedRow = { uid: string; rank: number; meters: number };

export type LeaderboardLayout = {
  snapshot: BoardSnapshot;
  top: RankedRow[];
  around: RankedRow[];
  me: LeaderboardResponse["me"];
  requesterUid: string;
  /** 닉네임을 읽어야 하는 uid (top ∪ around) */
  displayUids: string[];
};

/** 순위·내 위치·around 를 정한다(이름은 아직 없음). */
export function layoutLeaderboard(
  snapshot: BoardSnapshot,
  requester: { uid: string; isAnonymous: boolean },
): LeaderboardLayout {
  // 회원 판정: 요청자는 토큰 기준(방금 회원 등록한 경우 캐시보다 정확), 나머지는 캐시의 표시.
  const isMember = (e: BoardEntry): boolean =>
    e.uid === requester.uid ? !requester.isAnonymous : e.member;

  const members = snapshot.entries
    .filter(isMember)
    .map((e) => ({ uid: e.uid, meters: e.meters, tenths: tenthsOf(e.meters) }))
    .filter((e) => e.tenths > 0)
    .sort((a, b) => b.tenths - a.tenths || b.meters - a.meters || (a.uid < b.uid ? -1 : 1));

  // 1,2,2,4 — 앞에 더 큰 값이 몇 명 있는지 + 1
  const ranked: RankedRow[] = [];
  let prevTenths = -1;
  let prevRank = 0;
  members.forEach((m, i) => {
    const rank = m.tenths === prevTenths ? prevRank : i + 1;
    prevTenths = m.tenths;
    prevRank = rank;
    ranked.push({ uid: m.uid, rank, meters: m.meters });
  });

  const top = ranked.slice(0, LEADERBOARD_TOP_N);
  const myEntry = snapshot.entries.find((e) => e.uid === requester.uid);
  const myMeters = myEntry?.meters ?? 0;
  const myTenths = tenthsOf(myMeters);
  const myUse = snapshot.uses[requester.uid];
  const uses =
    snapshot.board === "pioneer" && !requester.isAnonymous
      ? {
          riders: myUse?.riders ?? 0,
          km: kmOfTenths(tenthsOf(myUse?.meters ?? 0)),
        }
      : null;

  let me: LeaderboardResponse["me"];
  let around: RankedRow[] = [];

  if (requester.isAnonymous) {
    const projectedRank =
      myTenths > 0 ? 1 + members.filter((m) => m.tenths > myTenths).length : null;
    me = {
      status: "guest",
      rank: null,
      valueKm: kmOfTenths(myTenths),
      gapToNextKm: null,
      projectedRank,
      uses: null,
      around: [],
    };
  } else {
    const idx = ranked.findIndex((r) => r.uid === requester.uid);
    if (idx < 0) {
      me = {
        status: "unranked",
        rank: null,
        valueKm: kmOfTenths(myTenths),
        gapToNextKm: null,
        projectedRank: null,
        uses,
        around: [],
      };
    } else {
      const mine = ranked[idx]!;
      // 나보다 큰 값 중 가장 가까운 사람 = 내 동점 그룹 바로 앞 줄
      const firstOfMyGroup = ranked.findIndex((r) => r.rank === mine.rank);
      const ahead = firstOfMyGroup > 0 ? members[firstOfMyGroup - 1]! : null;
      const gap = ahead ? kmOfTenths(ahead.tenths - members[idx]!.tenths) : null;
      around = ranked
        .slice(Math.max(0, idx - AROUND_SPAN), idx + AROUND_SPAN + 1)
        .filter((r) => !top.some((t) => t.uid === r.uid));
      me = {
        status: "ranked",
        rank: mine.rank,
        valueKm: kmOfTenths(members[idx]!.tenths),
        gapToNextKm: gap,
        projectedRank: null,
        uses,
        around: [],
      };
    }
  }

  const displayUids = [...new Set([...top, ...around].map((r) => r.uid))];
  return { snapshot, top, around, me, requesterUid: requester.uid, displayUids };
}

/** 이름·라이브 정보를 붙여 계약 모양(uid 없음)으로 만든다. */
export function renderLeaderboard(
  layout: LeaderboardLayout,
  names: {
    nicknames: ReadonlyMap<string, string>;
    /** 지금 달리는 사람 uid → trailId */
    liveByUid: ReadonlyMap<string, string>;
  },
): LeaderboardResponse {
  const toRow = (r: RankedRow): LeaderboardRow => {
    const isMe = r.uid === layout.requesterUid;
    return {
      rank: r.rank,
      nickname: names.nicknames.get(r.uid)?.trim() || FALLBACK_NICKNAME,
      valueKm: kmOfTenths(tenthsOf(r.meters)),
      uses: null,
      liveTrailId: isMe ? null : (names.liveByUid.get(r.uid) ?? null),
      isMe,
    };
  };
  const { snapshot } = layout;
  return {
    generatedAt: new Date(snapshot.generatedAtMs).toISOString(),
    board: snapshot.board,
    period: snapshot.period,
    scope: "world",
    periodStartKst: snapshot.periodStartKst,
    rule: { sensorOnly: true },
    top: layout.top.map(toRow),
    me: { ...layout.me, around: layout.around.map(toRow) },
  };
}

/** 스냅샷 → 응답 (layout + render). */
export function buildLeaderboardResponse(
  snapshot: BoardSnapshot,
  requester: { uid: string; isAnonymous: boolean },
  names: {
    nicknames: ReadonlyMap<string, string>;
    liveByUid: ReadonlyMap<string, string>;
  },
): LeaderboardResponse {
  return renderLeaderboard(layoutLeaderboard(snapshot, requester), names);
}

// ---------------------------------------------------------------------------
// 캐시 문서 ↔ 스냅샷
// ---------------------------------------------------------------------------

export function leaderboardCacheDocId(board: LeaderboardBoard, period: LeaderboardPeriod): string {
  return `${board}_${period}`;
}

/** Firestore 문서에 넣을 모양(배열 안 배열 금지 → 맵 배열). */
export function snapshotToCacheData(s: BoardSnapshot): Record<string, unknown> {
  return {
    v: 1,
    board: s.board,
    period: s.period,
    periodStartKst: s.periodStartKst,
    generatedAtMs: s.generatedAtMs,
    entries: s.entries.map((e) => ({ u: e.uid, m: e.meters, g: e.member ? 1 : 0 })),
    uses: Object.fromEntries(
      Object.entries(s.uses).map(([uid, u]) => [uid, { r: u.riders, m: u.meters }]),
    ),
  };
}

/** 캐시 문서를 읽는다. 모양이 다르거나 기간이 어긋나면 null(= 다시 계산). */
export function cacheDataToSnapshot(
  data: Record<string, unknown> | undefined,
  board: LeaderboardBoard,
  period: LeaderboardPeriod,
): BoardSnapshot | null {
  if (!data || data.v !== 1 || data.board !== board || data.period !== period) return null;
  const generatedAtMs = data.generatedAtMs;
  if (typeof generatedAtMs !== "number" || !Number.isFinite(generatedAtMs)) return null;
  if (!Array.isArray(data.entries)) return null;
  const entries: BoardEntry[] = [];
  for (const raw of data.entries) {
    const e = raw as { u?: unknown; m?: unknown; g?: unknown };
    if (typeof e?.u !== "string" || typeof e.m !== "number") return null;
    entries.push({ uid: e.u, meters: e.m, member: e.g === 1 });
  }
  const uses: BoardSnapshot["uses"] = {};
  const rawUses = (data.uses ?? {}) as Record<string, { r?: unknown; m?: unknown }>;
  for (const [uid, u] of Object.entries(rawUses)) {
    if (typeof u?.r === "number" && typeof u.m === "number") uses[uid] = { riders: u.r, meters: u.m };
  }
  const periodStartKst = typeof data.periodStartKst === "string" ? data.periodStartKst : null;
  return { board, period, periodStartKst, generatedAtMs, entries, uses };
}

/** 캐시가 아직 쓸 만한가 — 5분 안이고, 기간 시작이 지금 기준과 같다(주·달이 바뀌면 버린다). */
export function isCacheFresh(s: BoardSnapshot, nowMs: number): boolean {
  if (nowMs - s.generatedAtMs < 0 || nowMs - s.generatedAtMs >= LEADERBOARD_CACHE_TTL_MS) return false;
  const startMs = periodStartMs(s.period, nowMs);
  const expected = startMs == null ? null : kstDateKey(startMs);
  return s.periodStartKst === expected;
}

// ---------------------------------------------------------------------------
// 적재 (읽기 전용)
// ---------------------------------------------------------------------------

/** 기간 하한 이후 완료 주행(인덱스 `status + endedAt`). 필요한 필드만 읽는다. */
export async function loadLeaderboardRideRows(
  db: Firestore,
  startMs: number | null,
): Promise<LeaderboardRideRow[]> {
  const rows: LeaderboardRideRow[] = [];
  const pageSize = 1000;
  let lastDoc: QueryDocumentSnapshot | null = null;
  for (;;) {
    let q: Query = db.collection("rides").where("status", "==", "completed");
    if (startMs != null) q = q.where("endedAt", ">=", Timestamp.fromMillis(startMs));
    q = q
      .orderBy("endedAt", "asc")
      .select("userId", "endedAt", "distanceMeters", "conquestResult", "publicationId")
      .limit(pageSize);
    if (lastDoc) q = q.startAfter(lastDoc);
    const snap = await q.get();
    if (snap.empty) break;
    for (const d of snap.docs) {
      const data = d.data() as Record<string, unknown>;
      const uid = typeof data.userId === "string" ? data.userId : "";
      if (!uid) continue;
      const cr = data.conquestResult as Record<string, unknown> | undefined;
      rows.push({
        uid,
        endedAtMs: toMillis(data.endedAt),
        distanceMeters: Number(data.distanceMeters),
        newMeters: Number(cr?.newMeters),
        tier: typeof cr?.tier === "string" ? cr.tier : null,
        publicationId:
          typeof data.publicationId === "string" && data.publicationId ? data.publicationId : null,
      });
    }
    lastDoc = snap.docs[snap.docs.length - 1]!;
    if (snap.size < pageSize) break;
  }
  return rows;
}

function chunk<T>(list: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/** Auth 에서 익명이 아닌(= provider 연결된) 계정만 회원. 없는 uid(삭제된 계정)는 회원이 아니다. */
export async function loadMemberUids(uids: readonly string[]): Promise<Set<string>> {
  const auth = getAuth();
  const members = new Set<string>();
  for (const batch of chunk(uids, 100)) {
    const res = await auth.getUsers(batch.map((uid) => ({ uid })));
    for (const u of res.users) {
      const isGuest =
        u.providerData.length === 0 || u.providerData.every((p) => p.providerId === "anonymous");
      if (!isGuest) members.add(u.uid);
    }
  }
  return members;
}

/** 퍼블릭 id → applicantUid (없거나 익명화된 퍼블릭은 맵에 넣지 않는다). */
export async function loadPublicationOwners(
  db: Firestore,
  publicationIds: readonly string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (const batch of chunk(publicationIds, 300)) {
    const refs = batch.map((id) => db.collection("routePublications").doc(id));
    const docs = await db.getAll(...refs, { fieldMask: ["applicantUid"] });
    for (const d of docs) {
      const owner = d.exists ? d.get("applicantUid") : undefined;
      if (typeof owner === "string" && owner) out.set(d.id, owner);
    }
  }
  return out;
}

/** uid → 닉네임 (없으면 맵에 없음). */
export async function loadNicknames(
  db: Firestore,
  uids: readonly string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (uids.length === 0) return out;
  const docs = await db.getAll(...uids.map((uid) => db.collection("users").doc(uid)), {
    fieldMask: ["nickname"],
  });
  for (const d of docs) {
    const nick = d.exists ? d.get("nickname") : undefined;
    if (typeof nick === "string" && nick.trim()) out.set(d.id, nick);
  }
  return out;
}

/** 30초 안에 `lastSeenAt` 이 갱신된 라이브 주행 → uid → trailId. (collection group 인덱스는 fieldOverrides 에 이미 있다) */
export async function loadLiveTrails(db: Firestore, nowMs: number): Promise<Map<string, string>> {
  const cutoff = Timestamp.fromMillis(nowMs - LEADERBOARD_LIVE_WINDOW_MS);
  const snap = await db
    .collectionGroup("livePublicationRides")
    .where("lastSeenAt", ">=", cutoff)
    .select("lastSeenAt")
    .get();
  const out = new Map<string, string>();
  for (const d of snap.docs) {
    const trailId = d.ref.parent.parent?.id;
    if (trailId) out.set(d.id, trailId);
  }
  return out;
}

/** 캐시 → 없거나 낡으면 계산해 저장 → 스냅샷. 캐시 읽기·쓰기 실패는 요청을 막지 않는다. */
export async function getBoardSnapshot(
  db: Firestore,
  board: LeaderboardBoard,
  period: LeaderboardPeriod,
  nowMs: number,
  warn: (msg: string, err: unknown) => void = () => undefined,
): Promise<BoardSnapshot> {
  const ref = db.collection(LEADERBOARD_CACHE_COLLECTION).doc(leaderboardCacheDocId(board, period));
  try {
    const cached = cacheDataToSnapshot((await ref.get()).data(), board, period);
    if (cached && isCacheFresh(cached, nowMs)) return cached;
  } catch (e) {
    warn("leaderboard_cache_read_failed", e);
  }

  const rows = await loadLeaderboardRideRows(db, periodStartMs(period, nowMs));
  const startMs = periodStartMs(period, nowMs);
  const t1Uids = new Set<string>();
  const publicationIds = new Set<string>();
  for (const r of rows) {
    if (r.tier !== "t1") continue;
    if (startMs != null && (r.endedAtMs == null || r.endedAtMs < startMs)) continue;
    t1Uids.add(r.uid);
    if (board === "pioneer" && r.publicationId) publicationIds.add(r.publicationId);
  }
  const [memberUids, publicationOwners] = await Promise.all([
    loadMemberUids([...t1Uids]),
    board === "pioneer" ? loadPublicationOwners(db, [...publicationIds]) : Promise.resolve(new Map<string, string>()),
  ]);
  const snapshot = computeBoardSnapshot({ rows, memberUids, publicationOwners, board, period, nowMs });
  try {
    await ref.set(snapshotToCacheData(snapshot));
  } catch (e) {
    warn("leaderboard_cache_write_failed", e);
  }
  return snapshot;
}
