import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { placeRideTrees, type RideTree, type RideTreeData, type XY } from "../../src/lib/map/rideTreePlacement.ts";
import { rideTreeOrigin, rideTreesEnabled, rideTreesToGeoJson, toRideTreeLocal } from "../../src/lib/map/rideTreeLayer.ts";

const square = (x0: number, y0: number, x1: number, y1: number): XY[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]];
const empty = (): RideTreeData => ({ roads: [], greens: [], buildings: [], water: [], realTrees: [] });
function run(data: RideTreeData, center: XY = [0, 0], route: XY[] = []): RideTree[] {
  const it = placeRideTrees(data, center, route);
  for (;;) {
    const step = it.next();
    if (step.done) return step.value;
  }
}
const near = (t: RideTree, a: XY, b: XY): number => {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const k = Math.max(0, Math.min(1, ((t.x - a[0]) * dx + (t.y - a[1]) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(t.x - a[0] - k * dx, t.y - a[1] - k * dy);
};

test("숲에는 심고 건물·물 안과 실제 나무 6m 안에는 심지 않는다", () => {
  const data = empty();
  data.greens.push({ cls: "wood", rings: [square(-150, -150, 150, 150)] });
  const all = run(data);
  assert.ok(all.length > 150, `숲이 비었다: ${all.length}`);
  data.buildings.push([square(0, 0, 60, 60)]);
  data.water.push([square(-60, -60, 0, 0)]);
  const tree = all.find((t) => t.x < -80 && t.y > 80);
  assert.ok(tree);
  data.realTrees.push([tree.x + 1, tree.y]);
  const some = run(data);
  assert.ok(some.length < all.length);
  for (const t of some) {
    assert.ok(!(t.x > 0 && t.x < 60 && t.y > 0 && t.y < 60), "건물 안");
    assert.ok(!(t.x > -60 && t.x < 0 && t.y > -60 && t.y < 0), "물 안");
    assert.ok(Math.hypot(t.x - tree.x - 1, t.y - tree.y) >= 6, "실제 나무와 겹침");
  }
});

test("경로 양옆에 가로수를 세우되 경로선과 차도 위는 비운다", () => {
  const route: XY[] = [[0, -200], [0, 200]];
  const data = empty();
  data.roads.push({ cls: "street", elevated: false, pts: route });
  const trees = run(data, [0, 0], route);
  assert.ok(trees.some((t) => t.x > 0) && trees.some((t) => t.x < 0), "양쪽");
  for (const t of trees) assert.ok(near(t, route[0], route[1]) >= 6.5 / 2 + 1.1, "차도 위");
  assert.ok(trees.length >= 20);
});

test("교량·터널 구간의 경로에는 가로수를 세우지 않는다", () => {
  const route: XY[] = [[0, -200], [0, 200]];
  const data = empty();
  data.roads.push({ cls: "street", elevated: true, pts: route });
  assert.equal(run(data, [0, 0], route).length, 0);
});

test("굽은 길 안쪽의 카메라 시선(라이더 뒤 15m)을 비운다", () => {
  const route: XY[] = [[-60, 0], [0, 0], [0, 60]];
  const data = empty();
  data.greens.push({ cls: "wood", rings: [square(-80, -80, 80, 80)] });
  // 모퉁이를 막 돈 라이더 (0,0): 카메라는 (0,-15) — 경로 밖이지만 비어야 한다.
  for (const t of run(data, [0, 0], route)) assert.ok(near(t, [0, -15], [0, 0]) >= 2.8, `시선을 막는다 ${t.x},${t.y}`);
});

test("중심이 옮겨가도 겹치는 범위의 나무는 같은 자리다", () => {
  const data = empty();
  data.greens.push({ cls: "park", rings: [square(-600, -600, 600, 600)] });
  const route: XY[] = [[-300, 5], [300, 5]];
  const key = (t: RideTree) => `${t.x.toFixed(3)},${t.y.toFixed(3)},${t.kind},${t.rotation},${t.size}`;
  const inner = (list: RideTree[]) => list.filter((t) => Math.hypot(t.x - 30, t.y) < 200).map(key).sort();
  assert.deepEqual(inner(run(data, [0, 0], route)), inner(run(data, [60, 0], route)));
});

test("상한 900그루를 넘지 않고 가까운 나무부터 남긴다", () => {
  const data = empty();
  data.greens.push({ cls: "wood", rings: [square(-600, -600, 600, 600)] });
  const trees = run(data);
  assert.equal(trees.length, 900);
  const d = trees.map((t) => Math.hypot(t.x, t.y));
  assert.ok(d.every((v, i) => i === 0 || v >= d[i - 1]));
});

test("한 조각의 계산이 길지 않다 — 숲 전체를 여러 번으로 나눈다", () => {
  const data = empty();
  data.greens.push({ cls: "wood", rings: [square(-600, -600, 600, 600)] });
  const it = placeRideTrees(data, [0, 0], []);
  let steps = 0;
  while (!it.next().done) steps++;
  assert.ok(steps > 100, String(steps));
});

test("원점은 동네 단위로 고정되고 좌표는 왕복한다", () => {
  assert.deepEqual(rideTreeOrigin([126.9869, 37.5482]), rideTreeOrigin([126.9901, 37.5511]));
  const origin = rideTreeOrigin([126.9869, 37.5482]);
  const [x, y] = toRideTreeLocal(origin, [126.9869, 37.5482]);
  const fc = rideTreesToGeoJson([{ x, y, kind: "broad", rotation: 3, size: 1 }], origin);
  const point = fc.features[0].geometry as GeoJSON.Point;
  assert.ok(Math.abs(point.coordinates[0] - 126.9869) < 1e-9 && Math.abs(point.coordinates[1] - 37.5482) < 1e-9);
  assert.deepEqual(fc.features[0].properties, { m: "boxcycle-tree-broad", r: 3, k: 1 });
});

test("모델 파일이 있고 가볍다 · 색인이 있어야 Mapbox 가 그린다", () => {
  for (const name of ["facet-broad", "facet-tall", "facet-conifer", "shrub"]) {
    const glb = fs.readFileSync(new URL(`../../public/trees/${name}.glb`, import.meta.url));
    assert.equal(glb.toString("ascii", 0, 4), "glTF");
    assert.ok(glb.length < 12_000, `${name} ${glb.length}`);
    const json = JSON.parse(glb.toString("utf8", 20, 20 + glb.readUInt32LE(12)));
    for (const p of json.meshes[0].primitives) assert.equal(typeof p.indices, "number");
  }
});

test("비교용 쿼리 0 만 나무를 끈다", () => {
  assert.equal(rideTreesEnabled(""), true);
  assert.equal(rideTreesEnabled("?ridetrees=1"), true);
  assert.equal(rideTreesEnabled("?ridetrees=0"), false);
});
