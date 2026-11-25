import type { ExpressionSpecification, Map as MapboxMap } from "mapbox-gl";

/**
 * 지형 OFF 주행의 건물 외관 (2026-11-25 Chief, 4단계 「모두 적용」 — 색 변화 + 가까운 창문).
 *
 * 한국처럼 외벽 자료가 없는 곳은 Standard 건물이 모두 같은 색이다. 같은 레이어의 색을 건물 번호·높이로
 * 나누고, 250m 안의 건물만 별도 레이어에서 창문 무늬로 그린다. 높이 추정값(est_height)은 Standard 의
 * 건물 자료에만 있어 그 조각을 그대로 쓴다 — 추가 타일 요청이 없다.
 *
 * Standard 는 import 된 스타일이라 공개 API 로 레이어를 더할 수 없다. SDK 3.23.1 내부 경로를 쓰고
 * 계약이 다르면 손대지 않는다.
 */
const BUILDING_LAYER = "3d-building";
export const RIDE_WINDOW_LAYER = "ride-building-windows";
const WINDOW_RADIUS_M = 250;
/** 이만큼 움직이면 창문을 그릴 건물을 다시 고른다. */
const WINDOW_MOVE_M = 100;
const FLOOR_M = 3.3;
const FLOORS_PER_IMAGE = 4;
const IMAGE_PX = 256;
const EARTH_CIRCUMFERENCE_M = 40_075_016.686;

const LOW = ["#d9c3ad", "#cfa58b", "#e6dccb", "#c9c6bd", "#bf8f78", "#dcd3b8", "#b9c0ae"];
const MID = ["#e4ded2", "#c8cdd0", "#d8c9b4", "#b8c4cc", "#d9d6d0", "#c4ada0", "#e9e6df"];
const HIGH = ["#e6e3dc", "#b4c3cf", "#d3d7d9", "#c7bfb2", "#a9bac6", "#dcd5c8", "#cfd6d4"];
const MID_FROM_M = 9;
const HIGH_FROM_M = 24;
const GLASS = ["#7f97a6", "#8aa3b1", "#748b99", "#93a9b4"];

const HEIGHT = ["coalesce", ["get", "est_height"], ["number", ["get", "height"], 3]] as unknown as ExpressionSpecification;
const SEED = ["%", ["abs", ["number", ["id"], 0]], LOW.length];
const byHeight = (low: unknown, mid: unknown, high: unknown) => ["step", HEIGHT, low, MID_FROM_M, mid, HIGH_FROM_M, high];
const pick = (colors: readonly string[]) => ["match", SEED, ...colors.flatMap((c, i) => [i, c]), colors[0]];
/** 건물 번호와 높이로 고르는 색 — 같은 건물은 늘 같은 색이다. */
export const RIDE_BUILDING_COLOR = byHeight(pick(LOW), pick(MID), pick(HIGH)) as unknown as ExpressionSpecification;
const WINDOW_PATTERN = ["concat", "ride-wall-", byHeight("l", "m", "h"), SEED];
const SOLID = [["==", ["get", "extrude"], "true"], ["==", ["get", "underground"], "false"]];

type WallKind = "house" | "flat" | "strip";
type StyleImage = Record<string, unknown>;
type ImageRef = { name?: string } | string;
type Fragment = {
  _layers?: Record<string, unknown>;
  fragments?: Array<{ style?: Fragment }>;
  getPaintProperty(id: string, name: string): unknown;
  setPaintProperty(id: string, name: string, value: unknown): void;
  getFilter(id: string): unknown;
  setFilter(id: string, filter: unknown): void;
  addLayer(layer: unknown, before?: string): void;
  removeLayer(id: string): void;
  getImage(id: ImageRef): StyleImage | null | undefined;
  addImage(id: ImageRef, image: StyleImage): void;
  removeImage(id: ImageRef): void;
};
type RootStyle = Fragment & { mergeLayers?: () => void; listImages?: () => ImageRef[]; _changed?: boolean };
type InternalMap = MapboxMap & { style?: RootStyle; transform?: { tileZoom: number }; _update?: (styleDirty: boolean) => void };

/** Standard 조각(건물 레이어가 있는 스타일). 없으면 Standard 지도가 아니다. */
function findBuildings(style: Fragment | undefined): Fragment | null {
  if (!style) return null;
  if (style._layers?.[BUILDING_LAYER]) return style;
  for (const fragment of style.fragments ?? []) {
    const found = findBuildings(fragment.style);
    if (found) return found;
  }
  return null;
}

/** 벽 그림 한 장 = 가로 4칸 × 세로 4층. 씨앗이 같으면 늘 같은 그림이다. */
function drawWall(wall: string, kind: WallKind, seed: number): ImageData {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = IMAGE_PX;
  const g = canvas.getContext("2d");
  if (!g) throw new Error("2d context");
  g.fillStyle = wall;
  g.fillRect(0, 0, IMAGE_PX, IMAGE_PX);
  let state = seed * 7919 + 13;
  const random = (): number => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
  const cell = IMAGE_PX / FLOORS_PER_IMAGE;
  for (let y = 0; y < FLOORS_PER_IMAGE; y++) {
    if (kind !== "house") {
      g.fillStyle = "rgba(0,0,0,0.05)";
      g.fillRect(0, y * cell + cell - 5, IMAGE_PX, 5);
    }
    for (let x = 0; x < FLOORS_PER_IMAGE; x++) {
      const left = x * cell, top = y * cell;
      g.fillStyle = GLASS[Math.floor(random() * GLASS.length)];
      if (kind === "house") {
        if ((x + y) % 2 !== 0 && random() <= 0.35) continue;
        g.fillRect(left + 18, top + 16, 28, 28);
        g.fillStyle = "rgba(255,255,255,0.5)";
        g.fillRect(left + 18, top + 42, 28, 3);
      } else if (kind === "flat") {
        g.fillRect(left + 9, top + 14, 46, 34);
        g.fillStyle = "rgba(255,255,255,0.45)";
        g.fillRect(left + 31, top + 14, 2, 34);
      } else {
        g.fillRect(left + 4, top + 16, 56, 36);
      }
    }
  }
  return g.getImageData(0, 0, IMAGE_PX, IMAGE_PX);
}

/** 무늬는 조각 줌의 화소 단위라, 한 층이 3.3m 가 되도록 줌마다 배율을 정한다. */
export function wallPixelRatio(tileZoom: number, lat: number): number {
  const metersPerPx = (EARTH_CIRCUMFERENCE_M * Math.cos((lat * Math.PI) / 180)) / (512 * 2 ** tileZoom);
  return IMAGE_PX / ((FLOOR_M * FLOORS_PER_IMAGE) / metersPerPx);
}

function metersBetween(a: readonly [number, number], b: readonly [number, number]): number {
  return Math.hypot((a[0] - b[0]) * 111_320 * Math.cos((a[1] * Math.PI) / 180), (a[1] - b[1]) * 110_540);
}

export type RideBuildings = {
  /** 적용돼 있지 않거나 많이 움직였으면 맞춘다. 여러 번 불러도 된다. Standard 지도가 아니면 false. */
  apply(): boolean;
  /** 창문 무늬만 켜고 끈다(색은 그대로). 다음 apply 부터 반영. */
  setWindows(on: boolean): void;
  restore(): void;
};

export function createRideBuildings(map: MapboxMap, wallImage: typeof drawWall = drawWall): RideBuildings {
  const host = map as InternalMap;
  let base: Fragment | null = null;
  let original: { color: unknown; filter: unknown } | null = null;
  let imagesZoom: number | null = null;
  let windowsAt: [number, number] | null = null;
  let failedOn: Fragment | null = null;
  let windowsOn = true;

  const commit = (): void => {
    if (host.style) host.style._changed = true;
    host._update?.(true);
  };
  const dropWindows = (style: Fragment): void => {
    if (!style._layers?.[RIDE_WINDOW_LAYER]) return;
    style.removeLayer(RIDE_WINDOW_LAYER);
    host.style?.mergeLayers?.();
  };
  /** 이미지 자료 형식은 SDK 내부 클래스라, 지도에 한 번 올린 것을 빌려 Standard 조각에도 올린다. */
  const putImage = (style: Fragment, name: string, image: ImageData, pixelRatio: number): void => {
    if (map.hasImage(name)) map.removeImage(name);
    map.addImage(name, image, { pixelRatio });
    const ref = host.style?.listImages?.().find((x) => (typeof x === "string" ? x : x.name) === name);
    const stored = ref && host.style?.getImage(ref);
    if (!ref || !stored) throw new Error("style image");
    if (style.getImage(ref)) style.removeImage(ref);
    style.addImage(ref, { ...stored });
  };
  const ensureImages = (style: Fragment, tileZoom: number): boolean => {
    if (imagesZoom === tileZoom) return false;
    dropWindows(style);
    const ratio = wallPixelRatio(tileZoom, map.getCenter().lat);
    LOW.forEach((c, i) => putImage(style, `ride-wall-l${i}`, wallImage(c, "house", i), ratio));
    MID.forEach((c, i) => putImage(style, `ride-wall-m${i}`, wallImage(c, "flat", i + 10), ratio));
    HIGH.forEach((c, i) => putImage(style, `ride-wall-h${i}`, wallImage(c, i % 2 ? "strip" : "flat", i + 20), ratio));
    imagesZoom = tileZoom;
    return true;
  };
  const windowLayer = (filter: unknown) => ({
    id: RIDE_WINDOW_LAYER, type: "fill-extrusion", source: "composite", "source-layer": "building", minzoom: 15, filter,
    layout: { "fill-extrusion-edge-radius": 0.4 },
    paint: {
      "fill-extrusion-pattern": WINDOW_PATTERN,
      "fill-extrusion-height": HEIGHT,
      "fill-extrusion-base": ["max", 0, ["number", ["get", "min_height"], 0]],
      "fill-extrusion-opacity": 1, "fill-extrusion-cast-shadows": false, "fill-extrusion-cutoff-fade-range": 0,
      "fill-extrusion-ambient-occlusion-intensity": 0.15, "fill-extrusion-ambient-occlusion-ground-radius": 8,
    },
  });
  const restore = (): void => {
    const style = base, before = original;
    base = null;
    original = null;
    imagesZoom = null;
    windowsAt = null;
    // 스타일이 새로 로드됐으면 예전 조각은 이미 버려졌다.
    if (!style || !before || findBuildings(host.style) !== style) return;
    try {
      dropWindows(style);
      style.setFilter(BUILDING_LAYER, before.filter);
      style.setPaintProperty(BUILDING_LAYER, "fill-extrusion-color", before.color);
      commit();
    } catch (err) {
      console.warn("[rideBuildings] 복원 실패", err);
    }
  };
  const applyTo = (style: Fragment): void => {
    const center = map.getCenter();
    const here: [number, number] = [center.lng, center.lat];
    const firstOnStyle = base !== style;
    if (firstOnStyle) {
      base = style;
      original = { color: style.getPaintProperty(BUILDING_LAYER, "fill-extrusion-color"), filter: style.getFilter(BUILDING_LAYER) };
      imagesZoom = null;
      windowsAt = null;
      style.setPaintProperty(BUILDING_LAYER, "fill-extrusion-color", RIDE_BUILDING_COLOR);
    }
    if (!windowsOn) {
      // 자동 품질이 창문을 껐다 — 원래 레이어가 모든 건물을 색만 입혀 그린다.
      if (style._layers?.[RIDE_WINDOW_LAYER]) {
        dropWindows(style);
        style.setFilter(BUILDING_LAYER, original?.filter);
      }
      if (windowsAt || firstOnStyle) commit();
      windowsAt = null;
      return;
    }
    const tileZoom = host.transform?.tileZoom;
    if (tileZoom == null) return;
    const fresh = ensureImages(style, tileZoom);
    if (!fresh && windowsAt && metersBetween(windowsAt, here) < WINDOW_MOVE_M) return;
    const near = ["<", ["distance", { type: "Point", coordinates: here }], WINDOW_RADIUS_M];
    const windows = ["all", ...SOLID, near];
    if (style._layers?.[RIDE_WINDOW_LAYER]) style.setFilter(RIDE_WINDOW_LAYER, windows);
    else {
      style.addLayer(windowLayer(windows), BUILDING_LAYER);
      host.style?.mergeLayers?.();
    }
    // 같은 건물을 두 번 그리지 않게 창문 건물은 원래 레이어에서 뺀다.
    style.setFilter(BUILDING_LAYER, ["all", ...SOLID, ["!", near]]);
    windowsAt = here;
    commit();
  };
  return {
    apply() {
      const style = findBuildings(host.style);
      if (!style) return false;
      if (style === failedOn) return true;
      try {
        applyTo(style);
      } catch (err) {
        failedOn = style;
        console.warn("[rideBuildings] 건물 외관을 원래대로 둡니다.", err);
        restore();
      }
      return true;
    },
    setWindows(on) {
      windowsOn = on;
    },
    restore,
  };
}
