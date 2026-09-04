// 절단 경계 계약 — 2026-09-03 폰 실사용 결함 ①.
//
// `clipRouteGeometryToTargetMeters` 는 `totalLength < D` 를 엄격 부등호로 실패시키고,
// shortfall 가드는 `routeLen < D − 5m` 일 때만 걸렸다. 그 사이 `routeLen ∈ [D−5m, D)` 가
// 어디에도 걸리지 않아, **이미 ±5m 허용오차를 만족하는 정상 경로**가 「경로 절단에
// 실패했습니다」로 떨어졌다. 원인이 경계값이므로 경계에서 시험한다.
//
// provider 가 보고하는 `distance` 와 geometry 폴리라인 길이는 같지 않다. 이 어긋남이
// 그 구간을 만든다 — fixture 도 그렇게 만든다(distance ≥ D, geometry 길이는 경계값).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  EXACT_TARGET_DISTANCE_TOLERANCE_M,
  ROUTE_CLIP_FAILED_MESSAGE,
  isExactTargetDistance,
  getDistanceMeters,
  lineStringLengthMeters,
  offsetLngLatByBearingMeters,
  searchDistanceAutoRoute,
  type DirectionsRouteLike,
  type FetchDirectionsFn,
  type LngLat,
} from "../../../../functions/src/distanceAutoRouteCore.ts";

const START: LngLat = [127.02, 37.5];
const D = 3000;
const TOL = EXACT_TARGET_DISTANCE_TOLERANCE_M;

/**
 * 지정 길이의 직선 geometry — 꼭짓점을 여러 개 두어 절단 루프를 실제로 돌린다.
 *
 * **길이를 요청값 이상으로 수렴시킨다.** `D − 허용오차` 는 `|len − D| ≤ 5` 의 칼날 위라,
 * 폴리라인 길이가 부동소수 잡음으로 요청값을 조금만 밑돌면(2994.99999) 허용오차 **밖**이
 * 되어 시험이 의도와 다른 분기를 재게 된다. 안쪽에서 수렴시켜 경계를 결정론적으로 만든다.
 * 칼날의 반대쪽은 아래 「허용오차 바로 밖」 시험이 따로 고정한다.
 */
function straight(origin: LngLat, bearingDeg: number, totalMeters: number, segments = 30) {
  const build = (step: number) => {
    const coords: LngLat[] = [origin];
    let current = origin;
    for (let i = 1; i <= segments; i += 1) {
      current = offsetLngLatByBearingMeters(current, bearingDeg, step);
      coords.push(current);
    }
    return { type: "LineString" as const, coordinates: coords };
  };
  let step = totalMeters / segments;
  let geometry = build(step);
  for (let i = 0; i < 4; i += 1) {
    const len = lineStringLengthMeters(geometry);
    if (len >= totalMeters) break;
    step *= (totalMeters / len) * (1 + 1e-12);
    geometry = build(step);
  }
  return geometry;
}

/** geometry 길이와 provider 보고 distance 를 따로 지정한다 */
function route(geometryMeters: number, reportedDistance: number): DirectionsRouteLike {
  const geometry = straight(START, 90, geometryMeters);
  return {
    geometry,
    distance: reportedDistance,
    duration: 600,
    snappedEnd: geometry.coordinates[geometry.coordinates.length - 1]!,
    endSnapDistanceMeters: 0,
  };
}

describe("M0 · fixture 자가 검산", () => {
  it("geometry 길이가 요청한 값과 맞다(경계 시험의 전제)", () => {
    for (const target of [D - TOL, D - 1, D, D + 1]) {
      const len = lineStringLengthMeters(straight(START, 90, target));
      assert.ok(Math.abs(len - target) < 0.5, `${target}m 요청에 ${len.toFixed(2)}m`);
      assert.ok(len >= target, `요청값을 밑돌면 칼날 밖으로 밀린다: ${len.toFixed(6)}m`);
    }
  });

  it("provider distance 와 geometry 길이를 독립적으로 줄 수 있다", () => {
    const r = route(D - 1, D + 50);
    assert.equal(r.distance, D + 50);
    assert.ok(Math.abs(lineStringLengthMeters(r.geometry) - (D - 1)) < 0.5);
  });

  it("경계값 D−5 는 허용오차 안, D−6 은 밖이다", () => {
    assert.ok(isExactTargetDistance(D - TOL, D), "D−5 가 허용오차 밖이면 시험 전제가 깨진다");
    assert.ok(!isExactTargetDistance(D - TOL - 1, D));
  });
});

describe("결함 ① · Stage 0 exact 경계 — routeLen ∈ [D−5, D) 가 실패하지 않는다", () => {
  // provider distance = D+50 ∈ [D, D+150] → Stage 0 exact 로 조기 종료(우회 없음).
  // geometry 길이만 경계값으로 흔든다.
  for (const routeLen of [D - TOL, D - 1, D, D + 1]) {
    it(`routeLen ${routeLen}m (D${routeLen - D >= 0 ? "+" : "−"}${Math.abs(routeLen - D)}) → exact`, async () => {
      const geometryEnd = straight(START, 90, routeLen).coordinates.at(-1)!;
      const fetchDirections: FetchDirectionsFn = async () => route(routeLen, D + 50);

      const searched = await searchDistanceAutoRoute({
        start: START,
        targetRoadPoint: geometryEnd,
        profile: "cycling",
        targetDistanceMeters: D,
        bearingDeg: 90,
        fetchDirections,
      });

      assert.equal(searched.status, "found", `실패했다: ${searched.status === "failed" ? searched.message : ""}`);
      if (searched.status !== "found") return;
      assert.notEqual(searched.status, "failed");
      assert.equal(searched.outcome, "exact", `outcome 이 ${searched.outcome}`);
      assert.ok(
        isExactTargetDistance(searched.distance, D),
        `허용오차 밖이다: ${searched.distance.toFixed(2)}m`,
      );
      assert.equal(searched.providerCallCount ?? 1, 1, "우회 탐색이 돌았다");
    });
  }
});

/**
 * 실제 우회 모양의 geometry — START → 북쪽 정점 → 클릭점. 총 폴리라인 길이가 `totalMeters`
 * 가 되도록 정점 높이를 이분법으로 맞춘다.
 *
 * 왜 이렇게까지 하나: `snappedEndFromRoute` 는 route 의 `snappedEnd` 가 아니라 **geometry 의
 * 마지막 좌표**를 끝점으로 쓴다(`distanceAutoRouteCore.ts:254`). 그래서 geometry 가 클릭점을
 * 지나쳐 끝나면 `endMiss > 200m` 로 `offered` 강등 게이트에 걸려, 경계 시험이 아니라 강등
 * 시험이 된다. 우회는 클릭점에서 끝나야 한다.
 */
function detourGeometry(origin: LngLat, clickPoint: LngLat, totalMeters: number) {
  const build = (apexNorthM: number) => {
    const apex = offsetLngLatByBearingMeters(origin, 0, apexNorthM);
    return { type: "LineString" as const, coordinates: [origin, apex, clickPoint] };
  };
  let lo = 0;
  let hi = totalMeters;
  for (let i = 0; i < 80; i += 1) {
    const mid = (lo + hi) / 2;
    if (lineStringLengthMeters(build(mid)) < totalMeters) lo = mid;
    else hi = mid;
  }
  // 중앙값이 아니라 상한을 돌린다 — 길이가 요청값 이상이어야 허용오차 안쪽에 든다.
  return build(hi);
}

// 5A-R2 §1 로 `road < D − 5m` 는 우회 대신 안내·실패가 되어, **우회 경로로 절단 경계에
// 도달할 수 없다.** 그 그룹(우회 routeLen D−5 · D−1)은 도달 불가능해져 삭제했다.
// 경계 계약 자체는 위 Stage 0 그룹이 그대로 지킨다 — provider distance 와 폴리라인 길이가
// 어긋나는 상황은 우회가 아니어도 발생하고, 그것이 결함 ①의 본질이었다.

describe("결함 ① · 실패 분기는 provider 응답이 망가진 경우에만 남는다", () => {
  it("빈 geometry → 실패(문구 유지). shortfall 로 새지 않는다", async () => {
    const fetchDirections: FetchDirectionsFn = async () => ({
      geometry: { type: "LineString" as const, coordinates: [] },
      distance: D + 50,
      duration: 600,
      snappedEnd: offsetLngLatByBearingMeters(START, 90, D),
      endSnapDistanceMeters: 0,
    });

    const searched = await searchDistanceAutoRoute({
      start: START,
      targetRoadPoint: offsetLngLatByBearingMeters(START, 90, D),
      profile: "cycling",
      targetDistanceMeters: D,
      bearingDeg: 90,
      fetchDirections,
    });

    assert.equal(searched.status, "failed");
    if (searched.status !== "failed") return;
    assert.equal(searched.message, ROUTE_CLIP_FAILED_MESSAGE, "문구를 감추면 안 된다");
  });

  it("좌표 1개 geometry → 실패(문구 유지)", async () => {
    const fetchDirections: FetchDirectionsFn = async () => ({
      geometry: { type: "LineString" as const, coordinates: [START] },
      distance: D + 50,
      duration: 600,
      snappedEnd: START,
      endSnapDistanceMeters: 0,
    });

    const searched = await searchDistanceAutoRoute({
      start: START,
      targetRoadPoint: offsetLngLatByBearingMeters(START, 90, D),
      profile: "cycling",
      targetDistanceMeters: D,
      bearingDeg: 90,
      fetchDirections,
    });

    assert.equal(searched.status, "failed");
    if (searched.status !== "failed") return;
    assert.equal(searched.message, ROUTE_CLIP_FAILED_MESSAGE);
  });

  it("허용오차보다 더 짧으면 shortfall — 실패 문구가 아니다", async () => {
    const routeLen = D - TOL - 50;
    const geometryEnd = straight(START, 90, routeLen).coordinates.at(-1)!;
    const fetchDirections: FetchDirectionsFn = async () => route(routeLen, D + 50);

    const searched = await searchDistanceAutoRoute({
      start: START,
      targetRoadPoint: geometryEnd,
      profile: "cycling",
      targetDistanceMeters: D,
      bearingDeg: 90,
      fetchDirections,
    });

    assert.equal(searched.status, "found");
    if (searched.status !== "found") return;
    assert.equal(searched.outcome, "shortfall");
    // 죽은 가지였던 「directRoute 재절단 → offered」로 가지 않는다.
    assert.notEqual(searched.outcome, "offered");
  });
});

describe("결함 ① · 허용오차 바로 밖 — 칼날의 반대쪽", () => {
  // 안쪽(D−5)이 exact 로 통과한다고 해서 밖까지 통과하면 허용오차를 넓힌 것과 같다.
  // §8 「EXACT_TARGET_DISTANCE_TOLERANCE_M 를 키워 덮지 않는다」의 시험 형태다.
  it(`routeLen D−${TOL + 1}m 는 exact 가 아니라 shortfall 이다`, async () => {
    const routeLen = D - TOL - 1;
    const geometryEnd = straight(START, 90, routeLen).coordinates.at(-1)!;
    const fetchDirections: FetchDirectionsFn = async () => route(routeLen, D + 50);

    const searched = await searchDistanceAutoRoute({
      start: START,
      targetRoadPoint: geometryEnd,
      profile: "cycling",
      targetDistanceMeters: D,
      bearingDeg: 90,
      fetchDirections,
    });

    assert.equal(searched.status, "found");
    if (searched.status !== "found") return;
    assert.equal(searched.outcome, "shortfall", "허용오차가 넓어졌다");
  });

  it("허용오차 상수는 5m 그대로다", () => {
    assert.equal(EXACT_TARGET_DISTANCE_TOLERANCE_M, 5, "상수를 키워 덮었다");
  });
});
