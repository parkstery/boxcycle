import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ACCOUNT_DELETION_POLICY } from "./accountDeletionCore.js";
import { FakeScoreDb } from "./leaderboardFakeFirestore.js";
import {
  applyScoreIncrement,
  applyUseIncrement,
  isoWeekOf,
  periodKeyForRequest,
  periodKeysOf,
  planRideScoreWrites,
  type RideScoreInput,
} from "./leaderboardScoresCore.js";
import {
  applyRideScoresInTransaction,
  loadLeaderboardLayoutFromScores,
  markLeaderboardScoresMember,
  resetLeaderboardTopMemoForTests,
} from "./leaderboardScoresStore.js";
import { rideScoreInputFromData } from "./leaderboardScoresOnRideWritten.js";
import { deleteGuestUidFirestoreData, type PresenceIndex } from "./purgeGuestUsersCore.js";

/**
 * 리더보드 누적 점수 — 단위 계약.
 * 무엇을 막는가: 기간 키가 하루 밀리거나(ISO 주 경계), 한 주행이 두 번 더해지거나, 탈퇴한 계정이 순위에 남아도
 * 에러 없이 화면은 멀쩡히 뜬다. 응답 동등성(기존 집계와 같은 결과)은 leaderboardScoresParity.test.ts.
 */

const kst = (y: number, mo: number, d: number, h = 0, mi = 0, s = 0, ms = 0): number =>
  Date.UTC(y, mo - 1, d, h, mi, s, ms) - 9 * 3600 * 1000;

describe("기간 키 — ISO 주·월·연 (Asia/Seoul)", () => {
  it("ISO 주: 연말·연초는 그 주 목요일이 속한 해를 따른다", () => {
    assert.deepEqual(isoWeekOf(2026, 1, 1), { isoYear: 2026, week: 1 }); // 목
    assert.deepEqual(isoWeekOf(2025, 12, 29), { isoYear: 2026, week: 1 }); // 월 — 목(1/1)이 2026
    assert.deepEqual(isoWeekOf(2027, 1, 1), { isoYear: 2026, week: 53 }); // 금 — 2026 은 53주
    assert.deepEqual(isoWeekOf(2027, 1, 4), { isoYear: 2027, week: 1 });
    assert.deepEqual(isoWeekOf(2024, 12, 30), { isoYear: 2025, week: 1 });
    assert.deepEqual(isoWeekOf(2021, 1, 3), { isoYear: 2020, week: 53 });
  });

  it("KST 경계: 일요일 23:59:59.999 는 지난 주, 월요일 00:00 은 새 주", () => {
    const sunEnd = periodKeysOf(kst(2026, 10, 25, 23, 59, 59, 999));
    const monStart = periodKeysOf(kst(2026, 10, 26));
    assert.equal(sunEnd.week, "W2026-43");
    assert.equal(monStart.week, "W2026-44");
    // UTC 로는 같은 날이어도 KST 로 넘어간 시각이 새 키가 된다
    assert.equal(periodKeysOf(Date.UTC(2026, 11, 31, 15, 0, 0)).year, "Y2027"); // 2027-01-01 00:00 KST
    assert.equal(periodKeysOf(Date.UTC(2026, 11, 31, 14, 59, 59)).year, "Y2026");
  });

  it("월·연·all 키", () => {
    const k = periodKeysOf(kst(2026, 10, 23, 12));
    assert.deepEqual(k, { week: "W2026-43", month: "M2026-10", year: "Y2026", all: "all" });
    assert.equal(periodKeysOf(kst(2026, 9, 30, 23, 59)).month, "M2026-09");
    assert.equal(periodKeysOf(kst(2026, 10, 1)).month, "M2026-10");
  });

  it("rides.timeZone 이 있으면 그 시간대로, 모르는 값이면 Asia/Seoul", () => {
    const ms = Date.UTC(2026, 11, 31, 20, 0, 0); // 2026-12-31 20:00Z = KST 1/1 05:00 = NY 12/31 15:00
    assert.equal(periodKeysOf(ms, "America/New_York").year, "Y2026");
    assert.equal(periodKeysOf(ms, "Asia/Seoul").year, "Y2027");
    assert.equal(periodKeysOf(ms, null).year, "Y2027");
    assert.equal(periodKeysOf(ms, "Not/AZone").year, "Y2027");
  });

  it("요청 기간 키: week·month·all (연은 응답에 아직 안 나간다)", () => {
    const now = kst(2026, 10, 23, 12);
    assert.equal(periodKeyForRequest("week", now), "W2026-43");
    assert.equal(periodKeyForRequest("month", now), "M2026-10");
    assert.equal(periodKeyForRequest("all", now), "all");
  });
});

const baseRide = (over: Partial<RideScoreInput> = {}): RideScoreInput => ({
  rideId: "r1",
  userId: "me",
  endedAtMs: kst(2026, 10, 23, 12),
  tier: "t1",
  distanceMeters: 10_000,
  newMeters: 2_000,
  publicationId: null,
  publicationOwnerUid: null,
  ...over,
});

describe("planRideScoreWrites — 한 주행의 증분 목록", () => {
  it("t1 주행: 판 2 × 기간 4 = 8문서, T1·All 양쪽에 더한다", () => {
    const plan = planRideScoreWrites(baseRide());
    assert.equal(plan.scores.length, 8);
    assert.deepEqual(plan.uses, []);
    const dist = plan.scores.filter((s) => s.board === "distance");
    assert.deepEqual(dist.map((s) => s.periodKey), ["W2026-43", "M2026-10", "Y2026", "all"]);
    assert.ok(dist.every((s) => s.addT1 === 10_000 && s.addAll === 10_000));
    const pio = plan.scores.filter((s) => s.board === "pioneer");
    assert.ok(pio.every((s) => s.addT1 === 2_000 && s.addAll === 2_000));
    assert.equal(plan.scores[0]!.docId, "distance_W2026-43_world_-_me");
  });

  it("t0 주행은 All 에만 쌓는다(sensorOnly 복원 시 제외되도록)", () => {
    const plan = planRideScoreWrites(baseRide({ tier: "t0" }));
    assert.ok(plan.scores.every((s) => s.addT1 === 0 && s.addAll > 0));
  });

  it("tier 없음·알 수 없는 tier·시각 없음·uid 없음은 빈 계획, 값 0 인 판은 문서를 만들지 않는다", () => {
    for (const bad of [{ tier: null }, { tier: "other" }, { endedAtMs: null }, { endedAtMs: Number.NaN }, { userId: "" }]) {
      assert.deepEqual(planRideScoreWrites(baseRide(bad)), { scores: [], uses: [] }, JSON.stringify(bad));
    }
    const plan = planRideScoreWrites(baseRide({ newMeters: 0 }));
    assert.deepEqual([...new Set(plan.scores.map((s) => s.board))], ["distance"]);
    assert.deepEqual(planRideScoreWrites(baseRide({ distanceMeters: Number.NaN, newMeters: -5 })).scores, []);
  });

  it("개척 이용: 남의 퍼블릭을 달리면 소유자에게 기간 4개, newMeters 가 0 이어도 센다, 내 퍼블릭은 제외", () => {
    const plan = planRideScoreWrites(
      baseRide({ newMeters: 0, publicationId: "pub", publicationOwnerUid: "owner" }),
    );
    assert.equal(plan.uses.length, 4);
    assert.deepEqual(plan.uses[3], {
      usesDocId: "all_owner",
      markDocId: "all_owner_me",
      periodKey: "all",
      ownerUid: "owner",
      riderUid: "me",
      meters: 10_000,
      t1: true,
    });
    assert.deepEqual(planRideScoreWrites(baseRide({ publicationId: "pub", publicationOwnerUid: "me" })).uses, []);
    assert.deepEqual(planRideScoreWrites(baseRide({ publicationId: "pub", publicationOwnerUid: null })).uses, []);
    assert.deepEqual(planRideScoreWrites(baseRide({ publicationId: null, publicationOwnerUid: "owner" })).uses, []);
  });
});

describe("증분 적용", () => {
  it("점수 문서: 원본 합·반올림 합·0.1km 정수를 함께 갱신한다", () => {
    const inc = planRideScoreWrites(baseRide({ distanceMeters: 5049.25 })).scores[0]!;
    const first = applyScoreIncrement(undefined, inc, true);
    assert.equal(first.metersAll, 5049.25);
    assert.equal(first.roundedAll, 5049);
    assert.equal(first.tenthsAll, 50);
    assert.equal(first.scopeType, "world");
    assert.equal(first.scopeCode, "-");
    const second = applyScoreIncrement(first as unknown as Record<string, unknown>, inc, false);
    assert.equal(second.metersAll, 10098.5);
    assert.equal(second.roundedAll, 10099);
    assert.equal(second.tenthsAll, 101);
    assert.equal(second.member, false, "member 는 쓰기 시점 값으로 갱신");
  });

  it("개척 표식: riders 는 처음 생길 때만 +1, meters 는 매번 더한다, T1·All 따로", () => {
    const t0 = planRideScoreWrites(baseRide({ tier: "t0", publicationId: "p", publicationOwnerUid: "o" })).uses[0]!;
    const t1 = planRideScoreWrites(baseRide({ rideId: "r2", publicationId: "p", publicationOwnerUid: "o" })).uses[0]!;
    const a = applyUseIncrement(undefined, undefined, t0);
    assert.deepEqual([a.uses.ridersT1, a.uses.ridersAll, a.uses.metersT1, a.uses.metersAll], [0, 1, 0, 10_000]);
    const b = applyUseIncrement(a.uses as never, a.mark as never, t0);
    assert.deepEqual([b.uses.ridersAll, b.uses.metersAll], [1, 20_000], "같은 라이더 두 번째 = riders 그대로");
    const c = applyUseIncrement(b.uses as never, b.mark as never, t1);
    assert.deepEqual([c.uses.ridersT1, c.uses.ridersAll, c.uses.metersT1, c.uses.metersAll], [1, 1, 10_000, 30_000]);
    assert.deepEqual(c.mark, { periodKey: "W2026-43", ownerUid: "o", riderUid: "me", t1: true, all: true });
  });
});

const ZERO = 0;
const run = (db: FakeScoreDb, input: RideScoreInput, member = true) =>
  db.runTransaction((tx) => applyRideScoresInTransaction(tx as never, db.asFirestore(), input, member, ZERO));

describe("원장 멱등 — 트리거는 at-least-once", () => {
  it("같은 rideId 를 두 번 넣어도 한 번만 더한다", async () => {
    const db = new FakeScoreDb();
    const input = baseRide({ publicationId: "p", publicationOwnerUid: "o" });
    assert.equal(await run(db, input), true);
    const snapshot = JSON.stringify([...db.docs.entries()]);
    assert.equal(await run(db, input), false);
    assert.equal(JSON.stringify([...db.docs.entries()]), snapshot, "두 번째는 아무것도 쓰지 않는다");
    assert.equal(db.docs.get("leaderboardScores/distance_all_world_-_me")!.metersAll, 10_000);
    assert.equal(db.docs.get("leaderboardUses/all_o")!.ridersAll, 1);
    assert.ok(db.docs.has("leaderboardScoreApplied/r1"));
  });

  it("다른 주행은 쌓이고, 인정 대상이 아닌 주행은 원장도 만들지 않는다", async () => {
    const db = new FakeScoreDb();
    await run(db, baseRide());
    await run(db, baseRide({ rideId: "r2", distanceMeters: 500 }));
    assert.equal(db.docs.get("leaderboardScores/distance_all_world_-_me")!.metersAll, 10_500);
    assert.equal(await run(db, baseRide({ rideId: "r3", tier: null })), false);
    assert.equal(db.docs.has("leaderboardScoreApplied/r3"), false);
  });

  it("guestLifecycle tombstone 뒤 도착은 점수 문서를 만들지 않는다", async () => {
    const db = new FakeScoreDb();
    db.docs.set("guestLifecycle/me", { status: "deleted" });
    await assert.rejects(() => run(db, baseRide()), /tombstone/);
    assert.equal([...db.docs.keys()].some((p) => p.startsWith("leaderboardScores/")), false);
  });

  it("rides 문서 → 점수 입력 변환(tier 없으면 null)", () => {
    const data = { userId: "u", endedAt: 1_000_000, distanceMeters: 5, conquestResult: { tier: "t1", newMeters: 2 }, publicationId: "p" };
    assert.deepEqual(rideScoreInputFromData("r", data, "o"), {
      rideId: "r", userId: "u", endedAtMs: 1_000_000, timeZone: null, tier: "t1",
      distanceMeters: 5, newMeters: 2, publicationId: "p", publicationOwnerUid: "o",
    });
    assert.equal(rideScoreInputFromData("r", { ...data, conquestResult: {} }, null), null);
  });
});

describe("게스트 → 회원 전환·탈퇴", () => {
  it("Google 연결 시 그 uid 의 점수 문서가 member=true 가 되고 다른 사람은 그대로", async () => {
    const db = new FakeScoreDb();
    await run(db, baseRide({ userId: "g" }), false);
    await run(db, baseRide({ rideId: "r2", userId: "x" }), false);
    const changed = await markLeaderboardScoresMember(db.asFirestore(), "g");
    assert.equal(changed, 8);
    assert.equal(db.docs.get("leaderboardScores/distance_all_world_-_g")!.member, true);
    assert.equal(db.docs.get("leaderboardScores/distance_all_world_-_x")!.member, false);
    assert.equal(await markLeaderboardScoresMember(db.asFirestore(), "g"), 0, "이미 회원이면 쓰기 없음");
  });

  it("탈퇴 정책에 새 컬렉션이 delete 로 분류돼 있다", () => {
    for (const c of ["leaderboardScores", "leaderboardUses", "leaderboardUseMarks", "leaderboardScoreApplied"]) {
      assert.equal(ACCOUNT_DELETION_POLICY[c], "delete", c);
    }
  });

  it("개인 삭제는 본인 점수·원장·이용 합계·표식(라이더/소유자)만 지운다", async () => {
    const db = new FakeScoreDb();
    await run(db, baseRide({ userId: "gone", publicationId: "p", publicationOwnerUid: "o" }));
    await run(db, baseRide({ rideId: "r2", userId: "stay", publicationId: "p2", publicationOwnerUid: "gone" }));
    await run(db, baseRide({ rideId: "r3", userId: "other" }));
    const presence: PresenceIndex = {
      trailMembersByUid: new Map(),
      publicationSessionMembersByUid: new Map(),
      livePublicationRidesByUid: new Map(),
      openTrailListingsByHostUid: new Map(),
      trailsByHostUid: new Map(),
    };
    await deleteGuestUidFirestoreData(db.asFirestore(), "gone", presence);
    const lb = db.deletedPaths.filter((p) => p.startsWith("leaderboard"));
    assert.equal(lb.filter((p) => p.startsWith("leaderboardScores/")).length, 8);
    assert.ok(lb.includes("leaderboardScoreApplied/r1"));
    assert.ok(!lb.includes("leaderboardScoreApplied/r2") && !lb.includes("leaderboardScoreApplied/r3"));
    assert.ok(lb.includes("leaderboardUses/all_gone"), "내 길을 남이 달린 합계");
    assert.ok(lb.includes("leaderboardUseMarks/all_gone_stay"), "소유자 쪽 표식");
    assert.ok(lb.includes("leaderboardUseMarks/all_o_gone"), "라이더 쪽 표식");
    assert.ok(!lb.some((p) => p.includes("_other")), "남의 점수는 남는다");
  });
});

describe("읽기 경로 — 규칙 단위", () => {
  const NOW = kst(2026, 10, 23, 12);

  async function fixture(rows: Array<[string, number, boolean]>): Promise<FakeScoreDb> {
    const db = new FakeScoreDb();
    let n = 0;
    for (const [uid, meters, member] of rows) {
      n += 1;
      await run(db, baseRide({ rideId: `r${n}`, userId: uid, distanceMeters: meters }), member);
    }
    resetLeaderboardTopMemoForTests();
    return db;
  }
  const load = (db: FakeScoreDb, uid: string, isAnonymous = false, sensorOnly = false) =>
    loadLeaderboardLayoutFromScores(db.asFirestore(), {
      board: "distance", period: "week", requester: { uid, isAnonymous }, nowMs: NOW, sensorOnly,
    });

  it("동점은 1,2,2,4 이고 gap 은 동점 그룹 바로 앞과의 차이", async () => {
    const db = await fixture([["a", 9000, true], ["b", 5000, true], ["c", 5000, true], ["d", 1000, true]]);
    const l = await load(db, "d");
    assert.deepEqual(l.top.map((r) => r.rank), [1, 2, 2, 4]);
    assert.equal(l.me.rank, 4);
    assert.equal((await load(db, "c")).me.gapToNextKm, 4);
    assert.equal((await load(db, "a")).me.gapToNextKm, null);
    assert.deepEqual(l.top.map((r) => r.uid), ["a", "b", "c", "d"]);
  });

  it("게스트는 순위에서 빠지고 projectedRank, 회원 아닌 점수 문서는 남의 순위에 들지 않는다", async () => {
    const db = await fixture([["m1", 30_000, true], ["g", 20_000, false], ["m2", 10_000, true]]);
    const l = await load(db, "g", true);
    assert.deepEqual(l.top.map((r) => r.uid), ["m1", "m2"]);
    assert.equal(l.me.status, "guest");
    assert.equal(l.me.projectedRank, 2);
    assert.deepEqual(l.around, []);
    assert.equal((await load(db, "nobody", true)).me.projectedRank, null);
    assert.equal((await load(db, "nobody")).me.status, "unranked");
  });

  it("around: 내 위·아래 3명, top 과 겹치는 줄은 뺀다", async () => {
    const rows = Array.from({ length: 40 }, (_, i): [string, number, boolean] => [`u${String(i + 1).padStart(2, "0")}`, (40 - i) * 1000, true]);
    const db = await fixture(rows);
    const l = await load(db, "u30");
    assert.deepEqual(l.around.map((r) => r.rank), [27, 28, 29, 30, 31, 32, 33]);
    assert.equal(l.top.length, 20);
    const l21 = await load(db, "u21");
    assert.deepEqual(l21.around.map((r) => r.rank), [21, 22, 23, 24]);
  });

  it("sensorOnly 전환: t0 만 있는 계정은 T1 갈래에서 unranked", async () => {
    const db = new FakeScoreDb();
    await run(db, baseRide({ userId: "x", tier: "t0" }));
    await run(db, baseRide({ rideId: "r2", userId: "y", tier: "t1" }));
    resetLeaderboardTopMemoForTests();
    assert.equal((await load(db, "x", false, false)).me.status, "ranked");
    assert.equal((await load(db, "x", false, true)).me.status, "unranked");
    assert.deepEqual((await load(db, "x", false, true)).top.map((r) => r.uid), ["y"]);
  });

  it("상위 목록은 60초 메모 — 두 번째 요청은 top 쿼리를 다시 읽지 않는다", async () => {
    const db = await fixture([["a", 9000, true], ["b", 5000, true]]);
    await load(db, "a");
    const reads = db.queryReads;
    await load(db, "b");
    const second = db.queryReads - reads;
    resetLeaderboardTopMemoForTests();
    const before = db.queryReads;
    await load(db, "b");
    assert.ok(second < db.queryReads - before, "메모가 있으면 읽기가 더 적다");
  });
});

