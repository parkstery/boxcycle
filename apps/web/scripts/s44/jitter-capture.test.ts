import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  analyzeJitterAxis,
  beginPeerJitterCapture,
  endPeerJitterCapture,
  noteJitterDisplay,
  noteJitterIngest,
  resetPeerJitterCaptureForTests,
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
    assert.equal(dump.judgment.axis, "undetermined");
  });

  it("거리축 — displayDistM 이 0.5 m 넘게 뒤로 가면 distance", () => {
    beginPeerJitterCapture(0);
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
    noteJitterDisplay({ atMs: 10, uid: "peer", displayDistM: 10, lng: 127, lat: 37 });
    noteJitterDisplay({ atMs: 20, uid: "peer", displayDistM: 10.2, lng: 127, lat: 37 });
    noteJitterDisplay({ atMs: 30, uid: "peer", displayDistM: 9.4, lng: 127, lat: 37 });
    const dump = endPeerJitterCapture(40);
    assert.equal(dump.judgment.axis, "distance");
    assert.ok(dump.judgment.maxDistBacktrackM > 0.5);
    assert.equal(dump.judgment.ingestEvents, 1);
  });

  it("화면축 — 거리는 단조인데 화면 앞뒤(Y)만 왕복하면 screen", () => {
    const frames = [
      { t: 0, d: 10, x: 100, y: 100 },
      { t: 16, d: 10.2, x: 100, y: 120 },
      { t: 32, d: 10.4, x: 100, y: 100 },
      { t: 48, d: 10.6, x: 100, y: 120 },
      { t: 64, d: 10.8, x: 100, y: 100 },
      { t: 80, d: 11.0, x: 100, y: 120 },
    ];
    const events = frames.map((f) => ({
      kind: "display" as const,
      atMs: f.t,
      uid: "peer",
      displayDistM: f.d,
      lng: 127,
      lat: 37,
      screenX: f.x,
      screenY: f.y,
    }));
    const j = analyzeJitterAxis(events);
    assert.equal(j.axis, "screen");
    assert.ok(j.maxDistBacktrackM <= 0.5);
    assert.ok(j.alongScreenReverseCount >= 3);
  });

  it("좌우(X)만 왕복하면 앞뒤 튐이 아니다 (none)", () => {
    const frames = [
      { t: 0, d: 10, x: 100, y: 200 },
      { t: 16, d: 10.2, x: 120, y: 200 },
      { t: 32, d: 10.4, x: 100, y: 200 },
      { t: 48, d: 10.6, x: 120, y: 200 },
      { t: 64, d: 10.8, x: 100, y: 200 },
      { t: 80, d: 11.0, x: 120, y: 200 },
    ];
    const events = frames.map((f) => ({
      kind: "display" as const,
      atMs: f.t,
      uid: "peer",
      displayDistM: f.d,
      lng: 127,
      lat: 37,
      screenX: f.x,
      screenY: f.y,
    }));
    const j = analyzeJitterAxis(events);
    assert.equal(j.axis, "none");
    assert.ok(j.screenReverseCount >= 3);
    assert.equal(j.alongScreenReverseCount, 0);
  });

  it("이 창에 튐이 없으면 none", () => {
    const events = [0, 1, 2, 3, 4].map((i) => ({
      kind: "display" as const,
      atMs: i * 16,
      uid: "peer",
      displayDistM: 10 + i * 0.3,
      lng: 127,
      lat: 37,
      screenX: 100 + i * 2,
      screenY: 200,
    }));
    const j = analyzeJitterAxis(events);
    assert.equal(j.axis, "none");
  });
});
