import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getRideLabelLayerIds,
  parseRideLabelsForceShow,
  RideLabelsController,
  shouldHideRideLabels,
  type MapCutStyleLayer,
  type RideLabelsMapLike,
} from "../../src/lib/map/rideLabels.ts";

function makeFakeMap(
  layers: MapCutStyleLayer[],
  visibility: Record<string, string | undefined> = {},
): RideLabelsMapLike & {
  calls: Array<[string, string, unknown]>;
  visibility: Map<string, string | undefined>;
} {
  const vis = new Map<string, string | undefined>(
    layers.map((l) => [l.id, visibility[l.id] ?? "visible"]),
  );
  const calls: Array<[string, string, unknown]> = [];
  const present = new Set(layers.map((l) => l.id));
  return {
    calls,
    visibility: vis,
    getStyle: () => ({ layers }),
    getLayer: (id: string) => (present.has(id) ? {} : undefined),
    getLayoutProperty: (id: string, name: string) =>
      name === "visibility" ? vis.get(id) : undefined,
    setLayoutProperty: (id: string, name: string, value: unknown) => {
      calls.push([id, name, value]);
      if (name === "visibility") vis.set(id, value as string);
    },
  };
}

const BASE: MapCutStyleLayer[] = [
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

describe("주행 글자 컨트롤러", () => {
  it("원래 none 레이어는 복원 후에도 none", () => {
    const c = new RideLabelsController();
    const map = makeFakeMap(BASE, { "poi-label": "none", "road-label": "visible" });
    assert.equal(c.update(map, { riding: true, zoom: 22 }), true);
    // poi-label 은 원래 none 이라 호출 없음, road-label 만 none 으로
    assert.deepEqual(
      map.calls.map(([id]) => id).sort(),
      ["road-label"],
    );
    assert.equal(map.visibility.get("poi-label"), "none");
    map.calls.length = 0;
    assert.equal(c.update(map, { riding: false, zoom: 22 }), false);
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
    assert.equal(c.update(map, { riding: true, zoom: 22 }), true);
    const first = map.calls.length;
    assert.ok(first > 0);
    map.calls.length = 0;
    // 같은 상태 — 줌 이벤트가 와도 호출 없음
    assert.equal(c.update(map, { riding: true, zoom: 22 }), true);
    assert.equal(c.update(map, { riding: true, zoom: 21.5 }), true);
    assert.equal(map.calls.length, 0);
    // 히스테리시스 안(18.8)에서도 유지라 호출 없음
    assert.equal(c.update(map, { riding: true, zoom: 18.8 }), true);
    assert.equal(map.calls.length, 0);
  });

  it("앱 레이어는 호출 대상에 없음", () => {
    const c = new RideLabelsController();
    const map = makeFakeMap(BASE);
    c.update(map, { riding: true, zoom: 22 });
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
    assert.equal(c.update(map, { riding: true, zoom: 22 }), true);
    map.calls.length = 0;
    assert.equal(c.update(map, { riding: true, zoom: 22, forceShow: true }), false);
    assert.ok(map.calls.length > 0);
    for (const [, name, value] of map.calls) {
      assert.equal(name, "visibility");
      assert.equal(value, "visible");
    }
  });

  it("style.load 뒤 reapply 로 같은 숨김을 다시 적용", () => {
    const c = new RideLabelsController();
    const map = makeFakeMap(BASE);
    assert.equal(c.update(map, { riding: true, zoom: 22 }), true);
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
