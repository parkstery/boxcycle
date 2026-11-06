/**
 * 지역별 주행 거리(순수 계산) 고정 시험 — 서울·파리 셀로 실제 경계 데이터를 쓴다.
 * 계약: document/ops/20261106-region-ride-stats/README.md
 * 실행 (C:\20.HDev\boxcycle\functions): `npm test`
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { conquestCellIdAt, lngLatToTileXY, type LngLat } from "./geoTiles.js";
import { resolveGeoRegion } from "./geoRegion/geoRegionData.js";
import type { GeoRegion } from "./geoRegion/geoRegionCore.js";
import { REGION_MAX_ADMIN1, REGION_MAX_COUNTRIES, REGION_MAX_NEW_CHUNKS } from "./conquestRegion.js";
import {
  parseRegionDistances,
  planRideRegionDistances,
  secByRegion,
  toRideScopeContributions,
} from "./rideRegionDistances.js";

/** 한 지점 근처(같은 z12 묶음 안)에서 n 개 셀, 셀당 m 미터. */
const cellsAt = (lng: number, lat: number, n: number, m: number) =>
  Array.from({ length: n }, (_, i) => ({ id: conquestCellIdAt([lng + i * 0.0004, lat] as LngLat), m }));

const SEOUL: LngLat = [126.978, 37.5665];
const PARIS: LngLat = [2.35, 48.85];
const SEA: LngLat = [-40, 30];

test("서울+파리+바다: 지역 합계 = round(셀 거리 합), 바다는 country null 로 남는다", () => {
  const cells = [
    ...cellsAt(SEOUL[0], SEOUL[1], 6, 10.4),
    ...cellsAt(PARIS[0], PARIS[1], 3, 10.4),
    ...cellsAt(SEA[0], SEA[1], 1, 10.4),
  ];
  const plan = planRideRegionDistances(cells, resolveGeoRegion);
  assert.equal(plan.skipped, null);
  const rd = plan.regionDistances!;
  assert.equal(rd.reduce((a, r) => a + r.meters, 0), Math.round(10 * 10.4));
  assert.ok(rd.every((r) => Number.isInteger(r.meters) && r.meters > 0));
  const kr = rd.find((r) => r.country === "KR")!;
  const fr = rd.find((r) => r.country === "FR")!;
  const sea = rd.find((r) => r.country === null)!;
  assert.equal(kr.admin1, "KR-11");
  assert.equal(fr.admin1, "FR-IDF");
  assert.equal(sea.admin1, null);
  assert.equal(rd.length, 3);
});

test("같은 쌍은 하나로 합친다(한 묶음 안 셀 여러 개 + 같은 행정구역의 두 묶음)", () => {
  const bundang: LngLat = [127.1189, 37.3826]; // KR-41
  const cells = [...cellsAt(SEOUL[0], SEOUL[1], 4, 25), ...cellsAt(bundang[0], bundang[1], 4, 25)];
  const rd = planRideRegionDistances(cells, resolveGeoRegion).regionDistances!;
  assert.equal(rd.length, 2);
  assert.equal(rd.find((r) => r.admin1 === "KR-11")!.meters, 100);
  assert.equal(rd.find((r) => r.admin1 === "KR-41")!.meters, 100);
});

test("멱등: 같은 입력은 순서가 달라도 같은 결과", () => {
  const cells = [...cellsAt(SEOUL[0], SEOUL[1], 5, 7.7), ...cellsAt(PARIS[0], PARIS[1], 5, 7.7)];
  const a = planRideRegionDistances(cells, resolveGeoRegion);
  const b = planRideRegionDistances([...cells].reverse(), resolveGeoRegion);
  assert.deepEqual(a, b);
  assert.deepEqual(planRideRegionDistances(cells, resolveGeoRegion), a);
});

test("셀이 없거나 거리 0 이면 null(빈 배열을 만들지 않는다)", () => {
  assert.deepEqual(planRideRegionDistances([], resolveGeoRegion), { regionDistances: null, skipped: "empty" });
  const zero = planRideRegionDistances(cellsAt(SEOUL[0], SEOUL[1], 3, 0), resolveGeoRegion);
  assert.equal(zero.regionDistances, null);
});

/** 서로 다른 z12 묶음의 셀 n 개 — 판정기는 시험에서 주입한다. */
const spreadCells = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `20_${(1000 + i) * 256}_${2000 * 256}`, m: 10 }));
const region = (country: string | null, admin1: string | null): GeoRegion => ({
  geoQuadkey: "",
  geoContinent: null,
  geoCountry: country,
  geoAdmin1: admin1,
  geoResolverVersion: 1,
});

test("새 묶음 상한 초과면 판정하지 않고 null", () => {
  let called = 0;
  const plan = planRideRegionDistances(spreadCells(REGION_MAX_NEW_CHUNKS + 1), () => {
    called += 1;
    return null;
  });
  assert.equal(plan.regionDistances, null);
  assert.equal(plan.skipped, "chunks");
  assert.equal(called, 0);
  const ok = planRideRegionDistances(spreadCells(REGION_MAX_NEW_CHUNKS), () => region("KR", "KR-11"));
  assert.equal(ok.skipped, null);
  assert.equal(ok.regionDistances!.reduce((a, r) => a + r.meters, 0), REGION_MAX_NEW_CHUNKS * 10);
});

test("국가·행정구역 수 상한 초과면 null", () => {
  const cells = spreadCells(REGION_MAX_COUNTRIES + 1);
  let i = 0;
  const byCountry = planRideRegionDistances(cells, () => region(`C${i++}`, null));
  assert.equal(byCountry.regionDistances, null);
  assert.equal(byCountry.skipped, "countries");
  const cells2 = spreadCells(REGION_MAX_ADMIN1 + 1);
  let j = 0;
  const byAdmin = planRideRegionDistances(cells2, () => {
    j += 1;
    return region("KR", `KR-${j}`);
  });
  assert.equal(byAdmin.regionDistances, null);
  assert.equal(byAdmin.skipped, "admin1");
});

test("판정이 던지면 예외를 내지 않고 null + error", () => {
  const plan = planRideRegionDistances(cellsAt(SEOUL[0], SEOUL[1], 2, 10), () => {
    throw new Error("geo-data missing");
  });
  assert.equal(plan.regionDistances, null);
  assert.equal(plan.skipped, "error");
  assert.ok(plan.error instanceof Error);
});

test("시간 배분: 합계 = round(elapsedSec × 비율), 비율은 1 을 넘지 않는다", () => {
  const rd = [
    { country: "KR", admin1: "KR-11", meters: 600 },
    { country: "FR", admin1: "FR-IDF", meters: 300 },
    { country: null, admin1: null, meters: 100 },
  ];
  for (const [sec, dist] of [[1000, 1000], [999, 1000], [3601, 1234], [7, 1000], [500, 800]] as const) {
    const out = secByRegion(sec, rd, dist);
    const sum = rd.reduce((a, r) => a + r.meters, 0);
    assert.equal(out.reduce((a, b) => a + b, 0), Math.round(sec * Math.min(1, sum / dist)), `${sec}/${dist}`);
    assert.ok(out.every((v) => Number.isInteger(v) && v >= 0));
  }
  assert.deepEqual(secByRegion(1000, rd, 1000), [600, 300, 100]);
  // 지역 거리 합이 주행 거리보다 크면 비율 1 로 고정
  assert.equal(secByRegion(100, rd, 500).reduce((a, b) => a + b, 0), 100);
  assert.deepEqual(secByRegion(0, rd, 1000), [0, 0, 0]);
  assert.deepEqual(secByRegion(100, rd, 0), [0, 0, 0]);
  assert.deepEqual(secByRegion(100, [], 1000), []);
});

test("지역 문서 몫: 국가+행정구역, 바다는 제외, rideCount 1", () => {
  const rd = [
    { country: "KR", admin1: "KR-11", meters: 600 },
    { country: "KR", admin1: "KR-41", meters: 200 },
    { country: "FR", admin1: "FR-IDF", meters: 100 },
    { country: null, admin1: null, meters: 100 },
  ];
  const out = toRideScopeContributions(rd, 1000, 1000);
  assert.deepEqual(out.map((o) => o.scopeCode).sort(), ["FR", "FR-IDF", "KR", "KR-11", "KR-41"]);
  const kr = out.find((o) => o.scopeCode === "KR")!;
  assert.equal(kr.meters, 800);
  assert.equal(kr.sec, 800);
  assert.equal(kr.scopeType, "country");
  assert.equal(out.find((o) => o.scopeCode === "KR-11")!.scopeType, "admin1");
  assert.ok(out.every((o) => o.rideCount === 1));
});

test("저장된 regionDistances 검증: 형식이 틀리면 null", () => {
  assert.equal(parseRegionDistances(undefined), null);
  assert.equal(parseRegionDistances([]), null);
  assert.equal(parseRegionDistances([{ country: "KR", admin1: 3, meters: 1 }]), null);
  assert.equal(parseRegionDistances([{ country: "KR", admin1: null, meters: "1" }]), null);
  assert.deepEqual(parseRegionDistances([{ country: null, admin1: null, meters: 5 }]), [
    { country: null, admin1: null, meters: 5 },
  ]);
});

test("기준: 서울 좌표의 묶음은 z12", () => {
  const { x, y } = lngLatToTileXY(SEOUL[0], SEOUL[1], 12);
  assert.ok(x > 0 && y > 0);
});
