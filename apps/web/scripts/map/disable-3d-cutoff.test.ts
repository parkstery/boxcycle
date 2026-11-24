import assert from "node:assert/strict";
import { test } from "node:test";
import { disable3dCutoff } from "../../src/lib/map/disable3dCutoff.ts";

test("disables cutoff for root and imported 3D layers without imposing a distance", () => {
  const changes: string[] = [];
  const layer = (id: string, type: string, value: number) => ({
    id, type, getPaintProperty: () => value,
  });
  const fragment = {
    _layers: { trees: layer("trees", "model", 0.5), landmark: layer("landmark", "building", 0.3),
      unchanged: layer("unchanged", "model", 0), road: layer("road", "line", 1) },
    setPaintProperty: (id: string, property: string, value: number) => changes.push(`${id}:${property}:${value}`),
  };
  const style = { _layers: { houses: layer("houses", "fill-extrusion", 0.5) }, fragments: [{ style: fragment }],
    setPaintProperty: fragment.setPaintProperty };
  let updates = 0;
  disable3dCutoff({ style, _update: () => updates++ } as never);
  assert.deepEqual(changes.sort(), ["houses:fill-extrusion-cutoff-fade-range:0",
    "landmark:building-cutoff-fade-range:0", "trees:model-cutoff-fade-range:0"].sort());
  assert.equal(updates, 1);
});
