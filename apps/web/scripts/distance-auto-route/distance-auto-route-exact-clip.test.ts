import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clipRouteGeometryToTargetMeters,
  EXACT_TARGET_DISTANCE_TOLERANCE_M,
  getDistanceMeters,
  lineStringLengthMeters,
  offsetLngLatByBearingMeters,
  pickBestExactDistanceAutoRoute,
  scoreRouteExcessMeters,
  snappedEndFromRoute,
  type DirectionsRouteLike,
  type LngLat,
  type ScoredAutoRoute,
} from "../../../../functions/src/distanceAutoRouteCore.ts";

const ORIGIN: LngLat = [127.02, 37.5];

function straightRouteGeometry(
  origin: LngLat,
  bearingDeg: number,
  totalMeters: number,
  segments = 24,
): DirectionsRouteLike["geometry"] {
  const coords: LngLat[] = [origin];
  const step = totalMeters / segments;
  let current = origin;
  for (let i = 1; i <= segments; i += 1) {
    current = offsetLngLatByBearingMeters(current, bearingDeg, step);
    coords.push(current);
  }
  return { type: "LineString", coordinates: coords };
}

function scoredRoute(
  bearingDeg: number,
  totalMeters: number,
  targetMeters: number,
): ScoredAutoRoute {
  const geometry = straightRouteGeometry(ORIGIN, bearingDeg, totalMeters);
  const end = geometry.coordinates[geometry.coordinates.length - 1]!;
  return {
    candidate: { end, bearingDeg, straightLineMeters: targetMeters },
    route: {
      geometry,
      distance: totalMeters,
      duration: totalMeters / 4,
    },
    errorMeters: scoreRouteExcessMeters(lineStringLengthMeters(geometry), targetMeters),
  };
}

describe("distanceAutoRoute exact clip (server core)", () => {
  it("5070m geometry를 5000m에서 절단 — 오차 ≤ 5m", () => {
    const geometry = straightRouteGeometry(ORIGIN, 90, 5070);
    const clipped = clipRouteGeometryToTargetMeters({
      geometry,
      targetDistanceMeters: 5000,
      originalDuration: 1200,
    });
    assert.equal(clipped.ok, true);
    if (!clipped.ok) return;
    assert.ok(
      Math.abs(clipped.distance - 5000) <= EXACT_TARGET_DISTANCE_TOLERANCE_M,
      `distance ${clipped.distance}`,
    );
    assert.deepEqual(clipped.end, clipped.geometry.coordinates.at(-1));
  });

  it("10km보다 긴 geometry를 10000m에서 절단", () => {
    const geometry = straightRouteGeometry(ORIGIN, 45, 10_400);
    const clipped = clipRouteGeometryToTargetMeters({
      geometry,
      targetDistanceMeters: 10_000,
      originalDuration: 2400,
    });
    assert.equal(clipped.ok, true);
    if (!clipped.ok) return;
    assert.ok(Math.abs(clipped.distance - 10_000) <= EXACT_TARGET_DISTANCE_TOLERANCE_M);
  });

  it("절단 결과에 인접 중복 좌표 없음", () => {
    const geometry = straightRouteGeometry(ORIGIN, 90, 5100, 10);
    const clipped = clipRouteGeometryToTargetMeters({
      geometry,
      targetDistanceMeters: 5000,
      originalDuration: 1000,
    });
    assert.equal(clipped.ok, true);
    if (!clipped.ok) return;
    const coords = clipped.geometry.coordinates;
    for (let i = 1; i < coords.length; i += 1) {
      const d = getDistanceMeters(coords[i - 1]!, coords[i]!);
      assert.ok(d > 0.5, `duplicate at ${i}`);
    }
  });

  it("목표가 선분 중간이면 보간 좌표가 선분 위에 존재", () => {
    const geometry = straightRouteGeometry(ORIGIN, 0, 5200, 4);
    const clipped = clipRouteGeometryToTargetMeters({
      geometry,
      targetDistanceMeters: 5000,
      originalDuration: 900,
    });
    assert.equal(clipped.ok, true);
    if (!clipped.ok) return;
    const end = clipped.end;
    const segStart = geometry.coordinates[geometry.coordinates.length - 2]!;
    const segEnd = geometry.coordinates[geometry.coordinates.length - 1]!;
    const toSeg =
      getDistanceMeters(end, segStart) + getDistanceMeters(end, segEnd) - getDistanceMeters(segStart, segEnd);
    assert.ok(Math.abs(toSeg) < 2, "interpolated end should lie on segment");
  });

  it("총 연장이 목표보다 짧으면 성공 반환 금지", () => {
    const geometry = straightRouteGeometry(ORIGIN, 90, 4800);
    const clipped = clipRouteGeometryToTargetMeters({
      geometry,
      targetDistanceMeters: 5000,
      originalDuration: 800,
    });
    assert.equal(clipped.ok, false);
  });

  it("복수 후보에서 짧은 후보 제외·최소 초과 후보 선택", () => {
    const shortRoute = scoredRoute(90, 4800, 5000);
    const nearRoute = scoredRoute(90, 5070, 5000);
    const farRoute = scoredRoute(95, 6200, 5000);
    const best = pickBestExactDistanceAutoRoute(
      [shortRoute, farRoute, nearRoute],
      5000,
      90,
    );
    assert.ok(best);
    assert.equal(best!.candidate.bearingDeg, 90);
    assert.ok(Math.abs(best!.errorMeters - nearRoute.errorMeters) < 1);
  });

  it("반환 distance와 geometry 재계산 연장 일치", () => {
    const geometry = straightRouteGeometry(ORIGIN, 120, 5300);
    const clipped = clipRouteGeometryToTargetMeters({
      geometry,
      targetDistanceMeters: 5000,
      originalDuration: 1100,
    });
    assert.equal(clipped.ok, true);
    if (!clipped.ok) return;
    assert.ok(
      Math.abs(clipped.distance - lineStringLengthMeters(clipped.geometry)) <= 0.01,
    );
  });

  it("절단 후 duration이 전체 duration과 동일하지 않음", () => {
    const geometry = straightRouteGeometry(ORIGIN, 90, 6000);
    const clipped = clipRouteGeometryToTargetMeters({
      geometry,
      targetDistanceMeters: 5000,
      originalDuration: 2000,
    });
    assert.equal(clipped.ok, true);
    if (!clipped.ok) return;
    assert.ok(clipped.duration < 2000);
    assert.ok(clipped.duration > 0);
  });

  it("snappedEndFromRoute는 절단 geometry 마지막 점과 일치", () => {
    const geometry = straightRouteGeometry(ORIGIN, 90, 5500);
    const clipped = clipRouteGeometryToTargetMeters({
      geometry,
      targetDistanceMeters: 5000,
      originalDuration: 1500,
    });
    assert.equal(clipped.ok, true);
    if (!clipped.ok) return;
    const route: DirectionsRouteLike = {
      geometry: clipped.geometry,
      distance: clipped.distance,
      duration: clipped.duration,
    };
    assert.deepEqual(snappedEndFromRoute(route), clipped.end);
  });
});
