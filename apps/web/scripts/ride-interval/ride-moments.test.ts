import assert from "node:assert/strict";
import test from "node:test";
import { getRideIntervalView } from "../../src/lib/ride/rideInterval.ts";
import {
  emptyRideMomentMemory,
  resolveRideMoments,
  type RideMomentInput,
} from "../../src/lib/ride/rideMoments.ts";

function tick(memory = emptyRideMomentMemory(), patch: Partial<RideMomentInput> = {}) {
  return resolveRideMoments(memory, {
    status: "running",
    elapsedMs: 0,
    routeMeters: 2000,
    traveledMeters: 0,
    waypointMeters: [700, 1400],
    interval: null,
    newRoadKm: null,
    ended: null,
    ...patch,
  });
}

test("주행 시작은 idle→running 한 번만 나오고 일시정지 재개는 시작이 아니다", () => {
  const start = tick();
  assert.equal(start.event?.kind, "start");
  const paused = tick(start.memory, { status: "paused", elapsedMs: 1000, traveledMeters: 10 });
  assert.equal(paused.event, null);
  const resume = tick(paused.memory, { status: "running", elapsedMs: 1000, traveledMeters: 10 });
  assert.equal(resume.event, null);
});

test("인터벌 중 일반 주행 멘트는 억제하고 긴 회복과 마무리를 안내한다", () => {
  const config = { highSec: 30, lowSec: 30, repeats: 2, warmupSec: 300, cooldownSec: 300, rounds: 2, roundRestSec: 60 };
  const started = tick(emptyRideMomentMemory(), { interval: getRideIntervalView(0, config) });
  started.memory.lastElapsedMs = 419_000;
  started.memory.lastPhase = "recovery";
  const rest = tick(started.memory, { elapsedMs: 420_000, interval: getRideIntervalView(420_000, config) });
  assert.equal(rest.event?.kind, "intervalRest");
  rest.memory.lastElapsedMs = 599_000;
  rest.memory.lastPhase = "recovery";
  const cooldown = tick(rest.memory, { elapsedMs: 600_000, interval: getRideIntervalView(600_000, config) });
  assert.equal(cooldown.event?.kind, "intervalCooldown");
});

test("절반과 경유지는 지점당 한 번이며 큰 점프는 재생하지 않는다", () => {
  const started = tick();
  started.memory.lastElapsedMs = 3900;
  started.memory.lastTraveledMeters = 990;
  const half = tick(started.memory, { elapsedMs: 4000, traveledMeters: 1000 });
  assert.equal(half.event?.kind, "half");
  const halfAgain = tick(half.memory, { elapsedMs: 4100, traveledMeters: 1010 });
  assert.equal(halfAgain.event, null);

  const fromStart = tick();
  const jump = tick(fromStart.memory, { elapsedMs: 20_000, traveledMeters: 1500 });
  assert.equal(jump.event, null);
  assert.equal(jump.memory.half, true);
  assert.deepEqual(jump.memory.waypoints, [0, 1]);

  fromStart.memory.lastElapsedMs = 2000;
  fromStart.memory.lastTraveledMeters = 690;
  const pass = tick(fromStart.memory, { elapsedMs: 2200, traveledMeters: 710 });
  assert.equal(pass.event?.kind, "waypoint");
  assert.equal(pass.event?.waypointIndex, 0);
  const passAgain = tick(pass.memory, { elapsedMs: 2300, traveledMeters: 720 });
  assert.equal(passAgain.event, null);
});

test("전환 안내가 절반보다 우선하고 큐에 쌓지 않는다", () => {
  const interval = getRideIntervalView(297_000);
  assert.equal(interval.remainingSec, 3);
  const started = tick(emptyRideMomentMemory(), { interval: getRideIntervalView(0) });
  assert.equal(started.event?.kind, "intervalStart");
  started.memory.lastElapsedMs = 296_000;
  started.memory.lastTraveledMeters = 990;
  const warnAndHalf = tick(started.memory, {
    elapsedMs: 297_000,
    traveledMeters: 1000,
    interval,
  });
  assert.equal(warnAndHalf.event?.kind, "intervalWarn");
  const work = tick(warnAndHalf.memory, {
    elapsedMs: 300_000,
    traveledMeters: 1010,
    interval: getRideIntervalView(300_000),
  });
  assert.equal(work.event?.kind, "intervalHigh");
});

test("인터벌 완료는 주행을 끝내지 않고 종료 이벤트는 각 1회다", () => {
  const started = tick(emptyRideMomentMemory(), { interval: getRideIntervalView(0) });
  started.memory.lastElapsedMs = 1_499_000;
  started.memory.lastTraveledMeters = 1790;
  const done = tick(started.memory, {
    elapsedMs: 1_500_000,
    traveledMeters: 1800,
    interval: getRideIntervalView(1_500_000),
  });
  assert.equal(done.event?.kind, "intervalComplete");
  const stillRunning = tick(done.memory, {
    elapsedMs: 1_501_000,
    traveledMeters: 1810,
    interval: getRideIntervalView(1_501_000),
  });
  assert.equal(stillRunning.event, null);

  const finish = tick(stillRunning.memory, {
    status: "idle",
    ended: { reason: "finish", sessionKm: 2.02 },
    newRoadKm: 0.42,
  });
  assert.equal(finish.event?.kind, "finish");
  const finishAgain = tick(finish.memory, {
    status: "idle",
    ended: { reason: "finish", sessionKm: 2.02 },
    newRoadKm: 0.42,
  });
  assert.equal(finishAgain.event, null);
});
