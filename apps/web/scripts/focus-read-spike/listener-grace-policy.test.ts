import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  initialListenerGraceOpenState,
  LISTENER_VISIBILITY_GRACE_MS,
  reduceListenerVisibilityGrace,
} from "../../src/lib/trail/listenerVisibilityGracePolicy.ts";
import { decidePresenceWriteResume } from "../../src/lib/trail/presenceWriteResumePolicy.ts";
import { TRAIL_PRESENCE_HEARTBEAT_ACTIVE_MS } from "../../src/lib/trail/trailLivePolicy.ts";

describe("listenerVisibilityGracePolicy", () => {
  const grace = LISTENER_VISIBILITY_GRACE_MS;

  it("short hide while open → keep open and start grace timer", () => {
    const open = { open: true };
    const next = reduceListenerVisibilityGrace(open, {
      type: "sync",
      input: { eligible: true, pageVisible: false },
    });
    assert.equal(next.open, true);
    assert.equal(next.timer, "start");
    assert.equal(next.timerMs, grace);
  });

  it("visible during grace → cancel timer and keep open", () => {
    const next = reduceListenerVisibilityGrace(
      { open: true },
      { type: "sync", input: { eligible: true, pageVisible: true } },
    );
    assert.equal(next.open, true);
    assert.equal(next.timer, "cancel");
  });

  it("long hide grace timeout → close", () => {
    const next = reduceListenerVisibilityGrace({ open: true }, { type: "grace_timeout" });
    assert.equal(next.open, false);
    assert.equal(next.timer, "none");
  });

  it("eligibility loss → immediate close (cancel grace)", () => {
    const next = reduceListenerVisibilityGrace(
      { open: true },
      { type: "sync", input: { eligible: false, pageVisible: false } },
    );
    assert.equal(next.open, false);
    assert.equal(next.timer, "cancel");
  });

  it("never opened + hide → stay closed (no timer)", () => {
    const next = reduceListenerVisibilityGrace(initialListenerGraceOpenState(), {
      type: "sync",
      input: { eligible: true, pageVisible: false },
    });
    assert.equal(next.open, false);
    assert.equal(next.timer, "none");
  });
});

describe("presenceWriteResumePolicy", () => {
  const interval = TRAIL_PRESENCE_HEARTBEAT_ACTIVE_MS;
  const t0 = 2_000_000;

  it("first entry / no prior success → immediate", () => {
    assert.deepEqual(
      decidePresenceWriteResume({
        lastSuccessAtMs: null,
        nowMs: t0,
        heartbeatIntervalMs: interval,
      }),
      { action: "immediate" },
    );
  });

  it("fresh resume within heartbeat → schedule remaining", () => {
    const age = 5_000;
    assert.deepEqual(
      decidePresenceWriteResume({
        lastSuccessAtMs: t0,
        nowMs: t0 + age,
        heartbeatIntervalMs: interval,
      }),
      { action: "schedule", delayMs: interval - age },
    );
  });

  it("stale resume at/after heartbeat → immediate", () => {
    assert.deepEqual(
      decidePresenceWriteResume({
        lastSuccessAtMs: t0,
        nowMs: t0 + interval,
        heartbeatIntervalMs: interval,
      }),
      { action: "immediate" },
    );
  });

  it("new Trail session (caller nulls lastSuccess) → immediate", () => {
    assert.deepEqual(
      decidePresenceWriteResume({
        lastSuccessAtMs: null,
        nowMs: t0 + 1_000,
        heartbeatIntervalMs: interval,
      }),
      { action: "immediate" },
    );
  });
});
