/**
 * 경로선(`route`)과 내 도로망·라이브 칠하기(Conquest) 레이어 — 만들고, 앞뒤를 세우고,
 * 단계별 강조를 적용한다.
 *
 * 왜 MapView 에서 나왔나 (2026-09-28, 구조 정비 A-4) — 레이어를 추가하고 paint 를 바꾸는
 * 지도 글루다. **동작은 바꾸지 않았다 — 자리만 옮겼다.**
 *
 * ⚠️ **경로선에 흰 테두리(casing)를 두르지 마라.** 한 번 둘렀다가 걷어냈다 — 테두리가
 * 내 도로망보다 굵어 경로선은 살고 **내 도로망이 죽었다**(2026-09-16 Chief).
 * 둘을 동시에 읽히게 하는 일은 색이 아니라 **순서 + 폭 차이**가 맡는다.
 * 계약 `conquest-emphasis-contract` 가 이 파일을 겨눈다.
 */
import { rtwAccumulatedWidthExpression } from "../../lib/map/rtwMapConfig";
import type { ConquestLayerEmphasis } from "../../lib/conquest/conquestLayerEmphasis";

/** 사용자 경로 탐색 결과 폴리라인 (`route` 소스·레이어) */
export const ROUTE_LINE_COLOR = "#ef4444";
/**
 * 경로선 폭. 흰 테두리(casing)를 둘렀다가 걷어냈다 — 테두리가 내 도로망보다 굵어
 * **경로선은 살고 내 도로망이 죽었다**(2026-09-16 Chief). 둘을 동시에 읽히게 하는 일은
 * 색을 덧대는 대신 순서 + 폭 차이가 맡는다(`lib/conquest/conquestLayerEmphasis`).
 */
export const ROUTE_LINE_WIDTH = 4;

/** Conquest — 「내 도로망」(과거 주행 궤적, 경로선 아래) */
export const CONQUEST_TRACES_SRC = "boxcycle-conquest-traces";
export const CONQUEST_TRACES_LAYER = "boxcycle-conquest-traces-line";
/** Conquest — 줌아웃 LOD 집계 광채(누적 궤적 아래, z13 에서 사라짐) */
export const CONQUEST_TRACES_HALO_LAYER = "boxcycle-conquest-traces-halo";
/** Conquest — 이번 주행에서 지금까지 달린 구간(실시간 칠하기) */
export const CONQUEST_LIVE_SRC = "boxcycle-conquest-live";
export const CONQUEST_LIVE_LAYER = "boxcycle-conquest-live-line";
export const CONQUEST_LIVE_GLOW_LAYER = "boxcycle-conquest-live-glow";

/** 경로선 한 겹 — 테두리 없음(위 ROUTE_LINE_WIDTH 주석 참고) */
export function addRouteLine(map: mapboxgl.Map, beforeId: string | undefined): void {
  if (map.getLayer("route")) return;
  map.addLayer(
    {
      id: "route",
      type: "line",
      source: "route",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": ROUTE_LINE_COLOR, "line-width": ROUTE_LINE_WIDTH },
    },
    beforeId,
  );
}

/**
 * 궤적 레이어와 경로선의 위아래를 **단계에 따라** 세운다(판정은 `lib/conquest/conquestLayerEmphasis`).
 *
 * 주행 중에는 궤적이 위다 — 이미 내 것인 도로를 다시 달릴 때 강한 빨강(#ef4444)에
 * 덮이면 어떤 색을 써도 드러나지 않는다.
 * 경로 설정 중에는 반대다 — 7px·0.95 보라가 4px 경로선을 통째로 덮어 버린다.
 *
 * 레이어 추가 순서는 경로 로드 시점에 따라 뒤집히므로 매 적용마다 다시 세운다.
 *
 * 위: route(+casing) < LOD 광채 < 누적(내 도로망) < live glow < live(이번 주행)
 * 아래: LOD 광채 < 누적(내 도로망) < live glow < live < route
 */
const CONQUEST_ORDERED_LAYERS = [
  CONQUEST_TRACES_HALO_LAYER,
  CONQUEST_TRACES_LAYER,
  CONQUEST_LIVE_GLOW_LAYER,
  CONQUEST_LIVE_LAYER,
] as const;

function orderConquestLayers(map: mapboxgl.Map, aboveRoute: boolean): void {
  try {
    const ids = (map.getStyle()?.layers ?? []).map((l) => l.id);
    const routeIdx = ids.indexOf("route");
    if (routeIdx < 0) return;
    if (!aboveRoute) {
      for (const id of CONQUEST_ORDERED_LAYERS) {
        if (map.getLayer(id)) map.moveLayer(id, "route");
      }
      return;
    }
    const ours = new Set<string>(CONQUEST_ORDERED_LAYERS);
    const afterRoute = ids.slice(routeIdx + 1).find((id) => !ours.has(id));
    for (const id of CONQUEST_ORDERED_LAYERS) {
      if (map.getLayer(id)) map.moveLayer(id, afterRoute);
    }
  } catch {
    /* noop */
  }
}

/** 단계 판정을 실제 레이어에 적용 — 순서 + 내 도로망 불투명도 */
export function applyConquestEmphasis(map: mapboxgl.Map, emphasis: ConquestLayerEmphasis): void {
  orderConquestLayers(map, emphasis.tracesAboveRoute);
  try {
    if (map.getLayer(CONQUEST_TRACES_LAYER)) {
      map.setPaintProperty(CONQUEST_TRACES_LAYER, "line-opacity", emphasis.accumulatedOpacity);
      map.setPaintProperty(
        CONQUEST_TRACES_LAYER,
        "line-width",
        rtwAccumulatedWidthExpression(emphasis.accumulatedMinWidthPx ?? undefined),
      );
    }
  } catch {
    /* noop */
  }
}
