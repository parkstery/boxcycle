import assert from "node:assert/strict";
import test from "node:test";
import { getPointOnRouteByDistance, lineStringLengthMeters, type LineStringGeometry, type LngLat } from "../../src/lib/geo/geo";
import { cutQuickIntervalRoute } from "../../src/lib/ride/quickIntervalRoute";

const coordinates: LngLat[] = [[127, 37], [127.005, 37], [127.015, 37.005]];
const geometry: LineStringGeometry = { type: "LineString", coordinates };
const route = {
  distanceMeters: 1000, durationSec: 150, geometry,
  endLngLat: coordinates[2], waypoints: coordinates.slice(1),
  progressRatio: 0.55, completedRoute: false,
};

test("a partial save keeps the visible ride endpoint when Directions and geometry lengths differ", () => {
  const riddenMeters = 550;
  assert.ok(lineStringLengthMeters(geometry) > route.distanceMeters);
  const end = getPointOnRouteByDistance(geometry, riddenMeters);
  const cut = cutQuickIntervalRoute(route, riddenMeters);
  assert.ok(cut);
  assert.deepEqual(cut.geometry.coordinates, [coordinates[0], coordinates[1], end]);
  assert.deepEqual(cut.endLngLat, end);
  assert.deepEqual(cut.waypoints, [coordinates[1]]);
  assert.equal(cut.distanceMeters, 550);
  assert.equal(cut.durationSec, 83);
  assert.equal(cut.progressRatio, 1);
  assert.equal(cut.completedRoute, true);
  assert.equal(route.geometry.coordinates.length, 3);
});

test("the geometry cap, arrival, and invalid or zero distances are handled", () => {
  const geoLength = lineStringLengthMeters(geometry);
  const longer = { ...route, distanceMeters: 2000 };
  assert.equal(cutQuickIntervalRoute(longer, geoLength + 1)?.geometry, geometry);
  for (const ridden of [1000, 1500]) {
    const cut = cutQuickIntervalRoute(route, ridden);
    assert.equal(cut?.geometry, geometry);
    assert.equal(cut?.distanceMeters, 1000);
    assert.equal(cut?.durationSec, 150);
    assert.deepEqual(cut?.waypoints, route.waypoints);
  }
  for (const ridden of [0, -1, NaN, Infinity]) assert.equal(cutQuickIntervalRoute(route, ridden), null);
});
