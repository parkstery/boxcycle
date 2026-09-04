// 짧은 클릭 안내 계약 — 5A-R2 §1·§2.
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
import {
  DISTANCE_AUTO_ROUTE_GUIDE_INNER_RATIO,
  resolveDistanceAutoRouteGuideRadii,
} from "../../src/lib/distanceAutoRouteGuideRing.ts";

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
    assert.match(msg, /1\.2 km/);
    assert.match(msg, /3\.0 km/);
    assert.match(msg, /바깥 원/);
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

describe("§2 · 도넛 — 바깥 원은 D 다(부등식에서 나온 값)", () => {
  it("바깥 원 반지름 = D. 다른 값이 아니다", () => {
    for (const targetKm of [0.5, 0.7, 3, 5, 20, 120]) {
      const r = resolveDistanceAutoRouteGuideRadii(targetKm);
      assert.equal(r.outerKm, targetKm, `바깥 원이 D 가 아니다: ${r.outerKm}`);
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

  it("안쪽 원 = D / λ_max 이고 바깥보다 작다", () => {
    const r = resolveDistanceAutoRouteGuideRadii(3);
    assert.ok(r.innerKm < r.outerKm);
    assert.ok(
      Math.abs(r.innerKm - 3 / DISTANCE_AUTO_ROUTE_GUIDE_INNER_RATIO) < 1e-9,
      `${r.innerKm}`,
    );
  });

  it("퇴화 입력에서도 유한한 반지름을 준다", () => {
    for (const v of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const r = resolveDistanceAutoRouteGuideRadii(v);
      assert.ok(Number.isFinite(r.outerKm) && r.outerKm > 0, `outer ${r.outerKm}`);
      assert.ok(Number.isFinite(r.innerKm) && r.innerKm > 0, `inner ${r.innerKm}`);
      assert.ok(r.innerKm < r.outerKm);
    }
  });
});
