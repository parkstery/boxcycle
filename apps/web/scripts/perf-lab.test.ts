import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  isPerfLabEnabled,
  percentileNearestRank,
  readPerfLabSearch,
  resetPerfLabForTests,
  summarizeFrameIntervals,
  type FrameIntervalSample,
} from "../src/lib/debug/perfLab.ts";
import {
  measureRiderPose,
  measureRiderRenderFrame,
  noteRiderPerfScene,
  readRiderCostWindow,
  readRiderPerfScene,
  readRiderRenderCostSnapshot,
  resetRiderRenderCostProbe,
  setRiderCostDevOverrideForTests,
  summarizeRiderCostSamples,
} from "../src/lib/debug/riderRenderCostProbe.ts";

const originalWindow = (globalThis as { window?: Window }).window;

function useSearch(search: string): void {
  (globalThis as { window?: Window }).window = { location: { search } } as Window;
  resetPerfLabForTests();
}

afterEach(() => {
  setRiderCostDevOverrideForTests(undefined);
  resetPerfLabForTests();
  resetRiderRenderCostProbe();
  if (originalWindow === undefined) delete (globalThis as { window?: Window }).window;
  else (globalThis as { window?: Window }).window = originalWindow;
});

describe("perflab 프레임 통계", () => {
  it("합성 간격의 p50·p95·p99·max·초과 비율·fps", () => {
    const samples: FrameIntervalSample[] = [
      { t: 1000, dtMs: 10 },
      { t: 2000, dtMs: 20 },
      { t: 3000, dtMs: 30 },
      { t: 4000, dtMs: 40 },
      { t: 5000, dtMs: 100 },
    ];
    const stats = summarizeFrameIntervals(samples, 10_000, 10_000);
    assert.equal(stats.samples, 5);
    assert.equal(stats.p50Ms, 30);
    assert.equal(stats.p95Ms, 100);
    assert.equal(stats.p99Ms, 100);
    assert.equal(stats.maxMs, 100);
    assert.equal(stats.over33Ratio, 0.4);
    assert.equal(stats.over50Ratio, 0.2);
    assert.equal(stats.fps, 25);
    assert.equal(percentileNearestRank([10, 20, 30, 40, 100], 50), 30);
  });

  it("창 밖은 빼고, 33 은 >33 이 아니고 50 은 >50 이 아니다", () => {
    const stats = summarizeFrameIntervals(
      [
        { t: 9999, dtMs: 999 },
        { t: 10000, dtMs: 33 },
        { t: 15000, dtMs: 50 },
        { t: 20001, dtMs: 80 },
      ],
      20_000,
      10_000,
    );
    assert.equal(stats.samples, 2);
    assert.equal(stats.p50Ms, 33);
    assert.equal(stats.maxMs, 50);
    assert.equal(stats.over33Ratio, 0.5);
    assert.equal(stats.over50Ratio, 0);
  });

  it("샘플이 없으면 비율을 0 으로 만들지 않는다", () => {
    const stats = summarizeFrameIntervals([], 10_000);
    assert.equal(stats.samples, 0);
    assert.equal(stats.p50Ms, null);
    assert.equal(stats.maxMs, null);
    assert.equal(stats.over33Ratio, null);
    assert.equal(stats.fps, null);
  });
});

describe("perflab 쿼리와 계측 가드", () => {
  it("쿼리 문자열", () => {
    assert.equal(readPerfLabSearch(""), false);
    assert.equal(readPerfLabSearch("?lightlab=1"), false);
    assert.equal(readPerfLabSearch("?perflab=0"), false);
    assert.equal(readPerfLabSearch("?perflab=1"), true);
    assert.equal(readPerfLabSearch("?foo=1&perflab=1"), true);
  });

  it("쿼리가 없으면 isPerfLabEnabled 는 false 이고 한 번 캐시한다", () => {
    useSearch("");
    assert.equal(isPerfLabEnabled(), false);
    useSearch("?perflab=1");
    resetPerfLabForTests();
    (globalThis as { window?: Window }).window = { location: { search: "" } } as Window;
    assert.equal(isPerfLabEnabled(), false);
    (globalThis as { window?: Window }).window = { location: { search: "?perflab=1" } } as Window;
    assert.equal(isPerfLabEnabled(), false);
  });

  it("쿼리가 없으면 운영 경로에서 콜백만 부르고 누적하지 않는다", () => {
    useSearch("");
    setRiderCostDevOverrideForTests(false);
    resetRiderRenderCostProbe();
    const orig = performance.now.bind(performance);
    let calls = 0;
    performance.now = () => {
      calls += 1;
      return orig();
    };
    try {
      const out = measureRiderRenderFrame(4, () => measureRiderPose(() => 123));
      noteRiderPerfScene(20, 4, "ready");
      assert.equal(out, 123);
      assert.equal(calls, 0);
      assert.equal(readRiderCostWindow().frames, 0);
      assert.equal(readRiderPerfScene().riderCount, null);
      performance.now = orig;
      const snap = readRiderRenderCostSnapshot();
      assert.equal(snap.frames, 0);
      assert.equal(snap.riders, 0);
      assert.equal(snap.poseMs, 0);
    } finally {
      performance.now = orig;
    }
  });

  it("DEV 이고 쿼리가 없으면 수명 누적만 하고 10 s 창은 비운다", () => {
    useSearch("");
    resetRiderRenderCostProbe();
    measureRiderRenderFrame(1, () => undefined);
    assert.equal(readRiderRenderCostSnapshot().frames, 1);
    assert.equal(readRiderCostWindow().frames, 0);
    assert.equal(readRiderPerfScene().riderCount, null);
  });

  it("perflab 이면 DEV 가 꺼져 있어도 누적하고 10 s 창에 남긴다", () => {
    useSearch("?perflab=1");
    setRiderCostDevOverrideForTests(false);
    assert.equal(isPerfLabEnabled(), true);
    resetRiderRenderCostProbe();
    const out = measureRiderRenderFrame(
      2,
      () => {
        measureRiderPose(() => undefined);
      },
      20.1,
      "ready",
    );
    assert.equal(out, undefined);
    const snap = readRiderRenderCostSnapshot();
    assert.equal(snap.frames, 1);
    assert.equal(snap.riders, 2);
    assert.ok(snap.poseMs >= 0);
    const windowStats = readRiderCostWindow();
    assert.equal(windowStats.frames, 1);
    assert.equal(windowStats.riderCount, 2);
    const scene = readRiderPerfScene();
    assert.equal(scene.zoom, 20.1);
    assert.equal(scene.lod2State, "ready");
    assert.equal(scene.riderCount, 2);
  });
});

describe("라이더 비용 창", () => {
  it("창 안 샘플만으로 ms/프레임·자세 비율·마지막 인원을 낸다", () => {
    const stats = summarizeRiderCostSamples(
      [
        { t: 1000, riders: 1, ms: 2, poseMs: 1 },
        { t: 2000, riders: 2, ms: 4, poseMs: 1 },
        { t: 30_000, riders: 9, ms: 99, poseMs: 99 },
      ],
      2000,
      10_000,
    );
    assert.equal(stats.frames, 2);
    assert.equal(stats.riders, 3);
    assert.equal(stats.msPerFrame, 3);
    assert.equal(stats.msPerRider, 2);
    assert.ok(stats.posePct != null && Math.abs(stats.posePct - 100 / 3) < 1e-9);
    assert.equal(stats.riderCount, 2);
  });
});
