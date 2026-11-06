/**
 * Conquest 묶음(z12 chunk) → 지역 판정과 지역별 거리 배분 (G5 · 00-plan §4.4).
 *
 * 순수 모듈: Firestore 를 import 하지 않는다. 판정기는 인자로 받는다(시험에서는 실제 경계 데이터,
 * 트리거에서는 `resolveGeoRegion`).
 *
 * 알려진 오차: 묶음 한 변이 약 7.8km 라서 국경·행정구역 경계가 묶음을 가로지르면 묶음 전체가
 * **중심점이 속한 지역**으로 몰린다(최대 수 km). 필요해지면 셀 단위 판정으로 정밀화한다.
 */
import { CONQUEST_CHUNK_ZOOM, type LngLat } from "./geoTiles.js";
import type { ContinentCode, GeoRegion } from "./geoRegion/geoRegionCore.js";

export type ChunkRegionResolver = (lngLat: LngLat) => GeoRegion | null;

/** 지역 키. 바다·판정 불가는 country=null. */
export type RegionKey = {
  continent: ContinentCode | null;
  country: string | null;
  admin1: string | null;
};

export type RegionTotal = RegionKey & { meters: number; cells: number };

/** `12_x_y` → 그 묶음의 중심 좌표. 형식이 틀리면 null. */
export function chunkCenterLngLat(chunkId: string): LngLat | null {
  const m = /^(\d+)_(\d+)_(\d+)$/.exec(chunkId);
  if (!m) return null;
  const z = Number(m[1]);
  const x = Number(m[2]);
  const y = Number(m[3]);
  if (z !== CONQUEST_CHUNK_ZOOM) return null;
  const n = 2 ** z;
  if (x >= n || y >= n) return null;
  const lng = ((x + 0.5) / n) * 360 - 180;
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 0.5)) / n)));
  return [lng, (latRad * 180) / Math.PI];
}

/** 같은 지역 키를 하나로 묶는 문자열. */
export function regionKeyString(k: RegionKey): string {
  return `${k.continent ?? ""}|${k.country ?? ""}|${k.admin1 ?? ""}`;
}

/**
 * 최대잉여법: 정수 미터를 셀 수 비율로 나누되 합계가 정확히 `totalMeters` 가 되게 한다.
 * (묶음별 미터는 저장돼 있지 않아 셀 수 비율로 배분한다 — 셀은 크기가 같다.)
 */
export function splitMetersByWeight(totalMeters: number, weights: readonly number[]): number[] {
  const total = Math.max(0, Math.round(totalMeters));
  const sum = weights.reduce((a, b) => a + b, 0);
  if (weights.length === 0) return [];
  if (sum <= 0 || total === 0) return weights.map(() => 0);
  const raw = weights.map((w) => (total * w) / sum);
  const floor = raw.map((r) => Math.floor(r));
  let rest = total - floor.reduce((a, b) => a + b, 0);
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of order) {
    if (rest <= 0) break;
    floor[i]! += 1;
    rest -= 1;
  }
  return floor;
}

/**
 * 주행의 새 셀(묶음별)과 `newMeters` 를 지역별 `{meters, cells}` 로 합친다.
 * 불변식: 반환한 meters 합 = round(newMeters), cells 합 = 입력 셀 수 합.
 */
export function aggregateNewByRegion(
  newCellsByChunk: ReadonlyMap<string, readonly string[]>,
  newMeters: number,
  resolve: ChunkRegionResolver,
): RegionTotal[] {
  const chunks = [...newCellsByChunk.entries()].filter(([, ids]) => ids.length > 0);
  const meters = splitMetersByWeight(
    newMeters,
    chunks.map(([, ids]) => ids.length),
  );
  const byKey = new Map<string, RegionTotal>();
  chunks.forEach(([chunkId, ids], i) => {
    const center = chunkCenterLngLat(chunkId);
    const hit = center ? resolve(center) : null;
    const key: RegionKey = {
      continent: hit?.geoContinent ?? null,
      country: hit?.geoCountry ?? null,
      admin1: hit?.geoAdmin1 ?? null,
    };
    const ks = regionKeyString(key);
    const cur = byKey.get(ks) ?? { ...key, meters: 0, cells: 0 };
    cur.meters += meters[i]!;
    cur.cells += ids.length;
    byKey.set(ks, cur);
  });
  return [...byKey.values()];
}

/** 개인 누적 문서 `conquest/{uid}/regions/{scopeCode}` 한 건. */
export type RegionScopeTotal = {
  scopeType: "country" | "admin1";
  scopeCode: string;
  meters: number;
  cells: number;
};

/**
 * 지역 합계 → 누적 문서 단위. 국가 문서와 행정구역 문서 둘 다 만든다(행정구역 순위를 나중에 열어도 다시 계산하지 않도록).
 * 국가를 모르는(바다) 묶음은 개인 통계에서 제외한다 — 전세계 합계는 `conquest/{uid}.totalMeters` 가 이미 갖고 있다.
 */
export function toScopeTotals(regions: readonly RegionTotal[]): RegionScopeTotal[] {
  const out = new Map<string, RegionScopeTotal>();
  const add = (scopeType: "country" | "admin1", scopeCode: string, r: RegionTotal) => {
    const cur = out.get(scopeCode) ?? { scopeType, scopeCode, meters: 0, cells: 0 };
    cur.meters += r.meters;
    cur.cells += r.cells;
    out.set(scopeCode, cur);
  };
  for (const r of regions) {
    if (!r.country) continue;
    add("country", r.country, r);
    if (r.admin1) add("admin1", r.admin1, r);
  }
  return [...out.values()];
}

/* ---- 안전장치(G5, Chief 11-06 승인): 지역 기록은 도로망을 막지 않고, 위조 입력에서 쓰기를 키우지 않는다 ---- */

/**
 * 한 주행에서 지역 기록을 허용하는 상한 — 정직한 주행 최대치(300km ≈ 셀 8,000개: 새 묶음 약 77·국가 3·행정구역 10)의 약 2배.
 * 셀 연속성을 검증하지 않는 입력(sanitizeCells)에서 흩어진 셀이 regions·순위 점수 쓰기를 키우는 것을 막는다.
 */
export const REGION_MAX_NEW_CHUNKS = 160;
export const REGION_MAX_COUNTRIES = 6;
export const REGION_MAX_ADMIN1 = 20;

export type RegionSkipReason = "chunks" | "countries" | "admin1" | "error";

export type RegionAccounting = { byRegion: RegionTotal[]; skipped: RegionSkipReason | null; error?: unknown };

/** 지역 합산 결과가 상한을 넘는지. 넘으면 사유. */
export function regionLimitExceeded(newChunkCount: number, regions: readonly RegionTotal[]): RegionSkipReason | null {
  if (newChunkCount > REGION_MAX_NEW_CHUNKS) return "chunks";
  if (new Set(regions.map((r) => r.country).filter((c): c is string => !!c)).size > REGION_MAX_COUNTRIES) return "countries";
  if (new Set(regions.map((r) => r.admin1).filter((c): c is string => !!c)).size > REGION_MAX_ADMIN1) return "admin1";
  return null;
}

/**
 * 트리거가 쓰는 진입점. 두 가지를 지킨다.
 *  - 판정(경계 데이터 적재 포함)이 던져도 예외를 밖으로 내지 않는다 → 도로망 기록이 지역 기능 때문에 죽지 않는다.
 *  - 상한을 넘으면 지역 기록 전부를 건너뛴다(byRegion 빈 배열 → regions 쓰기·순위 지역 점수 없음, 전세계 점수는 그대로).
 */
export function planRegionAccounting(
  newCellsByChunk: ReadonlyMap<string, readonly string[]>,
  newMeters: number,
  resolve: ChunkRegionResolver,
): RegionAccounting {
  if (newCellsByChunk.size > REGION_MAX_NEW_CHUNKS) return { byRegion: [], skipped: "chunks" };
  try {
    const byRegion = aggregateNewByRegion(newCellsByChunk, newMeters, resolve);
    const over = regionLimitExceeded(newCellsByChunk.size, byRegion);
    return over ? { byRegion: [], skipped: over } : { byRegion, skipped: null };
  } catch (error) {
    return { byRegion: [], skipped: "error", error };
  }
}
