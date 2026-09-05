// 짧은 클릭 안내 계약 — 5A-R2c §1·§2 (원 하나 = D, 도넛 폐기).
//
// `road < D − 5m` 를 우회로 채우면 같은 도로를 되밟아 정복을 잃는다
// (5A-1 실측: detoured 평균 3.7 % · 최대 17.1 % 중복). 채우지 않고 **안내하고 실패**시킨다.
// Token 은 호출부가 환불한다.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  EXACT_TARGET_DISTANCE_TOLERANCE_M,
  formatDistanceAutoRouteTooCloseMessage,
  getDistanceMeters,
  lineStringLengthMeters,
  offsetLngLatByBearingMeters,
  searchDistanceAutoRoute,
  type FetchDirectionsFn,
  type LngLat,
} from "../../../../functions/src/distanceAutoRouteCore.ts";
import { resolveDistanceAutoRouteGuideRadiusKm } from "../../src/lib/distanceAutoRouteGuideRing.ts";
import {
  formatDistanceAutoRouteDirectionClickHint,
  DISTANCE_AUTO_ROUTE_DEFAULT_KM,
} from "../../src/lib/distanceAutoRouteErrors.ts";

const START: LngLat = [127.02, 37.5];
const D = 1000;

/** 직선 mock — 도로거리 = 직선거리(λ = 1.0). 가장 유리한 조건이다. */
function straightProvider(roadMetersFor: (straightM: number) => number): FetchDirectionsFn {
  return async (_p, waypoints) => {
    const end = waypoints[waypoints.length - 1]!;
    const straightM = getDistanceMeters(waypoints[0]!, end);
    const roadM = roadMetersFor(straightM);
    // geometry 는 요청 길이 이상으로, provider distance 는 **정확히** 요청값으로 준다.
    // D−5 는 `|road − D| ≤ 5` 의 칼날 위라, 폴리라인 반올림이 판정을 뒤집는다.
    const far = offsetLngLatByBearingMeters(waypoints[0]!, 90, roadM + 2);
    const geometry = { type: "LineString" as const, coordinates: [waypoints[0]!, far] };
    return {
      geometry,
      distance: roadM,
      duration: 600,
      snappedEnd: end,
      endSnapDistanceMeters: 0,
    };
  };
}

describe("M0 · 시험 자가 검산", () => {
  it("허용오차 경계가 살아 있다", () => {
    assert.equal(EXACT_TARGET_DISTANCE_TOLERANCE_M, 5);
  });

  it("mock 이 요청한 도로거리를 실제로 돌려준다", async () => {
    const fetchDirections = straightProvider(() => 800);
    const r = await fetchDirections("driving", [START, offsetLngLatByBearingMeters(START, 90, 500)]);
    assert.equal(r.distance, 800);
    assert.ok(lineStringLengthMeters(r.geometry) >= 800, "geometry 가 도로거리보다 짧다");
  });
});

describe("§1 · road < D − 5m 는 안내하고 실패한다", () => {
  it("우회를 호출하지 않고 provider 1회로 끝난다", async () => {
    let calls = 0;
    let threeWaypoint = 0;
    const inner: FetchDirectionsFn = async (p, w) => {
      calls += 1;
      if (w.length === 3) threeWaypoint += 1;
      return straightProvider(() => 800)(p, w);
    };
    const r = await searchDistanceAutoRoute({
      start: START,
      targetRoadPoint: offsetLngLatByBearingMeters(START, 90, 800),
      profile: "driving",
      targetDistanceMeters: D,
      bearingDeg: 90,
      fetchDirections: inner,
    });
    assert.equal(r.status, "failed");
    assert.equal(calls, 1, `provider ${calls}회`);
    assert.equal(threeWaypoint, 0, "우회를 호출했다");
  });

  it("문구에 실측 도로거리와 목표가 들어간다 — 막연한 「더 멀리」가 아니다", () => {
    const msg = formatDistanceAutoRouteTooCloseMessage(1234, 3000);
    assert.match(msg, /너무 가깝습니다/);
    assert.match(msg, /1\.2 km/);
    assert.match(msg, /3\.0 km/);
    assert.match(msg, /원 주변이나 바깥/);
    assert.doesNotMatch(msg, /더 멀리/);
  });

  it("허용오차 안(road ∈ [D−5, D))은 실패하지 않는다 — exact 로 채택된다", async () => {
    for (const roadM of [D - EXACT_TARGET_DISTANCE_TOLERANCE_M, D - 1]) {
      const r = await searchDistanceAutoRoute({
        start: START,
        targetRoadPoint: offsetLngLatByBearingMeters(START, 90, roadM),
        profile: "driving",
        targetDistanceMeters: D,
        bearingDeg: 90,
        fetchDirections: straightProvider(() => roadM),
      });
      assert.equal(r.status, "found", `road ${roadM}m 가 실패했다`);
      if (r.status !== "found") return;
      assert.equal(r.outcome, "exact");
    }
  });

  it("경계 바로 밖(road = D − 6m)은 실패한다", async () => {
    const roadM = D - EXACT_TARGET_DISTANCE_TOLERANCE_M - 1;
    const r = await searchDistanceAutoRoute({
      start: START,
      targetRoadPoint: offsetLngLatByBearingMeters(START, 90, roadM),
      profile: "driving",
      targetDistanceMeters: D,
      bearingDeg: 90,
      fetchDirections: straightProvider(() => roadM),
    });
    assert.equal(r.status, "failed");
  });
});

describe("§2 · 원 하나 = D (§5.3)", () => {
  it("원 반지름 = D. 다른 값이 아니다", () => {
    for (const targetKm of [0.5, 0.7, 3, 5, 20, 120]) {
      const r = resolveDistanceAutoRouteGuideRadiusKm(targetKm);
      assert.equal(r, targetKm, `원 반지름이 D 가 아니다: ${r}`);
    }
  });

  it("직선거리 ≥ D 이면 「너무 가까움」이 원리적으로 불가능하다 — 전수 확인", async () => {
    // 도로거리 ≥ 직선거리(λ ≥ 1)이므로 반례가 있으면 안 된다.
    for (const straightM of [1000, 1001, 1200, 1500, 3000]) {
      for (const lambda of [1.0, 1.2, 1.5, 2.0]) {
        const r = await searchDistanceAutoRoute({
          start: START,
          targetRoadPoint: offsetLngLatByBearingMeters(START, 90, straightM),
          profile: "driving",
          targetDistanceMeters: D,
          bearingDeg: 90,
          fetchDirections: straightProvider((s) => s * lambda),
        });
        assert.notEqual(
          r.status,
          "failed",
          `직선 ${straightM}m · λ ${lambda} 에서 실패했다 — 부등식 반례`,
        );
      }
    }
  });

  it("퇴화 입력에서도 유한한 반지름을 준다", () => {
    for (const v of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const r = resolveDistanceAutoRouteGuideRadiusKm(v);
      assert.ok(Number.isFinite(r) && r > 0, `radius ${r}`);
    }
  });

  it("목표 km 변경 시 안내 문구 `{N}` 이 함께 갱신된다", () => {
    assert.equal(
      formatDistanceAutoRouteDirectionClickHint(3),
      "3.0 km 반경의 원 주변 도로를 선택하세요",
    );
    assert.equal(
      formatDistanceAutoRouteDirectionClickHint(12.5),
      "12.5 km 반경의 원 주변 도로를 선택하세요",
    );
    assert.equal(
      formatDistanceAutoRouteDirectionClickHint(DISTANCE_AUTO_ROUTE_DEFAULT_KM),
      "5.0 km 반경의 원 주변 도로를 선택하세요",
    );
    // 반지름도 같은 D
    assert.equal(resolveDistanceAutoRouteGuideRadiusKm(12.5), 12.5);
  });
});

describe("§5.4 · 직선 ≥ D 는 우회를 호출하지 않는다", () => {
  it("직선 ≥ D 에서 3-waypoint(우회) 호출 0회", async () => {
    // λ=1 이면 road=straight ≥ D → 부족분 없음 → 우회 불필요.
    for (const straightM of [D, D + 1, Math.round(D * 1.1), Math.round(D * 1.5), D * 2]) {
      let calls = 0;
      let threeWaypoint = 0;
      const fetchDirections: FetchDirectionsFn = async (p, w) => {
        calls += 1;
        if (w.length === 3) threeWaypoint += 1;
        return straightProvider((s) => s)(p, w);
      };
      const r = await searchDistanceAutoRoute({
        start: START,
        targetRoadPoint: offsetLngLatByBearingMeters(START, 90, straightM),
        profile: "driving",
        targetDistanceMeters: D,
        bearingDeg: 90,
        fetchDirections,
      });
      assert.notEqual(r.status, "failed", `직선 ${straightM}m 가 실패했다`);
      assert.equal(threeWaypoint, 0, `직선 ${straightM}m 에서 우회 ${threeWaypoint}회`);
      assert.ok(calls >= 1, `provider 호출 없음`);
    }
  });
});
