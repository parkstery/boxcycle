/**
 * G3-2 순위 지역 범위 — 거리 판은 대표 국가의 대륙·국가에도 쌓고, 요청은 범위를 골라 읽는다.
 * 실행: `tsc && node --test lib/leaderboardScopes.test.js`
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HttpsError } from "firebase-functions/v2/https";
import { continentOfCountry } from "./geoRegion/geoRegionData.js";
import { resolveRequestScope } from "./leaderboard.js";
import { renderLeaderboard } from "./leaderboardCore.js";
import { FakeScoreDb } from "./leaderboardFakeFirestore.js";
import { homeScoreScopes, planRideScoreWrites, type RideScoreInput } from "./leaderboardScoresCore.js";
import {
  applyRideScoresInTransaction,
  loadLeaderboardLayoutFromScores,
  resetLeaderboardTopMemoForTests,
} from "./leaderboardScoresStore.js";

const NOW = Date.UTC(2026, 9, 23, 3, 0, 0);

function ride(id: string, userId: string, meters: number, distanceScopes?: RideScoreInput["distanceScopes"]): RideScoreInput {
  return {
    rideId: id,
    userId,
    endedAtMs: NOW - 3600_000,
    timeZone: "Asia/Seoul",
    tier: "t1",
    distanceMeters: meters,
    newMeters: meters / 2,
    publicationId: null,
    publicationOwnerUid: null,
    distanceScopes,
  };
}

describe("대표 국가 → 범위", () => {
  it("대륙·국가 두 범위, 없거나 형식이 틀리면 전세계만", () => {
    assert.deepEqual(homeScoreScopes("KR", continentOfCountry), [
      { scopeType: "continent", scopeCode: "AS" },
      { scopeType: "country", scopeCode: "KR" },
    ]);
    assert.deepEqual(homeScoreScopes("FR", continentOfCountry)[0], { scopeType: "continent", scopeCode: "EU" });
    assert.deepEqual(homeScoreScopes(null, continentOfCountry), []);
    assert.deepEqual(homeScoreScopes("kr", continentOfCountry), []);
    assert.deepEqual(homeScoreScopes("KR", () => null), [{ scopeType: "country", scopeCode: "KR" }]);
  });
});

describe("쓰기 계획", () => {
  it("거리 판만 범위가 늘고 개척 판은 전세계만", () => {
    const plan = planRideScoreWrites(ride("r1", "u1", 5000, homeScoreScopes("KR", continentOfCountry)));
    const distance = plan.scores.filter((s) => s.board === "distance");
    const pioneer = plan.scores.filter((s) => s.board === "pioneer");
    assert.equal(distance.length, 12, "전세계·대륙·국가 × 주·월·연·전체");
    assert.equal(pioneer.length, 4);
    assert.ok(pioneer.every((s) => s.scope.scopeType === "world"));
    assert.ok(distance.some((s) => s.docId === "distance_all_country_KR_u1"));
    assert.ok(distance.some((s) => s.docId === "distance_all_continent_AS_u1"));
  });
  it("범위가 없으면 종전과 같다(전세계 8건)", () => {
    assert.equal(planRideScoreWrites(ride("r1", "u1", 5000)).scores.length, 8);
  });
});

describe("쌓고 읽기", () => {
  async function scenario(): Promise<FakeScoreDb> {
    const db = new FakeScoreDb();
    const kr = homeScoreScopes("KR", continentOfCountry);
    const jp = homeScoreScopes("JP", continentOfCountry);
    const fr = homeScoreScopes("FR", continentOfCountry);
    const rides = [
      ride("a", "kr1", 9000, kr),
      ride("b", "kr2", 4000, kr),
      ride("c", "jp1", 7000, jp),
      ride("d", "fr1", 12000, fr),
      ride("e", "none1", 20000), // 국가 미설정 회원 — 전세계에만
    ];
    for (const r of rides) {
      await db.runTransaction((tx) => applyRideScoresInTransaction(tx as never, db.asFirestore(), r, true, 0));
    }
    return db;
  }
  const names = (rows: { uid: string }[]) => rows.map((r) => r.uid);

  it("국가·대륙·전세계 순위가 각자 다르다", async () => {
    const db = await scenario();
    resetLeaderboardTopMemoForTests();
    const requester = { uid: "kr2", isAnonymous: false };
    const load = (scope?: { scopeType: string; scopeCode: string }) =>
      loadLeaderboardLayoutFromScores(db.asFirestore(), {
        board: "distance", period: "all", requester, nowMs: NOW, sensorOnly: false, scope,
      });
    assert.deepEqual(names((await load()).top), ["none1", "fr1", "kr1", "jp1", "kr2"]);
    assert.deepEqual(names((await load({ scopeType: "continent", scopeCode: "AS" })).top), ["kr1", "jp1", "kr2"]);
    const country = await load({ scopeType: "country", scopeCode: "KR" });
    assert.deepEqual(names(country.top), ["kr1", "kr2"]);
    assert.equal(country.me.rank, 2);
    const response = renderLeaderboard(country, { nicknames: new Map(), liveByUid: new Map() }, {
      scopeType: "country",
      scopeCode: "KR",
    });
    assert.equal(response.scope, "country");
    assert.equal(response.scopeCode, "KR");
  });

  it("범위 없는 응답은 종전 계약(world, scopeCode null)", async () => {
    const db = await scenario();
    resetLeaderboardTopMemoForTests();
    const layout = await loadLeaderboardLayoutFromScores(db.asFirestore(), {
      board: "distance", period: "all", requester: { uid: "kr1", isAnonymous: false }, nowMs: NOW, sensorOnly: false,
    });
    const r = renderLeaderboard(layout, { nicknames: new Map(), liveByUid: new Map() });
    assert.equal(r.scope, "world");
    assert.equal(r.scopeCode, null);
  });
});

describe("요청 범위 해석", () => {
  const home = (hc: string | null) => async () => hc;
  it("생략 = 전세계(옛 앱)", async () => {
    assert.equal((await resolveRequestScope(undefined, undefined, home("KR"))).scopeType, "world");
  });
  it("코드 생략 시 요청자의 대표 국가로 정한다", async () => {
    assert.deepEqual((await resolveRequestScope("country", undefined, home("KR"))).scope, {
      scopeType: "country",
      scopeCode: "KR",
    });
    assert.deepEqual((await resolveRequestScope("continent", "", home("FR"))).scope, {
      scopeType: "continent",
      scopeCode: "EU",
    });
  });
  it("다른 나라 지정 가능, 형식이 틀리거나 대표 국가가 없으면 거절", async () => {
    assert.equal((await resolveRequestScope("country", "jp", home(null))).scope.scopeCode, "JP");
    await assert.rejects(resolveRequestScope("country", undefined, home(null)), HttpsError);
    await assert.rejects(resolveRequestScope("continent", "XX", home("KR")), HttpsError);
    await assert.rejects(resolveRequestScope("country", "KOR", home("KR")), HttpsError);
    await assert.rejects(resolveRequestScope("admin1", undefined, home("KR")), HttpsError);
  });
});

describe("개척 판 대륙·국가 범위(G5 S3)", () => {
  const pioneerOf = (input: RideScoreInput) => planRideScoreWrites(input).scores.filter((s) => s.board === "pioneer");
  const sumAll = (rows: { addAll: number }[]) => rows.reduce((a, r) => a + r.addAll, 0);

  it("서울+파리: world·KR·AS·FR·EU 범위, 지역 금액 합 = newMeters", () => {
    const input = {
      ...ride("r1", "u1", 5000),
      newMeters: 1000,
      byRegion: [
        { continent: "AS", country: "KR", meters: 300 },
        { continent: "AS", country: "KR", meters: 200 },
        { continent: "EU", country: "FR", meters: 500 },
      ],
    };
    const rows = pioneerOf(input).filter((s) => s.periodKey === "all");
    const by = (t: string, c: string) => rows.find((s) => s.scope.scopeType === t && s.scope.scopeCode === c);
    assert.equal(rows.length, 5);
    assert.equal(by("world", "-")!.addAll, 1000);
    assert.equal(by("country", "KR")!.addAll, 500);
    assert.equal(by("country", "FR")!.addAll, 500);
    assert.equal(by("continent", "AS")!.addAll, 500);
    assert.equal(by("continent", "EU")!.addAll, 500);
    assert.equal(by("continent", "AS")!.addT1, 500, "센서 인정분 규칙 동일");
    assert.equal(sumAll(rows.filter((s) => s.scope.scopeType === "country")), 1000);
    assert.ok(rows.some((s) => s.docId === "pioneer_all_country_KR_u1"));
  });
  it("바다만 byRegion 이면 전세계만", () => {
    const rows = pioneerOf({ ...ride("r1", "u1", 5000), byRegion: [{ continent: null, country: null, meters: 400 }] });
    assert.equal(rows.length, 4);
    assert.ok(rows.every((s) => s.scope.scopeType === "world"));
  });
  it("byRegion 없는 옛 주행은 전세계만", () => {
    assert.equal(pioneerOf(ride("r1", "u1", 5000)).length, 4);
  });
  it("개척 판 국가 요청도 해석되고 점수 읽기가 에러 없이 돈다", async () => {
    assert.deepEqual((await resolveRequestScope("country", undefined, async () => "KR")).scope, {
      scopeType: "country",
      scopeCode: "KR",
    });
    const db = new FakeScoreDb();
    const r = { ...ride("p1", "kr1", 5000), byRegion: [{ continent: "AS", country: "KR", meters: 2500 }] };
    await db.runTransaction((tx) => applyRideScoresInTransaction(tx as never, db.asFirestore(), r, true, 0));
    resetLeaderboardTopMemoForTests();
    const layout = await loadLeaderboardLayoutFromScores(db.asFirestore(), {
      board: "pioneer", period: "all", requester: { uid: "kr1", isAnonymous: false }, nowMs: NOW, sensorOnly: false,
      scope: { scopeType: "country", scopeCode: "KR" },
    });
    assert.deepEqual(layout.top.map((x) => x.uid), ["kr1"]);
    assert.equal(layout.me.uses, null);
  });
});

import { PIONEER_REGION_MAX, pioneerRegionAmounts } from "./leaderboardScoresCore.js";

describe("개척 지역 점수 상한(G5 안전장치)", () => {
  it("국가·대륙이 상한보다 많으면 금액 큰 순으로 상한까지만", () => {
    const codes = Array.from({ length: 12 }, (_, i) => `C${i}`);
    const by = codes.map((c, i) => ({ continent: `K${i}`, country: c, meters: 100 - i }));
    const out = pioneerRegionAmounts(by);
    assert.equal(out.filter((o) => o.scope.scopeType === "country").length, PIONEER_REGION_MAX);
    assert.equal(out.filter((o) => o.scope.scopeType === "continent").length, PIONEER_REGION_MAX);
    assert.deepEqual(out.filter((o) => o.scope.scopeType === "country")[0]!.scope.scopeCode, "C0");
    assert.ok(!out.some((o) => o.scope.scopeCode === "C11"), "작은 금액은 버린다");
  });
  it("정상 범위(3국가)는 그대로", () => {
    const out = pioneerRegionAmounts([
      { continent: "EU", country: "FR", meters: 10 },
      { continent: "EU", country: "DE", meters: 5 },
      { continent: "AS", country: "KR", meters: 7 },
    ]);
    assert.equal(out.length, 5);
  });
});
