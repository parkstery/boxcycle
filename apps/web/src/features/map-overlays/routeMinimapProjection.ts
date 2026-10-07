/**
 * 미니맵 투영 — **Web Mercator**(Mapbox 타일과 같은 투영). 배경 정지 지도와 SVG 경로가 겹치게
 * 이미지 요청과 SVG 가 **같은 center·zoom** 을 쓴다(2026-10-07, 보류01).
 *
 * 전에는 cos(위도) 보정 등거리 근사였다 — 지도 없이 선만 그릴 땐 충분했지만
 * Mapbox 이미지 위에 얹으면 위도 37°·수 km 에서 수 px 미끄러진다.
 */
import {
  boundsFromLineCoordinates,
  type LineStringGeometry,
  type LngLat,
} from "../../lib/geo/geo";

export const ROUTE_MINIMAP_PAD_PX = 6;
/** 위쪽 여백 — 종점 깃발(높이 ~13px)이 상자 위로 잘리지 않게 */
export const ROUTE_MINIMAP_PAD_TOP_PX = 16;
export const ROUTE_MINIMAP_MAX_COORDS = 1000;
/** Mapbox GL·Static Images 의 세계 한 변 픽셀(zoom 0) */
const MERCATOR_TILE_PX = 512;
/** 한 점·아주 짧은 경로가 끝없이 확대되지 않게 */
export const ROUTE_MINIMAP_MAX_ZOOM = 17;
const MERCATOR_MAX_LAT = 85.0511;

export type MinimapPoint = { x: number; y: number };

export type RouteMinimapProjection = {
  pathD: string;
  start: MinimapPoint;
  end: MinimapPoint;
  project: (lngLat: LngLat) => MinimapPoint;
  /** 정지 지도 요청과 SVG 가 공유하는 중심 — 소수 6자리로 반올림된 값(요청 URL 과 같다) */
  center: LngLat;
  /** 같은 이유로 소수 2자리 내림 — 경로가 상자 밖으로 나가지 않게 내림 */
  zoom: number;
  /** 투영 공간 bbox 가로/세로 (Mercator) */
  bboxAspect: number;
  /** 그려진 경로 외접 상자 가로/세로 (SVG px) */
  drawnAspect: number;
  /** Mercator 단위(세계=1) → px 배율 = 512·2^zoom */
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

/** 경위도 → Web Mercator 정규 좌표(세계 = 0..1, y 는 아래로 증가) */
export function mercatorXY(lngLat: LngLat): { x: number; y: number } {
  const [lng, lat] = lngLat;
  const clamped = Math.max(-MERCATOR_MAX_LAT, Math.min(MERCATOR_MAX_LAT, lat));
  const phi = (clamped * Math.PI) / 180;
  return {
    x: (lng + 180) / 360,
    y: (1 - Math.log(Math.tan(phi) + 1 / Math.cos(phi)) / Math.PI) / 2,
  };
}

function mercatorToLngLat(x: number, y: number): LngLat {
  const lng = x * 360 - 180;
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180) / Math.PI;
  return [lng, lat];
}

/**
 * @returns null — 좌표 없음. 축퇴(한 점)여도 NaN 없이 중앙 점 투영을 반환한다.
 */
export function projectRouteMinimap(
  geometry: LineStringGeometry,
  width: number,
  height: number,
  padPx: number = ROUTE_MINIMAP_PAD_PX,
  padTopPx: number = padPx,
): RouteMinimapProjection | null {
  const original = geometry.coordinates as LngLat[];
  if (!original.length || !(width > 0) || !(height > 0)) return null;

  const sampled = sampleCoords(original, ROUTE_MINIMAP_MAX_COORDS);
  const bounds = boundsFromLineCoordinates(sampled as [number, number][]);
  const nw = mercatorXY([bounds.minLng, bounds.maxLat]);
  const se = mercatorXY([bounds.maxLng, bounds.minLat]);
  const EPS = 1e-12;
  const dx = Math.max(EPS, se.x - nw.x);
  const dy = Math.max(EPS, se.y - nw.y);

  const innerW = Math.max(1, width - 2 * padPx);
  const innerH = Math.max(1, height - padTopPx - padPx);

  // 이미지 URL 에 들어갈 값으로 먼저 반올림하고, SVG 도 그 값으로 투영한다 — 둘이 따로 놀지 않게.
  const zoomFit = Math.log2(Math.min(innerW / (MERCATOR_TILE_PX * dx), innerH / (MERCATOR_TILE_PX * dy)));
  const zoom = Math.max(0, Math.min(ROUTE_MINIMAP_MAX_ZOOM, Math.floor(zoomFit * 100) / 100));
  const scale = MERCATOR_TILE_PX * 2 ** zoom;
  // 위아래 여백이 다르면 bbox 중심을 상자 중심보다 (padTop − pad)/2 만큼 아래에 그린다 —
  // 이미지 중심(= 상자 중심)은 그만큼 위로 옮긴다.
  const centerRaw = mercatorToLngLat(
    (nw.x + se.x) / 2,
    (nw.y + se.y) / 2 - (padTopPx - padPx) / 2 / scale,
  );
  const center: LngLat = [
    Math.round(centerRaw[0] * 1e6) / 1e6,
    Math.round(centerRaw[1] * 1e6) / 1e6,
  ];
  const c = mercatorXY(center);

  const project = (lngLat: LngLat): MinimapPoint => {
    const m = mercatorXY(lngLat);
    return {
      x: (m.x - c.x) * scale + width / 2,
      y: (m.y - c.y) * scale + height / 2,
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
    center,
    zoom,
    bboxAspect: dx / dy,
    drawnAspect: drawnH > EPS ? drawnW / drawnH : 1,
    scale,
    coordCountOriginal: original.length,
    coordCountSampled: sampled.length,
  };
}

/**
 * 미니맵 배경 정지 지도(Mapbox Static Images API) URL — 주행 하나에 한 장.
 * 경로 bbox 는 주행 동안 변하지 않으므로 호출부가 useMemo 로 고정하면 재요청이 없다.
 *
 * 스타일은 Outdoors 고정(2026-10-07 chief) — 위성은 이만한 크기로 줄이면 경로가 묻힌다.
 * `logo=false&attribution=false` 는 같은 화면의 메인 지도가 이미 Mapbox·OSM 저작자 표시를
 * 하고 있어서 허용된다(미니맵은 그 지도 위에 얹힌 보조 그림이다).
 */
export const ROUTE_MINIMAP_STATIC_STYLE = "mapbox/outdoors-v12";
/** Static Images API 의 한 변 상한(논리 px) */
const STATIC_MAX_SIDE_PX = 1280;

export function routeMinimapStaticImageUrl(
  layout: Pick<RouteMinimapProjection, "center" | "zoom">,
  width: number,
  height: number,
  accessToken: string,
  style: string = ROUTE_MINIMAP_STATIC_STYLE,
): string | null {
  const token = accessToken.trim();
  const w = Math.round(width);
  const h = Math.round(height);
  if (!token || w < 1 || h < 1 || w > STATIC_MAX_SIDE_PX || h > STATIC_MAX_SIDE_PX) return null;
  const [lng, lat] = layout.center;
  return (
    `https://api.mapbox.com/styles/v1/${style}/static/` +
    `${lng},${lat},${layout.zoom},0,0/${w}x${h}@2x` +
    `?access_token=${encodeURIComponent(token)}&attribution=false&logo=false`
  );
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
