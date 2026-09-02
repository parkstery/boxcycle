import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { offsetLngLatByBearingMeters } from "../../../../functions/src/distanceAutoRouteCore.ts";
import { lineStringLengthMeters } from "../../src/lib/geo.ts";
import { computeRideSessionAnchor } from "../../src/lib/rideSessionAnchor.ts";

describe("ride-continue §6 B — session anchor", () => {
  it("0% 시작 → 첫 좌표, 100% 종료 → 마지막 좌표", () => {
    const start: [number, number] = [127.02, 37.5];
    const end = offsetLngLatByBearingMeters(start, 90, 1000) as [number, number];
    const geometry = {
      type: "LineString" as const,
      coordinates: [start, end] as [number, number][],
    };
    const geoLen = lineStringLengthMeters(geometry);
    const anchor = computeRideSessionAnchor({
      geometry,
      routeDistanceMeters: geoLen,
      virtualDistanceMeters: geoLen,
      startOffsetMeters: 0,
    });
    assert.ok(anchor.sessionStartLngLat);
    assert.ok(anchor.sessionEndLngLat);
    assert.equal(anchor.sessionStartProgressRatio, 0);
    assert.equal(anchor.sessionEndProgressRatio, 1);
  });

  it("geometry 없음 → null anchor, throw 없음", () => {
    const anchor = computeRideSessionAnchor({
      geometry: null,
      routeDistanceMeters: 1000,
      virtualDistanceMeters: 500,
      startOffsetMeters: 0,
    });
    assert.equal(anchor.sessionStartLngLat, null);
    assert.equal(anchor.sessionEndLngLat, null);
  });
});
