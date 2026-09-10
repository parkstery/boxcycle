/**
 * RIDE-CLAIM-RESULT-1: 세션 궤적 SVG 미리보기용 순수 수학 모듈.
 *
 * - 추가 Mapbox 인스턴스 없이 lng/lat → SVG 좌표 투영
 * - 북쪽 위, 경위도 종횡비 보정, 여백 fit
 * - 날짜변경선 횡단, 수직/수평·짧은 선·빈 좌표·비정상 좌표 처리
 * - 기존 내 도로망 traces 를 세션 bounds 로 클리핑
 * - 총 렌더 점 수 ≤ 5000
 */

import type { LngLat } from "./geo";

export type SessionPreviewPaths = {
  /** SVG viewBox 크기 */
  width: number;
  height: number;
  /** 이번 세션 궤적 path d 문자열 */
  sessionPath: string;
  /** 주변 기존 도로망 path d 문자열들 */
  tracePaths: string[];
};

/** 날짜변경선 횡단 보정: 연속 lng 사이 차이가 180° 초과면 shift 적용 */
function unwrapLngs(coords: LngLat[]): number[][] {
  if (coords.length === 0) return [];
  const result: number[][] = [[coords[0][0], coords[0][1]]];
  for (let i = 1; i < coords.length; i++) {
    const prevLng = result[i - 1][0];
    let lng = coords[i][0];
    const diff = lng - prevLng;
    if (diff > 180) lng -= 360;
    else if (diff < -180) lng += 360;
    result.push([lng, coords[i][1]]);
  }
  return result;
}

/** 유효 좌표 필터 */
function isValidLngLat(lng: number, lat: number): boolean {
  return (
    Number.isFinite(lng) &&
    Number.isFinite(lat) &&
    lng >= -360 &&
    lng <= 360 &&
    lat >= -90 &&
    lat <= 90
  );
}

/**
 * 점 배열을 간단한 Douglas-Peucker 없이 균등 간격 decimation.
 * maxPoints 이하로 줄인다.
 */
function decimateEvenly<T>(arr: T[], maxPoints: number): T[] {
  if (arr.length <= maxPoints) return arr;
  const step = arr.length / maxPoints;
  const result: T[] = [];
  for (let i = 0; i < maxPoints; i++) {
    result.push(arr[Math.round(i * step)]);
  }
  // 마지막 점 유지
  const last = arr[arr.length - 1];
  if (result[result.length - 1] !== last) result.push(last);
  return result;
}

/** bounds 계산 */
function calcBounds(points: number[][]): { minLng: number; maxLng: number; minLat: number; maxLat: number } | null {
  if (points.length === 0) return null;
  let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const [lng, lat] of points) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return { minLng, maxLng, minLat, maxLat };
}

/** Mercator Y 보정 없이 단순 lng/lat→pixel (종횡비 보정 포함) */
function projectPoints(
  points: number[][],
  minLng: number,
  maxLng: number,
  minLat: number,
  maxLat: number,
  svgW: number,
  svgH: number,
  padding: number,
  cosLat: number,
): Array<[number, number]> {
  const lngSpan = maxLng - minLng || 1e-9;
  const latSpan = maxLat - minLat || 1e-9;
  const drawW = svgW - padding * 2;
  const drawH = svgH - padding * 2;

  // 종횡비 보정: lng 축은 cos(lat) 비율만큼 수축
  const lngScale = drawW / (lngSpan * cosLat);
  const latScale = drawH / latSpan;
  const scale = Math.min(lngScale, latScale);

  const offsetX = padding + (drawW - lngSpan * cosLat * scale) / 2;
  const offsetY = padding + (drawH - latSpan * scale) / 2;

  return points.map(([lng, lat]) => {
    const x = offsetX + (lng - minLng) * cosLat * scale;
    // SVG Y 는 아래로 증가 → lat 는 위로 증가 → 반전
    const y = offsetY + (maxLat - lat) * scale;
    return [x, y];
  });
}

function toPathD(pts: Array<[number, number]>): string {
  if (pts.length < 2) return "";
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    d += ` L${pts[i][0].toFixed(1)},${pts[i][1].toFixed(1)}`;
  }
  return d;
}

/** LineStringGeometry or LngLat[] → LngLat[] */
type AnyGeometry = { type: string; coordinates: number[][] } | LngLat[];

function extractLngLats(g: AnyGeometry): LngLat[] {
  if (Array.isArray(g)) return g as LngLat[];
  return g.coordinates as LngLat[];
}

export const SESSION_PREVIEW_SVG_W = 280;
export const SESSION_PREVIEW_SVG_H = 180;
export const SESSION_PREVIEW_PADDING = 12;
/** 총 렌더 점 수 상한 */
export const SESSION_PREVIEW_MAX_POINTS = 5000;

/**
 * 세션 궤적 + 주변 도로망 traces 를 SVG 경로로 변환한다.
 *
 * @param sessionPath 세션 궤적 LngLat[] (종료 시 고정값)
 * @param traceGeometries 이미 로드된 내 도로망 geometries (LineStringGeometry[] 또는 null)
 * @returns SessionPreviewPaths 또는 null (폴백 텍스트 필요)
 */
export function buildSessionPreviewPaths(
  sessionPath: LngLat[] | null | undefined,
  traceGeometries: AnyGeometry[] | null | undefined,
): SessionPreviewPaths | null {
  if (!sessionPath || sessionPath.length < 2) return null;

  // 유효 좌표만 필터
  const validSession = sessionPath.filter(([lng, lat]) => isValidLngLat(lng, lat));
  if (validSession.length < 2) return null;

  // 날짜변경선 보정
  const unwrapped = unwrapLngs(validSession);
  const bounds = calcBounds(unwrapped);
  if (!bounds) return null;

  const { minLng, maxLng, minLat, maxLat } = bounds;

  // 날짜변경선 횡단 체크 (lng range > 180 → 비정상, 폴백)
  if (maxLng - minLng > 180 || maxLat - minLat > 90) return null;

  const cosLat = Math.cos(((minLat + maxLat) / 2) * (Math.PI / 180));

  // bounds 를 약간 확장 (zero-size 방지)
  const expandedBounds = {
    minLng: minLng - (maxLng - minLng) * 0.1 - 1e-6,
    maxLng: maxLng + (maxLng - minLng) * 0.1 + 1e-6,
    minLat: minLat - (maxLat - minLat) * 0.1 - 1e-6,
    maxLat: maxLat + (maxLat - minLat) * 0.1 + 1e-6,
  };

  const W = SESSION_PREVIEW_SVG_W;
  const H = SESSION_PREVIEW_SVG_H;
  const PAD = SESSION_PREVIEW_PADDING;

  const sessionProjected = projectPoints(
    unwrapped,
    expandedBounds.minLng,
    expandedBounds.maxLng,
    expandedBounds.minLat,
    expandedBounds.maxLat,
    W,
    H,
    PAD,
    cosLat,
  );

  const sessionPathD = toPathD(sessionProjected);
  if (!sessionPathD) return null;

  // traces 클리핑 + 투영
  const tracePaths: string[] = [];
  let usedPoints = unwrapped.length;

  if (traceGeometries && traceGeometries.length > 0) {
    for (const g of traceGeometries) {
      if (usedPoints >= SESSION_PREVIEW_MAX_POINTS) break;

      const lngLats = extractLngLats(g);
      if (!lngLats || lngLats.length < 2) continue;

      // 세션 bounds 에 포함되는 점만 클리핑
      const clipped = lngLats.filter(([lng, lat]) => {
        const unwrappedLng = lng;
        return (
          isValidLngLat(lng, lat) &&
          unwrappedLng >= expandedBounds.minLng &&
          unwrappedLng <= expandedBounds.maxLng &&
          lat >= expandedBounds.minLat &&
          lat <= expandedBounds.maxLat
        );
      });

      if (clipped.length < 2) continue;

      const remaining = SESSION_PREVIEW_MAX_POINTS - usedPoints;
      const decimated = decimateEvenly(clipped, Math.min(clipped.length, remaining));
      if (decimated.length < 2) continue;

      const traceUnwrapped = unwrapLngs(decimated);
      const traceProjected = projectPoints(
        traceUnwrapped,
        expandedBounds.minLng,
        expandedBounds.maxLng,
        expandedBounds.minLat,
        expandedBounds.maxLat,
        W,
        H,
        PAD,
        cosLat,
      );

      const d = toPathD(traceProjected);
      if (d) {
        tracePaths.push(d);
        usedPoints += decimated.length;
      }
    }
  }

  return {
    width: W,
    height: H,
    sessionPath: sessionPathD,
    tracePaths,
  };
}

/**
 * conquest 상태별 hero 표시 문자열.
 * - positive ≥ 50m: "+N.N km" 문자열 반환
 * - positive < 50m: null (숫자 없는 메시지용)
 * - confirmed_zero: null
 * - none / error: null (대기/오류 카피 별도)
 */
export function formatNewRoadHero(newMeters: number, status: string): string | null {
  if (status !== "positive") return null;
  if (!Number.isFinite(newMeters) || newMeters < 50) return null;
  const km = newMeters / 1000;
  return `+${km.toFixed(newMeters < 10000 ? 1 : 0)} km`;
}

/**
 * conquest 상태별 서브 문자열(hero 아래 또는 0 표시 시).
 */
export function formatNewRoadSubtitle(newMeters: number, status: string): string {
  if (status === "positive" && newMeters >= 50) {
    return "이번에 달린 길이 내 도로망에 더해졌어요";
  }
  if (status === "positive" && newMeters > 0) {
    return "새 도로가 조금 더해졌어요";
  }
  if (status === "confirmed_zero") {
    return "오늘의 주행을 마쳤어요";
  }
  return "";
}

/**
 * conquest 상태별 대기/오류 카피 (hero 위치에 표시).
 */
export function formatConquestStatusCopy(
  status: string,
  delayed: boolean,
  timedOut: boolean,
): string | null {
  if (status === "positive" || status === "confirmed_zero") return null;
  if (status === "unsaved") return null;
  if (timedOut) return "다시 확인";
  if (delayed) return "새 도로 확인이 늦어지고 있어요";
  if (status === "none" || status === "pending") return "새 도로 확인 중…";
  if (status === "error") return "새 도로를 확인하지 못했어요";
  return null;
}
