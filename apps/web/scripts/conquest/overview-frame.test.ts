import test from "node:test";
import assert from "node:assert/strict";
import { computeConquestOverviewFrame } from "../../src/lib/conquest/conquestOverviewFrame";

const line = (coordinates: [number, number][]) => ({ type: "LineString" as const, coordinates });

test("dense local region wins over an isolated far-away trace", () => {
  const frame = computeConquestOverviewFrame([
    line([
      [126.90, 37.50],
      [126.91, 37.50],
      [126.92, 37.51],
      [126.93, 37.51],
    ]),
    line([
      [10, 10],
      [11, 11],
    ]),
  ]);
  assert.ok(frame);
  assert.ok(frame.center[0] > 126 && frame.center[0] < 128);
  assert.ok(frame.center[1] > 36 && frame.center[1] < 39);
  assert.ok(frame.bbox[2] - frame.bbox[0] < 2);
});

test("global spread is capped below a full-globe frame", () => {
  const frame = computeConquestOverviewFrame([
    line([
      [-170, 0],
      [-160, 0],
      [-150, 0],
      [-140, 0],
      [-130, 0],
      [-120, 0],
      [-110, 0],
      [-100, 0],
      [-90, 0],
      [-80, 0],
      [-70, 0],
      [-60, 0],
      [-50, 0],
      [-40, 0],
      [-30, 0],
      [-20, 0],
      [-10, 0],
      [0, 0],
    ]),
  ]);
  assert.ok(frame);
  assert.ok(frame.bbox[2] - frame.bbox[0] <= 170);
  assert.ok(frame.bbox[3] - frame.bbox[1] <= 170);
});
