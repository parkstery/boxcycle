import assert from "node:assert/strict";
import test from "node:test";
import { RiderWheelMotion } from "../../src/lib/riderPrototype/riderWheelMotion.ts";
import { estimateCrankRpmFromSpeedKmh, resolvePedalCrankRpm } from "../../src/lib/sensor/crankRpm.ts";

test("둘레 한 번 이동하면 바퀴 한 회전: 프레임 수와 무관", () => {
  for (const fps of [10, 30, 60]) {
    const motion = new RiderWheelMotion(2.105);
    motion.update("self", 2.105, 0);
    for (let i = 1; i <= fps / 2; i++) motion.update("self", 2.105, i * 1000 / fps);
    assert.ok(Math.abs(motion.get("self") - 0.5) < 1e-9);
  }
});

test("라이더별 위상 독립·정지·탭 복귀·정리", () => {
  const motion = new RiderWheelMotion(2.105);
  motion.update("a", 2.105, 0);
  motion.update("b", 4.21, 0);
  assert.equal(motion.update("a", 2.105, 250), 0.25);
  assert.equal(motion.update("b", 4.21, 250), 0.5);
  assert.equal(motion.update("a", 0, 500), 0.25);
  assert.equal(motion.update("a", 2.105, 10000), 0.25);
  motion.prune(new Set(["a"]));
  assert.equal(motion.get("b"), 0);
});

test("페달은 센서 우선, 센서 없으면 둘레·기어비 계산", () => {
  assert.equal(estimateCrankRpmFromSpeedKmh(0), 0);
  assert.ok(Math.abs(estimateCrankRpmFromSpeedKmh(30) - 74.2280285) < 1e-5);
  assert.equal(resolvePedalCrankRpm({ speedKmh: 30, crankRpmFromSensor: 90 }), 90);
});
