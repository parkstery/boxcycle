import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  bearingFromOriginToPoint,
  buildAutoRouteCandidates,
  circleLineString,
  isValidAutoRouteEnd,
  pickBestAutoRoute,
  scoreRouteDistanceError,
} from "../../src/lib/distanceAutoRoute.ts";
import { getDistanceMeters } from "../../src/lib/geo.ts";

const ORIGIN: [number, number] = [127.02, 37.5];

describe("distanceAutoRoute", () => {
  it("bearingFromOriginToPoint — 동쪽 클릭은 약 90°", () => {
    const east: [number, number] = [127.03, 37.5];
    const b = bearingFromOriginToPoint(ORIGIN, east);
    assert.ok(b > 85 && b < 95, `expected ~90 got ${b}`);
  });

  it("circleLineString — 둘레 점이 반경에 근사", () => {
    const circle = circleLineString(ORIGIN, 1000, 36);
    const sample = circle.coordinates[9]!;
    const d = getDistanceMeters(ORIGIN, sample);
    assert.ok(Math.abs(d - 1000) < 50, `radius error ${d}`);
  });

  it("buildAutoRouteCandidates — 중복 없이 25개 이하", () => {
    const cands = buildAutoRouteCandidates(ORIGIN, 90, 5000);
    assert.ok(cands.length > 0 && cands.length <= 25);
    const ends = new Set(cands.map((c) => `${c.end[0]},${c.end[1]}`));
    assert.equal(ends.size, cands.length);
  });

  it("pickBestAutoRoute — 오차 최소 선택", () => {
    const target = 5000;
    const scored = [
      {
        candidate: { end: ORIGIN, bearingDeg: 0, straightLineMeters: 5000 },
        route: { geometry: { type: "LineString", coordinates: [ORIGIN, ORIGIN] }, distance: 5200, duration: 600 },
        errorMeters: scoreRouteDistanceError(5200, target),
      },
      {
        candidate: { end: ORIGIN, bearingDeg: 0, straightLineMeters: 5000 },
        route: { geometry: { type: "LineString", coordinates: [ORIGIN, ORIGIN] }, distance: 5050, duration: 580 },
        errorMeters: scoreRouteDistanceError(5050, target),
      },
    ];
    const best = pickBestAutoRoute(scored);
    assert.equal(best?.route.distance, 5050);
  });

  it("isValidAutoRouteEnd — 200m 미만은 거부", () => {
    const near: [number, number] = [127.02001, 37.5];
    assert.equal(isValidAutoRouteEnd(ORIGIN, near), false);
    const far = buildAutoRouteCandidates(ORIGIN, 90, 3000)[0]!.end;
    assert.equal(isValidAutoRouteEnd(ORIGIN, far), true);
  });
});
