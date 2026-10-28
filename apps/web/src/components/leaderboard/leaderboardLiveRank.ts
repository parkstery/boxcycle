/** 리더보드 실시간 순위 — 서버 `layoutLeaderboard` 와 같은 0.1 km·동점 규칙. import 없음. */

export type LeaderboardLiveRow = {
  rank: number;
  nickname: string;
  valueKm: number;
  isMe: boolean;
  liveTrailId?: string | null;
};

export type LeaderboardLiveRankResult = {
  rank: number | null;
  rows: LeaderboardLiveRow[];
  gapToNextKm: number | null;
  aheadRank: number | null;
};

function tenthsOf(km: number): number {
  return Math.round(km * 10);
}

function kmOfTenths(tenths: number): number {
  return tenths / 10;
}

/** `top` ∪ `me.around` 중복 제거(앞쪽 우선). */
export function leaderboardEntriesToLiveRows(
  top: Array<{
    rank: number;
    nickname: string;
    valueKm: number;
    isMe: boolean;
    liveTrailId?: string | null;
  }>,
  around: Array<{
    rank: number;
    nickname: string;
    valueKm: number;
    isMe: boolean;
    liveTrailId?: string | null;
  }>,
): LeaderboardLiveRow[] {
  const mapRow = (e: (typeof top)[number]): LeaderboardLiveRow => ({
    rank: e.rank,
    nickname: e.nickname,
    valueKm: e.valueKm,
    isMe: e.isMe,
    liveTrailId: e.liveTrailId ?? null,
  });
  return mergeLeaderboardLines(top.map(mapRow), around.map(mapRow));
}

export function mergeLeaderboardLines(
  top: LeaderboardLiveRow[],
  around: LeaderboardLiveRow[],
): LeaderboardLiveRow[] {
  const seen = new Set<string>();
  const out: LeaderboardLiveRow[] = [];
  for (const row of [...top, ...around]) {
    const key = `${row.rank}\0${row.nickname}\0${row.valueKm}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      rank: row.rank,
      nickname: row.nickname,
      valueKm: row.valueKm,
      isMe: row.isMe,
      liveTrailId: row.liveTrailId ?? null,
    });
  }
  return out;
}

type InternalRow = LeaderboardLiveRow & { tenths: number };

function rankRows(rows: InternalRow[]): LeaderboardLiveRow[] {
  const sorted = [...rows].sort(
    (a, b) =>
      b.tenths - a.tenths ||
      b.valueKm - a.valueKm ||
      a.nickname.localeCompare(b.nickname, "ko"),
  );
  let prevTenths = -1;
  let prevRank = 0;
  const ranked: LeaderboardLiveRow[] = [];
  sorted.forEach((m, i) => {
    const rank = m.tenths === prevTenths ? prevRank : i + 1;
    prevTenths = m.tenths;
    prevRank = rank;
    ranked.push({
      rank,
      nickname: m.nickname,
      valueKm: kmOfTenths(m.tenths),
      isMe: m.isMe,
      liveTrailId: m.liveTrailId ?? null,
    });
  });
  return ranked;
}

/**
 * @param inputRows — `top` ∪ `around` (중복 제거된 줄)
 * @param myBaseKm — 주행 시작 시점 내 주간 거리(km)
 * @param addedKm — 이번 세션에서 더할 km(서버 인정 조건에 맞는 주행만 >0 으로 넘긴다)
 */
export function computeLeaderboardLiveRank(
  inputRows: LeaderboardLiveRow[],
  myBaseKm: number,
  addedKm: number,
  visibleCount = 5,
): LeaderboardLiveRankResult {
  const myKm = myBaseKm + addedKm;
  const myTenths = tenthsOf(myKm);

  const working = inputRows.map((r) =>
    r.isMe
      ? { ...r, valueKm: myKm, tenths: myTenths }
      : { ...r, tenths: tenthsOf(r.valueKm) },
  );

  const hadMe = working.some((r) => r.isMe);
  if (!hadMe && myTenths > 0) {
    working.push({
      rank: 0,
      nickname: "나",
      valueKm: myKm,
      isMe: true,
      liveTrailId: null,
      tenths: myTenths,
    });
  }

  if (myTenths <= 0 && addedKm <= 0) {
    const meRow = working.find((r) => r.isMe);
    if (!meRow || tenthsOf(meRow.valueKm) <= 0) {
      return { rank: null, rows: [], gapToNextKm: null, aheadRank: null };
    }
  }

  const ranked = rankRows(working);
  const idx = ranked.findIndex((r) => r.isMe);
  if (idx < 0) {
    return { rank: null, rows: [], gapToNextKm: null, aheadRank: null };
  }

  const mine = ranked[idx]!;
  const firstOfMyGroup = ranked.findIndex((r) => r.rank === mine.rank);
  const ahead = firstOfMyGroup > 0 ? ranked[firstOfMyGroup - 1]! : null;
  const gapToNextKm =
    ahead != null ? kmOfTenths(tenthsOf(ahead.valueKm) - tenthsOf(mine.valueKm)) : null;
  const aheadRank = ahead != null ? ahead.rank : null;

  const count = Math.max(1, Math.floor(visibleCount));
  const start = Math.max(0, Math.min(idx - Math.floor(count / 2), ranked.length - count));
  const slice = ranked.slice(start, start + count);

  return {
    rank: mine.rank,
    rows: slice,
    gapToNextKm: mine.rank === 1 ? null : gapToNextKm,
    aheadRank: mine.rank === 1 ? null : aheadRank,
  };
}

export type RideRankChangeLine =
  | {
      kind: "member-change";
      beforeRank: number;
      afterRank: number;
      delta: number;
      gapToFirstKm: number | null;
    }
  | {
      kind: "member-same";
      rank: number;
      gapToFirstKm: number | null;
    }
  | {
      kind: "guest-projected";
      projectedRank: number;
    };

/** 주행 결과 한 줄 — 서버 인정 조건·거리·데이터를 확인한다. */
export function computeRideRankChangeLine(
  inputRows: LeaderboardLiveRow[],
  myBaseKm: number,
  sessionKm: number,
  pedalQualified: boolean,
  isGuest: boolean,
  beforeRank: number | null,
  beforeProjectedRank: number | null,
  sensorOnly = true,
): RideRankChangeLine | null {
  if ((sensorOnly && !pedalQualified) || sessionKm <= 0) return null;
  const after = computeLeaderboardLiveRank(inputRows, myBaseKm, sessionKm);
  if (isGuest) {
    const projected = after.rank ?? beforeProjectedRank;
    if (projected == null) return null;
    return { kind: "guest-projected", projectedRank: projected };
  }
  if (after.rank == null) return null;
  const gapToFirst = gapKmToFirstPlace(inputRows, myBaseKm, sessionKm);
  if (beforeRank != null && beforeRank !== after.rank) {
    return {
      kind: "member-change",
      beforeRank,
      afterRank: after.rank,
      delta: beforeRank - after.rank,
      gapToFirstKm: gapToFirst,
    };
  }
  if (beforeRank != null) {
    return { kind: "member-same", rank: after.rank, gapToFirstKm: gapToFirst };
  }
  if (after.rank != null) {
    return { kind: "member-same", rank: after.rank, gapToFirstKm: gapToFirst };
  }
  return null;
}

function gapKmToFirstPlace(
  inputRows: LeaderboardLiveRow[],
  myBaseKm: number,
  sessionKm: number,
): number | null {
  const after = computeLeaderboardLiveRank(inputRows, myBaseKm, sessionKm);
  if (after.rank === 1) return null;
  const myKm = myBaseKm + sessionKm;
  const myTenths = tenthsOf(myKm);
  let bestFirst: number | null = null;
  for (const row of inputRows) {
    if (row.isMe) continue;
    const t = tenthsOf(row.valueKm);
    if (bestFirst == null || t > bestFirst) bestFirst = t;
  }
  if (bestFirst == null || myTenths >= bestFirst) return null;
  return kmOfTenths(bestFirst - myTenths);
}
