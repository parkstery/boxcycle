import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  buildRegionMenu,
  filterByRegion,
  loadListRegion,
  loadRecentRegions,
  parseRegionKey,
  pushRecentRegion,
  regionLabel,
  saveListRegion,
  saveRecentRegions,
  type ListRegionKey,
  type RegionGeo,
} from "../src/lib/geo/listRegionFilter.ts";

const rows: (RegionGeo & { id: string })[] = [
  { id: "kr1", geoCountry: "KR", geoContinent: "AS" },
  { id: "kr2", geoCountry: "KR", geoContinent: "AS" },
  { id: "jp", geoCountry: "JP", geoContinent: "AS" },
  { id: "fr", geoCountry: "FR", geoContinent: "EU" },
  { id: "none", geoCountry: null, geoContinent: null },
];
const geo = (r: RegionGeo) => r;
const ids = (xs: { id: string }[]) => xs.map((x) => x.id);

describe("목록 지역 필터", () => {
  it("세계는 전부, 국가·대륙은 일치하는 행만", () => {
    assert.deepEqual(ids(filterByRegion(rows, "world", geo)), ["kr1", "kr2", "jp", "fr", "none"]);
    assert.deepEqual(ids(filterByRegion(rows, "country:KR", geo)), ["kr1", "kr2"]);
    assert.deepEqual(ids(filterByRegion(rows, "continent:AS", geo)), ["kr1", "kr2", "jp"]);
    assert.deepEqual(ids(filterByRegion(rows, "country:US", geo)), []);
  });

  it("범위 키 해석 — 깨진 값은 세계", () => {
    assert.equal(parseRegionKey("country:KR"), "country:KR");
    assert.equal(parseRegionKey("continent:EU"), "continent:EU");
    for (const bad of ["country:kr", "continent:ZZ", "x", "", null, 3]) assert.equal(parseRegionKey(bad), "world");
  });

  it("라벨 — 대륙 한국어 표, 국가는 지역 이름", () => {
    assert.equal(regionLabel("world"), "세계");
    assert.equal(regionLabel("continent:NA"), "북아메리카");
    assert.equal(regionLabel("country:KR"), "대한민국");
  });

  it("최근 고른 곳 — 최신이 앞, 중복 합침, 최대 3, 세계는 기록 안 함", () => {
    let r: ListRegionKey[] = [];
    for (const k of ["country:KR", "country:JP", "continent:EU", "country:KR"] as ListRegionKey[]) r = pushRecentRegion(r, k);
    assert.deepEqual(r, ["country:KR", "continent:EU", "country:JP"]);
    r = pushRecentRegion(r, "country:FR");
    assert.deepEqual(r, ["country:FR", "country:KR", "continent:EU"]);
    assert.deepEqual(pushRecentRegion(r, "world"), r);
  });

  it("메뉴 — 세계·내 국가·목록에 있는 대륙/국가, 내 국가는 한 번만", () => {
    const m = buildRegionMenu(rows, "KR", ["country:JP"]);
    assert.deepEqual(m.map((i) => `${i.group}:${i.key}`), [
      "base:world",
      "base:country:KR",
      "continent:continent:AS",
      "continent:continent:EU",
      "recent:country:JP",
      "country:country:JP",
      "country:country:FR",
    ]);
    assert.equal(m[1]!.tag, "내 국가");
    const guest = buildRegionMenu(rows, null, []);
    assert.ok(!guest.some((i) => i.tag));
    assert.ok(guest.some((i) => i.key === "country:KR" && i.group === "country"));
  });
});

describe("기기 저장", () => {
  const original = (globalThis as { localStorage?: Storage }).localStorage;
  afterEach(() => {
    if (original === undefined) delete (globalThis as { localStorage?: Storage }).localStorage;
    else (globalThis as { localStorage?: Storage }).localStorage = original;
  });

  it("저장소가 없거나 던져도 세계·빈 목록으로 물러난다", () => {
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem() { throw new Error("blocked"); },
      setItem() { throw new Error("blocked"); },
    };
    assert.equal(loadListRegion("public"), "world");
    assert.deepEqual(loadRecentRegions(), []);
    saveListRegion("trail", "country:KR");
    saveRecentRegions(["country:KR"]);
  });

  it("저장한 범위를 목록별로 읽는다", () => {
    const m = new Map<string, string>();
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => void m.set(k, v),
    };
    saveListRegion("public", "country:JP");
    assert.equal(loadListRegion("public"), "country:JP");
    assert.equal(loadListRegion("trail"), "world");
    saveRecentRegions(["country:JP", "country:JP", "continent:ZZ" as ListRegionKey, "continent:EU"]);
    assert.deepEqual(loadRecentRegions(), ["country:JP", "continent:EU"]);
  });
});
