/**
 * 주행 가상 가로수·숲의 위치 계산 — 순수 함수 (2026-11-24 Chief: 각진 나무 · 여유).
 *
 * 좌표는 주행 원점 기준 미터(동 +x, 북 +y). 후보를 원점 격자에서 뽑으므로 어느 중심에서 계산해도
 * 같은 나무는 같은 자리에 선다. 오래 걸릴 수 있어 generator 로 잘라 돌린다.
 */
export type XY = readonly [number, number];
export type Ring = readonly XY[];

type RideTreeRoad = { cls: string; elevated: boolean; pts: readonly XY[] };
export type RideTreeData = {
  roads: RideTreeRoad[];
  greens: Array<{ cls: string; rings: readonly Ring[] }>;
  buildings: Array<readonly Ring[]>;
  water: Array<readonly Ring[]>;
  realTrees: XY[];
};
type RideTreeKind = "broad" | "tall" | "conifer" | "shrub";
export type RideTree = { x: number; y: number; kind: RideTreeKind; rotation: number; size: number };

export const RIDE_TREE_RADIUS_M = 450;
/** 여유 배치 — 시안 ①. */
const MAX_TREES = 900;
const ROUTE_SPACING_M = 20;
const ROADSIDE_CHANCE = 0.25;
const GREEN_SCALE = 0.45;
const CELL_M = 6.5;
const REAL_TREE_GAP_M = 6;
/** 경로선과 카메라~라이더 시선에서 비울 폭. 침엽수 잎 반지름(2.4m)보다 넓다. */
const ROUTE_GAP_M = 3.4;
const SIGHT_GAP_M = 2.8;
/** 카메라 2·3 실측 중심 거리 13.5m 에 여유를 더한 값. */
const CAMERA_BACK_M = 15;

export const RIDE_TREE_ROAD_WIDTH_M: Readonly<Record<string, number>> = {
  motorway: 16, motorway_link: 8, trunk: 14, trunk_link: 8, primary: 12, primary_link: 7, secondary: 10, secondary_link: 6,
  tertiary: 8, tertiary_link: 6, street: 6.5, street_limited: 6, service: 4, track: 3, path: 2.8, pedestrian: 4,
};
const ROADSIDE: ReadonlySet<string> = new Set(["primary", "secondary", "tertiary", "street", "street_limited", "pedestrian", "path"]);
/** 녹지 종류별 밀도(그루/m²). */
const GREEN_DENSITY: Readonly<Record<string, number>> = { wood: 1 / 45, scrub: 1 / 160, park: 1 / 170, cemetery: 1 / 260, grass: 1 / 420 };

function treeHash(a: number, b: number, salt: number): number {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(salt | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function segmentDistance(x: number, y: number, a: XY, b: XY): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l = dx * dx + dy * dy;
  const t = l > 0 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / l)) : 0;
  return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy);
}

function inRing(x: number, y: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function inPolygon(x: number, y: number, rings: readonly Ring[]): boolean {
  return inRing(x, y, rings[0]) && !rings.slice(1).some((hole) => inRing(x, y, hole));
}

type Box = readonly [number, number, number, number];
function boxOf(points: readonly XY[], pad: number): Box {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of points) {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  }
  return [x0 - pad, y0 - pad, x1 + pad, y1 + pad];
}

/** 계산 범위 안만 담는 격자 색인 — 큰 물·숲 다각형이 색인을 부풀리지 않게 자른다. */
class Grid<T> {
  private readonly cells = new Map<number, T[]>();
  private readonly size: number;
  private readonly clip: Box;
  constructor(size: number, clip: Box) {
    this.size = size;
    this.clip = clip;
  }
  private key(cx: number, cy: number): number {
    return (cx + 1_000_000) * 4_000_000 + (cy + 1_000_000);
  }
  add(box: Box, item: T): void {
    const x0 = Math.floor(Math.max(box[0], this.clip[0]) / this.size);
    const x1 = Math.floor(Math.min(box[2], this.clip[2]) / this.size);
    const y0 = Math.floor(Math.max(box[1], this.clip[1]) / this.size);
    const y1 = Math.floor(Math.min(box[3], this.clip[3]) / this.size);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const k = this.key(cx, cy);
        const list = this.cells.get(k);
        if (list) list.push(item);
        else this.cells.set(k, [item]);
      }
    }
  }
  at(x: number, y: number): readonly T[] {
    return this.cells.get(this.key(Math.floor(x / this.size), Math.floor(y / this.size))) ?? [];
  }
}

type RoadSegment = { a: XY; b: XY; width: number; road: RideTreeRoad };
type Keepout = { a: XY; b: XY; gap: number };

function kindFor(place: "street" | "wood" | "green" | "scrub", roll: number): RideTreeKind {
  if (place === "scrub") return "shrub";
  if (place === "street") return roll < 0.72 ? "broad" : "tall";
  if (place === "wood") return roll < 0.5 ? "broad" : roll < 0.85 ? "conifer" : "tall";
  return roll < 0.7 ? "broad" : roll < 0.85 ? "tall" : "conifer";
}

/** 반환값이 최종 결과. `next()` 를 조각 시간마다 불러 메인 스레드를 오래 막지 않는다. */
export function* placeRideTrees(data: RideTreeData, center: XY, route: readonly XY[]): Generator<void, RideTree[], void> {
  const R = RIDE_TREE_RADIUS_M;
  const clip: Box = [center[0] - R - 30, center[1] - R - 30, center[0] + R + 30, center[1] + R + 30];
  const roads = new Grid<RoadSegment>(40, clip);
  const solids = new Grid<readonly Ring[]>(40, clip);
  const greens = new Grid<{ cls: string; rings: readonly Ring[] }>(40, clip);
  const real = new Grid<XY>(20, clip);
  const keepouts = new Grid<Keepout>(30, clip);

  for (const road of data.roads) {
    const width = RIDE_TREE_ROAD_WIDTH_M[road.cls];
    if (!width) continue;
    for (let i = 1; i < road.pts.length; i++) {
      const a = road.pts[i - 1];
      const b = road.pts[i];
      roads.add(boxOf([a, b], 12), { a, b, width, road });
    }
  }
  yield;
  for (const rings of data.buildings) if (rings[0]?.length) solids.add(boxOf(rings[0], 2), rings);
  for (const rings of data.water) if (rings[0]?.length) solids.add(boxOf(rings[0], 2), rings);
  for (const green of data.greens) if (GREEN_DENSITY[green.cls] && green.rings[0]?.length) greens.add(boxOf(green.rings[0], 0), green);
  for (const p of data.realTrees) real.add(boxOf([p], REAL_TREE_GAP_M), p);
  yield;

  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1];
    const b = route[i];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len <= 0) continue;
    keepouts.add(boxOf([a, b], ROUTE_GAP_M), { a, b, gap: ROUTE_GAP_M });
    // 굽은 길에서는 카메라가 길 안쪽을 지난다 — 라이더 뒤 시선을 5m 마다 비운다.
    const ux = (b[0] - a[0]) / len;
    const uy = (b[1] - a[1]) / len;
    for (let d = 0; d <= len; d += 5) {
      const rider: XY = [a[0] + ux * d, a[1] + uy * d];
      const camera: XY = [rider[0] - ux * CAMERA_BACK_M, rider[1] - uy * CAMERA_BACK_M];
      keepouts.add(boxOf([rider, camera], SIGHT_GAP_M), { a: camera, b: rider, gap: SIGHT_GAP_M });
    }
  }
  yield;

  const blocked = (x: number, y: number, roadGap: number): boolean => {
    for (const s of roads.at(x, y)) if (segmentDistance(x, y, s.a, s.b) < s.width / 2 + roadGap) return true;
    for (const rings of solids.at(x, y)) if (inPolygon(x, y, rings)) return true;
    for (const p of real.at(x, y)) if (Math.hypot(p[0] - x, p[1] - y) < REAL_TREE_GAP_M) return true;
    for (const k of keepouts.at(x, y)) if (segmentDistance(x, y, k.a, k.b) < k.gap) return true;
    return false;
  };
  const trees: RideTree[] = [];
  const push = (x: number, y: number, kind: RideTreeKind, roll: number): void => {
    trees.push({ x, y, kind, rotation: Math.floor(roll * 8) % 8, size: Math.floor(roll * 64) % 4 });
  };
  const inRange = (x: number, y: number): boolean => Math.hypot(x - center[0], y - center[1]) <= R;

  // 1) 경로 가로수 — 경로 시작부터 센 일정 간격이라 중심이 달라도 같은 자리.
  let travelled = 0;
  let nextAt = ROUTE_SPACING_M;
  let index = 0;
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1];
    const b = route[i];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len <= 0) continue;
    const ux = (b[0] - a[0]) / len;
    const uy = (b[1] - a[1]) / len;
    for (; nextAt <= travelled + len; nextAt += ROUTE_SPACING_M, index++) {
      const d = nextAt - travelled;
      const bx = a[0] + ux * d;
      const by = a[1] + uy * d;
      if (!inRange(bx, by)) continue;
      let width = 4;
      let elevated = false;
      for (const s of roads.at(bx, by)) {
        if (segmentDistance(bx, by, s.a, s.b) > 5) continue;
        width = Math.max(width, s.width);
        if (s.road.elevated) elevated = true;
      }
      if (elevated) continue;
      for (const side of [-1, 1]) {
        const along = (treeHash(index, side, 7) - 0.5) * 3;
        const off = width / 2 + 2.6 + treeHash(index, side, 9) * 0.8;
        const x = bx + ux * along - uy * off * side;
        const y = by + uy * along + ux * off * side;
        const roll = treeHash(index, side, 11);
        if (!blocked(x, y, 1.1)) push(x, y, kindFor("street", roll), roll);
      }
    }
    travelled += len;
    if (i % 60 === 0) yield;
  }

  // 2) 도로변 · 3) 숲과 공원 — 원점 격자 후보.
  const gx0 = Math.floor((center[0] - R) / CELL_M);
  const gx1 = Math.ceil((center[0] + R) / CELL_M);
  const gy0 = Math.floor((center[1] - R) / CELL_M);
  const gy1 = Math.ceil((center[1] + R) / CELL_M);
  for (let gx = gx0; gx <= gx1; gx++) {
    for (let gy = gy0; gy <= gy1; gy++) {
      const x = (gx + 0.15 + treeHash(gx, gy, 1) * 0.7) * CELL_M;
      const y = (gy + 0.15 + treeHash(gx, gy, 2) * 0.7) * CELL_M;
      if (!inRange(x, y)) continue;
      const roll = treeHash(gx, gy, 3);
      let density = 0;
      let place: "street" | "wood" | "green" | "scrub" = "green";
      for (const g of greens.at(x, y)) {
        const d = GREEN_DENSITY[g.cls];
        if (d <= density || !inPolygon(x, y, g.rings)) continue;
        density = d;
        place = g.cls === "wood" ? "wood" : g.cls === "scrub" ? "scrub" : "green";
      }
      if (roll >= density * CELL_M * CELL_M * GREEN_SCALE) {
        if (roll >= ROADSIDE_CHANCE) continue;
        let roadside = false;
        for (const s of roads.at(x, y)) {
          if (s.road.elevated || !ROADSIDE.has(s.road.cls)) continue;
          const d = segmentDistance(x, y, s.a, s.b) - s.width / 2;
          if (d > 1.6 && d < 4.2) roadside = true;
        }
        if (!roadside) continue;
        place = "street";
      }
      const pick = treeHash(gx, gy, 4);
      if (!blocked(x, y, place === "street" ? 1.4 : 2.2)) push(x, y, kindFor(place, pick), pick);
    }
    yield;
  }
  const d2 = (t: RideTree): number => (t.x - center[0]) ** 2 + (t.y - center[1]) ** 2;
  return trees.sort((p, q) => d2(p) - d2(q)).slice(0, MAX_TREES);
}
