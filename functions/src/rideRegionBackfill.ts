/**
 * 기존 주행의 지역별 거리(`rides.regionDistances`)와 사용자별 `rideRegions` 를 맞추는 순수 계획 (지역별 주행 통계 소급).
 *
 * 순수 모듈: Firestore 를 직접 import 하지 않는다. 같은 입력이면 항상 같은 결과(멱등) —
 * 이미 `regionDistances` 가 있는 주행은 다시 계산하지 않고 그 값을 합산에 쓴다.
 */
import { sanitizeCells } from "./conquestOnRideCreated.js";
import type { ChunkRegionResolver } from "./conquestRegion.js";
import {
  parseRegionDistances,
  planRideRegionDistances,
  toRideScopeContributions,
  type RegionDistance,
} from "./rideRegionDistances.js";

/** CLI 가 주행 문서에서 뽑아 넘기는 입력. */
export type BackfillRideInput = {
  id: string;
  distanceMeters: number;
  elapsedSec: number;
  /** `conquest.v === 2 && conquest.z === 20` 일 때만 conquest.cells 를 넘긴다. 아니면 undefined. */
  conquestCells: unknown;
  /** 주행 문서의 기존 regionDistances(검증 전 원본). */
  regionDistances: unknown;
};

export type RideBackfillStatus = "had" | "computed" | "nocells" | "skipped";

export type RideBackfillItem = {
  id: string;
  status: RideBackfillStatus;
  /** status 가 "computed" 일 때만 주행 문서에 쓸 값. */
  toWrite: RegionDistance[] | null;
};

export type RideRegionDocPlan = {
  scopeType: "country" | "admin1";
  scopeCode: string;
  meters: number;
  sec: number;
  rideCount: number;
};

export type UserRideRegionPlan = {
  rides: number;
  computed: number;
  nocells: number;
  /** 상한 초과·판정 실패로 건너뛴 주행 수 */
  skipped: number;
  items: RideBackfillItem[];
  docs: RideRegionDocPlan[];
  /** 국가 문서 meters 합 ≤ 주행 거리 합 (셀 거리 합과 주행 거리의 미세한 차 1% + 주행당 1m 허용) */
  auditOk: boolean;
};

const byCode = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

export function planUserRideRegions(
  rides: readonly BackfillRideInput[],
  resolve: ChunkRegionResolver,
): UserRideRegionPlan {
  const items: RideBackfillItem[] = [];
  const docs = new Map<string, RideRegionDocPlan>();
  let computed = 0;
  let nocells = 0;
  let skipped = 0;
  let distanceSum = 0;
  for (const ride of [...rides].sort((a, b) => byCode(a.id, b.id))) {
    if (Number.isFinite(ride.distanceMeters) && ride.distanceMeters > 0) distanceSum += ride.distanceMeters;
    let regionDistances = parseRegionDistances(ride.regionDistances);
    let status: RideBackfillStatus = "had";
    let toWrite: RegionDistance[] | null = null;
    if (!regionDistances) {
      const cells = sanitizeCells(ride.conquestCells);
      if (cells.length === 0) {
        status = "nocells";
        nocells += 1;
      } else {
        const plan = planRideRegionDistances(cells, resolve);
        if (plan.regionDistances) {
          regionDistances = plan.regionDistances;
          toWrite = plan.regionDistances;
          status = "computed";
          computed += 1;
        } else if (plan.skipped === "empty") {
          status = "nocells";
          nocells += 1;
        } else {
          status = "skipped";
          skipped += 1;
        }
      }
    }
    items.push({ id: ride.id, status, toWrite });
    if (!regionDistances) continue;
    for (const c of toRideScopeContributions(regionDistances, ride.elapsedSec, ride.distanceMeters)) {
      const cur = docs.get(c.scopeCode) ?? { scopeType: c.scopeType, scopeCode: c.scopeCode, meters: 0, sec: 0, rideCount: 0 };
      cur.meters += c.meters;
      cur.sec += c.sec;
      cur.rideCount += c.rideCount;
      docs.set(c.scopeCode, cur);
    }
  }
  const list = [...docs.values()].sort((a, b) => byCode(a.scopeCode, b.scopeCode));
  const countryMeters = list.filter((d) => d.scopeType === "country").reduce((s, d) => s + d.meters, 0);
  return {
    rides: rides.length,
    computed,
    nocells,
    skipped,
    items,
    docs: list,
    auditOk: countryMeters <= distanceSum * 1.01 + rides.length,
  };
}
