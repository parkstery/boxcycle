import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  applyMapCutToMap,
  classifyMapCutLayers,
  getMapCutKeys,
  isMapCutKeyActive,
  MAP_CUT_KEYS,
  parseMapCutKeys,
  resetMapCutForTests,
  type MapCutKey,
  type MapCutMapLike,
  type MapCutStyleLayer,
} from "../../src/lib/map/mapCut.ts";

const originalWindow = (globalThis as { window?: unknown }).window;

function useSearch(search: string): void {
  (globalThis as { window?: { location: { search: string } } }).window = {
    location: { search },
  };
  resetMapCutForTests();
}

afterEach(() => {
  resetMapCutForTests();
  if (originalWindow === undefined) delete (globalThis as { window?: unknown }).window;
  else (globalThis as { window?: unknown }).window = originalWindow;
});

/** 호출 기록 가짜 지도. */
function makeFakeMap(layers: MapCutStyleLayer[]): MapCutMapLike & {
  calls: { layout: Array<[string, string, unknown]>; terrain: unknown[]; fog: unknown[] };
} {
  const calls = {
    layout: [] as Array<[string, string, unknown]>,
    terrain: [] as unknown[],
    fog: [] as unknown[],
  };
  const present = new Set(layers.map((l) => l.id));
  return {
    calls,
    getStyle: () => ({ layers }),
    getLayer: (id: string) => (present.has(id) ? {} : undefined),
    setLayoutProperty: (id: string, name: string, value: unknown) => {
      calls.layout.push([id, name, value]);
    },
    setTerrain: (terrain: unknown) => {
      calls.terrain.push(terrain);
    },
    setFog: (fog: unknown) => {
      calls.fog.push(fog);
    },
  };
}

const BASE_LAYERS: MapCutStyleLayer[] = [
  { id: "road-motorway", type: "line" },
  { id: "road-minor", type: "line" },
  { id: "poi-label", type: "symbol" },
  { id: "airport-label", type: "symbol" },
  { id: "road-label", type: "symbol" },
  { id: "building", type: "fill-extrusion" },
  { id: "sky", type: "sky" },
  { id: "water", type: "fill" },
  { id: "route", type: "line" },
  { id: "live-self", type: "line" },
  { id: "boxcycle-conquest-traces-line", type: "line" },
  { id: "boxcycle-conquest-live-line", type: "line" },
  { id: "boxcycle-conquest-live-glow", type: "line" },
  { id: "boxcycle-rider-preserved-layer", type: "custom" },
  { id: "boxcycle-3d-buildings", type: "fill-extrusion" },
  { id: "debug-world-light-circle", type: "circle" },
  { id: "distance-offered-line", type: "line" },
];

describe("mapcut 쿼리 파싱", () => {
  it("키는 7개", () => {
    assert.deepEqual([...MAP_CUT_KEYS], [
      "terrain",
      "buildings",
      "labels",
      "poi",
      "sky",
      "minimap",
      "roads",
    ]);
  });

  it("콤마 목록을 순서대로 — 알 수 없는 키 무시", () => {
    assert.deepEqual(parseMapCutKeys("?mapcut=terrain,buildings"), ["terrain", "buildings"]);
    assert.deepEqual(parseMapCutKeys("?mapcut=labels,bogus,poi"), ["labels", "poi"]);
    assert.deepEqual(parseMapCutKeys("?mapcut=ALL"), []);
  });

  it("대소문자·공백 무시, 중복 제거", () => {
    assert.deepEqual(parseMapCutKeys("?mapcut= Terrain ,TERRAIN, roads "), ["terrain", "roads"]);
  });

  it("없거나 비면 빈 배열", () => {
    for (const search of ["", "?foo=1", "?mapcut=", "?mapcut=,,,", "?perflab=1"]) {
      assert.deepEqual(parseMapCutKeys(search), [], search);
    }
    assert.deepEqual(parseMapCutKeys(null), []);
    assert.deepEqual(parseMapCutKeys(undefined), []);
  });

  it("캐시는 페이지 수명 동안 한 번", () => {
    const fake = { location: { search: "?mapcut=terrain,roads" } };
    (globalThis as { window?: unknown }).window = fake;
    resetMapCutForTests();
    assert.deepEqual(getMapCutKeys(), ["terrain", "roads"]);
    assert.equal(isMapCutKeyActive("terrain"), true);
    assert.equal(isMapCutKeyActive("labels"), false);
    fake.location.search = "";
    assert.deepEqual(getMapCutKeys(), ["terrain", "roads"]);
  });
});

describe("mapcut 미적용 보장", () => {
  it("쿼리가 없으면 어떤 레이어도 건드리지 않는다", () => {
    const map = makeFakeMap(BASE_LAYERS);
    const result = applyMapCutToMap(map, []);
    assert.deepEqual(result.applied, []);
    assert.deepEqual(result.hiddenLayers, []);
    assert.equal(map.calls.layout.length, 0);
    assert.equal(map.calls.terrain.length, 0);
    assert.equal(map.calls.fog.length, 0);
  });

  it("키 없이 window 쿼리가 비어도 호출부의 getMapCutKeys 경로로 아무 일도 없다", () => {
    useSearch("");
    const map = makeFakeMap(BASE_LAYERS);
    const result = applyMapCutToMap(map);
    assert.deepEqual(result.applied, []);
    assert.equal(map.calls.layout.length, 0);
  });
});

describe("mapcut 키별 숨김", () => {
  it("labels 는 symbol 만 — 앱 레이어 유지", () => {
    const map = makeFakeMap(BASE_LAYERS);
    const result = applyMapCutToMap(map, ["labels"]);
    assert.ok(result.hiddenLayers.includes("poi-label"));
    assert.ok(result.hiddenLayers.includes("road-label"));
    for (const id of result.hiddenLayers) {
      const layer = BASE_LAYERS.find((l) => l.id === id)!;
      assert.equal(layer.type, "symbol");
    }
    for (const keep of [
      "route",
      "live-self",
      "boxcycle-conquest-traces-line",
      "boxcycle-rider-preserved-layer",
      "debug-world-light-circle",
    ]) {
      assert.ok(!result.hiddenLayers.includes(keep), keep);
    }
    for (const [, name, value] of map.calls.layout) {
      assert.equal(name, "visibility");
      assert.equal(value, "none");
    }
  });

  it("poi 는 POI 계열 symbol 만", () => {
    const map = makeFakeMap(BASE_LAYERS);
    const result = applyMapCutToMap(map, ["poi"]);
    assert.deepEqual(result.hiddenLayers.sort(), ["airport-label", "poi-label"]);
  });

  it("roads 는 road 포함 line 만 — 경로·정복 유지", () => {
    const map = makeFakeMap(BASE_LAYERS);
    const result = applyMapCutToMap(map, ["roads"]);
    assert.deepEqual(result.hiddenLayers.sort(), ["road-minor", "road-motorway"]);
    assert.ok(!result.hiddenLayers.includes("route"));
    assert.ok(!result.hiddenLayers.includes("boxcycle-conquest-traces-line"));
  });

  it("buildings 는 커스텀 3D + 스타일 building 만", () => {
    const map = makeFakeMap(BASE_LAYERS);
    const result = applyMapCutToMap(map, ["buildings"]);
    assert.deepEqual(result.hiddenLayers.sort(), ["boxcycle-3d-buildings", "building"]);
  });

  it("terrain 은 setTerrain(null) 한 번, sky 는 sky 레이어 + setFog(null)", () => {
    const map = makeFakeMap(BASE_LAYERS);
    const result = applyMapCutToMap(map, ["terrain", "sky"]);
    assert.deepEqual(map.calls.terrain, [null]);
    assert.deepEqual(map.calls.fog, [null]);
    assert.equal(result.terrainOff, true);
    assert.equal(result.fogOff, true);
    assert.ok(result.hiddenLayers.includes("sky"));
    assert.ok(!result.hiddenLayers.includes("water"));
  });

  it("minimap 은 지도 호출 없이 적용 기록만", () => {
    const map = makeFakeMap(BASE_LAYERS);
    const result = applyMapCutToMap(map, ["minimap"]);
    assert.deepEqual(result.applied, ["minimap"]);
    assert.deepEqual(result.hiddenLayers, []);
    assert.equal(map.calls.layout.length, 0);
  });

  it("전부는 합집합 — 그래도 앱 레이어는 없다", () => {
    const map = makeFakeMap(BASE_LAYERS);
    const all: MapCutKey[] = ["terrain", "buildings", "labels", "poi", "sky", "minimap", "roads"];
    const result = applyMapCutToMap(map, all);
    assert.deepEqual(result.applied, all);
    for (const keep of [
      "route",
      "live-self",
      "boxcycle-conquest-traces-line",
      "boxcycle-conquest-live-line",
      "boxcycle-conquest-live-glow",
      "boxcycle-rider-preserved-layer",
      "debug-world-light-circle",
      "distance-offered-line",
    ]) {
      assert.ok(!result.hiddenLayers.includes(keep), keep);
    }
    assert.ok(result.hiddenLayers.includes("boxcycle-3d-buildings"));
  });

  it("classify 는 렌더 없이 같은 집합을 낸다", () => {
    const byKey = classifyMapCutLayers(BASE_LAYERS, ["labels", "roads"]);
    assert.deepEqual(byKey.labels.sort(), ["airport-label", "poi-label", "road-label"]);
    assert.deepEqual(byKey.roads.sort(), ["road-minor", "road-motorway"]);
    assert.deepEqual(byKey.poi, []);
  });
});
