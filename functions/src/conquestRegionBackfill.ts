/**
 * 기존 사용자의 지역별 개인 누적(`conquest/{uid}/regions/*`)을 기존 chunks 에서 계산한다 (G5 S5).
 *
 * 순수 모듈: Firestore 를 import 하지 않는다. 묶음별 미터는 저장돼 있지 않아
 * 사용자 `totalMeters` 를 묶음별 셀 수 비율로 나눈다(합계 = round(totalMeters) 보존).
 * 바다(국가 없음) 묶음은 toScopeTotals 가 제외하므로 국가 문서 meters 합 ≤ totalMeters 이다.
 */
import { type ChunkRegionResolver, type RegionScopeTotal, aggregateNewByRegion, toScopeTotals } from "./conquestRegion.js";

const byCode = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** 묶음별 셀 수(chunkId → n)로 지역 문서 단위 합계를 만든다. 같은 입력이면 항상 같은 결과(멱등). */
export function planRegionsFromChunks(
  totalMeters: number,
  chunkCellCounts: ReadonlyMap<string, number>,
  resolve: ChunkRegionResolver,
): RegionScopeTotal[] {
  // aggregateNewByRegion 은 셀 id 배열을 받으므로 개수만큼의 자리표시 배열로 넘긴다(id 는 쓰지 않는다).
  const byChunk = new Map<string, readonly string[]>();
  for (const [chunkId, n] of [...chunkCellCounts.entries()].sort(([a], [b]) => byCode(a, b))) {
    if (n > 0) byChunk.set(chunkId, new Array<string>(n).fill(""));
  }
  const totals = toScopeTotals(aggregateNewByRegion(byChunk, totalMeters, resolve));
  return totals.sort((a, b) => byCode(a.scopeCode, b.scopeCode));
}

/**
 * 합계 검산: 바다 묶음이 없으면 국가 문서 meters 합 = round(totalMeters), cells 합 = 묶음 셀 합이어야 한다.
 * 바다 묶음이 있으면 각각 그 값을 넘지 않아야 한다.
 */
export function auditRegionPlan(
  totalMeters: number,
  chunkCellCounts: ReadonlyMap<string, number>,
  plan: readonly RegionScopeTotal[],
  seaChunks: number,
): boolean {
  const country = plan.filter((p) => p.scopeType === "country");
  const m = country.reduce((a, p) => a + p.meters, 0);
  const c = country.reduce((a, p) => a + p.cells, 0);
  const cellSum = [...chunkCellCounts.values()].reduce((a, b) => a + b, 0);
  const total = Math.max(0, Math.round(totalMeters));
  if (seaChunks === 0) return m === total && c === cellSum;
  return m <= total && c <= cellSum;
}
