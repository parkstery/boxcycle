/**
 * G5 S1 — 묶음 → 지역 판정·거리 배분 고정 시험.
 * 실제 경계 데이터(geo-data/v1)로 알려진 지점을 판정한다.
 * 실행 (C:\20.HDev\boxcycle\functions): `npm test`
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { lngLatToTileXY, type LngLat } from "./geoTiles.js";
import { resolveGeoRegion } from "./geoRegion/geoRegionData.js";
import {
  aggregateNewByRegion,
  chunkCenterLngLat,
  splitMetersByWeight,
  toScopeTotals,
} from "./conquestRegion.js";

const chunkAt = (lng: number, lat: number): string => {
  const { x, y } = lngLatToTileXY(lng, lat, 12);
  return `12_${x}_${y}`;
};
const cells = (chunk: string, n: number): string[] =>
  Array.from({ length: n }, (_, i) => `20_${chunk}_${i}`);

test("묶음 중심점은 그 묶음 타일 안에 있다", () => {
  for (const at of [[126.978, 37.5665], [2.35, 48.85], [-74, 40.7], [151.2, -33.87]] as LngLat[]) {
    const id = chunkAt(at[0], at[1]);
    const c = chunkCenterLngLat(id)!;
    assert.ok(c, id);
    assert.equal(chunkAt(c[0], c[1]), id);
  }
  assert.equal(chunkCenterLngLat("20_1_1"), null);
  assert.equal(chunkCenterLngLat("12_99999_1"), null);
  assert.equal(chunkCenterLngLat("abc"), null);
});

test("거리 배분 합계는 정확히 newMeters", () => {
  for (const [total, w] of [[1000, [1, 1, 1]], [7, [3, 3, 1]], [0, [2, 5]], [123, [1]], [999, [5, 7, 11, 13]]] as const) {
    const out = splitMetersByWeight(total, w);
    assert.equal(out.reduce((a, b) => a + b, 0), total);
    assert.ok(out.every((v) => Number.isInteger(v) && v >= 0));
  }
  assert.deepEqual(splitMetersByWeight(10, []), []);
});

test("서울·파리·바다 묶음을 실제 데이터로 판정하고 합계를 보존한다", () => {
  const seoul = chunkAt(126.978, 37.5665);
  const paris = chunkAt(2.35, 48.85);
  const sea = chunkAt(-40, 30); // 대서양 한가운데
  const map = new Map<string, string[]>([
    [seoul, cells(seoul, 6)],
    [paris, cells(paris, 3)],
    [sea, cells(sea, 1)],
  ]);
  const res = aggregateNewByRegion(map, 1000, resolveGeoRegion);
  const kr = res.find((r) => r.country === "KR")!;
  const fr = res.find((r) => r.country === "FR")!;
  const ocean = res.find((r) => r.country === null)!;
  assert.equal(kr.admin1, "KR-11");
  assert.equal(kr.continent, "AS");
  assert.equal(fr.admin1, "FR-IDF");
  assert.equal(fr.continent, "EU");
  assert.ok(ocean);
  assert.equal(res.reduce((a, r) => a + r.meters, 0), 1000);
  assert.equal(res.reduce((a, r) => a + r.cells, 0), 10);
  assert.equal(kr.meters, 600);

  const scopes = toScopeTotals(res);
  assert.deepEqual(
    scopes.map((s) => s.scopeCode).sort(),
    ["FR", "FR-IDF", "KR", "KR-11"],
  );
  assert.ok(!scopes.some((s) => s.scopeCode === ""), "바다는 개인 통계에서 제외");
});

test("같은 나라 두 행정구역은 국가에서 합쳐진다(국경 묶음은 중심점 쪽으로 몰림)", () => {
  const seoul = chunkAt(126.978, 37.5665); // KR-11
  const bundang = chunkAt(127.1189, 37.3826); // KR-41
  const map = new Map([[seoul, cells(seoul, 4)], [bundang, cells(bundang, 4)]]);
  const scopes = toScopeTotals(aggregateNewByRegion(map, 800, resolveGeoRegion));
  const get = (c: string) => scopes.find((s) => s.scopeCode === c);
  assert.equal(get("KR")?.meters, 800);
  assert.equal(get("KR")?.cells, 8);
  assert.equal(get("KR-11")?.meters, 400);
  assert.equal(get("KR-41")?.meters, 400);
});

test("새 셀이 없는 묶음·0m 는 빈 결과", () => {
  assert.deepEqual(aggregateNewByRegion(new Map(), 500, resolveGeoRegion), []);
  const seoul = chunkAt(126.978, 37.5665);
  const r = aggregateNewByRegion(new Map([[seoul, cells(seoul, 2)]]), 0, resolveGeoRegion);
  assert.equal(r[0]!.meters, 0);
});

/* ---- 안전장치 ---- */
import { planRegionAccounting, regionLimitExceeded, REGION_MAX_ADMIN1, REGION_MAX_COUNTRIES, REGION_MAX_NEW_CHUNKS } from "./conquestRegion.js";

test("판정이 던져도 planRegionAccounting 은 예외를 내지 않고 건너뜀 표시만 한다", () => {
  const seoul = chunkAt(126.978, 37.5665);
  const out = planRegionAccounting(new Map([[seoul, cells(seoul, 2)]]), 100, () => {
    throw new Error("geo-data missing");
  });
  assert.deepEqual(out.byRegion, []);
  assert.equal(out.skipped, "error");
  assert.ok(out.error instanceof Error);
});

test("새 묶음이 상한을 넘으면 판정하지 않고 건너뜀(위조·흩어진 셀)", () => {
  let called = 0;
  const m = new Map<string, string[]>();
  for (let i = 0; i <= REGION_MAX_NEW_CHUNKS; i += 1) m.set(`12_${1000 + i}_2000`, [`20_${i}_1`]);
  const out = planRegionAccounting(m, 1000, () => {
    called += 1;
    return null;
  });
  assert.equal(out.skipped, "chunks");
  assert.deepEqual(out.byRegion, []);
  assert.equal(called, 0, "상한 초과는 판정 비용도 쓰지 않는다");
  // 경계값: 상한 그대로는 허용
  const ok = new Map([...m].slice(0, REGION_MAX_NEW_CHUNKS));
  assert.equal(planRegionAccounting(ok, 1000, () => null).skipped, null);
});

test("국가·행정구역 수 상한", () => {
  const mk = (n: number, admin: boolean) =>
    Array.from({ length: n }, (_, i) => ({
      continent: "EU" as const,
      country: admin ? "FR" : `C${i}`,
      admin1: admin ? `FR-${i}` : null,
      meters: 1,
      cells: 1,
    }));
  assert.equal(regionLimitExceeded(1, mk(REGION_MAX_COUNTRIES, false)), null);
  assert.equal(regionLimitExceeded(1, mk(REGION_MAX_COUNTRIES + 1, false)), "countries");
  assert.equal(regionLimitExceeded(1, mk(REGION_MAX_ADMIN1, true)), null);
  assert.equal(regionLimitExceeded(1, mk(REGION_MAX_ADMIN1 + 1, true)), "admin1");
});
