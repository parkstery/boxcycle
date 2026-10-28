import assert from "node:assert/strict";
import test from "node:test";
import { Matrix4, Vector3 } from "three";
import { RiderTerrainSlope, riderTerrainRotation } from "../../src/lib/riderPrototype/riderTerrainSlope.ts";

const radius = 6371008.8;
const rad = Math.PI / 180;
const close = (actual: number, expected: number, tolerance = 1e-7) =>
  assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);

// 적도 부근의 알려진 평면: 북쪽으로 갈수록 고도가 grade×거리만큼 증가한다.
const northRamp = (grade: number) => ({ lat }: { lng: number; lat: number }) =>
  100 + lat * rad * radius * grade;

test("flat terrain at nonzero altitude keeps the bicycle level", () => {
  close(new RiderTerrainSlope().update("self", [0, 0], 0, 0, true, () => 130), 0);
});

test("uphill, downhill and reversed travel follow the displayed grade", () => {
  const slope = new RiderTerrainSlope();
  close(slope.update("up", [0, 0], 0, 0, true, northRamp(0.13)), Math.atan(0.13));
  close(slope.update("down", [0, 0], 0, 0, true, northRamp(-0.13)), -Math.atan(0.13));
  close(slope.update("reverse", [0, 0], 180, 0, true, northRamp(0.13)), -Math.atan(0.13));
  close(slope.update("cross", [0, 0], 90, 0, true, northRamp(0.13)), 0);
});

test("front and rear samples follow bearing at Korean latitude and across the date line", () => {
  for (const origin of [[127, 37], [179.999999, 37]] as const) {
    const samples: { lng: number; lat: number }[] = [];
    new RiderTerrainSlope().update("self", origin, 90, 0, true, (p) => {
      samples.push(p); return 0;
    });
    const eastMeters = (lng: number) =>
      (((lng - origin[0] + 540) % 360) - 180) * rad * radius * Math.cos(origin[1] * rad);
    close(eastMeters(samples[0].lng), 0.583, 1e-6);
    close(eastMeters(samples[1].lng), -0.412, 1e-6);
  }
});

test("slope rotation raises the front in all map bearings and preserves cornering roll", () => {
  const pitch = Math.atan(0.2);
  for (const bearing of [0, 90, 180, 270]) {
    const transform = new Matrix4().makeScale(1, -1, 1)
      .multiply(new Matrix4().makeRotationX(Math.PI / 2))
      .multiply(new Matrix4().makeRotationY((90 - bearing) * rad))
      .multiply(riderTerrainRotation(pitch, 0.3));
    const front = new Vector3(1, 0, 0).applyMatrix4(transform);
    close(front.z, Math.sin(pitch));
    close(front.x, Math.sin(bearing * rad) * Math.cos(pitch));
    close(front.y, -Math.cos(bearing * rad) * Math.cos(pitch));
  }
  const oldRoll = new Matrix4().makeRotationX(0.3);
  riderTerrainRotation(0, 0.3).elements.forEach((v, i) => close(v, oldRoll.elements[i]));
});

test("10Hz sampling is bounded independently of render FPS", () => {
  const slope = new RiderTerrainSlope();
  let calls = 0;
  for (let t = 0; t < 1000; t += 10) {
    slope.update("self", [0, 0], 0, t, true, () => { calls++; return 100; });
  }
  assert.equal(calls, 20);
});

test("pitch transitions are smooth and frame-rate independent", () => {
  const run = (step: number) => {
    const slope = new RiderTerrainSlope();
    slope.update("self", [0, 0], 0, 0, true, () => 100);
    close(slope.update("self", [0, 0], 0, 100, true, northRamp(0.2)), 0);
    let value = 0;
    for (let t = 100 + step; t <= 400; t += step) {
      value = slope.update("self", [0, 0], 0, t, true, northRamp(0.2));
    }
    assert.ok(value > 0 && value < Math.atan(0.2));
    return value;
  };
  close(run(10), run(50));
});

test("2D disables queries and clears slope immediately; re-enabling samples afresh", () => {
  const slope = new RiderTerrainSlope();
  slope.update("self", [0, 0], 0, 0, true, northRamp(0.2));
  let calls = 0;
  close(slope.update("self", [0, 0], 0, 20, false, () => { calls++; return 100; }), 0);
  assert.equal(calls, 0);
  close(slope.update("self", [0, 0], 0, 30, true, northRamp(-0.2)), -Math.atan(0.2));
});

test("missing/nonfinite terrain or query errors keep initial pitch level", () => {
  for (const read of [() => null, () => undefined, () => NaN, () => Infinity, () => { throw Error("DEM"); }]) {
    close(new RiderTerrainSlope().update("self", [0, 0], 0, 0, true, read), 0);
  }
});

test("self, peer and pacer states stay independent and departed ids are pruned", () => {
  const slope = new RiderTerrainSlope();
  slope.update("self", [0, 0], 0, 0, true, northRamp(0.1));
  slope.update("peer", [0, 0], 0, 0, true, northRamp(-0.2));
  close(slope.update("pacer", [0, 0], 0, 0, true, () => 100), 0);
  slope.prune(new Set(["self"]));
  close(slope.update("peer", [0, 0], 0, 10, true, northRamp(0.3)), Math.atan(0.3));
  close(slope.update("self", [0, 0], 0, 10, true, () => 100), Math.atan(0.1));
});
