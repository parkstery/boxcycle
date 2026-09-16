import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  CONQUEST_ACCUMULATED_OPACITY,
  CONQUEST_ACCUMULATED_OPACITY_DIMMED,
  conquestLayerEmphasis,
} from "../../src/lib/conquestLayerEmphasis.ts";
import { RTW_TRACE_ACCUMULATED_PAINT } from "../../src/lib/rtwMapConfig.ts";

/**
 * 내 도로망 ↔ 경로선 강조 (2026-09-16 Chief).
 *
 * 두 요구가 정면으로 충돌한다 — 주행 중엔 궤적이, 설정 중엔 경로선이 주인공이다.
 * 하나의 순서로 덮으려다 한쪽이 죽었던 이력이 있어(궤적을 위로 올린 09월 초 결정),
 * **양쪽 방향**을 다 못 박는다.
 */
describe("conquestLayerEmphasis — 단계별 주인공", () => {
  it("주행 중에는 궤적이 위 · 불투명도 그대로", () => {
    for (const hasRoute of [true, false]) {
      const e = conquestLayerEmphasis({ rideActive: true, hasRoute });
      assert.equal(e.tracesAboveRoute, true, `hasRoute=${hasRoute}`);
      assert.equal(e.accumulatedOpacity, CONQUEST_ACCUMULATED_OPACITY);
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
  });

  it("경로가 없는 화면에서는 낮추지 않는다 — 가릴 경로선이 없다", () => {
    const e = conquestLayerEmphasis({ rideActive: false, hasRoute: false });
    assert.equal(e.tracesAboveRoute, true);
    assert.equal(e.accumulatedOpacity, CONQUEST_ACCUMULATED_OPACITY);
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

  it("경로선이 내 도로망보다 굵은 테두리를 갖는다 — 어떤 배경에서도 분리돼 읽힌다", () => {
    assert.match(mapView, /ROUTE_CASING_WIDTH = ROUTE_LINE_WIDTH \+ /, "테두리는 본선보다 굵다");
    assert.match(mapView, /ROUTE_CASING_LAYER = "route-casing"/);
    // 본선·테두리는 한 쌍으로만 올린다
    assert.match(mapView, /function addRouteLineWithCasing\(/);
    assert.doesNotMatch(
      mapView,
      /id: "route",\n\s+type: "line",\n\s+source: "route",\n\s+paint: \{ "line-color": ROUTE_LINE_COLOR, "line-width": 4 \}/,
      "테두리 없이 경로선만 올리는 옛 경로가 남으면 안 된다",
    );
  });

  it("테두리는 소스를 공유하므로 경로를 지울 때 함께 지운다", () => {
    const teardown = mapView.slice(mapView.indexOf('if (map.getLayer("route")) map.removeLayer("route");'));
    assert.match(
      teardown.slice(0, 400),
      /removeLayer\(ROUTE_CASING_LAYER\)[\s\S]*?removeSource\("route"\)/,
      "테두리를 남긴 채 소스를 지우면 안 된다",
    );
  });

  it("순서·불투명도가 판정 한 곳을 거친다 — 호출처마다 다르게 세우지 않는다", () => {
    assert.match(mapView, /import \{ conquestLayerEmphasis \}/);
    assert.match(mapView, /function applyConquestEmphasis\(/);
    assert.doesNotMatch(mapView, /orderConquestLayersAboveRoute/, "옛 단방향 함수가 남으면 안 된다");
    // 궤적을 세우는 곳은 전부 applyConquestEmphasis 를 거친다
    const orderCalls = mapView.match(/orderConquestLayers\(/g) ?? [];
    assert.equal(orderCalls.length, 2, "선언 1 + applyConquestEmphasis 안 1 뿐이어야 한다");
  });
});
