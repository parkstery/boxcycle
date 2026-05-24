import type { CourseActivitySnapshot } from "./firestoreCourseActivity";
import { boundsCenterLngLat, boundsFromLineStringGeometry } from "./firestoreCourses";
import type { LineStringGeometry, LngLat } from "./geo";
import { getPointOnRouteByDistance, lineStringLengthMeters } from "./geo";

/** courseActivity 앵커·bounds 없을 때 geometry(+진행률)로 DOT 좌표 보충 */
export function resolveActivityWorldDotLngLat(
  row: CourseActivitySnapshot,
  geometry: LineStringGeometry | null | undefined,
): LngLat | null {
  if (row.liveAnchorLngLat) return row.liveAnchorLngLat;
  if (!geometry?.coordinates?.length) return null;

  const len = lineStringLengthMeters(geometry);
  const pr = row.liveAnchorProgressRatio;
  if (pr != null && Number.isFinite(pr) && len > 0) {
    const pt = getPointOnRouteByDistance(geometry, Math.max(0, Math.min(1, pr)) * len);
    if (pt) return pt;
  }

  const bounds = boundsFromLineStringGeometry(geometry);
  return bounds ? boundsCenterLngLat(bounds) : null;
}
