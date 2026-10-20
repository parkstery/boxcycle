import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildNewRoadGeometryFromRoute,
} from "../../src/lib/conquest/conquestNewRoadGeometry.ts";
import {
  buildConquestCellsFromRoute,
  conquestCellIdAt,
} from "../../src/lib/conquest/conquestTiles.ts";
import {
  getPointOnRouteByDistance,
  lineStringLengthMeters,
  type LineStringGeometry,
} from "../../src/lib/geo/geo.ts";

function northLine(): LineStringGeometry {
  return {
    type: "LineString",
    coordinates: [
      [127, 37.5],
      [127, 37.5015],
    ],
  };
}

function resultLength(result: ReturnType<typeof buildNewRoadGeometryFromRoute>): number {
  return result.segments.reduce((sum, segment) => sum + lineStringLengthMeters(segment), 0);
}

describe("buildNewRoadGeometryFromRoute", () => {
  it("returns only cells that were not owned at the start", () => {
    const geometry = northLine();
    const total = Math.min(120, lineStringLengthMeters(geometry));
    const ownedPoint = getPointOnRouteByDistance(geometry, 60);
    assert.ok(ownedPoint);
    const ownedCell = conquestCellIdAt(ownedPoint!);

    const result = buildNewRoadGeometryFromRoute({
      geometry,
      traveledMeters: total,
      ownedAtStart: new Set([ownedCell]),
    });

    const all = buildConquestCellsFromRoute(geometry, total, 0);
    const ownedMeters = all
      .filter((cell) => cell.id === ownedCell)
      .reduce((sum, cell) => sum + cell.m, 0);
    assert.ok(result.segments.length >= 1);
    assert.ok(result.meters > 0);
    assert.ok(result.meters < total);
    assert.ok(Math.abs(result.meters - (total - ownedMeters)) <= 2);
    assert.ok(resultLength(result) > 0);
  });

  it("excludes every repeated visit to an owned cell", () => {
    const geometry: LineStringGeometry = {
      type: "LineString",
      coordinates: [
        [127, 37.5],
        [127, 37.50025],
        [127, 37.5],
      ],
    };
    const ownedCell = new Set(
      buildConquestCellsFromRoute(geometry, lineStringLengthMeters(geometry), 0).map(
        (cell) => cell.id,
      ),
    );
    const result = buildNewRoadGeometryFromRoute({
      geometry,
      ownedAtStart: ownedCell,
    });

    assert.deepEqual(result, { segments: [], meters: 0 });
  });

  it("starts at fromMeters and does not include the earlier route", () => {
    const geometry = northLine();
    const fromMeters = 40;
    const traveledMeters = Math.min(fromMeters + 55, lineStringLengthMeters(geometry));
    const result = buildNewRoadGeometryFromRoute({
      geometry,
      traveledMeters,
      fromMeters,
      ownedAtStart: new Set(),
    });

    assert.ok(Math.abs(result.meters - (traveledMeters - fromMeters)) <= 1);
    const first = result.segments[0]?.coordinates[0];
    const expected = getPointOnRouteByDistance(geometry, fromMeters);
    assert.ok(first && expected);
    assert.ok(Math.abs(first[1] - expected![1]) < 1e-8);
  });

  it("honors maxNewMeters in route order and clips the final piece", () => {
    const geometry = northLine();
    const maxNewMeters = 37;
    const result = buildNewRoadGeometryFromRoute({
      geometry,
      ownedAtStart: new Set(),
      maxNewMeters,
    });

    assert.ok(Math.abs(result.meters - maxNewMeters) < 1e-9);
    assert.ok(Math.abs(resultLength(result) - maxNewMeters) <= 0.5);
    const end = result.segments[0]?.coordinates.at(-1);
    const expected = getPointOnRouteByDistance(geometry, maxNewMeters);
    assert.ok(end && expected);
    assert.ok(Math.abs(end[1] - expected![1]) < 1e-8);
  });

  it("joins adjacent new pieces, including a cell boundary", () => {
    const geometry = northLine();
    const result = buildNewRoadGeometryFromRoute({
      geometry,
      traveledMeters: 120,
      ownedAtStart: new Set(),
    });

    assert.equal(result.segments.length, 1);
    assert.ok(result.segments[0]!.coordinates.length > 2);
  });

  it("returns empty geometry for zero-length or fully capped input", () => {
    const zero: LineStringGeometry = {
      type: "LineString",
      coordinates: [[127, 37.5], [127, 37.5]],
    };
    assert.deepEqual(
      buildNewRoadGeometryFromRoute({ geometry: zero, ownedAtStart: new Set() }),
      { segments: [], meters: 0 },
    );
    assert.deepEqual(
      buildNewRoadGeometryFromRoute({ geometry: northLine(), ownedAtStart: new Set(), maxNewMeters: 0 }),
      { segments: [], meters: 0 },
    );
  });
});
