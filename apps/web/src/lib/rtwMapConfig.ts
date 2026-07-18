import type { LinePaint, Map as MapboxMap } from "mapbox-gl";

/**
 * RTW Mapbox 다크 스타일 설정 — 2026-07 리디자인 핸드오프.
 * 지도가 배경이 아니라 주인공: 다크 베이스 + POI/건물 숨김 + 도로 낮은 존재감.
 * Trace(궤적) 골드는 tokens.css --rtw-trace(#E8A33D)와 동일 값.
 * 2026-07-17 베이스를 dark-v11 → navigation-night-v1로 교체(주행 판독성 — 내비 전용 고대비 다크).
 * 2026-07-17 traffic·incidents 소스 상시 숨김 + showPoi 시 poi-label 운전자용 필터 해제.
 */

export const RTW_MAP_STYLE_URL = "mapbox://styles/mapbox/navigation-night-v1";

/** POI성 라벨 — 임시 토글(showPoi)로 표시/숨김 비교 가능 */
export const RTW_POI_LAYER_KEYWORDS = ["poi-label", "airport-label", "transit-label"];
/** 건물 — 오버뷰(비주행)에서만 숨김. 주행 중엔 공간감을 위해 복원 */
export const RTW_BUILDING_LAYER_KEYWORDS = ["building"];

/** 도로 레이어 낮은 존재감 — --rtw-map-road-ghost. dark-v11 기준 튜닝값 — navigation-night 베이스에서 재튜닝 여지 */
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

type RtwLayerSnapshot = {
  visibility: unknown;
  lineColor?: unknown;
  lineOpacity?: unknown;
  filter?: unknown;
};
const rtwStyleSnapshots = new WeakMap<MapboxMap, Map<string, RtwLayerSnapshot>>();

/** 스타일이 새로 로드되면 이전 스냅샷은 무효 — setStyle 호출 직후 반드시 호출 */
export function resetRtwStyleSnapshot(map: MapboxMap): void {
  rtwStyleSnapshots.delete(map);
}

/**
 * style.load 시 호출 — RTW 다크 스타일에서만. POI/건물 visibility·도로 존재감을
 * rideActive·showPoi 에 따라 적용. 커스텀 레이어(boxcycle- 접두, route, live-self,
 * debug-)는 건드리지 않는다.
 * @returns 스타일시트 준비 전이면 false — 호출부는 다음 idle에 재시도할 것
 */
export function applyRtwLayerStyle(
  map: MapboxMap,
  opts: { rideActive: boolean; showPoi: boolean },
): boolean {
  const { rideActive, showPoi } = opts;
  const layers = map.getStyle()?.layers ?? [];
  // 스타일시트 파싱 전(getStyle undefined/빈 배열) — 아직 적용 불가, 호출부가 재시도
  if (layers.length === 0) return false;

  let snapshots = rtwStyleSnapshots.get(map);
  if (!snapshots) {
    snapshots = new Map();
    rtwStyleSnapshots.set(map, snapshots);
  }

  for (const layer of layers) {
    if (
      layer.id.startsWith("boxcycle-") ||
      layer.id === "route" ||
      layer.id === "live-self" ||
      layer.id.startsWith("debug-")
    ) {
      continue;
    }

    // 내비 전용 교통 정체·사고 레이어 — RTW는 내비 기능 미사용, 항상 숨김
    if ("source" in layer && (layer.source === "mapbox-traffic" || layer.source === "mapbox-incidents")) {
      try {
        map.setLayoutProperty(layer.id, "visibility", "none");
      } catch {
        /* noop */
      }
      continue;
    }

    const isPoi = RTW_POI_LAYER_KEYWORDS.some((keyword) => layer.id.includes(keyword));
    const isBuilding = RTW_BUILDING_LAYER_KEYWORDS.some((keyword) => layer.id.includes(keyword));
    const isRoad = layer.id.includes("road") && layer.type === "line";

    if (!isPoi && !isBuilding && !isRoad) continue;

    if (!snapshots.has(layer.id)) {
      const snapshot: RtwLayerSnapshot = {
        visibility: map.getLayoutProperty(layer.id, "visibility"),
      };
      if (isRoad) {
        snapshot.lineColor = map.getPaintProperty(layer.id, "line-color");
        snapshot.lineOpacity = map.getPaintProperty(layer.id, "line-opacity");
      }
      if (isPoi && layer.id === "poi-label") {
        snapshot.filter = map.getFilter(layer.id);
      }
      snapshots.set(layer.id, snapshot);
    }
    const snapshot = snapshots.get(layer.id)!;

    if (isPoi) {
      try {
        map.setLayoutProperty(layer.id, "visibility", showPoi ? (snapshot.visibility ?? "visible") : "none");
      } catch {
        /* noop */
      }
      if (layer.id === "poi-label") {
        if (showPoi) {
          // 운전자용 클래스 필터(education/landmark/medical/motorist/park_like 등)를 해제해
          // 전체 POI 라벨을 노출 — 밀도는 심볼 충돌 처리가 자동 제한
          try {
            map.setFilter(layer.id, null);
          } catch {
            /* noop */
          }
        } else if (snapshot.filter !== undefined) {
          try {
            map.setFilter(layer.id, snapshot.filter as Parameters<typeof map.setFilter>[1]);
          } catch {
            /* noop */
          }
        }
      }
    }

    if (isBuilding) {
      try {
        map.setLayoutProperty(
          layer.id,
          "visibility",
          rideActive ? (snapshot.visibility ?? "visible") : "none",
        );
      } catch {
        /* noop */
      }
    }

    if (isRoad) {
      try {
        if (rideActive) {
          map.setPaintProperty(layer.id, "line-color", snapshot.lineColor);
          map.setPaintProperty(layer.id, "line-opacity", snapshot.lineOpacity);
        } else {
          map.setPaintProperty(layer.id, "line-color", RTW_ROAD_PAINT["line-color"]);
          map.setPaintProperty(layer.id, "line-opacity", RTW_ROAD_PAINT["line-opacity"]);
        }
      } catch {
        /* 일부 도로 레이어는 paint 프로퍼티가 다르게 정의될 수 있음 */
      }
    }
  }
  return true;
}
