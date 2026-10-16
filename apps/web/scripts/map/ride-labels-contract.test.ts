import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildNearCondition,
  combineLabelFilter,
  getMajorTightenCondition,
  getRideLabelLayerIds,
  isMajorKeptLabelLayer,
  MAJOR_POI_FILTERRANK_MAX,
  MAJOR_ROAD_CLASSES,
  parseRideLabelDist,
  parseRideLabelMode,
  parseRideLabelsForceShow,
  RideLabelsController,
  shouldHideRideLabels,
  type RideLabelsMapLike,
  type RideLabelStyleLayer,
} from "../../src/lib/map/rideLabels.ts";

type FakeMap = RideLabelsMapLike & {
  calls: Array<[string, string, unknown]>;
  filterCalls: Array<[string, unknown]>;
  visibility: Map<string, string | undefined>;
  filters: Map<string, unknown>;
  throwFilterIds: Set<string>;
};

function makeFakeMap(
  layers: RideLabelStyleLayer[],
  visibility: Record<string, string | undefined> = {},
  filters: Record<string, unknown> = {},
): FakeMap {
  const vis = new Map<string, string | undefined>(
    layers.map((l) => [l.id, visibility[l.id] ?? "visible"]),
  );
  const fil = new Map<string, unknown>(layers.map((l) => [l.id, filters[l.id]]));
  const calls: Array<[string, string, unknown]> = [];
  const filterCalls: Array<[string, unknown]> = [];
  const throwFilterIds = new Set<string>();
  const present = new Set(layers.map((l) => l.id));
  return {
    calls,
    filterCalls,
    visibility: vis,
    filters: fil,
    throwFilterIds,
    getStyle: () => ({ layers }),
    getLayer: (id: string) => (present.has(id) ? {} : undefined),
    getLayoutProperty: (id: string, name: string) =>
      name === "visibility" ? vis.get(id) : undefined,
    setLayoutProperty: (id: string, name: string, value: unknown) => {
      calls.push([id, name, value]);
      if (name === "visibility") vis.set(id, value as string);
    },
    getFilter: (id: string) => fil.get(id),
    setFilter: (id: string, filter: unknown) => {
      if (throwFilterIds.has(id)) throw new Error(`unsupported in ${id}`);
      filterCalls.push([id, filter]);
      fil.set(id, filter);
    },
  };
}

const BASE: RideLabelStyleLayer[] = [
  { id: "road-label", type: "symbol" },
  { id: "poi-label", type: "symbol" },
  { id: "water", type: "fill" },
  { id: "route", type: "line" },
  { id: "boxcycle-conquest-traces-line", type: "line" },
  { id: "boxcycle-rider-preserved-layer", type: "custom" },
  { id: "distance-offered-line", type: "line" },
  { id: "debug-world-light-circle", type: "circle" },
  { id: "live-self", type: "line" },
];

/** 실제 스타일 3종에 있는 표본 (id + source-layer). */
const REAL: RideLabelStyleLayer[] = [
  { id: "road-label-navigation", type: "symbol", "source-layer": "road" },
  { id: "road-number-shield-navigation", type: "symbol", "source-layer": "road" },
  { id: "road-exit-shield-navigation", type: "symbol", "source-layer": "motorway_junction" },
  { id: "road-label", type: "symbol", "source-layer": "road" },
  { id: "road-intersection", type: "symbol", "source-layer": "road" },
  { id: "road-number-shield", type: "symbol", "source-layer": "road" },
  { id: "path-pedestrian-label", type: "symbol", "source-layer": "road" },
  { id: "ferry-aerialway-label", type: "symbol", "source-layer": "road" },
  { id: "road-oneway-arrow-white", type: "symbol", "source-layer": "road" },
  { id: "level-crossing", type: "symbol", "source-layer": "road" },
  { id: "waterway-label", type: "symbol", "source-layer": "natural_label" },
  { id: "natural-point-label", type: "symbol", "source-layer": "natural_label" },
  { id: "water-point-label", type: "symbol", "source-layer": "natural_label" },
  { id: "continent-label", type: "symbol", "source-layer": "natural_label" },
  { id: "contour-label", type: "symbol", "source-layer": "contour" },
  { id: "building-number-label", type: "symbol", "source-layer": "housenum_label" },
  { id: "block-number-label", type: "symbol", "source-layer": "place_label" },
  { id: "gate-label", type: "symbol", "source-layer": "structure" },
  { id: "poi-label", type: "symbol", "source-layer": "poi_label" },
  { id: "transit-label", type: "symbol", "source-layer": "transit_stop_label" },
  { id: "airport-label", type: "symbol", "source-layer": "airport_label" },
  { id: "settlement-subdivision-label", type: "symbol", "source-layer": "place_label" },
  { id: "settlement-minor-label", type: "symbol", "source-layer": "place_label" },
  { id: "settlement-major-label", type: "symbol", "source-layer": "place_label" },
  { id: "state-label", type: "symbol", "source-layer": "place_label" },
  { id: "country-label", type: "symbol", "source-layer": "place_label" },
];

describe("주행 글자 상태 함수 (히스테리시스)", () => {
  it("주행 아님 → 표시", () => {
    assert.equal(
      shouldHideRideLabels({ riding: false, zoom: 22, currentlyHidden: false }),
      false,
    );
    assert.equal(
      shouldHideRideLabels({ riding: false, zoom: 22, currentlyHidden: true }),
      false,
    );
  });

  it("주행·19.2 → 숨김", () => {
    assert.equal(
      shouldHideRideLabels({ riding: true, zoom: 19.2, currentlyHidden: false }),
      true,
    );
  });

  it("숨김 상태에서 18.8 → 숨김 유지", () => {
    assert.equal(
      shouldHideRideLabels({ riding: true, zoom: 18.8, currentlyHidden: true }),
      true,
    );
  });

  it("18.6 → 표시 (숨김·미숨김 모두)", () => {
    assert.equal(
      shouldHideRideLabels({ riding: true, zoom: 18.6, currentlyHidden: true }),
      false,
    );
    assert.equal(
      shouldHideRideLabels({ riding: true, zoom: 18.6, currentlyHidden: false }),
      false,
    );
  });

  it("?labels=1 → 항상 표시", () => {
    assert.equal(parseRideLabelsForceShow("?labels=1"), true);
    assert.equal(parseRideLabelsForceShow("?labels=0"), false);
    assert.equal(parseRideLabelsForceShow(""), false);
    assert.equal(
      shouldHideRideLabels({ riding: true, zoom: 22, currentlyHidden: true, forceShow: true }),
      false,
    );
    assert.equal(
      shouldHideRideLabels({ riding: true, zoom: 22, currentlyHidden: false, forceShow: true }),
      false,
    );
  });

  it("줌 모름 → 표시", () => {
    assert.equal(
      shouldHideRideLabels({ riding: true, zoom: null, currentlyHidden: false }),
      false,
    );
    assert.equal(
      shouldHideRideLabels({ riding: true, zoom: NaN, currentlyHidden: true }),
      false,
    );
  });
});

describe("주행 글자 컨트롤러 (M2 동작 — 모드 none)", () => {
  it("원래 none 레이어는 복원 후에도 none", () => {
    const c = new RideLabelsController();
    const map = makeFakeMap(BASE, { "poi-label": "none", "road-label": "visible" });
    assert.equal(c.update(map, { riding: true, zoom: 22, mode: "none" }), true);
    // poi-label 은 원래 none 이라 호출 없음, road-label 만 none 으로
    assert.deepEqual(
      map.calls.map(([id]) => id).sort(),
      ["road-label"],
    );
    assert.equal(map.visibility.get("poi-label"), "none");
    // none 모드는 filter 를 건드리지 않는다
    assert.equal(map.filterCalls.length, 0);
    map.calls.length = 0;
    assert.equal(c.update(map, { riding: false, zoom: 22, mode: "none" }), false);
    assert.deepEqual(
      map.calls.map(([id, , v]) => [id, v]),
      [["road-label", "visible"]],
    );
    assert.equal(map.visibility.get("poi-label"), "none");
    assert.equal(map.visibility.get("road-label"), "visible");
  });

  it("상태가 같으면 setLayoutProperty 호출 0", () => {
    const c = new RideLabelsController();
    const map = makeFakeMap(BASE);
    assert.equal(c.update(map, { riding: true, zoom: 22, mode: "none" }), true);
    const first = map.calls.length;
    assert.ok(first > 0);
    map.calls.length = 0;
    // 같은 상태 — 줌 이벤트가 와도 호출 없음
    assert.equal(c.update(map, { riding: true, zoom: 22, mode: "none" }), true);
    assert.equal(c.update(map, { riding: true, zoom: 21.5, mode: "none" }), true);
    assert.equal(map.calls.length, 0);
    // 히스테리시스 안(18.8)에서도 유지라 호출 없음
    assert.equal(c.update(map, { riding: true, zoom: 18.8, mode: "none" }), true);
    assert.equal(map.calls.length, 0);
  });

  it("앱 레이어는 호출 대상에 없음", () => {
    const c = new RideLabelsController();
    const map = makeFakeMap(BASE);
    c.update(map, { riding: true, zoom: 22, mode: "none" });
    const ids = map.calls.map(([id]) => id);
    for (const keep of [
      "route",
      "live-self",
      "boxcycle-conquest-traces-line",
      "boxcycle-rider-preserved-layer",
      "debug-world-light-circle",
      "distance-offered-line",
    ]) {
      assert.ok(!ids.includes(keep), keep);
    }
    assert.deepEqual(getRideLabelLayerIds(BASE).sort(), ["poi-label", "road-label"]);
  });

  it("forceShow 면 숨김 중에도 복원하고 호출은 복원만", () => {
    const c = new RideLabelsController();
    const map = makeFakeMap(BASE);
    assert.equal(c.update(map, { riding: true, zoom: 22, mode: "none" }), true);
    map.calls.length = 0;
    assert.equal(c.update(map, { riding: true, zoom: 22, mode: "none", forceShow: true }), false);
    assert.ok(map.calls.length > 0);
    for (const [, name, value] of map.calls) {
      assert.equal(name, "visibility");
      assert.equal(value, "visible");
    }
  });

  it("style.load 뒤 reapply 로 같은 숨김을 다시 적용", () => {
    const c = new RideLabelsController();
    const map = makeFakeMap(BASE);
    assert.equal(c.update(map, { riding: true, zoom: 22, mode: "none" }), true);
    // 스타일 재로드 근사 — 새 스타일은 전부 visible 로 되살아남
    for (const id of ["road-label", "poi-label"]) map.visibility.set(id, "visible");
    map.calls.length = 0;
    c.reapply(map);
    assert.equal(c.isHidden(), true);
    assert.deepEqual(
      map.calls.map(([id]) => id).sort(),
      ["poi-label", "road-label"],
    );
    // 표시 상태에서는 reapply 가 아무 일도 없다
    const c2 = new RideLabelsController();
    const map2 = makeFakeMap(BASE);
    c2.reapply(map2);
    assert.equal(map2.calls.length, 0);
  });
});

describe("모드·D 파싱", () => {
  it("알려진 모드는 그대로, 잘못된 값·없음 → both", () => {
    for (const m of ["both", "near", "major", "all", "none"]) {
      assert.equal(parseRideLabelMode(`?labelmode=${m}`), m);
    }
    assert.equal(parseRideLabelMode("?labelmode=everything"), "both");
    assert.equal(parseRideLabelMode("?labelmode="), "both");
    assert.equal(parseRideLabelMode(""), "both");
    assert.equal(parseRideLabelMode(null), "both");
  });

  it("D 범위 — 0.5–3, 없거나 잘못되면 1.2", () => {
    assert.equal(parseRideLabelDist(""), 1.2);
    assert.equal(parseRideLabelDist("?labeldist=1.2"), 1.2);
    assert.equal(parseRideLabelDist("?labeldist=0.5"), 0.5);
    assert.equal(parseRideLabelDist("?labeldist=3"), 3);
    assert.equal(parseRideLabelDist("?labeldist=0.1"), 0.5);
    assert.equal(parseRideLabelDist("?labeldist=99"), 3);
    assert.equal(parseRideLabelDist("?labeldist=abc"), 1.2);
    assert.equal(parseRideLabelDist("?labeldist="), 1.2);
  });
});

describe("major 분류 (실제 스타일 표본)", () => {
  it("유지 — 지명·자연·수계·건물·공항·큰 도로", () => {
    for (const id of [
      "road-label-navigation",
      "road-label",
      "poi-label",
      "airport-label",
      "waterway-label",
      "natural-point-label",
      "water-point-label",
      "continent-label",
      "settlement-subdivision-label",
      "settlement-minor-label",
      "settlement-major-label",
      "state-label",
      "country-label",
    ]) {
      const layer = REAL.find((l) => l.id === id)!;
      assert.equal(isMajorKeptLabelLayer(layer), true, id);
    }
  });

  it("숨김 — 방패·대중교통·보행로·교차로·등고선·지번 등", () => {
    for (const id of [
      "road-number-shield-navigation",
      "road-exit-shield-navigation",
      "road-number-shield",
      "road-intersection",
      "path-pedestrian-label",
      "ferry-aerialway-label",
      "road-oneway-arrow-white",
      "level-crossing",
      "transit-label",
      "contour-label",
      "building-number-label",
      "block-number-label",
      "gate-label",
    ]) {
      const layer = REAL.find((l) => l.id === id)!;
      assert.equal(isMajorKeptLabelLayer(layer), false, id);
    }
  });

  it("소스 정보가 없으면 id 로 판정, 모르면 숨김", () => {
    assert.equal(isMajorKeptLabelLayer({ id: "settlement-major-label" }), true);
    assert.equal(isMajorKeptLabelLayer({ id: "transit-label" }), false);
    assert.equal(isMajorKeptLabelLayer({ id: "something-unknown-label" }), false);
  });

  it("조임 조건 — 도로는 4분류, POI 는 filterrank 상한, 지명은 없음", () => {
    assert.deepEqual(getMajorTightenCondition({ id: "road-label", "source-layer": "road" }), [
      "match",
      ["get", "class"],
      [...MAJOR_ROAD_CLASSES],
      true,
      false,
    ]);
    assert.deepEqual(
      getMajorTightenCondition({ id: "road-label-navigation", "source-layer": "road" }),
      ["match", ["get", "class"], [...MAJOR_ROAD_CLASSES], true, false],
    );
    assert.deepEqual(getMajorTightenCondition({ id: "poi-label", "source-layer": "poi_label" }), [
      "<=",
      ["get", "filterrank"],
      MAJOR_POI_FILTERRANK_MAX,
    ]);
    assert.equal(
      getMajorTightenCondition({ id: "settlement-major-label", "source-layer": "place_label" }),
      null,
    );
    assert.equal(
      getMajorTightenCondition({ id: "water-point-label", "source-layer": "natural_label" }),
      null,
    );
  });

  it("near 조건·결합 — 원래 filter 유무", () => {
    assert.deepEqual(buildNearCondition(1.2), ["<", ["distance-from-center"], 1.2]);
    const orig = ["==", ["get", "class"], "motorway"];
    assert.deepEqual(combineLabelFilter(orig, [buildNearCondition(1.2)]), [
      "all",
      orig,
      ["<", ["distance-from-center"], 1.2],
    ]);
    // 원래 filter 가 없으면 조건만
    assert.deepEqual(combineLabelFilter(undefined, [buildNearCondition(0.5)]), [
      "<",
      ["distance-from-center"],
      0.5,
    ]);
  });
});

describe("모드 적용·복원", () => {
  const MODE_LAYERS: RideLabelStyleLayer[] = [
    { id: "settlement-major-label", type: "symbol", "source-layer": "place_label" },
    { id: "poi-label", type: "symbol", "source-layer": "poi_label" },
    { id: "road-label", type: "symbol", "source-layer": "road" },
    { id: "transit-label", type: "symbol", "source-layer": "transit_stop_label" },
    { id: "road-number-shield", type: "symbol", "source-layer": "road" },
    { id: "route", type: "line" },
  ];

  it("near — 전부 유지 + distance filter, 복원은 원래 filter 로", () => {
    const origRoad = ["==", ["get", "class"], "motorway"];
    const c = new RideLabelsController();
    const map = makeFakeMap(MODE_LAYERS, {}, { "road-label": origRoad });
    assert.equal(c.update(map, { riding: true, zoom: 22, mode: "near", dist: 1.2 }), true);
    // visibility 는 그대로
    assert.equal(map.calls.length, 0);
    // 5개 전부 filter, transit·방패도 near 에서는 유지
    assert.deepEqual(
      map.filterCalls.map(([id]) => id).sort(),
      [
        "poi-label",
        "road-label",
        "road-number-shield",
        "settlement-major-label",
        "transit-label",
      ].sort(),
    );
    const roadFilter = map.filters.get("road-label");
    assert.deepEqual(roadFilter, ["all", origRoad, ["<", ["distance-from-center"], 1.2]]);
    const summary = c.getLastSummary();
    assert.equal(summary.mode, "near");
    assert.equal(summary.targetCount, 5);
    assert.deepEqual(summary.skippedIds, []);
    // 복원 — road 는 원래 filter 로, 없던 곳은 undefined 로
    map.calls.length = 0;
    map.filterCalls.length = 0;
    assert.equal(c.update(map, { riding: false, zoom: 22, mode: "near", dist: 1.2 }), false);
    assert.equal(map.calls.length, 0);
    assert.equal(map.filters.get("road-label"), origRoad);
    assert.equal(map.filters.get("poi-label"), undefined);
  });

  it("major — 사소한 종류 숨김 + 도로·POI 조임, distance 없음", () => {
    const c = new RideLabelsController();
    const map = makeFakeMap(MODE_LAYERS);
    assert.equal(c.update(map, { riding: true, zoom: 22, mode: "major", dist: 1.2 }), true);
    assert.deepEqual(
      map.calls.map(([id]) => id).sort(),
      ["road-number-shield", "transit-label"],
    );
    const filtered = new Map(map.filterCalls.map(([id, f]) => [id, f]));
    assert.deepEqual([...filtered.keys()].sort(), ["poi-label", "road-label"]);
    // 조임 내용 정확히 — 도로는 4분류 match, POI 는 filterrank ≤ 2
    assert.deepEqual(filtered.get("road-label"), [
      "match",
      ["get", "class"],
      [...MAJOR_ROAD_CLASSES],
      true,
      false,
    ]);
    assert.deepEqual(filtered.get("poi-label"), ["<=", ["get", "filterrank"], 2]);
    for (const f of filtered.values()) {
      assert.ok(!JSON.stringify(f).includes("distance-from-center"));
    }
    assert.ok(JSON.stringify(filtered.get("road-label")).includes("motorway"));
    assert.ok(JSON.stringify(filtered.get("poi-label")).includes("filterrank"));
    // 복원 — 숨김 해제 + filter 원복
    assert.equal(c.update(map, { riding: false, zoom: 22, mode: "major", dist: 1.2 }), false);
    assert.equal(map.visibility.get("transit-label"), "visible");
    assert.equal(map.visibility.get("road-number-shield"), "visible");
    assert.equal(map.filters.get("road-label"), undefined);
  });

  it("both — 숨김 + 유지층 distance + 조임", () => {
    const c = new RideLabelsController();
    const map = makeFakeMap(MODE_LAYERS);
    assert.equal(c.update(map, { riding: true, zoom: 22, mode: "both", dist: 0.8 }), true);
    assert.deepEqual(
      map.calls.map(([id]) => id).sort(),
      ["road-number-shield", "transit-label"],
    );
    const filtered = new Map(map.filterCalls.map(([id, f]) => [id, f]));
    assert.deepEqual(
      [...filtered.keys()].sort(),
      ["poi-label", "road-label", "settlement-major-label"],
    );
    for (const f of filtered.values()) {
      assert.ok(JSON.stringify(f).includes("distance-from-center"));
    }
    assert.ok(JSON.stringify(filtered.get("road-label")).includes("secondary"));
  });

  it("all·forceShow — 표시만, filter·visibility 호출 없음", () => {
    for (const input of [
      { riding: true, zoom: 22, mode: "all" as const, dist: 1.2 },
      { riding: true, zoom: 22, mode: "both" as const, dist: 1.2, forceShow: true },
    ]) {
      const c = new RideLabelsController();
      const map = makeFakeMap(MODE_LAYERS);
      assert.equal(c.update(map, input), false);
      assert.equal(map.calls.length, 0);
      assert.equal(map.filterCalls.length, 0);
    }
  });

  it("모드·D 가 바뀌면 다시 적용, 같으면 호출 0", () => {
    const c = new RideLabelsController();
    const map = makeFakeMap(MODE_LAYERS);
    assert.equal(c.update(map, { riding: true, zoom: 22, mode: "both", dist: 1.2 }), true);
    map.calls.length = 0;
    map.filterCalls.length = 0;
    assert.equal(c.update(map, { riding: true, zoom: 21.5, mode: "both", dist: 1.2 }), true);
    assert.equal(map.calls.length, 0);
    assert.equal(map.filterCalls.length, 0);
    // 모드 변경 — 복원 뒤 다시 적용이라 호출 발생.
    // both 에서 숨겼던 transit 은 복원(visibility)된 뒤 near filter 대상이 된다
    assert.equal(c.update(map, { riding: true, zoom: 21.5, mode: "near", dist: 1.2 }), true);
    assert.ok(map.filterCalls.length > 0);
    assert.ok(map.filterCalls.map(([id]) => id).includes("transit-label"));
    assert.ok(map.calls.map(([id]) => id).includes("transit-label"));
    map.filterCalls.length = 0;
    // D 변경 — 다시 적용
    assert.equal(c.update(map, { riding: true, zoom: 21.5, mode: "near", dist: 2 }), true);
    assert.ok(map.filterCalls.length > 0);
    // 복원 호출(undefined) 제외 — 실제 적용된 filter 중에 D=2 가 있다
    const applied = map.filterCalls.map(([, f]) => f).filter((f) => Array.isArray(f));
    assert.ok(applied.length > 0);
    assert.ok(applied.some((f) => JSON.stringify(f).includes(",2]")));
  });

  it("setFilter 실패 레이어는 건너뛰고 결과에 기록", () => {
    const c = new RideLabelsController();
    const map = makeFakeMap(MODE_LAYERS);
    map.throwFilterIds.add("road-label");
    assert.equal(c.update(map, { riding: true, zoom: 22, mode: "near", dist: 1.2 }), true);
    assert.deepEqual(c.getLastSummary().skippedIds, ["road-label"]);
    assert.ok(!c.getLastSummary().filteredIds.includes("road-label"));
    // 건너뛴 레이어는 복원 대상이 아니다
    map.filterCalls.length = 0;
    assert.equal(c.update(map, { riding: false, zoom: 22, mode: "near", dist: 1.2 }), false);
    assert.ok(!map.filterCalls.map(([id]) => id).includes("road-label"));
  });

  it("near·both 에서도 앱 레이어 제외", () => {
    const c = new RideLabelsController();
    const map = makeFakeMap(MODE_LAYERS);
    c.update(map, { riding: true, zoom: 22, mode: "both", dist: 1.2 });
    const touched = [
      ...map.calls.map(([id]) => id),
      ...map.filterCalls.map(([id]) => id),
    ];
    assert.ok(!touched.includes("route"));
  });

  it("both 적용 중 style.load 뒤 reapply — 같은 모드로 다시 적용", () => {
    const c = new RideLabelsController();
    const map = makeFakeMap(MODE_LAYERS);
    assert.equal(c.update(map, { riding: true, zoom: 22, mode: "both", dist: 1.2 }), true);
    for (const l of MODE_LAYERS) {
      if (l.type === "symbol") {
        map.visibility.set(l.id, "visible");
        map.filters.set(l.id, undefined);
      }
    }
    map.calls.length = 0;
    map.filterCalls.length = 0;
    c.reapply(map);
    assert.equal(c.isHidden(), true);
    assert.deepEqual(
      map.calls.map(([id]) => id).sort(),
      ["road-number-shield", "transit-label"],
    );
    assert.ok(map.filterCalls.length > 0);
    assert.equal(c.getLastSummary().mode, "both");
  });
});
