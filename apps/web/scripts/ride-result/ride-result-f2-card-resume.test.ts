/**
 * F2 · Distance/resume adapter — card/prep/Go 일치 검증
 * 
 * CP1: Card (`resumeAnchorForRoute`) and Go (`resumeOffsetMetersFrom`) must share 0.97 cap.
 * Dual-length fixture: production card coordinates vs App Go coordinates (not hardcoded).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { LineStringGeometry } from "../../src/lib/geo.ts";
import { resumeAnchorForRoute } from "../../src/lib/nextRideTarget.ts";
import { resumeOffsetMetersFrom } from "../../src/lib/rideRecordPolicy.ts";
import { lineStringLengthMeters, getPointOnRouteByDistance } from "../../src/lib/geo.ts";
import type { SavedRoute } from "../../src/lib/firestoreSavedRoutes.ts";

describe("F2 · card vs Go — 0.97 cap + dual-length", () => {
  it("CP1: 0.975 saved → card/Go both capped at 0.97 (970m on 1000m route)", () => {
    const geometry: LineStringGeometry = {
      type: "LineString",
      coordinates: [[0, 0], [0, 0.01]], // ~1000m
    };
    const routeDistanceMeters = 1000;
    const savedRatio = 0.975; // Above 0.97 cap

    // Card path
    const mockRoute: SavedRoute = {
      id: "test",
      userId: "test",
      lastProgressRatio: savedRatio,
      geometry,
      distanceMeters: routeDistanceMeters,
    } as SavedRoute;
    const cardAnchor = resumeAnchorForRoute(mockRoute);
    assert.ok(cardAnchor, "card anchor exists");

    // Go path
    const goOffsetMeters = resumeOffsetMetersFrom(savedRatio, routeDistanceMeters);
    const goAnchor = getPointOnRouteByDistance(geometry, goOffsetMeters);

    // Expected: both capped at 0.97 * 1000 = 970m
    const expectedCappedMeters = 0.97 * routeDistanceMeters;
    assert.ok(Math.abs(goOffsetMeters - expectedCappedMeters) < 1, `Go capped at ${expectedCappedMeters}m`);

    // Card and Go coordinates must match
    assert.deepEqual(cardAnchor, goAnchor, "CP1: card === Go at 0.97 cap");
  });

  it("CP1: Dual-length 1000m/1200m route, 50% progress → card/Go same coordinate", () => {
    const geometry: LineStringGeometry = {
      type: "LineString",
      coordinates: [[0, 0], [0, 0.01]], // ~1200m actual
    };
    const geoLen = lineStringLengthMeters(geometry); // ~1200m
    const routeDistanceMeters = 1000; // Directions API
    const progressRatio = 0.5;

    // Card path (production)
    const mockRoute: SavedRoute = {
      id: "test",
      userId: "test",
      lastProgressRatio: progressRatio,
      geometry,
      distanceMeters: routeDistanceMeters,
    } as SavedRoute;
    const cardAnchor = resumeAnchorForRoute(mockRoute);
    assert.ok(cardAnchor, "card anchor exists");

    // Go path (production)
    const goOffsetMeters = resumeOffsetMetersFrom(progressRatio, routeDistanceMeters);
    const goAnchor = getPointOnRouteByDistance(geometry, goOffsetMeters);

    // CP1: Both must yield same coordinate (not hardcoded 500 vs 600)
    assert.deepEqual(cardAnchor, goAnchor, "CP1: dual-length card === Go coordinate");

    // Expected offset: 0.5 * 1000 = 500m (no scaling to geometry length)
    assert.ok(Math.abs(goOffsetMeters - 500) < 1, "Go offset 500m (not 600m)");
  });

  it("43% progress → card/Go same coordinate", () => {
    const geometry: LineStringGeometry = {
      type: "LineString",
      coordinates: [[126.9, 37.5], [126.9, 37.6]], // ~11km
    };
    const geoLen = lineStringLengthMeters(geometry);
    const progressRatio = 0.43;

    const mockRoute: SavedRoute = {
      id: "test",
      userId: "test",
      lastProgressRatio: progressRatio,
      geometry,
      distanceMeters: geoLen,
    } as SavedRoute;
    const cardAnchor = resumeAnchorForRoute(mockRoute);
    assert.ok(cardAnchor, "card anchor exists");

    const goOffsetMeters = resumeOffsetMetersFrom(progressRatio, geoLen);
    const goAnchor = getPointOnRouteByDistance(geometry, goOffsetMeters);

    assert.deepEqual(cardAnchor, goAnchor, "card === Go at 43%");
  });

  it("0% progress → card/Go both at start", () => {
    const geometry: LineStringGeometry = {
      type: "LineString",
      coordinates: [[0, 0], [0, 0.1]],
    };
    const geoLen = lineStringLengthMeters(geometry);

    const mockRoute: SavedRoute = {
      id: "test",
      userId: "test",
      lastProgressRatio: 0,
      geometry,
      distanceMeters: geoLen,
    } as SavedRoute;
    const cardAnchor = resumeAnchorForRoute(mockRoute);
    const goOffsetMeters = resumeOffsetMetersFrom(0, geoLen);

    assert.equal(goOffsetMeters, 0, "Go offset = 0");
    const startPoint = getPointOnRouteByDistance(geometry, 0);
    assert.deepEqual(cardAnchor, startPoint, "card === Go at start");
  });
});
