import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  analyzeJitterAxis,
  beginPeerJitterCapture,
  endPeerJitterCapture,
  lastPeerDisplayGap,
  estimateAlongTrackUnit,
  LOCAL_SOLO_UID,
  measureCaptureSurvival,
  measureGapWindow,
  noteJitterDisplay,
  noteJitterIngest,
  resetPeerJitterCaptureForTests,
  type JitterDisplayEvent,
  type JitterMergeNote,
} from "../../src/lib/peerMotion/peerJitterCapture.ts";
import {
  buildShotManifest,
  medianShotIntervalMs,
  peakShotSeparationMs,
  pickMagnitudeBundles,
} from "./shot-manifest.ts";

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
    gapDistM: 2,
    gapScreenPx: Math.hypot(f.x - f.lx, f.y - f.ly),
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

describe("L0 계측 생존 · 로컬 단독", () => {
  function soloFrames(
    rows: Array<{ t: number; d: number; x: number; y: number; ax?: number; ay?: number }>,
  ): JitterDisplayEvent[] {
    return rows.map((f) => ({
      kind: "display" as const,
      atMs: f.t,
      uid: LOCAL_SOLO_UID,
      conditionId: "S-A",
      displayDistM: f.d,
      lng: 127,
      lat: 37,
      screenX: f.x,
      screenY: f.y,
      localDistM: f.d,
      localScreenX: f.x,
      localScreenY: f.y,
      aheadScreenX: f.ax ?? f.x + 40,
      aheadScreenY: f.ay ?? f.y,
      soloLocal: true,
      camBearing: null,
      camPitch: null,
      camLng: null,
      camLat: null,
    }));
  }

  it("3-1~3-4 통과: 로컬 거리 회귀로 û 가 나오고 화면이 움직인다", () => {
    const events = soloFrames(
      [0, 40, -40, 40, -40, 40, -40, 40, -40, 40].map((j, i) => ({
        t: i * 16,
        d: 10 + i * 0.5,
        x: 120 + i * 14 + j,
        y: 400,
      })),
    );
    const s = measureCaptureSurvival(events);
    assert.equal(s.displayFrames, 10);
    assert.equal(s.hasLocalScreen, true);
    assert.equal(s.uhatFromLocalDist, true);
    assert.ok(s.localScreenTravelPx > 0);
    assert.equal(s.pass, true);
    const j = analyzeJitterAxis(events);
    assert.ok(j.cameraSplit.localAlong.reverseCount >= 2);
    assert.ok(j.survival.pass);
  });

  it("팔로우 잠금처럼 회귀가 죽어도 ahead 접선으로 û 가 산다", () => {
    const events = soloFrames(
      [0, 4, -4, 4, -4, 4, -4, 4, -4, 4].map((j, i) => ({
        t: i * 16,
        d: 10 + i * 0.5,
        x: 640 + j,
        y: 440,
        ax: 640 + j + 50,
        ay: 440,
      })),
    );
    const uReg = estimateAlongTrackUnit(events, 4, "local");
    assert.equal(uReg, null);
    const s = measureCaptureSurvival(events);
    assert.equal(s.pass, true);
    assert.equal(s.uhatSource, "local-path-tangent");
    const j = analyzeJitterAxis(events);
    assert.ok(j.cameraSplit.localAlong.reverseCount >= 2);
  });

  it("화면 총 변위 0 이면 3-4 실패 — 흔들림 없음으로 읽지 않는다", () => {
    const events = soloFrames(
      Array.from({ length: 10 }, (_, i) => ({
        t: i * 16,
        d: 10 + i * 0.5,
        x: 640,
        y: 440,
        ax: 690,
        ay: 440,
      })),
    );
    const s = measureCaptureSurvival(events);
    assert.equal(s.uhatFromLocalDist, true);
    assert.equal(s.localScreenTravelPx, 0);
    assert.equal(s.pass, false);
    assert.ok(s.failReasons.some((r) => r.startsWith("3-4")));
  });

  it("display 가 없으면 3-1 실패", () => {
    const s = measureCaptureSurvival([]);
    assert.equal(s.displayFrames, 0);
    assert.equal(s.pass, false);
    assert.ok(s.failReasons.some((r) => r.startsWith("3-1")));
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

describe("N0 창 전체 gap", () => {
  it("|gap|≤5 m 이면 allAbsLe5m", () => {
    const events = displayFramesWithLocal(
      Array.from({ length: 8 }, (_, i) => ({
        t: i * 16,
        d: 10 + i * 0.4,
        x: 100 + i * 10,
        y: 400,
        lx: 90 + i * 10,
        ly: 400,
      })),
    );
    for (const e of events) e.gapDistM = 3.2;
    const g = measureGapWindow(events);
    assert.equal(g.allAbsLe5m, true);
    assert.equal(g.maxAbsGapDistM, 3.2);
  });

  it("한 프레임이라도 5 m 를 넘으면 allAbsLe5m 이 아니다", () => {
    const events = displayFramesWithLocal(
      Array.from({ length: 8 }, (_, i) => ({
        t: i * 16,
        d: 10 + i * 0.4,
        x: 100 + i * 10,
        y: 400,
        lx: 90 + i * 10,
        ly: 400,
      })),
    );
    events[3]!.gapDistM = 7.8;
    const g = measureGapWindow(events);
    assert.equal(g.allAbsLe5m, false);
    assert.ok((g.maxAbsGapDistM ?? 0) > 5);
  });

  it("lastPeerDisplayGap 은 마지막 비-단독 display 를 본다", () => {
    beginPeerJitterCapture(0, "align");
    noteJitterDisplay({
      atMs: 10,
      uid: "peer",
      displayDistM: 12,
      lng: 127,
      lat: 37,
      localDistM: 10,
    });
    const g = lastPeerDisplayGap();
    assert.equal(g.gapDistM, 2);
    assert.equal(g.atMs, 10);
  });
});

describe("S4-4R5 샷 매니페스트 · 상위/하위 묶음", () => {
  it("샷 간격 중앙값을 낸다", () => {
    const shots = [
      { i: 0, atMs: 0, file: "F000.png" },
      { i: 1, atMs: 80, file: "F001.png" },
      { i: 2, atMs: 160, file: "F002.png" },
      { i: 3, atMs: 300, file: "F003.png" },
    ];
    assert.equal(medianShotIntervalMs(shots), 80);
  });

  it("피크와 최근접 샷 이격을 낸다", () => {
    const shots = [
      { i: 0, atMs: 1000, file: "F000.png" },
      { i: 1, atMs: 1080, file: "F001.png" },
    ];
    assert.equal(peakShotSeparationMs(1070, shots), 10);
  });

  it("샷마다 frameIndex · atMs · relSPx · gapDistM 을 붙인다", () => {
    const shots = [{ i: 0, atMs: 105, file: "F000.png" }];
    const display = [
      { atMs: 90, gapDistM: 3.2, screenX: 540, localScreenX: 640 },
      { atMs: 110, gapDistM: 3.4, screenX: 538, localScreenX: 640 },
    ];
    const samples = [
      { atMs: 90, relSPx: 1.2, localSPx: 0.1, peerSPx: 1.3 },
      { atMs: 110, relSPx: 8.5, localSPx: 0.2, peerSPx: 8.7 },
    ];
    const m = buildShotManifest(shots, display, samples);
    assert.equal(m[0]!.frameIndex, 1);
    assert.equal(m[0]!.atMs, 110);
    assert.equal(m[0]!.relSPx, 8.5);
    assert.equal(m[0]!.gapDistM, 3.4);
    assert.equal(m[0]!.dtMs, 5);
  });

  it("상위/하위 10% 묶음은 같은 길이고 상위가 더 큰 반전을 담는다", () => {
    const shots = Array.from({ length: 20 }, (_, i) => ({
      i,
      atMs: i * 80,
      file: `F${String(i).padStart(3, "0")}.png`,
    }));
    const display = shots.map((s) => ({
      atMs: s.atMs,
      gapDistM: 3.2,
      screenX: 540,
      localScreenX: 640,
    }));
    const samples = shots.map((s, i) => ({
      atMs: s.atMs,
      relSPx: i < 8 ? 9 : 1,
      localSPx: 0.2,
      peerSPx: i < 8 ? 9.2 : 1.2,
    }));
    const reverses = shots.map((s, i) => ({
      atMs: s.atMs,
      magPx: i < 8 ? 9 : 1,
      relSPx: i < 8 ? 9 : 1,
      gapDistM: 3.2,
      displayIndex: i,
    }));
    const manifest = buildShotManifest(shots, display, samples);
    const b = pickMagnitudeBundles(manifest, reverses, 8);
    assert.ok(b.top && b.bottom);
    assert.equal(b.top.files.length, b.bottom.files.length);
    assert.equal(b.top.files.length, 8);
    assert.ok((b.top.maxAbsRelSPx ?? 0) > (b.bottom.maxAbsRelSPx ?? 0));
    assert.equal(b.top.localScreenXRangePx, 0);
  });
});
