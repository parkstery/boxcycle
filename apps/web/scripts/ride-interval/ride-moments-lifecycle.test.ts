import assert from "node:assert/strict";
import test from "node:test";
import { getRideIntervalView } from "../../src/lib/ride/rideInterval.ts";
import {
  emptyRideMomentMemory,
  resolveRideMoments,
  type RideMomentInput,
  type RideMomentMemory,
} from "../../src/lib/ride/rideMoments.ts";

const phase = (kind: string, remainingSec = 10) => ({
  phase: kind,
  step: 0,
  label: kind,
  remainingSec,
  repeat: 1,
  totalRepeats: 5,
  round: 1,
  totalRounds: 1,
  nextLabel: "다음 · 운동 1분",
});

function memory(patch: Partial<RideMomentMemory> = {}): RideMomentMemory {
  return {
    ...emptyRideMomentMemory(),
    started: true,
    intervalStarted: true,
    lastStatus: "running",
    lastElapsedMs: 9000,
    lastPhase: "warmup",
    ...patch,
  };
}

function input(extra: Partial<RideMomentInput> = {}): RideMomentInput {
  return {
    status: "running",
    elapsedMs: 10000,
    routeMeters: 5000,
    traveledMeters: 100,
    waypointMeters: [],
    interval: phase("warmup") as RideMomentInput["interval"],
    newRoadKm: null,
    ended: null,
    ...extra,
  };
}

test("running→idle+end payload delivers finish", () => {
  const r = resolveRideMoments(memory(), input({ status: "idle", ended: { reason: "finish", sessionKm: 5 } }));
  assert.equal(r.event?.kind, "finish");
});

test("new ride after a completed ride starts and can celebrate again", () => {
  const end = resolveRideMoments(memory(), input({ status: "idle", ended: { reason: "finish", sessionKm: 5 } }));
  const idle = resolveRideMoments(end.memory, input({ status: "idle", elapsedMs: 0, traveledMeters: 0 }));
  const start = resolveRideMoments(idle.memory, input({ status: "running", elapsedMs: 0, traveledMeters: 0, interval: null }));
  assert.equal(start.event?.kind, "start");
});

test("stale ended payload does not replay finish or block the next ride", () => {
  const end = resolveRideMoments(memory(), input({ status: "idle", ended: { reason: "finish", sessionKm: 5 } }));
  const start = resolveRideMoments(end.memory, input({
    status: "running",
    elapsedMs: 0,
    traveledMeters: 0,
    interval: null,
    ended: { reason: "finish", sessionKm: 5 },
  }));
  assert.equal(start.event?.kind, "start");
  assert.equal(start.memory.ended, false);
});

test("pause/resume does not repeat same three-second warning", () => {
  const a = resolveRideMoments(memory(), input({ interval: phase("warmup", 3) as RideMomentInput["interval"] }));
  assert.equal(a.event?.kind, "intervalWarn");
  const b = resolveRideMoments(a.memory, input({ status: "paused", interval: phase("warmup", 3) as RideMomentInput["interval"] }));
  const c = resolveRideMoments(b.memory, input({ interval: phase("warmup", 3) as RideMomentInput["interval"] }));
  assert.notEqual(c.event?.kind, "intervalWarn");
});

test("skipped completion is consumed instead of delayed one tick", () => {
  const a = resolveRideMoments(memory(), input({ elapsedMs: 100000, interval: phase("complete", 0) as RideMomentInput["interval"] }));
  assert.equal(a.event, null);
  assert.equal(a.memory.intervalCompleted, true);
  const b = resolveRideMoments(a.memory, input({ elapsedMs: 100500, interval: phase("complete", 0) as RideMomentInput["interval"] }));
  assert.notEqual(b.event?.kind, "intervalComplete");
});

test("restarted interval may complete again in the same ride", () => {
  const prior = { ...memory(), intervalCompleted: true, lastPhase: "complete" as const };
  const a = resolveRideMoments(prior, input({ interval: phase("warmup") as RideMomentInput["interval"] }));
  const b = resolveRideMoments(a.memory, input({ elapsedMs: 10500, interval: phase("complete", 0) as RideMomentInput["interval"] }));
  assert.equal(b.event?.kind, "intervalComplete");
});

test("interval run key restart also allows a second complete", () => {
  const done = resolveRideMoments(memory(), input({
    elapsedMs: 15000,
    interval: phase("complete", 0) as RideMomentInput["interval"],
    intervalRunKey: "run-1",
  }));
  const restarted = resolveRideMoments(done.memory, input({
    elapsedMs: 16000,
    interval: getRideIntervalView(0, { highSec: 45, lowSec: 60, repeats: 6, warmupSec: 0, cooldownSec: 0 }),
    intervalRunKey: "run-2",
  }));
  assert.equal(restarted.memory.intervalCompleted, false);
  assert.ok(restarted.event?.kind === "intervalStart" || restarted.event?.kind === "intervalHigh");
  assert.equal(restarted.event?.coach.includes("준비부터"), false);
  const again = resolveRideMoments(restarted.memory, input({
    elapsedMs: 16500,
    interval: phase("complete", 0) as RideMomentInput["interval"],
    intervalRunKey: "run-2",
  }));
  assert.equal(again.event?.kind, "intervalComplete");
});

test("zero-warmup start does not say begin with preparation", () => {
  const a = resolveRideMoments(emptyRideMomentMemory(), input({ elapsedMs: 0, interval: phase("work", 60) as RideMomentInput["interval"] }));
  assert.ok(a.event);
  assert.equal(a.event.coach.includes("준비부터"), false);
});
