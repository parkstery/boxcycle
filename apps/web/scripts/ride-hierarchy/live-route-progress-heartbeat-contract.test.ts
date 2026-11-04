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
  isRtdbMotionHealthy,
  rtdbMotionHealthReason,
  PEER_MOTION_PUBLISH_INTERVAL_MS,
  RTDB_MOTION_HEALTHY_ACK_WINDOW_MS,
  TRAIL_LIVE_PROGRESS_HEARTBEAT_MS,
  TRAIL_LIVE_PROGRESS_HEARTBEAT_RTDB_HEALTHY_MS,
  TRAIL_LIVE_SPEED_DELTA_RTDB_HEALTHY_MPS,
  TRAIL_LIVE_SPEED_WRITE_MIN_GAP_MS,
  TRAIL_LIVE_SPEED_WRITE_MIN_GAP_RTDB_HEALTHY_MS,
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
      shouldPublishRouteProgress(t0 + TRAIL_LIVE_SPEED_WRITE_MIN_GAP_MS, state, 0.21, 210, 2 + SPEED_PUBLISH_DELTA_MPS),
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

describe("비용 L4 — RTDB 정상일 때만 Firestore 하트비트 12초 (2026-11-04)", () => {
  it("RTDB 정상: 4초에는 쓰지 않고 12초에 쓴다. 속도 변화는 즉시", () => {
    const state = createLiveLocationPublishThrottleState();
    const t0 = 10_000;
    markRouteProgressPublished(state, t0, 0.1, 100, 2);
    assert.equal(shouldPublishRouteProgress(t0 + TRAIL_LIVE_PROGRESS_HEARTBEAT_MS, state, 0.12, 120, 2, true), false);
    assert.equal(
      shouldPublishRouteProgress(t0 + TRAIL_LIVE_PROGRESS_HEARTBEAT_RTDB_HEALTHY_MS - 1, state, 0.13, 130, 2, true),
      false,
    );
    assert.equal(
      shouldPublishRouteProgress(t0 + TRAIL_LIVE_PROGRESS_HEARTBEAT_RTDB_HEALTHY_MS, state, 0.14, 140, 2, true),
      true,
    );
    assert.equal(
      shouldPublishRouteProgress(
        t0 + TRAIL_LIVE_SPEED_WRITE_MIN_GAP_RTDB_HEALTHY_MS,
        state,
        0.11,
        110,
        2 + TRAIL_LIVE_SPEED_DELTA_RTDB_HEALTHY_MPS,
        true,
      ),
      true,
      "큰 속도 변화는 하트비트를 기다리지 않는다(최소 간격 뒤)",
    );
  });

  it("RTDB 비정상(기본값)이면 종전 4초 그대로", () => {
    const state = createLiveLocationPublishThrottleState();
    const t0 = 10_000;
    markRouteProgressPublished(state, t0, 0.1, 100, 2);
    assert.equal(shouldPublishRouteProgress(t0 + TRAIL_LIVE_PROGRESS_HEARTBEAT_MS, state, 0.12, 120, 2), true);
    assert.equal(shouldPublishRouteProgress(t0 + TRAIL_LIVE_PROGRESS_HEARTBEAT_MS, state, 0.12, 120, 2, false), true);
  });

  it("정상 판정: 연결 표시 + 최근 서버 응답 둘 다 있어야 한다", () => {
    const nowMs = 100_000;
    assert.equal(isRtdbMotionHealthy({ connected: true, lastAckAtMs: nowMs - 100, nowMs }), true);
    assert.equal(
      isRtdbMotionHealthy({ connected: true, lastAckAtMs: nowMs - RTDB_MOTION_HEALTHY_ACK_WINDOW_MS - 1, nowMs }),
      false,
      "응답이 끊긴 지 오래면 비정상(오프라인에서는 set 이 응답하지 않는다)",
    );
    assert.equal(isRtdbMotionHealthy({ connected: false, lastAckAtMs: nowMs - 100, nowMs }), false);
    assert.equal(isRtdbMotionHealthy({ connected: true, lastAckAtMs: null, nowMs }), false, "한 번도 응답 없음");
    assert.equal(isRtdbMotionHealthy({ connected: true, lastAckAtMs: nowMs + 5_000, nowMs }), false, "미래 시각은 신뢰하지 않는다");
  });
});

describe("비용 L4b — 가속 중 연속 쓰기 막기 (2026-11-04 운영 실측: 쓰기의 77%가 1초 안 연속)", () => {
  /** 100ms 틱으로 10초 동안 0.7 m/s² 가속 — 운영 로그의 0.4초 간격 연속 쓰기를 재현한다. */
  function writesDuringRamp(rtdbHealthy: boolean): number {
    const state = createLiveLocationPublishThrottleState();
    const t0 = 50_000;
    markRouteProgressPublished(state, t0, 0.1, 100, 2);
    let writes = 0;
    for (let ms = 100; ms <= 10_000; ms += 100) {
      const speed = 2 + 0.7 * (ms / 1000);
      if (shouldPublishRouteProgress(t0 + ms, state, 0.1, 100, speed, rtdbHealthy)) {
        markRouteProgressPublished(state, t0 + ms, 0.1, 100, speed);
        writes += 1;
      }
    }
    return writes;
  }

  it("RTDB 정상: 10초 가속에 3회 이하", () => {
    const n = writesDuringRamp(true);
    assert.ok(n >= 1 && n <= 3, `writes=${n}`);
  });

  it("RTDB 비정상: 10초 가속에 10회 이하, 그래도 1초마다는 전달된다", () => {
    const n = writesDuringRamp(false);
    assert.ok(n >= 5 && n <= 10, `writes=${n}`);
  });

  it("정상 판정 이유를 구분한다(운영 진단용)", () => {
    const nowMs = 100_000;
    assert.equal(rtdbMotionHealthReason({ connected: true, lastAckAtMs: nowMs - 10, nowMs }), "healthy");
    assert.equal(rtdbMotionHealthReason({ connected: false, lastAckAtMs: nowMs - 10, nowMs }), "disconnected");
    assert.equal(rtdbMotionHealthReason({ connected: true, lastAckAtMs: null, nowMs }), "noAck");
    assert.equal(rtdbMotionHealthReason({ connected: true, lastAckAtMs: nowMs - 9_000, nowMs }), "staleAck");
  });
});
