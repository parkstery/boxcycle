import type { GeoJSONSource, Map as MapboxMap } from "mapbox-gl";

/**
 * 상·하행을 두 줄로 그린 큰길의 가운데 메우기 (2026-11-26 Chief 채택: 원주 서원대로).
 *
 * 지도 자료가 왕복 도로를 일방통행 두 줄로 그리면 Mapbox 는 줄마다 좁은 길을 그려 가운데가 빈 땅으로
 * 남는다. 30m 안에서 나란히 마주 보는 두 줄 사이를 도로색으로 칠해 한 길로 보이게 한다.
 * 실제 중앙 화단이 있는 길도 칠해진다 — 자료로는 구별할 수 없다.
 */
export type XY = readonly [number, number];
export type FillLine = { pts: readonly XY[] };

const MAIN_ROADS: ReadonlySet<string> = new Set(["trunk", "primary", "secondary", "tertiary"]);
/** 가운데 나무를 빼는 기준(rideTreePlacement)과 같다. */
const PAIR_MAX_M = 30;
const PAIR_MIN_M = 2;
const STEP_M = 5;
/** 나란함 — 약 25° 안. */
const PARALLEL_COS = 0.9;
const CELL_M = 40;

type Segment = { a: XY; b: XY; ux: number; uy: number; line: number };

/** 한 줄을 따라 5m 마다, 마주 보는 짝 줄까지의 사각형을 만든다. 짝은 반대 방향으로 나란한 다른 줄이다. */
export function pairFillPolygons(lines: readonly FillLine[]): XY[][] {
  const cells = new Map<string, Segment[]>();
  const key = (cx: number, cy: number) => `${cx},${cy}`;
  lines.forEach((line, index) => {
    for (let i = 1; i < line.pts.length; i++) {
      const a = line.pts[i - 1], b = line.pts[i];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len <= 0) continue;
      const seg: Segment = { a, b, ux: (b[0] - a[0]) / len, uy: (b[1] - a[1]) / len, line: index };
      const x0 = Math.floor((Math.min(a[0], b[0]) - PAIR_MAX_M) / CELL_M), x1 = Math.floor((Math.max(a[0], b[0]) + PAIR_MAX_M) / CELL_M);
      const y0 = Math.floor((Math.min(a[1], b[1]) - PAIR_MAX_M) / CELL_M), y1 = Math.floor((Math.max(a[1], b[1]) + PAIR_MAX_M) / CELL_M);
      for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) {
        const k = key(cx, cy);
        const list = cells.get(k);
        if (list) list.push(seg);
        else cells.set(k, [seg]);
      }
    }
  });
  const partner = (p: XY, ux: number, uy: number, line: number): XY | null => {
    let best: XY | null = null, bestD = Infinity;
    for (const s of cells.get(key(Math.floor(p[0] / CELL_M), Math.floor(p[1] / CELL_M))) ?? []) {
      if (s.line === line || ux * s.ux + uy * s.uy > -PARALLEL_COS) continue;
      const dx = s.b[0] - s.a[0], dy = s.b[1] - s.a[1];
      const raw = ((p[0] - s.a[0]) * dx + (p[1] - s.a[1]) * dy) / (dx * dx + dy * dy);
      // 짝 줄이 끝난 너머는 짝이 아니다(끝점까지 비스듬히 잇지 않는다). 꺾인 점의 이음새는 허용.
      const len = Math.hypot(dx, dy);
      if ((raw < 0 && -raw * len > 1) || (raw > 1 && (raw - 1) * len > 1)) continue;
      const k = Math.max(0, Math.min(1, raw));
      const q: XY = [s.a[0] + k * dx, s.a[1] + k * dy];
      const d = Math.hypot(p[0] - q[0], p[1] - q[1]);
      if (d >= PAIR_MIN_M && d <= PAIR_MAX_M && d < bestD) {
        best = q;
        bestD = d;
      }
    }
    return best;
  };
  const out: XY[][] = [];
  lines.forEach((line, index) => {
    let prev: { p: XY; q: XY } | null = null;
    for (let i = 1; i < line.pts.length; i++) {
      const a = line.pts[i - 1], b = line.pts[i];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len <= 0) continue;
      const ux = (b[0] - a[0]) / len, uy = (b[1] - a[1]) / len;
      for (let d = i === 1 ? 0 : STEP_M - ((len % STEP_M) || STEP_M); d <= len; d += STEP_M) {
        const p: XY = [a[0] + ux * d, a[1] + uy * d];
        const q = partner(p, ux, uy, index);
        // 짝이 끊기거나 크게 건너뛰면(교차로 등) 사각형을 잇지 않는다.
        if (q && prev && Math.hypot(q[0] - prev.q[0], q[1] - prev.q[1]) <= STEP_M * 2 + 2) out.push([prev.p, p, q, prev.q, prev.p]);
        prev = q ? { p, q } : null;
      }
    }
  });
  return out;
}

const RIDE_ROAD_FILL_LAYER = "boxcycle-ride-road-fill";
const RIDE_ROAD_FILL_SRC = "boxcycle-ride-road-fill-src";
/** Standard 의 도로면(road-secondary-tertiary-polygon-fill) 기본값과 같다 — colorRoads·roadsBrightness. */
const ROAD_COLOR = "hsl(224, 25%, 80%)";
const ROAD_EMISSIVE = 0.4;
const CHECK_MS = 1000;
const MOVE_M = 60;
const EARTH_R = 6378137;
const RAD = Math.PI / 180;

export type RideRoadFillController = { setActive(active: boolean): void; setEnabled(on: boolean): void; dispose(): void };

export function installRideRoadFill(map: MapboxMap, options: { dataSource: string }): RideRoadFillController {
  let active = false, enabled = false;
  let timer: number | null = null;
  let last: [number, number] | null = null;
  let dirty = true;
  const onData = (e: { sourceId?: string; tile?: unknown }) => {
    if (e.sourceId === options.dataSource && e.tile) dirty = true;
  };
  const remove = (): void => {
    try {
      if (map.getLayer(RIDE_ROAD_FILL_LAYER)) map.removeLayer(RIDE_ROAD_FILL_LAYER);
      if (map.getSource(RIDE_ROAD_FILL_SRC)) map.removeSource(RIDE_ROAD_FILL_SRC);
    } catch {
      /* 스타일 교체 중이면 함께 사라진다 */
    }
    last = null;
    dirty = true;
  };
  const check = (): void => {
    if (!active || !enabled || document.hidden) return;
    try {
      if (!map.getSource(options.dataSource)) return;
      const c = map.getCenter();
      const here: [number, number] = [c.lng, c.lat];
      const moved = last ? Math.hypot((here[0] - last[0]) * RAD * EARTH_R * Math.cos(here[1] * RAD), (here[1] - last[1]) * RAD * EARTH_R) : Infinity;
      if (!dirty && moved < MOVE_M && map.getLayer(RIDE_ROAD_FILL_LAYER)) return;
      dirty = false;
      last = here;
      const toLocal = (p: GeoJSON.Position): XY => [(p[0] - here[0]) * RAD * EARTH_R * Math.cos(here[1] * RAD), (p[1] - here[1]) * RAD * EARTH_R];
      const toLngLat = (p: XY): [number, number] => [here[0] + p[0] / (EARTH_R * Math.cos(here[1] * RAD)) / RAD, here[1] + p[1] / EARTH_R / RAD];
      const lines: FillLine[] = [];
      for (const f of map.querySourceFeatures(options.dataSource, { sourceLayer: "road" })) {
        const props = f.properties ?? {};
        if (props.oneway !== "true" || !MAIN_ROADS.has(String(props.class)) || (props.structure ?? "none") !== "none") continue;
        const g = f.geometry;
        const parts = g.type === "LineString" ? [g.coordinates] : g.type === "MultiLineString" ? g.coordinates : [];
        for (const part of parts) lines.push({ pts: part.map(toLocal) });
      }
      const data: GeoJSON.FeatureCollection = {
        type: "FeatureCollection",
        features: pairFillPolygons(lines).map((ring) => ({ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [ring.map(toLngLat)] } })),
      };
      const source = map.getSource(RIDE_ROAD_FILL_SRC) as GeoJSONSource | undefined;
      if (source) source.setData(data);
      else map.addSource(RIDE_ROAD_FILL_SRC, { type: "geojson", data, maxzoom: 16 });
      if (!map.getLayer(RIDE_ROAD_FILL_LAYER)) {
        // bottom 층 = 땅·녹지 위, Standard 도로 아래. 도로 가장자리는 Standard 도로가 덮는다.
        map.addLayer({
          id: RIDE_ROAD_FILL_LAYER, type: "fill", source: RIDE_ROAD_FILL_SRC, slot: "bottom",
          paint: { "fill-color": ROAD_COLOR, "fill-emissive-strength": ROAD_EMISSIVE, "fill-antialias": false },
        });
      }
    } catch (err) {
      console.warn("[rideRoadFill] 준비 대기", err);
    }
  };
  const sync = (): void => {
    const run = active && enabled;
    if (run && timer == null) {
      map.on("sourcedata", onData);
      timer = window.setInterval(check, CHECK_MS);
      check();
    } else if (!run && timer != null) {
      window.clearInterval(timer);
      timer = null;
      map.off("sourcedata", onData);
      remove();
    }
  };
  return {
    setActive(next) {
      active = next;
      sync();
    },
    setEnabled(on) {
      enabled = on;
      sync();
    },
    dispose() {
      active = false;
      sync();
    },
  };
}
