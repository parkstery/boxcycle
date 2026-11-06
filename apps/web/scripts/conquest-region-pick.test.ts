import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { metersForRegion, regionGeosOf } from "../src/lib/conquest/conquestRegionPick.ts";
import type { ConquestRegionTotal } from "../src/lib/conquest/repo/firestoreConquest.ts";

const regions: ConquestRegionTotal[] = [
  { scopeType: "country", scopeCode: "KR", meters: 123_400, cells: 900 },
  { scopeType: "admin1", scopeCode: "KR-11", meters: 50_000, cells: 400 },
  { scopeType: "country", scopeCode: "FR", meters: 2_000, cells: 20 },
];

describe("내 도로망 지역 칩 계산(G5)", () => {
  it("세계는 요약 합계, 국가는 그 국가 문서, 없는 국가는 0", () => {
    assert.equal(metersForRegion("world", 130_000, regions), 130_000);
    assert.equal(metersForRegion("country:KR", 130_000, regions), 123_400);
    assert.equal(metersForRegion("country:JP", 130_000, regions), 0);
  });
  it("대륙 키·깨진 키는 세계로(칩이 대륙을 주지 않지만 안전하게)", () => {
    assert.equal(metersForRegion("continent:AS", 130_000, regions), 130_000);
  });
  it("메뉴 재료는 국가 문서만(행정구역 제외)", () => {
    assert.deepEqual(regionGeosOf(regions), [{ geoCountry: "KR" }, { geoCountry: "FR" }]);
  });
});
