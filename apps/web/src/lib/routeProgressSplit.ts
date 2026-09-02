import type { LineStringGeometry, LngLat } from "./geo";
import { getDistanceMeters, interpolateLngLatAlongMercatorChord } from "./geo";

/**
 * 경로를 **진행 거리에서 정확히 둘로** 자른다(RIDE-CONTINUE-1 §3.4).
 *
 * 완료 구간(마젠타 = 달린 길)과 남은 구간(빨강 = 아직 안 간 길)이 경계에서 **같은 좌표**를
 * 공유하도록 보장한다 — 각자 반올림해 자르면 틈이나 중복이 생긴다.
 *
 * 좌표가 2점 미만이 되는 쪽은 `null`(그릴 선이 없음).
 */
export type RouteProgressSplit = {
  completed: LineStringGeometry | null;
  remaining: LineStringGeometry | null;
  /** 경계 좌표(양쪽이 공유). 자를 수 없으면 null */
  boundary: LngLat | null;
};

export function splitLineStringAtMeters(
  geometry: LineStringGeometry | null | undefined,
  meters: number,
): RouteProgressSplit {
  const coords = (geometry?.coordinates ?? []) as LngLat[];
  if (coords.length < 2) {
    return { completed: null, remaining: null, boundary: null };
  }
  const target = Number.isFinite(meters) ? Math.max(0, meters) : 0;

  const completed: LngLat[] = [coords[0]];
  let walked = 0;
  let cutIndex = -1;
  let boundary: LngLat | null = null;

  for (let i = 0; i < coords.length - 1; i += 1) {
    const segLen = getDistanceMeters(coords[i], coords[i + 1]);
    if (segLen <= 0) continue;
    if (walked + segLen >= target) {
      const t = (target - walked) / segLen;
      boundary = interpolateLngLatAlongMercatorChord(coords[i], coords[i + 1], t);
      cutIndex = i;
      break;
    }
    walked += segLen;
    completed.push(coords[i + 1]);
  }

  if (cutIndex < 0 || boundary === null) {
    // 진행 거리가 전장 이상 — 전부 완료
    return {
      completed: { type: "LineString", coordinates: [...coords] as [number, number][] },
      remaining: null,
      boundary: coords[coords.length - 1],
    };
  }

  completed.push(boundary);
  /*
   * 남은 구간은 경계 좌표에서 시작한다. 경계가 다음 정점과 사실상 같은 지점이면(정점에서 정확히
   * 잘렸거나 종점에 닿았을 때) 그 정점을 중복해 넣지 않는다 — 100% 진행에서 길이 0 짜리
   * "남은 선"이 생겨 빨간 점 하나가 종점에 찍히던 문제.
   */
  const rest = coords.slice(cutIndex + 1);
  const restStartsAtBoundary = rest.length > 0 && getDistanceMeters(boundary, rest[0]) < 1e-6;
  const remaining: LngLat[] = [boundary, ...(restStartsAtBoundary ? rest.slice(1) : rest)];

  return {
    completed:
      target > 0 && completed.length >= 2
        ? { type: "LineString", coordinates: completed as [number, number][] }
        : null,
    remaining:
      remaining.length >= 2
        ? { type: "LineString", coordinates: remaining as [number, number][] }
        : null,
    boundary,
  };
}
