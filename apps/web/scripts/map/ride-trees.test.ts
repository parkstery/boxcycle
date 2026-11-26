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
  data.roads.push({ cls: "tertiary", elevated: false, pts: route });
  const trees = run(data, [0, 0], route);
  assert.ok(trees.some((t) => t.x > 0) && trees.some((t) => t.x < 0), "양쪽");
  for (const t of trees) assert.ok(near(t, route[0], route[1]) >= 8 / 2 + 1.1, "차도 위");
  assert.ok(trees.length >= 10);
});

test("길가 나무는 큰길에만, 실제 나무 자료가 있는 동네에는 심지 않는다", () => {
  const route: XY[] = [[0, -400], [0, 400]];
  const on = (cls: string, real: XY[] = []) => {
    const data = empty();
    data.roads.push({ cls, elevated: false, pts: route });
    data.realTrees.push(...real);
    return run(data, [0, 0], route);
  };
  for (const cls of ["trunk", "primary", "secondary", "tertiary"]) assert.ok(on(cls).length > 0, cls);
  for (const cls of ["street", "street_limited", "service", "pedestrian", "path", "track"]) assert.equal(on(cls).length, 0, cls);
  // 경로 800m: 40m 간격 양옆 최대 40그루 + 큰길 길가. 종전 20m 간격보다 적다.
  const many = on("tertiary").length;
  assert.ok(many <= 70, String(many));
  // 실제 나무 3그루가 있는 곳 150m 안에는 더하지 않고, 먼 쪽은 그대로다.
  const some = on("tertiary", [[9, 300], [9, 310], [9, 320]]);
  for (const t of some) assert.ok([300, 310, 320].some((y) => Math.hypot(t.x - 9, t.y - y) >= 148), `${t.x},${t.y}`);
  assert.equal(some.filter((t) => t.y > 180).length, 0);
  assert.ok(some.some((t) => t.y < 100));
  // 두 그루뿐이면 자료가 있다고 보지 않는다.
  assert.ok(on("tertiary", [[9, 300], [9, 310]]).some((t) => t.y > 180));
  // 숲·공원은 실제 나무가 있어도 그대로 심는다.
  const park = empty();
  park.greens.push({ cls: "wood", rings: [square(-100, -100, 100, 100)] });
  park.realTrees.push([0, 0], [20, 0], [40, 0]);
  assert.ok(run(park).length > 50);
});

test("상·하행을 두 줄로 그린 큰길은 두 줄 사이(차도)에 심지 않고 바깥쪽에만 심는다", () => {
  // 원주 서원대로: 일방통행 tertiary 두 줄, 간격 9~22m(중간 13.3m).
  for (const gap of [9, 13.3, 22]) {
    const up: XY[] = [[0, -300], [0, 300]], down: XY[] = [[gap, 300], [gap, -300]];
    const data = empty();
    data.roads.push({ cls: "tertiary", elevated: false, oneway: true, pts: up }, { cls: "tertiary", elevated: false, oneway: true, pts: down });
    data.greens.push({ cls: "park", rings: [square(-200, -200, 200, 200)] });
    const trees = run(data, [0, 0], up);
    assert.ok(trees.length > 30, `${gap} ${trees.length}`);
    for (const t of trees) assert.ok(t.x < 0 || t.x > gap, `${gap}m 두 줄 사이 ${t.x.toFixed(1)},${t.y.toFixed(1)}`);
    assert.ok(trees.some((t) => t.x < -3 && Math.abs(t.y) < 250) && trees.some((t) => t.x > gap + 3 && Math.abs(t.y) < 250), "바깥 양쪽");
  }
  // 양방향 한 줄 도로 두 개가 나란히 30m 넘게 떨어져 있으면 그 사이(실제 땅)는 그대로다.
  const data = empty();
  data.roads.push({ cls: "tertiary", elevated: false, oneway: true, pts: [[0, -300], [0, 300]] }, { cls: "tertiary", elevated: false, oneway: true, pts: [[40, 300], [40, -300]] });
  data.greens.push({ cls: "wood", rings: [square(5, -100, 35, 100)] });
  assert.ok(run(data).some((t) => t.x > 8 && t.x < 32), "40m 사이 숲");
  // 일방통행이 아닌 두 도로 사이도 그대로다(교차로·이면도로를 막지 않는다).
  const plain = empty();
  plain.roads.push({ cls: "tertiary", elevated: false, pts: [[0, -300], [0, 300]] }, { cls: "tertiary", elevated: false, pts: [[20, -300], [20, 300]] });
  plain.greens.push({ cls: "wood", rings: [square(5, -100, 15, 100)] });
  assert.ok(run(plain).some((t) => t.x > 5 && t.x < 15));
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

test("길가 나무를 끄면 경로 양옆·도로변은 비고 숲·공원은 그대로다", () => {
  const route: XY[] = [[0, -300], [0, 300]];
  const data = empty();
  data.roads.push({ cls: "tertiary", elevated: false, pts: route });
  data.greens.push({ cls: "wood", rings: [square(60, -100, 160, 100)] });
  const on = run(data, [0, 0], route);
  const it = placeRideTrees(data, [0, 0], route, { roadside: false });
  let step = it.next();
  while (!step.done) step = it.next();
  const off: RideTree[] = step.value;
  assert.ok(on.some((t) => Math.abs(t.x) < 15), "켬: 길가");
  assert.equal(off.filter((t) => Math.abs(t.x) < 15).length, 0, "끔: 길가 없음");
  assert.equal(off.length, on.filter((t) => t.x >= 60).length, "숲은 같다");
});
