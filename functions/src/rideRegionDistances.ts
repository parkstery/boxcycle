/**
 * 주행 한 건의 지역별 거리 (지역별 주행 통계 · document/ops/20261106-region-ride-stats).
 *
 * 순수 모듈: Firestore 를 직접 import 하지 않는다. 판정기는 인자로 받는다.
 * 주행 문서의 `conquest.cells`(이미 소유한 셀 포함 모든 셀) 거리 m 을 z12 묶음 중심점 지역으로 합산한다.
 * 묶음 중심점 판정이라 경계 묶음은 중심점 지역으로 몰린다(conquestRegion.ts 와 같은 알려진 오차).
 */
import {
  REGION_MAX_NEW_CHUNKS,
  chunkCenterLngLat,
  regionLimitExceeded,
  splitMetersByWeight,
  type ChunkRegionResolver,
  type RegionSkipReason,
  type RegionTotal,
} from "./conquestRegion.js";
import { chunkIdOfCellId, type PayloadCell } from "./conquestOnRideCreated.js";

/** `rides/{rideId}.regionDistances` 원소. 바다·판정 불가는 country=null. */
export type RegionDistance = { country: string | null; admin1: string | null; meters: number };

export type RideRegionPlan = {
  /** null = 필드를 쓰지 않는다(셀 없음·상한 초과·판정 실패). 빈 배열은 만들지 않는다. */
  regionDistances: RegionDistance[] | null;
  skipped: RegionSkipReason | "empty" | null;
  error?: unknown;
};

const byText = (a: string | null, b: string | null): number => {
  const x = a ?? "";
  const y = b ?? "";
  return x < y ? -1 : x > y ? 1 : 0;
};

/**
 * 셀 → 묶음별 거리 합 → 지역별 `{country, admin1, meters}`.
 * 불변식: 반환 meters 합 = round(셀 거리 합). 같은 입력이면 항상 같은 결과(멱등).
 * 판정이 던지면 예외를 밖으로 내지 않고 skipped="error" 로 돌려준다.
 */
export function planRideRegionDistances(
  cells: readonly PayloadCell[],
  resolve: ChunkRegionResolver,
): RideRegionPlan {
  try {
    const meterSumByChunk = new Map<string, number>();
    for (const c of cells) {
      const cid = chunkIdOfCellId(c.id);
      meterSumByChunk.set(cid, (meterSumByChunk.get(cid) ?? 0) + c.m);
    }
    if (meterSumByChunk.size === 0) return { regionDistances: null, skipped: "empty" };
    if (meterSumByChunk.size > REGION_MAX_NEW_CHUNKS) return { regionDistances: null, skipped: "chunks" };

    const chunks = [...meterSumByChunk.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    const total = Math.round(chunks.reduce((s, [, m]) => s + m, 0));
    if (total <= 0) return { regionDistances: null, skipped: "empty" };
    const meters = splitMetersByWeight(total, chunks.map(([, m]) => m));

    const byKey = new Map<string, RegionTotal>();
    chunks.forEach(([chunkId], i) => {
      const center = chunkCenterLngLat(chunkId);
      const hit = center ? resolve(center) : null;
      const country = hit?.geoCountry ?? null;
      const admin1 = country ? (hit?.geoAdmin1 ?? null) : null;
      const key = `${country ?? ""}|${admin1 ?? ""}`;
      const cur = byKey.get(key) ?? { continent: hit?.geoContinent ?? null, country, admin1, meters: 0, cells: 0 };
      cur.meters += meters[i]!;
      byKey.set(key, cur);
    });
    const regions = [...byKey.values()];
    const over = regionLimitExceeded(meterSumByChunk.size, regions);
    if (over) return { regionDistances: null, skipped: over };

    const regionDistances = regions
      .map((r) => ({ country: r.country, admin1: r.admin1, meters: r.meters }))
      .filter((r) => r.meters > 0)
      .sort((a, b) => byText(a.country, b.country) || byText(a.admin1, b.admin1));
    return regionDistances.length > 0
      ? { regionDistances, skipped: null }
      : { regionDistances: null, skipped: "empty" };
  } catch (error) {
    return { regionDistances: null, skipped: "error", error };
  }
}

/**
 * 시간 배분: 지역 거리 ÷ 주행 거리 비율(최대 1)로 elapsedSec 를 나눈다. 반환 합계 = round(elapsedSec × 비율).
 * 입력이 비정상(거리 ≤ 0·시간 ≤ 0)이면 모두 0.
 */
export function secByRegion(
  elapsedSec: number,
  regionDistances: readonly RegionDistance[],
  distanceMeters: number,
): number[] {
  if (regionDistances.length === 0) return [];
  if (!Number.isFinite(elapsedSec) || elapsedSec <= 0 || !Number.isFinite(distanceMeters) || distanceMeters <= 0) {
    return regionDistances.map(() => 0);
  }
  const sum = regionDistances.reduce((s, r) => s + r.meters, 0);
  const ratio = Math.min(1, sum / distanceMeters);
  return splitMetersByWeight(Math.round(elapsedSec * ratio), regionDistances.map((r) => r.meters));
}

/** `conquest/{uid}/rideRegions/{scopeCode}` 에 한 주행이 더하는 몫. */
export type RideScopeContribution = {
  scopeType: "country" | "admin1";
  scopeCode: string;
  meters: number;
  sec: number;
  rideCount: 1;
};

/**
 * regionDistances → 지역 문서 단위 몫(국가 문서 + 행정구역 문서). 바다(country null)는 만들지 않는다.
 * 필드 규칙은 conquestRegion.toScopeTotals 와 같다. 시간은 secByRegion 으로 나눈 값의 합.
 */
export function toRideScopeContributions(
  regionDistances: readonly RegionDistance[],
  elapsedSec: number,
  distanceMeters: number,
): RideScopeContribution[] {
  const secs = secByRegion(elapsedSec, regionDistances, distanceMeters);
  const out = new Map<string, RideScopeContribution>();
  const add = (scopeType: "country" | "admin1", scopeCode: string, meters: number, sec: number) => {
    const cur = out.get(scopeCode) ?? { scopeType, scopeCode, meters: 0, sec: 0, rideCount: 1 as const };
    cur.meters += meters;
    cur.sec += sec;
    out.set(scopeCode, cur);
  };
  regionDistances.forEach((r, i) => {
    if (!r.country) return;
    add("country", r.country, r.meters, secs[i]!);
    if (r.admin1) add("admin1", r.admin1, r.meters, secs[i]!);
  });
  return [...out.values()];
}

/** 저장된 값(rides.regionDistances)을 검증해 읽는다. 형식이 틀리거나 비어 있으면 null(=모름). */
export function parseRegionDistances(raw: unknown): RegionDistance[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const out: RegionDistance[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return null;
    const o = item as Record<string, unknown>;
    const code = (v: unknown): string | null | undefined =>
      v == null ? null : typeof v === "string" ? v : undefined;
    const country = code(o.country);
    const admin1 = code(o.admin1);
    const meters = o.meters;
    if (country === undefined || admin1 === undefined) return null;
    if (typeof meters !== "number" || !Number.isFinite(meters) || meters < 0) return null;
    out.push({ country, admin1, meters });
  }
  return out;
}
