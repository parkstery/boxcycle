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
