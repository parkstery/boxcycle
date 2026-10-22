/**
 * 주행 중 지도 구성 비용 측정 스위치(`?mapcut=a,b,c`).
 *
 * 운영 포함 쿼리 — 없으면 아무것도 건드리지 않고 기존 화면 그대로 둔다.
 * Chief 가 화면 구성을 바꾸기 전에 「무엇을 빼면 얼마나 빨라지는지」를
 * 실기기에서 잴 수 있게 하는 것이 목적이라, 기본 화면 변경은 없다.
 *
 * 키: `terrain`(지형 끔) `buildings`(3D 건물 끔) `labels`(symbol 숨김)
 * `poi`(POI 계열 symbol 만) `sky`(sky/fog 끔) `minimap`(미니맵 중지·숨김)
 * `roads`(도로 세부·보조 line 숨김 — 경로·정복 등 앱 레이어는 유지).
 * 레이어 숨김은 `setLayoutProperty(visibility, none)`, 스타일 재로드 뒤 재적용은
 * 호출부(MapView `style.load`)가 맡는다. 알 수 없는 키는 무시한다.
 */

export const MAP_CUT_QUERY_KEY = "mapcut";

export const MAP_CUT_KEYS = [
  "terrain",
  "buildings",
  "labels",
  "poi",
  "sky",
  "minimap",
  "roads",
] as const;

export type MapCutKey = (typeof MAP_CUT_KEYS)[number];

const KNOWN_KEYS: ReadonlySet<string> = new Set(MAP_CUT_KEYS);

/** `?mapcut=` 파싱 — 소문자·공백 무시, 중복 제거, 알 수 없는 키 무시. */
export function parseMapCutKeys(search: string | null | undefined): MapCutKey[] {
  try {
    const raw = new URLSearchParams(search ?? "").get(MAP_CUT_QUERY_KEY);
    if (raw == null || raw.trim() === "") return [];
    const out: MapCutKey[] = [];
    for (const part of raw.split(",")) {
      const key = part.trim().toLowerCase();
      if (!KNOWN_KEYS.has(key)) continue;
      const typed = key as MapCutKey;
      if (!out.includes(typed)) out.push(typed);
    }
    return out;
  } catch {
    return [];
  }
}

let mapCutCache: MapCutKey[] | undefined;

/** 페이지 수명 동안 쿼리를 한 번만 읽는다. */
export function getMapCutKeys(): MapCutKey[] {
  if (mapCutCache !== undefined) return mapCutCache;
  const search = typeof window === "undefined" ? "" : (window.location?.search ?? "");
  mapCutCache = parseMapCutKeys(search);
  return mapCutCache;
}

export function isMapCutKeyActive(key: MapCutKey): boolean {
  return getMapCutKeys().includes(key);
}

/** 시험이 쿼리 캐시를 비운다. 운영에서는 부르지 않는다. */
export function resetMapCutForTests(): void {
  mapCutCache = undefined;
}

/**
 * 앱 기능 레이어 — mapcut 이 절대 숨기지 않는다.
 * 경로(`route`)·라이더·정복·관전·활동 오버레이는 전부 `boxcycle-` 접두,
 * 거리 자동 경로 안내선은 `distance-`, 구형 디버그 레이어는 `debug-`.
 */
const MAP_CUT_PRESERVED_PREFIXES = ["boxcycle-", "route", "live-self", "debug-", "distance-"] as const;

/** 3D 건물 커스텀 레이어 — `boxcycle-` 접두지만 `buildings` 키의 대상이라 보존 예외. */
const MAP_CUT_BUILDING_LAYER_ID = "boxcycle-3d-buildings";

/** `rtwMapConfig` 의 POI 키워드와 같은 값 — map 도메인 안이라 직접 두어 의존을 늘리지 않는다. */
const MAP_CUT_POI_KEYWORDS = ["poi-label", "airport-label", "transit-label"] as const;

function isPreservedLayerId(id: string): boolean {
  return MAP_CUT_PRESERVED_PREFIXES.some((prefix) => id.startsWith(prefix));
}

export type MapCutStyleLayer = { id: string; type?: string };

export type MapCutHiddenByKey = Record<MapCutKey, string[]>;

/**
 * 순수 분류 — 어떤 키가 어떤 레이어를 숨기는지. 렌더 없이 시험·헤드리스 census 가 본다.
 * `minimap`·`terrain`·`sky` 의 일부(fog)는 레이어가 아니라 DOM·지형·안개라 비고,
 * `sky` 는 sky 타입 레이어만 여기에 담는다.
 */
export function classifyMapCutLayers(
  layers: readonly MapCutStyleLayer[],
  keys: readonly MapCutKey[],
): MapCutHiddenByKey {
  const byKey: MapCutHiddenByKey = {
    terrain: [],
    buildings: [],
    labels: [],
    poi: [],
    sky: [],
    minimap: [],
    roads: [],
  };
  const want = new Set(keys);
  if (want.size === 0) return byKey;
  for (const layer of layers) {
    const id = layer.id;
    if (typeof id !== "string" || id === "") continue;
    if (want.has("buildings")) {
      if (
        id === MAP_CUT_BUILDING_LAYER_ID ||
        (layer.type === "fill-extrusion" && id.includes("building") && !isPreservedLayerId(id))
      ) {
        byKey.buildings.push(id);
      }
    }
    if (want.has("labels")) {
      if (layer.type === "symbol" && !isPreservedLayerId(id)) {
        byKey.labels.push(id);
      }
    }
    if (want.has("poi")) {
      if (
        layer.type === "symbol" &&
        !isPreservedLayerId(id) &&
        MAP_CUT_POI_KEYWORDS.some((keyword) => id.includes(keyword))
      ) {
        byKey.poi.push(id);
      }
    }
    if (want.has("sky")) {
      if (layer.type === "sky" && !isPreservedLayerId(id)) {
        byKey.sky.push(id);
      }
    }
    if (want.has("roads")) {
      if (layer.type === "line" && id.includes("road") && !isPreservedLayerId(id)) {
        byKey.roads.push(id);
      }
    }
  }
  return byKey;
}

/** `applyMapCutToMap` 이 받는 최소 지도 표면 — 가짜 지도로 시험한다. */
export type MapCutMapLike = {
  getStyle?: () => { layers?: MapCutStyleLayer[] } | undefined;
  getLayer?: (id: string) => unknown;
  setLayoutProperty?: (layerId: string, name: string, value: unknown) => void;
  setTerrain?: (terrain: unknown) => void;
  setFog?: (fog: unknown) => void;
  setSky?: (sky: unknown) => void;
};

export type MapCutApplyResult = {
  applied: MapCutKey[];
  hiddenLayers: string[];
  hiddenByKey: MapCutHiddenByKey;
  terrainOff: boolean;
  fogOff: boolean;
};

function emptyHiddenByKey(): MapCutHiddenByKey {
  return { terrain: [], buildings: [], labels: [], poi: [], sky: [], minimap: [], roads: [] };
}

/**
 * 지도에 mapcut 적용. 키가 비면 **아무 호출도 없이** 반환한다.
 * 숨김은 전부 `setLayoutProperty(visibility, none)` + `setTerrain/setFog(null)`.
 * `minimap` 은 DOM(RouteMinimap)이 맡고 여기서는 적용 기록만 남긴다.
 */
export function applyMapCutToMap(
  map: unknown,
  keys?: readonly MapCutKey[] | null,
): MapCutApplyResult {
  const active: readonly MapCutKey[] = keys ?? getMapCutKeys();
  const result: MapCutApplyResult = {
    applied: [...active],
    hiddenLayers: [],
    hiddenByKey: emptyHiddenByKey(),
    terrainOff: false,
    fogOff: false,
  };
  if (active.length === 0 || map == null) return result;
  const cutMap = map as MapCutMapLike;

  let layers: readonly MapCutStyleLayer[];
  try {
    layers = cutMap.getStyle?.()?.layers ?? [];
  } catch {
    layers = [];
  }
  const classified = classifyMapCutLayers(layers, active);
  const want = new Set(active);

  const hide = (id: string, key: MapCutKey): void => {
    try {
      if (!cutMap.getLayer?.(id)) return;
    } catch {
      return;
    }
    try {
      cutMap.setLayoutProperty?.(id, "visibility", "none");
    } catch {
      return;
    }
    result.hiddenByKey[key].push(id);
    if (!result.hiddenLayers.includes(id)) result.hiddenLayers.push(id);
  };

  if (want.has("terrain")) {
    try {
      cutMap.setTerrain?.(null);
      result.terrainOff = true;
    } catch {
      /* 지형 미지원 스타일 */
    }
  }
  if (want.has("sky")) {
    for (const id of classified.sky) hide(id, "sky");
    try {
      cutMap.setFog?.(null);
      result.fogOff = true;
    } catch {
      /* 안개 미지원 */
    }
    try {
      cutMap.setSky?.(null);
    } catch {
      /* sky API 미지원 */
    }
  }
  if (want.has("buildings")) {
    for (const id of classified.buildings) hide(id, "buildings");
  }
  if (want.has("labels")) {
    for (const id of classified.labels) hide(id, "labels");
  }
  if (want.has("poi")) {
    for (const id of classified.poi) hide(id, "poi");
  }
  if (want.has("roads")) {
    for (const id of classified.roads) hide(id, "roads");
  }
  return result;
}
