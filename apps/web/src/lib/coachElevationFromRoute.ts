import type { LineStringGeometry, LngLat } from "./geo";
import type { CoachElevationPoint } from "../services/roadElevationCoach";

/** 고도 배열(샘플 순) + 경로 → 코칭용 ElevationPoint 슬라이스 */
export function buildCoachElevationPoints(
  _geometry: LineStringGeometry,
  elevationM: readonly number[],
  sampledCoords: readonly LngLat[],
): CoachElevationPoint[] {
  const n = Math.min(elevationM.length, sampledCoords.length);
  const out: CoachElevationPoint[] = [];
  for (let i = 0; i < n; i += 1) {
    const [lng, lat] = sampledCoords[i];
    out.push({
      elevation: Number(elevationM[i]) || 0,
      location: { lat, lng },
      resolution: 1,
    });
  }
  return out;
}

/** 주행 거리 비율로 앞쪽 `count`개 내외 슬라이스 */
export function sliceCoachPointsAhead(
  points: CoachElevationPoint[],
  routeLenM: number,
  distanceM: number,
  count = 20,
): CoachElevationPoint[] {
  const n = points.length;
  if (n < 2) return points;
  const len = Math.max(1, routeLenM);
  const clampedD = Math.max(0, Math.min(distanceM, len));
  const start = Math.floor((clampedD / len) * (n - 1));
  const end = Math.min(n - 1, start + Math.max(1, count - 1));
  return points.slice(start, end + 1);
}

export function elevationReadyForCoach(values: readonly number[]): boolean {
  return values.length > 0 && values.some((v) => v !== 0);
}
