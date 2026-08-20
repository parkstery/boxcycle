/**
 * S4-5 T1·T2·T3 — serverAtMs 가드 · distM dedup · stall entity.speedMps 홀드.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyPeerMotionIngest,
  createPeerMotionEntity,
  planPeerMotionStep,
  stepPeerMotionEntity,
} from "../../src/lib/peerMotion/integrator.ts";
import { PEER_INTERP_MAX_EXTRAP_MS } from "../../src/lib/rideSyncPolicy.ts";
import type { PeerMotionPacket } from "../../src/lib/peerMotion/types.ts";

const PUB = "pub-test";
const UID = "peer-1";

function pkt(partial: Partial<PeerMotionPacket> & { distM: number }): PeerMotionPacket {
  return {
    uid: UID,
    publicationId: PUB,
    speedMps: 6,
    phase: "live",
    serverAtMs: 10_000,
    ...partial,
  };
}

describe("S4-5 integrator 가드", () => {
  it("T2: 같은 distM 은 serverAtMs 가 달라도 dist 전진 dedup", () => {
    const realNow = Date.now;
    let clock = 20_000;
    Date.now = () => clock;
    try {
      const e = createPeerMotionEntity(pkt({ distM: 10, serverAtMs: 10_000 }), "p");
      clock = 20_100;
      const r = applyPeerMotionIngest(e, pkt({ distM: 10, serverAtMs: 10_500, speedMps: 0 }), "p");
      assert.equal(r, "dup-same-dist");
      assert.equal(e.buffer.length, 1);
    } finally {
      Date.now = realNow;
    }
  });

  it("T1: serverAtMs=0 이면 recv 폴백하고 횟수를 센다", () => {
    const realNow = Date.now;
    let clock = 20_000;
    Date.now = () => clock;
    try {
      const e = createPeerMotionEntity(pkt({ distM: 0, serverAtMs: 0, speedMps: 8 }), "p");
      for (let i = 1; i <= 5; i += 1) {
        clock = 20_000 + i * 100;
        applyPeerMotionIngest(
          e,
          pkt({ distM: 8 * (i * 0.1), serverAtMs: 0, speedMps: 8 }),
          "p",
        );
      }
      clock = 20_800;
      stepPeerMotionEntity(e, 0.1, 2000, clock);
      assert.ok(e.serverAxisFallbackCount >= 1, `fallback=${e.serverAxisFallbackCount}`);
      const plan = planPeerMotionStep(e, clock);
      assert.equal(plan.usedServerAxis, false);
    } finally {
      Date.now = realNow;
    }
  });

  it("T3: stall 홀드는 MAX_EXTRAP 후 멈추고 entity.speedMps 를 쓴다", () => {
    const realNow = Date.now;
    let clock = 20_000;
    Date.now = () => clock;
    try {
      const e = createPeerMotionEntity(pkt({ distM: 0, serverAtMs: 10_000, speedMps: 8 }), "p");
      for (let i = 1; i <= 10; i += 1) {
        clock = 20_000 + i * 100;
        applyPeerMotionIngest(
          e,
          pkt({
            distM: 8 * (i * 0.1),
            serverAtMs: 10_000 + i * 100,
            speedMps: 8,
          }),
          "p",
        );
      }
      const lastDist = e.buffer[e.buffer.length - 1]!.distM;
      clock = 20_000 + 10 * 100 + 3_000;
      stepPeerMotionEntity(e, 0.1, 2000, clock);
      const plan = planPeerMotionStep(e, clock);
      assert.equal(plan.mode, "extrapolate");
      assert.ok((plan.aheadMs ?? 0) <= PEER_INTERP_MAX_EXTRAP_MS + 1e-6);
      const maxAhead = lastDist + e.speedMps * (PEER_INTERP_MAX_EXTRAP_MS / 1000) + 0.05;
      assert.ok(e.displayDistM <= maxAhead, `display=${e.displayDistM} max=${maxAhead}`);
    } finally {
      Date.now = realNow;
    }
  });

  it("T3: 정지 패킷 뒤 외삽은 entity.speedMps=0 이라 오버슛이 없다", () => {
    const realNow = Date.now;
    let clock = 20_000;
    Date.now = () => clock;
    try {
      const e = createPeerMotionEntity(pkt({ distM: 0, serverAtMs: 10_000, speedMps: 6 }), "p");
      for (let i = 1; i <= 8; i += 1) {
        clock = 20_000 + i * 100;
        applyPeerMotionIngest(
          e,
          pkt({
            distM: 6 * (i * 0.1),
            serverAtMs: 10_000 + i * 100,
            speedMps: 6,
          }),
          "p",
        );
      }
      const held = e.buffer[e.buffer.length - 1]!.distM;
      for (let i = 0; i < 12; i += 1) {
        clock = 20_800 + 100 + i * 200;
        applyPeerMotionIngest(
          e,
          pkt({ distM: held, serverAtMs: 10_800 + i * 200, speedMps: 0 }),
          "p",
        );
      }
      assert.equal(e.speedMps, 0);
      clock += 2_000;
      stepPeerMotionEntity(e, 0.1, 2000, clock);
      assert.ok(e.displayDistM <= held + 0.05, `overshoot ${e.displayDistM - held}`);
    } finally {
      Date.now = realNow;
    }
  });
});
