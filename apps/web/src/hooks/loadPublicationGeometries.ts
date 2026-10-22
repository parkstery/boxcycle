import {
  BASIC_SHARED_HUB_IDS,
  fetchCourseRoutePayload,
  getBasicHubCoursePayload,
} from "../lib/route/repo/firestoreCourses";
import type { LineStringGeometry } from "../lib/geo/geo";

export type PublicationGeomState =
  | { status: "ready"; geometry: LineStringGeometry }
  | { status: "loading" }
  | { status: "missing" };

/**
 * livePublicationRides 오버레이 공통 — publication 노선 geometry 를 한 번씩만 불러 `geomByPublication` 에 채운다.
 * 없는 id 는 loading 으로 표시 후 비동기 적재, 목록에서 빠진 id 는 지운다. 상태가 바뀌면 `bumpGeomEpoch` 호출.
 */
export function loadMissingPublicationGeometries(opts: {
  publicationIds: readonly string[];
  geomByPublication: Map<string, PublicationGeomState>;
  bumpGeomEpoch: () => void;
  /** geometry 가 비어 있어 missing 으로 확정될 때(예외 경로 제외) */
  onGeometryMissing?: (pid: string) => void;
}): void {
  const { publicationIds, geomByPublication: map, bumpGeomEpoch, onGeometryMissing } = opts;
  let scheduled = false;

  for (const pid of publicationIds) {
    if (map.has(pid)) continue;
    map.set(pid, { status: "loading" });
    scheduled = true;

    const isBasicHub = (BASIC_SHARED_HUB_IDS as readonly string[]).includes(pid);
    void (async () => {
      try {
        const geometry: LineStringGeometry | null = isBasicHub
          ? getBasicHubCoursePayload(pid).geometry
          : (await fetchCourseRoutePayload(pid))?.geometry ?? null;
        if (!geometry?.coordinates?.length) {
          map.set(pid, { status: "missing" });
          onGeometryMissing?.(pid);
        } else {
          map.set(pid, { status: "ready", geometry });
        }
      } catch {
        map.set(pid, { status: "missing" });
      }
      bumpGeomEpoch();
    })();
  }

  const keep = new Set(publicationIds);
  for (const key of [...map.keys()]) {
    if (!keep.has(key)) map.delete(key);
  }

  if (scheduled) bumpGeomEpoch();
}
