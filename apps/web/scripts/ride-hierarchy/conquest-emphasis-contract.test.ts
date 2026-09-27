import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  CONQUEST_ACCUMULATED_MIN_WIDTH_PX,
  CONQUEST_ACCUMULATED_OPACITY,
  CONQUEST_ACCUMULATED_OPACITY_DIMMED,
  conquestLayerEmphasis,
} from "../../src/lib/conquest/conquestLayerEmphasis.ts";
import {
  RTW_TRACE_ACCUMULATED_PAINT,
  rtwAccumulatedWidthExpression,
} from "../../src/lib/map/rtwMapConfig.ts";

/** 경로선은 줌과 무관하게 4px 고정(MapView `ROUTE_LINE_WIDTH`) */
const ROUTE_LINE_WIDTH = 4;

/** 줌별 내 도로망 폭 — `rtwAccumulatedWidthExpression` 의 stop 을 그대로 읽어 보간 */
function widthAtZoom(expr: unknown, zoom: number): number {
  const a = expr as unknown[];
  if (a[0] === "max") return Math.max(widthAtZoom(a[1], zoom), a[2] as number);
  const stops: [number, number][] = [];
  for (let i = 3; i + 1 < a.length; i += 2) stops.push([a[i] as number, a[i + 1] as number]);
  if (zoom <= stops[0]![0]) return stops[0]![1];
  const last = stops[stops.length - 1]!;
  if (zoom >= last[0]) return last[1];
  for (let i = 0; i + 1 < stops.length; i += 1) {
    const [z0, w0] = stops[i]!;
    const [z1, w1] = stops[i + 1]!;
    if (zoom >= z0 && zoom <= z1) return w0 + ((w1 - w0) * (zoom - z0)) / (z1 - z0);
  }
  return last[1];
}

/**
 * 내 도로망 ↔ 경로선 강조 (2026-09-16 Chief).
 *
 * 두 요구가 정면으로 충돌한다 — 주행 중엔 궤적이, 설정 중엔 경로선이 주인공이다.
 * 하나의 순서로 덮으려다 한쪽이 죽었던 이력이 있어(궤적을 위로 올린 09월 초 결정),
 * **양쪽 방향**을 다 못 박는다.
 */
describe("conquestLayerEmphasis — 단계별 주인공", () => {
  it("주행 중에는 궤적이 위 · 불투명도·폭 그대로", () => {
    for (const hasRoute of [true, false]) {
      const e = conquestLayerEmphasis({ rideActive: true, hasRoute });
      assert.equal(e.tracesAboveRoute, true, `hasRoute=${hasRoute}`);
      assert.equal(e.accumulatedOpacity, CONQUEST_ACCUMULATED_OPACITY);
      assert.equal(e.accumulatedMinWidthPx, null, "위에 있으면 폭을 건드릴 이유가 없다");
    }
  });

  it("경로 설정·확인 중에는 경로선이 위 · 내 도로망은 배경으로", () => {
    const e = conquestLayerEmphasis({ rideActive: false, hasRoute: true });
    assert.equal(e.tracesAboveRoute, false);
    assert.equal(e.accumulatedOpacity, CONQUEST_ACCUMULATED_OPACITY_DIMMED);
    assert.ok(
      CONQUEST_ACCUMULATED_OPACITY_DIMMED < CONQUEST_ACCUMULATED_OPACITY,
      "배경으로 내린다 = 더 옅다",
    );
    assert.ok(CONQUEST_ACCUMULATED_OPACITY_DIMMED > 0, "지우는 게 아니라 내리는 것");
    assert.equal(e.accumulatedMinWidthPx, CONQUEST_ACCUMULATED_MIN_WIDTH_PX);
  });

  it("★ 경로선 아래에서도 내 도로망이 **모든 줌에서** 양옆에 남는다", () => {
    /*
     * 이 작업의 핵심. 경로선은 4px 고정인데 내 도로망은 z12 에서 4px, z8 에서 2.8px 다 —
     * 하한이 없으면 낮은 줌에서 경로선이 더 굵어 내 도로망이 통째로 사라진다.
     * 흰 테두리로 분리하려던 1차 시도가 정확히 이 실패(테두리가 내 도로망을 덮음)였다.
     */
    const e = conquestLayerEmphasis({ rideActive: false, hasRoute: true });
    const expr = rtwAccumulatedWidthExpression(e.accumulatedMinWidthPx ?? undefined);
    for (const zoom of [4, 8, 10, 12, 14, 16, 18]) {
      const band = (widthAtZoom(expr, zoom) - ROUTE_LINE_WIDTH) / 2;
      assert.ok(band >= 1.5, `z${zoom}: 양옆 띠 ${band.toFixed(2)}px — 1.5px 이상이어야 한다`);
    }
  });

  it("기본 폭(주행 중)은 종전 그대로 — 하한을 안 주면 손대지 않는다", () => {
    const base = rtwAccumulatedWidthExpression();
    assert.equal(widthAtZoom(base, 16), 7);
    assert.equal(widthAtZoom(base, 12), 4);
    assert.equal(widthAtZoom(base, 8), 2.8);
  });

  it("경로가 없는 화면에서는 낮추지 않는다 — 가릴 경로선이 없다", () => {
    const e = conquestLayerEmphasis({ rideActive: false, hasRoute: false });
    assert.equal(e.tracesAboveRoute, true);
    assert.equal(e.accumulatedOpacity, CONQUEST_ACCUMULATED_OPACITY);
    assert.equal(e.accumulatedMinWidthPx, null);
  });

  it("기본 불투명도가 실제 paint 와 같다 — 두 곳이 갈라지면 단계 전환에서 값이 튄다", () => {
    assert.equal(RTW_TRACE_ACCUMULATED_PAINT["line-opacity"], CONQUEST_ACCUMULATED_OPACITY);
  });
});

describe("경로선 테두리 · 적용 배선", () => {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const mapView = fs.readFileSync(
    path.resolve(__dirname, "../../src/components/map/MapView.tsx"),
    "utf8",
  );

  it("경로선에 흰 테두리를 두르지 않는다 — 테두리가 내 도로망을 덮었다", () => {
    assert.doesNotMatch(mapView, /route-casing/, "테두리 레이어가 부활하면 안 된다");
    assert.doesNotMatch(mapView, /ROUTE_CASING/, "테두리 상수가 부활하면 안 된다");
    assert.match(mapView, /const ROUTE_LINE_WIDTH = 4;/, "계약이 아는 경로선 폭");
  });

  it("내 도로망 폭은 한 곳에서만 만든다 — stop 이 흩어지면 갈라진다", () => {
    assert.match(mapView, /rtwAccumulatedWidthExpression\(/);
    assert.doesNotMatch(
      mapView,
      /"line-width": \["interpolate", \["linear"\], \["zoom"\], 4, 2\.6/,
      "누적 궤적 폭을 MapView 에서 직접 적지 않는다",
    );
  });

  it("순서·불투명도가 판정 한 곳을 거친다 — 호출처마다 다르게 세우지 않는다", () => {
    // import 줄바꿈 모양에 의존하지 않는다 — 배선 여부만 본다
    assert.match(mapView, /from "\.\.\/\.\.\/lib\/conquest\/conquestLayerEmphasis"/);
    assert.match(mapView, /conquestLayerEmphasis\(\{/);
    assert.match(mapView, /function applyConquestEmphasis\(/);
    assert.doesNotMatch(mapView, /orderConquestLayersAboveRoute/, "옛 단방향 함수가 남으면 안 된다");
    // 궤적을 세우는 곳은 전부 applyConquestEmphasis 를 거친다
    const orderCalls = mapView.match(/orderConquestLayers\(/g) ?? [];
    assert.equal(orderCalls.length, 2, "선언 1 + applyConquestEmphasis 안 1 뿐이어야 한다");
  });
});
