// 실제 세션 anchor 계약(RIDE-CONTINUE-1 §7.1) — 계획 종점이 아니라 **실제 종료 지점**이
// 다음 출발점이 되는지 고정한다. Firebase·브라우저 없이 순수 함수만 검증한다.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeRideSessionAnchors,
  EMPTY_RIDE_SESSION_ANCHORS,
} from "../../src/lib/rideSessionAnchors.ts";
import {
  distanceOnRouteByProjectedPoint,
  getDistanceMeters,
  lineStringLengthMeters,
  type LineStringGeometry,
} from "../../src/lib/geo.ts";

/** 위도 37.5 를 따라 동쪽으로 뻗는 11점 폴리라인(약 880 m) */
function makeRoute(points = 11): LineStringGeometry {
  const coords: [number, number][] = [];
  for (let i = 0; i < points; i += 1) {
    coords.push([127.0 + i * 0.001, 37.5]);
  }
  return { type: "LineString", coordinates: coords };
}

const ROUTE = makeRoute();
const GEO_LEN = lineStringLengthMeters(ROUTE);

/**
 * M0 — 계측 자가 검산. 시험이 쓰는 좌표계 자체가 퇴화(길이 0·NaN)면 아래 단언은
 * 전부 자동 통과하는 축퇴 게이트가 된다. 먼저 길이가 실재하는지 확인한다.
 */
describe("M0 · 시험 fixture 자가 검산", () => {
  it("경로 전장이 유의미하다", () => {
    assert.ok(Number.isFinite(GEO_LEN), "전장이 유한하지 않다");
    assert.ok(GEO_LEN > 500, `전장이 너무 짧다: ${GEO_LEN}`);
  });
});

describe("computeRideSessionAnchors", () => {
  it("0% 시작 → 첫 좌표", () => {
    const a = computeRideSessionAnchors({
      geometry: ROUTE,
      routeDistanceMeters: GEO_LEN,
      startOffsetMeters: 0,
      endVirtualDistanceMeters: GEO_LEN * 0.5,
    });
    assert.ok(a.sessionStartLngLat);
    assert.ok(getDistanceMeters(a.sessionStartLngLat!, ROUTE.coordinates[0]) < 0.5);
    assert.equal(a.sessionStartRouteMeters, 0);
    assert.equal(a.sessionStartProgressRatio, 0);
  });

  it("31% 시작 → geometry 거리 31% 지점", () => {
    const target = GEO_LEN * 0.31;
    const a = computeRideSessionAnchors({
      geometry: ROUTE,
      routeDistanceMeters: GEO_LEN,
      startOffsetMeters: target,
      endVirtualDistanceMeters: GEO_LEN * 0.43,
    });
    assert.ok(a.sessionStartLngLat);
    const measured = distanceOnRouteByProjectedPoint(ROUTE, a.sessionStartLngLat!);
    assert.ok(measured != null && Math.abs(measured - target) < 1, `측정 ${measured} vs ${target}`);
    assert.ok(Math.abs(a.sessionStartProgressRatio - 0.31) < 0.005);
  });

  it("43% 종료 → geometry 거리 43% 지점", () => {
    const target = GEO_LEN * 0.43;
    const a = computeRideSessionAnchors({
      geometry: ROUTE,
      routeDistanceMeters: GEO_LEN,
      startOffsetMeters: GEO_LEN * 0.31,
      endVirtualDistanceMeters: target,
    });
    assert.ok(a.sessionEndLngLat);
    const measured = distanceOnRouteByProjectedPoint(ROUTE, a.sessionEndLngLat!);
    assert.ok(measured != null && Math.abs(measured - target) < 1, `측정 ${measured} vs ${target}`);
    assert.ok(Math.abs(a.sessionEndProgressRatio - 0.43) < 0.005);
  });

  it("100% 종료 → 마지막 좌표", () => {
    const a = computeRideSessionAnchors({
      geometry: ROUTE,
      routeDistanceMeters: GEO_LEN,
      startOffsetMeters: 0,
      endVirtualDistanceMeters: GEO_LEN,
    });
    const last = ROUTE.coordinates[ROUTE.coordinates.length - 1];
    assert.ok(a.sessionEndLngLat);
    assert.ok(getDistanceMeters(a.sessionEndLngLat!, last) < 0.5);
    assert.ok(Math.abs(a.sessionEndProgressRatio - 1) < 1e-9);
  });

  it("routeDistance 와 geometry 길이가 달라도 rideDistanceAlongRoute 와 같은 캡을 쓴다", () => {
    // Directions 거리(routeDistance)가 geometry 보다 짧으면 그 값이 상한이다.
    const shortRouteDistance = GEO_LEN * 0.6;
    const a = computeRideSessionAnchors({
      geometry: ROUTE,
      routeDistanceMeters: shortRouteDistance,
      startOffsetMeters: 0,
      endVirtualDistanceMeters: GEO_LEN * 10,
    });
    assert.ok(Math.abs(a.sessionEndRouteMeters - shortRouteDistance) < 1e-6);
    const measured = distanceOnRouteByProjectedPoint(ROUTE, a.sessionEndLngLat!);
    assert.ok(measured != null && Math.abs(measured - shortRouteDistance) < 1);
  });

  it("NaN·음수·초과 입력을 clamp 한다", () => {
    const a = computeRideSessionAnchors({
      geometry: ROUTE,
      routeDistanceMeters: GEO_LEN,
      startOffsetMeters: Number.NaN,
      endVirtualDistanceMeters: -500,
    });
    assert.equal(a.sessionStartRouteMeters, 0);
    assert.equal(a.sessionEndRouteMeters, 0);
    assert.equal(a.sessionStartProgressRatio, 0);
    assert.equal(a.sessionEndProgressRatio, 0);

    const b = computeRideSessionAnchors({
      geometry: ROUTE,
      routeDistanceMeters: GEO_LEN,
      startOffsetMeters: GEO_LEN * 5,
      endVirtualDistanceMeters: GEO_LEN * 9,
    });
    assert.ok(b.sessionEndProgressRatio <= 1);
    assert.ok(b.sessionEndRouteMeters >= b.sessionStartRouteMeters, "end 는 start 이상이어야 한다");
  });

  it("end < start 로 들어와도 end ≥ start 를 지킨다", () => {
    const a = computeRideSessionAnchors({
      geometry: ROUTE,
      routeDistanceMeters: GEO_LEN,
      startOffsetMeters: GEO_LEN * 0.5,
      endVirtualDistanceMeters: GEO_LEN * 0.2,
    });
    assert.ok(a.sessionEndRouteMeters >= a.sessionStartRouteMeters);
  });

  it("geometry 가 없으면 좌표는 null 이고 Ride 저장을 막지 않는다", () => {
    assert.deepEqual(
      computeRideSessionAnchors({
        geometry: null,
        routeDistanceMeters: 1000,
        startOffsetMeters: 0,
        endVirtualDistanceMeters: 500,
      }),
      EMPTY_RIDE_SESSION_ANCHORS,
    );
    assert.deepEqual(
      computeRideSessionAnchors({
        geometry: { type: "LineString", coordinates: [[127, 37.5]] },
        routeDistanceMeters: 1000,
        startOffsetMeters: 0,
        endVirtualDistanceMeters: 500,
      }),
      EMPTY_RIDE_SESSION_ANCHORS,
    );
  });
});
