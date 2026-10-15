import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { MAPBOX_TOKEN } from "../../src/app/env";
import {
  getRiderPreservedDebugState,
  syncRiderPreservedModels,
} from "../../src/lib/map/riderPreservedLayer";
import type { RiderGlbModelSpec } from "../../src/lib/riderPrototype/iso2dMarker";
import {
  PRESERVED_RIDER_MODELS,
  resolvePreservedRiderModel,
} from "../../src/lib/riderPrototype/config";

/* 드로우콜 계수 — 지도 생성 전에 WebGL2 프로토타입을 감싼다. */
const TRIANGLES = 0x0004;
let benchDrawCalls = 0;
let benchTriangles = 0;

type DrawElementsFn = (
  this: WebGL2RenderingContext,
  mode: number,
  count: number,
  type: number,
  offset: number,
) => void;
type DrawArraysFn = (
  this: WebGL2RenderingContext,
  mode: number,
  first: number,
  count: number,
) => void;
type DrawElementsInstancedFn = (
  this: WebGL2RenderingContext,
  mode: number,
  count: number,
  type: number,
  offset: number,
  instanceCount: number,
) => void;
type DrawArraysInstancedFn = (
  this: WebGL2RenderingContext,
  mode: number,
  first: number,
  count: number,
  instanceCount: number,
) => void;
type DrawRangeElementsFn = (
  this: WebGL2RenderingContext,
  mode: number,
  start: number,
  end: number,
  count: number,
  type: number,
  offset: number,
) => void;

function addBenchDraw(mode: number, count: number, instances: number): void {
  if (mode !== TRIANGLES) return;
  benchDrawCalls += 1;
  benchTriangles += Math.floor(count / 3) * instances;
}

{
  const proto = WebGL2RenderingContext.prototype;
  const origDrawElements = proto.drawElements as DrawElementsFn;
  const origDrawArrays = proto.drawArrays as DrawArraysFn;
  const origDrawElementsInstanced = proto.drawElementsInstanced as DrawElementsInstancedFn;
  const origDrawArraysInstanced = proto.drawArraysInstanced as DrawArraysInstancedFn;
  const origDrawRangeElements = (
    proto as unknown as { drawRangeElements?: DrawRangeElementsFn }
  ).drawRangeElements;
  proto.drawElements = function (this: WebGL2RenderingContext, mode, count, type, offset) {
    addBenchDraw(mode, count, 1);
    origDrawElements.call(this, mode, count, type, offset);
  } as typeof proto.drawElements;
  proto.drawArrays = function (this: WebGL2RenderingContext, mode, first, count) {
    addBenchDraw(mode, count, 1);
    origDrawArrays.call(this, mode, first, count);
  } as typeof proto.drawArrays;
  proto.drawElementsInstanced = function (
    this: WebGL2RenderingContext,
    mode,
    count,
    type,
    offset,
    instanceCount,
  ) {
    addBenchDraw(mode, count, instanceCount);
    origDrawElementsInstanced.call(this, mode, count, type, offset, instanceCount);
  } as typeof proto.drawElementsInstanced;
  proto.drawArraysInstanced = function (
    this: WebGL2RenderingContext,
    mode,
    first,
    count,
    instanceCount,
  ) {
    addBenchDraw(mode, count, instanceCount);
    origDrawArraysInstanced.call(this, mode, first, count, instanceCount);
  } as typeof proto.drawArraysInstanced;
  if (origDrawRangeElements) {
    (
      proto as unknown as { drawRangeElements: DrawRangeElementsFn }
    ).drawRangeElements = function (
      this: WebGL2RenderingContext,
      mode,
      start,
      end,
      count,
      type,
      offset,
    ) {
      addBenchDraw(mode, count, 1);
      origDrawRangeElements.call(this, mode, start, end, count, type, offset);
    };
  }
}

function queryNumber(key: string, fallback: number): number {
  const raw = new URLSearchParams(location.search).get(key);
  if (raw == null || raw.trim() === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

const CENTER: [number, number] = [127.035, 37.505];
/* 37.505° 기준: 위도 1° ≈ 111320 m, 경도 1° ≈ 111320·cos(37.505°) ≈ 88344 m */
const DLNG_PER_M = 1 / (111320 * Math.cos((37.505 * Math.PI) / 180));
const DLAT_PER_M = 1 / 111320;

const zoom = queryNumber("zoom", 22);
const pitch = queryNumber("pitch", 67);
const bearing = queryNumber("bearing", -32);
let riderCount = Math.max(0, Math.min(3, Math.round(queryNumber("riders", 3))));
const animate = queryNumber("animate", 1) !== 0;

mapboxgl.accessToken = MAPBOX_TOKEN;
const map = new mapboxgl.Map({
  container: "map",
  style: "mapbox://styles/mapbox/outdoors-v12",
  center: CENTER,
  zoom,
  pitch,
  bearing,
  antialias: true,
});
map.addControl(new mapboxgl.NavigationControl(), "bottom-right");

/** `phase` 쿼리(도) — animate=0 캡처의 고정 크랭크 위상. 기본 45°. */
const fixedPhase = ((queryNumber("phase", 45) % 360) + 360) % 360 / 360;
let phaseRev = fixedPhase;
let firstReadyMs: number | null = null;
let lastLoadState = "idle";
let lastMeasureText = "-";

const status = document.querySelector<HTMLElement>("#status")!;
const ridersEl = document.querySelector<HTMLElement>("#riders")!;
const phaseEl = document.querySelector<HTMLElement>("#phase")!;
const measureEl = document.querySelector<HTMLElement>("#measure")!;

function buildSpecs(n: number, p: number): RiderGlbModelSpec[] {
  const all: RiderGlbModelSpec[] = [
    { id: "self", kind: "self", lngLat: CENTER, bearingDeg: 90, phaseRev: p },
    {
      id: "peer",
      kind: "peer",
      lngLat: [CENTER[0] - 3 * DLNG_PER_M, CENTER[1] - 1.2 * DLAT_PER_M],
      bearingDeg: 90,
      phaseRev: (p + 0.33) % 1,
    },
    {
      id: "pacer",
      kind: "pacer",
      lngLat: [CENTER[0] - 6 * DLNG_PER_M, CENTER[1]],
      bearingDeg: 90,
      phaseRev: (p + 0.66) % 1,
    },
  ];
  return all.slice(0, Math.max(0, Math.min(3, n)));
}

function refreshPanel(): void {
  const model = PRESERVED_RIDER_MODELS[resolvePreservedRiderModel()];
  const candidateEl = document.querySelector("#panel code");
  if (candidateEl) candidateEl.textContent = `${model.nickname} · ${model.candidateId}`;
  status.dataset.state = lastLoadState;
  status.textContent =
    lastLoadState === "ready"
      ? `READY — riders=${riderCount} animate=${animate ? 1 : 0}`
      : lastLoadState === "error"
        ? "ERROR — 라이더 자산 로드 실패"
        : "로드 중…";
  ridersEl.textContent = String(riderCount);
  phaseEl.textContent = `${Math.round(phaseRev * 360)}°`;
  measureEl.textContent = `measure: ${lastMeasureText}`;
}

let last = performance.now();
function tick(now: number): void {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (animate) {
    phaseRev = (phaseRev + (dt * 75) / 60) % 1;
    map.triggerRepaint();
  }
  syncRiderPreservedModels(map, buildSpecs(riderCount, animate ? phaseRev : fixedPhase));
  const debug = getRiderPreservedDebugState(map);
  if (debug) {
    lastLoadState = debug.loadState;
    if (debug.loadState === "error") lastLoadState = "error";
    if (debug.loadState === "ready" && firstReadyMs == null) {
      firstReadyMs = performance.now();
    }
  }
  refreshPanel();
  requestAnimationFrame(tick);
}

map.on("style.load", () => {
  syncRiderPreservedModels(map, buildSpecs(riderCount, animate ? phaseRev : fixedPhase));
});
map.on("load", () => requestAnimationFrame(tick));

function waitMapIdle(): Promise<void> {
  return new Promise((resolve) => {
    try {
      if (map.loaded()) {
        resolve();
        return;
      }
    } catch {
      resolve();
      return;
    }
    const timer = window.setTimeout(resolve, 8000);
    map.once("idle", () => {
      window.clearTimeout(timer);
      resolve();
    });
  });
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

declare global {
  interface Window {
    __rtwBench?: {
      state: () => { loadState: string; firstReadyMs: number | null };
      measure: (frames?: number) => Promise<{
        frames: number;
        drawCallsPerFrame: number;
        trianglesPerFrame: number;
      }>;
      setRiders: (n: number) => void;
      assets: () => Array<{
        name: string;
        transferSize: number;
        encodedBodySize: number;
        decodedBodySize: number;
        duration: number;
      }>;
    };
  }
}

window.__rtwBench = {
  state: () => ({ loadState: lastLoadState, firstReadyMs }),
  measure: async (frames = 120) => {
    await waitMapIdle();
    benchDrawCalls = 0;
    benchTriangles = 0;
    const wanted = Math.max(1, Math.round(frames));
    await new Promise<void>((resolve) => {
      let n = 0;
      const step = (): void => {
        n += 1;
        if (n >= wanted) resolve();
        else requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
    const result = {
      frames: wanted,
      drawCallsPerFrame: round1(benchDrawCalls / wanted),
      trianglesPerFrame: round1(benchTriangles / wanted),
    };
    lastMeasureText = `${result.frames}f dc/f=${result.drawCallsPerFrame} tri/f=${result.trianglesPerFrame}`;
    refreshPanel();
    return result;
  },
  setRiders: (n: number) => {
    riderCount = Math.max(0, Math.min(3, Math.round(n)));
    syncRiderPreservedModels(map, buildSpecs(riderCount, animate ? phaseRev : fixedPhase));
    map.triggerRepaint();
    refreshPanel();
  },
  assets: () =>
    performance
      .getEntriesByType("resource")
      .filter((e) => e.name.includes("/rider/"))
      .map((e) => {
        const r = e as PerformanceResourceTiming;
        return {
          name: r.name,
          transferSize: r.transferSize,
          encodedBodySize: r.encodedBodySize,
          decodedBodySize: r.decodedBodySize,
          duration: Math.round(r.duration * 10) / 10,
        };
      }),
};

refreshPanel();

/*
 * `autoMeasure=1` — 개발자 콘솔이 없는 스마트폰 실기기 측정용(G5).
 * 로드 후 지도 idle 을 기다려 같은 조건(라이더 3명, 240프레임)으로 재고, 결과를 패널에 남긴다.
 */
if (queryNumber("autoMeasure", 0) === 1) {
  const runAutoMeasure = async (): Promise<void> => {
    while (lastLoadState !== "ready") await new Promise((r) => setTimeout(r, 200));
    await waitMapIdle();
    await new Promise((r) => setTimeout(r, 2000));
    const bench = window.__rtwBench!;
    bench.setRiders(3);
    const m3 = await bench.measure(120);
    bench.setRiders(0);
    const m0 = await bench.measure(120);
    bench.setRiders(3);
    window.__rtwRiderCost?.reset();
    await bench.measure(240);
    const cost = window.__rtwRiderCost?.read();
    const perRider = (m3.drawCallsPerFrame - m0.drawCallsPerFrame) / 3;
    lastMeasureText =
      `AUTO z${zoom}: ${perRider.toFixed(1)} dc/rider · ` +
      `${cost?.msPerRider?.toFixed(2) ?? "?"} ms/rider · ` +
      `${cost?.msPerFrame?.toFixed(2) ?? "?"} ms/frame · ` +
      `ready ${firstReadyMs == null ? "?" : Math.round(firstReadyMs)} ms`;
    refreshPanel();
  };
  void runAutoMeasure();
}
