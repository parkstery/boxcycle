/**
 * 경로 목록 정렬 — **세 목록(내 경로 · 입문 · 퍼블릭)의 단일 진실**.
 *
 * 2026-09-16: 정렬이 `SavedRoutesPanel` 안에만 있어 공식 코스 목록에는 없었다(Chief).
 * 목록마다 비교 함수를 따로 쓰면 「거리순」이 한쪽은 오름차순, 다른 쪽은 내림차순이
 * 되는 식으로 조용히 갈라진다 — 판정을 여기 한 곳에 둔다.
 *
 * 표시 문구·select 는 `components/ride/RouteSortSelect.tsx` 가 소유한다.
 */

export type RouteSortKey = "recent" | "default" | "distance" | "name";

export type RouteSortFields = {
  name: string;
  distanceMeters: number;
  /**
   * `recent` 전용 시각(ms). 공식 코스 요약에는 자기 시각이 없다 —
   * 없으면 `recent` 는 조용히 **원래 순서**로 물러난다(엉뚱한 순서로 섞지 않는다).
   */
  updatedAtMs?: number | null;
};

/**
 * 두 항목의 순서. 0 이면 원래 순서를 유지한다(Array#sort 는 안정 정렬).
 *
 * - `distance` 는 **긴 것이 위**(내 경로의 종전 동작). 세 목록이 같은 방향을 쓴다.
 * - `name` 은 한국어 로캘 비교.
 */
export function compareRouteListItems(
  a: RouteSortFields,
  b: RouteSortFields,
  key: RouteSortKey,
): number {
  if (key === "distance") return b.distanceMeters - a.distanceMeters;
  if (key === "name") return a.name.localeCompare(b.name, "ko");
  if (key === "recent") {
    const av = a.updatedAtMs;
    const bv = b.updatedAtMs;
    // 한쪽이라도 시각이 없으면 비교하지 않는다 — 원래 순서 유지
    if (av == null || bv == null || Number.isNaN(av) || Number.isNaN(bv)) return 0;
    return bv - av;
  }
  return 0;
}

/** 원본을 건드리지 않고 정렬한 새 배열. `default` 는 원래 순서 그대로. */
export function sortRouteList<T>(
  items: readonly T[],
  key: RouteSortKey,
  fields: (item: T) => RouteSortFields,
): T[] {
  const out = [...items];
  if (key === "default") return out;
  out.sort((a, b) => compareRouteListItems(fields(a), fields(b), key));
  return out;
}
