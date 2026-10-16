import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  acceptLoafEntry,
  attachMapRenderProbe,
  composeFrameBudget,
  loafStyleAndLayoutMs,
  mapExcludingRiderMs,
  noteReactProfilerCommit,
  openFrameBreakdownTick,
  readFrameBreakdown,
  resetFrameBreakdownForTests,
  startFrameBreakdownObservers,
  stopFrameBreakdownObservers,
  summarizeDurations,
  topByMs,
} from "../src/lib/debug/frameBreakdownProbe.ts";
import { isPerfLabEnabled, resetPerfLabForTests } from "../src/lib/debug/perfLab.ts";
import {
  measureRiderRenderFrame,
  readRiderRenderMsOverlapping,
  resetRiderRenderCostProbe,
  setRiderCostDevOverrideForTests,
} from "../src/lib/debug/riderRenderCostProbe.ts";

const originalWindow = (globalThis as { window?: Window }).window;
const OriginalObserver = globalThis.PerformanceObserver;

function useSearch(search: string): void {
  (globalThis as { window?: Window }).window = { location: { search } } as Window;
  resetPerfLabForTests();
  resetFrameBreakdownForTests();
  resetRiderRenderCostProbe();
}

afterEach(() => {
  setRiderCostDevOverrideForTests(undefined);
  resetFrameBreakdownForTests();
  resetPerfLabForTests();
  resetRiderRenderCostProbe();
  globalThis.PerformanceObserver = OriginalObserver;
  if (originalWindow === undefined) delete (globalThis as { window?: Window }).window;
  else (globalThis as { window?: Window }).window = originalWindow;
});

describe("프레임 분해 집계", () => {
  it("평균과 p95", () => {
    const stats = summarizeDurations([10, 20, 30, 40, 100, Number.NaN, -1]);
    assert.equal(stats.samples, 5);
    assert.equal(stats.meanMs, 40);
    assert.equal(stats.p95Ms, 100);
    assert.deepEqual(summarizeDurations([]), { samples: 0, meanMs: null, p95Ms: null });
  });

  it("상위 N 은 합이 큰 출처만 남긴다", () => {
    const top = topByMs(
      [
        { key: "a", ms: 5 },
        { key: "b", ms: 1 },
        { key: "a", ms: 5 },
        { key: "c", ms: 4 },
        { key: "d", ms: 3 },
        { key: "e", ms: 2 },
        { key: "f", ms: 9 },
      ],
      5,
    );
    assert.deepEqual(
      top.map((row) => row.source),
      ["a", "f", "c", "d", "e"],
    );
    assert.equal(top[0]!.ms, 10);
    assert.equal(topByMs([{ key: "a", ms: 1 }], 0).length, 0);
  });

  it("styleAndLayoutDuration 가 있으면 그 값을 쓰고, 없으면 스크립트 강제 배치를 합친다", () => {
    assert.deepEqual(
      loafStyleAndLayoutMs({
        startTime: 0,
        duration: 40,
        styleAndLayoutDuration: 7,
        scripts: [{ forcedStyleAndLayoutDuration: 3 }],
      }),
      { ms: 7, source: "property" },
    );
    assert.deepEqual(
      loafStyleAndLayoutMs({
        startTime: 0,
        duration: 40,
        scripts: [{ forcedStyleAndLayoutDuration: 1 }, { forcedStyleAndLayoutDuration: 2 }],
      }),
      { ms: 3, source: "forced" },
    );
    assert.deepEqual(
      loafStyleAndLayoutMs({ startTime: 100, duration: 40, styleAndLayoutStart: 120 }),
      { ms: 20, source: "derived" },
    );
    assert.deepEqual(loafStyleAndLayoutMs({ startTime: 100, duration: 40, styleAndLayoutStart: 180 }), {
      ms: 0,
      source: "none",
    });
  });

  it("지도 시간에서 라이더 레이어를 뺀다", () => {
    assert.equal(mapExcludingRiderMs(12, 3), 9);
    assert.equal(mapExcludingRiderMs(2, 5), 0);
    assert.equal(mapExcludingRiderMs(4, -1), 4);
  });

  it("프레임 간격은 JS 합과 대기로 나눈다", () => {
    const idle = composeFrameBudget({
      frameMeanMs: 40,
      frameSamples: 10,
      tickMeanMs: 5,
      mapMeanMs: 10,
      reactSumMs: 0,
      loafBlockingMs: 0,
    });
    assert.equal(idle.jsMs, 15);
    assert.equal(idle.otherLoafMs, 0);
    assert.equal(idle.waitMs, 25);

    const nested = composeFrameBudget({
      frameMeanMs: 30,
      frameSamples: 10,
      tickMeanMs: 8,
      mapMeanMs: 12,
      reactSumMs: 100,
      loafBlockingMs: 50,
    });
    assert.equal(nested.reactMs, 10);
    assert.equal(nested.otherLoafMs, 0);
    assert.equal(nested.jsMs, 30);
    assert.equal(nested.waitMs, 0);
  });
});

describe("프레임 분해 훅", () => {
  it("쿼리가 없으면 모든 훅이 즉시 반환하고 performance.now 를 부르지 않는다", () => {
    useSearch("");
    assert.equal(isPerfLabEnabled(), false);
    const orig = performance.now.bind(performance);
    let calls = 0;
    performance.now = () => {
      calls += 1;
      return orig();
    };
    const Observer = function Observer() {
      throw new Error("observer");
    } as unknown as typeof PerformanceObserver;
    globalThis.PerformanceObserver = Observer;
    const render = () => undefined;
    const map = {
      _render: render,
      on() {
        throw new Error("on");
      },
      off() {
        throw new Error("off");
      },
    };
    try {
      assert.equal(openFrameBreakdownTick(), null);
      const detach = attachMapRenderProbe(map);
      detach();
      assert.equal(map._render, render);
      map._render();
      noteReactProfilerCommit(4, 10);
      acceptLoafEntry({
        startTime: 1,
        blockingDuration: 9,
        scripts: [{ sourceURL: "https://example/a.js", sourceFunctionName: "tick", duration: 9 }],
      });
      startFrameBreakdownObservers();
      stopFrameBreakdownObservers();
      assert.equal(readRiderRenderMsOverlapping(0), 0);
      const breakdown = readFrameBreakdown();
      assert.equal(calls, 0);
      assert.equal(breakdown.tick.samples, 0);
      assert.equal(breakdown.map.method, "unattached");
      assert.equal(breakdown.map.samples, 0);
      assert.equal(breakdown.react.commits, 0);
      assert.equal(breakdown.loaf.count, 0);
      assert.equal(breakdown.gpu.reason, "unprobed");
    } finally {
      performance.now = orig;
    }
  });

  it("틱 구간의 평균과 p95 를 10 s 창에 남긴다", () => {
    useSearch("?perflab=1");
    let t = 0;
    const orig = performance.now.bind(performance);
    performance.now = () => {
      t += 10;
      return t;
    };
    try {
      const first = openFrameBreakdownTick();
      assert.ok(first);
      first.mark("self");
      first.mark("camera");
      first.end();
      first.end();
      const second = openFrameBreakdownTick();
      assert.ok(second);
      second.mark("self");
      second.mark("self");
      second.end();
      const breakdown = readFrameBreakdown(10_000);
      assert.equal(breakdown.tick.samples, 2);
      assert.equal(breakdown.tick.meanMs, 30);
      assert.equal(breakdown.tick.p95Ms, 30);
      assert.equal(breakdown.tick.phases.self.meanMs, 15);
      assert.equal(breakdown.tick.phases.self.p95Ms, 20);
      assert.equal(breakdown.tick.phases.camera.meanMs, 5);
      assert.equal(breakdown.tick.phases.camera.p95Ms, 10);
      assert.equal(breakdown.tick.other.meanMs, 10);
    } finally {
      performance.now = orig;
    }
  });

  it("map._render 를 감싸고, 실패하면 이벤트만 남긴다", () => {
    useSearch("?perflab=1");
    const stamps = [100, 130, 130];
    let index = 0;
    const orig = performance.now.bind(performance);
    performance.now = () => stamps[Math.min(index++, stamps.length - 1)] ?? 0;
    let ran = 0;
    const map = {
      _render() {
        ran += 1;
      },
      on() {},
      off() {},
    };
    try {
      const detach = attachMapRenderProbe(map);
      map._render(1);
      const wrapped = readFrameBreakdown(10_000);
      assert.equal(ran, 1);
      assert.equal(wrapped.map.method, "map._render");
      assert.equal(wrapped.map.meanMs, 30);
      assert.equal(wrapped.map.exRiderMeanMs, 30);
      detach();
      map._render(2);
      assert.equal(ran, 2);
      assert.equal(readFrameBreakdown(10_000).map.samples, 1);

      resetFrameBreakdownForTests();
      const seen: string[] = [];
      const frozen = {
        get _render() {
          return () => undefined;
        },
        set _render(_value: unknown) {
          throw new Error("frozen");
        },
        on(type: string) {
          seen.push(type);
        },
        off() {},
      };
      attachMapRenderProbe(frozen);
      const eventsOnly = readFrameBreakdown(10_000);
      assert.equal(eventsOnly.map.method, "events-only");
      assert.equal(eventsOnly.map.samples, 0);
      assert.deepEqual(seen, ["render", "idle"]);
    } finally {
      performance.now = orig;
    }
  });

  it("같은 지도 프레임의 라이더 레이어 시간을 뺀다", () => {
    useSearch("?perflab=1");
    setRiderCostDevOverrideForTests(false);
    let t = 1000;
    const orig = performance.now.bind(performance);
    performance.now = () => t;
    const map = {
      _render() {
        t = 1010;
        measureRiderRenderFrame(1, () => {
          t = 1014;
        });
        t = 1030;
      },
      on() {},
      off() {},
    };
    try {
      resetRiderRenderCostProbe();
      attachMapRenderProbe(map);
      t = 1000;
      map._render(1);
      const breakdown = readFrameBreakdown(10_000);
      assert.equal(breakdown.map.meanMs, 30);
      assert.equal(breakdown.map.riderMeanMs, 4);
      assert.equal(breakdown.map.exRiderMeanMs, 26);
    } finally {
      performance.now = orig;
    }
  });

  it("React 커밋과 LoAF 스크립트 상위 5", () => {
    useSearch("?perflab=1");
    noteReactProfilerCommit(4, 1000);
    noteReactProfilerCommit(6, 2000);
    acceptLoafEntry({
      startTime: 1500,
      blockingDuration: 20,
      styleAndLayoutDuration: 3,
      scripts: [
        { sourceURL: "https://x/a.js", sourceFunctionName: "tick", duration: 8 },
        { sourceURL: "https://x/b.js?token=1", sourceFunctionName: "render", duration: 5 },
        { sourceURL: "https://x/c.js", duration: 4 },
        { sourceURL: "https://x/d.js", duration: 3 },
        { sourceURL: "https://x/e.js", duration: 2 },
        { sourceURL: "https://x/f.js", duration: 1 },
      ],
    });
    const breakdown = readFrameBreakdown(10_000);
    assert.equal(breakdown.react.commits, 2);
    assert.equal(breakdown.react.commitSumMs, 10);
    assert.equal(breakdown.react.commitsPerSec, 0.2);
    assert.equal(breakdown.loaf.supported, false);
    assert.equal(breakdown.loaf.count, 1);
    assert.equal(breakdown.loaf.blockingMs, 20);
    assert.equal(breakdown.loaf.styleAndLayoutMs, 3);
    assert.equal(breakdown.loaf.styleAndLayoutSource, "property");
    assert.deepEqual(
      breakdown.loaf.topScripts.map((row) => row.source),
      ["tick @ a.js", "render @ b.js", "c.js", "d.js", "e.js"],
    );
  });
});
