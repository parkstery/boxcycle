import type { LinePaint, Map as MapboxMap } from "mapbox-gl";

/**
 * RTW Mapbox 다크 스타일 설정 — 2026-07 리디자인 핸드오프.
 * 지도가 배경이 아니라 주인공: 다크 베이스 + POI/건물 숨김 + 도로 낮은 존재감.
 * Trace(궤적) 골드는 tokens.css --rtw-trace(#E8A33D)와 동일 값.
 */

export const RTW_MAP_STYLE_URL = "mapbox://styles/mapbox/dark-v11";

/**
 * 숨길 레이어 키워드 — style.load 이후 순회하며 visibility: none.
 * settlement-label(도시·지역명)은 핸드오프 원안과 달리 유지 — Trail 지역명과
 * "세계를 달린다" 방향감의 핵심 정보라 숨기지 않는다.
 */
export const RTW_HIDDEN_LAYER_KEYWORDS = [
  "poi-label",
  "building",
  "building-3d",
  "airport-label",
  "transit-label",
];

/** 도로 레이어 낮은 존재감 — --rtw-map-road-ghost */
export const RTW_ROAD_PAINT = {
  "line-color": "rgba(28, 37, 48, 0.6)",
  "line-opacity": 0.35,
} as const;

/** Trace 시그니처 골드 — tokens.css --rtw-trace */
export const RTW_TRACE_COLOR = "#E8A33D";

/** 이번 주행 실시간 궤적 — 풀 골드 */
export const RTW_TRACE_LIVE_PAINT: LinePaint = {
  "line-color": RTW_TRACE_COLOR,
  "line-opacity": 1,
  "line-width": ["interpolate", ["linear"], ["zoom"], 8, 3.2, 12, 5, 16, 8],
};

/**
 * 실시간 궤적 glow — Mapbox 는 CSS drop-shadow 미지원이라 같은 라인을
 * 더 굵고 흐리게 한 겹 아래 깔아 발광을 흉내낸다. 본선보다 먼저(아래) 추가할 것.
 */
export const RTW_TRACE_LIVE_GLOW_PAINT: LinePaint = {
  "line-color": RTW_TRACE_COLOR,
  "line-width": ["interpolate", ["linear"], ["zoom"], 8, 9, 12, 14, 16, 22],
  "line-blur": 8,
  "line-opacity": 0.35,
};

/** 누적된 세계(과거 주행 궤적) — 골드 40%, glow 없음 */
export const RTW_TRACE_ACCUMULATED_PAINT: LinePaint = {
  "line-color": RTW_TRACE_COLOR,
  "line-opacity": 0.4,
  "line-width": ["interpolate", ["linear"], ["zoom"], 8, 1.6, 12, 3, 16, 6],
};

/**
 * style.load 시 호출 — RTW 다크 스타일에서만. 숨길 레이어 visibility 끄기,
 * 도로 레이어 존재감 낮추기.
 */
export function applyRtwLayerStyle(map: MapboxMap): void {
  const layers = map.getStyle()?.layers ?? [];

  for (const layer of layers) {
    const shouldHide = RTW_HIDDEN_LAYER_KEYWORDS.some((keyword) =>
      layer.id.includes(keyword),
    );
    if (shouldHide) {
      try {
        map.setLayoutProperty(layer.id, "visibility", "none");
      } catch {
        /* noop */
      }
    }

    if (layer.id.includes("road") && layer.type === "line") {
      try {
        map.setPaintProperty(layer.id, "line-opacity", RTW_ROAD_PAINT["line-opacity"]);
        map.setPaintProperty(layer.id, "line-color", RTW_ROAD_PAINT["line-color"]);
      } catch {
        /* 일부 도로 레이어는 paint 프로퍼티가 다르게 정의될 수 있음 */
      }
    }
  }
}
