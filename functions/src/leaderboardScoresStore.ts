/**
 * 리더보드 누적 점수 — Firestore 입출력. 순수 계산은 leaderboardScoresCore.ts.
 * - 쓰기: `applyRideScoresInTransaction`(한 트랜잭션·원장 멱등) · `markLeaderboardScoresMember`(게스트 → 회원)
 * - 읽기: `loadLeaderboardLayoutFromScores`(getLeaderboard 용 — 상위 N·내 순위·around 만 읽는다)
 * 응답 모양·순위 규칙은 leaderboardCore.ts(layoutLeaderboard)와 같다. 동등성은 leaderboardScoresParity.test.ts 가 지킨다.
 */
import type { Firestore, Query, Transaction } from "firebase-admin/firestore";
import {
  AROUND_SPAN,
  LEADERBOARD_SENSOR_ONLY,
  LEADERBOARD_TOP_N,
  kmOfTenths,
  kstDateKey,
  periodStartMs,
  tenthsOf,
  type BoardSnapshot,
  type LeaderboardBoard,
  type LeaderboardLayout,
  type LeaderboardPeriod,
} from "./leaderboardCore.js";
import { assertGuestLifecycleWritableInTx } from "./guestLifecycleGuard.js";
import {
  LEADERBOARD_SCORES_COLLECTION,
  LEADERBOARD_SCORE_APPLIED_COLLECTION,
  LEADERBOARD_USES_COLLECTION,
  LEADERBOARD_USE_MARKS_COLLECTION,
  WORLD_SCOPE,
  applyScoreIncrement,
  applyUseIncrement,
  periodKeyForRequest,
  planRideScoreWrites,
  roundedField,
  scoreDocId,
  tenthsField,
  trackOf,
  usesDocId,
  type RideScoreInput,
  type ScoreScope,
  type ScoreTrack,
} from "./leaderboardScoresCore.js";

// ---------------------------------------------------------------------------
// 쓰기
// ---------------------------------------------------------------------------

/**
 * 한 주행을 점수 문서에 더한다. 트리거는 at-least-once 이므로 원장(`leaderboardScoreApplied/{rideId}`)이
 * 있으면 아무것도 쓰지 않는다. 읽기를 모두 끝낸 뒤 쓴다(Firestore 트랜잭션 규칙).
 * guestLifecycle tombstone 뒤 지연 도착은 첫 동작의 marker 검문이 막는다(점수 문서 재생성 금지).
 * @param updatedAt `FieldValue.serverTimestamp()` 또는 시험용 값
 * @returns 실제로 더했으면 true, 이미 반영됐거나 인정 대상이 아니면 false
 */
export async function applyRideScoresInTransaction(
  tx: Pick<Transaction, "get" | "set">,
  db: Firestore,
  input: RideScoreInput,
  member: boolean,
  updatedAt: unknown,
  scope: ScoreScope = WORLD_SCOPE,
): Promise<boolean> {
  await assertGuestLifecycleWritableInTx(tx, db, input.userId);
  const plan = planRideScoreWrites(input, scope);
  if (plan.scores.length === 0 && plan.uses.length === 0) return false;

  const ledgerRef = db.doc(`${LEADERBOARD_SCORE_APPLIED_COLLECTION}/${input.rideId}`);
  const scoreRefs = plan.scores.map((s) => db.doc(`${LEADERBOARD_SCORES_COLLECTION}/${s.docId}`));
  const usesRefs = plan.uses.map((u) => db.doc(`${LEADERBOARD_USES_COLLECTION}/${u.usesDocId}`));
  const markRefs = plan.uses.map((u) => db.doc(`${LEADERBOARD_USE_MARKS_COLLECTION}/${u.markDocId}`));

  const [ledgerSnap, scoreSnaps, usesSnaps, markSnaps] = await Promise.all([
    tx.get(ledgerRef),
    Promise.all(scoreRefs.map((r) => tx.get(r))),
    Promise.all(usesRefs.map((r) => tx.get(r))),
    Promise.all(markRefs.map((r) => tx.get(r))),
  ]);
  if (ledgerSnap.exists) return false;

  plan.scores.forEach((inc, i) => {
    tx.set(scoreRefs[i]!, { ...applyScoreIncrement(scoreSnaps[i]!.data(), inc, member, inc.scope), updatedAt });
  });
  plan.uses.forEach((inc, i) => {
    const { uses, mark } = applyUseIncrement(usesSnaps[i]!.data(), markSnaps[i]!.data(), inc);
    tx.set(usesRefs[i]!, { ...uses, updatedAt });
    tx.set(markRefs[i]!, { ...mark, updatedAt });
  });
  tx.set(ledgerRef, { rideId: input.rideId, uid: input.userId, appliedAt: updatedAt });
  return true;
}

/**
 * 게스트가 Google 에 연결되면(guestLinkHttp complete 성공) 그 uid 의 점수 문서를 회원으로 바꾼다.
 * 다음 주행 때 트랜잭션이 member 를 다시 쓰기는 하지만, 그 전에도 순위에 보여야 한다.
 * @returns 바꾼 문서 수
 */
export async function markLeaderboardScoresMember(db: Firestore, uid: string): Promise<number> {
  const snap = await db.collection(LEADERBOARD_SCORES_COLLECTION).where("uid", "==", uid).get();
  let changed = 0;
  for (let i = 0; i < snap.docs.length; i += 400) {
    const batch = db.batch();
    for (const d of snap.docs.slice(i, i + 400)) {
      if (d.get("member") === true) continue;
      batch.update(d.ref, { member: true });
      changed += 1;
    }
    await batch.commit();
  }
  return changed;
}

// ---------------------------------------------------------------------------
// 읽기
// ---------------------------------------------------------------------------

/** 요청 공통부(상위 목록)만 인스턴스 안에서 이 시간 재사용한다. */
export const LEADERBOARD_TOP_MEMO_MS = 60 * 1000;

type ScoreRow = { uid: string; meters: number; tenths: number };

let topMemo = new Map<string, { atMs: number; rows: ScoreRow[] }>();

/** 시험용 — 인스턴스 메모를 비운다. */
export function resetLeaderboardTopMemoForTests(): void {
  topMemo = new Map();
}

function baseQuery(db: Firestore, board: LeaderboardBoard, periodKey: string, track: ScoreTrack, scope: ScoreScope): Query {
  return db
    .collection(LEADERBOARD_SCORES_COLLECTION)
    .where("board", "==", board)
    .where("periodKey", "==", periodKey)
    .where("scopeType", "==", scope.scopeType)
    .where("scopeCode", "==", scope.scopeCode)
    .where("member", "==", true)
    .where(tenthsField(track), ">", 0);
}

function rowOf(d: { get(field: string): unknown }, track: ScoreTrack): ScoreRow {
  return {
    uid: String(d.get("uid")),
    meters: Number(d.get(roundedField(track))),
    tenths: Number(d.get(tenthsField(track))),
  };
}

/** 정렬: tenths desc → meters desc → uid asc (leaderboardCore.layoutLeaderboard 와 같다). */
function byRankOrder(a: ScoreRow, b: ScoreRow): number {
  return b.tenths - a.tenths || b.meters - a.meters || (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0);
}

/**
 * getLeaderboard 용 — 점수 문서에서 순위 레이아웃을 만든다. 반환값은 renderLeaderboard 에 그대로 넣는다.
 * 읽는 양: 상위 목록 1회(60초 메모) + 내 문서 + 내 순위 count + around 2회(+ 줄별 count) + 개척판 uses 1건.
 */
export async function loadLeaderboardLayoutFromScores(
  db: Firestore,
  input: {
    board: LeaderboardBoard;
    period: LeaderboardPeriod;
    requester: { uid: string; isAnonymous: boolean };
    nowMs: number;
    sensorOnly?: boolean;
    scope?: ScoreScope;
  },
): Promise<LeaderboardLayout> {
  const { board, period, requester, nowMs } = input;
  const sensorOnly = input.sensorOnly ?? LEADERBOARD_SENSOR_ONLY;
  const scope = input.scope ?? WORLD_SCOPE;
  const track = trackOf(sensorOnly);
  const tField = tenthsField(track);
  const rField = roundedField(track);
  const periodKey = periodKeyForRequest(period, nowMs);
  const startMs = periodStartMs(period, nowMs);

  const memberQuery = baseQuery(db, board, periodKey, track, scope);
  const topKey = `${board}|${periodKey}|${scope.scopeType}|${scope.scopeCode}|${track}`;

  const loadTop = async (): Promise<ScoreRow[]> => {
    const hit = topMemo.get(topKey);
    if (hit && nowMs >= hit.atMs && nowMs - hit.atMs < LEADERBOARD_TOP_MEMO_MS) return hit.rows;
    // 요청자를 빼거나 끼워 넣어도 TOP_N 이 남도록 한 줄 여유를 둔다.
    const snap = await memberQuery
      .orderBy(tField, "desc")
      .orderBy(rField, "desc")
      .orderBy("uid", "asc")
      .limit(LEADERBOARD_TOP_N + 1)
      .get();
    const rows = snap.docs.map((d) => rowOf(d, track));
    topMemo.set(topKey, { atMs: nowMs, rows });
    return rows;
  };

  const needUses = board === "pioneer" && !requester.isAnonymous;
  const [topRows, mySnap, usesSnap] = await Promise.all([
    loadTop(),
    db.doc(`${LEADERBOARD_SCORES_COLLECTION}/${scoreDocId(board, periodKey, requester.uid, scope)}`).get(),
    needUses ? db.doc(`${LEADERBOARD_USES_COLLECTION}/${usesDocId(periodKey, requester.uid)}`).get() : Promise.resolve(null),
  ]);

  const myMeters = mySnap.exists ? Number(mySnap.get(rField)) || 0 : 0;
  const myTenths = mySnap.exists ? Number(mySnap.get(tField)) || 0 : 0;
  const myDocMember = mySnap.exists && mySnap.get("member") === true;

  const usesData = usesSnap?.exists ? usesSnap : null;
  const uses = needUses
    ? {
        riders: Number(usesData?.get(`riders${track}`)) || 0,
        // 기존 집계는 합을 한 번 반올림(m)한 뒤 0.1km 로 바꿨다 — 같은 순서로.
        km: kmOfTenths(tenthsOf(Math.round(Number(usesData?.get(`meters${track}`)) || 0))),
      }
    : null;

  // 문서의 member 표시보다 토큰이 정확하다(방금 회원 등록한 경우). 요청자 줄만 토큰 기준으로 다시 정한다.
  const me: ScoreRow = { uid: requester.uid, meters: myMeters, tenths: myTenths };
  const countMembersAbove = async (tenths: number): Promise<number> => {
    const snap = await memberQuery.where(tField, ">", tenths).count().get();
    return snap.data().count;
  };
  // 문서에는 비회원이지만 토큰은 회원인 요청자는 count 에 안 잡힌다 — 그 한 명을 더해 준다.
  const selfNotCounted = !requester.isAnonymous && myTenths > 0 && !myDocMember;
  const aheadOf = async (tenths: number): Promise<number> =>
    (await countMembersAbove(tenths)) + (selfNotCounted && myTenths > tenths ? 1 : 0);

  const snapshot: BoardSnapshot = {
    board,
    period,
    periodStartKst: startMs == null ? null : kstDateKey(startMs),
    generatedAtMs: nowMs,
    sensorOnly,
    entries: [],
    uses: {},
  };

  // 상위 목록: 요청자 줄은 토큰·내 문서(최신) 기준으로 다시 넣는다.
  const candidates = topRows.filter((r) => r.uid !== requester.uid);
  if (!requester.isAnonymous && myTenths > 0) candidates.push(me);
  candidates.sort(byRankOrder);
  const top: Array<{ uid: string; rank: number; meters: number }> = [];
  let prevTenths = -1;
  let prevRank = 0;
  candidates.slice(0, LEADERBOARD_TOP_N).forEach((r, i) => {
    const rank = r.tenths === prevTenths ? prevRank : i + 1;
    prevTenths = r.tenths;
    prevRank = rank;
    top.push({ uid: r.uid, rank, meters: r.meters });
  });

  let meOut: LeaderboardLayout["me"];
  let around: LeaderboardLayout["around"] = [];

  if (requester.isAnonymous) {
    meOut = {
      status: "guest",
      rank: null,
      valueKm: kmOfTenths(myTenths),
      gapToNextKm: null,
      projectedRank: myTenths > 0 ? 1 + (await countMembersAbove(myTenths)) : null,
      uses: null,
      around: [],
    };
  } else if (myTenths <= 0) {
    meOut = {
      status: "unranked",
      rank: null,
      valueKm: kmOfTenths(myTenths),
      gapToNextKm: null,
      projectedRank: null,
      uses,
      around: [],
    };
  } else {
    const cursor = [myTenths, myMeters, requester.uid] as const;
    const [myAhead, nearestAbove, beforeSnap, afterSnap] = await Promise.all([
      countMembersAbove(myTenths),
      // 나보다 큰 값 중 가장 가까운 사람 = 내 동점 그룹 바로 앞 줄
      memberQuery
        .where(tField, ">", myTenths)
        .orderBy(tField, "asc")
        .orderBy(rField, "asc")
        .orderBy("uid", "desc")
        .limit(1)
        .get(),
      memberQuery
        .orderBy(tField, "asc")
        .orderBy(rField, "asc")
        .orderBy("uid", "desc")
        .startAfter(...cursor)
        .limit(AROUND_SPAN)
        .get(),
      memberQuery
        .orderBy(tField, "desc")
        .orderBy(rField, "desc")
        .orderBy("uid", "asc")
        .startAfter(...cursor)
        .limit(AROUND_SPAN)
        .get(),
    ]);
    const myRank = myAhead + 1;
    const ahead = nearestAbove.docs[0] ? rowOf(nearestAbove.docs[0], track) : null;
    const window: ScoreRow[] = [
      ...beforeSnap.docs.map((d) => rowOf(d, track)).reverse(),
      me,
      ...afterSnap.docs.map((d) => rowOf(d, track)),
    ];
    const rankByTenths = new Map<number, number>([[myTenths, myRank]]);
    const others = [...new Set(window.map((r) => r.tenths))].filter((t) => t !== myTenths);
    await Promise.all(
      others.map(async (t) => {
        rankByTenths.set(t, (await aheadOf(t)) + 1);
      }),
    );
    around = window
      .map((r) => ({ uid: r.uid, rank: rankByTenths.get(r.tenths)!, meters: r.meters }))
      .filter((r) => !top.some((t) => t.uid === r.uid));
    meOut = {
      status: "ranked",
      rank: myRank,
      valueKm: kmOfTenths(myTenths),
      gapToNextKm: ahead ? kmOfTenths(ahead.tenths - myTenths) : null,
      projectedRank: null,
      uses,
      around: [],
    };
  }

  const displayUids = [...new Set([...top, ...around].map((r) => r.uid))];
  return { snapshot, top, around, me: meOut, requesterUid: requester.uid, displayUids };
}
