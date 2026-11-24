import type { Map as MapboxMap } from "mapbox-gl";

/**
 * 지형 OFF 낮은 주행 카메라의 시야 확장 (2026-11-24 Chief, 지형 OFF·3D 최대 계획 1단계).
 *
 * 설치 SDK 는 지형이 없으면 장면을 「카메라~화면 중심 거리 × 10」에서 자른다. 카메라 2(9.4m)는 94m다.
 * 또 낮은 카메라에서는 먼 곳을 z14 이하 타일로 받는데 Standard 의 건물·나무는 z15 부터 있다.
 * 공개 API 로는 둘 다 바꿀 수 없어, 이 지도 인스턴스의 transform 두 함수만 감싼다.
 * 조건이 하나라도 맞지 않으면 SDK 원래 결과를 그대로 돌려준다.
 *
 * 멀리 필요한 것은 건물·나무·땅이다. 글자와 앱 선(GeoJSON)까지 1km 조각으로 다시 만들면
 * 화면에 보이지 않는 작업이 커지므로 300m 안의 조각만 쓴다(글자 종류·밀도는 줄이지 않는다).
 */
export const RIDE_VIEW_DISTANCE_SDK_VERSION = "3.23.1";
export const RIDE_VIEW_DISTANCE_DEFAULT_M = 1000;
const MIN_M = 200;
const MAX_M = 3000;
/** 3D 건물·나무가 있는 가장 거친 타일. */
const OBJECT_TILE_ZOOM = 15;
const MIN_PITCH_DEG = 60;
/** 원거리 한계는 정면 깊이라 화면 모서리까지의 수평 거리가 더 길다. */
const CORNER_REACH = 1.3;
/** 글자·앱 선이 쓰는 조각의 거리. 종전 시야(카메라 2는 94~135m)보다 넓다. */
export const RIDE_NEAR_DETAIL_M = 300;
/** 글자 보충·나무 배치가 함께 쓰는 벡터 소스 — 가까운 조각이면 충분하다. */
export const STANDARD_RIDE_DATA_SOURCE = "boxcycle-standard-ride-names";
/** 앱 GeoJSON 이지만 원경에 필요한 소스(가상 가로수). */
export const RIDE_TREES_SRC = "boxcycle-ride-trees-src";
const EARTH_CIRCUMFERENCE_M = 40_075_016.686;

type TileId = {
  canonical: { z: number; x: number; y: number };
  children(sourceMaxZoom: number): TileId[];
};
type CoverOptions = { maxzoom?: number; isTerrainDEM?: boolean };
type Projection = { name: string; farthestPixelDistance(tr: Transform): number };
type SourceCache = { id?: string; map?: unknown; _source?: { type?: string }; update(...args: unknown[]): void };
type Transform = {
  projection: Projection;
  elevation: unknown;
  pitch: number;
  zoom: number;
  bearing: number;
  fov: number;
  width: number;
  height: number;
  pixelsPerMeter: number;
  center: { lat: number };
  _camera: { position: ArrayLike<number> };
  _calcMatrices(): void;
  coveringTiles(options: CoverOptions): TileId[];
  clone(): Transform;
};

export type RideViewDistanceController = {
  /** 주행 중 · 지형 OFF 일 때만 true. */
  setActive(active: boolean): void;
  dispose(): void;
};

/** `?viewdist=` — 0 은 SDK 기본(비교용), 200~3000 은 미터. 그 밖은 기본값. */
export function parseRideViewDistanceM(search: string | null | undefined): number {
  const raw = new URLSearchParams(search ?? "").get("viewdist");
  if (raw == null || raw.trim() === "") return RIDE_VIEW_DISTANCE_DEFAULT_M;
  const value = Number(raw);
  if (value === 0) return 0;
  return Number.isFinite(value) && value >= MIN_M && value <= MAX_M ? value : RIDE_VIEW_DISTANCE_DEFAULT_M;
}

function isEligible(tr: Transform): boolean {
  return !tr.elevation && tr.projection.name === "mercator" && tr.pitch >= MIN_PITCH_DEG && tr.zoom >= OBJECT_TILE_ZOOM;
}

type TileXyz = { z: number; x: number; y: number };
type ViewPoint = { x: number; y: number; lat: number };

/** 카메라 발밑에서 타일까지의 수평 거리(m). 타일 안이면 0. */
function tileDistanceM(tile: TileXyz, view: ViewPoint): number {
  const n = 2 ** tile.z;
  const tileM = (EARTH_CIRCUMFERENCE_M * Math.cos((view.lat * Math.PI) / 180)) / n;
  const dx = Math.max(tile.x - view.x * n, 0, view.x * n - tile.x - 1);
  const dy = Math.max(tile.y - view.y * n, 0, view.y * n - tile.y - 1);
  return Math.hypot(dx, dy) * tileM;
}

/** 타일이 시야 거리·좌우 시야각 안에 걸치는지. 좌표는 Mercator 0..1, y 는 남쪽이 +. */
export function isTileInRideView(
  tile: TileXyz,
  view: ViewPoint & { bearingDeg: number; halfFovRad: number; reachM: number },
): boolean {
  const distance = tileDistanceM(tile, view);
  if (distance === 0) return true;
  if (distance > view.reachM) return false;
  const n = 2 ** tile.z;
  const east = tile.x + 0.5 - view.x * n;
  const north = view.y * n - tile.y - 0.5;
  const toCenter = Math.atan2(east, north) - (view.bearingDeg * Math.PI) / 180;
  const off = Math.abs(Math.atan2(Math.sin(toCenter), Math.cos(toCenter)));
  // 타일 외접원이 보이는 각도만큼 여유를 둔다.
  const spread = Math.asin(Math.min(1, Math.SQRT1_2 / Math.hypot(east, north)));
  return off <= view.halfFovRad + spread;
}

/** z14 이하로 간소화된 타일 중 시야 안의 것만 z15 로 나눈다. */
function refineCover(tr: Transform, tiles: TileId[], sourceMaxZoom: number, distanceM: number): TileId[] {
  if (!tiles.some((id) => id.canonical.z < OBJECT_TILE_ZOOM)) return tiles;
  const position = tr._camera.position;
  const view = {
    x: position[0],
    y: position[1],
    lat: tr.center.lat,
    bearingDeg: tr.bearing,
    halfFovRad: Math.atan(Math.tan((tr.fov * Math.PI) / 360) * (tr.width / Math.max(1, tr.height))) + 0.1,
    reachM: distanceM * CORNER_REACH,
  };
  const out: TileId[] = [];
  const split = (id: TileId) => {
    if (id.canonical.z >= OBJECT_TILE_ZOOM) {
      out.push(id);
      return;
    }
    for (const child of id.children(sourceMaxZoom)) {
      if (isTileInRideView(child.canonical, view)) split(child);
    }
  };
  for (const id of tiles) {
    if (id.canonical.z >= OBJECT_TILE_ZOOM || !isTileInRideView(id.canonical, view)) out.push(id);
    else split(id);
  }
  return out;
}

function keepNear(tr: Transform, tiles: TileId[]): TileId[] {
  const view = { x: tr._camera.position[0], y: tr._camera.position[1], lat: tr.center.lat };
  const out = tiles.filter((id) => tileDistanceM(id.canonical, view) <= RIDE_NEAR_DETAIL_M);
  return out.length === tiles.length ? tiles : out;
}

/**
 * `coveringTiles` 는 어느 소스를 위한 호출인지 모른다 — SourceCache.update 동안만 주인을 적어 둔다.
 * 프로토타입을 한 번만 감싸고 동작은 바꾸지 않는다. 그림자 등 update 밖의 호출은 주인이 없다.
 */
let updatingCache: SourceCache | null = null;
const trackedPrototypes = new WeakSet<object>();
function runAsCache(cache: SourceCache, work: () => void): void {
  const previous = updatingCache;
  updatingCache = cache;
  try {
    work();
  } finally {
    updatingCache = previous;
  }
}
function trackSourceCaches(caches: Record<string, SourceCache> | undefined): void {
  const first = caches && Object.values(caches)[0];
  const proto = first && (Object.getPrototypeOf(first) as SourceCache);
  if (!proto || typeof proto.update !== "function" || trackedPrototypes.has(proto)) return;
  trackedPrototypes.add(proto);
  const update = proto.update;
  proto.update = function (this: SourceCache, ...args: unknown[]) {
    runAsCache(this, () => update.apply(this, args));
  };
}

function isNearOnly(cache: SourceCache | null): boolean {
  const id = cache?.id ?? "";
  if (id.startsWith("symbol:")) return true;
  const name = id.slice(id.indexOf(":") + 1);
  if (name === RIDE_TREES_SRC) return false;
  return name === STANDARD_RIDE_DATA_SOURCE || cache?._source?.type === "geojson";
}

const NOOP: RideViewDistanceController = { setActive() {}, dispose() {} };

export function installRideViewDistance(map: MapboxMap, distanceM: number): RideViewDistanceController {
  const host = map as unknown as { version?: string; transform?: Transform; triggerRepaint(): void;
    style?: { _mergedSourceCaches?: Record<string, SourceCache> } };
  const transform = host.transform;
  if (distanceM <= 0 || !transform) return NOOP;
  if (
    host.version !== RIDE_VIEW_DISTANCE_SDK_VERSION ||
    typeof transform._calcMatrices !== "function" ||
    typeof transform.coveringTiles !== "function" ||
    typeof transform.clone !== "function" ||
    typeof transform.projection?.farthestPixelDistance !== "function"
  ) {
    console.warn("[rideViewDistance] SDK 계약이 달라 기본 시야를 사용합니다.", host.version);
    return NOOP;
  }

  let active = false;
  let failed = false;
  const giveUp = (err: unknown) => {
    failed = true;
    console.warn("[rideViewDistance] 시야 확장을 중단합니다.", err);
  };
  const wrap = (tr: Transform): Transform => {
    const calcMatrices = tr._calcMatrices;
    const coveringTiles = tr.coveringTiles;
    const clone = tr.clone;
    tr._calcMatrices = function (this: Transform) {
      const projection = this.projection;
      if (!active || failed || !isEligible(this)) {
        calcMatrices.call(this);
        return;
      }
      // 투영 객체는 줌 전환 때 새로 만들어진다 — 계산하는 동안만 바꿔 끼운다.
      const original = projection.farthestPixelDistance;
      projection.farthestPixelDistance = (t) => Math.max(original.call(projection, t), distanceM * t.pixelsPerMeter);
      try {
        calcMatrices.call(this);
      } finally {
        projection.farthestPixelDistance = original;
      }
    };
    tr.coveringTiles = function (this: Transform, options: CoverOptions) {
      const tiles = coveringTiles.call(this, options);
      const maxZoom = options.maxzoom;
      if (!active || failed || options.isTerrainDEM || !isEligible(this)) return tiles;
      try {
        if (isNearOnly(updatingCache)) return keepNear(this, tiles);
        // 15·16 = Standard 건물·나무 벡터. 랜드마크(14) 등 나머지는 SDK 결과 그대로.
        if (maxZoom !== 15 && maxZoom !== 16) return tiles;
        return refineCover(this, tiles, maxZoom, distanceM);
      } catch (err) {
        giveUp(err);
        return tiles;
      }
    };
    tr.clone = function (this: Transform) {
      return wrap(clone.call(this));
    };
    return tr;
  };

  wrap(transform);
  const recalc = () => {
    transform._calcMatrices();
    host.triggerRepaint();
  };
  return {
    setActive(next) {
      if (active === next) return;
      active = next;
      if (next) trackSourceCaches(host.style?._mergedSourceCaches);
      recalc();
    },
    dispose() {
      active = false;
      // 인스턴스에 얹은 것만 지워 SDK 프로토타입 함수로 되돌린다.
      const own = transform as Partial<Transform>;
      delete own._calcMatrices;
      delete own.coveringTiles;
      delete own.clone;
    },
  };
}
