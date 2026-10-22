import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  aggregateRideMetrics,
  buildAdminDashboardPayload,
  dayKeyKst,
  type AccountInfo,
  type RideInputRow,
} from "./rideMetricsCore.js";

/**
 * 관리자 지표 집계 계약.
 *
 * 무엇을 막는가 — 이 계산이 틀리면 에러가 나지 않는다. 내부 계정이 섞여 비율이 부풀거나,
 * KST 날짜 경계가 하루 밀리거나, 폐기 기준 미만 주행이 "주행한 사람"으로 세어져도 숫자만 조용히 달라진다.
 */

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
/** 2026-10-23 12:00 KST (= 03:00 UTC). 오늘 KST 날짜 = 2026-10-23. */
const NOW = Date.UTC(2026, 9, 23, 3, 0, 0);
/** 2026-10-23 00:00 KST = 2026-10-22 15:00 UTC */
const KST_MIDNIGHT = Date.UTC(2026, 9, 22, 15, 0, 0);

const acct = (cohort: "guest" | "provider", createdMs: number | null = null): AccountInfo => ({
  cohort,
  createdMs,
});

const ride = (
  userId: string,
  ms: number | null,
  over: Partial<RideInputRow> = {},
): RideInputRow => ({
  userId,
  ms,
  distanceMeters: 1000,
  elapsedSec: 300,
  newMeters: 500,
  ...over,
});

const NONE: ReadonlySet<string> = new Set();

describe("KST 날짜 키", () => {
  it("15:00 UTC 직전은 같은 날, 정각부터는 다음 날", () => {
    assert.equal(dayKeyKst(KST_MIDNIGHT - 1), "2026-10-22");
    assert.equal(dayKeyKst(KST_MIDNIGHT), "2026-10-23");
  });
});

describe("코호트 비율 계산", () => {
  it("첫 주행 완료율·72h 재주행·다른 날 재사용·새 도로 비율", () => {
    const accounts = new Map<string, AccountInfo>([
      ["a", acct("guest")],
      ["b", acct("guest")],
      ["c", acct("guest")],
      ["d", acct("guest")],
    ]);
    const t0 = NOW - 10 * DAY;
    const rides = [
      // a: 24h 뒤 다시 달림 → 72h 이내, 다른 날 재사용
      ride("a", t0),
      ride("a", t0 + 24 * HOUR),
      // b: 100h 뒤 → 72h 밖, 다른 날 재사용
      ride("b", t0),
      ride("b", t0 + 100 * HOUR),
      // c: 한 번만, 새 도로 0
      ride("c", t0, { newMeters: 0 }),
      // d: 주행 없음
    ];
    const { metrics } = aggregateRideMetrics({ accounts, rides, excludeUids: NONE, nowMs: NOW });
    const all = metrics.all;
    assert.equal(all.accounts, 4);
    assert.equal(all.accountsWithValidRide, 3);
    assert.equal(all.firstRideCompletionRatePct, 75); // 3/4
    assert.equal(all.secondRideWithin72hRatePct, 33.3); // 1/3
    assert.equal(all.otherDayReuseRatePct, 66.7); // 2/3
    assert.equal(all.validRides, 5);
    assert.equal(all.totalDistanceKm, 5);
    assert.equal(all.newRoadClaimRatio, 0.4); // 2000/5000
  });

  it("코호트별로 갈린다 (Auth 에 없는 uid 의 주행은 guest)", () => {
    const accounts = new Map<string, AccountInfo>([
      ["g", acct("guest")],
      ["p", acct("provider")],
    ]);
    const rides = [ride("g", NOW - DAY), ride("p", NOW - DAY), ride("ghost", NOW - DAY)];
    const { metrics } = aggregateRideMetrics({ accounts, rides, excludeUids: NONE, nowMs: NOW });
    assert.equal(metrics.provider.accounts, 1);
    assert.equal(metrics.provider.validRides, 1);
    assert.equal(metrics.guest.accounts, 2); // g + ghost
    assert.equal(metrics.guest.validRides, 2);
    assert.equal(metrics.all.accounts, 3);
  });
});

describe("분모 0 은 null", () => {
  it("계정이 없으면 모든 비율이 null", () => {
    const { metrics } = aggregateRideMetrics({
      accounts: new Map(),
      rides: [],
      excludeUids: NONE,
      nowMs: NOW,
    });
    assert.equal(metrics.all.accounts, 0);
    assert.equal(metrics.all.firstRideCompletionRatePct, null);
    assert.equal(metrics.all.secondRideWithin72hRatePct, null);
    assert.equal(metrics.all.otherDayReuseRatePct, null);
    assert.equal(metrics.all.newRoadClaimRatio, null);
  });

  it("계정은 있으나 유효 주행이 없으면 첫 주행 완료율 0, 나머지는 null", () => {
    const { metrics } = aggregateRideMetrics({
      accounts: new Map([["a", acct("provider")]]),
      rides: [],
      excludeUids: NONE,
      nowMs: NOW,
    });
    assert.equal(metrics.provider.firstRideCompletionRatePct, 0);
    assert.equal(metrics.provider.secondRideWithin72hRatePct, null);
    assert.equal(metrics.provider.otherDayReuseRatePct, null);
    assert.equal(metrics.provider.newRoadClaimRatio, null);
    // 계정 0 인 코호트
    assert.equal(metrics.guest.firstRideCompletionRatePct, null);
  });
});

describe("내부 계정 제외", () => {
  it("제외 uid 는 metrics·recent 모두에서 빠지고 excludedAccounts 로만 센다", () => {
    const accounts = new Map<string, AccountInfo>([
      ["admin", acct("provider", NOW - HOUR)],
      ["user", acct("provider", NOW - HOUR)],
    ]);
    const rides = [ride("admin", NOW - HOUR), ride("user", NOW - HOUR)];
    const withExclude = aggregateRideMetrics({
      accounts,
      rides,
      excludeUids: new Set(["admin", "not-in-auth"]),
      nowMs: NOW,
    });
    assert.equal(withExclude.excludedAccounts, 1);
    assert.equal(withExclude.metrics.all.accounts, 1);
    assert.equal(withExclude.metrics.all.validRides, 1);
    assert.equal(withExclude.recent.today.signups, 1);
    assert.equal(withExclude.recent.today.rides, 1);

    const without = aggregateRideMetrics({ accounts, rides, excludeUids: NONE, nowMs: NOW });
    assert.equal(without.excludedAccounts, 0);
    assert.equal(without.metrics.all.accounts, 2);
    assert.equal(without.recent.today.signups, 2);
    assert.equal(without.recent.today.rides, 2);
  });

  it("Auth 에서 이미 지워진 제외 uid 의 주행도 되살아나지 않는다", () => {
    const { metrics, recent } = aggregateRideMetrics({
      accounts: new Map(),
      rides: [ride("gone-admin", NOW - HOUR)],
      excludeUids: new Set(["gone-admin"]),
      nowMs: NOW,
    });
    assert.equal(metrics.all.accounts, 0);
    assert.equal(metrics.all.validRides, 0);
    assert.equal(recent.today.rides, 0);
  });
});

describe("폐기 기준 미만 주행", () => {
  it("거리·시간 기준 이하는 빠지고 폐기 건수로만 센다", () => {
    const accounts = new Map<string, AccountInfo>([
      ["a", acct("guest")],
      ["b", acct("guest")],
    ]);
    const rides = [
      ride("a", NOW - HOUR, { distanceMeters: 100 }), // 거리 기준 이하(100 이하)
      ride("a", NOW - HOUR, { elapsedSec: 5 }), // 시간 기준 이하(5초 이하)
      ride("b", NOW - HOUR, { distanceMeters: Number.NaN }), // 숫자 아님
      ride("b", NOW - HOUR, { distanceMeters: 101, elapsedSec: 6 }), // 간신히 유효
    ];
    const agg = aggregateRideMetrics({ accounts, rides, excludeUids: NONE, nowMs: NOW });
    assert.equal(agg.discardedRides, 3);
    assert.equal(agg.validRides, 1);
    assert.equal(agg.metrics.all.accountsWithValidRide, 1);
    assert.equal(agg.metrics.all.validRides, 1);
    assert.equal(agg.recent.today.rides, 1);
  });

  it("시각을 읽을 수 없는 주행은 유효로 세지 않는다", () => {
    const agg = aggregateRideMetrics({
      accounts: new Map([["a", acct("guest")]]),
      rides: [ride("a", null)],
      excludeUids: NONE,
      nowMs: NOW,
    });
    assert.equal(agg.validRides, 0);
    assert.equal(agg.metrics.all.accountsWithValidRide, 0);
  });
});

describe("최근 현황 (KST 날짜 경계)", () => {
  it("15:00 UTC 전후로 어제·오늘이 갈린다", () => {
    const accounts = new Map<string, AccountInfo>([
      ["before", acct("guest", KST_MIDNIGHT - 1)],
      ["after", acct("guest", KST_MIDNIGHT)],
    ]);
    const rides = [
      ride("before", KST_MIDNIGHT - 1, { distanceMeters: 2000 }),
      ride("after", KST_MIDNIGHT, { distanceMeters: 3000 }),
    ];
    const { recent } = aggregateRideMetrics({ accounts, rides, excludeUids: NONE, nowMs: NOW });
    assert.deepEqual(recent.today, { signups: 1, rides: 1, distanceKm: 3 });
    assert.deepEqual(recent.last7Days, { signups: 2, rides: 2, distanceKm: 5 });
  });

  it("최근 7일 = 오늘 포함 7개 KST 날짜", () => {
    const sixDaysAgo = KST_MIDNIGHT - 6 * DAY; // 7일 창의 첫 순간
    const accounts = new Map<string, AccountInfo>([
      ["in", acct("guest", sixDaysAgo)],
      ["out", acct("guest", sixDaysAgo - 1)],
      ["nodate", acct("guest", null)],
    ]);
    const rides = [
      ride("in", sixDaysAgo),
      ride("out", sixDaysAgo - 1),
    ];
    const { recent } = aggregateRideMetrics({ accounts, rides, excludeUids: NONE, nowMs: NOW });
    assert.equal(recent.last7Days.signups, 1);
    assert.equal(recent.last7Days.rides, 1);
    assert.equal(recent.today.signups, 0);
    assert.equal(recent.today.rides, 0);
  });
});

describe("응답 계약 모양", () => {
  it("계약의 키만 담고 내부 전용 필드는 싣지 않는다", () => {
    const agg = aggregateRideMetrics({
      accounts: new Map([["a", acct("guest", NOW)]]),
      rides: [ride("a", NOW)],
      excludeUids: new Set(["x"]),
      nowMs: NOW,
    });
    const payload = buildAdminDashboardPayload(agg, NOW, 2);
    assert.equal(payload.generatedAt, new Date(NOW).toISOString());
    assert.equal(payload.excludedAccounts, 0);
    assert.deepEqual(payload.rule, { minRideDistanceMeters: 100, minRideDurationSec: 5 });
    assert.deepEqual(payload.health, { pendingPublicRouteRequests: 2 });
    assert.deepEqual(Object.keys(payload).sort(), [
      "excludedAccounts",
      "generatedAt",
      "health",
      "metrics",
      "recent",
      "rule",
    ]);
    assert.deepEqual(Object.keys(payload.metrics.all).sort(), [
      "accounts",
      "accountsWithValidRide",
      "firstRideCompletionRatePct",
      "newRoadClaimRatio",
      "otherDayReuseRatePct",
      "secondRideWithin72hRatePct",
      "totalDistanceKm",
      "validRides",
    ]);
    assert.deepEqual(Object.keys(payload.recent), ["today", "last7Days"]);
  });
});

// 2026-10-23 감리: 정규식에서 \s 가 빠져 정상 토큰도 401 이 되던 결함 재발 방지
import { parseBearerToken } from "./adminDashboard.js";
it("parseBearerToken — Bearer 뒤 공백으로 토큰을 꺼낸다", () => {
  assert.equal(parseBearerToken("Bearer abc.def"), "abc.def");
  assert.equal(parseBearerToken("bearer   xyz"), "xyz");
  assert.equal(parseBearerToken("Bearers abc"), null);
  assert.equal(parseBearerToken(""), null);
  assert.equal(parseBearerToken(undefined), null);
});
