/**
 * S4-13 B1·B3·B4 — 표시 노브. OFF=현재 보간, 프로덕션 강제 off, 발행 코드는 노브를 모른다.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  applyPeerMotionIngest,
  createPeerMotionEntity,
  stepPeerMotionEntity,
} from "../../src/lib/peerMotion/integrator.ts";
import { PeerMotionRegistry } from "../../src/lib/peerMotion/PeerMotionRegistry.ts";
import {
  peerDispSpec,
  readPeerDispMode,
} from "../../src/lib/peerMotion/peerDisplayMode.ts";
import { resetPeerDisplayAbsorb } from "../../src/lib/peerMotion/peerDisplayAbsorb.ts";
import {
  PEER_INTERP_BUFFER_MAX,
  PEER_INTERP_DELAY_MS,
  PEER_INTERP_MAX_EXTRAP_MS,
} from "../../src/lib/rideSyncPolicy.ts";
import type { PeerMotionPacket } from "../../src/lib/peerMotion/types.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(HERE, "../../src");
const WEB = resolve(HERE, "../..");

function pkt(partial: Partial<PeerMotionPacket> & { distM: number }): PeerMotionPacket {
  return {
    uid: "u2",
    publicationId: "pub-test",
    speedMps: 6,
    phase: "live",
    serverAtMs: 10_000,
    ...partial,
  };
}

function withWindow(win: { __RTW_PEER_DISP__?: string; location?: { search: string } }, fn: () => void): void {
  const prev = (globalThis as { window?: unknown }).window;
  (globalThis as { window?: unknown }).window = win;
  try {
    fn();
  } finally {
    if (prev === undefined) delete (globalThis as { window?: unknown }).window;
    else (globalThis as { window?: unknown }).window = prev;
  }
}

describe("S4-13 peer 표시 노브", () => {
  it("B3: envDev=false 이면 URL·window 가 a 여도 off", () => {
    withWindow({ __RTW_PEER_DISP__: "a", location: { search: "?peerDisp=b" } }, () => {
      assert.equal(readPeerDispMode(false), "off");
      assert.equal(peerDispSpec(readPeerDispMode(false)), null);
    });
  });

  it("B1: 기본(파라미터 없음)은 off", () => {
    withWindow({ location: { search: "" } }, () => {
      assert.equal(readPeerDispMode(true), "off");
    });
    assert.equal(readPeerDispMode(true), "off");
  });

  it("B1: 상수 160·16·1200 이 그대로다", () => {
    assert.equal(PEER_INTERP_DELAY_MS, 160);
    assert.equal(PEER_INTERP_BUFFER_MAX, 16);
    assert.equal(PEER_INTERP_MAX_EXTRAP_MS, 1200);
  });

  it("B1: integrator 는 표시 노브를 import 하지 않는다", () => {
    const src = readFileSync(resolve(SRC, "lib/peerMotion/integrator.ts"), "utf8");
    assert.equal(src.includes("peerDisplayMode"), false);
    assert.equal(src.includes("peerDisplayAbsorb"), false);
  });

  it("B1: OFF registry.step 은 integrator step 과 같다", () => {
    resetPeerDisplayAbsorb();
    const realNow = Date.now;
    let clock = 20_000;
    Date.now = () => clock;
    withWindow({ location: { search: "?peerDisp=off" } }, () => {
      try {
        clock = 20_000;
        const e = createPeerMotionEntity(pkt({ distM: 10, serverAtMs: 10_000 }), "p");
        clock = 20_160;
        applyPeerMotionIngest(e, pkt({ distM: 11.0, serverAtMs: 10_100, speedMps: 6 }), "p");

        clock = 20_000;
        const reg = new PeerMotionRegistry();
        reg.ingest(pkt({ distM: 10, serverAtMs: 10_000 }), "p");
        clock = 20_160;
        reg.ingest(pkt({ distM: 11.0, serverAtMs: 10_100, speedMps: 6 }), "p");

        const nowMs = 20_320;
        stepPeerMotionEntity(e, 0.016, 10_000, nowMs);
        reg.step(0.016, null, nowMs);
        assert.equal(reg.peekDisplayDistM("u2"), e.displayDistM);
      } finally {
        Date.now = realNow;
        resetPeerDisplayAbsorb();
      }
    });
  });

  it("B2: A 모드는 OFF 와 표시 거리가 다르다", () => {
    resetPeerDisplayAbsorb();
    const realNow = Date.now;
    let clock = 20_000;
    Date.now = () => clock;
    try {
      clock = 20_000;
      const offReg = new PeerMotionRegistry();
      withWindow({ location: { search: "?peerDisp=off" } }, () => {
        offReg.ingest(pkt({ distM: 10, serverAtMs: 10_000 }), "p");
        clock = 20_160;
        offReg.ingest(pkt({ distM: 11.0, serverAtMs: 10_100, speedMps: 6 }), "p");
        offReg.step(0.016, null, 20_320);
      });
      const offDist = offReg.peekDisplayDistM("u2");

      clock = 20_000;
      resetPeerDisplayAbsorb();
      const aReg = new PeerMotionRegistry();
      withWindow({ __RTW_PEER_DISP__: "a" }, () => {
        aReg.ingest(pkt({ distM: 10, serverAtMs: 10_000 }), "p");
        clock = 20_160;
        aReg.ingest(pkt({ distM: 11.0, serverAtMs: 10_100, speedMps: 6 }), "p");
        aReg.step(0.016, null, 20_320);
      });
      const aDist = aReg.peekDisplayDistM("u2");
      assert.ok(typeof offDist === "number" && typeof aDist === "number");
      assert.notEqual(aDist, offDist);
    } finally {
      Date.now = realNow;
      resetPeerDisplayAbsorb();
    }
  });

  it("B4: 발행 경로 파일은 peerDisplayMode 를 import 하지 않는다", () => {
    const files = [
      "lib/peerMotion/motionPublishFlight.ts",
      "lib/liveLocationSnapshot.ts",
      "lib/rtdbTrailMotion.ts",
      "hooks/useLiveLocationPublishSession.ts",
      "lib/peerMotion/routePublishFlight.ts",
    ];
    for (const f of files) {
      const src = readFileSync(resolve(SRC, f), "utf8");
      assert.equal(src.includes("peerDisplayMode"), false, f);
      assert.equal(src.includes("peerDisplayAbsorb"), false, f);
    }
  });

  it("A·B spec 은 E=0.3 · τ_lead=0 이고 τ 만 다르다", () => {
    const a = peerDispSpec("a");
    const b = peerDispSpec("b");
    assert.equal(a?.eM, 0.3);
    assert.equal(b?.eM, 0.3);
    assert.equal(a?.tauLeadSec, 0);
    assert.equal(b?.tauLeadSec, 0);
    assert.equal(a?.tauAbs, 0.25);
    assert.equal(b?.tauAbs, 0.3);
  });

  it("B1: Registry OFF 분기는 stepPeerMotionEntity 다", () => {
    const src = readFileSync(resolve(WEB, "src/lib/peerMotion/PeerMotionRegistry.ts"), "utf8");
    assert.match(src, /const spec = peerDispSpec\(readPeerDispMode\(\)\)/);
    assert.match(src, /resetPeerDisplayAbsorb\(entity\.uid\)/);
    assert.match(src, /stepPeerMotionEntity\(entity, clampedDt, routeLenM, nowMs\)/);
  });
});
