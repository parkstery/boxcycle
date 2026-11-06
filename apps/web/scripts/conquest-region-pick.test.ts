import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { admin1MenuItems, metersForAdmin1, metersForRegion, regionGeosOf } from "../src/lib/conquest/conquestRegionPick.ts";
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

describe("내 도로망 행정구역 칩 계산(G5 A안)", () => {
  const admin1s: ConquestRegionTotal[] = [
    { scopeType: "admin1", scopeCode: "KR-41", meters: 118_200, cells: 90 },
    { scopeType: "admin1", scopeCode: "KR-11", meters: 312_800, cells: 200 },
    { scopeType: "admin1", scopeCode: "KR-26", meters: 118_200, cells: 50 },
  ];
  it("메뉴는 거리 많은 순, 같으면 코드 순이고 이름은 이름 표 함수로", () => {
    const items = admin1MenuItems(admin1s, (c) => `이름:${c}`);
    assert.deepEqual(items.map((i) => i.code), ["KR-11", "KR-26", "KR-41"]);
    assert.equal(items[0]!.label, "이름:KR-11");
  });
  it("국가 문서는 메뉴에 섞이지 않는다", () => {
    const mixed = [...admin1s, { scopeType: "country", scopeCode: "KR", meters: 1, cells: 1 } as ConquestRegionTotal];
    assert.equal(admin1MenuItems(mixed, (c) => c).length, 3);
  });
  it("행정구역 미선택(null)은 국가 합계, 선택하면 그 구역, 목록에 없으면 0", () => {
    assert.equal(metersForAdmin1(null, 290_300, admin1s), 290_300);
    assert.equal(metersForAdmin1("KR-11", 290_300, admin1s), 312_800);
    assert.equal(metersForAdmin1("KR-99", 290_300, admin1s), 0);
  });
});
