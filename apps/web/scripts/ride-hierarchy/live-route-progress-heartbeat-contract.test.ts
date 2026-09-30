/**
 * TASK-31A — Firestore livePublicationRides steady heartbeat gate.
 *
 * Steady riding writes every TRAIL_LIVE_PROGRESS_HEARTBEAT_MS (4s).
 * Immediate initial, speed-change, and RTDB 5Hz motion are separate contracts.
 *
 * 실행: node --experimental-strip-types --import ./scripts/s42/register-vite-env.mjs \
 *   --test scripts/ride-hierarchy/live-route-progress-heartbeat-contract.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createLiveLocationPublishThrottleState,
  markRouteProgressPublished,
  shouldPublishPeerMotion,
  shouldPublishRouteProgress,
} from "../../src/lib/ride/liveLocationSnapshot.ts";
import {
  PEER_MOTION_PUBLISH_INTERVAL_MS,
  TRAIL_LIVE_PROGRESS_HEARTBEAT_MS,
} from "../../src/lib/ride/rideSyncPolicy.ts";
import { PEER_LIVE_RIDE_STALE_MS } from "../../src/lib/trail/trailLivePolicy.ts";

/** Matches liveLocationSnapshot SPEED_PUBLISH_DELTA_MPS (≈1 km/h). */
const SPEED_PUBLISH_DELTA_MPS = 0.28;

describe("TASK-31A — livePublicationRides 4s heartbeat gate", () => {
  it("policy: 4s steady FS heartbeat, RTDB stays 5Hz, stale margin ≫ one tick", () => {
    assert.equal(TRAIL_LIVE_PROGRESS_HEARTBEAT_MS, 4_000);
    assert.equal(PEER_MOTION_PUBLISH_INTERVAL_MS, 200);
    assert.ok(
      PEER_LIVE_RIDE_STALE_MS - TRAIL_LIVE_PROGRESS_HEARTBEAT_MS >= 10_000,
      `stale margin ${PEER_LIVE_RIDE_STALE_MS - TRAIL_LIVE_PROGRESS_HEARTBEAT_MS}ms too thin`,
    );
  });

  it("immediate initial publish (routeWriteAt === 0)", () => {
    const state = createLiveLocationPublishThrottleState();
    assert.equal(shouldPublishRouteProgress(1_000, state, 0.1, 100, 2), true);
  });

  it("rejects steady ticks before heartbeat; accepts at / after boundary", () => {
    const state = createLiveLocationPublishThrottleState();
    const t0 = 10_000;
    markRouteProgressPublished(state, t0, 0.1, 100, 2);

    assert.equal(shouldPublishRouteProgress(t0 + 1, state, 0.11, 110, 2), false);
    assert.equal(
      shouldPublishRouteProgress(t0 + TRAIL_LIVE_PROGRESS_HEARTBEAT_MS - 1, state, 0.12, 120, 2),
      false,
    );
    assert.equal(
      shouldPublishRouteProgress(t0 + TRAIL_LIVE_PROGRESS_HEARTBEAT_MS, state, 0.13, 130, 2),
      true,
    );
    assert.equal(
      shouldPublishRouteProgress(t0 + TRAIL_LIVE_PROGRESS_HEARTBEAT_MS + 50, state, 0.14, 140, 2),
      true,
    );
  });

  it("speed-change bypasses heartbeat wait (≥ Δ mps)", () => {
    const state = createLiveLocationPublishThrottleState();
    const t0 = 20_000;
    markRouteProgressPublished(state, t0, 0.2, 200, 2);

    assert.equal(
      shouldPublishRouteProgress(t0 + 200, state, 0.21, 210, 2 + SPEED_PUBLISH_DELTA_MPS - 0.01),
      false,
      "sub-threshold speed wobble must wait for heartbeat",
    );
    assert.equal(
      shouldPublishRouteProgress(t0 + 200, state, 0.21, 210, 2 + SPEED_PUBLISH_DELTA_MPS),
      true,
      "≥1 km/h class speed change publishes immediately",
    );
  });

  it("RTDB motion gate stays 5Hz (unchanged by FS heartbeat)", () => {
    const state = createLiveLocationPublishThrottleState();
    const t0 = 30_000;
    state.motionWriteAt = t0;
    state.motionSpeedMps = 3;

    assert.equal(shouldPublishPeerMotion(t0 + 199, state, 3), false);
    assert.equal(shouldPublishPeerMotion(t0 + PEER_MOTION_PUBLISH_INTERVAL_MS, state, 3), true);
  });
});
