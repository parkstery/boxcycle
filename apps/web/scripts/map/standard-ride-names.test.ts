import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { addStandardRideNames } from "../../src/components/map/standardRideNames.ts";
import { RTW_LAYER_RANK } from "../../src/lib/map/layerOrder.ts";

test("도로명·지명·상호·교통 보충 글자를 모두 추가하고 다시 불러도 중복하지 않는다", () => {
  const sources = new Set<string>();
  const layers = new Map<string, { "source-layer": string }>();
  const map = {
    getSource: (id: string) => sources.has(id),
    addSource: (id: string) => { sources.add(id); },
    getLayer: (id: string) => layers.get(id),
    addLayer: (layer: { id: string; "source-layer": string }) => {
      assert.ok(!layers.has(layer.id));
      layers.set(layer.id, layer);
    },
  };
  addStandardRideNames(map as never);
  addStandardRideNames(map as never);
  assert.deepEqual([...layers.values()].map((l) => l["source-layer"]).sort(), ["place_label", "poi_label", "road", "transit_stop_label"]);
  for (const id of layers.keys()) assert.ok(id in RTW_LAYER_RANK, `${id} 순서 미등록`);
});

test("Standard 글자 설정 네 가지를 모두 켠다 — Chief 2026-11-24", () => {
  const source = readFileSync(new URL("../../src/components/map/MapView.tsx", import.meta.url), "utf8");
  for (const key of ["showRoadLabels", "showPlaceLabels", "showPointOfInterestLabels", "showTransitLabels"]) {
    assert.ok(source.includes(`setConfigProperty("basemap", "${key}", true)`), key);
    assert.ok(!source.includes(`"${key}", false`), key);
  }
});
