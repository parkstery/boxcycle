import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computePairedCapturePlan,
  evaluatePairedCaptureTiming,
  type PairedCaptureState,
} from "../../src/lib/debug/trafficPairedCapture.ts";
import type { TrafficPublishMetersSnapshot } from "../../src/lib/debug/trafficPublishMeters.ts";

const emptySnap = (atMs: number): TrafficPublishMetersSnapshot => ({
  source: "trafficPublishMeters",
  atMs,
  livePublicationRideWriteAttempts: 0,
  livePublicationRideWrites: 0,
  livePublicationRideWriteErrors: 0,
  rtdbMotionWriteAttempts: 0,
  rtdbMotionWrites: 0,
  rtdbMotionWriteErrors: 0,
  rtdbMotionWriteBytesApprox: 0,
  fsLiveRideUnderlyingDeliveries: 0,
  fsLiveRideUnderlyingDocChanges: 0,
  rtdbMotionUnderlyingDeliveries: 0,
});

function makeComplete(
  startAt: number,
  endAt: number,
  startCap: number,
  endCap: number,
): PairedCaptureState {
  return {
    plan: {
      startAtMs: startAt,
      endAtMs: endAt,
      requestedDurationMs: endAt - startAt,
      resetAtStart: true,
    },
    start: {
      kind: "start",
      scheduledAtMs: startAt,
      capturedAtMs: startCap,
      timerSkewMs: startCap - startAt,
      snap: emptySnap(startCap),
    },
    end: {
      kind: "end",
      scheduledAtMs: endAt,
      capturedAtMs: endCap,
      timerSkewMs: endCap - endAt,
      snap: emptySnap(endCap),
    },
    status: "complete",
  };
}

describe("trafficPairedCapture timing math", () => {
  it("computePairedCapturePlan: end − start === measureMs; start = now + lead", () => {
    const plan = computePairedCapturePlan(1_000_000, 45_000, 200, true);
    assert.equal(plan.startAtMs, 1_000_200);
    assert.equal(plan.endAtMs, 1_045_200);
    assert.equal(plan.requestedDurationMs, 45_000);
    assert.equal(plan.endAtMs - plan.startAtMs, plan.requestedDurationMs);
    assert.equal(plan.resetAtStart, true);
  });

  it("evaluate: accepts duration/skew within tight tolerance", () => {
    const a = makeComplete(1000, 46_000, 1005, 46_010);
    const v = evaluatePairedCaptureTiming(a, {
      durationTolMs: 300,
      skewTolMs: 250,
      alignTolMs: 250,
    });
    assert.equal(v.ok, true);
    assert.equal(v.actualDurationMs, 46_010 - 1005);
    assert.deepEqual(v.reasons, []);
  });

  it("evaluate: rejects duration stretch (CDP-inflated window surrogate)", () => {
    const a = makeComplete(1000, 46_000, 1000, 58_000);
    const v = evaluatePairedCaptureTiming(a, {
      durationTolMs: 300,
      skewTolMs: 250,
      alignTolMs: 250,
    });
    assert.equal(v.ok, false);
    assert.ok(v.reasons.some((r) => r.includes("duration")));
  });

  it("evaluate: rejects timer skew beyond tolerance (load diagnosis)", () => {
    const a = makeComplete(1000, 46_000, 1000, 46_800);
    const v = evaluatePairedCaptureTiming(a, {
      durationTolMs: 1000,
      skewTolMs: 250,
      alignTolMs: 250,
    });
    assert.equal(v.ok, false);
    assert.ok(v.reasons.some((r) => r.includes("end timer skew")));
    assert.ok(v.reasons.some((r) => r.includes("timer starvation")));
  });

  it("evaluate: rejects cross-page misalignment", () => {
    const a = makeComplete(1000, 46_000, 1000, 46_000);
    const b = makeComplete(1000, 46_000, 1500, 46_500);
    const v = evaluatePairedCaptureTiming(
      a,
      { durationTolMs: 300, skewTolMs: 250, alignTolMs: 250 },
      b,
    );
    assert.equal(v.ok, false);
    assert.ok(v.reasons.some((r) => r.includes("cross-page start align")));
  });

  it("delta windowMs from capture timestamps matches actualDuration", () => {
    const a = makeComplete(10_000, 55_000, 10_020, 55_040);
    const windowMs = a.end!.capturedAtMs - a.start!.capturedAtMs;
    assert.equal(windowMs, 45_020);
    const v = evaluatePairedCaptureTiming(a, {
      durationTolMs: 50,
      skewTolMs: 50,
      alignTolMs: 50,
    });
    assert.equal(v.ok, true);
    assert.equal(v.actualDurationMs, windowMs);
  });
});
