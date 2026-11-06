/**
 * 내 도로망 지역 칩(G5, Chief 11-06 시안 ①) — 고른 범위의 거리 계산.
 * 지도는 거르지 않고 숫자(km)만 바뀐다(판정은 서버 한 곳, D7). 행정구역은 이름 표가 없어 국가까지만 고른다.
 */
import type { ConquestRegionTotal } from "./repo/firestoreConquest";
import { WORLD_REGION, type ListRegionKey } from "../geo/listRegionFilter";

/** 칩 메뉴에 올릴 국가 목록(`ListRegionChip.geos` 꼴). 국가 문서만. */
export function regionGeosOf(regions: readonly ConquestRegionTotal[]): { geoCountry: string }[] {
  return regions.filter((r) => r.scopeType === "country").map((r) => ({ geoCountry: r.scopeCode }));
}

/** 고른 범위의 미터. 세계 = 전체(요약 totalMeters), 국가 = 그 국가 문서(없으면 0). */
export function metersForRegion(key: ListRegionKey, worldMeters: number, regions: readonly ConquestRegionTotal[]): number {
  if (key === WORLD_REGION) return worldMeters;
  if (!key.startsWith("country:")) return worldMeters;
  const code = key.slice("country:".length);
  return regions.find((r) => r.scopeType === "country" && r.scopeCode === code)?.meters ?? 0;
}
