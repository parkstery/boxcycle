import type { LngLat, LineStringGeometry } from "../../lib/geo";
import { getDistanceMeters } from "../../lib/geo";

/** 짧은 코스에서 세로 “자동 맞춤”만으로 고도 잡음이 과대 표시되는 것을 줄이기 위한 상한(m). */
const ELEV_CHART_SHORT_ROUTE_MAX_M = 10_000;
/** 전장 대비 세로 최소 표시 고도폭: 전장의 약 1.1%를 한 번에 쓰는 구간으로 본다(도심 완만 구간 완화). */
const ELEV_CHART_VERT_FLOOR_PER_ROUTE_M = 0.011;
/** 최소 표시 고도폭 하한(m): 아주 짧은 구간에서도 극단 과장 방지 */
const ELEV_CHART_VERT_FLOOR_MIN_M = 12;

/**
 * 고도 차트 세로 스케일.
 * - 10km 초과: 데이터 최소~최대를 세로에 맞춤(기존과 동일).
 * - 10km 이하: `max(데이터폭, 거리기반 바닥폭)`으로 세로 범위를 넓혀, 작은 편차가 그래프 높이를 덜 잡아먹게 함(중심 정렬).
 */
export function buildElevationUi(
  values: number[],
  progressRatio: number | null,
  routeLengthMeters: number,
) {
  const width = 420;
  const height = 100;
  const pad = 8;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const dataSpan = Math.max(max - min, 1);
  const mid = (min + max) / 2;
  let dispMin = min;
  let range = dataSpan;
  if (
    routeLengthMeters > 0 &&
    routeLengthMeters <= ELEV_CHART_SHORT_ROUTE_MAX_M &&
    Number.isFinite(routeLengthMeters)
  ) {
    const floorSpan = Math.max(
      ELEV_CHART_VERT_FLOOR_MIN_M,
      routeLengthMeters * ELEV_CHART_VERT_FLOOR_PER_ROUTE_M,
    );
    range = Math.max(dataSpan, floorSpan);
    dispMin = mid - range / 2;
  }
  const points = values.map((value, index) => {
    const x = pad + (index / (values.length - 1)) * (width - pad * 2);
    const y = height - pad - ((value - dispMin) / range) * (height - pad * 2);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  let marker: { x: string; y: string } | null = null;
  if (progressRatio != null && Number.isFinite(progressRatio)) {
    const clamped = Math.max(0, Math.min(1, progressRatio));
    const markerIdx = clamped * (values.length - 1);
    const lowerIdx = Math.floor(markerIdx);
    const upperIdx = Math.min(values.length - 1, lowerIdx + 1);
    const t = markerIdx - lowerIdx;
    const xLower = pad + (lowerIdx / (values.length - 1)) * (width - pad * 2);
    const xUpper = pad + (upperIdx / (values.length - 1)) * (width - pad * 2);
    const yLower = height - pad - ((values[lowerIdx] - dispMin) / range) * (height - pad * 2);
    const yUpper = height - pad - ((values[upperIdx] - dispMin) / range) * (height - pad * 2);
    marker = {
      x: (xLower + (xUpper - xLower) * t).toFixed(2),
      y: (yLower + (yUpper - yLower) * t).toFixed(2),
    };
  }
  return {
    polylinePoints: points.join(" "),
    startMeters: values[0],
    endMeters: values[values.length - 1],
    marker,
  };
}

export function getProgressRatioOnRoute(
  routeGeometry: LineStringGeometry | null,
  liveLngLat: LngLat | null,
): number | null {
  if (!routeGeometry || routeGeometry.coordinates.length < 2 || !liveLngLat) return null;
  const coords = routeGeometry.coordinates;
  let total = 0;
  let closestIdx = 0;
  let closestDist = Number.POSITIVE_INFINITY;
  const cumulative: number[] = [0];
  for (let i = 1; i < coords.length; i += 1) {
    total += getDistanceMeters(coords[i - 1], coords[i]);
    cumulative.push(total);
  }
  if (total <= 0) return null;
  for (let i = 0; i < coords.length; i += 1) {
    const d = getDistanceMeters(coords[i], liveLngLat);
    if (d < closestDist) {
      closestDist = d;
      closestIdx = i;
    }
  }
  return cumulative[closestIdx] / total;
}
