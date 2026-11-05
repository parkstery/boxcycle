/**
 * Trail 찾기(2026-11-05 Chief F1~F4, 시안 ⑦⑧) — 화면 밖 규칙만(순수).
 * 목록 문서(`openTrailListings`)는 지금 주행 중인 Trail 만 담는다(D6). 범위(대륙·국가)는 서버 조회로,
 * 거리·예상 시간은 받아 온 목록 안에서 거른다.
 */

export type TrailFinderScope = { type: "world" } | { type: "continent"; code: string } | { type: "country"; code: string };
export type TrailFinderSort = "riders" | "new";

export type TrailFinderRow = {
  id: string;
  displayNumber: number;
  regionLabel: string | null;
  distanceKm: number | null;
  publicationId: string | null;
  riderCount: number;
  createdAtMs: number | null;
  geoContinent: string | null;
  geoCountry: string | null;
};

export type DistanceBucket = "all" | "lt5" | "5to15" | "15to40" | "gte40";
export type TimeBucket = "all" | "lt20" | "20to45" | "gte45";

export const DISTANCE_BUCKETS: ReadonlyArray<{ id: DistanceBucket; label: string; min: number; max: number }> = [
  { id: "all", label: "전체", min: 0, max: Infinity },
  { id: "lt5", label: "~5", min: 0, max: 5 },
  { id: "5to15", label: "5–15", min: 5, max: 15 },
  { id: "15to40", label: "15–40", min: 15, max: 40 },
  { id: "gte40", label: "40+", min: 40, max: Infinity },
];

export const TIME_BUCKETS: ReadonlyArray<{ id: TimeBucket; label: string; min: number; max: number }> = [
  { id: "all", label: "전체", min: 0, max: Infinity },
  { id: "lt20", label: "~20분", min: 0, max: 20 },
  { id: "20to45", label: "20–45분", min: 20, max: 45 },
  { id: "gte45", label: "45분+", min: 45, max: Infinity },
];

/** 처음 열 때(F1): 내 대표 국가, 없으면 세계 */
export function defaultTrailFinderScope(homeCountry: string | null): TrailFinderScope {
  return homeCountry ? { type: "country", code: homeCountry } : { type: "world" };
}

/** 예상 시간(분) = 거리 ÷ 내 평균 속도 */
export function estimateTrailMinutes(distanceKm: number | null, avgKmh: number): number | null {
  if (distanceKm == null || !Number.isFinite(distanceKm) || !(avgKmh > 0)) return null;
  return (distanceKm / avgKmh) * 60;
}

export function formatTrailMinutes(min: number | null): string {
  if (min == null) return "—";
  if (min < 60) return `${Math.max(1, Math.round(min))}분`;
  const h = Math.floor(min / 60);
  const m = Math.round(min - h * 60);
  return m ? `${h}시간 ${m}분` : `${h}시간`;
}

function inRange(v: number | null, min: number, max: number, all: boolean): boolean {
  if (all) return true;
  if (v == null) return false;
  return v >= min && v < max;
}

export function filterTrailFinderRows(
  rows: readonly TrailFinderRow[],
  opts: { distance: DistanceBucket; time: TimeBucket; avgKmh: number; query?: string },
): TrailFinderRow[] {
  const d = DISTANCE_BUCKETS.find((b) => b.id === opts.distance)!;
  const t = TIME_BUCKETS.find((b) => b.id === opts.time)!;
  const q = opts.query?.trim().toLowerCase() ?? "";
  return rows.filter(
    (r) =>
      inRange(r.distanceKm, d.min, d.max, d.id === "all") &&
      inRange(estimateTrailMinutes(r.distanceKm, opts.avgKmh), t.min, t.max, t.id === "all") &&
      (!q || (r.regionLabel ?? "").toLowerCase().includes(q) || String(r.displayNumber).padStart(3, "0").includes(q)),
  );
}

export type TrailFinderGroup = {
  /** 같은 경로(Publication)면 그 id, 없으면 Trail id */
  key: string;
  title: string;
  distanceKm: number | null;
  riderCount: number;
  trails: TrailFinderRow[];
};

/** F2: 같은 경로 Trail 은 한 줄로 묶는다. 묶음 순서 = 정렬 기준(사람 많은 순이면 묶음 인원 합) */
export function groupTrailFinderRows(rows: readonly TrailFinderRow[], sort: TrailFinderSort): TrailFinderGroup[] {
  const map = new Map<string, TrailFinderGroup>();
  for (const r of rows) {
    const key = r.publicationId ? `p:${r.publicationId}` : `t:${r.id}`;
    const g = map.get(key);
    if (g) {
      g.trails.push(r);
      g.riderCount += r.riderCount;
    } else {
      map.set(key, {
        key,
        title: r.regionLabel?.trim() || `Trail ${String(r.displayNumber).padStart(3, "0")}`,
        distanceKm: r.distanceKm,
        riderCount: r.riderCount,
        trails: [r],
      });
    }
  }
  const groups = [...map.values()];
  for (const g of groups) g.trails.sort((a, b) => b.riderCount - a.riderCount || (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0));
  const newest = (g: TrailFinderGroup) => Math.max(...g.trails.map((t) => t.createdAtMs ?? 0));
  groups.sort((a, b) => (sort === "riders" ? b.riderCount - a.riderCount || newest(b) - newest(a) : newest(b) - newest(a)));
  return groups;
}

/** 범위 고르기(⑧): 받아 온 목록에서 국가별 Trail 수(많은 순) */
export function countTrailsByCountry(rows: readonly TrailFinderRow[]): Array<{ code: string; count: number; riders: number }> {
  const m = new Map<string, { code: string; count: number; riders: number }>();
  for (const r of rows) {
    if (!r.geoCountry) continue;
    const e = m.get(r.geoCountry) ?? { code: r.geoCountry, count: 0, riders: 0 };
    e.count += 1;
    e.riders += r.riderCount;
    m.set(r.geoCountry, e);
  }
  return [...m.values()].sort((a, b) => b.count - a.count || b.riders - a.riders);
}
