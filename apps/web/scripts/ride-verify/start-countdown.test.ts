import assert from "node:assert/strict";
import test from "node:test";
import { scheduleRideStartCountdown } from "../../src/lib/ride/startCountdown.ts";

test("3→2→1 표시, 3000ms 전에는 주행을 시작하지 않는다", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const ticks: (number | null)[] = [];
  const countdown = scheduleRideStartCountdown((n) => ticks.push(n));
  let started = false;
  void countdown.promise.then((ready) => { started = ready; });
  assert.deepEqual(ticks, [3]);
  t.mock.timers.tick(1000); assert.deepEqual(ticks, [3, 2]);
  t.mock.timers.tick(1000); assert.deepEqual(ticks, [3, 2, 1]);
  t.mock.timers.tick(999); await Promise.resolve(); assert.equal(started, false);
  t.mock.timers.tick(1); assert.equal(await countdown.promise, true);
  assert.deepEqual(ticks, [3, 2, 1, null]);
});

test("중간 취소 시 시작하지 않고 타이머를 정리한다", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const ticks: (number | null)[] = [];
  const countdown = scheduleRideStartCountdown((n) => ticks.push(n));
  t.mock.timers.tick(1000);
  countdown.cancel(); countdown.cancel();
  t.mock.timers.tick(5000);
  assert.equal(await countdown.promise, false);
  assert.deepEqual(ticks, [3, 2, null]);
});
