/**
 * 미니맵 등축 투영 — SVG 경로용 순수 함수.
 * 가로·세로 배율은 min 하나, 경도에는 cos(중심위도) 보정.
 */
import {
  boundsFromLineCoordinates,
  type LineStringGeometry,
  type LngLat,
} from "../../lib/geo/geo";

export const ROUTE_MINIMAP_PAD_PX = 6;
export const ROUTE_MINIMAP_MAX_COORDS = 1000;

export type MinimapPoint = { x: number; y: number };

export type RouteMinimapProjection = {
  pathD: string;
  start: MinimapPoint;
  end: MinimapPoint;
  project: (lngLat: LngLat) => MinimapPoint;
  /** 투영 공간 bbox 가로/세로 (경도 cos 보정 후) */
  bboxAspect: number;
  /** 그려진 경로 외접 상자 가로/세로 (SVG px) */
  drawnAspect: number;
  scale: number;
  coordCountOriginal: number;
  coordCountSampled: number;
};

function sampleCoords(coords: readonly LngLat[], maxCount: number): LngLat[] {
  const n = coords.length;
  if (n <= maxCount) return coords.slice() as LngLat[];
  const out: LngLat[] = [];
  const last = n - 1;
  for (let i = 0; i < maxCount; i++) {
    const idx = i === maxCount - 1 ? last : Math.round((i * last) / (maxCount - 1));
    out.push(coords[idx]!);
  }
  return out;
}

/**
 * @returns null — 좌표 없음. 축퇴(한 점)여도 NaN 없이 중앙 점 투영을 반환한다.
 */
export function projectRouteMinimap(
  geometry: LineStringGeometry,
  width: number,
  height: number,
  padPx: number = ROUTE_MINIMAP_PAD_PX,
): RouteMinimapProjection | null {
  const original = geometry.coordinates as LngLat[];
  if (!original.length || !(width > 0) || !(height > 0)) return null;

  const sampled = sampleCoords(original, ROUTE_MINIMAP_MAX_COORDS);
  const bounds = boundsFromLineCoordinates(sampled as [number, number][]);
  const midLat = (bounds.minLat + bounds.maxLat) / 2;
  const cosLat = Math.cos((midLat * Math.PI) / 180);
  const cos = Number.isFinite(cosLat) && Math.abs(cosLat) > 1e-6 ? cosLat : 1e-6;

  const x0 = bounds.minLng * cos;
  const x1 = bounds.maxLng * cos;
  const y0 = bounds.minLat;
  const y1 = bounds.maxLat;
  let dx = x1 - x0;
  let dy = y1 - y0;

  const innerW = Math.max(1, width - 2 * padPx);
  const innerH = Math.max(1, height - 2 * padPx);

  const EPS = 1e-12;
  const degenerate = dx < EPS && dy < EPS;
  if (dx < EPS) dx = EPS;
  if (dy < EPS) dy = EPS;

  const scale = Math.min(innerW / dx, innerH / dy);
  const usedW = dx * scale;
  const usedH = dy * scale;
  const ox = padPx + (innerW - usedW) / 2;
  const oy = padPx + (innerH - usedH) / 2;

  const project = (lngLat: LngLat): MinimapPoint => {
    if (degenerate) {
      return { x: width / 2, y: height / 2 };
    }
    const [lng, lat] = lngLat;
    return {
      x: ox + (lng * cos - x0) * scale,
      y: oy + (y1 - lat) * scale,
    };
  };

  const pts = sampled.map(project);
  const pathD =
    pts.length === 1
      ? `M ${pts[0]!.x} ${pts[0]!.y}`
      : pts
          .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
          .join(" ");

  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const drawnW = Math.max(...xs) - Math.min(...xs);
  const drawnH = Math.max(...ys) - Math.min(...ys);

  return {
    pathD,
    start: pts[0]!,
    end: pts[pts.length - 1]!,
    project,
    bboxAspect: dx / dy,
    drawnAspect: drawnH > EPS ? drawnW / drawnH : 1,
    scale,
    coordCountOriginal: original.length,
    coordCountSampled: sampled.length,
  };
}

/** 점과 폴리라인(샘플 SVG 점) 사이 최근접 거리 — 진척 검산용 */
export function distancePointToPolylinePx(point: MinimapPoint, poly: readonly MinimapPoint[]): number {
  if (poly.length === 0) return Number.POSITIVE_INFINITY;
  if (poly.length === 1) {
    const p = poly[0]!;
    return Math.hypot(point.x - p.x, point.y - p.y);
  }
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i < poly.length - 1; i++) {
    const a = poly[i]!;
    const b = poly[i + 1]!;
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const len2 = abx * abx + aby * aby;
    let t = len2 < 1e-12 ? 0 : ((point.x - a.x) * abx + (point.y - a.y) * aby) / len2;
    t = Math.max(0, Math.min(1, t));
    const cx = a.x + abx * t;
    const cy = a.y + aby * t;
    best = Math.min(best, Math.hypot(point.x - cx, point.y - cy));
  }
  return best;
}

/** 지시03·04 — 미니맵 상자 = 화면 종횡비. 폭 비율은 Chief 실기 70% 축소 */
export const MINIMAP_WIDTH_RATIO = 0.294; // 0.42 × 0.7 (2026-09-23 Chief 실기 판단)

export function computeRouteMinimapSize(
  viewportW: number,
  viewportH: number,
  availH: number,
): { width: number; height: number; aspect: number } {
  const A = viewportW / Math.max(viewportH, 1);
  const width = Math.min(MINIMAP_WIDTH_RATIO * viewportW, Math.max(0, availH) * A);
  const height = width / A;
  return { width, height, aspect: A };
}
