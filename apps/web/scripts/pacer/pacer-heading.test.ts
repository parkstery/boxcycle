import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  headingAtRouteDistanceMeters,
  lineStringLengthMeters,
  smoothedHeadingAtRouteDistanceMeters,
  type LineStringGeometry,
} from "../../src/lib/geo/geo.ts";
import { PACER_HEADING_HALF_SPAN_M } from "../../src/lib/ride/pacer/pacerMotion.ts";

/** 동쪽 ~50 m → 북쪽 ~50 m 직각 코너 + 짧은 지그재그(산길 꺾임점 흉내) */
const geom: LineStringGeometry = {
  type: "LineString",
  coordinates: [
    [0, 0],
    [0.00045, 0],
    [0.00045, 0.00045],
    [0.00050, 0.00050],
    [0.00049, 0.00056],
    [0.00052, 0.00062],
  ],
};

function maxStepDelta(fn: (d: number) => number | null): number {
  const len = lineStringLengthMeters(geom);
  let prev: number | null = null;
  let worst = 0;
  for (let d = 0; d <= len; d += 0.05) {
    const h = fn(d);
    if (h == null) continue;
    if (prev != null) worst = Math.max(worst, Math.abs(((h - prev + 540) % 360) - 180));
    prev = h;
  }
  return worst;
}

describe("pacer heading", () => {
  it("현 방위는 0.05 m 이동마다 3° 미만으로만 바뀐다(꺾임점 포함)", () => {
    const len = lineStringLengthMeters(geom);
    const worst = maxStepDelta((d) =>
      smoothedHeadingAtRouteDistanceMeters(geom, d, PACER_HEADING_HALF_SPAN_M, len),
    );
    console.log(`smoothed worst step=${worst.toFixed(2)}°`);
    assert.ok(worst < 3, `smoothed ${worst}`);
  });

  it("대조: 세그먼트 방위는 같은 경로에서 크게 뛴다(시험이 결함을 겨누는지)", () => {
    const worst = maxStepDelta((d) => headingAtRouteDistanceMeters(geom, d));
    console.log(`segment worst step=${worst.toFixed(2)}°`);
    assert.ok(worst > 30, `segment ${worst}`);
  });
});
