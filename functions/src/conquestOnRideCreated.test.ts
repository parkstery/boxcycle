import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildNewGeometryFromClaimedPath,
  mergeRecentNewRoadState,
  resolveConquestClaimProjection,
} from "./conquestOnRideCreated.js";
import { conquestCellIdAt } from "./geoTiles.js";

test("server projection emits only the newly claimed geometry", () => {
  const result = resolveConquestClaimProjection({
    cells: [
      { id: "20_1_1", m: 40 },
      { id: "20_1_2", m: 40 },
    ],
    ownedCellIds: new Set(["20_1_1"]),
    creditMeters: 70,
  });

  assert.deepEqual(result.newCellIds, ["20_1_2"]);
  assert.equal(result.newMeters, 30);
  assert.equal(result.consumedMeters, 70);
  assert.equal(result.claimedMetersByCell.get("20_1_2"), 30);
});

test("server projection preserves separated revisited-cell geometry", () => {
  const result = resolveConquestClaimProjection({
    cells: [
      { id: "20_1_1", m: 40 },
      { id: "20_1_2", m: 30 },
    ],
    ownedCellIds: new Set(),
    creditMeters: 40,
  });

  assert.equal(result.newMeters, 40);
  assert.equal(result.claimedMetersByCell.get("20_1_1"), 40);
});

test("server geometry follows claimed cells and preserves separated path runs", () => {
  const a: [number, number] = [127, 37.5];
  const b: [number, number] = [127.0002, 37.5];
  const c: [number, number] = [127.0005, 37.5];
  const d: [number, number] = [127.0007, 37.5];
  const firstCell = conquestCellIdAt([127.0001, 37.5]);
  const secondCell = conquestCellIdAt([127.00035, 37.5]);
  const result = buildNewGeometryFromClaimedPath(
    [a[0], a[1], b[0], b[1], c[0], c[1], d[0], d[1]],
    new Map([[firstCell, 40], [secondCell, 30]]),
  );
  assert.ok(result.length >= 1);
  assert.ok(result.every((segment) => segment.path.length >= 4));
});

test("recent new road state keeps the newest day and merges rides on that day", () => {
  const oldState = {
    day: "20261018",
    geometry: [{ path: [126, 37, 126.01, 37.01] }],
    newMeters: 4000,
  };
  const sameDay = {
    day: "20261018",
    geometry: [{ path: [126.02, 37.02, 126.03, 37.03] }],
    newMeters: 6000,
  };
  const newer = {
    day: "20261020",
    geometry: [{ path: [127, 38, 127.01, 38.01] }],
    newMeters: 1200,
  };

  assert.deepEqual(mergeRecentNewRoadState(oldState, sameDay), {
    day: "20261018",
    geometry: [...oldState.geometry, ...sameDay.geometry],
    newMeters: 10000,
  });
  assert.deepEqual(mergeRecentNewRoadState(oldState, newer), newer);
  assert.deepEqual(mergeRecentNewRoadState(newer, oldState), newer);
});

test("long simplified trace finds newly claimed cells away from its midpoint", () => {
  const start: [number, number] = [127, 37.5];
  const finish: [number, number] = [127, 37.502];
  const firstCell = conquestCellIdAt([127, 37.50005]);
  const lastCell = conquestCellIdAt([127, 37.50195]);
  const result = buildNewGeometryFromClaimedPath([...start, ...finish], new Map([[firstCell, 20], [lastCell, 20]]));
  assert.equal(result.length, 2, "separate new ends remain separate; old middle is excluded");
  assert.ok(result[0].path[1] < 37.5003);
  assert.ok(result[1].path[1] > 37.5016);
});
