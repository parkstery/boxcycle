import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  analyzeJitterAxis,
  beginPeerJitterCapture,
  endPeerJitterCapture,
  estimateAlongTrackUnit,
  noteJitterDisplay,
  noteJitterIngest,
  resetPeerJitterCaptureForTests,
  type JitterDisplayEvent,
  type JitterMergeNote,
} from "../../src/lib/peerMotion/peerJitterCapture.ts";

const mergeNone: JitterMergeNote = {
  invoked: false,
  choice: "rtdb-only",
  reason: "test",
  wouldDistM: 10,
  wouldSpeedMps: 5,
  wouldPhase: "live",
  wouldServerAtMs: 1,
};

function displayFrames(
  rows: Array<{ t: number; d: number; x: number; y: number }>,
): JitterDisplayEvent[] {
  return rows.map((f) => ({
    kind: "display" as const,
    atMs: f.t,
    uid: "peer",
    conditionId: "t",
    displayDistM: f.d,
    lng: 127,
    lat: 37,
    screenX: f.x,
    screenY: f.y,
    localDistM: null,
    localScreenX: null,
    localScreenY: null,
    camBearing: null,
    camPitch: null,
    camLng: null,
    camLat: null,
  }));
}

afterEach(() => {
  resetPeerJitterCaptureForTests();
});

describe("peerJitterCapture", () => {
  it("begin 전에는 ingest/display 가 쌓이지 않는다", () => {
    noteJitterDisplay({
      atMs: 1,
      uid: "a",
      displayDistM: 1,
      lng: 127,
      lat: 37,
    });
    const dump = endPeerJitterCapture(2);
    assert.equal(dump.events.length, 0);
    assert.equal(dump.judgment.dominantSignal, "undetermined");
  });

  it("거리 역행은 0.5 m 미만도 버리지 않는다", () => {
    const events = displayFrames([
      { t: 0, d: 10, x: 0, y: 0 },
      { t: 16, d: 10.4, x: 4, y: 0 },
      { t: 32, d: 10.8, x: 8, y: 0 },
      { t: 48, d: 11.2, x: 12, y: 0 },
      { t: 64, d: 11.6, x: 16, y: 0 },
      { t: 80, d: 12.0, x: 20, y: 0 },
      { t: 96, d: 11.74, x: 24, y: 0 },
    ]);
    const j = analyzeJitterAxis(events);
    assert.ok(j.maxDistBacktrackM > 0.2);
    assert.ok(j.maxDistBacktrackM < 0.5);
    assert.ok(j.distBacktrackCount >= 1);
    assert.notEqual(j.dominantSignal, "quiet");
  });
});

describe("R0 진행축 자가 검산", () => {
  it("Y 우세 진행축에서 앞뒤 반전을 잡는다", () => {
    const events = displayFrames([
      { t: 0, d: 10.0, x: 100, y: 100 },
      { t: 16, d: 10.4, x: 100, y: 130 },
      { t: 32, d: 10.8, x: 100, y: 110 },
      { t: 48, d: 11.2, x: 100, y: 150 },
      { t: 64, d: 11.6, x: 100, y: 130 },
      { t: 80, d: 12.0, x: 100, y: 170 },
      { t: 96, d: 12.4, x: 100, y: 150 },
      { t: 112, d: 12.8, x: 100, y: 190 },
    ]);
    const u = estimateAlongTrackUnit(events, 4);
    assert.ok(u);
    assert.ok(Math.abs(u.uy) > Math.abs(u.ux));
    const j = analyzeJitterAxis(events);
    assert.equal(j.dominantSignal, "along-track-screen");
    assert.ok(j.alongReverseCount >= 2);
  });

  it("X 우세 진행축(좌측 카메라)에서도 앞뒤 반전을 잡는다 — 고정 Y 회귀", () => {
    const events = displayFrames([
      { t: 0, d: 10.0, x: 100, y: 400 },
      { t: 16, d: 10.4, x: 130, y: 400 },
      { t: 32, d: 10.8, x: 110, y: 400 },
      { t: 48, d: 11.2, x: 150, y: 400 },
      { t: 64, d: 11.6, x: 130, y: 400 },
      { t: 80, d: 12.0, x: 170, y: 400 },
      { t: 96, d: 12.4, x: 150, y: 400 },
      { t: 112, d: 12.8, x: 190, y: 400 },
    ]);
    const u = estimateAlongTrackUnit(events, 4);
    assert.ok(u);
    assert.ok(Math.abs(u.ux) > Math.abs(u.uy), "진행축이 X 우세여야 한다");
    const j = analyzeJitterAxis(events);
    assert.equal(j.dominantSignal, "along-track-screen");
    assert.ok(j.alongReverseCount >= 2);
  });

  it("진행축에 수직인 진동은 진행축 반전으로 세지 않는다", () => {
    const events = displayFrames([
      { t: 0, d: 10.0, x: 100, y: 200 },
      { t: 16, d: 10.5, x: 110, y: 220 },
      { t: 32, d: 11.0, x: 120, y: 200 },
      { t: 48, d: 11.5, x: 130, y: 220 },
      { t: 64, d: 12.0, x: 140, y: 200 },
      { t: 80, d: 12.5, x: 150, y: 220 },
      { t: 96, d: 13.0, x: 160, y: 200 },
      { t: 112, d: 13.5, x: 170, y: 220 },
    ]);
    const u = estimateAlongTrackUnit(events, 4);
    assert.ok(u);
    assert.ok(Math.abs(u.ux) > Math.abs(u.uy));
    const j = analyzeJitterAxis(events);
    assert.equal(j.alongReverseCount, 0);
    assert.ok(j.screenReverseCount >= 1);
  });
});

function displayFramesWithLocal(
  rows: Array<{ t: number; d: number; x: number; y: number; lx: number; ly: number }>,
): JitterDisplayEvent[] {
  return rows.map((f) => ({
    kind: "display" as const,
    atMs: f.t,
    uid: "peer",
    conditionId: "t",
    displayDistM: f.d,
    lng: 127,
    lat: 37,
    screenX: f.x,
    screenY: f.y,
    localDistM: f.d - 2,
    localScreenX: f.lx,
    localScreenY: f.ly,
    camBearing: null,
    camPitch: null,
    camLng: null,
    camLat: null,
  }));
}

describe("K1 세 계열 자가 검산", () => {
  it("① − ② 잔차가 ③ 과 같다", () => {
    const events = displayFramesWithLocal(
      Array.from({ length: 10 }, (_, i) => {
        const jitter = i % 2 === 0 ? 0 : 40;
        return {
          t: i * 16,
          d: 10 + i * 0.4,
          x: 100 + i * 12 + jitter,
          y: 400,
          lx: 200 + jitter,
          ly: 400,
        };
      }),
    );
    const j = analyzeJitterAxis(events);
    assert.equal(j.cameraSplit.hasLocalScreen, true);
    assert.equal(j.cameraSplit.k1Pass, true);
    assert.ok(j.cameraSplit.k1FrameCount >= 8);
    assert.ok(j.cameraSplit.k1MaxAbsResidualPx < 1e-6);
  });

  it("카메라: ①② 가 같이 수십 px 반전하고 ③ 은 반전 없다", () => {
    // 진행은 +X, 공통 지터만 부호가 뒤집힌다.
    const events = displayFramesWithLocal(
      [0, 50, -50, 50, -50, 50, -50, 50, -50, 50].map((j, i) => ({
        t: i * 16,
        d: 10 + i * 0.5,
        x: 120 + i * 14 + j,
        y: 400,
        lx: 220 + j,
        ly: 400,
      })),
    );
    const j = analyzeJitterAxis(events);
    assert.equal(j.cameraSplit.k1Pass, true);
    assert.equal(j.cameraSplit.s44ClassReproduced, true);
    assert.equal(j.cameraSplit.verdict, "camera");
    assert.ok(j.cameraSplit.peerAlong.maxReversePx >= 20);
    assert.ok(j.cameraSplit.localAlong.maxReversePx >= 20);
    assert.ok(j.cameraSplit.relativeAlong.maxReversePx < 20);
  });

  it("peer: ② 는 가만히 있고 ①③ 이 같이 수십 px 반전한다", () => {
    const events = displayFramesWithLocal(
      [0, 50, -50, 50, -50, 50, -50, 50, -50, 50].map((j, i) => ({
        t: i * 16,
        d: 10 + i * 0.5,
        x: 120 + i * 14 + j,
        y: 400,
        lx: 220,
        ly: 400,
      })),
    );
    const j = analyzeJitterAxis(events);
    assert.equal(j.cameraSplit.k1Pass, true);
    assert.equal(j.cameraSplit.s44ClassReproduced, true);
    assert.equal(j.cameraSplit.verdict, "peer");
    assert.ok(j.cameraSplit.peerAlong.maxReversePx >= 20);
    assert.ok(j.cameraSplit.relativeAlong.maxReversePx >= 20);
    assert.ok(j.cameraSplit.localAlong.maxReversePx < 20);
  });

  it("혼합: ① 반전이 ② 와 ③ 으로 나뉜다", () => {
    const events = displayFramesWithLocal(
      [0, 40, -30, 40, -30, 40, -30, 40, -30, 40].map((j, i) => {
        const localJ = j * 0.5;
        return {
          t: i * 16,
          d: 10 + i * 0.5,
          x: 120 + i * 14 + j,
          y: 400,
          lx: 220 + localJ,
          ly: 400,
        };
      }),
    );
    const j = analyzeJitterAxis(events);
    assert.equal(j.cameraSplit.k1Pass, true);
    assert.equal(j.cameraSplit.s44ClassReproduced, true);
    assert.equal(j.cameraSplit.verdict, "mixed");
    assert.ok(j.cameraSplit.localAlong.maxReversePx > 0);
    assert.ok(j.cameraSplit.relativeAlong.maxReversePx > 0);
  });

  it("수 px 반전은 S44급이 아니므로 카메라/peer 판정을 쓰지 않는다", () => {
    const events = displayFramesWithLocal(
      [0, 2, -2, 2, -2, 2, -2, 2, -2, 2].map((j, i) => ({
        t: i * 16,
        d: 10 + i * 0.5,
        x: 120 + i * 14 + j,
        y: 400,
        lx: 220 + j,
        ly: 400,
      })),
    );
    const j = analyzeJitterAxis(events);
    assert.equal(j.cameraSplit.k1Pass, true);
    assert.equal(j.cameraSplit.s44ClassReproduced, false);
    assert.equal(j.cameraSplit.verdict, null);
  });

  it("로컬 좌표가 없으면 판정을 쓰지 않는다", () => {
    const events = displayFrames([
      { t: 0, d: 10.0, x: 100, y: 400 },
      { t: 16, d: 10.5, x: 150, y: 400 },
      { t: 32, d: 11.0, x: 100, y: 400 },
      { t: 48, d: 11.5, x: 160, y: 400 },
      { t: 64, d: 12.0, x: 110, y: 400 },
      { t: 80, d: 12.5, x: 170, y: 400 },
      { t: 96, d: 13.0, x: 120, y: 400 },
      { t: 112, d: 13.5, x: 180, y: 400 },
    ]);
    const j = analyzeJitterAxis(events);
    assert.equal(j.cameraSplit.hasLocalScreen, false);
    assert.equal(j.cameraSplit.verdict, null);
    assert.equal(j.cameraSplit.k1Pass, false);
  });
});

describe("캡처 창", () => {
  it("conditionId 를 ingest 이벤트에 남긴다", () => {
    beginPeerJitterCapture(0, "C1");
    noteJitterIngest({
      atMs: 0,
      uid: "peer",
      rtdb: {
        recvAtMs: 0,
        serverAtMs: 0,
        distM: 10,
        speedMps: 5,
        phase: "live",
      },
      fs: null,
      merge: mergeNone,
      result: "accepted",
      newestDistM: 10,
      packetDistM: 10,
    });
    const dump = endPeerJitterCapture(1);
    assert.equal(dump.conditionId, "C1");
    assert.equal(dump.events[0]?.conditionId, "C1");
  });
});
