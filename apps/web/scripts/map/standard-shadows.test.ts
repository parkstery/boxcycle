import assert from "node:assert/strict";
import { test } from "node:test";
import { setStandardShadows } from "../../src/lib/map/standardShadows.ts";

function fixture() {
  const values = new Map<string, unknown>([["houses", true], ["trees", ["step", ["zoom"], false, 16, true]], ["walls", undefined], ["road", "x"]]);
  const layer = (id: string, type: string) => ({ id, type, getPaintProperty: () => values.get(id) });
  const setPaintProperty = (id: string, property: string, value: unknown) => {
    assert.match(property, /-cast-shadows$/);
    values.set(id, value);
  };
  const imported = { _layers: { trees: layer("trees", "model"), walls: layer("walls", "building"), road: layer("road", "line") }, setPaintProperty };
  const style = { _layers: { houses: layer("houses", "fill-extrusion") }, fragments: [{ style: imported }], setPaintProperty };
  return { values, map: { style, _update() {} } as never };
}

test("주행 중 그림자를 끄고 종료하면 레이어별 원래 값으로 되돌린다", () => {
  const { values, map } = fixture();
  const before = new Map(values);
  setStandardShadows(map, false);
  for (const id of ["houses", "trees", "walls"]) assert.equal(values.get(id), false, id);
  assert.equal(values.get("road"), "x");
  setStandardShadows(map, false);
  setStandardShadows(map, true);
  assert.deepEqual(values, before);
});

test("끈 적이 없으면 켜기는 아무것도 바꾸지 않는다", () => {
  const { values, map } = fixture();
  const before = new Map(values);
  setStandardShadows(map, true);
  assert.deepEqual(values, before);
});
