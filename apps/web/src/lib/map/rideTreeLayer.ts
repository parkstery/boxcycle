import type { ExpressionSpecification, GeoJSONSource, Map as MapboxMap, MapSourceDataEvent, ModelLayerSpecification } from "mapbox-gl";
import {
  placeRideTrees,
  RIDE_TREE_RADIUS_M,
  RIDE_TREE_ROAD_WIDTH_M,
  type RideTree,
  type RideTreeData,
  type Ring,
  type XY,
} from "./rideTreePlacement";
import { RIDE_TREES_SRC } from "./rideViewDistance";

/**
 * 지형 OFF 주행의 가상 가로수·숲 (2026-11-24 Chief: 각진 나무 · 여유).
 * 이미 받은 streets-v8 조각만 읽는다 — 서버·Firestore·별도 타일 API 요청이 없다.
 */
const RIDE_TREES_LAYER = "boxcycle-ride-trees";
/** 조각을 받아 두기 위한 보이지 않는 면. 투명도 0 이라 그리지 않는다. */
const RIDE_TREE_DATA_LAYER = "boxcycle-ride-tree-data";

const CHECK_MS = 1000;
const MOVE_M = 60;
const SLICE_MS = 4;
const EARTH_R = 6378137;
const RAD = Math.PI / 180;

const MODEL_ID = (kind: string): string => `boxcycle-tree-${kind}`;
const MODEL_FILES = { broad: "facet-broad", tall: "facet-tall", conifer: "facet-conifer", shrub: "shrub" } as const;

/** 원점을 0.05° 격자에 맞춰 같은 동네에서는 주행마다 같은 자리에 심는다. */
export function rideTreeOrigin(center: XY): XY {
  return [Math.round(center[0] * 20) / 20, Math.round(center[1] * 20) / 20];
}
export function toRideTreeLocal(origin: XY, p: XY): XY {
  return [(p[0] - origin[0]) * RAD * EARTH_R * Math.cos(origin[1] * RAD), (p[1] - origin[1]) * RAD * EARTH_R];
}
function toLngLat(origin: XY, x: number, y: number): [number, number] {
  return [origin[0] + x / (EARTH_R * Math.cos(origin[1] * RAD)) / RAD, origin[1] + y / EARTH_R / RAD];
}

export function rideTreesToGeoJson(trees: readonly RideTree[], origin: XY): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: trees.map((t) => ({
      type: "Feature",
      properties: { m: MODEL_ID(t.kind), r: t.rotation, k: t.size },
      geometry: { type: "Point", coordinates: toLngLat(origin, t.x, t.y) },
    })),
  };
}

function linesOf(g: GeoJSON.Geometry): GeoJSON.Position[][] {
  return g.type === "LineString" ? [g.coordinates] : g.type === "MultiLineString" ? g.coordinates : [];
}
function polygonsOf(g: GeoJSON.Geometry): GeoJSON.Position[][][] {
  return g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
}

/** 받은 조각에서 계산 범위 안의 자료만 모은다. */
function* collect(map: MapboxMap, dataSource: string, origin: XY, center: XY): Generator<void, RideTreeData, void> {
  const data: RideTreeData = { roads: [], greens: [], buildings: [], water: [], realTrees: [] };
  const reach = RIDE_TREE_RADIUS_M + 20;
  const local = (p: GeoJSON.Position): XY => toRideTreeLocal(origin, [p[0], p[1]]);
  const near = (pts: readonly XY[]): boolean => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of pts) {
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
    return x0 < center[0] + reach && x1 > center[0] - reach && y0 < center[1] + reach && y1 > center[1] - reach;
  };
  const addPolygons = (g: GeoJSON.Geometry, add: (rings: Ring[]) => void): void => {
    for (const polygon of polygonsOf(g)) {
      const rings = polygon.map((ring) => ring.map(local));
      if (rings[0]?.length && near(rings[0])) add(rings);
    }
  };
  const readers: Array<[string, (f: GeoJSON.Feature) => void]> = [
    ["road", (f) => {
      const cls = String(f.properties?.class ?? "");
      if (!RIDE_TREE_ROAD_WIDTH_M[cls]) return;
      const elevated = (f.properties?.structure ?? "none") !== "none";
      for (const line of linesOf(f.geometry)) {
        const pts = line.map(local);
        if (near(pts)) data.roads.push({ cls, elevated, pts });
      }
    }],
    ["landuse", (f) => addPolygons(f.geometry, (rings) => data.greens.push({ cls: String(f.properties?.class ?? ""), rings }))],
    ["building", (f) => addPolygons(f.geometry, (rings) => data.buildings.push(rings))],
    ["water", (f) => addPolygons(f.geometry, (rings) => data.water.push(rings))],
    ["tree", (f) => {
      if (f.geometry.type !== "Point") return;
      const p = local(f.geometry.coordinates);
      if (near([p])) data.realTrees.push(p);
    }],
  ];
  for (const [sourceLayer, read] of readers) {
    const features = map.querySourceFeatures(dataSource, { sourceLayer });
    yield;
    for (let i = 0; i < features.length; i++) {
      read(features[i] as unknown as GeoJSON.Feature);
      if (i % 40 === 39) yield;
    }
  }
  return data;
}

function layerSpec(): ModelLayerSpecification {
  const rotation: unknown[] = ["match", ["get", "r"]];
  for (let i = 0; i < 8; i++) rotation.push(i, ["literal", [0, 0, i * 45]]);
  rotation.push(["literal", [0, 0, 0]]);
  const scale: unknown[] = ["match", ["get", "k"]];
  [0.85, 0.95, 1.05, 1.18].forEach((s, i) => scale.push(i, ["literal", [s, s, s]]));
  scale.push(["literal", [1, 1, 1]]);
  return {
    id: RIDE_TREES_LAYER, type: "model", source: RIDE_TREES_SRC, slot: "middle",
    layout: { "model-id": ["get", "m"] },
    paint: {
      "model-rotation": rotation as ExpressionSpecification,
      "model-scale": scale as ExpressionSpecification,
      "model-cutoff-fade-range": 0, "model-cast-shadows": false, "model-receive-shadows": false,
    },
  };
}

export type RideTreeController = { setActive(active: boolean): void; dispose(): void };

export function installRideTrees(
  map: MapboxMap,
  options: { dataSource: string; modelBaseUrl: string; getRoute: () => readonly XY[] | null },
): RideTreeController {
  let active = false;
  let timer: number | null = null;
  let job: Generator<void, RideTree[], void> | null = null;
  let jobTimer: number | null = null;
  let lastCenter: XY | null = null;
  let dirty = true;
  let origin: XY | null = null;
  let route: XY[] = [];
  let routeSource: readonly XY[] | null = null;
  const models = new Set<string>();

  const onData = (e: MapSourceDataEvent): void => {
    if (e.sourceId === options.dataSource && e.tile) dirty = true;
  };
  const stopJob = (): void => {
    if (jobTimer != null) window.clearTimeout(jobTimer);
    jobTimer = null;
    job = null;
  };
  /** 스타일이 다시 로드되면 소스·레이어·모델이 사라진다 — 매 점검에서 있으면 지나간다. */
  const ensure = (): boolean => {
    if (!map.getSource(options.dataSource)) return false;
    if (!map.getLayer(RIDE_TREE_DATA_LAYER)) {
      map.addLayer({ id: RIDE_TREE_DATA_LAYER, type: "fill", source: options.dataSource, "source-layer": "landuse", minzoom: 15, paint: { "fill-opacity": 0 } });
      dirty = true;
    }
    if (!map.getSource(RIDE_TREES_SRC)) {
      models.clear();
      lastCenter = null;
      map.addSource(RIDE_TREES_SRC, { type: "geojson", data: { type: "FeatureCollection", features: [] }, maxzoom: 15 });
    }
    for (const [kind, file] of Object.entries(MODEL_FILES)) {
      if (models.has(kind)) continue;
      map.addModel(MODEL_ID(kind), `${options.modelBaseUrl}${file}.glb`);
      models.add(kind);
    }
    if (!map.getLayer(RIDE_TREES_LAYER)) map.addLayer(layerSpec());
    return true;
  };
  function* compute(at: XY, from: XY): Generator<void, RideTree[], void> {
    const data = yield* collect(map, options.dataSource, from, at);
    return yield* placeRideTrees(data, at, route);
  }
  const runSlice = (): void => {
    jobTimer = null;
    if (!job || !active || !origin) return;
    try {
      const until = performance.now() + SLICE_MS;
      for (;;) {
        const step = job.next();
        if (step.done) {
          job = null;
          (map.getSource(RIDE_TREES_SRC) as GeoJSONSource | undefined)?.setData(rideTreesToGeoJson(step.value, origin));
          return;
        }
        if (performance.now() >= until) break;
      }
      jobTimer = window.setTimeout(runSlice, 16);
    } catch (err) {
      stopJob();
      console.warn("[rideTrees] 나무 배치를 건너뜁니다.", err);
    }
  };
  const check = (): void => {
    if (!active || document.hidden || job) return;
    try {
      if (!ensure()) return;
      const c = map.getCenter();
      const center: XY = [c.lng, c.lat];
      const nextOrigin = rideTreeOrigin(center);
      if (!origin || Math.hypot(...toRideTreeLocal(origin, center)) > 20_000) origin = nextOrigin;
      const at = toRideTreeLocal(origin, center);
      const source = options.getRoute();
      if (source !== routeSource) {
        routeSource = source;
        const from = origin;
        route = (source ?? []).map((p) => toRideTreeLocal(from, p));
        dirty = true;
      }
      const moved = lastCenter ? Math.hypot(at[0] - lastCenter[0], at[1] - lastCenter[1]) : Infinity;
      if (!dirty && moved < MOVE_M) return;
      dirty = false;
      lastCenter = at;
      job = compute(at, origin);
      runSlice();
    } catch (err) {
      stopJob();
      console.warn("[rideTrees] 준비 대기", err);
    }
  };
  const remove = (): void => {
    try {
      for (const id of [RIDE_TREES_LAYER, RIDE_TREE_DATA_LAYER]) if (map.getLayer(id)) map.removeLayer(id);
      if (map.getSource(RIDE_TREES_SRC)) map.removeSource(RIDE_TREES_SRC);
    } catch {
      /* 스타일 교체 중이면 함께 사라진다 */
    }
  };
  const stop = (): void => {
    active = false;
    if (timer != null) window.clearInterval(timer);
    timer = null;
    stopJob();
    map.off("sourcedata", onData);
  };
  return {
    setActive(next) {
      if (active === next) return;
      if (!next) {
        stop();
        remove();
        return;
      }
      active = true;
      origin = null;
      routeSource = null;
      lastCenter = null;
      dirty = true;
      map.on("sourcedata", onData);
      timer = window.setInterval(check, CHECK_MS);
      check();
    },
    dispose() {
      stop();
    },
  };
}

/** `?ridetrees=0` 이면 나무 없이 비교한다. */
export function rideTreesEnabled(search: string | null | undefined): boolean {
  return new URLSearchParams(search ?? "").get("ridetrees") !== "0";
}
